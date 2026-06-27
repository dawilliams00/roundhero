import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { spellCastBucket, schoolColor, slotBadgeTextColor } from '../utils/dnd';
import SpellDetailModal from './SpellDetailModal';

export default function CastSpellPickerModal({ onClose, bucket, onCast }) {
  const { character } = useCharacter();
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState(null);

  const sd = character?.spell_data || {};
  const knownSpells = sd.known_spells || [];
  const spellLists  = sd.spell_lists || {};
  const activeList  = sd.active_list || null;
  const isAlwaysAvailable = s => s.ritual || !!s.granted_by || s.level_int === 0;
  const visibleSpells = activeList && spellLists[activeList]
    ? knownSpells.filter(s => spellLists[activeList].includes(s.name) || isAlwaysAvailable(s))
    : knownSpells;
  const bucketFiltered = bucket ? visibleSpells.filter(s => spellCastBucket(s.casting_time) === bucket) : visibleSpells;
  const spells = bucketFiltered.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => (a.level_int - b.level_int) || a.name.localeCompare(b.name));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Cast a Spell{bucket ? ` (${bucket})` : ''}</h2>
          <div style={{color:'var(--text-dim)',fontSize:11}}>From: {activeList || 'All Known Spells'}{bucket ? ` · only spells castable as a ${bucket.toLowerCase()}` : ''}</div>
        </div>
        <div className="modal-body">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search spells..." style={{width:'100%',marginBottom:12}} autoFocus />
          {spells.length === 0 ? (
            <div style={{color:'var(--text-dim)',fontSize:12,textAlign:'center',padding:24}}>
              {bucket ? `No known spells castable as a ${bucket.toLowerCase()}.` : 'No spells available. Add some in the Spells tab.'}
            </div>
          ) : spells.map((spell,i) => (
            <div key={i} onClick={() => setViewing(spell)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
              <div style={{background: spell.level_int===0 ? 'var(--text-dim)' : `var(--slot-${spell.level_int})`,color: spell.level_int===0 ? '#fff' : slotBadgeTextColor(spell.level_int),borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600,minWidth:24,textAlign:'center'}}>
                {spell.level_int===0?'C':spell.level_int}
              </div>
              <div style={{flex:1}}>
                <div style={{color: schoolColor(spell.school),fontWeight:500,fontSize:13}}>{spell.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{spell.school}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>

      {viewing && (
        <SpellDetailModal
          spell={viewing}
          onClose={() => setViewing(null)}
          onCastSuccess={() => { if (onCast) onCast(); onClose(); }}
        />
      )}
    </div>
  );
}
