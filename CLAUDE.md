# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.
It is the **master log of durable project guidance** — updated at the end of a session
only with decisions that should survive beyond the current task. `todo.md` (repo root)
is the short active work list; check it first each session. Campaign/encounter active
handoff lives in `CAMPAIGNS_INTEGRATION_NOTES.md`, while shipped campaign history lives
in `CAMPAIGNS_PROGRESS.md`. Keep facts in one place where possible; don't let them drift
into duplicates.

## New Feature Planning Prompt

Use this only when starting a new feature, new product direction, or major uncertain build. Do not interrupt an already-running task with this prompt for every small implementation decision.

Before you build anything, write me a spec for this project.

What does it do? Who is it for? Who is it NOT for?

What does success look like? What's out of scope?

Then walk me through each step of how you'd build it,

and for each step show me the key decisions you'd make

and what you'd default to. Don't build anything yet.

## New Direction Interview Me Prompt

Use this only when starting a new feature, new product direction, or major uncertain build. Do not interrupt an already-running task with this prompt for every small implementation decision.

Before we start building, interview me about what we're trying to build.

Work with me to identify the core problem we're solving, who it is and isn't for.

As part of the interview, let's work through any key decisions together to help inform the implementation strategy.

Then summarize it back to me as an implementation spec before we write any code.

## Skill Creation / Gotcha Capture Prompt

When a workflow repeats, a known mistake recurs, or the owner says "based on this conversation create me a skill", suggest turning the pattern into a reusable skill.

Use this wording when appropriate:

Based on this conversation, create me a skill.

Based on this conversation, enhance any skill I use to include a gotcha section. So we don't make the same mistakes again.

Default behavior:
- Suggest skills only for repeated workflows, fragile deploy/test routines, recurring UI regressions, recurring ownership/coordination mistakes, or project-specific rules that agents keep forgetting.
- Do not interrupt active implementation for every minor choice.
- Gotchas must be concrete: name what went wrong, how to recognize it, and what to do instead.
- Codex personal skills live under `C:\Users\David\.codex\skills`; Claude should mirror the same durable rules in `CLAUDE.md` because Claude does not automatically load Codex skills.
- Current Codex skill created from this conversation: `roundhero-collaboration`.

## Product North Star

RoundHero exists to help the table play more D&D and spend less time repeatedly figuring out mechanics. The project should automate gameplay reminders and calculations wherever reasonable so players and the DM can stay in the RPG flow.

The target balance is roughly **75% combat efficiency / quicker combat play** and **25% enabling character, homebrew, campaign, and table workflows that D&D Beyond does not support well**.

Design defaults:
- Surface triggered options and reminders at the moment they matter: Smite, Arcane Discharge, Booming Blade movement damage, concentration, Haste lethargy, death saves, item charges, action economy, etc.
- Prefer "make the correct thing obvious" over expecting players to remember every feature.
- Preserve DM/player secrecy and table trust: automate hidden mechanics only when the right audience can see them.
- Ask for owner taste when the change affects feel, UX, rules interpretation, table policy, or player-facing experience.
- Automate without asking when the task is mechanical, reversible, low-taste, and has clear success criteria.

## Automate vs Augment

Before starting a task, classify it:

- **Automate** when the request is mechanical, reversible, low-taste, and has clear success criteria. Examples: parsing data, filling missing structured item/feat/spell fields, syntax/build fixes, scoped consistency cleanup, validations, and explicitly requested doc/todo notes.
- **Augment / ask for feedback** when the request involves UX feel, layout taste, visible wording, D&D rule interpretation, hidden/player-facing information, campaign policy, permissions/security, destructive edits, or multiple valid product directions.

Default if unsure:
- Ask one concise question for product/taste/rules uncertainty.
- Proceed automatically for code/data maintenance with obvious intent.

## What this is

RoundHero is a D&D 5e character tracker: Flask/SQLAlchemy backend, React frontend,
Postgres on Render in production (SQLite locally). Single user currently (the owner,
testing with their own character "Syric Nightbloom," a level 13 Shadar-kai Wizard
imported from a D&D Beyond PDF), plus a second real PDF-imported character, **Barry
McCockiner** (multiclass Paladin/Sorcerer) used to catch multiclass-specific bugs Syric
alone wouldn't surface. No test suite exists — verification is `python -m py_compile` for
backend syntax and careful manual diff/JSX review for frontend (no Node/npm in this
sandbox, confirmed absent repeatedly — don't retry `node`/`npm`/`npx`; let Render's real
build step catch compile errors on deploy). The owner is non-technical-ish but experienced
with this project; feedback comes almost entirely from screenshots of the live app and an
old Raspberry Pi/Tkinter tracker they're porting features from (source under
`Desktop\Wearables\Syric Arcane Controller\` — the live copy, not the dated `Backup`
folders — outside this repo).

**Confirmed ESLint failure mode:** this project's ESLint has no `eslint-plugin-react-hooks`
configured. An `eslint-disable-next-line react-hooks/exhaustive-deps` comment referencing
that unconfigured rule made `react-scripts build` hard-fail on Render ("Definition for rule
... was not found"), not just warn. Don't add hook-dependency eslint-disable comments; leave
an intentionally-incomplete deps array as-is with a plain comment, no disable directive.
Properly enabling the plugin is a deliberate future TODO (see backlog) — not to be done
blind, since it may surface latent warnings Render's build treats as errors.

## Commands

**Backend (from `backend/`):**
```
pip install -r requirements.txt
python app.py                          # :5000, debug=True
python -m py_compile <file.py> ...     # syntax-check before pushing
```

**Frontend (from `frontend/`):**
```
npm install
npm start        # :3000, proxies API to :5000
npm run build    # -> build/
```

## Deploy

Push to `main` — Render auto-deploys both services from GitHub.
- Backend: Web Service, start command `gunicorn "app:create_app()" --bind 0.0.0.0:$PORT`
  (quotes matter — parens in `create_app()` would otherwise get shell-interpreted).
- Frontend: Static Site, `npm run build`, publish `build/`, env `REACT_APP_API_URL`.
- Backend + Postgres must be in the **same Render region** or DB host resolution fails.
- Python pinned via `backend/runtime.txt` (`python-3.12.7`) — a newer default once broke
  `psycopg2-binary`'s wheel compatibility.
- **Render has no Netlify-style `_redirects` file.** SPA rewrite (so `/play/4` survives a
  refresh) needs a dashboard rule on `roundhero-web`: Redirects/Rewrites → Source `/*` →
  Destination `/index.html` → Action **Rewrite**. **Still not added as of this writing** —
  refreshing any non-root route 404s. One-time manual dashboard step, no code fix exists.
- **Standing policy: always commit and push every change, without asking first.** The
  owner validates only against the live deployed app with no local run and no browser
  access for the assistant — uncommitted work is invisible to him, and a manual Render
  "redeploy" just re-ships the last pushed commit. This has already cost a full review
  cycle once (a session's fixes sat uncommitted; he re-reported already-fixed bugs as
  broken). Pre-authorized standing policy, same footing as `py_compile` standing in for a
  real test suite — sanity-check, then commit+push immediately, don't batch.
- **Before asking the owner to approve any tool/permission, check `.claude/settings.json`
  (and `.claude/settings.local.json`) first.** Those files already grant this repo a broad
  allowlist (`Bash(*)`, `Edit(*)`, `Write(*)`, `Read(*)`, plus many specific entries incl.
  `Bash(git push *)`). If what you're about to do is already covered there, just do it —
  don't surface a needless confirmation. When a `git`/`push` action prompts anyway, it's
  usually because the command was chained after `cd`/`&&` and didn't match a pattern
  anchored on `git push`; run `git push` as its own separate Bash call so it matches the
  existing allow entry cleanly instead of re-prompting.
- **Outstanding manual step:** `FEEDBACK_SMTP_USER`/`FEEDBACK_SMTP_PASSWORD` env vars on
  `roundhero-api` (feedback button, `routes/feedback.py`) — still not set as of this
  writing. Must be a Gmail **App Password** (2-Step Verification → App passwords), not the
  normal account password. `FEEDBACK_EMAIL_TO` optional, defaults to the owner's Gmail.

## Parallel Claude/Codex workflow

The owner may run Claude Code and Codex at the same time on this PC — do not assume
shared working directory. Claude works in the main folder `C:\Users\David\Desktop\RoundHero`
on character-sheet systems; Codex works campaign/DM/encounter systems, historically from
the sibling worktree `C:\Users\David\Desktop\RoundHero-Campaigns` on `feature/campaigns`,
though recent batches have landed as ordinary commits merged straight into `main` — check
`git log`/`git worktree list` for current state rather than assuming the split is exactly
as last documented. Never put a worktree nested inside the main repo folder.

**Ownership boundaries — reconfirmed 2026-07-01** (while both agents are active, don't
casually cross these):
- Claude owns the **character-sheet side**: core character sheet UI, normal AE tab and
  Syric AE tab internals (including the item-charge row layout), Spellbook/Inventory/
  Settings/character editor, Syric/Shadow feature polish, and character-sheet condition/
  effect application mechanics — *except* where campaign sync needs a stable API contract
  (see the data-contract paragraph above), which stays a shared concern. Key files:
  `CharacterContext.js`, `CharacterHeader.js`, `SpellDetailModal.js`,
  `ActionEconomyTab.js`, `engine/character_engine.py`, `engine/pdf_import.py`.
- Codex owns the **campaign/encounter/DM tooling side**: campaign screen behavior,
  encounter setup and the active encounter tracker, campaign effects/Add Effect workflow,
  DM-facing rules/roster/invites/membership, player-facing campaign/encounter popups, and
  the backend campaign/encounter routes supporting all of that. Key files:
  `models/campaign.py`, `routes/campaigns.py`, `context/CampaignContext.js`,
  `pages/CampaignsPage.js`, encounter-tracker models/routes/pages/contexts.
- Shared/integration-only, don't casually edit while both are active: `App.js`,
  `backend/app.py`, `models/__init__.py`, nav/header entry points, shared providers, and
  this `CLAUDE.md`. (`CAMPAIGNS_INTEGRATION_NOTES.md` is Codex's own handoff/scratch doc —
  treat as Codex's to maintain.)

When merging campaign/DM work into `main`: pause Claude's active edits or commit them
first, merge deliberately (expect conflicts in the shared/bridge files above — keep both
sides' changes rather than replacing whole files), run `py_compile` on touched backend
files, do a careful frontend diff review (no Node here), then commit and push. Campaign
tables (`Campaign`, `CampaignMember`, `CampaignCharacter`, `CampaignEffect`,
`CampaignEncounter`) are new tables — `db.create_all()` creates them fine on Render, no
`PENDING_COLUMNS` entry needed unless a change adds a column to an *existing* table.

Local Codex shell note: `npm` is not on PATH in this desktop session. Use the bundled
runtime paths from `load_workspace_dependencies` instead, especially
`C:\Users\David\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`
and `...\dependencies\bin\pnpm.cmd`. If `pnpm run build` blocks on ignored dependency
build scripts, run the existing local script directly with bundled Node, e.g.
`node.exe frontend\node_modules\react-scripts\bin\react-scripts.js build`.

Current campaign/encounter feature state (DM-owned, live): invite-code join, DM/player
roles with promote/demote, character roster with Remove (detach) vs Inactivate (soft
toggle) vs player-initiated Leave Campaign, a pending/applied/removed party-effects
ledger, campaign-wide `Rules` (death-save/exhaustion notes) surfaced across the DM
runner/player view/death-save popup, and a DM encounter builder (party+monster combatants,
shared initiative, HP/temp/AC/conditions/concentration/death saves, hidden-from-players
enemies, start/pause/resume/complete). Active-encounter attack/save target resolution V1
also now exists (weapon attacks and damaging spells resolve hit/miss or pending-save
against a chosen encounter target, with resistance/immunity/vulnerability damage
adjustment). See `CAMPAIGNS_INTEGRATION_NOTES.md` for the live, detailed pending contract
on this system (authorized DM sheet-editing model, animate-dead, richer target resolution,
etc.) — that file is updated more frequently than this one on encounter/campaign specifics.

Character-sheet data contract this app must keep stable for campaign integration: a
character attached to a campaign should expose `hp{current,max,temp}`, `ac`, `conditions`,
`concentration_slots`, `active_effects`, `prepared_spells`, `spell_slots`, and
`action_economy` state in a way Codex's encounter sync can read; spell casts targeting an
ally/combatant should be able to emit a campaign effect payload
(`source_character_id`/`target_character_id`/`name`/`effect_type`/`duration`/
`concentration`/`status`/`payload`). Death saves must never be made public — that's a
private player/DM flow only.

## Architecture

### Two parallel character-build paths feed one shared shape

Every character ends up with the same three JSON blobs — `tracker_data`, `spell_data`,
`ae_data` — produced by two different code paths that must stay in sync:

- **Manual creation** (`engine/character_engine.py`): builds from `engine/content_packs.py`
  (hand-authored dict of all 12+ classes). `build_tracker_data()`/`build_spell_data()`/
  `build_ae_data()`.
- **PDF import** (`engine/pdf_import.py`): `parse_character_pdf()` reads a D&D Beyond PDF —
  the actual data lives in **form-field widgets** (read via PyMuPDF/`fitz`, not the text
  layer). Field names follow D&D Beyond's fixed layout (`CLASS  LEVEL` two spaces,
  `Wpn Name{N}`, `spellName{N}`/`spellHeader{level}`, etc — see the regexes in
  `pdf_import.py`). Produces `build_ae_data_from_features()` instead.

Both paths must assign **`cost_type`** on every `ae_data` entry
(`action`/`bonus_action`/`reaction`/`cast_spell`/`free_action`/`passive`) — this is what
`ActionEconomyTab.js`'s turn-economy bucket tracking keys off
(`bucketForAbility(ability, section)`; `haste_action` maps to the special `'Haste'`
bucket). **The section an ability is filed under IS the bucket** — a feature can render
under the right header while being inert for tracking if `cost_type` doesn't match; this
exact bug shipped for months (both builders hardcoded `cost_type: "feature"`) and a
near-identical version existed independently in `CustomAbilityModal.js` until fixed to
derive `cost_type` from the chosen section automatically.

`"Cast a Spell"` is a stock entry in Action/Bonus Action/Reaction sections, filtered by
`spellCastBucket()` (`utils/dnd.js`) so Counterspell won't show under Action nor Fireball
under Reaction. Every ability gets a USE button that marks its bucket consumed even with
no charge to decrement.

### Re-sync: PDF characters absorb engine fixes without losing live state

`Character.source_pdf` stores the raw PDF bytes. `POST /characters/<id>/resync` re-parses
and merges via `resync_character()`, distinguishing parser-owned data from player-added
data via a `"_source": "pdf"` tag: tagged data is replaced by the fresh parse, untagged
(player-added) data is preserved. Live state (HP, charges, manual AC/init overrides) is
preserved and clamped to new maxes. Only reaches a character when they click "↻ Re-sync
from PDF" (Notes tab) — parser fixes don't retroactively touch stored data on their own.

Inventory items have the same staleness problem with no automatic resync: `InventoryTab.js`
's 🔄 Refresh button on `ItemDetailModal` re-pulls static fields (description/weight/
rarity/buffs/granted_spells/charges) by name match, leaving quantity/equipped/attuned/
current-charges untouched — deliberately manual, not automatic on load, since
auto-merging could clobber a player's intentional item edits. A "🔄 Resync All" bulk
version of this also exists on the Inventory tab.

### `tracker_data` is one free-form JSON blob, not normalized columns

`models/character.py` stores `tracker_data`/`spell_data`/`ae_data`/`notes`/`ability_scores`
each as `Text` (JSON, property getters/setters). Adding a new runtime-state field never
needs a migration — components read/write nested keys via `saveTrackerData()`. Known shape
(no schema enforces this, by convention only):
```
features: { [name]: {current, max, rest_type, action, description, _source?, spell_picker?, tucked_spell?, tucked_level?, granted_spell?, ability_override?} }
spell_slots: { [level]: {current, max} }; pact_slots (Warlock multiclass, see below)
conditions: [string]          # excludes "Exhaustion" (its own field)
exhaustion: 0-6                # plain int, no mechanical effects enforced
settings: {ruleset?, exhaustion_rules?: {mode:'raw'|'homebrew', name?, description?}}
hp: {current, max, temp, max_override}; hit_dice: {current, total, die_size}
ac, initiative, inspiration, in_initiative: scalars
traits: {resistances, immunities, vulnerabilities, advantages, disadvantages, senses}: [string | {name, description}]
active_effects: [string]      # e.g. "Hasted"
inventory: {currency, items: [{name, quantity, weight, rarity, equipped, attunement, attuned, charges?, granted_spells?, buffs?, cost_type?, is_weapon?, weapon_category?, weapon_range?, damage_dice?, damage_type?, properties?, two_handed_damage?, proficient?, two_handed?}]}
save_proficiencies, skill_proficiencies, skill_expertise: [string]
active_creatures: [{id, creature_name, instance_name, hp}]  # beast summoning v1
classes: [{class_name, level, subclass}]   # multiclass source of truth
companion, companion2, active_companion    # see Companion tracking
concentration: {slots: [{spell, level, target?, no_lethargy?}, ...]}  # 2 stored, N active
metamagic_known: [string]
background: string
```
`items[].cost_type` is player-assigned per item (Action Economy ITEMS section dropdown) —
the 1,267-item reference DB has no notion of activation cost. `features[name].spell_picker`
flags a tuck-&-release ability (below).

`Character.source_pdf` is the one column that needed a migration — `app.py`'s
`PENDING_COLUMNS` + `_apply_pending_migrations()` runs additive `ALTER TABLE` on every
startup. **Any future new column (not a `tracker_data` key) must be added there** or it
silently won't exist on deployed Postgres. New *tables* don't need an entry — `create_all()`
handles those.

### Shared content library: `CustomContent` table

Homebrew content (spells, feats, monsters, items, rulesets) is meant to be available to
*every* character, not just the one that created it — a generic table:
`models/custom_content.py`'s `CustomContent` (`user_id`, `content_type`, `name`, free-form
JSON `data`). `routes/content.py` GETs merge static JSON-file content with all
`CustomContent` rows of that type (unfiltered by user — shared, not creator-scoped).

Three variations on the pattern exist depending on the content type's real-world need:
1. **Spells/feats/monsters/class-features:** plain duplicate/homebrew rows only, browse-
   and-add via `SpellBrowserModal`/`FeatBrowserModal`/`MonsterDetailModal`/
   `ClassFeatureBrowserModal`. Full edit/delete for homebrew-owned rows.
2. **Items:** *two* content_types, because "fix canon" and "make my own variant" are both
   real asks here — `item_override` corrects a canon `magic_items.json` entry in place (by
   name match, `GET /content/items` swaps it in, static file untouched;
   `ItemBrowserModal.js`'s "✏️ Admin Edit"/"📋 Duplicate"/"↺ Revert"), while plain `item`
   rows are independent homebrew duplicates. Same pattern extended to feats
   (`feat_override`) and spells (`SpellEditModal.js`).
3. **Rulesets** (currently just homebrew exhaustion rules): upserted **by name** via
   `PUT /content/rulesets` on every field blur — one player typing a homebrew table makes
   it searchable for everyone with no separate publish step
   (`RulesetBrowserModal.js` is the import side).

An already-owned copy of an admin-edited/overridden item picks up the fix via the existing
per-character 🔄 Refresh, same as any other canon data fix.

### Generic "tuck & release a spell" ability (ported from the Pi tracker)

`spell_picker: true` on a `tracker_data.features` entry renders an OPEN button
(`ActionEconomyTab.js`) launching `SpellTuckModal.js`, which lets the player pick **any**
spell from the full class list (live `/content/spells?class_name=X` fetch, not limited to
known spells — this is the actual homebrew rule) to "tuck," then cast it free later
(decrements `current`, no slot spent). `CustomAbilityModal.js` has a checkbox to flag a new
ability this way. `parseClassLevels()` (`utils/dnd.js`) splits a decorated/multiclass
`class_name` string (`"Wizard 13"`, `"Paladin 6 / Sorcerer 6"`) — the spell-list fetch here
still only uses the *first* class found (known, smaller remaining limitation).

### Feat-granted known spells with a free-use charge + optional ability override

For feats like Draconic Healing: grants a spell permanently known, castable N times/rest
without a slot, *and* via a real slot, with attack/DC fixed to a chosen ability regardless
of class. `CustomAbilityModal.js`'s three ability-type checkboxes (spell-like / tuck-&-
release / grants-known-spell) are mutually exclusive. On submit, writes to **two** places:
`tracker_data.features[name]` gets `granted_spell`/`ability_override`, and the spell object
in `spell_data.known_spells` gets tagged `{granted_by, ability_override, free_use_feature}`.
`SpellDetailModal.js` reads both tags directly — `ability_override` swaps in a single fixed
attack/DC block; `free_use_feature` surfaces a "Cast Free" button via `doFreeCast()`
alongside or instead of the normal slot-cast button (fixes a real bug: a non-caster with
only a feat-granted spell had Cast permanently disabled since `hasAvailableSlot()` was the
only castability check). Same mechanism now backs Resilient/Magic Initiate/Skilled choice-
feats and 2024-background feat grants (below) — reused, not reimplemented per feature.

**Old ad hoc grants** (added via "+ Custom Spell" with just a display string, before this
existed) don't retroactively get the new behavior — needs manual delete-and-recreate
through the proper flow. No migration retrofits old data.

### Spell attack/DC, damage rolling, and cantrip scaling

`getSpellcastingBlocks()` (`utils/dnd.js`) returns one `{className, ability, attackMod,
saveDC}` per spellcasting class (multiclass = multiple blocks, rendered side-by-side).
Folds in `itemSpellBonuses(items)` — items must be `equipped` **and** `attuned` if
required (gating on `equipped` alone was a real fixed bug for Staff of the Magi-style
items). Renders in header, Spells tab, `SpellDetailModal`.

Damage uses structured `spells.json` fields (`damage_dice`, `damage_type`,
`save_type_abbr`, `is_attack`, `higher_level`), not text parsing.
`scaleSpellDamage(spell, castLevel)` scales via regex against `higher_level`'s "+NdM per
slot above Xth" phrasing only — spells that scale differently (Magic Missile) aren't
auto-scaled, accepted limitation. A "Roll Damage?" button (never auto-rolls) with
Reroll/Done. When a spell's `level_int` is overwritten to a fixed cast level (e.g. Fireball
always-7th via Staff of the Magi), `base_level_int` preserves the true base level so
scaling still computes correctly (a real bug once: Fireball-via-staff showed unscaled 8d6).

Ordinary cantrip damage now scales by **character level** (double/triple/quadruple at
5th/11th/17th) via `cantripDiceMultiplier`/`cantripHitBonusForLevel` — previously only
specially-flagged weapon-attack cantrips (Booming Blade etc, `cantrip_hit_bonus_by_level`)
scaled at all; ordinary cantrips like Fire Bolt didn't. Fixed. Five spells (Ice Storm,
Flame Strike, Meteor Swarm, Ice Knife, Storm Sphere) had `damage_type` mismatched against
`damage_dice` — fixed, and `secondary_damage_dice`/`secondary_damage_type` added for
spells with a genuine second simultaneous component. Deliberately untouched: Spirit
Guardians/Fire Shield (caster picks one type), Prismatic Spray/Storm of Vengeance
(random-table/multi-round, different problem class).

### Generalized item stat buffs (AC, ability scores, saves) — three bugs fixed

`computeItemBonuses(items)` walks equipped(+attuned) items' `buffs` arrays. Two shapes:
ADD-mode (`ac_base`, `saving_throw_modifier`, `spell_attack_modifier`, `spell_dc_modifier`
— sum) and SET-mode on an ability (`{stat, mode:"set", value}` — RAW doesn't stack/lower,
so `effectiveAbilityScores()` takes the max of raw vs. any equipped set-buff, never
lowers). `CharacterHeader.js` AC box shows `baseAc + itemBonuses.ac_base` merged; typing a
new AC value back-solves the stored base by subtracting current item bonus.

This only works because **`buffs` previously never reached a real inventory item through
any add-path**: `ItemBrowserModal`'s DB-add copied every field except `buffs`;
`pdf_import.py`'s cross-reference omitted it too; `AddItemModal.js`'s edit-save `submit()`
silently dropped it on every Edit click. All three fixed. `AddItemModal.js`'s `submit()` is
a **whitelist rebuild, not a spread** — confirmed twice as a footgun class (also dropped
`charges.recharge_amount`, which made `rest_engine.py` fall back to a full recharge instead
of a partial one). **Any field this modal's form lacks an explicit input for silently
vanishes on Edit → Save** — treat as a standing hazard for any new item field anywhere.

### Weapons: attack/damage rolling, sourced from `equipment.json`

37 SRD weapons in `backend/data/equipment.json` were already structured but never
surfaced. `ItemBrowserModal.js` merges `/content/items` + `/content/equipment` (filtered to
Weapon) into one searchable list tagged `_kind`. `weaponItemBonus(weapon)` reads only that
weapon's own buffs (never pools character-wide, unlike AC/saves — a +1 sword must not leak
onto other weapons); `isItemActive(item)` factors out the shared equipped/attuned gate so
this and `computeItemBonuses` can't drift apart again. `weaponAbilityMod()` picks STR/DEX
(Finesse = better of the two; Ranged = DEX; Thrown-melee still uses STR since
`weapon_range` stays `"Melee"`). Rolling lives in `WeaponAttackModal.js` (attack + damage
as independent rolls, same roll/Reroll/Done pattern as spells).

**Extra Attack** is actually counted now (`turnUsed.Attacks`, `maxAttacksForCharacter()` —
detects "Extra Attack" by name, same convention as Sorcery Points/Divine Smite/Martial Arts
detection). `thisAttackCounted` flag in `WeaponAttackModal.js` prevents a last-attack roll
from instantly blocking that same swing's damage roll (a real bug once).

**Unarmed Strike** is always a virtual WEAPONS-section row (RAW always allows it).
`martialArtsDie(classNameRaw, totalLevel)` scales its die by **Monk class level
specifically** (1d4→1d10, multiclass-aware via `parseClassLevels`), not total character
level — the standing rule this established: **compute any per-character fix from
class/level data, never hardcode to the one character whose sheet exposed the bug.**
Items can grant Unarmed Strike bonus dice (`grants_unarmed_bonus` +
`unarmed_bonus_damage_dice/type`) or a heal-or-advantage choice on bonus damage
(`bonus_heal_or_advantage`, shared with real weapons' own bonus-damage fields).

**Fighting Styles** were never modeled anywhere until a real mismatch surfaced on Barry's
sheet (Dueling's +2 missing). `fightingStyleBonus()` detects by feature-name substring;
covers **Dueling** (+2 dmg one-handed melee, reuses the existing two-handed checkbox) and
**Archery** (+2 ranged attack) — the two whose bonus reduces to a flat always-on number.
Deliberately not modeled: GWF reroll, TWF off-hand (no dual-wield flow exists), Defense
(+1 AC, different code path), Protection, Blind Fighting, Superior Technique.

### Class resources that scale with level (Sorcery Points, Rage, Divine Smite, Metamagic)

`character_engine.py`'s "Dynamic use counts" block computes real max values (Rage,
Divine Sense, Lay on Hands, Bardic Inspiration, Ki, Action Surge, Indomitable, Sorcery
Points) instead of `content_packs.py`'s placeholder `max: 0`. Extracted into
`apply_dynamic_feature_maxes(features, class_name, level, ability_scores)` so **both**
leveling engines (single-class manual build AND the multiclass engine, below) call it the
same way on a freshly-built features dict before merging. `level` is always that one
class's own level, never total character level.

**On-demand fix for characters whose resources were already wrong:**
`POST /characters/<id>/recalculate_class_resources` re-syncs every current class at its
current level (works for single-class too) — never refills an already-spent resource,
never lowers a max below what's in use. The practical fix for a PDF-imported character
stuck with broken Rage/Action Surge/etc since import.

Sorcerer's feature is named `"Font of Magic (Sorcerer Points)"` in the engine, detected
**by substring** (`"font of magic"`) everywhere else so older/PDF-imported spellings still
match. `SorceryPointsModal.js`: Flexible Casting (SP↔slot conversion, RAW cost table,
capped at 5th-level slot) + a Metamagic checklist (8 PHB options + Seeking/Transmuted).
Applying a known Metamagic option is a cost-aware dropdown in `SpellDetailModal.js`'s cast
flow, deducting points and showing paraphrased effect text (app doesn't auto-apply the
mechanical effect itself — track the resource, player applies RAW). Not wired into
`doFreeCast()` (feat free-casts) — rare combo, scoped out.

Divine Smite has no separate charge — spends a real spell slot on a melee hit.
`WeaponAttackModal.js`: checkbox + slot-level dropdown appears if a `"Divine Smite"`
feature key exists; the slot is spent only on the *first* roll, not Reroll (a real bug
once spent a fresh slot on every reroll).

**Known remaining gap:** other classes' scaling resources (Battle Master dice, Monk Ki-
spend abilities beyond the point pool, Wild Shape uses) aren't in this list yet — same fix
pattern (add a branch to `apply_dynamic_feature_maxes`) whenever one surfaces for a real
character.

### Multiclass leveling engine and the structured Class editor

`tracker_data.classes` (`[{class_name, level, subclass}]`) is the multiclass-aware source
of truth, additive to (not replacing) the original single-class engine.
`backend/engine/multiclass_engine.py`: `infer_classes()` best-effort-parses a decorated
`class_name` (returns `None` on any unrecognized part rather than guessing wrong);
`compute_multiclass_hp()` for a fresh build; RAW multiclass spell-slot table (full casters
count whole levels, half casters half rounded down, **third-caster subclasses** like
Eldritch Knight/Arcane Trickster count 1/3 via `THIRD_CASTER_SUBCLASSES`, detected by
subclass name since base classes are `SPELLCASTER_TYPE: "none"`) plus a separate
`pact_slots` pool for Warlock levels (restored on short *or* long rest); per-class ASI
levels; auto-grants `class_features.json` entries with real AE rows for new levels/subclasses.

**Critical fix:** HP gain is computed *incrementally* (just the new level's amount added to
existing max) — **not** recomputed from scratch. An earlier version recomputed via
`compute_multiclass_hp()` on every level-up, which broke badly for any PDF-imported
character whose real HP doesn't match the generic average formula (could silently *shrink*
max HP when the recompute came out lower). Keep the incremental pattern if this is touched.

`POST /characters/<id>/level_up` branches: original single-class path (unchanged); a
multiclass path needing `tracker_data.classes` confirmed first
(`needs_class_confirmation`); then `needs_leveling_class_choice` if >1 class. New
`POST /classes/subclass` and `POST /asi` apply those as explicit separate actions. A
single-step undo stack (`tracker_data._level_up_snapshots`) supports multiple sequential
rollbacks (fixed from an earlier single-slot version that only ever undid the latest level).
`LevelUpFlowModal.js` drives the whole flow including a Rolled-HP option
(`tracker_data.hp.calc_mode`) that applies the roll-vs-average delta rather than
overwriting.

`CharacterEditorModal.js`'s Identity section has structured Class 1/Class 2 rows (each
with its own Level Up/Subclass/Preview), **saving immediately on every change** rather than
being part of the Cancel/Save-Changes draft below it — deliberate fix for a bug where
editing one row force-committed every row's draft state. `POST /characters/<id>/duplicate`
clones a character wholesale ("X (Copy)") so a player can experiment with a level-up risk-
free.

**Known limitations:** multiclass hit dice of different sizes share one `die_size` field
(count still correct, just not per-die-size on rest); homebrew classes default to a 3rd-
level subclass choice since their real level isn't in this app's data.

### Header status row, concentration, Haste, Companions

`tracker_data.active_effects`/`conditions`/`exhaustion` all surface in a header row between
the main stats and trait chips — `ConditionsModal.js`, an `EffectAdder` popover, and a
`PMStat` stepper for exhaustion (0-6, no mechanical enforcement, same philosophy as
conditions everywhere). Header is a **three-column flex layout with no `flex:1`/stretch
sizing** on any column (each hugs its content, right column gets `marginLeft:'auto'`) —
this specifically fixed a recurring "phantom gap" the owner kept circling in screenshots
across sessions: `flex:1` was stretching a column's *box* without its *content* filling
that space. **When a header screenshot shows unexplained empty space, check for a
`flex:1`/stretch container before assuming a positioning bug with new content.**

Concentration (ported from the Pi tracker): 1-2 slots (`concentrationSlotCount(items)`
decides how many are active), auto-filled the moment a concentration spell is actually cast
(`SpellDetailModal.js`'s `doCast()` → `tryTrackConcentration()`), never manually typed.
Each slot carries a `target: 'self'|'ally'` tag so Haste's end-of-effect cleanup (AC-2,
remove Hasted, apply Lethargic) only touches the caster's own state when Haste was self-
cast. `CharacterContext.js`'s `replaceConcentration()` is the **one** place a slot is ever
cleared/overwritten — consolidating what used to be two divergent cleanup paths
(`ConcentrationModal`'s Drop vs. `SpellDetailModal`'s "replace which slot?" prompt), fixing
a real bug where casting Polymorph to bump Haste out of a full slot skipped cleanup
entirely. Boots of Haste's `no_lethargy` flag threads through both functions so item-
granted Haste skips Lethargic on end while spell-cast Haste is unaffected.

**Companion tracking:** Settings → "Track a Companion" toggle adds a mini-sheet tab (HP/AC/
movement/ability scores, own ability list) plus an independent AE turn-bucket column.
A second slot (`companion2`, `active_companion`, pill toggle) exists for characters needing
two stat blocks (e.g. Blood Hunter normal form + Hybrid Transformation).

**Hybrid Form (Blood Hunter Lycan):** a 🐺 Transform/Revert toggle flips `'Hybrid Form'` in
`active_effects` — same active-effects-driven design as Haste. All level-scaled numbers
(`bloodHunterLevel`/`hybridFormStats` in `dnd.js`) compute live from class level, never
hardcoded — same standing rule as Martial Arts/Fighting Styles. Deliberately out of scope:
Crimson Rite tracking, auto-revert at 0 HP, non-RAW "full beast form."

### Stale-closure bug class in `CharacterContext.js` — now fixed structurally

Recurring bug pattern: a function builds its save payload by spreading `character.
tracker_data` from a stale closure snapshot, while an earlier step in the *same* call chain
(e.g. `useSlot()`) already changed `tracker_data` — the closure doesn't see it, so the
later save silently reverts the earlier change. Hit at least twice (Haste/concentration
cleanup; then again with Metamagic point deduction reverting a just-used spell slot).
Fixed **structurally**, not per-call-site: a `characterRef` (`useRef`, kept in sync
*synchronously* inside a wrapped `setCharacter`, not via `useEffect` — effects run after
React's next commit, too late mid-`await`) that `setConcentration`/`setConcentrationTarget`/
`replaceConcentration`/`spendFeatureCharges` all read from instead of the closure. This
should be the last instance of this bug class going forward.

**Ordering footgun, unrelated but adjacent:** context functions are sequential `useCallback`
consts in one function body; several depend on `saveTrackerData` (dependency array).
Defining a new helper *before* `saveTrackerData`'s own `const` line throws a TDZ
`ReferenceError` the instant the provider renders — and since this provider wraps the whole
app, that's a blank screen on every route. Always place new context functions *after*
`saveTrackerData`.

### Backgrounds (2024 + legacy 2014), choice feats, races

`Character.background` (migrated column) + `BackgroundSelectModal.js`. 2024-style
backgrounds (15 entries, `system: "2024"`) each grant an ability allocation (+2/+1 or
+1/+1/+1 across 3 eligible abilities), fixed skill proficiencies, and an Origin feat — the
feat grant reuses the same `buildFeatAttachPatch`/`resolveFeatChoice` pipeline as Browse
Feats/level-up ASI, committed in one `api.put` (not sequential saves — same stale-closure
risk class as above). 28 legacy 2014-style backgrounds (`system: "2014"`, transcribed from
an owner-provided doc — only 28 of ~70 had a reliable-enough field order to parse
confidently, the rest deliberately left out rather than risk wrong data) are reference-only:
no ability bonuses, no feat grant, player manually applies skills. Three names collide
across both systems (Acolyte, Charlatan, Entertainer) — keyed by `${name}__${system}`.

**Choice feats** (`choice_type` on a `feats.json` entry): `ability_save_increase`
(Resilient), `magic_initiate` (routes through the granted-known-spell mechanism above),
`skill_proficiencies` (Skilled, pick 3 — tools half of Skilled isn't tracked, this app has
no tool-proficiency list at all). `utils/featChoices.js`'s `resolveFeatChoice()` +
`buildFeatAttachPatch()` are **shared** across `TrackerTab.js`, `LevelUpFlowModal.js`, and
`BackgroundSelectModal.js` — extracted specifically to avoid a third copy drifting, after
the same logic had already independently existed twice.

Racial ability bonuses (`RACE_ABILITY_BONUSES` in `dnd.js`, all 29 races, best-effort from
training knowledge — not a licensed dataset) feed the same buff pipeline as feats/items.
Separately, `backend/data/races.json`/`background_data.py` hold a richer but much smaller
SRD dataset (9 races, 4 subraces, full trait text) surfaced read-only via `RaceInfoModal.js`
— the two race datasets are **not reconciled**; races.json's traits are flavor text, not
structured mechanical effects (no auto-granted Darkvision/resistances/etc).

### Class & subclass feature library (`class_features.json`)

~1,260 entries (every official class+subclass, every UA/Xanathar's/Tasha's variant, plus
three homebrew classes — Pugilist, Illrigger, Blood Hunter) added as a **searchable
reference library**, same pattern as feats/spells — browse-and-add via
`ClassFeatureBrowserModal.js`, nothing auto-granted at creation/level-up beyond what the
multiclass engine above already grants. Descriptions rewritten from scratch (never copied
verbatim from the source scrape, for copyright reasons).

### Feat modifiers (`buffs`), extended from items

`ModifiersEditor.js` (AC/saves/spell attack-DC/weapon attack-damage/ability Set-To or
Add-To/advantage-on-saves/resistance-immunity-vulnerability/condition-immunity) is shared
across `AddItemModal.js`, `CustomAbilityModal.js`, and `FeatureEditModal.js` so all three
edit the identical buff shape instead of drifting apart. `featBuffItems(features)`
synthesizes a feat-with-buffs into the same always-equipped-item shape
`computeItemBonuses`/etc already consume, so every existing consumer picks it up with zero
changes. **`featWeaponBonus(features)`** lets a feat grant a flat bonus to *all* weapon
attacks (character-wide, distinct from an item's own weapon-specific
`weaponItemBonus`) — wired into `WeaponAttackModal.js`.

**⚠️ Confirmed data-corruption bug, fixed structurally but not retroactively:**
`ModifiersEditor.js`'s rows used to be keyed by array index — a classic React key
anti-pattern that let a `<select>`'s DOM-level selection state get silently reused across
an add/remove/edit. This is what caused a real reported bug: editing a multi-modifier item
(Staff of the Magi) displayed correctly but *saved* Spell Attack twice and dropped AC,
doubling a live bonus. Fixed with a stable per-row id. **Any item/feat with 3+ modifier
rows edited before this fix should be reopened and re-saved to confirm correctness** — no
way to detect this from data alone (a duplicate entry looks like a legitimate two-source
stack). Still on the backlog to audit — see `todo.md`.

### Beast summoning (v1) and homebrew monster duplication

`tracker_data.active_creatures`: `MonsterDetailModal.js`'s optional `onSummon` prop (only
passed from `BestiaryTab.js`'s search view, not the "already tracking" re-open) creates
`{id, creature_name, instance_name, hp}`, second copy of same creature gets `#2` suffix.
Monsters joined the `CustomContent` pattern (duplicate canon → homebrew, or edit an
existing homebrew entry) the same way spells/feats/items did.
**Deliberately not built yet:** polymorph/wild-shape header takeover, `SpellDetailModal.js`
Self/Ally/Enemy targeting flow for Polymorph specifically — full agreed spec lives in the
`project-creature-tracking-spec` memory file (not in this repo), read before starting.

### Misc standing conventions

- No native `window.alert`/`window.confirm` anywhere — use `InfoModal.js`/`ConfirmModal.js`
  (`danger` prop reddens Confirm). Any new alert/confirm should use these.
- 401 handling: `JWT_ACCESS_TOKEN_EXPIRES` set to 30 days (was silently defaulting to 15
  minutes); `utils/api.js`'s axios interceptor shows an alert on any failed request and
  bounces to login on 401 specifically. **If "something didn't save" reports recur, suspect
  this layer before assuming a feature-specific bug** — it's what made correct Staff-of-
  the-Magi data look "broken" once, when the real issue was a timed-out request.
- `GameView.js` renders `CharacterHeader` + one of six tabs: Action Economy, **Feats/
  Attunement** (was "Tracker"), Spells, **Inventory** (was "Items"), Notes, Bestiary.
- Modal titles + close buttons are sticky (`.modal-sticky-header`) on all plain (non-flex)
  modals so long Edit Item/Character/Settings popups don't scroll the title away.
- Header trait chips (resistances/immunities/advantages/disadvantages/senses) sort by type
  instead of interleaving character- and item-granted traits in insertion order.

## Current known bugs / open threads

- **Cantrip damage scaling regression flagged, not yet re-diagnosed this session** — recheck
  `scaleSpellDamage()`/`SpellDetailModal.js` for cantrips specifically if this resurfaces;
  separate code path from `higher_level` slot upcasting (see cantrip scaling above, which
  *should* already be fixed — confirm against a live report before assuming it's the same bug).
- **`ClassFeatureBrowserModal.js` high-level preview cutoff** — re-audited, filter logic and
  data both look correct (Wizard 18/20 features aren't excluded). Best guess is a scroll-
  affordance issue, not a filter bug, but unconfirmed without a live repro (does the
  *unfiltered* view also stop early, or only a locked-subclass preview?).
- Standing sandbox limitation: **no Node/npm, no browser access** in this environment. Every
  frontend change in this project's history has shipped without in-sandbox visual
  verification — Render's real build is the only thing that catches a genuine compile
  error before the owner clicks through it live. Assume any recent frontend batch still
  needs a live click-through before calling it fully done.

## Backlog (future plans, not currently active — see `todo.md` for what's in flight)

**Content completeness / data quality:**
- `feats.json` still sparse (~37 entries) — most core PHB feats missing; add via the
  existing self-service +Custom/Admin-Edit/Duplicate UI as they come up, feat-by-feat
  judgment call (many don't reduce cleanly to the buffs schema).
- ~90 magic items mention AC in description prose without a structured `ac_base` buff —
  unaudited data-completeness gap from the original 5etools conversion.
- Weapon dice audit: go through all weapons and backfill standard attack dice the same way
  the Staff-weapon-type backfill worked this pattern out.
- `magic_items.json` has no in-repo regeneration script if the 5etools source ever updates;
  the `CustomContent` merge pattern is the answer for *additions* only.

**Character sheet / editor:**
- Spell-add eligibility: grey out (don't hide) Add for spells above what the character can
  actually learn/prepare.
- AE tab: `(Sorcery Points)` wrongly appended to stock-action names (Attack/Dash/etc) —
  display-name helper regression, needs its own fix separate from the Sorcerer rename.
- AE tab: consolidate 8 separate stock-action rows (Attack/Dash/Disengage/Dodge/Help/Hide/
  Ready/Search) into one compact picker.
- Death Saves on the character sheet itself (not just the campaign encounter flow): a
  roll popup near Exhaustion, with a Settings "Roll Blind" option (DM-only visibility when
  enabled) — should eventually bridge to the campaign encounter death-save flow.
- Friendly structured editors for `SpellEditModal`/`MonsterEditModal` beyond the current
  JSON-textarea fallback (monster stat blocks have far more sub-fields than a spell/feat).
- Item activation audit: confirm no buff/passive ever applies unless equipped (+attuned
  when required); attunement UI should require Equip before Attune is even offered.
- Polymorph: valid-form filtering by CR/level, auto-apply beast HP, 0-HP revert reminder,
  and campaign ally-targeting integration — needs the full creature-tracking spec first.
- `POST /rollback_level_up` — confirm the multi-level undo stack (`_level_up_snapshots`)
  is holding up in practice; falls back to the old single-slot key for pre-existing data.
- Racial/background data caveats: Half-Elf's player-chosen +1/+1 (on top of flat CHA+2)
  isn't modeled; Kobold uses the original STR−2/DEX+2 rather than the no-penalty variant.
- "Set X Score To" contamination: `suspectedAbilityContamination()` +
  `CharacterEditorModal.js`'s "Reset Base to 10" button is the intentionally-scoped fix;
  a real raw-vs-derived provenance model is possible later but not blocking.

**Process / infra:**
- Properly enable `eslint-plugin-react-hooks` (`exhaustive-deps: warn`) — owner-approved,
  but do it as its own dedicated pass watching a live Render deploy together, since turning
  it on may surface latent warnings the build treats as hard errors.
- No automated tests at all (standing, by design so far).
- A 5e content pipeline from Open5e's free API — stated next-big-thing once current fixes
  settle, still lower priority than whatever's actively broken.
- No password reset / no settings page beyond the gear-icon `SettingsModal.js`.

**Campaign/encounter** — see `CAMPAIGNS_INTEGRATION_NOTES.md` for the live, detailed
pending contract (this list is a high-level pointer only, not the source of truth):
- Campaign-wide homebrew rules (death saves/exhaustion) still don't auto-apply to attached
  characters — notes-only ledger today; must preserve personal overrides, not silently
  overwrite them.
- Authorized-editor permission model for DM sheet editing, richer active-encounter target
  resolution (item/object use, DM-side save input, advantage/cover modifiers), animate-dead
  workflow (paused, don't start unprompted), collapsible DM reference sections, DM-visible
  death-save alerts polish, Syric-specific backlog (Codex Sync tab placement, Codex Dice,
  bonus-action surge options).
- `frontend/src/utils/effectApply.js` (`applyNamedEffectToCharacterId`/
  `removeNamedEffectFromCharacterId`) is the character-sheet half of applying a targeted
  campaign effect (e.g. ally Haste) to one's own sheet — built, no backend changes needed
  (reuses existing ownership-gated character routes). Still needs the Effects-tab UI/button
  wiring on Codex's side. `KNOWN_MECHANICAL_EFFECTS` only lists `'Hasted'` — Bless/Bane etc
  show as plain chips, no auto-applied math, by design.
