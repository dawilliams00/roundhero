# Active TODO

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

This file tracks only what's **actively being worked on right now**. `CLAUDE.md` is the
master log of previous, current, and future plans — fold a short summary in there at the
end of a session once something here ships and gets verified; don't duplicate long-form
detail into both files.

**Permissions:** check `.claude/settings.json` (and `.claude/settings.local.json`) before
asking the owner to approve any tool call — this repo already allowlists `Bash(*)`,
`Edit(*)`, `Write(*)`, `Read(*)`, and `Bash(git push *)`, so covered actions should just
run. Run `git push` as its own Bash call (not chained after `cd`/`&&`) so it matches the
allow pattern instead of prompting. See the same note in `CLAUDE.md`'s Deploy section.

## In progress — Codex (encounter/campaign)

- **Add Effect button in the active encounter tracker.** Adding an "Add Effect" header
  button next to Exhaustion in the active encounter tracker that opens the fuller
  campaign-style Add Effect screen instead of the stripped-down active-encounter version.
- **Creature action economy in the DM runner.** Add encounter-row buckets for Action,
  Bonus Action, Reaction, Movement, Haste Action, plus a plan/UI for legendary action pools
  and lair actions (initiative 20 style) for boss creatures.
- **Triggered effect polish.** V1 is in the encounter runner for Booming Blade-style
  movement triggers; next pass should connect character-sheet casts to create those
  triggered target effects automatically and verify scaling.

Ownership reconfirmed 2026-07-01 (see `CLAUDE.md`'s Parallel Claude/Codex workflow
section): Codex owns campaign screens, encounter setup/tracker, campaign effects, DM
rules/roster/invites/membership, player-facing campaign popups, and the backend
campaign/encounter routes. Everything character-sheet-side (including AE tab internals
and item-charge row layout) is back to Claude.

## In progress — Claude (character sheet)

*(nothing currently in flight — pull the next item from the queue below when starting)*

**Just shipped, not yet live-verified — save-spell DM flow redesign + modal sizing.**
Supersedes the earlier "Restored the Ask DM / Resolve button" note further down (that
player-side two-step flow was the wrong model). New behavior:
- **Save spell cast at an encounter target now notifies the DM on CAST** (owner: "it needs
  to be there when I select cast"). `continueAfterCast` rolls the damage and queues the
  pending DM save in one step — the DM's `resolvePendingSave` (`EncounterRunnerModal.js`)
  requires the damage to ride along, so it can't be queued before the damage exists. The
  player-side save-roll input and post-damage "Ask DM"/"Resolve" button are gone; the modal
  just shows "📨 Sent to the DM to roll the {SAVE} save (DC N)". Payload now includes
  `save_type`/`save_type_abbr` so the DM runner can pick the target's save modifier.
- **Player never sees applied HP** — attack/damage spells show only "Hit!/Missed.",
  save spells show "Sent to the DM". No damage-applied numbers leak enemy state.
- **Reverted** an incomplete spell-attack-roll (Ray of Frost etc.) phase I'd started —
  it was half-wired and would've failed the build on unused vars. Pure spell-attack-roll
  support (attack box → hit/miss → damage) for non-weapon attack spells is still a TODO;
  weapon-attack cantrips (Booming Blade) already get it via the weapon modal.
- **Modal sizing:** `.modal-flex` max-height 85vh → 92vh. Weapon modal (opened by casting
  Booming Blade etc.) was too tall — the cantrip rules text is now collapsed behind a
  "Show spell text" toggle, Divine Smite's description is behind a compact "?" toggle
  (checkbox alone to use it), and panel spacing tightened.

**Earlier this session, not yet live-verified:** hide combat add-ons from utility spells + fix the
encounter target/manual-roll gating.
- `SpellDetailModal.js`: Codex Dice (Syric) now only shows when the spell deals damage
  (`spellDealsDamage`); Metamagic options are filtered to ones that apply to the spell
  (Empowered/Transmuted → damage spells, Heightened/Careful → save spells, Seeking →
  attack spells; the broadly-applicable ones always show). Upcast was already correctly
  hidden for spells with no `higher_level`. So Haste / Mirror Image / Polymorph no longer
  show upcast or Codex Dice.
- Encounter target picker in BOTH modals now only loads when the character is
  `in_initiative` (was loading whenever a running encounter existed). No initiative → no
  enemy targets, per owner: "if not in initiative, you shouldn't see an enemy to attack."
- Weapon modal "I'll roll in person" gate simplified to `td.in_initiative` and no longer
  disabled by the attack counter, so it can't vanish/grey-out mid-turn (the reported bug —
  owner was in initiative and lost the button; it was being disabled by `attacksExhausted`).
- Data fixes in `spells.json`: Mirror Image had a bogus `damage_dice: "1d20"` (from the
  description's "roll 1d20" image mechanic, not damage) → cleared; Haste had a spurious
  `save_type_abbr: "DEX"` (from "advantage on dexterity saving throws" text, Haste forces
  no save) → cleared. **Existing characters who already know these spells must click
  "Refresh Spell Data" on the Spells tab** to pull the corrected data — known_spells are a
  snapshot, so the fix doesn't reach an already-owned copy automatically.
- **Not fixed (out of scope, needs careful per-spell verification):** other buff/utility
  spells may share Haste's spurious-save parse artifact (Beacon of Hope, Holy Aura are
  candidates — they grant advantage on saves without forcing one). A blanket heuristic
  flagged mostly *legitimate* saves (Dominate, Hideous Laughter, etc.), so this needs a
  hand audit, not a bulk fix.

**Just shipped, not yet live-verified:** magic-item granted-spell **Cast Level** input in
`AddItemModal.js`. Each granted-spell row now has a Cast Lvl field next to Charge Cost, so
an item like Staff of the Magi can force a spell to cast at a fixed slot level (e.g.
Fireball at 7th) and have damage scale correctly when the player uses the item. Data
contract already existed end-to-end (`granted.cast_level` → `ItemSpellsModal.resolveSpell`
→ `base_level_int` preserved for scaling; DB-add and display paths already handled it) —
only the editor input was missing. Blank = casts at the spell's base level; enforced
`>=` base level (no downcasting) in `buildOutput`.

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
`/api/campaigns/<campaign_id>/encounters/<encounter_id>/resolve` route. Follow-up needed:
spell save payloads should include `save_type` / `save_type_abbr` (`DEX`, `WIS`, etc.)
so the DM runner's digital save roller can choose the target's save modifier. Manual DM
save total input works without that field.
Campaign-side follow-up: AOE/save spells need per-target pending save resolution on the
individual combatant rows, not one generic DM popup. Each affected creature should get
its own manual/digital save resolver because AOE spells can require multiple saves with
different results.
Implementation contract for Claude: queue one pending save event per selected target by
calling `/api/campaigns/<campaign_id>/encounters/<encounter_id>/resolve` with
`mode: "save"`, `target_id`, `save_dc`, `save_type`/`save_type_abbr`, `half_on_success`,
and `damage_components`, leaving `save_roll` blank. Codex will render/resolve those
events on the matching combatant row and posts `resolves_event_id` when complete.
`/campaigns/<id>/encounters/<id>/resolve` contract, just called at two points (attack-only,
then attack+damage) instead of once at the end. **Next session should click through this
on the live app**: roll a weapon attack against an encounter target end-to-end, try "I'll
roll in person" against a target, and cast a damaging spell against a target, since there
was no browser access to verify in this sandbox.

Two follow-up fixes after the first pass (same not-yet-live-verified caveat):
- Restored the save-spell **Ask DM / Resolve** button in `SpellDetailModal.js` (the first
  pass had collapsed it into the auto-fire status line, which broke the deliberate two-step
  DM save flow). Save spells now do NOT auto-resolve on damage roll — they show an explicit
  Ask DM (blank save → queue DM) / Resolve (save entered → finalize) button, and the
  save-roll input stays editable until finalized so the real roll can be entered once the
  DM has it. Plain damage/attack spells still auto-apply on roll.
- Restored/extended the **"I'll roll in person"** manual option. In `WeaponAttackModal.js`
  it was gated only on `td.in_initiative`, which hid it in a campaign encounter (personal
  in_initiative often isn't set there) — now shows when `in_initiative || selectedTarget`.
  Added an equivalent "I'll roll in person - enter damage" path to `SpellDetailModal.js`'s
  pending-damage screen (spells had no manual-damage entry before), feeding the same
  resolution/Ask-DM path as a digital roll.

The encounter-target list looking stale/pulling from old encounters (flagged in the same
report) was NOT investigated — the user said to stand by on that one, it may be user
error rather than a real bug.

## Shipped 2026-07-02 (not yet live-verified — no browser in sandbox)

- Kill prompt: "How do you want to do this?!" popup (`KillPromptModal.js`) when a weapon
  attack / non-save damage spell defeats an encounter target. Backend `resolve` returns
  `target_defeated` (no HP exposed); narration posts back as a `💀 Killing blow` note.
- Spell picker auto-closes after a weapon-attack cantrip's attack completes (was leaving
  the player on the spell list).
- Metamagic selection moved into the character editor (Font-of-Magic chars only); sheet's
  Sorcery Points popup Metamagic tab is now read-only reference.
- AE `(Sorcery Points)` label regression fixed (undefined===undefined tracker_key match).
- Weapon-modal applied-damage number hidden from the player (only Hit!/Missed.).

## Next up (pull from here when starting new work)

1. **`ModifiersEditor.js` corruption re-save** — the CODE fix is already in (stable
   per-row id). What's left is an OWNER-manual pass: reopen + re-save any item/feat with
   3+ modifier rows in the live UI to confirm/correct old data. Not codeable from here.
2. Consolidate the 8 separate stock-action AE rows into one compact picker/dropdown.
3. Spell-add eligibility — grey out Add for spells above the character's accessible level
   instead of hiding them.
4. Syric AE item-charge `[-]` button placement (see `CAMPAIGNS_INTEGRATION_NOTES.md`).
5. Death Saves on the character sheet itself (roll popup near Exhaustion + "Roll Blind").
6. Item activation audit — no buff/passive applies unless equipped (+attuned); require
   Equip before Attune is offered.
6. **Concentration/ongoing spells that grant a recurring bonus-action (or action) use
   should surface in the Action Economy tab while active.** Example: Animate Objects —
   once cast and active, commanding the objects each round is a bonus action, so it should
   show as a bonus-action row in the AE tab. This is a general pattern, NOT one-off:
   Spiritual Weapon (BA to move+attack), Flaming Sphere (BA to move), Bigby's Hand,
   Call Lightning, Moonbeam (move the beam), etc. all grant a repeatable BA/action while
   the spell is active. Design a data-driven way to flag a known/cast spell with an
   "ongoing action economy" cost (e.g. `ongoing_cost_type: bonus_action`) so that while
   it's in `active_effects`/concentration, a corresponding AE row appears. Compute from
   spell data, don't hardcode per spell (same standing rule as class-feature scaling).
7. **AOE multi-target selection in the encounter resolve flow.** Save/AOE spells (Fireball,
   etc.) hit every creature in the zone, but the encounter target picker only selects ONE
   combatant. Need multi-select (checkboxes or multi-pick) so the caster can mark all
   creatures in the area, and each gets its own pending DM save (the DM rolls per creature
   — AOE saves can pass/fail differently per target). Backend `resolve` currently takes a
   single `target_id`; this needs either repeated calls per target or a multi-target
   payload, plus a DM-runner UI that resolves each affected combatant's save individually
   (already flagged campaign-side in `CAMPAIGNS_INTEGRATION_NOTES.md` — coordinate with
   Codex on the backend/runner half).

## Waiting on the owner (manual, non-code steps)

- **⚠️ DATA LOSS — move `roundhero-db` off the FREE Postgres plan (`render.yaml:16`).**
  Render deletes free Postgres after a fixed lifespan → recurring wipe of ALL data (custom
  content, characters, campaigns). This is the real fix for the reported data loss. Also
  confirm `DATABASE_URL` is linked on `roundhero-api` and enable automatic backups. Code
  now fails loud (won't boot) instead of silently using ephemeral SQLite, and Settings has
  a Download/Restore homebrew-library backup — but those are safety nets, not the fix.
- Render SPA rewrite rule for `roundhero-web` (still not added — refresh-404 on any
  non-root route).
- `FEEDBACK_SMTP_USER` / `FEEDBACK_SMTP_PASSWORD` Render env vars (Gmail App Password).
