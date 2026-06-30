# Campaigns Integration Notes

This branch started with the first campaign slice isolated in new files so it would not collide with active character-sheet work. The `RoundHero-Campaigns` worktree now also has the bridge hooks applied locally so the slice can be reviewed end-to-end before merging back.

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

## Next Slice

Effects are intentionally a ledger first. The next step is connecting selected party effects to character sheets with explicit confirmation/permission:

- Haste: add active effect to target; track concentration on caster.
- Polymorph: apply a special target state without destroying original character data.
- Bless/Bane: add visible roll modifiers.
- Remove effect: clean up target sheet state.

Encounter builder is still v1. Next tracker improvements: round/turn advancement, active-turn highlighting, richer enemy grouping controls, bulk damage/healing, condition pickers, concentration break prompts, enemy death-state handling, and live updates/permissions for connected players.

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
- Make PC status updates from character sheets reliably refresh encounter HP, temp HP, conditions, concentration, Haste, and active effects.
- Improve the full running encounter layout beyond the current modal/docked-panel V1.
- Polish death saves into a secret player/DM workflow instead of simple visible counters.
