import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { ABILITY_KEYS, ABILITY_LABELS } from '../utils/dnd';

// One-time UI for a feat's "choose X when you take this" step (Resilient: which ability;
// Magic Initiate: which class list/ability/cantrips/spell) - onConfirm(choiceData) hands
// the raw choices back to the caller, which runs them through resolveFeatChoice (utils/
// featChoices.js) for the actual mechanical patches, then does its own normal feat-attach.
export default function FeatChoiceModal({ feat, onConfirm, onCancel }) {
  const [ability, setAbility] = useState('STR');
  const [miClass, setMiClass] = useState(feat.magic_initiate_lists?.[0] || 'Wizard');
  const [miAbility, setMiAbility] = useState('INT');
  const [spells, setSpells] = useState([]);
  const [loadingSpells, setLoadingSpells] = useState(false);
  const [cantripChoices, setCantripChoices] = useState([]);
  const [levelOneChoice, setLevelOneChoice] = useState('');

  const isMagicInitiate = feat.choice_type === 'magic_initiate';

  useEffect(() => {
    if (!isMagicInitiate) return;
    setLoadingSpells(true);
    setCantripChoices([]);
    setLevelOneChoice('');
    api.get('/content/spells', { params: { class_name: miClass } })
      .then(r => setSpells(r.data || []))
      .finally(() => setLoadingSpells(false));
  }, [miClass, isMagicInitiate]);

  const cantrips = spells.filter(s => s.level_int === 0).sort((a, b) => a.name.localeCompare(b.name));
  const levelOneSpells = spells.filter(s => s.level_int === 1).sort((a, b) => a.name.localeCompare(b.name));

  const toggleCantrip = (name) => setCantripChoices(c => {
    if (c.includes(name)) return c.filter(n => n !== name);
    if (c.length >= 2) return c; // exactly 2, RAW
    return [...c, name];
  });

  const confirm = () => {
    if (feat.choice_type === 'ability_save_increase') {
      onConfirm({ ability });
    } else if (isMagicInitiate) {
      onConfirm({ magicInitiateClass: miClass, ability: miAbility, cantrips: cantripChoices, levelOneSpell: levelOneChoice });
    }
  };

  const canConfirm = feat.choice_type === 'ability_save_increase'
    ? !!ability
    : (cantripChoices.length === 2 && !!levelOneChoice);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth: isMagicInitiate ? 560 : 420, maxHeight:'85vh', display:'flex', flexDirection:'column'}} onClick={e => e.stopPropagation()}>
        <div className="modal-sticky-header">
          <h2>{feat.name}: Choose</h2>
          <button type="button" className="modal-close-x" onClick={onCancel} aria-label="Close">×</button>
        </div>

        {feat.choice_type === 'ability_save_increase' && (
          <>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>
              Pick the ability score this feat improves - it gains a +1 (capped at 20) and you gain saving throw proficiency with it.
            </div>
            <div className="form-group">
              <label>Ability</label>
              <select value={ability} onChange={e => setAbility(e.target.value)}>
                {ABILITY_KEYS.map(k => <option key={k} value={k}>{ABILITY_LABELS[k]}</option>)}
              </select>
            </div>
          </>
        )}

        {isMagicInitiate && (
          <div style={{flex:1, overflowY:'auto', minHeight:0}}>
            <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:12}}>
              Choose a spell list, your spellcasting ability for these spells, 2 cantrips, and 1 first-level spell (always prepared, castable once free per long rest).
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Spell List</label>
                <select value={miClass} onChange={e => setMiClass(e.target.value)}>
                  {(feat.magic_initiate_lists || ['Cleric','Druid','Wizard']).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Spellcasting Ability</label>
                <select value={miAbility} onChange={e => setMiAbility(e.target.value)}>
                  <option value="INT">Intelligence</option>
                  <option value="WIS">Wisdom</option>
                  <option value="CHA">Charisma</option>
                </select>
              </div>
            </div>

            <div style={{fontSize:12,fontWeight:600,color:'var(--text-dim)',marginTop:8,marginBottom:6}}>
              Cantrips ({cantripChoices.length}/2)
            </div>
            {loadingSpells ? (
              <div style={{color:'var(--text-dim)',fontSize:12,padding:8}}>Loading...</div>
            ) : (
              <div style={{maxHeight:160, overflowY:'auto', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:12}}>
                {cantrips.map(s => (
                  <label key={s.name} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'6px 10px',borderBottom:'1px solid var(--border)',cursor:'pointer',background: cantripChoices.includes(s.name) ? 'rgba(124,92,252,0.12)' : 'none'}}>
                    <input type="checkbox" style={{marginTop:3}} checked={cantripChoices.includes(s.name)}
                      disabled={!cantripChoices.includes(s.name) && cantripChoices.length >= 2}
                      onChange={() => toggleCantrip(s.name)} />
                    <div style={{flex:1}}>
                      <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{s.name}</div>
                      <div style={{color:'var(--text-dim)',fontSize:11}}>{s.school}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div style={{fontSize:12,fontWeight:600,color:'var(--text-dim)',marginBottom:6}}>1st-Level Spell</div>
            {!loadingSpells && (
              <div style={{maxHeight:160, overflowY:'auto', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', marginBottom:12}}>
                {levelOneSpells.map(s => (
                  <label key={s.name} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'6px 10px',borderBottom:'1px solid var(--border)',cursor:'pointer',background: levelOneChoice===s.name ? 'rgba(124,92,252,0.12)' : 'none'}}>
                    <input type="radio" style={{marginTop:3}} checked={levelOneChoice===s.name} onChange={() => setLevelOneChoice(s.name)} />
                    <div style={{flex:1}}>
                      <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{s.name}</div>
                      <div style={{color:'var(--text-dim)',fontSize:11}}>{s.school}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{display:'flex',gap:8,marginTop:12,flexShrink:0}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!canConfirm} onClick={confirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
