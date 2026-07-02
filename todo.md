# Active TODO

This file tracks only what's **actively being worked on right now**. `CLAUDE.md` is the
master log of previous, current, and future plans — fold a short summary in there at the
end of a session once something here ships and gets verified; don't duplicate long-form
detail into both files.

## In progress — Codex (encounter/campaign)

- **Add Effect button in the active encounter tracker.** Adding an "Add Effect" header
  button next to Exhaustion in the active encounter tracker that opens the fuller
  campaign-style Add Effect screen instead of the stripped-down active-encounter version.

Ownership reconfirmed 2026-07-01 (see `CLAUDE.md`'s Parallel Claude/Codex workflow
section): Codex owns campaign screens, encounter setup/tracker, campaign effects, DM
rules/roster/invites/membership, player-facing campaign popups, and the backend
campaign/encounter routes. Everything character-sheet-side (including AE tab internals
and item-charge row layout) is back to Claude.

## In progress — Claude (character sheet)

*(nothing currently in flight — pull the next item from the queue below when starting)*

## Next up (pull from here when starting new work)

1. **Audit items/feats edited via `ModifiersEditor.js` for the index-key corruption bug**
   (confirmed real — doubled Staff of the Magi's spell attack bonus). Start with any
   item/feat with 3+ modifier rows.
2. Action Economy label regression — `(Sorcery Points)` wrongly appended to stock actions
   (Attack/Dash/Disengage/etc).
3. Consolidate the 8 separate stock-action AE rows into one compact picker/dropdown.
4. Spell-add eligibility — grey out Add for spells above the character's accessible level
   instead of hiding them.
5. Syric AE item-charge `[-]` button placement (see `CAMPAIGNS_INTEGRATION_NOTES.md`).

## Waiting on the owner (manual, non-code steps)

- Render SPA rewrite rule for `roundhero-web` (still not added — refresh-404 on any
  non-root route).
- `FEEDBACK_SMTP_USER` / `FEEDBACK_SMTP_PASSWORD` Render env vars (Gmail App Password).
