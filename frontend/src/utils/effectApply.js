import api from './api';
import { HASTED_EFFECT, LETHARGIC_CONDITION } from './dnd';

// Generic bridge for applying/removing a named active_effect on ANY of the current
// user's own characters by ID - not just whichever character happens to be loaded in
// this browser tab's CharacterContext (CharacterContext's addActiveEffect/
// removeActiveEffect only ever operate on "the character this GameView session has
// open"). Built for the campaign Effects ledger: when a party member's spell (e.g.
// Haste cast on an ally) targets a DIFFERENT character, that character's owner is the
// one who applies/removes it from their own sheet - via the Campaigns page, not the
// caster's sheet - using these same conventions (active_effects array, Haste's
// Lethargic-on-drop cleanup) the character sheet's own cast flow already uses, so a
// chip added this way behaves identically (AC bonus, speed double, etc. are computed
// reactively off active_effects elsewhere - see CharacterHeader.js's hasteAcBonus - not
// stored, so simply adding/removing the string is enough for any already-modeled effect).
//
// The calling user must own the target character - this calls the same ownership-gated
// GET/PUT /characters/<id> endpoints every other character mutation already uses (see
// routes/characters.py's update_character), so there's no new backend permission surface
// to build or audit. The actual cross-user step is just "the DM/caster tells the target
// what to apply" via the campaign effects ledger UI - that hand-off IS the "explicit
// confirmation" the campaign integration notes call for, not a new auth model.
//
// Deliberately NOT handled here: Polymorph. Per CLAUDE.md's Polymorph TODO and the
// project-creature-tracking-spec memory, that needs a whole creature/temp-form state
// system this app doesn't have yet (HP override, form reversion, etc.) - applying it as
// a plain active_effects string would be actively misleading, not just incomplete.

export const KNOWN_MECHANICAL_EFFECTS = [HASTED_EFFECT];

// Fetches the target character fresh (don't trust a possibly-stale cached copy from
// somewhere else in the campaign UI) and adds the effect if it isn't already present -
// a no-op if it's already there, so this is safe to call more than once.
export const applyNamedEffectToCharacterId = async (characterId, effectName) => {
  const { data: character } = await api.get(`/characters/${characterId}`);
  const td = character.tracker_data || {};
  const effects = td.active_effects || [];
  if (effects.includes(effectName)) return character;
  const { data: updated } = await api.put(`/characters/${characterId}`, {
    tracker_data: { ...td, active_effects: [...effects, effectName] },
  });
  return updated;
};

// Removes the effect, and for Haste specifically also applies the Lethargic condition
// (RAW: lethargy hits whoever WAS hasted the instant it ends, regardless of who cast
// it) - the target's own sheet has no concentration slot for a spell someone else cast
// on them, so this is the one place that cleanup can happen for an ally-targeted Haste.
// no_lethargy mirrors the same exemption an item-granted Haste (e.g. Boots of Haste)
// already gets on the caster's own side in CharacterContext.js's replaceConcentration.
export const removeNamedEffectFromCharacterId = async (characterId, effectName, { noLethargy = false } = {}) => {
  const { data: character } = await api.get(`/characters/${characterId}`);
  const td = character.tracker_data || {};
  const effects = td.active_effects || [];
  if (!effects.includes(effectName)) return character;
  const conditions = td.conditions || [];
  const isHaste = effectName === HASTED_EFFECT;
  const patch = {
    active_effects: effects.filter(e => e !== effectName),
    ...(isHaste && !noLethargy && !conditions.includes(LETHARGIC_CONDITION)
      ? { conditions: [...conditions, LETHARGIC_CONDITION] }
      : {}),
  };
  const { data: updated } = await api.put(`/characters/${characterId}`, {
    tracker_data: { ...td, ...patch },
  });
  return updated;
};
