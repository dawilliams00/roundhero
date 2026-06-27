import React from 'react';
import { useCharacter } from '../context/CharacterContext';

const RULESETS = [
  { value: '2014', label: "5e (2014 / PHB)" },
  { value: '2024', label: "5e (2024 revision)" },
];

export default function SettingsModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  if (!character) return null;

  const td = character.tracker_data || {};
  const settings = td.settings || {};
  const ruleset = settings.ruleset || '2014';

  const setRuleset = (value) => saveTrackerData({ ...td, settings: { ...settings, ruleset: value } });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="form-group">
          <label>Ruleset</label>
          <select value={ruleset} onChange={e => setRuleset(e.target.value)}>
            {RULESETS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
            Not yet wired into any rules logic — reserved for upcoming options that differ between the 2014 and 2024 rulesets.
          </div>
        </div>
        <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
