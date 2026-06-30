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

Effects are intentionally a ledger first. The next step is connecting selected party effects to character sheets with explicit confirmation/permission.

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
