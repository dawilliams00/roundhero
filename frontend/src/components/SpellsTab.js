import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { slotColor } from '../utils/dnd';
import SpellBrowserModal from './SpellBrowserModal';
import SpellDetailModal from './SpellDetailModal';
import CustomSpellModal from './CustomSpellModal';

export default function SpellsTab() {
  const { character, useSlot, saveSpellData } = useCharacter();
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [browsing, setBrowsing]   = useState(false);
  const [viewing, setViewing]     = useState(null);
  const [addingCustom, setAddingCustom] = useState(false);

  if (!character) return null;
  const sd    = character.spell_data || {};
  const slots = character.tracker_data?.spell_slots || {};
  const knownSpells = sd.known_spells || [];
  const spells = knownSpells.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'cantrip' ? s.level_int===0 : s.level_int===parseInt(filter));
    return matchSearch && matchFilter;
  });
  const levels = [...new Set(knownSpells.map(s=>s.level_int))].sort((a,b)=>a-b);
  const slotLevels = Object.entries(slots).filter(([,s])=>(s.max||0)>0);

  const addSpell = (spell) => {
    saveSpellData({ ...sd, known_spells: [...knownSpells, spell] });
  };
  const removeSpell = (spell) => {
    saveSpellData({ ...sd, known_spells: knownSpells.filter(s => s.name !== spell.name) });
  };

  return (
    <div style={{flex:1,overflowY:'auto',padding:12}}>
      {slotLevels.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Spell Slots</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {slotLevels.map(([lvl,slot]) => (
              <div key={lvl} style={{textAlign:'center'}}>
                <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:4}}>L{lvl}</div>
                <div style={{display:'flex',gap:3}}>
                  {Array.from({length:slot.max}).map((_,i) => (
                    <button key={i} onClick={() => i===slot.current-1 && useSlot(parseInt(lvl))} style={{width:16,height:16,borderRadius:'50%',border:`2px solid var(--slot-${lvl})`,background: i<slot.current ? `var(--slot-${lvl})` : 'transparent',cursor: i===slot.current-1 ? 'pointer' : 'default'}}/>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {knownSpells.length > 0 ? (
        <div className="card">
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search spells..." style={{flex:1,minWidth:120}} />
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={{minWidth:80}}>
              <option value="all">All</option>
              <option value="cantrip">Cantrips</option>
              {levels.filter(l=>l>0).map(l=><option key={l} value={l}>Level {l}</option>)}
            </select>
            <button className="btn btn-primary" onClick={() => setBrowsing(true)}>+ Add Spells</button>
            <button className="btn btn-secondary" onClick={() => setAddingCustom(true)}>+ Custom Spell</button>
          </div>
          {spells.map((spell,i) => (
            <div key={i} onClick={() => setViewing(spell)} style={{padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{background: spell.level_int===0 ? 'var(--text-dim)' : `var(--slot-${spell.level_int})`,color:'#fff',borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600,minWidth:24,textAlign:'center'}}>
                  {spell.level_int===0?'C':spell.level_int}
                </div>
                <div style={{flex:1}}>
                  <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{spell.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>{spell.school} {spell.ritual?'· Ritual':''} {spell.concentration?'· Concentration':''}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{textAlign:'center',padding:32}}>
          <div style={{fontSize:32,marginBottom:8}}>✨</div>
          <div style={{color:'var(--text-secondary)',marginBottom:8}}>No spells added yet.</div>
          <div style={{display:'flex',gap:8,justifyContent:'center'}}>
            <button className="btn btn-primary" onClick={() => setBrowsing(true)}>+ Add Spells</button>
            <button className="btn btn-secondary" onClick={() => setAddingCustom(true)}>+ Custom Spell</button>
          </div>
        </div>
      )}

      {addingCustom && (
        <CustomSpellModal onAdd={addSpell} onClose={() => setAddingCustom(false)} />
      )}
      {browsing && (
        <SpellBrowserModal
          character={character}
          knownSpells={knownSpells}
          onAdd={addSpell}
          onClose={() => setBrowsing(false)}
        />
      )}
      {viewing && (
        <SpellDetailModal
          spell={viewing}
          onRemove={removeSpell}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
