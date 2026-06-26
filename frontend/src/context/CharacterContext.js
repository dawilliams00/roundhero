import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../utils/api';

const CharacterContext = createContext(null);

const EMPTY_TURN = { Action: false, 'Bonus Action': false, Reaction: false, Haste: false };

export function CharacterProvider({ children }) {
  const [character, setCharacter]   = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [turnUsed, setTurnUsed]     = useState(EMPTY_TURN);

  const resetTurn = useCallback(() => setTurnUsed(EMPTY_TURN), []);

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

  return (
    <CharacterContext.Provider value={{
      character, characters, loading, turnUsed, setTurnUsed, resetTurn,
      fetchCharacters, loadCharacter, updateCharacter,
      useFeature, useSlot, restoreSlot, doRest, saveTrackerData, saveSpellData, importCharacter, resyncCharacter, deleteCharacter, useItemCharge, addActiveEffect, removeActiveEffect, setCharacter,
    }}>
      {children}
    </CharacterContext.Provider>
  );
}

export const useCharacter = () => useContext(CharacterContext);
