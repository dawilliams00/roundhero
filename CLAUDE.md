# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RoundHero is a D&D 5e character tracker web app: Flask/SQLAlchemy backend, React frontend, Postgres on Render in production (SQLite locally). Single user currently (the owner, testing with their own character "Syric Nightbloom," a level 13 Shadar-kai Wizard imported from a D&D Beyond PDF). No test suite exists yet — there is no CI, no test runner setup beyond the default `react-scripts test` stub, and no backend test framework. Verification during development has been done via ad hoc Python scripts (`python -m py_compile ...` for syntax, one-off scripts that call the engine functions directly and print results) rather than a real test suite. The owner is non-technical-ish but has gotten comfortable with the project over many sessions; they drive feedback almost entirely from screenshots of the live app and an old Raspberry Pi/Tkinter tracker app they're porting features from (source under `Desktop\Wearables\` outside this repo, NOT in this repo).

## Commands

**Backend (from `backend/`):**
```
pip install -r requirements.txt
python app.py                          # runs on :5000, debug=True
python -m py_compile <file.py> ...     # syntax-check before pushing; no test suite exists
```

**Frontend (from `frontend/`):**
```
npm install
npm start                              # dev server on :3000, proxies API to :5000
npm run build                          # production build -> build/
```
Note: Node/npm have not been available in every assistant sandbox used on this project — if `npm run build` isn't reachable, fall back to careful manual review of JSX/diffs and let Render's own build step (which does have Node) catch any compile errors on deploy.

**Deploy:** Push to `main` — Render auto-deploys both services from GitHub.
- Backend: Web Service, `pip install -r requirements.txt`, start command `gunicorn "app:create_app()" --bind 0.0.0.0:$PORT` (quotes matter — `create_app()` has parens, which a shell will otherwise interpret).
- Frontend: Static Site, `npm run build`, publish `build/`, env var `REACT_APP_API_URL` pointing at the backend's Render URL.
- Backend and Postgres database must be in the **same Render region** or the backend can't resolve the DB host.
- Python runtime is pinned via `backend/runtime.txt` (`python-3.12.7`) — Render's newer default Python broke `psycopg2-binary`'s wheel compatibility once already.
- **Render does not support a Netlify-style `_redirects` file.** A SPA rewrite (so refreshing `/play/4` doesn't 404) has to be configured as a dashboard rule on `roundhero-web`: Redirects/Rewrites tab → Source `/*`, Destination `/index.html`, Action **Rewrite**. As of this writing the owner has not yet added this — refreshing anything but the root URL still 404s. This is a one-time manual dashboard step; no code change can fix it.

## Architecture

### Two parallel character-build paths feed one shared shape

Every character ends up with the same three JSON blobs — `tracker_data`, `spell_data`, `ae_data` — but they're produced by two completely different code paths that must be kept in sync:

- **Manual creation** (`engine/character_engine.py`): builds from `engine/content_packs.py`, a hand-authored dict of all 12 classes (hit die, saves, per-level features, spell slot progression). `build_tracker_data()` / `build_spell_data()` / `build_ae_data()`.
- **PDF import** (`engine/pdf_import.py`): `parse_character_pdf()` reads a D&D Beyond character sheet PDF. Critically, the visible D&D Beyond PDF is mostly a printed background — **the actual character data lives in PDF form-field widgets** (read via PyMuPDF/`fitz`, not the text layer; `pdfplumber`/text extraction will only return field labels). Field names follow D&D Beyond's fixed layout (`CLASS  LEVEL` — two spaces, `Wpn Name`/`Wpn Name {N}` inconsistently numbered, `spellName{N}`/`spellHeader{level}` for the spell table, etc.) — see the regexes in `pdf_import.py` for the exact contract. This path produces `build_ae_data_from_features()` instead of `build_ae_data()`.

Both paths must assign **`cost_type`** on every `ae_data` entry to one of `action` / `bonus_action` / `reaction` / `cast_spell` / `free_action` / `passive` — this is what the frontend's turn-economy bucket-tracking keys off. **The section an ability is filed under IS the turn-economy bucket** for action/bonus_action/reaction/cast_spell types (`ActionEconomyTab.js`'s `bucketForAbility(ability, section)` — `haste_action` is the one cost_type that maps to a different bucket name, `'Haste'`). A feature can display correctly under the right section header while still being inert for bucket-tracking if `cost_type` doesn't match the section it's filed under — this exact bug existed for months because both builders hardcoded `cost_type: "feature"` regardless of section, and a near-identical version of it existed in `CustomAbilityModal.js` (an independent `cost_type` dropdown that didn't have to agree with the chosen section) until that was fixed to *derive* cost_type from section automatically.

`"Cast a Spell"` appears as its own stock entry in **Action, Bonus Action, and Reaction** sections (`STOCK_ACTIONS`/`STOCK_BONUS`/`STOCK_REACTIONS` in both builders) — clicking CAST in a given section opens `CastSpellPickerModal` filtered to spells whose `casting_time` matches that bucket (`spellCastBucket()` in `utils/dnd.js`), so Counterspell won't show up under Action and Fireball won't show up under Reaction. Every ability — even ones with no tracked charge (Disengage, Dodge, etc.) — gets a USE button that marks the turn-bucket consumed even with nothing to decrement.

### Re-sync: PDF-imported characters can absorb engine improvements without losing live state

`Character.source_pdf` stores the raw uploaded PDF bytes. `POST /api/characters/<id>/resync` re-runs `parse_character_pdf()` on those stored bytes and merges the result into the existing character via `resync_character()` in `pdf_import.py`. The merge logic distinguishes parser-owned data from player-added data using a `"_source": "pdf"` tag on features/spells/items: anything tagged `pdf` is replaced by the fresh parse (so parser bug fixes propagate), anything untagged (added later through the UI — custom abilities, custom spells, custom items) is preserved untouched. Live/mutable state (HP, feature/slot/charge `current` counts, manual AC/initiative overrides) is also preserved across a resync, clamped to the new `max` values. When changing `pdf_import.py`'s parsing logic, the fix only reaches already-imported characters when the user clicks "Re-sync from PDF" — it does not retroactively touch stored `ae_data`/`tracker_data` on its own. The button lives on the **Notes tab** (`NotesTab.js`), labeled "↻ Re-sync from PDF".

Inventory items have the same staleness problem but no resync mechanism: `ItemBrowserModal`/`ItemDetailModal` copy a snapshot from `magic_items.json` into the character's `tracker_data.inventory.items` at add-time, with no link back afterward. A later fix to the reference data (wrong description, missing buff, etc.) never reaches characters who already own the item. `InventoryTab.js`'s `refreshItem()` (wired to a 🔄 **Refresh** button on `ItemDetailModal`) re-pulls static fields (description/weight/rarity/buffs/granted_spells/charge mechanics) from `/api/content/items` by name match and merges them in, while leaving quantity/equipped/attuned/current-charges untouched. This is an explicit per-item action, not automatic — it was deliberately kept manual rather than auto-merging on every character load, since auto-merging description/rarity could silently clobber a player's intentional edits to a custom-tweaked item.

### `tracker_data` is a single free-form JSON blob, not normalized columns

`models/character.py` stores `tracker_data`, `spell_data`, `ae_data`, `notes`, `ability_scores` each as a `Text` column holding JSON (property getters/setters handle the (de)serialization). This means **adding a new field to the character's runtime state never requires a migration** — components just read/write nested keys via `saveTrackerData()`. The known shape of `tracker_data` (no schema enforces this, components rely on convention):
```
features: { [name]: {current, max, rest_type, action, description, _source?, spell_picker?, tucked_spell?, tucked_level?} }
spell_slots: { [level]: {current, max} }
item_charges: {}            # legacy, mostly superseded by inventory.items[].charges
conditions: [string]
hp: {current, max, temp, max_override}
hit_dice: {current, total, die_size}
ac, initiative, inspiration, in_initiative: scalars
traits: {resistances, immunities, vulnerabilities, advantages, disadvantages: [string | {name, description}]}
active_effects: [string]    # e.g. "Hasted" — TrackerTab.js lets the player add/remove any name freely
inventory: {currency: {cp,sp,ep,gp,pp}, items: [{name, quantity, weight, rarity, equipped, attunement, attuned, charges?, granted_spells?, buffs?, cost_type?, _source?}]}
save_proficiencies, skill_proficiencies: [string]
```
`items[].cost_type` (`action`/`bonus_action`/`reaction`/`free_action`, or unset) is player-assigned per item via a dropdown in the Action Economy tab's ITEMS section, since the 1,267-item reference DB has no notion of "what action does activating this cost" — using a charge while `in_initiative` marks that bucket consumed the same way a feature would. `features[name].spell_picker` flags a "tuck & release" ability (see below).

`Character.source_pdf` is the one real column that *did* require a migration. Since `db.create_all()` only creates missing tables and never alters existing ones, `app.py` has a `PENDING_COLUMNS` list + `_apply_pending_migrations()` that runs additive `ALTER TABLE ... ADD COLUMN` statements on every startup (Postgres `IF NOT EXISTS`, SQLite best-effort). Any future new *column* (not a `tracker_data` key) must be added to that list or it will silently not exist in the deployed Postgres DB. A brand-new *table* (like `CustomContent`, below) doesn't need an entry here — `db.create_all()` creates missing tables fine, it just never alters existing ones.

### Shared content library: `CustomContent` table, not per-character JSON

Player- or DM-created homebrew content is meant to become available to *every* character, not just the one it was typed in on ("a player or DM creates a feat once, it's in the DB forever, searchable by anyone" — the owner's explicit framing). `models/custom_content.py`'s `CustomContent` is a generic table: `user_id`, `content_type` (`"spell"` | `"feat"`, more types later), `name`, and a free-form JSON `data` column — deliberately generic so a future content type doesn't need its own table. `routes/content.py` has GET/POST pairs (`/content/spells`, `/content/feats`) where GET merges the static JSON-file content with all `CustomContent` rows of that type (**unfiltered by user** — homebrew is shared across everyone, not scoped to its creator) and POST creates a new row. `CustomSpellModal.js` and `CustomAbilityModal.js` both POST here in addition to attaching the new spell/feature to the character that created it. `FeatBrowserModal.js` is the read side for feats — lets any character search the library and add an existing entry instead of retyping it (`ActionEconomyTab.js`'s "Browse Feats" button); `SpellBrowserModal.js` already did the equivalent for spells via the existing `/content/spells` GET.

### Generic "tuck & release a spell" ability (ported from the Pi tracker's Cartomancer feat)

A feature with `spell_picker: true` in `tracker_data.features` renders specially in `ActionEconomyTab.js`: instead of a plain USE button it gets an OPEN button that launches `SpellTuckModal.js`. That modal lets the player pick **any spell from the full class spell list** (fetched live from `/api/content/spells?class_name=X`, not limited to the character's own known spells — this is the actual homebrew rule and was a real bug before the fix) to "tuck," then later "cast" the tucked spell for free (decrements the feature's `current` count, no slot spent). `CustomAbilityModal.js` has a checkbox to flag a new custom ability this way, so this is a reusable capability, not a one-off hardcoded "Cartomancer" feature. `class_name` for PDF-imported characters is often a raw string like `"Wizard 13"` or multiclass `"Wizard 10 / Fighter 3"` — `parseClassLevels()` in `utils/dnd.js` is the shared parser for splitting that into `{className, level}` parts; the spell-list fetch currently only uses the *first* class found.

### Spell attack modifier / save DC and damage rolling

`getSpellcastingBlocks(classNameRaw, abilityScores, totalLevel, items)` in `utils/dnd.js` returns one `{className, ability, attackMod, saveDC}` block per spellcasting class found via `parseClassLevels` + a hardcoded `SPELLCASTING_ABILITY` map — multiclass characters with two casting classes get two blocks. It folds in `itemSpellBonuses(items)`, which sums `spell_attack_modifier`/`spell_dc_modifier` buffs from items that are **both `equipped` and, if `attunement` is required, `attuned`** (Staff of the Magi/Robe of the Archmagi only grant their bonus while held/attuned per RAW — gating on `equipped` alone was wrong and got fixed). These blocks render in the header (under HP), the Spells tab header, and inside `SpellDetailModal`.

Spell damage uses **structured fields already present in `spells.json`** (`damage_dice`, `damage_type`, `save_type_abbr`, `is_attack`, `attack_type`, `higher_level`) rather than parsing the description text — much more reliable than it sounds, the data was already there. `scaleSpellDamage(spell, castLevel)` scales the dice up via a regex against `higher_level`'s "increases by NdM for each slot level above Xth" phrasing; it only understands that one common phrasing, so spells that scale a different way (e.g. Magic Missile's extra-missile wording) aren't scaled — known, accepted limitation. Casting a damage spell shows a **"Roll Damage?" button** (not an auto-roll — the owner explicitly wants to choose when to roll) with a Reroll/Done flow afterward, instead of the popup just confirming the cast and closing.

One subtlety: when a spell is resolved from an item's fixed `granted.cast_level` (e.g. Fireball always cast at 7th via Staff of the Magi's charges, in `ItemSpellsModal.js`'s `resolveSpell()`), `level_int` gets overwritten to that cast level for display — but `scaleSpellDamage` needs the spell's *true* base level to know how many levels above base it's being upcast. `resolveSpell()` preserves that under `base_level_int`; `scaleSpellDamage` checks `spell.base_level_int ?? spell.level_int`. Forgetting this field is exactly the bug that shipped once (Fireball-via-staff showed base 8d6 instead of scaled 12d6) and got fixed.

### Session handling: 401s used to fail completely silently

Two related footguns, both fixed: (1) `JWT_ACCESS_TOKEN_EXPIRES` was never set in `app.py`, so flask-jwt-extended silently defaulted to **15 minutes** — every save after that point 401'd. (2) `utils/api.js`'s axios instance had no response interceptor at all, so a failed request (expired token, network blip, 500) just vanished with zero UI feedback, indistinguishable from data loss. Both are fixed now: token expiry is 30 days (fine for a single-user personal app), and the interceptor shows an alert on any failure, with a 401 specifically clearing the stored token and bouncing to the login screen with a clear message rather than just erroring. **If "something didn't save" alerts start recurring, suspect this layer first** before assuming a feature-specific bug — it's exactly what surfaced the (already-correct) Staff of the Magi data as "broken" once, when the real issue was a timed-out cross-reference request.

### Frontend: one context, and a sharp footgun in it

`context/CharacterContext.js` is the single source of truth — every tab/modal reads character state and mutates it through functions exposed here (`saveTrackerData`, `useSlot`, `useItemCharge`, `addActiveEffect`, `turnUsed`/`setTurnUsed`/`resetTurn` for the Action Economy turn-bucket UI state, etc.), each a thin wrapper that PUTs/POSTs and updates local state from the response. **Ordering matters**: these are all `useCallback`s defined as sequential `const`s in one function body, and several depend on `saveTrackerData` (it's in their dependency array). Defining a new helper *before* `saveTrackerData`'s own `const` line throws `ReferenceError` (temporal dead zone) the instant the provider renders — and since this provider wraps the entire app, that crash is a blank screen on *every* route, not just wherever the new function is used. This has happened more than once; when adding a new context function that calls `saveTrackerData`, place its declaration after `saveTrackerData`'s.

`GameView.js` renders `CharacterHeader` (always visible) plus one of five tabs (`ActionEconomyTab`, `TrackerTab`, `SpellsTab`, `InventoryTab`, `NotesTab`), each independently reading/writing `tracker_data` through the context.

`CharacterHeader.js` is a two-column flex layout, not one row: the left column stacks the title row, then a stat row (HP+spell-attack/DC stacked, Temp HP, AC, INIT, Prof, Inspiration, Attunement count, then ability-score boxes with spell slot pips stacked below them), then trait chips; the right column (Currency + Saves/Skills/Traits/Rest, with Hit Dice under Rest) is a sibling of the left column so it starts flush at the top instead of being vertically centered against the stat row. The owner has iterated on this layout a lot via screenshots with hand-drawn arrows — when adjusting it again, get current placement from a screenshot rather than assuming the last description is still accurate. Currency editing is a popover numeric keypad (`CoinCalculator`) opened by clicking a coin value, not a free-text input — it does a relative +/- adjustment and Apply, not an absolute-value set. The Attunement count only turns red when it's an actual problem (over the 3-item cap, or under cap while an unattuned eligible item sits unused) — not just for being below 3/3.

### Flat JSON reference databases, loaded once at import time

`backend/data/spells.json` (412 spells) and `backend/data/magic_items.json` (1,267 items) are loaded module-level by `engine/spell_data.py` / `engine/item_data.py` and served read-only via `/api/content/spells` and `/api/content/items` (now merged with `CustomContent` rows, see above). `magic_items.json` was generated by converting 5etools' open data export (not part of this repo — it lived outside the project when generated) plus the user's own homebrew items appended on top; there is no in-repo script that regenerates it. The PDF importer cross-references both DBs by name to enrich/correct what it parses from the PDF — e.g. an inventory item matching a DB entry has its `charges`/`granted_spells`/`description` overwritten by the DB's (more reliable) values rather than trusting the PDF's printed weapon-table notes.

## Current status (for picking up a new session)

**Live:** `dawilliams00/roundhero` on GitHub, auto-deploying to Render — backend as `roundhero-api` (Web Service), frontend as `roundhero-web` (Static Site), Postgres add-on in the same region as the backend. `roundhero.app` DNS is now pointed at Render (an `A` record `@` → `216.24.57.1` and `CNAME` `www` → `roundhero-web.onrender.com`, set directly in Namecheap's Advanced DNS). **Outstanding manual step the owner still needs to do**: add the SPA Rewrite rule in Render's dashboard for `roundhero-web` (see Commands section above) — without it, refreshing any route other than the bare root 404s and bounces to the login page. This needs to be done in Render's own UI; no code/config in this repo can fix it (Netlify-style `_redirects` does not work on Render, confirmed via Render's docs — don't re-attempt that).

**Who's using it:** Just the owner, testing with one real character ("Syric Nightbloom," a level 13 Shadar-kai Wizard) imported from a D&D Beyond PDF export, with a fair amount of homebrew (Cartomancer-style tuck/release feat, "Quickness of Shadow" bonded-to-Nyx feat, etc.). Feature work is driven almost entirely by the owner screenshotting the live app (sometimes with hand-drawn arrows annotating exactly where something should move) and comparing against their old Raspberry-Pi/Tkinter tracker app.

**Recently fixed (this session, large batch):** Action Economy bucket model overhauled (see Architecture); header completely redesigned multiple times based on iterative screenshot feedback (current layout described above); Spells tab restructured to a static header + scrolling list with per-row Cast buttons; currency moved from Inventory tab into the header with a calculator popover; Tracker tab gained an Attunement card and made every feature clickable for its full description, plus the ability to delete features (gated to exclude only true class-engine defaults, since those have no recovery path — PDF-imported and custom features are both deletable, PDF ones come back on a Re-sync if removed by mistake); shared `CustomContent` library added for spells and feats; spell attack/DC and damage rolling added throughout; the 15-minute JWT expiry and the fully-silent-failure bug (see Session handling above) — this combination was responsible for most of the "X is broken" reports this session turning out not to be real bugs in the affected feature.

**Known gaps / likely next asks:**
- **Next planned work (owner's stated intent): a 5e content pipeline from Open5e's free API** — pull spells/feats/monsters/etc. from `api.open5e.com` (no key needed), reshape to match the existing `spells.json`/`magic_items.json` shape, write new static JSON files + matching `engine/*_data.py` + `/api/content/*` routes (same pattern already established for spells/items), store once and never call the live API again at runtime. The SRD PDF was floated as a fallback for anything Open5e's API doesn't cover. This slots naturally on top of the `CustomContent` work done this session (official SRD content as the base layer, `CustomContent` homebrew layered on top via the same merge pattern).
- The Render dashboard Rewrite-rule step above is still outstanding.
- No automated tests at all.
- Multiclass characters are display-only on the manual-creation path — `content_packs.py`'s `CLASSES` dict and `character_engine.py` assume single-class; PDF import handles multiclass better since it trusts the PDF's own numbers rather than recomputing. Several of this session's multiclass-aware features (spellcasting blocks) only look at the *first* class in a multiclass string for spell-list-filtering purposes (e.g. tuck & release); attack/DC correctly produces one block per casting class.
- No DM-facing tools (the 5etools items DB and any future bestiary import would mostly serve a DM view that doesn't exist yet) — directly relevant once the Open5e pipeline lands monster data.
- No password reset, no settings/profile page.
- `magic_items.json`'s conversion from 5etools data was a one-time manual process — there's no script in this repo to refresh it if the source data changes. The new `CustomContent`-merge pattern is the long-term answer for *additions*; bulk-correcting the existing static file would still need a one-off script.
- `scaleSpellDamage`'s upcast scaling only understands the single common "+NdM per slot level above Xth" phrasing in `higher_level` text — spells that scale differently (extra projectiles, different effect at higher levels, etc.) just use their base damage regardless of cast level.
