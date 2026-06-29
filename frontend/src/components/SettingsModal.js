import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import RulesetBrowserModal from './RulesetBrowserModal';
import CharacterEditorModal from './CharacterEditorModal';

const RULESETS = [
  { value: '2014', label: "5e (2014 / PHB)" },
  { value: '2024', label: "5e (2024 revision)" },
];

export default function SettingsModal({ onClose }) {
  const { character, saveTrackerData } = useCharacter();
  const td = character?.tracker_data || {};
  const settings = td.settings || {};
  const exhaustionRules = settings.exhaustion_rules || { mode: 'raw', name: '', description: '' };
  const companion = td.companion || {};
  const companion2 = td.companion2 || {};

  // Local buffer for the two free-text fields - saveTrackerData round-trips to the server
  // on every call, and binding the inputs directly to the remote value meant every
  // keystroke fired its own save; if a later keystroke's response came back before an
  // earlier one's, the earlier (shorter) text would win and "eat" what was just typed.
  // Typing fast enough to outrun the round-trip dropped letters - this is why slow typing
  // "worked". Buffering locally and saving once on blur avoids the race entirely.
  const [localName, setLocalName] = useState(exhaustionRules.name || '');
  const [localDesc, setLocalDesc] = useState(exhaustionRules.description || '');
  const [localCompanionName, setLocalCompanionName] = useState(companion.tab_name || 'Companion');
  const [localCompanion2Name, setLocalCompanion2Name] = useState(companion2.tab_name || 'Companion 2');
  const [showBrowser, setShowBrowser] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    setLocalName(exhaustionRules.name || '');
    setLocalDesc(exhaustionRules.description || '');
    setLocalCompanionName(companion.tab_name || 'Companion');
    setLocalCompanion2Name(companion2.tab_name || 'Companion 2');
  }, [character?.id]);

  if (!character) return null;

  const ruleset = settings.ruleset || '2014';
  const contentEditions = settings.content_editions || { '2014': true, '2024': true, expanded: true };

  const setRuleset = (value) => saveTrackerData({ ...td, settings: { ...settings, ruleset: value } });
  const toggleEdition = (key) => saveTrackerData({ ...td, settings: { ...settings, content_editions: { ...contentEditions, [key]: !contentEditions[key] } } });
  const setExhaustionRules = (patch) => saveTrackerData({ ...td, settings: { ...settings, exhaustion_rules: { ...exhaustionRules, ...patch } } });
  const setCompanion = (patch) => saveTrackerData({ ...td, companion: { ...companion, ...patch } });
  const setCompanion2 = (patch) => saveTrackerData({ ...td, companion2: { ...companion2, ...patch } });
  const toggleCompanionEnabled = () => setCompanion({ enabled: !companion.enabled });
  // Disabling slot 2 also bounces active_companion back to slot 1, so a character mid-
  // Hybrid-Transformation doesn't end up with the AE tab/Companion tab silently pointed at
  // a slot that no longer exists (activeCompanionKey already falls back defensively, but
  // resetting it here too keeps tracker_data itself consistent, not just the derived read).
  const toggleCompanion2Enabled = () => saveTrackerData({
    ...td,
    companion2: { ...companion2, enabled: !companion2.enabled },
    ...(companion2.enabled ? { active_companion: 1 } : {}),
  });
  const commitCompanionName = () => {
    const name = localCompanionName.trim() || 'Companion';
    setLocalCompanionName(name);
    if (name !== (companion.tab_name || 'Companion')) setCompanion({ tab_name: name });
  };
  const commitCompanion2Name = () => {
    const name = localCompanion2Name.trim() || 'Companion 2';
    setLocalCompanion2Name(name);
    if (name !== (companion2.tab_name || 'Companion 2')) setCompanion2({ tab_name: name });
  };

  // Keeps the shared ruleset library in sync with whatever this character has typed -
  // upserted by name on the backend, so one player filling this in is automatically
  // visible to everyone else searching the library, with no separate "publish" step.
  const syncToLibrary = (name, description) => {
    if (!name.trim()) return;
    api.put('/content/rulesets', { name: name.trim(), description, ruleset_type: 'exhaustion' }).catch(() => {});
  };
  const commitName = () => {
    if (localName !== (exhaustionRules.name || '')) setExhaustionRules({ name: localName });
    syncToLibrary(localName, localDesc);
  };
  const commitDesc = () => {
    if (localDesc !== (exhaustionRules.description || '')) setExhaustionRules({ description: localDesc });
    syncToLibrary(localName, localDesc);
  };
  const importRuleset = (r) => {
    setLocalName(r.name || '');
    setLocalDesc(r.description || '');
    setExhaustionRules({ mode: 'homebrew', name: r.name || '', description: r.description || '' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="form-group">
          <button className="btn btn-secondary" style={{width:'100%'}} onClick={() => setShowEditor(true)}>✏️ Edit Character</button>
        </div>
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
          <label>Content Available in Libraries</label>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <input type="checkbox" style={{width:'auto',flexShrink:0}} checked={contentEditions['2014'] !== false} onChange={() => toggleEdition('2014')} /> 5e (2014 / PHB) content
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <input type="checkbox" style={{width:'auto',flexShrink:0}} checked={contentEditions['2024'] !== false} onChange={() => toggleEdition('2024')} /> 5e (2024 revision) content
            </label>
            <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <input type="checkbox" style={{width:'auto',flexShrink:0}} checked={contentEditions['expanded'] !== false} onChange={() => toggleEdition('expanded')} /> Expanded / Homebrew content
            </label>
          </div>
          <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
            Controls which feats show up when browsing the shared library. Content with no edition tagged is treated as 2014.
          </div>
        </div>

        <div className="form-group">
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
            <input type="checkbox" style={{width:'auto',flexShrink:0}} checked={!!companion.enabled} onChange={toggleCompanionEnabled} /> Track a Companion
          </label>
          {companion.enabled && (
            <>
              <input
                value={localCompanionName}
                onChange={e => setLocalCompanionName(e.target.value)}
                onBlur={commitCompanionName}
                placeholder="Companion"
                style={{marginTop:8}}
              />
              <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
                Adds a tab (named above) for tracking a companion/familiar's own HP, AC, movement, and abilities — and splits the Action Economy tab so you can track both turns side by side.
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginTop:12}}>
                <input type="checkbox" style={{width:'auto',flexShrink:0}} checked={!!companion2.enabled} onChange={toggleCompanion2Enabled} /> Track a Second Form/Companion
              </label>
              {companion2.enabled && (
                <>
                  <input
                    value={localCompanion2Name}
                    onChange={e => setLocalCompanion2Name(e.target.value)}
                    onBlur={commitCompanion2Name}
                    placeholder="Companion 2"
                    style={{marginTop:8}}
                  />
                  <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
                    For something like a Blood Hunter's Hybrid Transformation vs. normal form, or a second pet — a toggle on the Companion tab switches which one is "in play" (its HP/AC/abilities, and the Action Economy column) without losing the other's data.
                  </div>
                </>
              )}
            </>
          )}
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
              <button className="btn btn-secondary btn-sm" style={{marginTop:8}} onClick={() => setShowBrowser(true)}>🔍 Browse Homebrew Rulesets</button>
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
              <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}>
                Typing a name + description here saves it to the shared library too — anyone else in your group can find and import it instead of retyping it.
              </div>
            </>
          )}
          <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>
            The Exhaustion counter in the header doesn't enforce any mechanical penalty either way — this just controls what shows up when you hover/tap it.
          </div>
        </div>

        <button className="btn btn-secondary" style={{width:'100%',marginTop:8}} onClick={onClose}>Close</button>
      </div>
      {showBrowser && (
        <RulesetBrowserModal rulesetType="exhaustion" onImport={importRuleset} onClose={() => setShowBrowser(false)} />
      )}
      {showEditor && <CharacterEditorModal onClose={() => setShowEditor(false)} />}
    </div>
  );
}
