import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { schoolColor, slotBadgeTextColor } from '../utils/dnd';

export default function SpellTuckModal({ ability, onClose, onUse }) {
  const { character, saveTrackerData } = useCharacter();
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [castResult, setCastResult] = useState(null);

  if (!character) return null;

  const td = character.tracker_data || {};
  const key = ability.tracker_key;
  const feat = td.features?.[key] || {};
  const tucked = feat.tucked_spell || '';
  const tuckedLevel = feat.tucked_level || '';
  const current = feat.current ?? 0;
  const max = feat.max ?? 1;

  const knownSpells = (character.spell_data?.known_spells || [])
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => (a.level_int - b.level_int) || a.name.localeCompare(b.name));

  const saveFeat = (patch) => saveTrackerData({ ...td, features: { ...td.features, [key]: { ...feat, ...patch } } });

  const tuckSpell = async (spell) => {
    await saveFeat({ tucked_spell: spell.name, tucked_level: spell.level_int });
    setPicking(false);
  };

  const clearTucked = () => saveFeat({ tucked_spell: '', tucked_level: '' });

  const castTucked = async () => {
    if (!tucked || current <= 0) return;
    const remaining = Math.max(0, current - 1);
    await saveFeat({ current: remaining });
    if (onUse) onUse();
    setCastResult(`🃏 ${tucked}${tuckedLevel ? ` (L${tuckedLevel})` : ''} cast! No slot used. ${remaining}/${max} uses left.`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🃏 {ability.name}</h2>
          <div style={{color:'var(--text-dim)',fontSize:12}}>{current}/{max} uses available</div>
        </div>
        <div className="modal-body">
          {!picking ? (
            <>
              {tucked ? (
                <div className="card" style={{marginBottom:14,display:'flex',alignItems:'center',gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Tucked Spell</div>
                    <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:17}}>{tucked}{tuckedLevel !== '' ? ` (L${tuckedLevel})` : ''}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={clearTucked}>Clear</button>
                </div>
              ) : (
                <div style={{color:'var(--text-dim)',fontSize:13,marginBottom:14}}>No spell tucked yet — pick one below to tuck it for later.</div>
              )}
              {ability.description && (
                <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap',fontSize:13}}>{ability.description}</p>
              )}
              {castResult && <div style={{color:'var(--success)',fontSize:13,marginTop:12}}>{castResult}</div>}
            </>
          ) : (
            <>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search known spells..." style={{width:'100%',marginBottom:10}} autoFocus />
              {knownSpells.length === 0 ? (
                <div style={{color:'var(--text-dim)',fontSize:12,textAlign:'center',padding:24}}>No known spells. Add some in the Spells tab first.</div>
              ) : knownSpells.map((s,i) => (
                <div key={i} onClick={() => tuckSpell(s)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 4px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                  <div style={{background: s.level_int===0?'var(--text-dim)':`var(--slot-${s.level_int})`,color: s.level_int===0 ? '#fff' : slotBadgeTextColor(s.level_int),borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600,minWidth:24,textAlign:'center'}}>
                    {s.level_int===0?'C':s.level_int}
                  </div>
                  <div style={{color: schoolColor(s.school),fontSize:13}}>{s.name}</div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="modal-footer">
          {picking ? (
            <button className="btn btn-secondary" onClick={() => setPicking(false)}>Back</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setPicking(true)}>{tucked ? 'Tuck a Different Spell' : 'Tuck a Spell'}</button>
              {tucked && (
                <button className="btn btn-primary" disabled={current<=0} onClick={castTucked}>
                  {current<=0 ? 'No Uses Left' : `Cast ${tucked}`}
                </button>
              )}
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
