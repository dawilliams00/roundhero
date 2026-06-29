# Campaigns Integration Notes

This branch intentionally keeps the first campaign slice isolated in new files so it does not collide with active character-sheet work.

## New Files

- `backend/models/campaign.py`
- `backend/routes/campaigns.py`
- `frontend/src/context/CampaignContext.js`
- `frontend/src/pages/CampaignsPage.js`

## Existing-File Hooks Needed Later

### Backend

Register campaign models and routes after active backend work settles.

`backend/models/__init__.py`

```python
from .campaign import Campaign, CampaignMember, CampaignCharacter, CampaignEffect
```

`backend/app.py`

```python
from routes.campaigns import campaigns_bp
app.register_blueprint(campaigns_bp, url_prefix="/api/campaigns")
```

`db.create_all()` should create the new campaign tables automatically once the model is imported.

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

Optional navigation hook:

- Add a `Campaigns` button/link to `CharacterSelect.js` or the app header.

## Current Feature Slice

- Create campaign.
- Join by invite code.
- DM/member roles.
- Attach owned characters to campaign roster.
- Remove own character, or DM can remove any roster character.
- Record party effects as pending/applied/removed.

## Next Slice

Effects are intentionally a ledger first. The next step is connecting selected party effects to character sheets with explicit confirmation:

- Haste: add active effect to target; track concentration on caster.
- Polymorph: apply a special target state without destroying original character data.
- Bless/Bane: add visible roll modifiers.
- Remove effect: clean up target sheet state.
