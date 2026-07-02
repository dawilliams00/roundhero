# Campaigns Active Integration Notes

This file is for active campaign/encounter handoff only. Long-form history and shipped progress live in `CAMPAIGNS_PROGRESS.md`. Immediate task tracking lives in `todo.md`.

## Ownership

Codex owns campaign screens, encounter setup/tracker, campaign effects, DM rules/roster/invites/membership, player-facing campaign popups, and backend campaign/encounter routes.

Claude owns character-sheet systems: core sheet UI, normal AE tab internals, Syric/Syric AE, Spellbook, Inventory, Settings, item row layout, and sheet-side condition/effect mechanics unless a campaign API contract is explicitly needed.

## Claude → Codex heads-up (2026-07-02): shared `backend/routes/campaigns.py` change

Added a `target_defeated` boolean to the `resolve` event (in the damage-application loop):
True only when *this* hit drops a non-player target from alive to 0 HP. The player's client
uses it to show a "How do you want to do this?!" kill-narration popup **without** exposing
any HP numbers. Purely additive — doesn't change existing fields. The player kill popup then
posts the narration back with a lightweight `mode: "note"` resolve call (no damage
components), which surfaces as a `💀 Killing blow` event in `resolution_events`. If you want
that rendered specially in the DM runner (vs. the generic action toast), that's your call —
it works fine as a plain event today.

## Claude → Codex heads-up (2026-07-02): shared `backend/app.py` change

Owner reported recurring production data loss. Root cause is the DB config in `app.py`:
it silently fell back to `sqlite:///roundhero.db` (Render's **ephemeral** disk, wiped every
deploy) whenever `DATABASE_URL` was missing. Combined with `render.yaml`'s `plan: free`
Postgres (Render deletes free DBs after a fixed lifespan), this wiped all data — including
your campaign/encounter tables — on the next deploy.

**Changed in `create_app()` (shared file — flagging since you edit it too):** if
`DATABASE_URL` is unset AND `RENDER` env is present, the app now **raises on startup**
instead of silently using SQLite. Local dev (no `RENDER`) keeps the SQLite fallback. Don't
revert this to the silent-fallback form. The real fix is still an owner action: move the
Render Postgres off the free plan + confirm `DATABASE_URL` is linked.

Also added (Claude-owned `routes/content.py`, no campaign impact): `GET /api/content/export`
and `POST /api/content/import` — a homebrew-library JSON backup/restore (CustomContent only;
import is additive-upsert, never deletes). Wired to Download/Restore buttons in
`SettingsModal.js`. Campaign tables are not covered by this; they rely on the DB itself
persisting (i.e. the paid-Postgres fix above).

## Active Codex Work

- Add an `Add Effect` button in the active encounter tracker header beside `Exhaustion` and `Death Saves`.
- The header button should open the fuller campaign-style effect composer, not the stripped-down active encounter mini form.
- Prefer reusing/extracting the Campaign Effects form logic from `frontend/src/pages/CampaignsPage.js` so DM-created effects keep presets, targets, modifiers, notes, concentration, and pending/applied status.
- Keep the active encounter mini effect form out of the main runner layout once the full composer is available.

## Active Campaign/Encounter Backlog

- Target resolution V1 needs a more obvious character-sheet flow owned by Claude: if the character is in a running encounter, attack/cast/use should first ask who is being targeted. The target list should include every visible active combatant, ally and enemy. After target choice, roll attack/cast or queue/save, show hit/miss/save-needed, then roll/apply damage or effects.
- Spell save payloads should include `save_type` / `save_type_abbr` (`DEX`, `WIS`, etc.) when calling `/api/campaigns/<campaign_id>/encounters/<encounter_id>/resolve`. The DM runner can resolve pending saves manually without it, but digital save rolling needs it to choose the target's save modifier.
- AOE/save spells need per-target pending save resolution, not one generic popup. Each affected creature should have its own save-needed affordance on/near that combatant row, with manual save total and digital roll where possible, because Fireball and similar spells require multiple saves and can produce different pass/fail/damage results per creature.
- Campaign-side method for Claude: for each selected target of a save spell, call `POST /api/campaigns/<campaign_id>/encounters/<encounter_id>/resolve` with `mode: "save"`, that target's `target_id`, `save_dc`, `save_type` / `save_type_abbr`, `half_on_success`, and `damage_components`. Leave `save_roll` blank to queue a per-target DM resolver on that combatant row. Codex owns resolving it from the encounter tracker and sending `resolves_event_id` when the DM enters/rolls the save.
- Add item/use-object encounter targeting.
- Add DM-side save input workflow for queued save events.
- Apply spell conditions/effects through encounter targeting where appropriate.
- Continue damage math polish: advantage/disadvantage, cover/modifiers, manual attack override, save half/no-damage variants, and clearer DM/player feedback.
- Add 15-second DM encounter refresh/sync for live player HP, temp HP, conditions, concentration, Haste, active effects, and death-save state.
- Verify removed player-sheet effects/conditions continue clearing from active encounters instead of lingering as stale DM-side effects.
- Improve player-facing encounter view: show visible enemy conditions/concentration/effects, never enemy HP/AC.
- Keep death-save flow private between the player and DM; no public death-save reveal.
- Animate dead / use-dead-creature workflow remains paused until explicitly resumed by the owner.

## Layout Rules

- Encounter setup and runner rows must keep Claude's separated-field method: distinct labeled controls for INIT, AC, HP, TEMP, conditions, concentration, death saves, stat block, hidden/dead, and remove controls.
- Do not return to overlapping compound boxes. If rows are too tall, reduce spacing or use named grid areas with explicit min widths/heights.
- Do not save encounter free-text fields on every keystroke; use local draft values committed on blur/Enter to avoid dropped typing.

## No Visible JSON Editors

Users should not see raw JSON editors. Keep flexible JSON/object storage internally, but player/DM editors must be UI forms.

This applies to campaign DM sheet edits, creature edits, spell edits, effects, and encounter configuration.

## Campaign Character Membership Contract

- `Remove` detaches a campaign character and removes that PC from non-completed encounters.
- `Inactivate` is the soft roster toggle and should also remove that PC from non-completed encounters.
- Player `Leave Campaign` is character-specific from the roster row; only the owner of that character should see it for that row.
- The legacy account-level leave endpoint should not remove every character for the account while campaign characters are still attached.

## Character-Sheet API Contract Needed By Campaigns

Campaign snapshots should remain stable for attached characters:

- `hp`: current, max, temp
- `ac`
- visible `conditions`
- visible `active_effects`
- concentration slots/text
- prepared spells and spell slots
- action economy state when initiative tracking is active

Campaign spell/effect payloads should continue carrying:

- source character/combatant
- target character/combatant
- name/type/duration/concentration/status
- payload details for spell level, save DC/attack info, notes, and mechanical tags

## Docs Split

- `todo.md`: active/outstanding work only.
- `CAMPAIGNS_INTEGRATION_NOTES.md`: active campaign/encounter handoff and contracts only.
- `CAMPAIGNS_PROGRESS.md`: archived/shipped campaign progress and historical notes.
- `CLAUDE.md`: master project guidance and durable rules.
