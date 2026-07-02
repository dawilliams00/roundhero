import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MonsterStatBlockContent } from './MonsterDetailModal';
import NumberPadPopover from './NumberPadPopover';
import api from '../utils/api';

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

const COMMON_TRIGGERED_EFFECTS = [
  'Booming Blade', 'Cloud of Daggers', 'Moonbeam', 'Spike Growth', 'Spirit Guardians'
];

const KNOWN_CONCENTRATION_EFFECTS = new Set([
  'bane', 'bless', 'blur', 'darkness', 'detect magic', 'enlarge/reduce',
  'faerie fire', 'fly', 'greater invisibility', 'haste', 'hex', 'hold person',
  'hunter’s mark', "hunter's mark", 'invisibility', 'polymorph', 'protection from energy',
  'slow', 'spirit guardians', 'summon shadowspawn', 'web'
]);

const SAVE_ABILITIES = {
  STR: 'strength',
  STRENGTH: 'strength',
  DEX: 'dexterity',
  DEXTERITY: 'dexterity',
  CON: 'constitution',
  CONSTITUTION: 'constitution',
  INT: 'intelligence',
  INTELLIGENCE: 'intelligence',
  WIS: 'wisdom',
  WISDOM: 'wisdom',
  CHA: 'charisma',
  CHARISMA: 'charisma',
};

const SPELL_SAVE_FALLBACKS = {
  burninghands: 'DEX',
  chainlightning: 'DEX',
  coneofcold: 'CON',
  disintegrate: 'DEX',
  fireball: 'DEX',
  flamestrike: 'DEX',
  lightningbolt: 'DEX',
  meteorswarm: 'DEX',
  sacredflame: 'DEX',
  shatter: 'CON',
  sickeningradiance: 'CON',
  slow: 'WIS',
  synapticstatic: 'INT',
  thunderwave: 'CON',
  web: 'DEX',
};

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

function rollDiceFormula(formula) {
  const match = String(formula || '').trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;
  const count = Math.max(1, Math.min(40, toNumber(match[1] || 1, 1)));
  const sides = Math.max(2, Math.min(100, toNumber(match[2], 6)));
  const bonus = match[3] ? toNumber(match[4], 0) * (match[3] === '-' ? -1 : 1) : 0;
  const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  return {
    rolls,
    bonus,
    total: Math.max(0, rolls.reduce((sum, roll) => sum + roll, 0) + bonus),
  };
}

function abilityModifier(score) {
  return Math.floor((toNumber(score, 10) - 10) / 2);
}

function saveAbilityKey(saveType) {
  return SAVE_ABILITIES[String(saveType || '').trim().toUpperCase()] || '';
}

function normalizedSpellName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function inferredSaveType(event) {
  return event?.save_type || event?.save_ability || SPELL_SAVE_FALLBACKS[normalizedSpellName(event?.label)] || '';
}

function saveModifierForRow(row, saveType) {
  const ability = saveAbilityKey(saveType);
  if (!ability) return null;
  const candidates = [row?.monster, row?.snapshot, row];
  for (const source of candidates) {
    const saves = source?.saves;
    if (saves && typeof saves === 'object') {
      const direct = saves[ability] ?? saves[ability.slice(0, 3)] ?? saves[ability.toUpperCase()] ?? saves[ability.slice(0, 3).toUpperCase()];
      if (direct !== undefined && direct !== '') return toNumber(direct, 0);
    }
  }
  for (const source of candidates) {
    const scores = source?.ability_scores || source?.abilities;
    if (scores && typeof scores === 'object') {
      const score = scores[ability] ?? scores[ability.slice(0, 3)] ?? scores[ability.toUpperCase()] ?? scores[ability.slice(0, 3).toUpperCase()];
      if (score !== undefined && score !== '') return abilityModifier(score);
    }
  }
  return null;
}

function deathSaveResultLabel(result) {
  return {
    critical_success: 'Natural 20',
    critical_failure: 'Natural 1',
    success: 'Success',
    failure: 'Failure',
  }[result] || result || '';
}

function deathSaveCounts(row) {
  const saves = row?.death_saves || {};
  return {
    successes: toNumber(saves.successes, 0),
    failures: toNumber(saves.failures, 0),
  };
}

function isDeadCombatant(row) {
  return !!row?.dead || deathSaveCounts(row).failures >= 3;
}

function isInDeathSaves(row) {
  if (row?.type !== 'player' || isDeadCombatant(row)) return false;
  const saves = deathSaveCounts(row);
  return toNumber(row.hp_current, 0) <= 0 || saves.successes > 0 || saves.failures > 0;
}

function conditionHint(condition) {
  const key = String(condition || '').trim().toLowerCase();
  const hints = {
    baned: 'Bane: subtract 1d4 from attack rolls and saving throws while the spell lasts.',
    blessed: 'Bless: add 1d4 to attack rolls and saving throws while the spell lasts.',
    hasted: 'Haste: extra limited action, doubled speed, +2 AC, advantage on Dexterity saves. Lethargy applies when it ends.',
    hexed: 'Hex: extra necrotic damage from the caster and disadvantage on one chosen ability check type.',
    lethargic: 'Haste ended: cannot move or take actions until after the next turn.',
    slowed: 'Slow: reduced speed/AC/Dex saves and limited actions while the spell lasts.',
    unconscious: 'Unconscious: incapacitated, drops prone, auto-fails STR/DEX saves, nearby attacks can crit.',
  };
  return hints[key] || `${condition}: click to remove from this encounter row.`;
}

function isConcentrationEffect(name, manuallyFlagged = false) {
  return manuallyFlagged || KNOWN_CONCENTRATION_EFFECTS.has(String(name || '').trim().toLowerCase());
}

function isTriggeredEffect(effect) {
  return effect?.type === 'triggered' || !!effect?.trigger;
}

function triggeredEffectDefaults(name) {
  const key = String(name || '').trim().toLowerCase();
  if (key === 'booming blade') {
    return {
      trigger: 'Movement',
      damage_formula: '1d8',
      damage_type: 'Thunder',
      duration: 'Until start of caster next turn',
      remove_on_trigger: true,
      notes: 'If the target willingly moves 5 feet or more before then, trigger this damage.',
    };
  }
  if (key === 'spike growth') {
    return {
      trigger: 'Movement',
      damage_formula: '2d4',
      damage_type: 'Piercing',
      duration: 'Concentration',
      remove_on_trigger: false,
      notes: 'Damage is normally per 5 feet traveled through the area.',
    };
  }
  if (key === 'cloud of daggers') {
    return {
      trigger: 'Turn start / enter area',
      damage_formula: '4d4',
      damage_type: 'Slashing',
      duration: 'Concentration',
      remove_on_trigger: false,
      notes: 'Trigger when the creature enters the area for the first time on a turn or starts there.',
    };
  }
  if (key === 'moonbeam') {
    return {
      trigger: 'Turn start / enter area',
      damage_formula: '2d10',
      damage_type: 'Radiant',
      duration: 'Concentration',
      remove_on_trigger: false,
      notes: 'Usually requires a Constitution save; use this as a reminder/manual damage trigger.',
    };
  }
  if (key === 'spirit guardians') {
    return {
      trigger: 'Turn start / enter area',
      damage_formula: '3d8',
      damage_type: 'Radiant/Necrotic',
      duration: 'Concentration',
      remove_on_trigger: false,
      notes: 'Usually requires a Wisdom save; use this as a reminder/manual damage trigger.',
    };
  }
  return {
    trigger: 'Manual trigger',
    damage_formula: '1d8',
    damage_type: 'Damage',
    duration: '1 round',
    remove_on_trigger: true,
    notes: '',
  };
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
    last_death_save: row.last_death_save || null,
    death_save_rolls: cleanList(row.death_save_rolls),
    hidden_from_players: !!row.hidden_from_players,
    dead: !!row.dead,
    group_key: row.group_key || '',
    monster_name: row.monster_name || '',
    monster: row.monster || null,
    notes: row.notes || '',
    user_id: row.user_id || null,
    character_id: row.character_id || null,
    snapshot: row.snapshot || null,
  };
}

function findFreshEncounterData(campaign, encounterId) {
  const fresh = cleanList(campaign?.encounters).find(entry => sameId(entry.id, encounterId));
  return fresh?.data || null;
}

function mergeDeathSaveState(localRow, serverRow) {
  if (!serverRow) return localRow;
  return normalizeCombatant({
    ...localRow,
    death_saves: serverRow.death_saves || localRow.death_saves,
    last_death_save: serverRow.last_death_save || localRow.last_death_save,
    death_save_rolls: cleanList(serverRow.death_save_rolls).length ? serverRow.death_save_rolls : localRow.death_save_rolls,
  });
}

function combatantsChanged(before = [], after = []) {
  return JSON.stringify(before.map(normalizeCombatant)) !== JSON.stringify(after.map(normalizeCombatant));
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
  const encounterOnlyEffects = cleanList(existing.effects).filter(effect => {
    const id = effect?.id || '';
    return effect?.type !== 'sheet' && !String(id).startsWith('sheet_');
  });
  const mergedEffects = [...sheetEffects, ...encounterOnlyEffects].filter((effect, index, list) => {
    const key = effect.id || effect.name;
    return list.findIndex(item => (item.id || item.name) === key) === index;
  });
  const con = concentrationText(snap);
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
    conditions: cleanList(snap.conditions),
    concentration: con || '',
    effects: mergedEffects,
    snapshot: snap,
  });
}

function enemyGroupLabel(row) {
  if (!row.group_key) return row.monster_name || row.name;
  return row.group_key.split('_')[0] || row.monster_name || row.name;
}

function monsterForRow(row, monsters) {
  if (row.monster) return row.monster;
  const names = [
    row.monster_name,
    enemyGroupLabel(row),
    String(row.name || '').replace(/\s+#\d+$/, ''),
  ].filter(Boolean).map(name => String(name).trim().toLowerCase());
  return monsters.find(monster => names.includes(String(monster.name || '').trim().toLowerCase())) || null;
}

function RulePopup({ title, text, onClose }) {
  return (
    <div style={{
      position:'absolute',
      top:58,
      right:14,
      zIndex:12,
      width:'min(480px, calc(100vw - 32px))',
      border:'1px solid rgba(154,128,255,0.45)',
      borderRadius:'var(--radius-md)',
      background:'linear-gradient(180deg, rgba(26,25,48,0.98), rgba(13,17,34,0.98))',
      boxShadow:'0 18px 60px rgba(0,0,0,0.62)',
      padding:12,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',borderBottom:'1px solid var(--border)',paddingBottom:8,marginBottom:10}}>
        <div style={{color:'var(--accent-light)',fontFamily:"'Cinzel',serif",fontWeight:800}}>{title}</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>
      <div style={{color:text ? 'var(--text-secondary)' : 'var(--text-dim)',fontSize:13,lineHeight:1.55,whiteSpace:'pre-wrap'}}>
        {text || 'No campaign rule text has been set yet.'}
      </div>
    </div>
  );
}

function EncounterActionPopup({ event, targetRow, onResolveSave, onClose }) {
  const [manualRoll, setManualRoll] = useState('');
  const [rolled, setRolled] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saveType = inferredSaveType(event);
  const saveMod = saveModifierForRow(targetRow, saveType);
  const isPendingSave = event.pending && event.mode === 'save';
  const damageLines = cleanList(event.damage_details)
    .map(detail => `${detail.damage_type || 'damage'}: ${detail.amount} -> ${detail.applied} (${detail.rule})`);

  const rollDigitally = () => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const mod = saveMod ?? 0;
    const total = d20 + mod;
    setRolled({ d20, mod, total });
    setManualRoll(String(total));
  };

  const submit = async () => {
    if (!manualRoll) return;
    setSaving(true);
    setError('');
    try {
      await onResolveSave(event, manualRoll);
    } catch (err) {
      setError(err.message || 'Could not resolve save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position:'absolute',
      top:58,
      right:14,
      zIndex:13,
      width:'min(520px, calc(100vw - 32px))',
      border:'1px solid rgba(154,128,255,0.55)',
      borderRadius:'var(--radius-md)',
      background:'linear-gradient(180deg, rgba(26,25,48,0.98), rgba(13,17,34,0.98))',
      boxShadow:'0 18px 60px rgba(0,0,0,0.62)',
      padding:12,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',borderBottom:'1px solid var(--border)',paddingBottom:8,marginBottom:10}}>
        <div style={{color:'var(--accent-light)',fontFamily:"'Cinzel',serif",fontWeight:800}}>Encounter Action</div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
      </div>

      <div style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.5}}>
        <div><b>{event.source_name || 'A combatant'}</b> used <b>{event.label || 'an action'}</b> on <b>{event.target_name || 'a target'}</b>.</div>
        {!isPendingSave && (
          <div style={{marginTop:6}}>
            {event.hit === false ? 'Miss. No damage applied.' : `${event.damage_applied || 0} damage applied.`}
            {damageLines.length > 0 && <div style={{whiteSpace:'pre-wrap',marginTop:4}}>{damageLines.join('\n')}</div>}
          </div>
        )}
      </div>

      {isPendingSave && (
        <div style={{borderTop:'1px solid var(--border)',marginTop:10,paddingTop:10,display:'grid',gap:8}}>
          <div style={{color:'var(--warning)',fontWeight:800}}>
            {saveType ? `${saveType} save` : 'Saving throw'} needed vs DC {event.save_dc || '?'} before HP changes.
          </div>
          <div style={{color:'var(--text-dim)',fontSize:12}}>
            Target: {event.target_name || targetRow?.name || 'Target'}
            {saveMod !== null && <> · Save modifier {saveMod >= 0 ? '+' : ''}{saveMod}</>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,alignItems:'center'}}>
            <input
              value={manualRoll}
              onChange={e => setManualRoll(e.target.value)}
              placeholder="Save total"
              style={{fontWeight:800}}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={rollDigitally} disabled={!saveType || saveMod === null}>
              Roll {saveType || 'Save'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={saving || !manualRoll}>
              {saving ? 'Resolving...' : 'Resolve Save'}
            </button>
          </div>
          {rolled && (
            <div style={{color:'var(--text-secondary)',fontSize:12}}>
              Rolled d20 {rolled.d20} {rolled.mod >= 0 ? '+' : ''}{rolled.mod} = <b>{rolled.total}</b>
            </div>
          )}
          {!saveType && (
            <div style={{color:'var(--text-dim)',fontSize:12}}>Save type was not included by the character sheet yet, so digital roll is disabled. Enter the total manually.</div>
          )}
          {saveType && saveMod === null && (
            <div style={{color:'var(--text-dim)',fontSize:12}}>No {saveType} save modifier was found for this target. Enter the total manually.</div>
          )}
          {error && <div style={{color:'var(--danger)',fontSize:12}}>{error}</div>}
        </div>
      )}
    </div>
  );
}

function PendingSaveResolver({ event, row, onResolveSave }) {
  const [manualRoll, setManualRoll] = useState('');
  const [rolled, setRolled] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const saveType = inferredSaveType(event);
  const saveMod = saveModifierForRow(row, saveType);

  const rollDigitally = () => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const mod = saveMod ?? 0;
    const total = d20 + mod;
    setRolled({ d20, mod, total });
    setManualRoll(String(total));
  };

  const submit = async () => {
    if (!manualRoll) return;
    setSaving(true);
    setError('');
    try {
      await onResolveSave(event, manualRoll);
    } catch (err) {
      setError(err.message || 'Could not resolve save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      border:'1px solid rgba(255,193,7,0.7)',
      background:'rgba(255,193,7,0.12)',
      borderRadius:5,
      padding:6,
      display:'grid',
      gap:5,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
        <div style={{color:'var(--warning)',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>
          {event.label || 'Save'} {saveType ? `${saveType} save` : 'save'} DC {event.save_dc || '?'}
        </div>
        {saveMod !== null && <div style={{color:'var(--text-secondary)',fontSize:11}}>mod {saveMod >= 0 ? '+' : ''}{saveMod}</div>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto auto',gap:5}}>
        <input
          value={manualRoll}
          onChange={e => setManualRoll(e.target.value)}
          placeholder="Save total"
          style={{height:28,fontSize:12,fontWeight:800}}
        />
        <MiniButton onClick={rollDigitally} disabled={!saveType || saveMod === null}>Roll</MiniButton>
        <MiniButton onClick={submit} variant="primary" disabled={saving || !manualRoll}>
          {saving ? '...' : 'Resolve'}
        </MiniButton>
      </div>
      {rolled && <div style={{color:'var(--text-secondary)',fontSize:11}}>d20 {rolled.d20} {rolled.mod >= 0 ? '+' : ''}{rolled.mod} = {rolled.total}</div>}
      {!saveType && <div style={{color:'var(--text-dim)',fontSize:11}}>Manual only until save type is known.</div>}
      {saveType && saveMod === null && <div style={{color:'var(--text-dim)',fontSize:11}}>Manual only: no target save modifier found.</div>}
      {error && <div style={{color:'var(--danger)',fontSize:11}}>{error}</div>}
    </div>
  );
}

function TriggeredEffectResolver({ effect, row, onTriggerEffect }) {
  const defaults = triggeredEffectDefaults(effect.name);
  const formula = effect.damage_formula || defaults.damage_formula;
  const damageType = effect.damage_type || defaults.damage_type;
  const trigger = effect.trigger || defaults.trigger;
  const [amount, setAmount] = useState('');
  const [rolled, setRolled] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rollDigitally = () => {
    const result = rollDiceFormula(formula);
    if (!result) {
      setError(`Cannot roll "${formula}". Enter the damage manually.`);
      return;
    }
    setError('');
    setRolled(result);
    setAmount(String(result.total));
  };

  const submit = async () => {
    if (!amount) return;
    setSaving(true);
    setError('');
    try {
      await onTriggerEffect(row, effect, amount);
      setAmount('');
      setRolled(null);
    } catch (err) {
      setError(err.message || 'Could not trigger effect.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      border:'1px solid rgba(230,57,70,0.7)',
      background:'rgba(230,57,70,0.14)',
      borderRadius:5,
      padding:6,
      display:'grid',
      gap:5,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
        <div style={{minWidth:0}}>
          <div style={{color:'var(--danger)',fontSize:11,fontWeight:900,textTransform:'uppercase',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            Trigger: {effect.name}
          </div>
          <div style={{color:'var(--text-dim)',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            {trigger} · {formula} {damageType}
          </div>
        </div>
        <MiniButton onClick={rollDigitally}>Roll</MiniButton>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:5}}>
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Damage"
          style={{height:28,fontSize:12,fontWeight:800}}
        />
        <MiniButton onClick={submit} variant="danger" disabled={saving || !amount}>
          {saving ? '...' : 'Apply'}
        </MiniButton>
      </div>
      {rolled && (
        <div style={{color:'var(--text-secondary)',fontSize:11}}>
          {formula}: {rolled.rolls.join(' + ')}{rolled.bonus ? ` ${rolled.bonus >= 0 ? '+' : '-'} ${Math.abs(rolled.bonus)}` : ''} = {rolled.total}
        </div>
      )}
      {(effect.notes || defaults.notes) && <div style={{color:'var(--text-dim)',fontSize:11,lineHeight:1.35}}>{effect.notes || defaults.notes}</div>}
      {error && <div style={{color:'var(--danger)',fontSize:11}}>{error}</div>}
    </div>
  );
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
    triggered: COMMON_TRIGGERED_EFFECTS,
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

function DraftInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const commit = () => {
    if (String(draft ?? '') !== String(value ?? '')) onCommit(draft);
  };

  return (
    <input
      {...props}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
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

function MiniField({ label, value, onCommit, width = 58 }) {
  return (
    <div style={{display:'grid',gap:2,width,flex:'0 0 auto'}}>
      <div style={{color:'var(--text-dim)',fontSize:10,lineHeight:1,fontWeight:800,textTransform:'uppercase'}}>{label}</div>
      <DraftInput
        value={value}
        onCommit={onCommit}
        style={{
          width:'100%',
          height:28,
          textAlign:'center',
          fontWeight:800,
          padding:'3px 6px',
          lineHeight:1.1,
        }}
      />
    </div>
  );
}

function CombatantCard({ row, active, statMonster, pendingSaves = [], onUpdate, onRemove, onViewMonster, onAddCondition, onRemoveCondition, onRemoveEffect, onDeathSave, onResetDeathSaves, onResolveSave, onTriggerEffect, rowRef }) {
  const dead = isDeadCombatant(row);
  const dying = isInDeathSaves(row);
  const rowEffects = cleanList(row.effects);
  const triggeredEffects = rowEffects.filter(isTriggeredEffect);
  const regularEffects = rowEffects.filter(effect => !isTriggeredEffect(effect));
  const dangerBackground = dead
    ? 'linear-gradient(90deg, rgba(230,57,70,0.24), rgba(82,17,24,0.92))'
    : dying
      ? 'linear-gradient(90deg, rgba(255,193,7,0.18), rgba(42,37,26,0.92))'
      : active
        ? 'linear-gradient(90deg, rgba(124,92,252,0.24), rgba(30,41,78,0.92))'
        : 'var(--bg-secondary)';
  return (
    <div ref={rowRef} style={{
      border:dead ? '2px solid var(--danger)' : active ? '2px solid var(--accent)' : dying ? '2px solid var(--warning)' : '1px solid var(--border)',
      borderRadius:'var(--radius-sm)',
      background:dangerBackground,
      boxShadow:active ? '0 0 0 2px rgba(124,92,252,0.18), 0 0 24px rgba(124,92,252,0.2)' : 'none',
      padding:8,
      display:'grid',
      gridTemplateColumns:'minmax(260px,1.25fr) 150px minmax(300px,1.2fr) minmax(130px,0.45fr) auto',
      gridTemplateAreas:'"identity hp status effects actions"',
      gap:8,
      alignItems:'start',
      minWidth:0,
      scrollMarginTop:72,
    }}>
      <div style={{gridArea:'identity',display:'grid',gap:5,minWidth:0}}>
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:6,alignItems:'center'}}>
          <DraftInput value={row.name} onCommit={value => onUpdate(row.id, { name: value })} style={{fontWeight:800,minWidth:120,width:'100%',textDecoration:dead ? 'line-through' : 'none',color:dead ? 'var(--danger)' : undefined}} />
          <MiniButton onClick={() => onRemove(row.id)} variant="danger">Remove from Encounter</MiniButton>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'flex-end',minWidth:0,flexWrap:'wrap'}}>
          <MiniField label="INIT" value={row.initiative} onCommit={value => onUpdate(row.id, { initiative: value })} />
          <MiniField label="AC" value={row.ac} onCommit={value => onUpdate(row.id, { ac: value })} />
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',minWidth:0,paddingBottom:4}}>
            {statMonster && <MiniButton onClick={() => onViewMonster(statMonster)}>Stat Block</MiniButton>}
            {row.type === 'enemy' && (
              <>
                <MiniButton onClick={() => onUpdate(row.id, { hidden_from_players: !row.hidden_from_players })}>
                  {row.hidden_from_players ? 'Hidden' : 'Visible'}
                </MiniButton>
              </>
            )}
            {dead && <span style={{color:'var(--danger)',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>Dead</span>}
            {dying && <span style={{color:'var(--warning)',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>Death saves</span>}
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
            <button key={condition} type="button" title={conditionHint(condition)} onClick={() => onRemoveCondition(row, condition)} style={{border:'1px solid rgba(230,57,70,0.65)',background:'rgba(230,57,70,0.24)',color:'var(--text-primary)',borderRadius:4,padding:'3px 6px',fontSize:11,cursor:'pointer',fontWeight:800}}>
              {condition} x
            </button>
          ))}
        </div>
        <div style={{marginTop:5,display:'grid',gridTemplateColumns:'82px minmax(0,1fr)',gap:5,alignItems:'center'}}>
          <label style={{fontSize:10,color:'var(--text-dim)'}}>CONCENTRATION</label>
          <DraftInput value={row.concentration} onCommit={value => onUpdate(row.id, { concentration: value })} placeholder="Spell or effect" />
        </div>
        {pendingSaves.length > 0 && (
          <div style={{display:'grid',gap:5,marginTop:6}}>
            {pendingSaves.map(event => (
              <PendingSaveResolver key={event.id || `${event.label}_${event.target_id}`} event={event} row={row} onResolveSave={onResolveSave} />
            ))}
          </div>
        )}
      </div>

      <div style={{gridArea:'effects',minWidth:0}}>
        <div style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,marginBottom:4}}>EFFECTS</div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',maxHeight:42,overflowY:'auto',alignContent:'flex-start'}}>
          {regularEffects.length === 0 && triggeredEffects.length === 0 && <span style={{color:'var(--text-dim)',fontSize:12}}>None</span>}
          {regularEffects.map(effect => (
            <button
              key={effect.id || effect.name}
              type="button"
              title={`${effect.name}${effect.source_name ? `\n${effect.source_name}` : ''}${effect.duration ? `\n${effect.duration}` : ''}`}
              onClick={() => onRemoveEffect(row, effect)}
              style={{
                textAlign:'left',
                border:'1px solid rgba(230,57,70,0.55)',
                background:'rgba(230,57,70,0.18)',
                color:'var(--text-primary)',
                borderRadius:4,
                padding:'2px 5px',
                cursor:'pointer',
                fontSize:10,
                fontWeight:800,
                lineHeight:1.15,
                maxWidth:'100%',
                overflow:'hidden',
                textOverflow:'ellipsis',
                whiteSpace:'nowrap',
              }}
            >
              {effect.name}
            </button>
          ))}
        </div>
        {triggeredEffects.length > 0 && (
          <div style={{display:'grid',gap:5,marginTop:6}}>
            {triggeredEffects.map(effect => (
              <TriggeredEffectResolver
                key={effect.id || effect.name}
                effect={effect}
                row={row}
                onTriggerEffect={onTriggerEffect}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{gridArea:'actions',display:'flex',gap:5,flexDirection:'column',alignItems:'stretch',minWidth:94}}>
        <div style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Death Saves</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
          <MiniButton onClick={() => onDeathSave(row, 'successes', 1)}>Pass {row.death_saves?.successes || 0}</MiniButton>
          <MiniButton onClick={() => onDeathSave(row, 'failures', 1)}>Fail {row.death_saves?.failures || 0}</MiniButton>
          <MiniButton onClick={() => onResetDeathSaves(row)}>Reset</MiniButton>
          <MiniButton onClick={() => onUpdate(row.id, { dead: !dead })} variant={dead ? 'secondary' : 'danger'}>{dead ? 'Alive' : 'Dead'}</MiniButton>
        </div>
        {row.last_death_save && (
          <div style={{border:'1px solid rgba(154,128,255,0.42)',background:'rgba(124,92,252,0.16)',borderRadius:4,padding:'5px 6px',fontSize:11,color:'var(--text-secondary)',lineHeight:1.35}}>
            <div style={{color:'var(--accent-light)',fontWeight:900}}>
              Last: d20 {row.last_death_save.roll} - {deathSaveResultLabel(row.last_death_save.result)}
            </div>
            {row.last_death_save.blind && <div>Blind roll. Player did not see this.</div>}
          </div>
        )}
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
  campaignRules = {},
}) {
  const data = encounter?.data || {};
  const combatants = sortedCombatants(encounter);
  const [monsterSearch, setMonsterSearch] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [initiative, setInitiative] = useState('');
  const [sharedInitiative, setSharedInitiative] = useState(true);
  const [hideNewEnemies, setHideNewEnemies] = useState(true);
  const [selectedTurnId, setSelectedTurnId] = useState(combatants[0]?.id || null);
  const [viewingMonster, setViewingMonster] = useState(null);
  const [rulesPopup, setRulesPopup] = useState(null);
  const [deathSaveAlert, setDeathSaveAlert] = useState(null);
  const [resolutionAlert, setResolutionAlert] = useState(null);
  const [effectForm, setEffectForm] = useState({
    type: 'condition',
    name: '',
    custom: '',
    source_id: '',
    target_ids: [],
    duration: '1 min',
    concentration: false,
    trigger: 'Movement',
    damage_formula: '1d8',
    damage_type: 'Thunder',
    remove_on_trigger: true,
    notes: '',
  });
  const rowRefs = useRef({});
  const seenDeathSavesRef = useRef(new Set());
  const seenResolutionEventsRef = useRef(new Set());
  const seededDeathSavesRef = useRef(false);
  const seededResolutionEventsRef = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const activeRoster = roster.filter(entry => entry.active);
  const filteredMonsters = monsters
    .filter(monster => !monsterSearch.trim() || monster.name.toLowerCase().includes(monsterSearch.toLowerCase()));
  const effectOptions = useMemo(() => makeEffectOptions(activeRoster), [activeRoster]);
  const effectNames = effectOptions[effectForm.type] || [];
  const pendingSavesByTarget = useMemo(() => {
    return cleanList(data.resolution_events)
      .filter(event => event?.pending && event.mode === 'save' && event.target_id)
      .reduce((acc, event) => {
        const key = String(event.target_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(event);
        return acc;
      }, {});
  }, [data.resolution_events]);

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
    const freshRows = findFreshEncounterData(freshCampaign, encounter.id)?.combatants || [];
    const currentRows = freshRows.length ? freshRows : (dataRef.current?.combatants || []);
    const activeCharacterIds = new Set(sourceRoster.map(entry => String(entry.character_id)));
    const next = currentRows.filter(row => (
      row.type !== 'player' || !row.character_id || activeCharacterIds.has(String(row.character_id))
    )).map(row => {
      const serverRow = freshRows.find(candidate => sameId(candidate.id, row.id) || (row.character_id && sameId(candidate.character_id, row.character_id)));
      const stableRow = mergeDeathSaveState(normalizeCombatant(row), serverRow);
      if (stableRow.type !== 'player' || !stableRow.character_id) return stableRow;
      const entry = sourceRoster.find(candidate => sameId(candidate.character_id, stableRow.character_id));
      if (!entry) return stableRow;
      return combatantFromRoster(entry, { ...stableRow, initiative: stableRow.initiative, effects: stableRow.effects });
    });
    if (combatantsChanged(currentRows, next)) {
      patchCombatants(next);
    } else {
      dataRef.current = { ...(dataRef.current || {}), combatants: next };
    }
  };

  useEffect(() => {
    if (encounter.status !== 'running' || !reloadCampaign) return undefined;
    syncPartyStats().catch(() => {});
    const timer = setInterval(() => {
      syncPartyStats().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [encounter.id, encounter.status, reloadCampaign]);

  useEffect(() => {
    const records = combatants
      .filter(row => row.last_death_save)
      .map(row => ({ row, key: `${row.id}:${JSON.stringify(row.last_death_save)}` }));
    if (!seededDeathSavesRef.current) {
      records.forEach(record => seenDeathSavesRef.current.add(record.key));
      seededDeathSavesRef.current = true;
      return;
    }
    const fresh = records.find(record => !seenDeathSavesRef.current.has(record.key));
    records.forEach(record => seenDeathSavesRef.current.add(record.key));
    if (fresh) setDeathSaveAlert({ row: fresh.row, record: fresh.row.last_death_save });
  }, [combatants]);

  useEffect(() => {
    const events = cleanList(data.resolution_events).map(event => ({
      event,
      key: `${event.id || ''}:${JSON.stringify(event)}`,
    }));
    if (!seededResolutionEventsRef.current) {
      events.forEach(record => seenResolutionEventsRef.current.add(record.key));
      seededResolutionEventsRef.current = true;
      return;
    }
    const fresh = events.find(record => !seenResolutionEventsRef.current.has(record.key));
    events.forEach(record => seenResolutionEventsRef.current.add(record.key));
    if (fresh?.event?.pending && fresh.event.mode === 'save' && fresh.event.target_id) {
      focusCombatant(fresh.event.target_id);
      return;
    }
    if (fresh) setResolutionAlert(fresh.event);
  }, [data.resolution_events]);

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
      hidden_from_players: hideNewEnemies,
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
      hidden_from_players: sample.hidden_from_players,
      dead: false,
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
    const latest = (dataRef.current?.combatants || []).find(entry => sameId(entry.id, row.id)) || row;
    const current = latest.death_saves || { successes: 0, failures: 0 };
    const nextSaves = {
      ...current,
      [key]: Math.max(0, Math.min(3, toNumber(current[key], 0) + delta)),
    };
    updateCombatant(row.id, {
      death_saves: nextSaves,
      dead: toNumber(nextSaves.failures, 0) >= 3 ? true : latest.dead,
    });
  };

  const resetDeathSaves = row => {
    updateCombatant(row.id, {
      death_saves: { successes: 0, failures: 0 },
      last_death_save: null,
      death_save_rolls: [],
      dead: false,
    });
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
    const triggeredDefaults = triggeredEffectDefaults(name);
    const concentration = isConcentrationEffect(name, effectForm.concentration);
    const effect = {
      id: combatantId(),
      name,
      type: effectForm.type,
      source_id: source?.id || '',
      source_name: source?.name || '',
      duration: effectForm.duration || (effectForm.type === 'triggered' ? triggeredDefaults.duration : ''),
      concentration,
    };
    if (effectForm.type === 'triggered') {
      effect.trigger = effectForm.trigger || triggeredDefaults.trigger;
      effect.damage_formula = effectForm.damage_formula || triggeredDefaults.damage_formula;
      effect.damage_type = effectForm.damage_type || triggeredDefaults.damage_type;
      effect.remove_on_trigger = effectForm.remove_on_trigger !== false;
      effect.notes = effectForm.notes || triggeredDefaults.notes;
    }
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
    setEffectForm(form => ({ ...form, name: '', custom: '', target_ids: [], concentration: false, notes: '' }));
  };

  const triggerEffect = async (row, effect, amount) => {
    const damageAmount = toNumber(amount, 0);
    if (damageAmount <= 0) throw new Error('Enter a damage amount greater than 0.');
    const damageType = effect.damage_type || triggeredEffectDefaults(effect.name).damage_type || 'Damage';
    const response = await api.post(`/campaigns/${campaign.id}/encounters/${encounter.id}/resolve`, {
      source_name: effect.source_name || 'Encounter effect',
      target_id: row.id,
      label: `${effect.name || 'Triggered effect'} triggered`,
      mode: 'damage',
      damage_components: [{ amount: damageAmount, damage_type: damageType }],
      notes: `${effect.trigger || 'Manual trigger'}${effect.notes ? ` - ${effect.notes}` : ''}`,
    }, { suppressGlobalError: true });
    const resolvedData = response.data?.encounter?.data;
    let nextData = resolvedData || dataRef.current || {};
    if (effect.remove_on_trigger !== false) {
      nextData = {
        ...nextData,
        combatants: cleanList(nextData.combatants).map(entry => {
          const normalized = normalizeCombatant(entry);
          if (!sameId(normalized.id, row.id)) return normalized;
          return normalizeCombatant({
            ...normalized,
            effects: cleanList(normalized.effects).filter(item => (item.id || item.name) !== (effect.id || effect.name)),
          });
        }),
      };
    }
    dataRef.current = nextData;
    await onPatchData(encounter.id, nextData);
    setResolutionAlert(response.data?.resolution || null);
  };

  const resolvePendingSave = async (event, saveRoll) => {
    if (!event?.target_id) throw new Error('Pending event is missing a target.');
    if (!cleanList(event.damage_components).length) {
      throw new Error('Pending event is missing damage data. Recast after this update so the DM can resolve it.');
    }
    const response = await api.post(`/campaigns/${campaign.id}/encounters/${encounter.id}/resolve`, {
      source_character_id: event.source_character_id,
      source_name: event.source_name,
      target_id: event.target_id,
      label: event.label,
      mode: 'save',
      resolves_event_id: event.id || '',
      save_type: event.save_type || event.save_ability || '',
      save_dc: event.save_dc,
      save_roll: saveRoll,
      half_on_success: event.half_on_success !== false,
      damage_components: event.damage_components,
      notes: `Resolved pending save ${event.id || ''}`.trim(),
    }, { suppressGlobalError: true });
    const nextData = response.data?.encounter?.data;
    if (nextData) {
      dataRef.current = nextData;
      await onPatchData(encounter.id, nextData);
    }
    setResolutionAlert(response.data?.resolution || null);
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:'100vw',maxWidth:'none',height:'100vh',borderRadius:0,border:0,display:'flex',flexDirection:'column',padding:14,background:'var(--bg-primary)',position:'relative'}}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,borderBottom:'1px solid var(--border)',paddingBottom:10}}>
          <div>
            <h2 style={{marginBottom:2}}>Encounter Tracker: {encounter.name}</h2>
            <div style={{color:'var(--text-secondary)',fontSize:12}}>{combatants.length} combatants · {encounter.status}</div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
            <MiniButton onClick={() => setRulesPopup(rulesPopup === 'exhaustion' ? null : 'exhaustion')}>Exhaustion</MiniButton>
            <MiniButton onClick={() => setRulesPopup(rulesPopup === 'death_saves' ? null : 'death_saves')}>Death Saves</MiniButton>
            <MiniButton onClick={() => onStatus(encounter.id, primaryStatusAction.status)} variant={primaryStatusAction.variant}>{primaryStatusAction.label}</MiniButton>
            <MiniButton onClick={() => onStatus(encounter.id, 'complete')}>Conclude Encounter</MiniButton>
            <MiniButton onClick={syncPartyStats}>Sync PCs</MiniButton>
            <MiniButton onClick={() => onDelete(encounter.id)} variant="danger">Delete</MiniButton>
            <MiniButton onClick={onClose}>Close</MiniButton>
          </div>
        </div>
        {rulesPopup === 'exhaustion' && (
          <RulePopup title="Campaign Exhaustion Rules" text={campaignRules.exhaustion} onClose={() => setRulesPopup(null)} />
        )}
        {rulesPopup === 'death_saves' && (
          <RulePopup title="Campaign Death Save Rules" text={campaignRules.death_saves} onClose={() => setRulesPopup(null)} />
        )}
        {deathSaveAlert && (
          <RulePopup
            title="Death Save Rolled"
            text={`${deathSaveAlert.row.name}\nD20 ${deathSaveAlert.record.roll} - ${deathSaveResultLabel(deathSaveAlert.record.result)}\n${deathSaveAlert.record.note || ''}\n\nCurrent: ${deathSaveAlert.record.successes || 0} success / ${deathSaveAlert.record.failures || 0} fail${deathSaveAlert.record.blind ? '\nBlind roll: player did not see this result.' : ''}`}
            onClose={() => setDeathSaveAlert(null)}
          />
        )}
        {resolutionAlert && (
          <EncounterActionPopup
            event={resolutionAlert}
            targetRow={combatants.find(row => sameId(row.id, resolutionAlert.target_id))}
            onResolveSave={resolvePendingSave}
            onClose={() => setResolutionAlert(null)}
          />
        )}

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
          <aside style={{display:'flex',flexDirection:'column',gap:8,minHeight:0,overflowY:'auto',overflowX:'hidden',paddingRight:4}}>
            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
              <div style={{color:'var(--accent-light)',fontWeight:800,marginBottom:8}}>Add Characters</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {activeRoster.map(entry => (
                  <MiniButton key={entry.id} onClick={() => addPartyMember(entry)} disabled={combatants.some(row => sameId(row.character_id, entry.character_id))}>{entry.name}</MiniButton>
                ))}
              </div>
            </section>

            <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:8,display:'flex',flexDirection:'column',minHeight:340,flex:'0 0 380px',overflow:'hidden'}}>
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
              <label style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-secondary)',fontSize:12,marginBottom:8}}>
                <input type="checkbox" checked={hideNewEnemies} onChange={e => setHideNewEnemies(e.target.checked)} style={{width:'auto'}} />
                Add enemies hidden from players
              </label>
              <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:5}}>{filteredMonsters.length} monster{filteredMonsters.length === 1 ? '' : 's'}</div>
              <div style={{flex:1,minHeight:210,overflowY:'auto',paddingRight:3,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'rgba(0,0,0,0.12)'}}>
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
                <select value={effectForm.type} onChange={e => setEffectForm(f => {
                  const type = e.target.value;
                  const defaults = triggeredEffectDefaults('');
                  return {
                    ...f,
                    type,
                    name: '',
                    custom: '',
                    duration: type === 'triggered' ? defaults.duration : f.duration,
                    trigger: defaults.trigger,
                    damage_formula: defaults.damage_formula,
                    damage_type: defaults.damage_type,
                    remove_on_trigger: defaults.remove_on_trigger,
                    notes: '',
                  };
                })}>
                  <option value="condition">Condition</option>
                  <option value="spell">Spell</option>
                  <option value="effect">Active Effect</option>
                  <option value="triggered">Triggered Damage</option>
                  <option value="note">Custom/Note</option>
                </select>
                {effectNames.length > 0 ? (
                  <select value={effectForm.name} onChange={e => setEffectForm(f => {
                    const name = e.target.value;
                    const defaults = triggeredEffectDefaults(name);
                    return {
                      ...f,
                      name,
                      custom: '',
                      duration: f.type === 'triggered' ? defaults.duration : f.duration,
                      trigger: f.type === 'triggered' ? defaults.trigger : f.trigger,
                      damage_formula: f.type === 'triggered' ? defaults.damage_formula : f.damage_formula,
                      damage_type: f.type === 'triggered' ? defaults.damage_type : f.damage_type,
                      remove_on_trigger: f.type === 'triggered' ? defaults.remove_on_trigger : f.remove_on_trigger,
                      notes: f.type === 'triggered' ? defaults.notes : f.notes,
                    };
                  })}>
                    <option value="">Choose {effectForm.type}</option>
                    {effectNames.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                ) : null}
                <input value={effectForm.custom} onChange={e => setEffectForm(f => ({ ...f, custom: e.target.value }))} placeholder={effectNames.length ? 'Or custom effect' : 'Effect name'} />
                <input value={effectForm.duration} onChange={e => setEffectForm(f => ({ ...f, duration: e.target.value }))} placeholder="Duration" />
                {effectForm.type === 'triggered' && (
                  <div style={{display:'grid',gap:6}}>
                    <input value={effectForm.trigger} onChange={e => setEffectForm(f => ({ ...f, trigger: e.target.value }))} placeholder="Trigger, e.g. Movement" />
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      <input value={effectForm.damage_formula} onChange={e => setEffectForm(f => ({ ...f, damage_formula: e.target.value }))} placeholder="Damage, e.g. 1d8" />
                      <input value={effectForm.damage_type} onChange={e => setEffectForm(f => ({ ...f, damage_type: e.target.value }))} placeholder="Damage type" />
                    </div>
                    <label style={{display:'flex',gap:8,alignItems:'center',color:'var(--text-secondary)',fontSize:12}}>
                      <input type="checkbox" checked={effectForm.remove_on_trigger} onChange={e => setEffectForm(f => ({ ...f, remove_on_trigger: e.target.checked }))} style={{width:'auto'}} />
                      Remove after trigger
                    </label>
                    <input value={effectForm.notes} onChange={e => setEffectForm(f => ({ ...f, notes: e.target.value }))} placeholder="Trigger reminder" />
                  </div>
                )}
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
              {combatants.map(row => {
                const dead = isDeadCombatant(row);
                const dying = isInDeathSaves(row);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => focusCombatant(row.id)}
                    className={sameId(activeId, row.id) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                    style={{
                      background: dead ? 'rgba(230,57,70,0.88)' : dying ? 'rgba(255,193,7,0.86)' : undefined,
                      color: (dead || dying) ? '#05060d' : undefined,
                      borderColor: dead ? 'var(--danger)' : dying ? 'var(--warning)' : undefined,
                      textDecoration: dead ? 'line-through' : 'none',
                      fontWeight: (dead || dying) ? 900 : undefined,
                    }}
                  >
                    {row.initiative || '?'} {row.name}
                  </button>
                );
              })}
            </div>
            {combatants.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:14,textAlign:'center',padding:60}}>Add characters and enemies to begin running this encounter.</div>
            ) : combatants.map(row => {
              const statMonster = monsterForRow(row, monsters);
              return (
                <CombatantCard
                  key={row.id}
                  row={row}
                  statMonster={statMonster}
                  rowRef={element => { rowRefs.current[row.id] = element; }}
                  active={sameId(activeId, row.id)}
                  pendingSaves={pendingSavesByTarget[String(row.id)] || []}
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
                  onResetDeathSaves={resetDeathSaves}
                  onResolveSave={resolvePendingSave}
                  onTriggerEffect={triggerEffect}
                />
              );
            })}
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
