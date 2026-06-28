import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_ORDER, SECTION_COLORS, ABILITY_KEYS, modStr } from '../utils/dnd';
import AbilityDetailModal from './AbilityDetailModal';
import CompanionAbilityModal from './CompanionAbilityModal';
import ConfirmModal from './ConfirmModal';

// A companion's whole sheet is hand-entered by the player (no class engine behind it,
// unlike the main character) - every field here commits on blur/Enter rather than every
// keystroke, same race-avoidance reasoning as SettingsModal's homebrew text fields and
// CharacterHeader's EditableStat: a fast-typing keystroke's save can otherwise land out
// of order and "eat" what was just typed.
function EditableField({ value, onCommit, type = 'text', placeholder, width, textAlign }) {
  const [val, setVal] = useState(value ?? '');
  useEffect(() => { setVal(value ?? ''); }, [value]);
  const commit = () => { if (val !== (value ?? '')) onCommit(val); };
  return (
    <input
      type={type}
      className={type === 'number' ? 'no-spinner' : undefined}
      value={val}
      placeholder={placeholder}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
      style={{ width, textAlign, padding: width ? '2px 4px' : undefined }}
    />
  );
}

export default function CompanionTab() {
  const { character, saveTrackerData } = useCharacter();
  const [detail, setDetail] = useState(null);
  const [editingIndex, setEditingIndex] = useState(undefined);
  const [confirmRemove, setConfirmRemove] = useState(null);

  if (!character) return null;
  const td = character.tracker_data || {};
  const companion = td.companion || {};
  const hp = companion.hp || { current: 0, max: 0, temp: 0 };
  const abilities = companion.abilities || [];
  const abilityScores = companion.ability_scores || {};

  const saveCompanion = (patch) => saveTrackerData({ ...td, companion: { ...companion, ...patch } });
  const saveHp = (patch) => saveCompanion({ hp: { ...hp, ...patch } });
  const saveAbilityScore = (key, value) => saveCompanion({ ability_scores: { ...abilityScores, [key]: Math.max(1, parseInt(value) || 10) } });

  const adjustHp = (delta) => {
    let temp = hp.temp || 0;
    let current = hp.current || 0;
    if (delta < 0) {
      const fromTemp = Math.min(temp, -delta);
      temp -= fromTemp;
      current = Math.max(0, current + delta + fromTemp);
    } else {
      current = Math.min(hp.max || 0, current + delta);
    }
    saveHp({ current, temp });
  };

  const adjustAbility = (idx, delta) => {
    const ab = abilities[idx];
    if (!ab) return;
    const newCurrent = Math.max(0, Math.min(ab.max || 99, (ab.current || 0) + delta));
    saveCompanion({ abilities: abilities.map((a, i) => i === idx ? { ...a, current: newCurrent } : a) });
  };

  const removeAbility = (idx) => {
    saveCompanion({ abilities: abilities.filter((_, i) => i !== idx) });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <EditableField
            value={companion.name}
            onCommit={v => saveCompanion({ name: v })}
            placeholder={companion.tab_name || 'Companion'}
            width="100%"
          />
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => adjustHp(-1)} style={{ background: 'var(--danger)', color: '#fff', borderRadius: 4, width: 22, height: 22, fontWeight: 700, fontSize: 13 }}>−</button>
            <div className="stat-box">
              <div className="stat-value" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <EditableField type="number" value={hp.current} onCommit={v => saveHp({ current: Math.max(0, Math.min(hp.max || 0, parseInt(v) || 0)) })} width={48} textAlign="center" />
                /
                <EditableField type="number" value={hp.max} onCommit={v => { const mx = Math.max(0, parseInt(v) || 0); saveHp({ max: mx, current: Math.min(hp.current || 0, mx) }); }} width={48} textAlign="center" />
              </div>
              <div className="stat-label">HP</div>
            </div>
            <button onClick={() => adjustHp(1)} style={{ background: 'var(--success)', color: '#fff', borderRadius: 4, width: 22, height: 22, fontWeight: 700, fontSize: 13 }}>+</button>
          </div>
          <div className="stat-box">
            <EditableField type="number" value={hp.temp} onCommit={v => saveHp({ temp: Math.max(0, parseInt(v) || 0) })} width={48} textAlign="center" />
            <div className="stat-label">Temp HP</div>
          </div>
          <div className="stat-box">
            <EditableField type="number" value={companion.ac} onCommit={v => saveCompanion({ ac: parseInt(v) || 0 })} width={48} textAlign="center" />
            <div className="stat-label">AC</div>
          </div>
          <div className="stat-box">
            <EditableField value={companion.movement} onCommit={v => saveCompanion({ movement: v })} placeholder="30 ft." width={90} textAlign="center" />
            <div className="stat-label">Movement</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {ABILITY_KEYS.map(key => {
            const score = abilityScores[key] ?? 10;
            return (
              <div className="stat-box" key={key}>
                <div className="stat-value">
                  <EditableField type="number" value={score} onCommit={v => saveAbilityScore(key, v)} width={48} textAlign="center" />
                </div>
                <div className="stat-sub">{modStr(score)}</div>
                <div className="stat-label">{key}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setEditingIndex(null)}>+ Add Ability</button>
      </div>

      {abilities.length === 0 && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>
          No abilities yet — add feats/actions for your companion and assign them to Action, Bonus Action, Reaction, Free Action, or Passive.
        </div>
      )}

      {SECTION_ORDER.map(section => {
        const sectionAbilities = abilities.map((a, i) => ({ a, i })).filter(({ a }) => a.section === section);
        if (sectionAbilities.length === 0) return null;
        return (
          <div className="card" style={{ marginBottom: 12 }} key={section}>
            <div style={{ color: SECTION_COLORS[section], fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{section}</div>
            {sectionAbilities.map(({ a, i }) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setDetail({ name: a.name, description: a.description, source: `${a.rest_type} rest` })}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{a.name}</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>{a.rest_type} rest</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(a.max || 0) > 0 && (
                    <>
                      <button onClick={() => adjustAbility(i, -1)} style={{ background: 'var(--danger)', color: '#fff', borderRadius: 4, width: 22, height: 22, fontWeight: 700, fontSize: 14 }}>−</button>
                      <span style={{ color: a.current > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700, fontSize: 15, minWidth: 36, textAlign: 'center' }}>{a.current}/{a.max}</span>
                      <button onClick={() => adjustAbility(i, 1)} style={{ background: 'var(--success)', color: '#fff', borderRadius: 4, width: 22, height: 22, fontWeight: 700, fontSize: 14 }}>+</button>
                    </>
                  )}
                  <button onClick={() => setEditingIndex(i)} title="Edit this ability" style={{ background: 'var(--bg-hover)', color: 'var(--text-dim)', borderRadius: 4, width: 22, height: 22, fontWeight: 700, fontSize: 12, marginLeft: 4 }}>✏️</button>
                  <button onClick={() => setConfirmRemove(i)} title="Remove this ability" style={{ background: 'var(--bg-hover)', color: 'var(--text-dim)', borderRadius: 4, width: 22, height: 22, fontWeight: 700, fontSize: 14 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {detail && <AbilityDetailModal ability={detail} onClose={() => setDetail(null)} />}
      {editingIndex !== undefined && <CompanionAbilityModal editingIndex={editingIndex} onClose={() => setEditingIndex(undefined)} />}
      {confirmRemove !== null && (
        <ConfirmModal
          title="Remove Ability?"
          message={`Remove "${abilities[confirmRemove]?.name}"? This can't be undone.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => { removeAbility(confirmRemove); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
