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
