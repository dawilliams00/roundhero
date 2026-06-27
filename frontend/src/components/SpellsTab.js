import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { maxPreparedSpells, schoolColor, slotBadgeTextColor, getSpellcastingBlocks } from '../utils/dnd';
import SpellBrowserModal from './SpellBrowserModal';
import SpellDetailModal from './SpellDetailModal';
import CustomSpellModal from './CustomSpellModal';
import SpellListManagerModal from './SpellListManagerModal';

export default function SpellsTab() {
  const { character, useSlot, restoreSlot, saveSpellData } = useCharacter();
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('all');
  const [browsing, setBrowsing]   = useState(false);
  const [viewing, setViewing]     = useState(null);
  const [addingCustom, setAddingCustom] = useState(false);
  const [managingLists, setManagingLists] = useState(false);

  if (!character) return null;
  const sd    = character.spell_data || {};
  const slots = character.tracker_data?.spell_slots || {};
  const knownSpells = sd.known_spells || [];
  const spellLists  = sd.spell_lists || {};
  const activeList  = sd.active_list || null;
  const maxPrepared = maxPreparedSpells(character.class_name, character.ability_scores, character.tracker_data?.inventory?.items);
  const isAlwaysAvailable = s => s.ritual || !!s.granted_by || s.level_int === 0;
  const visibleSpells = activeList && spellLists[activeList]
    ? knownSpells.filter(s => spellLists[activeList].includes(s.name) || isAlwaysAvailable(s))
    : knownSpells;
  const spells = visibleSpells.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'cantrip' ? s.level_int===0 : s.level_int===parseInt(filter));
    return matchSearch && matchFilter;
  }).sort((a,b) => (a.level_int - b.level_int) || a.name.localeCompare(b.name));
  const levels = [...new Set(knownSpells.map(s=>s.level_int))].sort((a,b)=>a-b);
  const slotLevels = Object.entries(slots).filter(([,s])=>(s.max||0)>0);
  const hasAvailableSlot = (spell) => slotLevels.some(([lvl,s]) => parseInt(lvl) >= spell.level_int && (s.current||0) > 0);
  // A feat-granted spell with a free-use charge (e.g. Draconic Healing) must stay
  // castable even with zero spell slots - this is the actual bug behind "the app says
  // he can't cast it" for a non-caster who only knows one spell through a feat.
  const hasFreeUse = (spell) => spell.free_use_feature && (character.tracker_data?.features?.[spell.free_use_feature]?.current || 0) > 0;
  const spellBlocks = getSpellcastingBlocks(character.class_name, character.ability_scores, character.level, character.tracker_data?.inventory?.items);

  const addSpell = (spell) => {
    saveSpellData({ ...sd, known_spells: [...knownSpells, spell] });
  };
  const removeSpell = (spell) => {
    saveSpellData({ ...sd, known_spells: knownSpells.filter(s => s.name !== spell.name) });
  };
  const saveLists = (newLists, newActive) => {
    saveSpellData({ ...sd, spell_lists: newLists, active_list: newActive });
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:12,flexShrink:0}}>
        <div className="card" style={{marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',marginBottom:10,gap:8,flexWrap:'wrap'}}>
            <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,flex:1}}>Spell Slots</div>
            {spellBlocks.map(b => (
              <span key={b.className} style={{color:'var(--accent-light)',fontSize:11,fontWeight:600}}>{b.className}: {b.attackMod>=0?'+':''}{b.attackMod} atk · DC {b.saveDC}</span>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => setManagingLists(true)}>Manage Lists</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setBrowsing(true)}>+ Add Spells</button>
            <button className="btn btn-primary btn-sm" onClick={() => setAddingCustom(true)}>+ Custom Spell</button>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'center'}}>
            {slotLevels.length > 0 ? (
              slotLevels.map(([lvl,slot]) => (
                <div key={lvl} style={{textAlign:'center'}}>
                  <div style={{fontSize:10,color:'var(--text-dim)',marginBottom:4}}>L{lvl}</div>
                  <div style={{display:'flex',gap:3,alignItems:'center'}}>
                    {Array.from({length:slot.max}).map((_,i) => (
                      <button key={i} onClick={() => i===slot.current-1 && useSlot(parseInt(lvl))} style={{width:16,height:16,borderRadius:'50%',border:`2px solid var(--slot-${lvl})`,background: i<slot.current ? `var(--slot-${lvl})` : 'transparent',cursor: i===slot.current-1 ? 'pointer' : 'default'}}/>
                    ))}
                    <button onClick={() => restoreSlot(parseInt(lvl))} disabled={slot.current>=slot.max} title="Restore 1 slot (undo accidental cast)"
                      style={{marginLeft:4,padding:'1px 5px',borderRadius:8,background:'var(--bg-hover)',color:'var(--text-dim)',border:'none',fontSize:11,opacity: slot.current>=slot.max ? 0.4 : 1}}>↺</button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{color:'var(--text-dim)',fontSize:12}}>No spell slots for this character.</div>
            )}
            {knownSpells.length > 0 && (
              <div style={{display:'flex',gap:8,marginLeft:'auto',flexWrap:'wrap'}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search spells..." style={{minWidth:140}} />
                <select value={filter} onChange={e=>setFilter(e.target.value)} style={{minWidth:80}}>
                  <option value="all">All</option>
                  <option value="cantrip">Cantrips</option>
                  {levels.filter(l=>l>0).map(l=><option key={l} value={l}>Level {l}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {knownSpells.length > 0 && (
          <div className="card">
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{color:'var(--text-dim)',fontSize:11}}>Loaded list:</span>
              <select
                value={activeList || ''}
                onChange={e => saveLists(spellLists, e.target.value || null)}
                style={{fontWeight:600,color:'var(--accent-light)',fontSize:13,minWidth:140}}
              >
                <option value="">All Known Spells</option>
                {Object.keys(spellLists).map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              {maxPrepared != null && <span style={{color:'var(--text-dim)',fontSize:11}}>prepares up to {maxPrepared} (cantrips don't count)</span>}
            </div>
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'0 12px 12px'}}>
        {knownSpells.length > 0 && (
          <div className="card">
            {spells.map((spell,i) => {
              const castable = spell.level_int === 0 || hasAvailableSlot(spell) || hasFreeUse(spell);
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{flex:1,cursor:'pointer'}} onClick={() => setViewing(spell)}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{background: spell.level_int===0 ? 'var(--text-dim)' : `var(--slot-${spell.level_int})`,color: spell.level_int===0 ? '#fff' : slotBadgeTextColor(spell.level_int),borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600,minWidth:24,textAlign:'center'}}>
                        {spell.level_int===0?'C':spell.level_int}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{color: schoolColor(spell.school),fontWeight:500,fontSize:13}}>{spell.name}</div>
                        <div style={{color:'var(--text-dim)',fontSize:11}}>{spell.school} {spell.ritual?'· Ritual':''} {spell.concentration?'· Concentration':''} {spell.granted_by?`· Granted by ${spell.granted_by}`:''}</div>
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-sm" disabled={!castable} onClick={() => setViewing(spell)} style={{background: castable ? 'var(--accent)' : 'var(--border)',color:'#fff',minWidth:48}}>
                    Cast
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {knownSpells.length === 0 && (
          <div className="card" style={{textAlign:'center',padding:32}}>
            <div style={{fontSize:32,marginBottom:8}}>✨</div>
            <div style={{color:'var(--text-secondary)'}}>No spells added yet — use the buttons above to add some.</div>
          </div>
        )}
      </div>

      {addingCustom && (
        <CustomSpellModal onAdd={addSpell} onClose={() => setAddingCustom(false)} />
      )}
      {managingLists && (
        <SpellListManagerModal
          knownSpells={knownSpells}
          spellLists={spellLists}
          activeList={activeList}
          maxPrepared={maxPrepared}
          onSave={saveLists}
          onClose={() => setManagingLists(false)}
        />
      )}
      {browsing && (
        <SpellBrowserModal
          character={character}
          knownSpells={knownSpells}
          onAdd={addSpell}
          onRemove={removeSpell}
          onClose={() => setBrowsing(false)}
        />
      )}
      {viewing && (
        <SpellDetailModal
          spell={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
