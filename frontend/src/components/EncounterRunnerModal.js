import React, { useMemo, useState } from 'react';

const COMMON_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled',
  'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone',
  'Restrained', 'Stunned', 'Unconscious', 'Hexed', 'Blessed', 'Baned', 'Hasted', 'Slowed'
];

function sameId(left, right) {
  return String(left) === String(right);
}

function combatantId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function initiativeValue(value) {
  if (value === '' || value == null) return -999;
  return toNumber(value, -999);
}

function cleanList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeCombatant(row) {
  return {
    id: row.id || combatantId(),
    type: row.type || 'enemy',
    name: row.name || 'Combatant',
    initiative: row.initiative ?? '',
    hp_current: row.hp_current ?? row.hp_max ?? '',
    hp_max: row.hp_max ?? '',
    temp_hp: row.temp_hp ?? 0,
    ac: row.ac ?? '',
    conditions: cleanList(row.conditions),
    concentration: row.concentration || '',
    effects: cleanList(row.effects),
    death_saves: row.death_saves || { successes: 0, failures: 0 },
    group_key: row.group_key || '',
    monster_name: row.monster_name || '',
    monster: row.monster || null,
    notes: row.notes || '',
    user_id: row.user_id || null,
    character_id: row.character_id || null,
    snapshot: row.snapshot || null,
  };
}

function sortedCombatants(encounter) {
  return [...((encounter?.data?.combatants || []).map(normalizeCombatant))]
    .sort((a, b) => initiativeValue(b.initiative) - initiativeValue(a.initiative) || a.name.localeCompare(b.name));
}

function rosterSnapshot(entry) {
  return entry.sheet_snapshot || {};
}

function concentrationText(snapshot) {
  const slots = snapshot.concentration_slots || [];
  if (slots.length) return slots.map(slot => slot?.spell || slot?.name || '').filter(Boolean).join(' / ');
  return snapshot.concentration || '';
}

function combatantFromRoster(entry, existing = {}) {
  const snap = rosterSnapshot(entry);
  const hp = snap.hp || {};
  return normalizeCombatant({
    ...existing,
    type: 'player',
    name: entry.name,
    character_id: entry.character_id,
    user_id: entry.user_id,
    group_key: 'Players',
    hp_current: hp.current ?? existing.hp_current ?? '',
    hp_max: hp.max ?? existing.hp_max ?? '',
    temp_hp: hp.temp ?? existing.temp_hp ?? 0,
    ac: snap.ac ?? existing.ac ?? '',
    conditions: cleanList(snap.conditions).length ? cleanList(snap.conditions) : cleanList(existing.conditions),
    concentration: concentrationText(snap) || existing.concentration || '',
    effects: cleanList(snap.active_effects).map(name => ({ id: `sheet_${name}`, name, type: 'sheet' })).concat(cleanList(existing.effects)),
    snapshot: snap,
  });
}

function enemyGroupLabel(row) {
  if (!row.group_key) return row.monster_name || row.name;
  return row.group_key.split('_')[0] || row.monster_name || row.name;
}

function makeEffectOptions(roster) {
  const spells = [];
  const effects = [];
  roster.forEach(entry => {
    const snap = rosterSnapshot(entry);
    cleanList(snap.prepared_spells).forEach(spell => {
      const name = typeof spell === 'string' ? spell : spell?.name;
      if (name && !spells.includes(name)) spells.push(name);
    });
    cleanList(snap.active_effects).forEach(effect => {
      const name = typeof effect === 'string' ? effect : effect?.name;
      if (name && !effects.includes(name)) effects.push(name);
    });
  });
  return {
    condition: COMMON_CONDITIONS,
    spell: spells.sort((a, b) => a.localeCompare(b)),
    effect: effects.sort((a, b) => a.localeCompare(b)),
    note: [],
  };
}

function MiniButton({ children, onClick, variant = 'secondary', disabled }) {
  return (
    <button type="button" className={`btn btn-${variant} btn-sm`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function HpControls({ row, onUpdate }) {
  const [amount, setAmount] = useState('');
  const applyDelta = delta => {
    let current = toNumber(row.hp_current, 0);
    let temp = toNumber(row.temp_hp, 0);
    const max = toNumber(row.hp_max, current);
    if (delta < 0) {
      let damage = Math.abs(delta);
      const absorbed = Math.min(temp, damage);
      temp -= absorbed;
      damage -= absorbed;
      current = Math.max(0, current - damage);
    } else {
      current = Math.min(max || current + delta, current + delta);
    }
    onUpdate(row.id, { hp_current: current, temp_hp: temp });
  };
  const amt = Math.max(0, toNumber(amount, 0));
  return (
    <div style={{display:'grid',gridTemplateColumns:'28px 1fr 28px',gap:6,alignItems:'center'}}>
      <MiniButton onClick={() => applyDelta(-1)} variant="danger">-</MiniButton>
      <div style={{textAlign:'center'}}>
        <div style={{color:'var(--accent-light)',fontWeight:800,fontSize:18}}>{row.hp_current || 0}/{row.hp_max || '?'}</div>
        <div style={{color:'var(--text-dim)',fontSize:11}}>Temp {row.temp_hp || 0}</div>
      </div>
      <MiniButton onClick={() => applyDelta(1)} variant="success">+</MiniButton>
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" style={{gridColumn:'1 / -1',textAlign:'center'}} />
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,gridColumn:'1 / -1'}}>
        <MiniButton onClick={() => { applyDelta(-amt); setAmount(''); }} variant="danger" disabled={!amt}>Damage</MiniButton>
        <MiniButton onClick={() => { applyDelta(amt); setAmount(''); }} variant="success" disabled={!amt}>Heal</MiniButton>
        <MiniButton onClick={() => { onUpdate(row.id, { temp_hp: Math.max(0, toNumber(row.temp_hp, 0) + amt) }); setAmount(''); }} disabled={!amt}>Temp</MiniButton>
      </div>
    </div>
  );
}

function CombatantCard({ row, active, onUpdate, onRemove, onViewMonster, onAddCondition, onRemoveCondition, onRemoveEffect, onDeathSave }) {
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:active ? 'rgba(124,92,252,0.14)' : 'var(--bg-secondary)',padding:10,display:'grid',gridTemplateColumns:'74px minmax(160px,1.2fr) 160px minmax(180px,1fr) 140px',gap:10,alignItems:'start'}}>
      <div>
        <label style={{fontSize:10,color:'var(--text-dim)'}}>INIT</label>
        <input value={row.initiative} onChange={e => onUpdate(row.id, { initiative: e.target.value })} style={{textAlign:'center',fontWeight:800}} />
      </div>
      <div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <input value={row.name} onChange={e => onUpdate(row.id, { name: e.target.value })} style={{fontWeight:800}} />
          <span style={{color:row.type === 'player' ? 'var(--success)' : 'var(--warning)',fontSize:11,fontWeight:800,textTransform:'uppercase'}}>{row.type}</span>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',marginTop:6,flexWrap:'wrap'}}>
          <span style={{color:'var(--text-secondary)',fontSize:12}}>AC</span>
          <input value={row.ac} onChange={e => onUpdate(row.id, { ac: e.target.value })} style={{width:58,textAlign:'center'}} />
          {row.monster && <MiniButton onClick={() => onViewMonster(row.monster)}>Stats</MiniButton>}
          {row.monster && <button type="button" onClick={() => onViewMonster(row.monster)} style={{background:'transparent',border:0,color:'var(--accent-light)',fontSize:12,cursor:'pointer',padding:0}}>open stat block</button>}
        </div>
        <div style={{color:'var(--text-dim)',fontSize:11,marginTop:6}}>{row.group_key ? `Group: ${enemyGroupLabel(row)}` : 'No group'}</div>
      </div>
      <HpControls row={row} onUpdate={onUpdate} />
      <div>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6,marginBottom:7}}>
          <select onChange={e => { if (e.target.value) onAddCondition(row, e.target.value); e.target.value = ''; }} defaultValue="">
            <option value="">Add condition</option>
            {COMMON_CONDITIONS.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <MiniButton onClick={() => onAddCondition(row, 'Concentrating')}>Con</MiniButton>
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',minHeight:24}}>
          {cleanList(row.conditions).length === 0 && <span style={{color:'var(--text-dim)',fontSize:12}}>No conditions</span>}
          {cleanList(row.conditions).map(condition => (
            <button key={condition} type="button" onClick={() => onRemoveCondition(row, condition)} style={{border:'1px solid var(--border)',background:'rgba(0,0,0,0.25)',color:'var(--text-primary)',borderRadius:4,padding:'3px 6px',fontSize:11,cursor:'pointer'}}>
              {condition} x
            </button>
          ))}
        </div>
        <div style={{marginTop:8}}>
          <label style={{fontSize:10,color:'var(--text-dim)'}}>CONCENTRATION</label>
          <input value={row.concentration} onChange={e => onUpdate(row.id, { concentration: e.target.value })} placeholder="Spell or effect" />
        </div>
      </div>
      <div>
        <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,marginBottom:5}}>EFFECTS</div>
        <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:98,overflowY:'auto'}}>
          {cleanList(row.effects).length === 0 && <span style={{color:'var(--text-dim)',fontSize:12}}>None</span>}
          {cleanList(row.effects).map(effect => (
            <button key={effect.id || effect.name} type="button" onClick={() => onRemoveEffect(row, effect)} style={{textAlign:'left',border:'1px solid var(--border)',background:'var(--bg-primary)',color:'var(--text-primary)',borderRadius:4,padding:5,cursor:'pointer'}}>
              <div style={{fontWeight:700,fontSize:12}}>{effect.name}</div>
              <div style={{color:'var(--text-dim)',fontSize:10}}>{effect.source_name || effect.type || ''}{effect.duration ? ` · ${effect.duration}` : ''}</div>
            </button>
          ))}
        </div>
        {row.type === 'player' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:7}}>
            <MiniButton onClick={() => onDeathSave(row, 'successes', 1)}>Save {row.death_saves?.successes || 0}</MiniButton>
            <MiniButton onClick={() => onDeathSave(row, 'failures', 1)}>Fail {row.death_saves?.failures || 0}</MiniButton>
          </div>
        )}
        <div style={{marginTop:7}}><MiniButton onClick={() => onRemove(row.id)} variant="danger">Remove</MiniButton></div>
      </div>
    </div>
  );
}

export default function EncounterRunnerModal({
  campaign,
  encounter,
  roster,
  monsters,
  onClose,
  onPatchData,
  onStatus,
  onDelete,
  onViewMonster,
  reloadCampaign,
}) {
  const data = encounter?.data || {};
  const combatants = sortedCombatants(encounter);
  const [monsterSearch, setMonsterSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [initiative, setInitiative] = useState('');
  const [sharedInitiative, setSharedInitiative] = useState(true);
  const [selectedTurnId, setSelectedTurnId] = useState(combatants[0]?.id || null);
  const [effectForm, setEffectForm] = useState({ type: 'condition', name: '', custom: '', source_id: '', target_id: '', duration: '1 min', concentration: false });

  const activeRoster = roster.filter(entry => entry.active);
  const filteredMonsters = monsters
    .filter(monster => !monsterSearch.trim() || monster.name.toLowerCase().includes(monsterSearch.toLowerCase()))
    .slice(0, 10);
  const effectOptions = useMemo(() => makeEffectOptions(activeRoster), [activeRoster]);
  const effectNames = effectOptions[effectForm.type] || [];

  const patchCombatants = nextCombatants => {
    const normalized = nextCombatants.map(normalizeCombatant);
    onPatchData(encounter.id, {
      ...data,
      combatants: normalized,
      initiative_order: normalized
        .sort((a, b) => initiativeValue(b.initiative) - initiativeValue(a.initiative))
        .map(row => row.id),
    });
  };

  const updateCombatant = (id, patch) => {
    patchCombatants((data.combatants || []).map(row => row.id === id ? normalizeCombatant({ ...row, ...patch }) : normalizeCombatant(row)));
  };

  const removeCombatant = id => {
    patchCombatants((data.combatants || []).filter(row => row.id !== id));
  };

  const addPartyMember = entry => {
    if ((data.combatants || []).some(row => sameId(row.character_id, entry.character_id))) return;
    patchCombatants([...(data.combatants || []), combatantFromRoster(entry)]);
  };

  const syncPartyStats = async () => {
    if (reloadCampaign) await reloadCampaign(campaign.id);
    const next = (data.combatants || []).map(row => {
      if (row.type !== 'player' || !row.character_id) return normalizeCombatant(row);
      const entry = activeRoster.find(candidate => sameId(candidate.character_id, row.character_id));
      if (!entry) return normalizeCombatant(row);
      return combatantFromRoster(entry, { ...row, initiative: row.initiative, effects: row.effects });
    });
    patchCombatants(next);
  };

  const addMonster = monster => {
    const qty = Math.max(1, Math.min(30, toNumber(quantity, 1)));
    const existingCount = (data.combatants || []).filter(row => row.monster_name === monster.name).length;
    const groupKey = `${monster.name}_${Date.now()}`;
    const added = Array.from({ length: qty }, (_, index) => normalizeCombatant({
      type: 'enemy',
      name: qty === 1 ? monster.name : `${monster.name} #${existingCount + index + 1}`,
      monster_name: monster.name,
      monster,
      group_key: sharedInitiative ? groupKey : `${groupKey}_${index}`,
      initiative,
      hp_current: monster.hit_points || 0,
      hp_max: monster.hit_points || 0,
      temp_hp: 0,
      ac: monster.armor_class || '',
    }));
    patchCombatants([...(data.combatants || []), ...added]);
  };

  const addEnemyToGroup = sample => {
    if (!sample?.monster) return;
    const groupRows = (data.combatants || []).filter(row => row.group_key === sample.group_key);
    const nextIndex = groupRows.length + 1;
    patchCombatants([...(data.combatants || []), normalizeCombatant({
      ...sample,
      id: combatantId(),
      name: `${sample.monster_name || sample.name} #${nextIndex}`,
      hp_current: sample.monster.hit_points || sample.hp_max || 0,
      hp_max: sample.monster.hit_points || sample.hp_max || 0,
      temp_hp: 0,
      conditions: [],
      effects: [],
      concentration: '',
    })]);
  };

  const removeEnemyFromGroup = sample => {
    const rows = data.combatants || [];
    const groupRows = rows.filter(row => row.group_key === sample.group_key);
    const last = groupRows[groupRows.length - 1];
    if (last) removeCombatant(last.id);
  };

  const addCondition = (row, condition) => {
    const conditions = cleanList(row.conditions);
    if (!conditions.includes(condition)) updateCombatant(row.id, { conditions: [...conditions, condition] });
  };

  const removeCondition = (row, condition) => {
    updateCombatant(row.id, { conditions: cleanList(row.conditions).filter(name => name !== condition) });
  };

  const removeEffect = (row, effect) => {
    updateCombatant(row.id, { effects: cleanList(row.effects).filter(entry => (entry.id || entry.name) !== (effect.id || effect.name)) });
  };

  const setDeathSave = (row, key, delta) => {
    const current = row.death_saves || { successes: 0, failures: 0 };
    updateCombatant(row.id, { death_saves: { ...current, [key]: Math.max(0, Math.min(3, toNumber(current[key], 0) + delta)) } });
  };

  const addEffectToTarget = () => {
    const target = combatants.find(row => row.id === effectForm.target_id);
    if (!target) return;
    const source = combatants.find(row => row.id === effectForm.source_id);
    const name = (effectForm.custom || effectForm.name || '').trim();
    if (!name) return;
    const effect = {
      id: combatantId(),
      name,
      type: effectForm.type,
      source_id: source?.id || '',
      source_name: source?.name || '',
      duration: effectForm.duration,
      concentration: effectForm.concentration,
    };
    const patch = { effects: [...cleanList(target.effects), effect] };
    if (effectForm.type === 'condition') {
      patch.conditions = cleanList(target.conditions).includes(name) ? cleanList(target.conditions) : [...cleanList(target.conditions), name];
    }
    const next = (data.combatants || []).map(row => {
      if (row.id === target.id) return normalizeCombatant({ ...row, ...patch });
      if (effectForm.concentration && source && row.id === source.id) return normalizeCombatant({ ...row, concentration: name });
      return normalizeCombatant(row);
    });
    patchCombatants(next);
    setEffectForm(form => ({ ...form, name: '', custom: '', target_id: '' }));
  };

  const groups = combatants
    .filter(row => row.type === 'enemy' && row.group_key)
    .reduce((acc, row) => {
      if (!acc[row.group_key]) acc[row.group_key] = { sample: row, count: 0 };
      acc[row.group_key].count += 1;
      return acc;
    }, {});

  const activeId = selectedTurnId || combatants[0]?.id;

  return (
    <div className="modal-overlay" style={{zIndex:2000}}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:'96vw',maxWidth:'none',height:'92vh',display:'flex',flexDirection:'column',padding:14}}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)',paddingBottom:10}}>
          <div>
            <h2 style={{marginBottom:2}}>Encounter Tracker: {encounter.name}</h2>
            <div style={{color:'var(--text-secondary)',fontSize:12}}>{combatants.length} combatants · {encounter.status}</div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            <MiniButton onClick={() => onStatus(encounter.id, 'running')} variant="success">Start</MiniButton>
            <MiniButton onClick={() => onStatus(encounter.id, encounter.status === 'paused' ? 'running' : 'paused')}>{encounter.status === 'paused' ? 'Resume' : 'Pause'}</MiniButton>
            <MiniButton onClick={() => onStatus(encounter.id, 'complete')}>Complete</MiniButton>
            <MiniButton onClick={syncPartyStats}>Sync PCs</MiniButton>
            <MiniButton onClick={() => onDelete(encounter.id)} variant="danger">Delete</MiniButton>
            <MiniButton onClick={onClose}>Close</MiniButton>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'320px minmax(0,1fr)',gap:12,minHeight:0,flex:1,marginTop:12}}>
          <aside style={{display:'flex',flexDirection:'column',gap:10,minHeight:0,overflowY:'auto',paddingRight:4}}>
            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Add Characters</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {activeRoster.map(entry => (
                  <MiniButton key={entry.id} onClick={() => addPartyMember(entry)} disabled={combatants.some(row => sameId(row.character_id, entry.character_id))}>{entry.name}</MiniButton>
                ))}
              </div>
            </section>

            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Add Enemies</div>
              <input value={monsterSearch} onChange={e => setMonsterSearch(e.target.value)} placeholder="Search bestiary" />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:6}}>
                <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qty" />
                <input value={initiative} onChange={e => setInitiative(e.target.value)} placeholder="Init" />
              </div>
              <label style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-secondary)',fontSize:12,margin:'8px 0'}}>
                <input type="checkbox" checked={sharedInitiative} onChange={e => setSharedInitiative(e.target.checked)} style={{width:'auto'}} />
                Shared initiative
              </label>
              <div style={{display:'flex',flexDirection:'column',gap:5,maxHeight:190,overflowY:'auto'}}>
                {filteredMonsters.map(monster => (
                  <button key={monster._custom_id ? `custom_${monster._custom_id}` : monster.name} type="button" className="btn btn-secondary btn-sm" onClick={() => addMonster(monster)} style={{textAlign:'left'}}>
                    {monster.name} <span style={{color:'var(--text-dim)'}}>CR {monster.challenge_rating}</span>
                  </button>
                ))}
              </div>
            </section>

            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Enemy Groups</div>
              {Object.keys(groups).length === 0 ? <div style={{color:'var(--text-dim)',fontSize:12}}>No grouped enemies yet.</div> : Object.entries(groups).map(([key, group]) => (
                <div key={key} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:6,alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{color:'var(--text-primary)',fontWeight:700,fontSize:12}}>{enemyGroupLabel(group.sample)} <span style={{color:'var(--text-dim)'}}>x{group.count}</span></div>
                  <MiniButton onClick={() => removeEnemyFromGroup(group.sample)}>-</MiniButton>
                  <MiniButton onClick={() => addEnemyToGroup(group.sample)}>+</MiniButton>
                </div>
              ))}
            </section>

            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Add Effect</div>
              <div style={{display:'grid',gap:6}}>
                <select value={effectForm.source_id} onChange={e => setEffectForm(f => ({ ...f, source_id: e.target.value }))}>
                  <option value="">Source</option>
                  {combatants.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <select value={effectForm.target_id} onChange={e => setEffectForm(f => ({ ...f, target_id: e.target.value }))}>
                  <option value="">Target</option>
                  {combatants.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
                <select value={effectForm.type} onChange={e => setEffectForm(f => ({ ...f, type: e.target.value, name: '', custom: '' }))}>
                  <option value="condition">Condition</option>
                  <option value="spell">Spell</option>
                  <option value="effect">Active Effect</option>
                  <option value="note">Custom/Note</option>
                </select>
                {effectNames.length > 0 ? (
                  <select value={effectForm.name} onChange={e => setEffectForm(f => ({ ...f, name: e.target.value, custom: '' }))}>
                    <option value="">Choose {effectForm.type}</option>
                    {effectNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                ) : null}
                <input value={effectForm.custom} onChange={e => setEffectForm(f => ({ ...f, custom: e.target.value }))} placeholder={effectNames.length ? 'Or custom effect' : 'Effect name'} />
                <input value={effectForm.duration} onChange={e => setEffectForm(f => ({ ...f, duration: e.target.value }))} placeholder="Duration" />
                <label style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-secondary)',fontSize:12}}>
                  <input type="checkbox" checked={effectForm.concentration} onChange={e => setEffectForm(f => ({ ...f, concentration: e.target.checked }))} style={{width:'auto'}} />
                  Concentration
                </label>
                <MiniButton onClick={addEffectToTarget} variant="primary" disabled={!effectForm.target_id || !(effectForm.name || effectForm.custom).trim()}>Add Effect</MiniButton>
              </div>
            </section>
          </aside>

          <main style={{display:'flex',flexDirection:'column',gap:10,minHeight:0,overflowY:'auto',paddingRight:4}}>
            <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',paddingBottom:4,borderBottom:'1px solid var(--border)'}}>
              <span style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase'}}>Initiative</span>
              {combatants.map(row => (
                <button key={row.id} type="button" onClick={() => setSelectedTurnId(row.id)} className={sameId(activeId, row.id) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
                  {row.initiative || '?'} {row.name}
                </button>
              ))}
            </div>
            {combatants.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:14,textAlign:'center',padding:60}}>Add characters and enemies to begin running this encounter.</div>
            ) : combatants.map(row => (
              <CombatantCard
                key={row.id}
                row={row}
                active={sameId(activeId, row.id)}
                onUpdate={updateCombatant}
                onRemove={removeCombatant}
                onViewMonster={onViewMonster}
                onAddCondition={addCondition}
                onRemoveCondition={removeCondition}
                onRemoveEffect={removeEffect}
                onDeathSave={setDeathSave}
              />
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}
