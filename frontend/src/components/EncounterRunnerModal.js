import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MonsterStatBlockContent } from './MonsterDetailModal';
import NumberPadPopover from './NumberPadPopover';

const COMMON_CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled',
  'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone',
  'Restrained', 'Stunned', 'Unconscious', 'Hexed', 'Blessed', 'Baned', 'Hasted', 'Slowed'
];

const COMMON_SPELL_EFFECTS = [
  'Bane', 'Bless', 'Charm Person', 'Command', 'Confusion', 'Dominate Person',
  'Faerie Fire', 'Fear', 'Hold Monster', 'Hold Person', 'Hex', 'Haste',
  'Hunter\'s Mark', 'Polymorph', 'Protection from Energy', 'Slow', 'Web'
];

const KNOWN_CONCENTRATION_EFFECTS = new Set([
  'bane', 'bless', 'blur', 'darkness', 'detect magic', 'enlarge/reduce',
  'faerie fire', 'fly', 'greater invisibility', 'haste', 'hex', 'hold person',
  'hunter’s mark', "hunter's mark", 'invisibility', 'polymorph', 'protection from energy',
  'slow', 'spirit guardians', 'summon shadowspawn', 'web'
]);

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

function isConcentrationEffect(name, manuallyFlagged = false) {
  return manuallyFlagged || KNOWN_CONCENTRATION_EFFECTS.has(String(name || '').trim().toLowerCase());
}

function modifierNumber(modifier) {
  const parsed = Number(modifier?.value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function campaignEffectHpBonus(snapshot) {
  const effects = cleanList(snapshot?.campaign_effects);
  return effects.reduce((sum, effect) => {
    const bonuses = cleanList(effect?.modifiers)
      .filter(modifier => modifier?.type === 'max_hp_bonus')
      .map(modifierNumber);
    return sum + (bonuses.length ? Math.max(...bonuses) : 0);
  }, 0);
}

function snapshotHpValues(snapshot, existing = {}) {
  const hp = snapshot?.hp || {};
  const bonus = campaignEffectHpBonus(snapshot);
  const fallbackMax = hp.max_override ?? hp.max ?? existing.hp_max ?? '';
  const baseMaxRaw = hp.campaign_base_max ?? hp.base_max ?? hp.max ?? (bonus && hp.max_override ? Number(hp.max_override) - bonus : fallbackMax);
  const max = baseMaxRaw === '' || baseMaxRaw == null ? fallbackMax : toNumber(baseMaxRaw) + bonus;
  const rawCurrent = hp.current ?? existing.hp_current ?? '';
  const current = rawCurrent === '' || max === '' ? rawCurrent : Math.min(toNumber(rawCurrent), toNumber(max));
  return {
    current,
    max,
    temp: hp.temp ?? existing.temp_hp ?? 0,
  };
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
  const hp = snapshotHpValues(snap, existing);
  const sheetEffects = cleanList(snap.active_effects).map(name => ({ id: `sheet_${name}`, name, type: 'sheet' }));
  const mergedEffects = [...sheetEffects, ...cleanList(existing.effects)].filter((effect, index, list) => {
    const key = effect.id || effect.name;
    return list.findIndex(item => (item.id || item.name) === key) === index;
  });
  return normalizeCombatant({
    ...existing,
    type: 'player',
    name: entry.name,
    character_id: entry.character_id,
    user_id: entry.user_id,
    group_key: 'Players',
    hp_current: hp.current,
    hp_max: hp.max,
    temp_hp: hp.temp,
    ac: snap.ac ?? existing.ac ?? '',
    conditions: cleanList(snap.conditions).length ? cleanList(snap.conditions) : cleanList(existing.conditions),
    concentration: concentrationText(snap) || existing.concentration || '',
    effects: mergedEffects,
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
    spell: [...new Set([...COMMON_SPELL_EFFECTS, ...spells])].sort((a, b) => a.localeCompare(b)),
    effect: [...new Set([...COMMON_CONDITIONS, ...COMMON_SPELL_EFFECTS, ...effects])].sort((a, b) => a.localeCompare(b)),
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
  const [openCalc, setOpenCalc] = useState(null);
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
  const applyTempDelta = delta => {
    onUpdate(row.id, { temp_hp: Math.max(0, toNumber(row.temp_hp, 0) + delta) });
  };
  return (
    <div style={{display:'grid',gridTemplateColumns:'26px minmax(82px,1fr) 26px',gap:5,alignItems:'center',position:'relative',minWidth:0}}>
      <MiniButton onClick={() => applyDelta(-1)} variant="danger">-</MiniButton>
      <div style={{textAlign:'center'}}>
        <button type="button" onClick={() => setOpenCalc(openCalc === 'current' ? null : 'current')} style={{background:'transparent',border:0,color:'var(--accent-light)',fontWeight:900,fontSize:16,cursor:'pointer',padding:0}}>
          {row.hp_current || 0}/{row.hp_max || '?'}
        </button>
        <button type="button" onClick={() => setOpenCalc(openCalc === 'temp' ? null : 'temp')} style={{display:'block',margin:'2px auto 0',background:'transparent',border:0,color:'var(--text-dim)',fontSize:11,cursor:'pointer',padding:0}}>
          Temp {row.temp_hp || 0}
        </button>
      </div>
      <MiniButton onClick={() => applyDelta(1)} variant="success">+</MiniButton>
      {openCalc === 'current' && (
        <NumberPadPopover label={`${row.name} HP`} value={row.hp_current || 0} color="var(--accent-light)" onApply={applyDelta} onClose={() => setOpenCalc(null)} />
      )}
      {openCalc === 'temp' && (
        <NumberPadPopover label={`${row.name} Temp HP`} value={row.temp_hp || 0} color="var(--accent-light)" onApply={applyTempDelta} onClose={() => setOpenCalc(null)} />
      )}
    </div>
  );
}

function CombatantCard({ row, active, onUpdate, onRemove, onViewMonster, onAddCondition, onRemoveCondition, onRemoveEffect, onDeathSave, rowRef }) {
  return (
    <div ref={rowRef} style={{
      border:active ? '2px solid var(--accent)' : '1px solid var(--border)',
      borderRadius:'var(--radius-sm)',
      background:active ? 'linear-gradient(90deg, rgba(124,92,252,0.24), rgba(30,41,78,0.92))' : 'var(--bg-secondary)',
      boxShadow:active ? '0 0 0 2px rgba(124,92,252,0.18), 0 0 24px rgba(124,92,252,0.2)' : 'none',
      padding:8,
      display:'grid',
      gridTemplateColumns:'minmax(260px,1.25fr) 150px minmax(300px,1.2fr) minmax(170px,0.65fr) auto',
      gridTemplateAreas:'"identity hp status effects actions"',
      gap:8,
      alignItems:'start',
      minWidth:0,
      scrollMarginTop:72,
    }}>
      <div style={{gridArea:'identity',display:'grid',gap:5,minWidth:0}}>
        <input value={row.name} onChange={e => onUpdate(row.id, { name: e.target.value })} style={{fontWeight:800,flex:'1 1 200px',minWidth:120}} />
        <div style={{display:'grid',gridTemplateColumns:'58px 58px auto',gap:6,alignItems:'end'}}>
          <label style={{display:'grid',gap:2,fontSize:10,color:'var(--text-dim)'}}>
            INIT
            <input value={row.initiative} onChange={e => onUpdate(row.id, { initiative: e.target.value })} style={{textAlign:'center',fontWeight:800}} />
          </label>
          <label style={{display:'grid',gap:2,fontSize:10,color:'var(--text-dim)'}}>
            AC
            <input value={row.ac} onChange={e => onUpdate(row.id, { ac: e.target.value })} style={{textAlign:'center',fontWeight:800}} />
          </label>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',minWidth:0}}>
            {row.monster && <MiniButton onClick={() => onViewMonster(row.monster)}>Stat</MiniButton>}
            <span style={{color:row.type === 'player' ? 'var(--success)' : 'var(--warning)',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>{row.type}</span>
          </div>
        </div>
        <div style={{color:'var(--text-dim)',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.group_key ? `Group: ${enemyGroupLabel(row)}` : 'No group'}</div>
      </div>

      <div style={{gridArea:'hp',alignSelf:'center',minWidth:0}}>
        <HpControls row={row} onUpdate={onUpdate} />
      </div>

      <div style={{gridArea:'status',minWidth:0}}>
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:6,marginBottom:5}}>
          <select onChange={e => { if (e.target.value) onAddCondition(row, e.target.value); e.target.value = ''; }} defaultValue="" style={{flex:'1 1 160px'}}>
            <option value="">Add condition</option>
            {COMMON_CONDITIONS.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <MiniButton onClick={() => onAddCondition(row, 'Concentrating')}>Con</MiniButton>
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',minHeight:24}}>
          {cleanList(row.conditions).length === 0 && <span style={{color:'var(--text-dim)',fontSize:12}}>No conditions</span>}
          {cleanList(row.conditions).map(condition => (
            <button key={condition} type="button" onClick={() => onRemoveCondition(row, condition)} style={{border:'1px solid rgba(230,57,70,0.65)',background:'rgba(230,57,70,0.24)',color:'var(--text-primary)',borderRadius:4,padding:'3px 6px',fontSize:11,cursor:'pointer',fontWeight:800}}>
              {condition} x
            </button>
          ))}
        </div>
        <div style={{marginTop:5,display:'grid',gridTemplateColumns:'82px minmax(0,1fr)',gap:5,alignItems:'center'}}>
          <label style={{fontSize:10,color:'var(--text-dim)'}}>CONCENTRATION</label>
          <input value={row.concentration} onChange={e => onUpdate(row.id, { concentration: e.target.value })} placeholder="Spell or effect" />
        </div>
      </div>

      <div style={{gridArea:'effects',minWidth:0}}>
        <div style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,marginBottom:4}}>EFFECTS</div>
        <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:54,overflowY:'auto'}}>
          {cleanList(row.effects).length === 0 && <span style={{color:'var(--text-dim)',fontSize:12}}>None</span>}
          {cleanList(row.effects).map(effect => (
            <button key={effect.id || effect.name} type="button" onClick={() => onRemoveEffect(row, effect)} style={{textAlign:'left',border:'1px solid rgba(230,57,70,0.55)',background:'rgba(230,57,70,0.18)',color:'var(--text-primary)',borderRadius:4,padding:5,cursor:'pointer'}}>
              <div style={{fontWeight:700,fontSize:12}}>{effect.name}</div>
              <div style={{color:'var(--text-dim)',fontSize:10}}>{effect.source_name || effect.type || ''}{effect.duration ? ` · ${effect.duration}` : ''}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{gridArea:'actions',display:'flex',gap:5,flexDirection:'column',alignItems:'stretch',minWidth:94}}>
          {row.type === 'player' && (
            <>
            <div style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Death Saves</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
              <MiniButton onClick={() => onDeathSave(row, 'successes', 1)}>Pass {row.death_saves?.successes || 0}</MiniButton>
              <MiniButton onClick={() => onDeathSave(row, 'failures', 1)}>Fail {row.death_saves?.failures || 0}</MiniButton>
            </div>
            </>
          )}
          <MiniButton onClick={() => onRemove(row.id)} variant="danger">Remove</MiniButton>
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
  reloadCampaign,
}) {
  const data = encounter?.data || {};
  const combatants = sortedCombatants(encounter);
  const [monsterSearch, setMonsterSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [initiative, setInitiative] = useState('');
  const [sharedInitiative, setSharedInitiative] = useState(true);
  const [selectedTurnId, setSelectedTurnId] = useState(combatants[0]?.id || null);
  const [viewingMonster, setViewingMonster] = useState(null);
  const [effectForm, setEffectForm] = useState({ type: 'condition', name: '', custom: '', source_id: '', target_ids: [], duration: '1 min', concentration: false });
  const rowRefs = useRef({});
  const dataRef = useRef(data);
  dataRef.current = data;

  const activeRoster = roster.filter(entry => entry.active);
  const filteredMonsters = monsters
    .filter(monster => !monsterSearch.trim() || monster.name.toLowerCase().includes(monsterSearch.toLowerCase()));
  const effectOptions = useMemo(() => makeEffectOptions(activeRoster), [activeRoster]);
  const effectNames = effectOptions[effectForm.type] || [];

  const patchCombatants = nextCombatants => {
    const baseData = dataRef.current || {};
    const normalized = nextCombatants.map(normalizeCombatant);
    const nextData = {
      ...baseData,
      combatants: normalized,
      initiative_order: normalized
        .sort((a, b) => initiativeValue(b.initiative) - initiativeValue(a.initiative))
        .map(row => row.id),
    };
    dataRef.current = nextData;
    onPatchData(encounter.id, nextData);
  };

  const updateCombatant = (id, patch) => {
    const currentRows = dataRef.current?.combatants || [];
    patchCombatants(currentRows.map(row => row.id === id ? normalizeCombatant({ ...row, ...patch }) : normalizeCombatant(row)));
  };

  const removeCombatant = id => {
    const currentRows = dataRef.current?.combatants || [];
    patchCombatants(currentRows.filter(row => row.id !== id));
  };

  const addPartyMember = entry => {
    const currentRows = dataRef.current?.combatants || [];
    if (currentRows.some(row => sameId(row.character_id, entry.character_id))) return;
    patchCombatants([...currentRows, combatantFromRoster(entry)]);
  };

  const syncPartyStats = async () => {
    const freshCampaign = reloadCampaign ? await reloadCampaign(campaign.id) : null;
    const sourceRoster = (freshCampaign?.characters || roster || []).filter(entry => entry.active);
    const currentRows = dataRef.current?.combatants || [];
    const next = currentRows.map(row => {
      if (row.type !== 'player' || !row.character_id) return normalizeCombatant(row);
      const entry = sourceRoster.find(candidate => sameId(candidate.character_id, row.character_id));
      if (!entry) return normalizeCombatant(row);
      return combatantFromRoster(entry, { ...row, initiative: row.initiative, effects: row.effects });
    });
    patchCombatants(next);
  };

  useEffect(() => {
    if (encounter.status !== 'running' || !reloadCampaign) return undefined;
    syncPartyStats().catch(() => {});
    const timer = setInterval(() => {
      syncPartyStats().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [encounter.id, encounter.status, reloadCampaign]);

  const focusCombatant = id => {
    setSelectedTurnId(id);
    window.requestAnimationFrame(() => {
      rowRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const addMonster = monster => {
    const currentRows = dataRef.current?.combatants || [];
    const qty = Math.max(1, Math.min(30, toNumber(quantity, 1)));
    const existingCount = currentRows.filter(row => row.monster_name === monster.name).length;
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
    patchCombatants([...currentRows, ...added]);
  };

  const addEnemyToGroup = sample => {
    if (!sample?.monster) return;
    const currentRows = dataRef.current?.combatants || [];
    const groupRows = currentRows.filter(row => row.group_key === sample.group_key);
    const nextIndex = groupRows.length + 1;
    patchCombatants([...currentRows, normalizeCombatant({
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
    const rows = dataRef.current?.combatants || [];
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
    const currentRows = dataRef.current?.combatants || [];
    const next = currentRows.map(entry => {
      const normalized = normalizeCombatant(entry);
      if (normalized.id === row.id) {
        return normalizeCombatant({
          ...normalized,
          effects: cleanList(normalized.effects).filter(item => (item.id || item.name) !== (effect.id || effect.name)),
        });
      }
      if (effect.concentration && effect.source_id && normalized.id === effect.source_id && normalized.concentration === effect.name) {
        return normalizeCombatant({ ...normalized, concentration: '' });
      }
      return normalized;
    });
    patchCombatants(next);
  };

  const setDeathSave = (row, key, delta) => {
    const current = row.death_saves || { successes: 0, failures: 0 };
    updateCombatant(row.id, { death_saves: { ...current, [key]: Math.max(0, Math.min(3, toNumber(current[key], 0) + delta)) } });
  };

  const toggleEffectTarget = id => {
    setEffectForm(form => {
      const targets = cleanList(form.target_ids);
      return {
        ...form,
        target_ids: targets.includes(id)
          ? targets.filter(targetId => targetId !== id)
          : [...targets, id],
      };
    });
  };

  const addEffectToTarget = () => {
    const targets = combatants.filter(row => cleanList(effectForm.target_ids).includes(row.id));
    if (!targets.length) return;
    const source = combatants.find(row => row.id === effectForm.source_id);
    const name = (effectForm.custom || effectForm.name || '').trim();
    if (!name) return;
    const concentration = isConcentrationEffect(name, effectForm.concentration);
    const effect = {
      id: combatantId(),
      name,
      type: effectForm.type,
      source_id: source?.id || '',
      source_name: source?.name || '',
      duration: effectForm.duration,
      concentration,
    };
    const currentRows = dataRef.current?.combatants || [];
    const next = currentRows.map(row => {
      let nextRow = normalizeCombatant(row);
      if (targets.some(target => target.id === nextRow.id)) {
        const patch = { effects: [...cleanList(nextRow.effects), effect] };
        if (effectForm.type === 'condition') {
          patch.conditions = cleanList(nextRow.conditions).includes(name) ? cleanList(nextRow.conditions) : [...cleanList(nextRow.conditions), name];
        }
        nextRow = normalizeCombatant({ ...nextRow, ...patch });
      }
      if (concentration && source && nextRow.id === source.id) nextRow = normalizeCombatant({ ...nextRow, concentration: name });
      return nextRow;
    });
    patchCombatants(next);
    setEffectForm(form => ({ ...form, name: '', custom: '', target_ids: [], concentration: false }));
  };

  const groups = combatants
    .filter(row => row.type === 'enemy' && row.group_key)
    .reduce((acc, row) => {
      if (!acc[row.group_key]) acc[row.group_key] = { sample: row, count: 0 };
      acc[row.group_key].count += 1;
      return acc;
    }, {});

  const activeId = selectedTurnId || combatants[0]?.id;
  const primaryStatusAction = encounter.status === 'running'
    ? { label: 'Stop', status: 'paused', variant: 'danger' }
    : { label: encounter.status === 'paused' ? 'Resume' : 'Start', status: 'running', variant: 'success' };

  return (
    <div className="modal-overlay" style={{zIndex:2600,background:'var(--bg-primary)',padding:0}}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:'100vw',maxWidth:'none',height:'100vh',borderRadius:0,border:0,display:'flex',flexDirection:'column',padding:14,background:'var(--bg-primary)'}}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)',paddingBottom:10}}>
          <div>
            <h2 style={{marginBottom:2}}>Encounter Tracker: {encounter.name}</h2>
            <div style={{color:'var(--text-secondary)',fontSize:12}}>{combatants.length} combatants · {encounter.status}</div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            <MiniButton onClick={() => onStatus(encounter.id, primaryStatusAction.status)} variant={primaryStatusAction.variant}>{primaryStatusAction.label}</MiniButton>
            <MiniButton onClick={() => onStatus(encounter.id, 'complete')}>Conclude Encounter</MiniButton>
            <MiniButton onClick={syncPartyStats}>Sync PCs</MiniButton>
            <MiniButton onClick={() => onDelete(encounter.id)} variant="danger">Delete</MiniButton>
            <MiniButton onClick={onClose}>Close</MiniButton>
          </div>
        </div>

        <div style={{
          display:'grid',
          gridTemplateColumns:viewingMonster ? '260px minmax(720px,1fr) minmax(420px,0.72fr)' : '300px minmax(760px,1fr)',
          // Without an explicit row template, a single implicit grid row defaults to
          // grid-auto-rows: auto, which sizes to its TALLEST child's natural content
          // height rather than respecting the container's own bounded height from
          // flex:1 above - so every column (including this aside) stretches to match
          // that overflowed height, and the aside's own overflowY:auto never actually
          // engages because it's never shorter than its content. minmax(0,1fr) forces
          // the row to fill the container's actual available height instead, which is
          // what makes the bestiary list's overflowY:auto below finally scroll instead
          // of just growing the whole page taller.
          gridTemplateRows:'minmax(0,1fr)',
          gap:12,
          minHeight:0,
          flex:1,
          marginTop:12,
          overflow:'auto',
        }}>
          <aside style={{display:'flex',flexDirection:'column',gap:8,minHeight:0,overflow:'hidden',paddingRight:4}}>
            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Add Characters</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {activeRoster.map(entry => (
                  <MiniButton key={entry.id} onClick={() => addPartyMember(entry)} disabled={combatants.some(row => sameId(row.character_id, entry.character_id))}>{entry.name}</MiniButton>
                ))}
              </div>
            </section>

            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:8,display:'flex',flexDirection:'column',minHeight:0,flex:'1 1 320px',overflow:'hidden'}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Add Enemies</div>
              <input value={monsterSearch} onChange={e => setMonsterSearch(e.target.value)} placeholder="Search bestiary" />
              <div style={{display:'grid',gridTemplateColumns:'32px 1fr 32px 1fr',gap:6,marginTop:6}}>
                <MiniButton onClick={() => setQuantity(String(Math.max(1, toNumber(quantity, 1) - 1)))}>-</MiniButton>
                <input value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qty" style={{textAlign:'center'}} />
                <MiniButton onClick={() => setQuantity(String(Math.min(30, toNumber(quantity, 1) + 1)))}>+</MiniButton>
                <input value={initiative} onChange={e => setInitiative(e.target.value)} placeholder="Init" />
              </div>
              <label style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-secondary)',fontSize:12,margin:'8px 0'}}>
                <input type="checkbox" checked={sharedInitiative} onChange={e => setSharedInitiative(e.target.checked)} style={{width:'auto'}} />
                Shared initiative
              </label>
              <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:5}}>{filteredMonsters.length} monster{filteredMonsters.length === 1 ? '' : 's'}</div>
              <div style={{flex:1,minHeight:120,overflowY:'auto',paddingRight:3,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'rgba(0,0,0,0.12)'}}>
                {filteredMonsters.map(monster => (
                  <button key={monster._custom_id ? `custom_${monster._custom_id}` : monster.name} type="button" onClick={() => addMonster(monster)} style={{display:'flex',justifyContent:'space-between',gap:8,width:'100%',textAlign:'left',border:0,borderBottom:'1px solid var(--border)',background:'transparent',color:'var(--text-primary)',padding:'7px 8px',cursor:'pointer',fontWeight:700}}>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{monster.name}</span>
                    <span style={{color:'var(--text-dim)',whiteSpace:'nowrap'}}>CR {monster.challenge_rating}</span>
                  </button>
                ))}
              </div>
            </section>

            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:8,flex:'0 0 auto'}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Enemy Groups</div>
              {Object.keys(groups).length === 0 ? <div style={{color:'var(--text-dim)',fontSize:12}}>No grouped enemies yet.</div> : Object.entries(groups).map(([key, group]) => (
                <div key={key} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:6,alignItems:'center',padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{color:'var(--text-primary)',fontWeight:700,fontSize:12}}>{enemyGroupLabel(group.sample)} <span style={{color:'var(--text-dim)'}}>x{group.count}</span></div>
                  <MiniButton onClick={() => removeEnemyFromGroup(group.sample)}>-</MiniButton>
                  <MiniButton onClick={() => addEnemyToGroup(group.sample)}>+</MiniButton>
                </div>
              ))}
            </section>

            <section style={{border:'1px solid rgba(230,57,70,0.38)',borderRadius:'var(--radius-sm)',padding:8,background:'rgba(230,57,70,0.08)',flex:'0 0 auto'}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Add Effect</div>
              <div style={{display:'grid',gap:6}}>
                <select value={effectForm.source_id} onChange={e => setEffectForm(f => ({ ...f, source_id: e.target.value }))}>
                  <option value="">Source</option>
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
                <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:6,display:'flex',gap:5,flexWrap:'wrap',maxHeight:86,overflowY:'auto'}}>
                  {combatants.map(row => {
                    const selected = cleanList(effectForm.target_ids).includes(row.id);
                    return (
                      <button key={row.id} type="button" className={selected ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => toggleEffectTarget(row.id)}>
                        {row.name}
                      </button>
                    );
                  })}
                </div>
                <MiniButton onClick={addEffectToTarget} variant="primary" disabled={!cleanList(effectForm.target_ids).length || !(effectForm.name || effectForm.custom).trim()}>Add Effect</MiniButton>
              </div>
            </section>
          </aside>

          <main style={{display:'flex',flexDirection:'column',gap:10,minHeight:0,overflowY:'auto',paddingRight:4}}>
            <div style={{position:'sticky',top:0,zIndex:3,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',padding:'6px 0',borderBottom:'1px solid var(--border)',background:'var(--bg-primary)'}}>
              <span style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase'}}>Initiative</span>
              {combatants.map(row => (
                <button key={row.id} type="button" onClick={() => focusCombatant(row.id)} className={sameId(activeId, row.id) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
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
                rowRef={element => { rowRefs.current[row.id] = element; }}
                active={sameId(activeId, row.id)}
                onUpdate={updateCombatant}
                onRemove={removeCombatant}
                onViewMonster={(monster) => {
                  focusCombatant(row.id);
                  setViewingMonster(monster);
                }}
                onAddCondition={addCondition}
                onRemoveCondition={removeCondition}
                onRemoveEffect={removeEffect}
                onDeathSave={setDeathSave}
              />
            ))}
          </main>

          {viewingMonster && (
            <aside style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-secondary)',minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',padding:'10px 12px',borderBottom:'1px solid var(--border)',background:'rgba(0,0,0,0.18)'}}>
                <div style={{minWidth:0}}>
                  <h3 style={{color:'var(--accent-light)',fontSize:17,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{viewingMonster.name}</h3>
                  <div style={{color:'var(--text-dim)',fontSize:12,fontStyle:'italic'}}>
                    {viewingMonster.size} {viewingMonster.type}{viewingMonster.subtype ? ` (${viewingMonster.subtype})` : ''}, {viewingMonster.alignment}
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:5}}>
                    <span style={{color:'var(--warning)',fontSize:11,fontWeight:800}}>CR {viewingMonster.challenge_rating}</span>
                    {viewingMonster.source && <span style={{color:'var(--text-dim)',fontSize:11}}>{viewingMonster.source}</span>}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => setViewingMonster(null)}>X</button>
              </div>
              <div style={{padding:12,overflowY:'auto',minHeight:0}}>
                <MonsterStatBlockContent monster={viewingMonster} />
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
