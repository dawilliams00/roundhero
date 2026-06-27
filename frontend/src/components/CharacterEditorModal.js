import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import InfoModal from './InfoModal';

// v1 framework, deliberately minimal - just leveling up for now. More character-editing
// (ability scores, race/class changes, retraining, etc.) lands here later.
export default function CharacterEditorModal({ onClose }) {
  const { character, setCharacter } = useCharacter();
  const [leveling, setLeveling] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  if (!character) return null;

  const levelUp = async () => {
    setLeveling(true);
    setError(null);
    try {
      const r = await api.post(`/characters/${character.id}/level_up`);
      setCharacter(r.data);
      setSummary(r.data.level_up_summary);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not level up.');
    } finally {
      setLeveling(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Edit Character</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:12}}>
          v1 framework — leveling up only for now. We'll tune and expand this later.
        </div>
        <div className="form-group">
          <label>Level</label>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{fontSize:24,fontWeight:700,color:'var(--accent-light)'}}>{character.level}</div>
            <button className="btn btn-primary" disabled={leveling || character.level >= 20} onClick={levelUp}>
              {leveling ? 'Leveling up...' : `Level Up to ${character.level + 1}`}
            </button>
          </div>
        </div>
        {error && <div style={{color:'var(--danger)',fontSize:12,marginTop:8}}>{error}</div>}
        <div style={{color:'var(--text-dim)',fontSize:11,marginTop:8,lineHeight:1.5}}>
          Recomputes HP, spell slots, and class features for the new level. Custom/imported abilities, known spells, inventory, and current HP/charges are preserved. PDF-imported characters (multiclass, or any class name the engine doesn't recognize) can't auto-level here — bump the level and add anything new yourself instead.
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:16}} onClick={onClose}>Close</button>
      </div>
      {summary && (
        <InfoModal
          title={`Welcome to Level ${summary.new_level}!`}
          message={`HP max increased by ${summary.hp_gained}. New features and spell slots (if any) for this level have been added — check the Feats/Attunement and Spells tabs.`}
          onClose={() => setSummary(null)}
        />
      )}
    </div>
  );
}
