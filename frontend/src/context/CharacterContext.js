import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../utils/api';

const CharacterContext = createContext(null);

export function CharacterProvider({ children }) {
  const [character, setCharacter]   = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading]       = useState(false);

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
    return r.data;
  }, [character]);

  const saveTrackerData = useCallback(async (trackerData) => {
    if (!character) return;
    const r = await api.put(`/tracker/${character.id}`, trackerData);
    setCharacter(prev => ({ ...prev, tracker_data: r.data }));
  }, [character]);

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

  return (
    <CharacterContext.Provider value={{
      character, characters, loading,
      fetchCharacters, loadCharacter, updateCharacter,
      useFeature, useSlot, doRest, saveTrackerData, saveSpellData, importCharacter, setCharacter,
    }}>
      {children}
    </CharacterContext.Provider>
  );
}

export const useCharacter = () => useContext(CharacterContext);
