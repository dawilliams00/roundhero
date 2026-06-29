import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import api from '../utils/api';
import { HASTED_EFFECT, LETHARGIC_CONDITION } from '../utils/dnd';

const CharacterContext = createContext(null);

// Attacks is a count, not a boolean - Extra Attack means the Action bucket itself isn't
// "used" until all granted attacks for the turn are spent, so the AE tab can show
// "Attack 1/2" progress instead of dimming after the first swing.
const EMPTY_TURN = { Action: false, 'Bonus Action': false, Reaction: false, Haste: false, Attacks: 0 };
// Companion's own bucket state, tracked separately from the main character's turnUsed -
// the two columns in the split AE tab act independently (Shadow using its Reaction
// doesn't touch Syric's), but New Turn/a rest resets both at once.
const EMPTY_COMPANION_TURN = { Action: false, 'Bonus Action': false, Reaction: false };

export function CharacterProvider({ children }) {
  const [character, setCharacterState] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [turnUsed, setTurnUsed]     = useState(EMPTY_TURN);
  const [companionTurnUsed, setCompanionTurnUsed] = useState(EMPTY_COMPANION_TURN);

  // characterRef always holds the LATEST character, updated synchronously in the same
  // tick as setCharacterState (not via a useEffect, which only runs after React commits
  // and re-renders - too late for what this is for). A function like doCast in
  // SpellDetailModal awaits multiple context calls in sequence (useSlot, then
  // tryTrackConcentration's setConcentration); each of those calls is a closure bound to
  // whatever `character` existed when SpellDetailModal last rendered BEFORE the click -
  // re-renders triggered by the EARLIER awaited call's state update don't retroactively
  // change what the ALREADY-RUNNING doCast closure references. Without this ref, a
  // function that spreads `character.tracker_data` to build its save payload would spread
  // a stale pre-click snapshot, silently reverting whatever the earlier call (e.g. a
  // spell slot decrement) had just persisted. setConcentration/replaceConcentration/
  // setConcentrationTarget and spendSorceryPoints read from the ref instead specifically
  // because they're the ones actually called in that kind of sequence.
  const characterRef = useRef(null);
  const setCharacter = useCallback((updater) => {
    setCharacterState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      characterRef.current = next;
      return next;
    });
  }, []);

  const resetTurn = useCallback(() => { setTurnUsed(EMPTY_TURN); setCompanionTurnUsed(EMPTY_COMPANION_TURN); }, []);

  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/characters/');
      setCharacters(r.data);
    } finally { setLoading(false); }
  }, []);

  const loadCharacter = useCallback(async (id) => {
    setLoading(true);
    try {
      const r = await api.get(`/characters/${id}`);
      setCharacter(r.data);
      return r.data;
    } finally { setLoading(false); }
  }, []);

  const updateCharacter = useCallback(async (id, updates) => {
    const r = await api.put(`/characters/${id}`, updates);
    setCharacter(r.data);
    return r.data;
  }, []);

  const useFeature = useCallback(async (featureName) => {
    if (!character) return;
    const r = await api.post(`/tracker/${character.id}/feature/${encodeURIComponent(featureName)}/use`);
    setCharacter(prev => ({
      ...prev,
      tracker_data: {
        ...prev.tracker_data,
        features: {
          ...prev.tracker_data.features,
          [featureName]: {
            ...prev.tracker_data.features[featureName],
            current: r.data.current,
          }
        }
      }
    }));
    return r.data;
  }, [character]);

  const useSlot = useCallback(async (level) => {
    if (!character) return;
    const r = await api.post(`/tracker/${character.id}/slot/${level}/use`);
    setCharacter(prev => ({
      ...prev,
      tracker_data: {
        ...prev.tracker_data,
        spell_slots: {
          ...prev.tracker_data.spell_slots,
          [level]: { ...prev.tracker_data.spell_slots[level], current: r.data.current }
        }
      }
    }));
    return r.data;
  }, [character]);

  const doRest = useCallback(async (restType) => {
    if (!character) return;
    const r = await api.post(`/characters/${character.id}/rest`, { type: restType });
    setCharacter(prev => ({ ...prev, tracker_data: r.data.tracker_data }));
    resetTurn();
    return r.data;
  }, [character, resetTurn]);

  const saveTrackerData = useCallback(async (trackerData) => {
    if (!character) return;
    const r = await api.put(`/tracker/${character.id}`, trackerData);
    setCharacter(prev => ({ ...prev, tracker_data: r.data }));
  }, [character]);

  const restoreSlot = useCallback(async (level) => {
    if (!character) return;
    const slots = character.tracker_data.spell_slots;
    const slot = slots[String(level)];
    if (!slot) return;
    const newCurrent = Math.min(slot.max, (slot.current||0) + 1);
    await saveTrackerData({ ...character.tracker_data, spell_slots: { ...slots, [level]: { ...slot, current: newCurrent } } });
  }, [character, saveTrackerData]);

  const useItemCharge = useCallback(async (itemIndex, delta) => {
    if (!character) return;
    const items = character.tracker_data.inventory.items;
    const item = items[itemIndex];
    if (!item.charges) return;
    const cur = Math.max(0, Math.min(item.charges.max, (item.charges.current||0) + delta));
    const newItems = items.map((it,i) => i===itemIndex ? { ...it, charges: { ...it.charges, current: cur } } : it);
    await saveTrackerData({ ...character.tracker_data, inventory: { ...character.tracker_data.inventory, items: newItems } });
  }, [character, saveTrackerData]);

  const saveSpellData = useCallback(async (spellData) => {
    if (!character) return;
    const r = await api.put(`/spells/${character.id}`, spellData);
    setCharacter(prev => ({ ...prev, spell_data: r.data }));
  }, [character]);

  const importCharacter = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const r = await api.post('/characters/import', formData, { headers: { 'Content-Type': undefined } });
    return r.data;
  }, []);

  const resyncCharacter = useCallback(async () => {
    if (!character) return;
    const r = await api.post(`/characters/${character.id}/resync`);
    setCharacter(r.data);
    return r.data;
  }, [character]);

  const deleteCharacter = useCallback(async (id) => {
    await api.delete(`/characters/${id}`);
    setCharacters(prev => prev.filter(c => c.id !== id));
  }, []);

  // Lets a player freely experiment with leveling/setup choices on a copy without any
  // risk to the original - explicit ask, since players like to try out a level-up or
  // build change and back out if they don't like it. Clones everything including
  // source_pdf, so Re-sync still works on the duplicate too.
  const duplicateCharacter = useCallback(async (id) => {
    const r = await api.post(`/characters/${id}/duplicate`);
    await fetchCharacters();
    return r.data;
  }, [fetchCharacters]);

  // Undoes the most recent level-up (and any subclass/ASI choices made right after it) -
  // players like to preview a level-up and back out if they don't like it. Single-step
  // only; tracker_data._level_up_snapshot's presence is what gates showing this in the UI.
  const rollbackLevelUp = useCallback(async () => {
    if (!character) return;
    const r = await api.post(`/characters/${character.id}/rollback_level_up`);
    setCharacter(r.data);
    return r.data;
  }, [character]);

  const addActiveEffect = useCallback(async (name) => {
    if (!character) return;
    const effects = character.tracker_data.active_effects || [];
    if (effects.includes(name)) return;
    await saveTrackerData({ ...character.tracker_data, active_effects: [...effects, name] });
  }, [character, saveTrackerData]);

  const removeActiveEffect = useCallback(async (name) => {
    if (!character) return;
    const effects = character.tracker_data.active_effects || [];
    await saveTrackerData({ ...character.tracker_data, active_effects: effects.filter(e => e !== name) });
  }, [character, saveTrackerData]);

  const addCondition = useCallback(async (name) => {
    if (!character) return;
    const conditions = character.tracker_data.conditions || [];
    if (conditions.includes(name)) return;
    await saveTrackerData({ ...character.tracker_data, conditions: [...conditions, name] });
  }, [character, saveTrackerData]);

  const removeCondition = useCallback(async (name) => {
    if (!character) return;
    const conditions = character.tracker_data.conditions || [];
    await saveTrackerData({ ...character.tracker_data, conditions: conditions.filter(c => c !== name) });
  }, [character, saveTrackerData]);

  // Fills an empty slot when a concentration spell is cast - never overwrites an
  // occupied slot (use replaceConcentration for that), so it never needs Haste cleanup.
  // Reads characterRef (see above) rather than the closure `character`, because doCast
  // calls this AFTER useSlot already changed tracker_data - a closure-captured `character`
  // here would still be the pre-cast snapshot and would revert that slot use on save.
  const setConcentration = useCallback(async (idx, spellName, level, target, noLethargy) => {
    const cur = characterRef.current;
    if (!cur) return;
    const conc = cur.tracker_data.concentration || {};
    const slots = [...(conc.slots || [{}, {}])];
    slots[idx] = { spell: spellName, level: level ?? '', target, ...(noLethargy ? { no_lethargy: true } : {}) };
    await saveTrackerData({ ...cur.tracker_data, concentration: { ...conc, slots } });
  }, [saveTrackerData]);

  // Patches just the target (self/ally) of an already-filled slot, once the player's
  // self/ally choice resolves - doesn't touch spell/level, so it's safe to call after
  // setConcentration already filled the slot without knowing the target yet.
  const setConcentrationTarget = useCallback(async (idx, target) => {
    const cur = characterRef.current;
    if (!cur) return;
    const conc = cur.tracker_data.concentration || {};
    const slots = [...(conc.slots || [{}, {}])];
    if (!slots[idx]) return;
    slots[idx] = { ...slots[idx], target };
    await saveTrackerData({ ...cur.tracker_data, concentration: { ...conc, slots } });
  }, [saveTrackerData]);

  // The one place a concentration slot is cleared or overwritten - used for both a plain
  // "Drop" and a "replace this slot with my new spell" (the concentration-full prompt).
  // Whichever spell USED to be in the slot determines cleanup: dropping/replacing a Haste
  // that was cast on SELF removes the Hasted effect and applies Lethargic to the caster;
  // on an ALLY, the caster's own effects/conditions are untouched (they were never Hasted)
  // and the caller is expected to show an info-only reminder instead. This used to be two
  // separate code paths (ConcentrationModal's Drop button vs SpellDetailModal's replace-
  // prompt) that only one of them implemented the cleanup for - now there's only one path.
  // A slot tagged no_lethargy (Haste granted by an item like Boots of Haste, whose RAW text
  // exempts it) still drops the Hasted effect but skips adding Lethargic.
  const replaceConcentration = useCallback(async (idx, newSpellName = '', newLevel = '', newTarget = undefined, newNoLethargy = false) => {
    const cur = characterRef.current;
    if (!cur) return null;
    const td = cur.tracker_data;
    const conc = td.concentration || {};
    const slots = [...(conc.slots || [{}, {}])];
    const old = slots[idx] || {};
    const oldSpell = (old.spell || '').trim();
    const wasHaste = oldSpell.toLowerCase() === 'haste';
    const wasSelfHaste = wasHaste && old.target === 'self';
    const wasAllyHaste = wasHaste && old.target === 'ally';
    const skipLethargy = !!old.no_lethargy;
    slots[idx] = newSpellName ? { spell: newSpellName, level: newLevel, target: newTarget, ...(newNoLethargy ? { no_lethargy: true } : {}) } : { spell: '', level: '', target: undefined };
    const activeEffects = td.active_effects || [];
    const conditions = td.conditions || [];
    await saveTrackerData({
      ...td,
      concentration: { ...conc, slots },
      ...(wasSelfHaste ? {
        active_effects: activeEffects.filter(e => e !== HASTED_EFFECT),
        ...(skipLethargy ? {} : {
          conditions: conditions.includes(LETHARGIC_CONDITION) ? conditions : [...conditions, LETHARGIC_CONDITION],
        }),
      } : {}),
    });
    return { droppedSpell: oldSpell, wasSelfHaste, wasAllyHaste, noLethargy: skipLethargy };
  }, [saveTrackerData]);

  // Deducts a class resource (e.g. Sorcery Points) by name - used for applying Metamagic
  // mid-cast, after a spell slot may have already been used in the same doCast sequence.
  // Reads characterRef for the same reason setConcentration does.
  const spendFeatureCharges = useCallback(async (featureName, amount) => {
    const cur = characterRef.current;
    if (!cur) return;
    const td = cur.tracker_data;
    const feat = td.features?.[featureName];
    if (!feat) return;
    const newCurrent = Math.max(0, (feat.current || 0) - amount);
    await saveTrackerData({ ...td, features: { ...td.features, [featureName]: { ...feat, current: newCurrent } } });
  }, [saveTrackerData]);

  return (
    <CharacterContext.Provider value={{
      character, characters, loading, turnUsed, setTurnUsed, companionTurnUsed, setCompanionTurnUsed, resetTurn,
      fetchCharacters, loadCharacter, updateCharacter,
      useFeature, useSlot, restoreSlot, doRest, saveTrackerData, saveSpellData, importCharacter, resyncCharacter, deleteCharacter, duplicateCharacter, rollbackLevelUp, useItemCharge, addActiveEffect, removeActiveEffect, addCondition, removeCondition, setConcentration, setConcentrationTarget, replaceConcentration, spendFeatureCharges, setCharacter,
    }}>
      {children}
    </CharacterContext.Provider>
  );
}

export const useCharacter = () => useContext(CharacterContext);
