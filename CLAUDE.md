# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RoundHero is a D&D 5e character tracker web app: Flask/SQLAlchemy backend, React frontend, Postgres on Render in production (SQLite locally). Single user currently (the owner, testing with their own character "Syric Nightbloom," a Wizard imported from a D&D Beyond PDF). No test suite exists yet — there is no CI, no test runner setup beyond the default `react-scripts test` stub, and no backend test framework. Verification during development has been done via ad hoc Python scripts (`python -m py_compile ...` for syntax, one-off scripts that call the engine functions directly and print results) rather than a real test suite.

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

**Deploy:** Push to `main` — Render auto-deploys both services from GitHub.
- Backend: Web Service, `pip install -r requirements.txt`, start command `gunicorn "app:create_app()" --bind 0.0.0.0:$PORT` (quotes matter — `create_app()` has parens, which a shell will otherwise interpret).
- Frontend: Static Site, `npm run build`, publish `build/`, env var `REACT_APP_API_URL` pointing at the backend's Render URL.
- Backend and Postgres database must be in the **same Render region** or the backend can't resolve the DB host.
- Python runtime is pinned via `backend/runtime.txt` (`python-3.12.7`) — Render's newer default Python broke `psycopg2-binary`'s wheel compatibility once already.

## Architecture

### Two parallel character-build paths feed one shared shape

Every character ends up with the same three JSON blobs — `tracker_data`, `spell_data`, `ae_data` — but they're produced by two completely different code paths that must be kept in sync:

- **Manual creation** (`engine/character_engine.py`): builds from `engine/content_packs.py`, a hand-authored dict of all 12 classes (hit die, saves, per-level features, spell slot progression). `build_tracker_data()` / `build_spell_data()` / `build_ae_data()`.
- **PDF import** (`engine/pdf_import.py`): `parse_character_pdf()` reads a D&D Beyond character sheet PDF. Critically, the visible D&D Beyond PDF is mostly a printed background — **the actual character data lives in PDF form-field widgets** (read via PyMuPDF/`fitz`, not the text layer; `pdfplumber`/text extraction will only return field labels). Field names follow D&D Beyond's fixed layout (`CLASS  LEVEL` — two spaces, `Wpn Name`/`Wpn Name {N}` inconsistently numbered, `spellName{N}`/`spellHeader{level}` for the spell table, etc.) — see the regexes in `pdf_import.py` for the exact contract. This path produces `build_ae_data_from_features()` instead of `build_ae_data()`.

Both paths must assign **`cost_type`** on every `ae_data` entry to one of `action` / `bonus_action` / `reaction` / `cast_spell` / `free_action` / `passive` — this is what the frontend's turn-economy bucket-tracking keys off (`ActionEconomyTab.js`'s `bucketFor()`). A feature can display correctly under the right section header while still being inert for bucket-tracking if `cost_type` doesn't match — this exact bug existed for months because both builders hardcoded `cost_type: "feature"` regardless of section.

### Re-sync: PDF-imported characters can absorb engine improvements without losing live state

`Character.source_pdf` stores the raw uploaded PDF bytes. `POST /api/characters/<id>/resync` re-runs `parse_character_pdf()` on those stored bytes and merges the result into the existing character via `resync_character()` in `pdf_import.py`. The merge logic distinguishes parser-owned data from player-added data using a `"_source": "pdf"` tag on features/spells/items: anything tagged `pdf` is replaced by the fresh parse (so parser bug fixes propagate), anything untagged (added later through the UI — custom abilities, custom spells, custom items) is preserved untouched. Live/mutable state (HP, feature/slot/charge `current` counts, manual AC/initiative overrides) is also preserved across a resync, clamped to the new `max` values. When changing `pdf_import.py`'s parsing logic, the fix only reaches already-imported characters when the user clicks "Re-sync from PDF" — it does not retroactively touch stored `ae_data`/`tracker_data` on its own.

### `tracker_data` is a single free-form JSON blob, not normalized columns

`models/character.py` stores `tracker_data`, `spell_data`, `ae_data`, `notes`, `ability_scores` each as a `Text` column holding JSON (property getters/setters handle the (de)serialization). This means **adding a new field to the character's runtime state never requires a migration** — components just read/write nested keys via `saveTrackerData()`. The known shape of `tracker_data` (no schema enforces this, components rely on convention):
```
features: { [name]: {current, max, rest_type, action, description, _source?} }
spell_slots: { [level]: {current, max} }
item_charges: {}            # legacy, mostly superseded by inventory.items[].charges
conditions: [string]
hp: {current, max, temp, max_override}
hit_dice: {current, total, die_size}
ac, initiative, inspiration, in_initiative: scalars
traits: {resistances, immunities, vulnerabilities, advantages: [string]}
active_effects: [string]    # e.g. "Hasted" — TrackerTab.js lets the player add/remove any name freely
inventory: {currency: {cp,sp,ep,gp,pp}, items: [{name, quantity, weight, rarity, equipped, attunement, attuned, charges?, granted_spells?, _source?}]}
save_proficiencies, skill_proficiencies: [string]
```
`Character.source_pdf` is the one real column that *did* require a migration. Since `db.create_all()` only creates missing tables and never alters existing ones, `app.py` has a `PENDING_COLUMNS` list + `_apply_pending_migrations()` that runs additive `ALTER TABLE ... ADD COLUMN` statements on every startup (Postgres `IF NOT EXISTS`, SQLite best-effort). Any future new *column* (not a `tracker_data` key) must be added to that list or it will silently not exist in the deployed Postgres DB.

### Flat JSON reference databases, loaded once at import time

`backend/data/spells.json` (412 spells) and `backend/data/magic_items.json` (1,267 items) are loaded module-level by `engine/spell_data.py` / `engine/item_data.py` and served read-only via `/api/content/spells` and `/api/content/items`. `magic_items.json` was generated by converting 5etools' open data export (not part of this repo — it lived outside the project when generated) plus the user's own homebrew items appended on top; there is no in-repo script that regenerates it. The PDF importer cross-references both DBs by name to enrich/correct what it parses from the PDF — e.g. an inventory item matching a DB entry has its `charges`/`granted_spells`/`description` overwritten by the DB's (more reliable) values rather than trusting the PDF's printed weapon-table notes.

### Frontend: one context, and a sharp footgun in it

`context/CharacterContext.js` is the single source of truth — every tab/modal reads character state and mutates it through functions exposed here (`saveTrackerData`, `useSlot`, `useItemCharge`, `addActiveEffect`, etc.), each a thin wrapper that PUTs/POSTs and updates local state from the response. **Ordering matters**: these are all `useCallback`s defined as sequential `const`s in one function body, and several depend on `saveTrackerData` (it's in their dependency array). Defining a new helper *before* `saveTrackerData`'s own `const` line throws `ReferenceError` (temporal dead zone) the instant the provider renders — and since this provider wraps the entire app, that crash is a blank screen on *every* route, not just wherever the new function is used. This has happened more than once; when adding a new context function that calls `saveTrackerData`, place its declaration after `saveTrackerData`'s.

`GameView.js` renders `CharacterHeader` (always visible: HP/AC/init/prof/inspiration/traits/spell-slot pips) plus one of five tabs (`ActionEconomyTab`, `TrackerTab`, `SpellsTab`, `InventoryTab`, `NotesTab`), each independently reading/writing `tracker_data` through the context.

## Current status (for picking up a new session)

**Live:** `dawilliams00/roundhero` on GitHub, auto-deploying to Render — backend as `roundhero-api` (Web Service), frontend as `roundhero-web` (Static Site), Postgres add-on in the same region as the backend (must match, or the backend can't reach the DB). Domain `roundhero.app` is registered (Namecheap) but **DNS has not yet been pointed at Render** — the live site is currently only reachable at the `*.onrender.com` URLs.

**Who's using it:** Just the owner so far, testing with one real character ("Syric Nightbloom," a Wizard) imported from a D&D Beyond PDF export. Most recent feature work was driven directly by bugs the owner found testing that one character against their old Raspberry-Pi/Tkinter tracker app (a much more feature-complete prior project, source at a path under `Desktop\Wearables\` outside this repo) — a lot of "port this from the Pi version" requests are still possible in future sessions.

**Recently fixed (needs verification it stuck):** Action Economy bucket-tracking (`cost_type` bug, see Architecture above) — fixed in the engine, but existing imported characters need a Re-sync from PDF to pick it up. Staff of the Magi recharge mechanic (was fully resetting on rest instead of rolling its actual recovery dice). Item-granted spell level display (was showing a spell's base level instead of the level the item casts it at).

**Known gaps / likely next asks:**
- No automated tests at all.
- Multiclass characters are display-only on the manual-creation path — `content_packs.py`'s `CLASSES` dict and `character_engine.py` assume single-class; PDF import handles multiclass better since it trusts the PDF's own numbers rather than recomputing.
- No DM-facing tools (the 5etools items DB and any future bestiary import would mostly serve a DM view that doesn't exist yet).
- No password reset, no settings/profile page.
- `magic_items.json`'s conversion from 5etools data was a one-time manual process — there's no script in this repo to refresh it if the source data changes.
