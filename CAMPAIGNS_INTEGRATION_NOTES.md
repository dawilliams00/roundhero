# Campaigns Active Integration Notes

This file is for active campaign/encounter handoff only. Long-form history and shipped progress live in `CAMPAIGNS_PROGRESS.md`. Immediate task tracking lives in `todo.md`.

## Ownership

Codex owns campaign screens, encounter setup/tracker, campaign effects, DM rules/roster/invites/membership, player-facing campaign popups, and backend campaign/encounter routes.

Claude owns character-sheet systems: core sheet UI, normal AE tab internals, Syric/Syric AE, Spellbook, Inventory, Settings, item row layout, and sheet-side condition/effect mechanics unless a campaign API contract is explicitly needed.

## Active Codex Work

- Add an `Add Effect` button in the active encounter tracker header beside `Exhaustion` and `Death Saves`.
- The header button should open the fuller campaign-style effect composer, not the stripped-down active encounter mini form.
- Prefer reusing/extracting the Campaign Effects form logic from `frontend/src/pages/CampaignsPage.js` so DM-created effects keep presets, targets, modifiers, notes, concentration, and pending/applied status.
- Keep the active encounter mini effect form out of the main runner layout once the full composer is available.

## Active Campaign/Encounter Backlog

- Target resolution V1 needs a more obvious character-sheet flow owned by Claude: if the character is in a running encounter, attack/cast/use should first ask who is being targeted. The target list should include every visible active combatant, ally and enemy. After target choice, roll attack/cast or queue/save, show hit/miss/save-needed, then roll/apply damage or effects.
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
