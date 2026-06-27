import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';

const RULESETS = [
  { value: '2014', label: "5e (2014 / PHB)" },
  { value: '2024', label: "5e (2024 revision)" },
];

export default function SettingsModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const td = character?.tracker_data || {};
  const settings = td.settings || {};
  const exhaustionRules = settings.exhaustion_rules || { mode: 'raw', name: '', description: '' };

  // Local buffer for the two free-text fields - saveTrackerData round-trips to the server
  // on every call, and binding the inputs directly to the remote value meant every
  // keystroke fired its own save; if a later keystroke's response came back before an
  // earlier one's, the earlier (shorter) text would win and "eat" what was just typed.
  // Typing fast enough to outrun the round-trip dropped letters - this is why slow typing
  // "worked". Buffering locally and saving once on blur avoids the race entirely.
  const [localName, setLocalName] = useState(exhaustionRules.name || '');
  const [localDesc, setLocalDesc] = useState(exhaustionRules.description || '');

  useEffect(() => {
    setLocalName(exhaustionRules.name || '');
    setLocalDesc(exhaustionRules.description || '');
  }, [character?.id]);

  if (!character) return null;

  const ruleset = settings.ruleset || '2014';

  const setRuleset = (value) => saveTrackerData({ ...td, settings: { ...settings, ruleset: value } });
  const setExhaustionRules = (patch) => saveTrackerData({ ...td, settings: { ...settings, exhaustion_rules: { ...exhaustionRules, ...patch } } });
  const commitName = () => { if (localName !== (exhaustionRules.name || '')) setExhaustionRules({ name: localName }); };
  const commitDesc = () => { if (localDesc !== (exhaustionRules.description || '')) setExhaustionRules({ description: localDesc }); };

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

        <div className="form-group">
          <label>Exhaustion Rules</label>
          <div className="form-row">
            <label style={{display:'flex',alignItems:'center',gap:6}}>
              <input type="radio" checked={exhaustionRules.mode !== 'homebrew'} onChange={() => setExhaustionRules({ mode: 'raw' })} /> RAW
            </label>
            <label style={{display:'flex',alignItems:'center',gap:6}}>
              <input type="radio" checked={exhaustionRules.mode === 'homebrew'} onChange={() => setExhaustionRules({ mode: 'homebrew' })} /> Homebrew
            </label>
          </div>
          {exhaustionRules.mode === 'homebrew' && (
            <>
              <input
                value={localName}
                onChange={e => setLocalName(e.target.value)}
                onBlur={commitName}
                placeholder="Homebrew ruleset name"
                style={{marginTop:8}}
              />
              <textarea
                value={localDesc}
                onChange={e => setLocalDesc(e.target.value)}
                onBlur={commitDesc}
                placeholder="What do your homebrew exhaustion rules actually do?"
                rows={3}
                style={{width:'100%',resize:'vertical',marginTop:6}}
              />
            </>
          )}
          <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
            The Exhaustion counter in the header doesn't enforce any mechanical penalty either way — this just controls what shows up when you hover/tap it.
          </div>
        </div>

        <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
