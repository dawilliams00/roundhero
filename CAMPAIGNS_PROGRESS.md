# Campaigns Progress Archive

Historical campaign/encounter progress archive. Do not use this as the active TODO list. Active campaign/encounter handoff lives in `CAMPAIGNS_INTEGRATION_NOTES.md`; immediate tasks live in `todo.md`.

This branch started with the first campaign slice isolated in new files so it would not collide with active character-sheet work. The `RoundHero-Campaigns` worktree now also has the bridge hooks applied locally so the slice can be reviewed end-to-end before merging back.

## Codex Commit Policy

The owner has explicitly instructed Codex to always commit completed, validated changes in this worktree from now on so Claude can deploy them. Do not leave finished Codex work only in the working tree. Pushes still require an explicit user request unless the owner changes that separately.

## New Files

- `backend/models/campaign.py`
- `backend/routes/campaigns.py`
- `frontend/src/context/CampaignContext.js`
- `frontend/src/pages/CampaignsPage.js`

## Existing-File Hooks Applied In This Worktree

These are the shared files to review carefully when merging with Claude's character-sheet work.

### Backend

`backend/models/__init__.py`

```python
from .campaign import Campaign, CampaignMember, CampaignCharacter, CampaignEffect, CampaignEncounter
```

`backend/app.py`

```python
from routes.campaigns import campaigns_bp
app.register_blueprint(campaigns_bp, url_prefix="/api/campaigns")
```

`db.create_all()` should create the new campaign tables automatically once the model is imported. No existing character columns are required for this first slice.

### Frontend

Wrap routes with the campaign provider and add the campaigns page route.

`frontend/src/App.js`

```jsx
import { CampaignProvider } from './context/CampaignContext';
import CampaignsPage from './pages/CampaignsPage';
```

```jsx
<CampaignProvider>
  <CharacterProvider>
    <AppRoutes />
  </CharacterProvider>
</CampaignProvider>
```

```jsx
<Route path="/campaigns" element={<PrivateRoute><CampaignsPage /></PrivateRoute>} />
```

Navigation/dashboard hook:

- `frontend/src/pages/CharacterSelect.js` now keeps Active Characters at the top and shows Campaigns below, with Create Campaign, Join Campaign, and Manage actions.

## Current Feature Slice

- Create campaign.
- Join by invite code.
- Campaign creator becomes owner and DM by default.
- DM/member roles with promote/demote controls for non-owner members.
- Attach owned characters to campaign roster.
- Mark one active/primary character per member.
- Remove own character, or DM can remove roster characters and non-owner members.
- Record party effects as pending/applied/removed, including source, target, duration, concentration, and notes.
- DM-owned encounter builder with planned/running/paused/complete status, party-member adds, bestiary monster pulls, shared-initiative enemy groups, HP/temp HP, AC, conditions, concentration labels, death saves, and clickable monster stat blocks.
- Campaign/encounter feedback button using the existing feedback email route and `FeedbackModal`.
- Campaign-wide rules are now stored on `Campaign.rules` as JSON text, with a lightweight additive migration in `backend/app.py`. The UI has a `Rules` tab for DM-edited death-save and exhaustion rule notes. These notes show in the DM encounter runner, player encounter view, and player death-save popup. Death-save pass/fail/roll state is preserved during encounter PC sync so the 15-second sync loop should not overwrite a player's roll result.

## Next Slice

Effects are intentionally a ledger first. The next step is connecting selected party effects to character sheets with explicit confirmation/permission.

### Campaign Rules Follow-Up

- Campaign-wide homebrew rules should eventually auto-apply to characters when they join or are attached to a campaign. At minimum, campaign death-save and exhaustion rules should be copied or linked into character settings so the character sheet, death-save popup, and exhaustion UI all agree with the DM's campaign rules. Be careful not to silently overwrite a player's existing personal homebrew settings without either preserving a local override or making the campaign source obvious.
- The rules system is currently notes-only. Future rules should become structured where useful: death-save visibility/default blind-roll mode, exhaustion table mode, recovery rules, and rule source labels. Keep the freeform notes field as an escape hatch.

### Claude's half is done: `frontend/src/utils/effectApply.js`

New shared utility, no backend changes needed (it reuses the existing ownership-gated
`GET`/`PUT /characters/<id>` routes - they already do a full `tracker_data` replace and
already check `user_id == character.user_id`, so there's no new auth surface to build).

```js
import { applyNamedEffectToCharacterId, removeNamedEffectFromCharacterId, KNOWN_MECHANICAL_EFFECTS } from '../utils/effectApply';

await applyNamedEffectToCharacterId(characterId, 'Hasted');   // adds to active_effects, no-op if already present
await removeNamedEffectFromCharacterId(characterId, 'Hasted'); // removes it; for Haste specifically also applies Lethargic
```

**Design: the target's owner applies it, not the DM/caster.** A spell like Haste cast on
an ally targets a DIFFERENT user's character - rather than build new cross-user backend
permissions, the intended flow is: the campaign Effects tab shows a player any pending/
applied effect *targeting a character they own*, with an "Apply to My Sheet" / "Remove
from My Sheet" button that calls these functions against their own character ID. Since
the caller already owns that character, the existing endpoints just work - the hand-off
from DM/caster to target IS the "explicit confirmation" already called for here.

`effectName` is a plain string added to/removed from `tracker_data.active_effects` -
the same array `CharacterContext.js`'s own `addActiveEffect`/Haste cast flow already
uses, so anything that already reacts to that array (AC+2, double speed, etc. in
`CharacterHeader.js`) picks it up automatically. `KNOWN_MECHANICAL_EFFECTS` currently
only lists `'Hasted'` - that's the one effect with real mechanical side-effects modeled
anywhere in this app today. Bless/Bane have no mechanical model anywhere (not even on a
caster's own sheet) - applying them via this utility just shows as a plain header chip,
same "track it, the player applies the rule" philosophy used for conditions/exhaustion
everywhere else in this app. Don't build Bless/Bane-specific roll math without that
being asked for separately.

**Polymorph is deliberately NOT covered by this utility.** It needs a whole creature/
temp-form state system (HP override using the new form's HP, reversion handling, etc.)
that doesn't exist yet - see the Polymorph TODO and the `project-creature-tracking-spec`
memory (not in this repo) for the agreed design before building that. Applying it as a
plain `active_effects` string would be misleading, not just incomplete.

What's left for the campaign side: the actual button/UI in `CampaignsPage.js`'s Effects
tab (or wherever a player views effects targeting their own characters), calling these
two functions, and updating the effect's ledger status (`pending` -> `applied` /
`removed`) via the existing `update_effect_status` route the same way it already does.

### Other open items

- Encounter builder is still v1. Next tracker improvements: round/turn advancement, active-turn highlighting, richer enemy grouping controls, bulk damage/healing, condition pickers, concentration break prompts, enemy death-state handling, and live updates/permissions for connected players.

## Claude Character-Sheet Data Contract For Campaign V1

Codex is building the campaign/encounter side on `feature/campaigns`. Claude can keep character-sheet work moving, but these fields/events need to exist or remain stable so campaign spell integration and encounter sync work.

Character sheets should expose a compact campaign snapshot whenever a character is attached to a campaign and whenever the sheet meaningfully changes:

- `hp`: `{ current, max, temp }`
- `ac`
- `conditions`: visible condition names
- `concentration_slots`: array of up to two slots, each like `{ spell, source, started_at, metadata }`
- `active_effects`: visible effects/buffs/debuffs currently applied to the character
- `prepared_spells`: spell names or objects with `{ name, level, casting_time, concentration, school }`
- `spell_slots`: current slot availability by level
- `action_economy`: current combat action state if initiative tracking is active, including action/bonus/reaction/movement/haste availability

Spell casting from a character sheet should optionally emit a campaign effect payload when a target is an ally or campaign combatant:

- `source_character_id`
- `target_character_id` or encounter combatant id
- `name`
- `effect_type`: spell, condition, item, feature, note
- `duration`
- `concentration`
- `status`: pending or applied
- `payload`: spell level, upcast level, save DC/attack info, notes, and any mechanical tags such as `grants_haste_action`, `polymorph_form`, `temp_hp`, or `roll_modifier`

For V1 spell integration, character sheets should support accepting/appling campaign effects and removing them without overwriting local character data. Haste should set concentration on caster and a visible target effect. Polymorph should preserve the original sheet state, apply beast temp HP/form metadata, and surface a drop-shape reminder when temp HP hits 0.

Player-facing campaign view should be reachable from the character sheet only when the user has campaign membership. If the character/user is in multiple campaigns, open a selector first. The player-facing view should show campaign/encounter enemy statuses that players are allowed to know: enemy names, visible conditions, concentration/effects, and public notes, but not enemy HP.

Do not make death saves public. Encounter death-save handling should become a private flow between the affected player and DM.

## Encounter/Campaign TODO Kept Intentionally Pending

- Add 15-second campaign/encounter refresh loop for DM-side live sync.
- **Live-test blocker:** encounter setup rows and the full encounter tracker rows still have overlapping fields/controls. The last attempted compact-grid fix did not solve it. Rebuild combatant rows as stacked panels or named CSS grid areas with explicit min heights for identity, HP/temp, AC, conditions, concentration, death saves, and stat/delete actions. Test both setup and runner screens with long monster names and condition text.
- Make PC status updates from character sheets reliably refresh encounter HP, temp HP, conditions, concentration, Haste, and active effects.
- Improve the full running encounter layout beyond the current modal/docked-panel V1.
- Death saves now have a player-sheet popup and DM encounter roll handoff, but still need deeper polish: secret DM-only death-save history, clearer reset/clear controls, active dying-state prompts, and campaign-rule-driven defaults for blind/open rolling.

## 2026-07-01 Campaign/Encounter Follow-Up Contract

Shipped in the current Codex pass:

- Encounter combatants now carry `hidden_from_players` and `dead` flags in encounter JSON.
- Player-facing encounter payloads filter hidden enemies server-side, so future enemies can sit in setup/runner without leaking to players.
- DM setup and runner can toggle enemy hidden/visible state.
- DM setup and runner can reset death saves, manually mark dead/alive, and failures reaching 3 mark the row dead.
- Dead rows are red/struck through; death-save danger rows are yellow.
- Player death-save popup rules are collapsed behind an arrow, and the popup has a reset path.
- Campaign party roster no longer shows `Set Primary`; campaign sheet editing should use an explicit authorized-editor model instead.

Still pending and should be treated as real feature work, not small UI cleanup:

- **Authorized editor model:** add campaign-scoped permission rows or payload fields so a DM can edit player sheets only from the Campaign Party tab. This should be based on logged-in email/user id and explicit campaign membership/DM authorization. Do not use `primary character` for this. Backend character update routes are currently owner-gated, so cross-user editing requires a deliberate campaign-authorized endpoint or a player-approved edit request flow.
- **Player sheet edit button:** once the backend permission model exists, add `[Player Sheet Edit]` next to campaign roster rows for DMs/authorized editors only. It should open the existing character editor surface against that player sheet and should not appear inside encounter setup or active encounters.
- **Duplicate/edit monster from encounter setup:** reuse the existing bestiary duplicate/edit modal flow from player monster edits. Encounter setup should allow reviewing a stat block, duplicating it, editing the duplicate, then adding that modified creature to the encounter.
- **Animate dead / similar effects:** dead encounter rows should expose an Animate option only if a visible combatant can plausibly animate/reanimate/summon from dead based on prepared spells/features/items. Clicking it should choose the animator, spell/feature/item, duration, and created creature/stat block. This needs a spell/feature scan and should not be hardcoded to only Animate Dead.
- **Active encounter attack/save resolution:** when a character attacks, casts, or uses an object during an active encounter, prompt for target combatant. For attack rolls, reveal only hit/miss to players while using hidden AC internally. For save spells, notify the DM to roll/input the save, then calculate pass/fail from caster DC. Damage application should respect resistance, immunity, vulnerability, and damage type before changing encounter HP. This is a rules engine, likely several versions.
- **DM death-save notification:** player death-save rolls currently update encounter rows and preserve last-roll notes. Add a DM-visible popup/toast when a new death save arrives, with blind/open visibility respected.
- **Campaign homebrew rules auto-apply:** campaign death-save and exhaustion rules should apply to attached characters or clearly override character settings while they are in that campaign. Preserve a player's personal override when leaving or switching campaigns.
- **Character AE movement:** normal Action Economy tab needs movement tracking while in initiative, matching the Syric AE movement affordance.
- **Syric-specific backlog:** move Codex Sync from Syric AE to Syric tab; add Codex Dice to Syric spell-cast flow like Smite with Syric rules; include bonus-action Codex Surge options in casting; allow editing Syric/Shadow abilities and feats through the normal editor path.
- **Reference expansion:** DM References should use collapsible sections for long content, matching the death-save rules collapse pattern.
- **Condition hints:** keep extending hover hints for nonstandard condition/effect names such as Lethargic, Hexed, Hasted, Blessed, Baned, etc.

## 2026-07-01 Later Codex Pass - Fresh Handoff

Shipped/implemented in this pass:

- **Campaign DM sheet edit V1:** backend route `GET/PUT /api/campaigns/<campaign_id>/characters/<campaign_character_id>/sheet` lets campaign DMs edit attached player character data from the Campaign Party tab only. The frontend has a `Player Sheet Edit` button on roster rows for campaign DMs. This is a structured V1 editor for identity plus advanced JSON fields; a full reuse of the normal character editor remains a later polish item.
- **Encounter typing fix:** setup and runner free-text fields now use local draft inputs and commit on blur/Enter. Do not return to save-on-every-keystroke for encounter name/init/ac/hp/temp/condition/concentration fields; it causes slow typing and dropped characters.
- **Encounter death states:** NPC/enemy rows now have Dead/Alive controls, player death-save rows can reset, dead rows are red/struck through, dying rows are yellow, and the initiative header chips mirror those yellow/red states.
- **DM death-save alert:** when a new player death-save roll arrives in the runner, show a DM popup with roll/pass/fail visibility. Initial encounter load seeds existing rolls so stale history does not spam the DM.
- **Monster duplicate/edit from setup V1:** encounter setup can open stat details, duplicate monsters, and edit custom monster duplicates using the existing bestiary duplicate/edit modals.
- **Normal character AE movement:** the regular Action Economy tab now tracks Movement while in initiative, matching the Syric AE expectation.
- **Syric updates:** Codex Sync belongs on Syric tab, not Syric AE. Syric spell-cast flow has Codex Dice options for d6/free and d10/bonus surge, and bonus-action surge marks the Bonus Action bucket used in initiative. Syric and Shadow module features can be sent into the normal Feature Editor.

Layout rule that must be preserved:

- Encounter setup/runner rows should keep Claude's separated-field method: separate labeled INIT, AC, HP, TEMP, conditions, concentration, and death-save controls with fixed/min widths. If the row layout is too tall or cramped, adjust grid/spacing/min heights; do not combine fields into overlapping compound boxes. This rule is also recorded in `CODEX_SETTINGS.json`.

Still intentionally pending:

- **Animate dead / use-dead-creature workflow:** dead encounter rows should expose an Animate option only when a combatant has a relevant spell/feature/item. The flow should choose animator, source ability, duration, and resulting stat block.
- **Active encounter target selection:** when a player attacks, casts, or uses an item in an active encounter, prompt for target combatant. Players should see hit/miss or public save outcome without revealing hidden HP/AC.
- **Automatic attack/save/damage math:** handle hit/miss, save DC prompts to DM, manual roll override, damage application, and resistance/immunity/vulnerability by damage type.
- **Collapsible DM references:** long DM reference material should use collapsed sections by default, like the death-save rules popup.
- **Campaign rules auto-apply:** campaign-wide death-save/exhaustion/homebrew rules should either auto-apply to attached character sheets or clearly override those sheets while in the campaign, without silently destroying personal overrides.
- **Better full character editor reuse for DM sheet edit:** current V1 works, but the long-term goal is to open the normal character editor surface with campaign-authorized permissions rather than a small JSON-heavy editor.

## 2026-07-01 No Visible JSON Editors Rule

The owner explicitly wants user-facing editors to be UI forms, not backend JSON surfaces. Keep flexible JSON/object storage internally, but do not expose raw JSON textareas or "Advanced JSON" buttons to players or DMs.

Updated in this pass:

- Campaign DM `Player Sheet Edit` is now a form for identity, HP/status, ability scores, saves, skills/expertise, conditions/effects, death-save settings, and DM notes. It preserves untouched spell/action data internally without showing JSON.
- Homebrew creature editing is now a stat-block form for core creature data, speed, ability scores, saves/skills, defenses, senses/languages, environments, traits/actions/reactions/legendary actions. It still saves to the same custom monster database used by Bestiary and encounters.
- Spell editing no longer exposes the previous Advanced JSON editor toggle.
- Encounter setup combatant rows were widened into explicit separated columns for identity, INIT/AC/HP/TEMP, conditions/concentration, and death saves/actions. Keep this separated-control pattern; do not compress those fields back into overlapping boxes.

## 2026-07-01 Targeting / Campaign Cleanup Pass

Shipped/implemented in this pass:

- Campaign roster `Remove` now truly detaches the character from the campaign instead of only marking it inactive. `Inactivate` remains the soft keep-on-roster option.
- Inactivating or removing a campaign character also removes that PC row from non-completed encounters, so active encounters do not keep stale inactive characters.
- Player-owned roster rows expose a clear `Leave Campaign` action in addition to the campaign header button.
- `Leave Campaign` on roster rows is character-specific: it detaches only that one owned character. The legacy account-level leave endpoint now refuses to run while that user still has campaign characters attached, so it cannot accidentally remove every character for the account.
- Encounter PC sync now treats sheet-sourced conditions, concentration, and active effects as the source of truth. Removed sheet effects such as ended Haste and cleared Lethargic no longer survive forever as stale encounter row effects; DM-added encounter effects remain intact.
- Campaign DM sheet edit now launches the full character sheet in campaign-edit mode instead of the small campaign form. Saves go through the campaign-authorized sheet endpoint.
- Campaign DM sheet edit has campaign-authorized rest support.
- Active encounter target resolution V1 exists for weapon attacks and damaging spells: player picks a visible encounter target, the backend resolves hit/miss or save/pending-save, applies damage, and adjusts for immunity/resistance/vulnerability by damage type.
- DM encounter runner shows a popup when a player queues/resolves an encounter action, including pending save prompts and damage adjustment details.

Still pending / next:

- Animate dead / use-dead-creature workflow is intentionally paused for now per owner direction. Do not start it until asked again.
- Target resolution is V1. It still needs richer item/use-object integration, better spell condition application, DM-side save input workflow from the pending event, advantage/disadvantage/cover/modifier handling, attack roll manual override polish, and direct syncing of resulting conditions/effects back to character sheets where appropriate.
- AE item charge button TODO: Syric AE item rows are missing the `[-]` button for charged items. Normal character AE item rows have the `[-]` button on the far left where `[USE]` or `[CAST]` should be. Item rows should follow the Syric bonus-action pattern: left `[USE]/[CAST]`, item name/details, bucket dropdown if relevant, and right-side `[-] current/max [+]`.
