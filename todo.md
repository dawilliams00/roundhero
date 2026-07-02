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

**Just shipped, not yet live-verified:** target-first encounter attack/cast flow in
`WeaponAttackModal.js` and `SpellDetailModal.js`. Target picker now shows up top before
any roll (was previously only offered after damage was already rolled) and locks once a
roll goes out; attack roll now resolves hit/miss against the target immediately, damage
auto-applies the moment it's rolled/entered instead of needing a separate manual
"Resolve" click, and Reroll is disabled once a target resolution has already succeeded
(prevents double-applying damage). Also fixed: "I'll roll in person" in
`WeaponAttackModal.js` previously left the modal open with no way to close when the
weapon had no heal-or-advantage rider — now closes properly, and when a target is
selected it prompts for manual attack total then manual damage total instead of skipping
encounter resolution entirely. No backend changes — reuses the existing
`/campaigns/<id>/encounters/<id>/resolve` contract, just called at two points (attack-only,
then attack+damage) instead of once at the end. **Next session should click through this
on the live app**: roll a weapon attack against an encounter target end-to-end, try "I'll
roll in person" against a target, and cast a damaging spell against a target, since there
was no browser access to verify in this sandbox.

The encounter-target list looking stale/pulling from old encounters (flagged in the same
report) was NOT investigated — the user said to stand by on that one, it may be user
error rather than a real bug.

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
