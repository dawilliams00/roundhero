import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCampaign } from '../context/CampaignContext';
import { useCharacter } from '../context/CharacterContext';
import FeedbackModal from '../components/FeedbackModal';
import EncounterRunnerModal from '../components/EncounterRunnerModal';
import MonsterDetailModal from '../components/MonsterDetailModal';
import { ReferenceLibraryContent } from '../components/ReferenceLibrary';
import api from '../utils/api';
import { fetchSyricReferences } from '../utils/characterModules';

const TABS = ['Party', 'Effects', 'Encounters', 'DM References'];
const EFFECT_PRESETS = [
  {
    id: 'heroes_feast',
    name: 'Heroes Feast',
    effect_type: 'party_buff',
    duration: '24 hr',
    target_scope: 'party',
    notes: 'Maximum HP increases by the rolled feast value. Also helps track immunity/advantage reminders from the feast.',
    modifiers: [
      { type: 'max_hp_bonus', value: 25, detail: 'Feast HP roll', label: 'Max HP +25' },
      { type: 'immunity', detail: 'poison', label: 'Immune: poison' },
      { type: 'immunity', detail: 'frightened', label: 'Immune: frightened' },
      { type: 'advantage', detail: 'Wisdom saving throws', label: 'Advantage: Wisdom saves' },
    ],
  },
  {
    id: 'bless',
    name: 'Bless',
    effect_type: 'spell',
    duration: '1 min',
    target_scope: 'selected',
    concentration: true,
    notes: 'Add 1d4 to attack rolls and saving throws while active.',
    modifiers: [
      { type: 'bonus_dice', value: '1d4', detail: 'attack rolls and saving throws', label: '+1d4 attacks/saves' },
    ],
  },
  {
    id: 'aid',
    name: 'Aid',
    effect_type: 'spell',
    duration: '8 hr',
    target_scope: 'selected',
    notes: 'Increase current and maximum HP for selected targets. Adjust the HP bonus for upcast level before queueing.',
    modifiers: [
      { type: 'max_hp_bonus', value: 5, detail: 'Aid HP increase', label: 'Max HP +5' },
    ],
  },
  {
    id: 'bane',
    name: 'Bane',
    effect_type: 'spell',
    duration: '1 min',
    target_scope: 'selected',
    concentration: true,
    notes: 'Subtract 1d4 from attack rolls and saving throws while active.',
    modifiers: [
      { type: 'penalty_dice', value: '1d4', detail: 'attack rolls and saving throws', label: '-1d4 attacks/saves' },
    ],
  },
  {
    id: 'haste',
    name: 'Haste',
    effect_type: 'spell',
    duration: '1 min',
    target_scope: 'single',
    concentration: true,
    notes: 'Reminder effect for Haste. Character sheet Haste handling still controls the full action-economy behavior.',
    modifiers: [
      { type: 'advantage', detail: 'Dexterity saving throws', label: 'Advantage: DEX saves' },
      { type: 'note', detail: '+2 AC, doubled speed, one limited extra action', label: 'Haste rules reminder' },
    ],
  },
  {
    id: 'protection_from_energy',
    name: 'Protection from Energy',
    effect_type: 'spell',
    duration: '1 hr',
    target_scope: 'single',
    concentration: true,
    notes: 'Set the resistance detail to acid, cold, fire, lightning, or thunder.',
    modifiers: [
      { type: 'resistance', detail: 'chosen damage type', label: 'Resistant: chosen type' },
    ],
  },
  {
    id: 'bardic_inspiration',
    name: 'Bardic Inspiration',
    effect_type: 'buff',
    duration: '10 min',
    target_scope: 'single',
    notes: 'Set die size for the bard level before queueing.',
    modifiers: [
      { type: 'bonus_dice', value: '1d10', detail: 'one ability check, attack roll, or saving throw', label: 'Bardic die 1d10' },
    ],
  },
  {
    id: 'polymorph_reminder',
    name: 'Polymorph',
    effect_type: 'spell',
    duration: '1 hr',
    target_scope: 'single',
    concentration: true,
    notes: 'Reminder to use beast form stats and temp/form HP tracking.',
    modifiers: [
      { type: 'note', detail: 'Use selected beast stat block and form HP', label: 'Polymorph form reminder' },
    ],
  },
  {
    id: 'fire_resistance',
    name: 'Fire Resistance',
    effect_type: 'buff',
    duration: 'Until removed',
    target_scope: 'selected',
    modifiers: [
      { type: 'resistance', detail: 'fire', label: 'Resistant: fire' },
    ],
  },
  {
    id: 'environmental_hazard',
    name: 'Environmental Hazard',
    effect_type: 'hazard',
    duration: 'Until removed',
    target_scope: 'selected',
    notes: 'DM quick template for trap, lair, terrain, or cursed area effects.',
    modifiers: [
      { type: 'condition', detail: 'poisoned', label: 'Condition: poisoned' },
    ],
  },
];
const MODIFIER_TYPES = [
  { value: 'max_hp_bonus', label: 'Max HP Bonus', needsValue: true, valuePlaceholder: '+25', detailPlaceholder: 'Feast HP roll' },
  { value: 'temp_hp', label: 'Temp HP', needsValue: true, valuePlaceholder: '12', detailPlaceholder: 'Source/reason' },
  { value: 'advantage', label: 'Advantage', detailPlaceholder: 'poison saves' },
  { value: 'disadvantage', label: 'Disadvantage', detailPlaceholder: 'Stealth checks' },
  { value: 'immunity', label: 'Immunity', detailPlaceholder: 'fire, poison, frightened' },
  { value: 'resistance', label: 'Resistance', detailPlaceholder: 'cold' },
  { value: 'vulnerability', label: 'Vulnerability', detailPlaceholder: 'radiant' },
  { value: 'bonus_dice', label: 'Bonus Dice', needsValue: true, valuePlaceholder: '1d4', detailPlaceholder: 'saving throws' },
  { value: 'penalty_dice', label: 'Penalty Dice', needsValue: true, valuePlaceholder: '1d4', detailPlaceholder: 'attack rolls' },
  { value: 'condition', label: 'Condition', detailPlaceholder: 'poisoned' },
  { value: 'note', label: 'Reminder', detailPlaceholder: 'Custom reminder' },
];

function blankCampaignEffectForm() {
  return {
    preset_id: 'custom',
    name: '',
    source_character_id: '',
    target_character_id: '',
    target_character_ids: [],
    target_scope: 'single',
    effect_type: 'campaign_effect',
    duration: '',
    concentration: false,
    notes: '',
    modifier_type: 'max_hp_bonus',
    modifier_value: '',
    modifier_detail: '',
    modifiers: [],
  };
}

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

function cleanList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function deathSaveResultLabel(result) {
  return {
    critical_success: 'Natural 20',
    critical_failure: 'Natural 1',
    success: 'Success',
    failure: 'Failure',
  }[result] || result || '';
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

function initiativeValue(value) {
  if (value === '' || value == null) return -999;
  return toNumber(value, -999);
}

function inviteUrlFor(code) {
  const origin = window.location.origin;
  return `${origin}/campaigns?join=${encodeURIComponent(code || '')}`;
}

function CampaignInviteEmailModal({ campaign, onClose }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!campaign || !email.trim()) return;
    setSending(true);
    setError('');
    try {
      await api.post(
        `/campaigns/${campaign.id}/invite/email`,
        { email: email.trim(), invite_url: inviteUrlFor(campaign.invite_code) },
        { suppressGlobalError: true }
      );
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send invite email.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{maxWidth:340}} onClick={e => e.stopPropagation()}>
          <h2>Invite Sent</h2>
          <p style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.6}}>
            The campaign invite was sent to {email.trim()}.
          </p>
          <button className="btn btn-primary" style={{width:'100%',marginTop:8}} onClick={onClose}>Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>Email Campaign Invite</h2>
        <div style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.5,marginBottom:12}}>
          Send an invite for {campaign?.name}. The email includes the join code and campaign link.
        </div>
        <div className="form-group">
          <label>Recipient Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="player@example.com" autoFocus />
        </div>
        {error && <div style={{color:'var(--danger)',fontSize:12,marginTop:8}}>{error}</div>}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!email.trim() || sending}>
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </form>
    </div>
  );
}

function TransferOwnerModal({ campaign, onClose, onTransfer }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onTransfer(email.trim());
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not transfer DM ownership.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2>Transfer DM Ownership</h2>
        <div style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.5,marginBottom:12}}>
          Transfer owner DM control of {campaign?.name} to a registered RoundHero user by email.
        </div>
        <div className="form-group">
          <label>New Owner Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="newdm@example.com" autoFocus />
        </div>
        {error && <div style={{color:'var(--danger)',fontSize:12,marginTop:8}}>{error}</div>}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!email.trim() || saving}>{saving ? 'Transferring...' : 'Transfer'}</button>
        </div>
      </form>
    </div>
  );
}

function ConfirmActionModal({ title, message, confirmLabel = 'Delete', onCancel, onConfirm }) {
  return (
    <div className="modal-overlay" onClick={onCancel} style={{zIndex:3200}}>
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <p style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.55,marginTop:8}}>
          {message}
        </p>
        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button type="button" className="btn btn-secondary" style={{flex:1}} onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger" style={{flex:1}} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
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
    conditions: Array.isArray(row.conditions) ? row.conditions : [],
    concentration: row.concentration || '',
    death_saves: row.death_saves || { successes: 0, failures: 0 },
    last_death_save: row.last_death_save || null,
    death_save_rolls: Array.isArray(row.death_save_rolls) ? row.death_save_rolls : [],
    group_key: row.group_key || '',
    monster_name: row.monster_name || '',
    monster: row.monster || null,
    notes: row.notes || '',
    user_id: row.user_id || null,
    character_id: row.character_id || null,
    effects: Array.isArray(row.effects) ? row.effects : [],
    snapshot: row.snapshot || null,
  };
}

function rosterHpText(entry) {
  const hp = snapshotHpValues(entry.sheet_snapshot || {});
  if (hp.current == null && hp.max == null) return 'HP ?';
  return `HP ${hp.current ?? '?'}/${hp.max ?? '?'}${hp.temp ? ` +${hp.temp}` : ''}`;
}

function rosterConText(entry) {
  const slots = entry.sheet_snapshot?.concentration_slots || [];
  if (!slots.length) return '';
  return slots.map(slot => slot.spell).filter(Boolean).join(' / ');
}

function preparedSpellsForRosterEntry(entry) {
  const prepared = entry?.sheet_snapshot?.prepared_spells || [];
  return prepared
    .map(spell => (typeof spell === 'string' ? { name: spell } : spell))
    .filter(spell => spell?.name)
    .sort((a, b) => String(a.level ?? 0).localeCompare(String(b.level ?? 0), undefined, { numeric: true }) || a.name.localeCompare(b.name));
}

function effectTargetIds(form, roster) {
  if (form.target_scope === 'party') return roster.map(entry => Number(entry.character_id)).filter(Boolean);
  if (form.target_scope === 'selected') return (form.target_character_ids || []).map(Number).filter(Boolean);
  return form.target_character_id ? [Number(form.target_character_id)] : [];
}

function modifierLabel(modifier) {
  if (modifier.label) return modifier.label;
  const option = MODIFIER_TYPES.find(entry => entry.value === modifier.type);
  const name = option?.label || modifier.type || 'Modifier';
  const value = modifier.value ? ` ${modifier.value}` : '';
  const detail = modifier.detail ? `: ${modifier.detail}` : '';
  return `${name}${value}${detail}`;
}

function campaignEffectSummary(effect, roster) {
  const payload = effect.payload || {};
  const targetIds = payload.target_character_ids || (effect.target_character_id ? [effect.target_character_id] : []);
  if (payload.target_scope === 'party') return 'Entire active party';
  if (targetIds.length > 1) {
    const names = targetIds
      .map(id => roster.find(entry => sameId(entry.character_id, id))?.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : `${targetIds.length} targets`;
  }
  return effect.target_character_name || 'Unassigned';
}

function combatantFromRosterEntry(entry) {
  const snapshot = entry.sheet_snapshot || {};
  const hp = snapshotHpValues(snapshot);
  return normalizeCombatant({
    type: 'player',
    name: entry.name,
    character_id: entry.character_id,
    user_id: entry.user_id,
    group_key: 'Players',
    hp_current: hp.current,
    hp_max: hp.max,
    temp_hp: hp.temp,
    ac: snapshot.ac ?? '',
    conditions: Array.isArray(snapshot.conditions) ? snapshot.conditions : [],
    concentration: rosterConText(entry),
    effects: Array.isArray(snapshot.active_effects)
      ? snapshot.active_effects.map(name => ({ id: `sheet_${name}`, name, type: 'sheet' }))
      : [],
    snapshot,
  });
}

function sortedCombatants(encounter) {
  return [...((encounter?.data?.combatants || []).map(normalizeCombatant))]
    .sort((a, b) => initiativeValue(b.initiative) - initiativeValue(a.initiative) || a.name.localeCompare(b.name));
}

function RoleBadge({ role, isOwner }) {
  const label = isOwner ? 'Owner DM' : role === 'dm' ? 'DM' : 'Player';
  return (
    <span style={{color:role === 'dm' ? 'var(--warning)' : 'var(--text-secondary)',fontSize:11,textTransform:'uppercase',fontWeight:800}}>
      {label}
    </span>
  );
}

function TabButton({ active, label, onClick }) {
  return (
    <button
      className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function CampaignCard({ campaign, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="card"
      style={{
        width: '100%',
        textAlign: 'left',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'rgba(124,92,252,0.14)' : 'var(--bg-card)',
      }}
    >
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}>
        <div>
          <div style={{color:'var(--text-primary)',fontWeight:700,fontSize:15}}>{campaign.name}</div>
          <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:3}}>
            {campaign.member_count || 0} members · {campaign.character_count || 0} characters
          </div>
        </div>
        <RoleBadge role={campaign.role} isOwner={campaign.is_owner} />
      </div>
    </button>
  );
}

function MemberRow({ member, campaign, onRole, onRemove }) {
  const isOwner = sameId(member.user_id, campaign.owner_user_id);
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)',alignItems:'center'}}>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{color:'var(--text-primary)',fontWeight:600}}>{member.username}</span>
          <RoleBadge role={member.role} isOwner={isOwner} />
        </div>
        <div style={{color:'var(--text-secondary)',fontSize:12}}>{member.email}</div>
      </div>
      {campaign.is_dm && !isOwner && (
        <div style={{display:'flex',gap:6}}>
          <button className="btn btn-secondary btn-sm" onClick={() => onRole(member, member.role === 'dm' ? 'player' : 'dm')}>
            {member.role === 'dm' ? 'Make Player' : 'Make DM'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onRemove(member)}>Remove</button>
        </div>
      )}
    </div>
  );
}

function RosterRow({ entry, campaign, user, onPrimary, onActive, onDetach }) {
  const canManage = campaign.is_dm || sameId(entry.user_id, user?.id);
  const conditions = entry.sheet_snapshot?.conditions || [];
  const activeEffects = entry.sheet_snapshot?.active_effects || [];
  const conText = rosterConText(entry);
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)',alignItems:'center'}}>
      <div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{color:'var(--text-primary)',fontWeight:600}}>{entry.name}</span>
          {entry.is_primary && <span style={{color:'var(--success)',fontSize:11,textTransform:'uppercase',fontWeight:800}}>Primary</span>}
          <span style={{color:entry.active ? 'var(--success)' : 'var(--text-dim)',fontSize:11,textTransform:'uppercase',fontWeight:800}}>
            {entry.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div style={{color:'var(--text-secondary)',fontSize:12}}>
          Level {entry.level || '?'} {entry.race} {entry.class_name} · {entry.username}
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',color:'var(--text-dim)',fontSize:11,marginTop:4}}>
          <span>{rosterHpText(entry)}</span>
          {entry.sheet_snapshot?.ac != null && <span>AC {entry.sheet_snapshot.ac}</span>}
          {conditions.length > 0 && <span>Conditions: {conditions.join(', ')}</span>}
          {conText && <span>Con: {conText}</span>}
          {activeEffects.length > 0 && <span>Effects: {activeEffects.join(', ')}</span>}
        </div>
      </div>
      {canManage && (
        <div style={{display:'flex',gap:6}}>
          {entry.active && !entry.is_primary && <button className="btn btn-secondary btn-sm" onClick={() => onPrimary(entry)}>Set Primary</button>}
          <button className={entry.active ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={() => onActive(entry, !entry.active)}>
            {entry.active ? 'Inactivate' : 'Reactivate'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => onDetach(entry)}>Remove</button>
        </div>
      )}
    </div>
  );
}

function EffectRow({ effect, roster, onStatus }) {
  const statusColor = effect.status === 'applied'
    ? 'var(--success)'
    : effect.status === 'pending'
      ? 'var(--warning)'
      : 'var(--text-secondary)';
  const concentration = effect.payload?.concentration ? 'Concentration' : '';
  const duration = effect.payload?.duration || '';
  const modifiers = Array.isArray(effect.payload?.modifiers) ? effect.payload.modifiers : [];
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
      <div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{color:'var(--text-primary)',fontWeight:700}}>{effect.name}</span>
          <span style={{color:statusColor,fontSize:11,textTransform:'uppercase',fontWeight:700}}>{effect.status}</span>
          {concentration && <span style={{color:'var(--accent-light)',fontSize:11,fontWeight:700}}>{concentration}</span>}
        </div>
        <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:3}}>
          {effect.source_character_name || 'DM'} → {campaignEffectSummary(effect, roster)}
          {duration ? ` · ${duration}` : ''}
        </div>
        {modifiers.length > 0 && (
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:6}}>
            {modifiers.map((modifier, index) => (
              <span key={`${modifier.type}_${index}`} style={{border:'1px solid rgba(124,92,252,0.45)',background:'rgba(124,92,252,0.16)',color:'var(--text-primary)',borderRadius:4,padding:'3px 6px',fontSize:11,fontWeight:800}}>
                {modifierLabel(modifier)}
              </span>
            ))}
          </div>
        )}
        {effect.payload?.notes && <div style={{color:'var(--text-dim)',fontSize:12,marginTop:4}}>{effect.payload.notes}</div>}
      </div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        {effect.status === 'pending' && (
          <button className="btn btn-success btn-sm" onClick={() => onStatus(effect.id, 'applied')}>Apply</button>
        )}
        {effect.status !== 'removed' && (
          <button className="btn btn-secondary btn-sm" onClick={() => onStatus(effect.id, 'removed')}>Remove</button>
        )}
      </div>
    </div>
  );
}

function EncounterRow({ encounter, selected, isDm, onStatus, onDelete, onSetup, onRun }) {
  const nextActions = {
    planned: [['Start', 'running']],
    running: [['Stop', 'paused'], ['Conclude', 'complete']],
    paused: [['Resume', 'running'], ['Conclude', 'complete']],
    complete: [],
  }[encounter.status] || [];
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)',alignItems:'center',background:selected ? 'rgba(124,92,252,0.10)' : 'transparent'}}>
      <div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{color:'var(--text-primary)',fontWeight:700}}>{encounter.name}</span>
          <span style={{color:encounter.status === 'running' ? 'var(--success)' : 'var(--text-secondary)',fontSize:11,textTransform:'uppercase',fontWeight:800}}>
            {encounter.status}
          </span>
        </div>
        <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:3}}>
          {(encounter.data?.combatants || []).length} combatants · {(encounter.data?.initiative_order || []).length} initiative entries
        </div>
        {encounter.data?.notes && <div style={{color:'var(--text-dim)',fontSize:12,marginTop:4}}>{encounter.data.notes}</div>}
      </div>
      {isDm && (
        <div style={{display:'flex',gap:6}}>
          <button className={selected ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => onSetup(encounter.id)}>
            {selected ? 'Minimize Setup' : 'Setup'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onRun(encounter.id)}>Open</button>
          {nextActions.map(([label, status]) => (
            <button key={status} className="btn btn-secondary btn-sm" onClick={() => onStatus(encounter.id, status)}>{label}</button>
          ))}
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(encounter.id)}>Delete</button>
        </div>
      )}
    </div>
  );
}

function EncounterBuilder({
  campaign,
  encounter,
  roster,
  activeEffects,
  monsters,
  monsterSearch,
  setMonsterSearch,
  addMonsterQuantity,
  setAddMonsterQuantity,
  addMonsterInitiative,
  setAddMonsterInitiative,
  sharedInitiative,
  setSharedInitiative,
  onPatchData,
  onEffectStatus,
  onDelete,
  onViewMonster,
  onCloseSetup,
}) {
  const data = encounter?.data || {};
  const combatants = sortedCombatants(encounter);
  const filteredMonsters = monsters
    .filter(monster => !monsterSearch.trim() || monster.name.toLowerCase().includes(monsterSearch.toLowerCase()));

  const patchCombatants = nextCombatants => {
    onPatchData(encounter.id, {
      ...data,
      combatants: nextCombatants.map(normalizeCombatant),
      initiative_order: nextCombatants
        .map(normalizeCombatant)
        .sort((a, b) => initiativeValue(b.initiative) - initiativeValue(a.initiative))
        .map(row => row.id),
    });
  };

  const updateCombatant = (id, patch) => {
    const next = (data.combatants || []).map(row => row.id === id ? normalizeCombatant({ ...row, ...patch }) : normalizeCombatant(row));
    patchCombatants(next);
  };

  const removeCombatant = id => {
    patchCombatants((data.combatants || []).filter(row => row.id !== id));
  };

  const addPartyMember = entry => {
    const existing = (data.combatants || []).some(row => sameId(row.character_id, entry.character_id));
    if (existing) return;
    patchCombatants([
      ...(data.combatants || []),
      combatantFromRosterEntry(entry),
    ]);
  };

  const addMonster = monster => {
    const qty = Math.max(1, Math.min(30, toNumber(addMonsterQuantity, 1)));
    const existingCount = (data.combatants || []).filter(row => row.monster_name === monster.name).length;
    const groupKey = `${monster.name}_${Date.now()}`;
    const added = Array.from({ length: qty }, (_, index) => normalizeCombatant({
      type: 'enemy',
      name: qty === 1 ? monster.name : `${monster.name} #${existingCount + index + 1}`,
      monster_name: monster.name,
      monster,
      group_key: sharedInitiative ? groupKey : `${groupKey}_${index}`,
      initiative: addMonsterInitiative,
      hp_current: monster.hit_points || 0,
      hp_max: monster.hit_points || 0,
      temp_hp: 0,
      ac: monster.armor_class || '',
    }));
    patchCombatants([...(data.combatants || []), ...added]);
  };

  const updateConditionText = (row, text) => {
    updateCombatant(row.id, {
      conditions: text.split(',').map(part => part.trim()).filter(Boolean),
    });
  };

  const setDeathSave = (row, key, delta) => {
    const current = row.death_saves || { successes: 0, failures: 0 };
    updateCombatant(row.id, {
      death_saves: {
        ...current,
        [key]: Math.max(0, Math.min(3, toNumber(current[key], 0) + delta)),
      },
    });
  };

  const setupFieldLabel = {
    display: 'grid',
    gap: 4,
    color: 'var(--text-secondary)',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0,
    minWidth: 0,
  };

  return (
    <div className="card" style={{marginTop:12,display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div>
          <h3 style={{color:'var(--accent-light)',fontSize:15,marginBottom:4}}>{encounter.name}</h3>
          <div style={{color:'var(--text-secondary)',fontSize:12}}>
            {combatants.length} combatants · {encounter.status}
          </div>
        </div>
        {campaign.is_dm && (
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button className="btn btn-primary btn-sm" onClick={onCloseSetup}>Complete Setup</button>
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(encounter.id)}>Delete</button>
          </div>
        )}
      </div>

      {campaign.is_dm && (
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 340px',gap:12,alignItems:'start'}}>
          <div style={{display:'flex',flexDirection:'column',gap:12,minWidth:0}}>
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
            <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase',marginBottom:8}}>Add Players</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {roster.length === 0 ? (
                <span style={{color:'var(--text-dim)',fontSize:12}}>No party characters attached.</span>
              ) : roster.map(entry => (
                <button key={entry.id} className="btn btn-secondary btn-sm" onClick={() => addPartyMember(entry)}>{entry.name}</button>
              ))}
            </div>
          </div>

          <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-secondary)',padding:8}}>
            {combatants.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:13,padding:20}}>No combatants yet.</div>
            ) : (
              <div style={{display:'grid',gap:7,minWidth:900}}>
                {combatants.map(row => (
                  <div key={row.id} style={{display:'grid',gridTemplateColumns:'minmax(220px,1fr) 214px minmax(260px,1.1fr) auto',gap:8,padding:8,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-card)',alignItems:'start'}}>
                    <div style={{display:'grid',gap:5,minWidth:0}}>
                      <input value={row.name} onChange={e => updateCombatant(row.id, { name: e.target.value })} style={{fontWeight:800,minWidth:0}} />
                      <div style={{display:'flex',gap:6,alignItems:'center',minWidth:0}}>
                        <span style={{color:row.type === 'player' ? 'var(--accent-light)' : 'var(--warning)',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>{row.type}</span>
                        <span style={{color:'var(--text-dim)',fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {row.group_key ? `Group: ${row.group_key.split('_')[0]}` : 'No group'}
                        </span>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'48px 48px 54px 54px',gap:5,alignItems:'end'}}>
                      <label style={setupFieldLabel}>
                        Init
                        <input value={row.initiative} onChange={e => updateCombatant(row.id, { initiative: e.target.value })} style={{textAlign:'center',fontWeight:800}} />
                      </label>
                      <label style={setupFieldLabel}>
                        AC
                        <input value={row.ac} onChange={e => updateCombatant(row.id, { ac: e.target.value })} style={{textAlign:'center',fontWeight:800}} />
                      </label>
                      <label style={setupFieldLabel}>
                        HP
                        <input value={row.hp_current} onChange={e => updateCombatant(row.id, { hp_current: e.target.value })} />
                      </label>
                      <label style={setupFieldLabel}>
                        Temp
                        <input value={row.temp_hp} onChange={e => updateCombatant(row.id, { temp_hp: e.target.value })} />
                      </label>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:6}}>
                      <label style={setupFieldLabel}>
                        Conditions
                        <input value={(row.conditions || []).join(', ')} onChange={e => updateConditionText(row, e.target.value)} placeholder="poisoned, hexed" />
                      </label>
                      <label style={setupFieldLabel}>
                        Concentration
                        <input value={row.concentration} onChange={e => updateCombatant(row.id, { concentration: e.target.value })} placeholder="Spell or effect" />
                      </label>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,minWidth:124}}>
                      <div style={{gridColumn:'1 / -1',color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Death Saves</div>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeathSave(row, 'successes', 1)}>Pass {row.death_saves?.successes || 0}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeathSave(row, 'failures', 1)}>Fail {row.death_saves?.failures || 0}</button>
                      {row.last_death_save && (
                        <div style={{gridColumn:'1 / -1',border:'1px solid rgba(154,128,255,0.42)',background:'rgba(124,92,252,0.16)',borderRadius:4,padding:'5px 6px',fontSize:11,color:'var(--text-secondary)',lineHeight:1.35}}>
                          <div style={{color:'var(--accent-light)',fontWeight:900}}>Last: d20 {row.last_death_save.roll} - {deathSaveResultLabel(row.last_death_save.result)}</div>
                          {row.last_death_save.blind && <div>Blind roll. Player did not see this.</div>}
                        </div>
                      )}
                      {row.monster && <button className="btn btn-secondary btn-sm" onClick={() => onViewMonster(row.monster)}>Stats</button>}
                      {campaign.is_dm && <button className="btn btn-danger btn-sm" onClick={() => removeCombatant(row.id)}>Remove</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

          <aside style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,position:'sticky',top:12,alignSelf:'start',background:'var(--bg-secondary)',maxHeight:'calc(100vh - 170px)',display:'flex',flexDirection:'column',minHeight:0}}>
            <div style={{borderBottom:'1px solid var(--border)',paddingBottom:10,marginBottom:10}}>
              <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase',marginBottom:8}}>Prepared Effects</div>
              {(activeEffects || []).filter(effect => effect.status === 'pending').length === 0 ? (
                <div style={{color:'var(--text-dim)',fontSize:12}}>No pending effects queued.</div>
              ) : (activeEffects || []).filter(effect => effect.status === 'pending').map(effect => (
                <div key={effect.id} style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6,alignItems:'center',marginBottom:6}}>
                  <div style={{minWidth:0}}>
                    <div style={{color:'var(--text-primary)',fontWeight:800,fontSize:12}}>{effect.name}</div>
                    <div style={{color:'var(--text-dim)',fontSize:11}}>{campaignEffectSummary(effect, roster)}</div>
                  </div>
                  <button type="button" className="btn btn-success btn-sm" onClick={() => onEffectStatus(effect.id, 'applied')}>Apply</button>
                </div>
              ))}
            </div>
            <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase',marginBottom:8}}>Pull Enemy</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6,marginBottom:8}}>
              <input value={monsterSearch} onChange={e => setMonsterSearch(e.target.value)} placeholder="Search bestiary" />
              <div style={{display:'grid',gridTemplateColumns:'32px 1fr 32px 78px',gap:6}}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddMonsterQuantity(String(Math.max(1, toNumber(addMonsterQuantity, 1) - 1)))}>-</button>
              <input value={addMonsterQuantity} onChange={e => setAddMonsterQuantity(e.target.value)} placeholder="Qty" style={{textAlign:'center'}} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddMonsterQuantity(String(Math.min(30, toNumber(addMonsterQuantity, 1) + 1)))}>+</button>
              <input value={addMonsterInitiative} onChange={e => setAddMonsterInitiative(e.target.value)} placeholder="Init" />
              </div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-secondary)',fontSize:12,marginBottom:8}}>
              <input type="checkbox" checked={sharedInitiative} onChange={e => setSharedInitiative(e.target.checked)} style={{width:'auto'}} />
              Shared initiative for this group
            </label>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:5}}>{filteredMonsters.length} monster{filteredMonsters.length === 1 ? '' : 's'}</div>
            <div style={{flex:'1 1 240px',minHeight:160,overflowY:'auto',paddingRight:3,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'rgba(0,0,0,0.12)'}}>
              {filteredMonsters.map(monster => (
                <div key={monster._custom_id ? `custom_${monster._custom_id}` : monster.name} style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:5}}>
                  <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'6px 8px',background:'var(--bg-card)',color:'var(--text-primary)',fontSize:12,fontWeight:800,minWidth:0}}>
                    {monster.name} <span style={{color:'var(--text-dim)'}}>CR {monster.challenge_rating}</span>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => addMonster(monster)}>Add</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => onViewMonster(monster)}>Stat</button>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user, logout } = useAuth();
  const {
    campaigns,
    campaign,
    loading,
    fetchCampaigns,
    loadCampaign,
    createCampaign,
    joinCampaign,
    regenerateInvite,
    attachCharacter,
    detachCharacter,
    setCampaignCharacterActive,
    setPrimaryCharacter,
    updateMemberRole,
    transferCampaignOwner,
    removeMember,
    leaveCampaign,
    deleteCampaign,
    createEffect,
    updateEffectStatus,
    createEncounter,
    updateEncounter,
    deleteEncounter,
  } = useCampaign();
  const { characters, fetchCharacters } = useCharacter();

  const [activeTab, setActiveTab] = useState('Party');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [effectForm, setEffectForm] = useState(blankCampaignEffectForm());
  const [spellEffectForm, setSpellEffectForm] = useState({
    source_character_id: '',
    spell_name: '',
    target_character_id: '',
    duration: '',
    status: 'pending',
  });
  const [encounterForm, setEncounterForm] = useState({ name: '', notes: '' });
  const [selectedEncounterId, setSelectedEncounterId] = useState(null);
  const [runningEncounterId, setRunningEncounterId] = useState(null);
  const [monsters, setMonsters] = useState([]);
  const [monsterSearch, setMonsterSearch] = useState('');
  const [addMonsterQuantity, setAddMonsterQuantity] = useState('1');
  const [addMonsterInitiative, setAddMonsterInitiative] = useState('');
  const [sharedInitiative, setSharedInitiative] = useState(true);
  const [viewingMonster, setViewingMonster] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showInviteEmail, setShowInviteEmail] = useState(false);
  const [showTransferOwner, setShowTransferOwner] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [handledJoinCode, setHandledJoinCode] = useState('');
  const [referenceDocs, setReferenceDocs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCampaigns();
    fetchCharacters();
  }, [fetchCampaigns, fetchCharacters]);

  useEffect(() => {
    const joinCode = params.get('join');
    if (joinCode) {
      setInviteCode(joinCode.toUpperCase());
    }
  }, [params]);

  useEffect(() => {
    const joinCode = (params.get('join') || '').trim().toUpperCase();
    if (!joinCode || handledJoinCode === joinCode) return;
    setHandledJoinCode(joinCode);
    setError('');
    joinCampaign(joinCode)
      .then(joined => {
        setInviteCode('');
        nav(`/campaigns?id=${joined.id}`, { replace: true });
        return loadCampaign(joined.id);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Could not join campaign from invite link');
      });
  }, [handledJoinCode, joinCampaign, loadCampaign, nav, params]);

  useEffect(() => {
    api.get('/content/monsters')
      .then(r => setMonsters(r.data))
      .catch(() => setMonsters([]));
  }, []);

  useEffect(() => {
    fetchSyricReferences().then(setReferenceDocs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!campaigns.length) return;
    const requestedId = Number(params.get('id'));
    const requestedCampaign = campaigns.find(entry => entry.id === requestedId);
    if (requestedCampaign && campaign?.id !== requestedCampaign.id) {
      loadCampaign(requestedCampaign.id);
      return;
    }
    if (!campaign) {
      loadCampaign(campaigns[0].id);
    }
  }, [campaigns, campaign, loadCampaign, params]);

  const allRoster = campaign?.characters || [];
  const activeRoster = allRoster.filter(entry => entry.active);
  const inactiveRoster = allRoster.filter(entry => !entry.active);
  const activeEffects = (campaign?.effects || []).filter(effect => effect.status !== 'removed');
  const encounters = campaign?.encounters || [];
  const selectedEncounter = selectedEncounterId
    ? encounters.find(entry => entry.id === selectedEncounterId) || null
    : null;
  const runningEncounter = encounters.find(entry => entry.id === runningEncounterId) || null;
  const encounterSetupMode = activeTab === 'Encounters' && campaign?.is_dm && !!selectedEncounter;
  const attached = useMemo(
    () => new Set(activeRoster.map(entry => entry.character_id)),
    [activeRoster]
  );
  const availableCharacters = characters.filter(character => !attached.has(character.id));
  const membersWithoutCharacters = (campaign?.members || []).filter(member => (
    !activeRoster.some(entry => entry.user_id === member.user_id)
  ));
  const selectedSpellSource = activeRoster.find(entry => sameId(entry.character_id, spellEffectForm.source_character_id));
  const preparedSpellOptions = preparedSpellsForRosterEntry(selectedSpellSource);
  const selectedPreparedSpell = preparedSpellOptions.find(spell => spell.name === spellEffectForm.spell_name);
  const selectedModifierType = MODIFIER_TYPES.find(entry => entry.value === effectForm.modifier_type) || MODIFIER_TYPES[0];
  const selectedEffectTargetIds = effectTargetIds(effectForm, activeRoster);

  const resetEffectForm = () => setEffectForm(blankCampaignEffectForm());

  const applyEffectPreset = presetId => {
    const preset = EFFECT_PRESETS.find(entry => entry.id === presetId);
    if (!preset) {
      setEffectForm(form => ({ ...blankCampaignEffectForm(), source_character_id: form.source_character_id }));
      return;
    }
    setEffectForm(form => ({
      ...blankCampaignEffectForm(),
      preset_id: preset.id,
      name: preset.name,
      source_character_id: form.source_character_id,
      target_scope: preset.target_scope || 'selected',
      effect_type: preset.effect_type || 'campaign_effect',
      duration: preset.duration || '',
      concentration: !!preset.concentration,
      notes: preset.notes || '',
      modifiers: preset.modifiers || [],
    }));
  };

  const toggleEffectTarget = characterId => {
    setEffectForm(form => {
      const exists = (form.target_character_ids || []).some(id => sameId(id, characterId));
      return {
        ...form,
        target_character_ids: exists
          ? (form.target_character_ids || []).filter(id => !sameId(id, characterId))
          : [...(form.target_character_ids || []), Number(characterId)],
      };
    });
  };

  const addEffectModifier = () => {
    const type = effectForm.modifier_type;
    const option = MODIFIER_TYPES.find(entry => entry.value === type);
    if (!option) return;
    const value = (effectForm.modifier_value || '').trim();
    const detail = (effectForm.modifier_detail || '').trim();
    if (option.needsValue && !value) return;
    if (!option.needsValue && !detail) return;
    const modifier = {
      type,
      value,
      detail,
      label: modifierLabel({ type, value, detail }),
    };
    setEffectForm(form => ({
      ...form,
      modifiers: [...(form.modifiers || []), modifier],
      modifier_value: '',
      modifier_detail: '',
    }));
  };

  const removeEffectModifier = index => {
    setEffectForm(form => ({
      ...form,
      modifiers: (form.modifiers || []).filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const submitCreate = async e => {
    e.preventDefault();
    setError('');
    try {
      const created = await createCampaign(name);
      setName('');
      nav(`/campaigns?id=${created.id}`);
      await loadCampaign(created.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create campaign');
    }
  };

  const submitJoin = async e => {
    e.preventDefault();
    setError('');
    try {
      const joined = await joinCampaign(inviteCode);
      setInviteCode('');
      nav(`/campaigns?id=${joined.id}`);
      await loadCampaign(joined.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not join campaign');
    }
  };

  const submitAttach = async e => {
    e.preventDefault();
    if (!campaign || !selectedCharacterId) return;
    setError('');
    try {
      await attachCharacter(campaign.id, Number(selectedCharacterId));
      setSelectedCharacterId('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add character');
    }
  };

  const submitEffect = async e => {
    e.preventDefault();
    if (!campaign || !effectForm.name.trim()) return;
    const targetIds = effectTargetIds(effectForm, activeRoster);
    if (!targetIds.length) {
      setError('Choose at least one effect target');
      return;
    }
    setError('');
    try {
      await createEffect(campaign.id, {
        name: effectForm.name,
        effect_type: effectForm.effect_type,
        status: 'pending',
        source_character_id: effectForm.source_character_id ? Number(effectForm.source_character_id) : null,
        target_character_id: targetIds.length === 1 ? targetIds[0] : null,
        payload: {
          preset_id: effectForm.preset_id,
          target_scope: effectForm.target_scope,
          target_character_ids: targetIds,
          duration: effectForm.duration,
          concentration: effectForm.concentration,
          notes: effectForm.notes,
          modifiers: effectForm.modifiers || [],
        },
      });
      resetEffectForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create effect');
    }
  };

  const submitSpellEffect = async e => {
    e.preventDefault();
    if (!campaign || !spellEffectForm.source_character_id || !spellEffectForm.target_character_id || !spellEffectForm.spell_name) return;
    setError('');
    try {
      await createEffect(campaign.id, {
        name: spellEffectForm.spell_name,
        source_character_id: Number(spellEffectForm.source_character_id),
        target_character_id: Number(spellEffectForm.target_character_id),
        effect_type: 'spell',
        status: spellEffectForm.status,
        duration: spellEffectForm.duration || selectedPreparedSpell?.duration || '',
        concentration: !!selectedPreparedSpell?.concentration,
        notes: `${selectedSpellSource?.name || 'Caster'} cast ${spellEffectForm.spell_name}.`,
        payload: {
          spell_level: selectedPreparedSpell?.level,
          casting_time: selectedPreparedSpell?.casting_time || '',
          duration: spellEffectForm.duration || selectedPreparedSpell?.duration || '',
          concentration: !!selectedPreparedSpell?.concentration,
          source: 'campaign_spell_v1',
        },
      });
      setSpellEffectForm({ source_character_id: '', spell_name: '', target_character_id: '', duration: '', status: 'pending' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create spell effect');
    }
  };

  const submitEncounter = async e => {
    e.preventDefault();
    if (!campaign || !encounterForm.name.trim()) return;
    setError('');
    try {
      const created = await createEncounter(campaign.id, { name: encounterForm.name, notes: encounterForm.notes });
      setSelectedEncounterId(created.id);
      setEncounterForm({ name: '', notes: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create encounter');
    }
  };

  const refreshInvite = async () => {
    if (!campaign) return;
    setError('');
    try {
      await regenerateInvite(campaign.id);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not regenerate invite');
    }
  };

  const copyInviteLink = async () => {
    if (!campaign?.invite_code) return;
    try {
      await navigator.clipboard.writeText(inviteUrlFor(campaign.invite_code));
    } catch (err) {
      window.prompt('Copy campaign invite link', inviteUrlFor(campaign.invite_code));
    }
  };

  const toggleRosterActive = async (entry, active) => {
    if (!campaign) return;
    await setCampaignCharacterActive(campaign.id, entry.id, active);
  };

  const detachRosterCharacter = async entry => {
    if (!campaign) return;
    await detachCharacter(campaign.id, entry.id);
  };

  const handleLeave = async () => {
    if (!campaign) return;
    setError('');
    try {
      await leaveCampaign(campaign.id);
      await fetchCampaigns();
      nav('/characters');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not leave campaign');
    }
  };

  const handleTransferOwner = async email => {
    if (!campaign) return;
    await transferCampaignOwner(campaign.id, email);
    await fetchCampaigns();
  };

  const requestDeleteCampaign = () => {
    if (!campaign) return;
    setConfirmAction({
      title: 'Delete Campaign?',
      message: `Delete ${campaign.name}? This removes members, encounters, effects, and campaign character links. This cannot be undone.`,
      confirmLabel: 'Delete Campaign',
      onConfirm: async () => {
        const deletedId = campaign.id;
        setConfirmAction(null);
        setError('');
        try {
          await deleteCampaign(deletedId);
          await fetchCampaigns();
          nav('/campaigns');
        } catch (err) {
          setError(err.response?.data?.error || 'Could not delete campaign');
        }
      },
    });
  };

  const setEffectStatus = async (effectId, status) => {
    if (!campaign) return;
    await updateEffectStatus(campaign.id, effectId, status);
    await loadCampaign(campaign.id);
  };

  const applyEncounterStatus = async (encounterId, status) => {
    if (!campaign) return;
    await updateEncounter(campaign.id, encounterId, { status });
  };

  const setEncounterStatus = async (encounterId, status) => {
    if (!campaign) return;
    if (status === 'complete') {
      const target = encounters.find(entry => entry.id === encounterId);
      setConfirmAction({
        title: 'Conclude Encounter?',
        message: `Conclude ${target?.name || 'this encounter'}? This archives the encounter and removes it from active combat flow. You can keep the saved record, but this should mean the scene is finished.`,
        confirmLabel: 'Conclude',
        onConfirm: async () => {
          setConfirmAction(null);
          setError('');
          try {
            await applyEncounterStatus(encounterId, status);
            setSelectedEncounterId(current => current === encounterId ? null : current);
            setRunningEncounterId(current => current === encounterId ? null : current);
          } catch (err) {
            setError(err.response?.data?.error || 'Could not conclude encounter');
          }
        },
      });
      return;
    }
    await applyEncounterStatus(encounterId, status);
  };

  const patchEncounterData = async (encounterId, data) => {
    if (!campaign) return;
    await updateEncounter(campaign.id, encounterId, { data });
  };

  const removeEncounter = encounterId => {
    if (!campaign) return;
    const target = encounters.find(entry => entry.id === encounterId);
    setConfirmAction({
      title: 'Delete Encounter?',
      message: `Delete ${target?.name || 'this encounter'}? This removes its combatants, initiative order, and running tracker data. This cannot be undone.`,
      confirmLabel: 'Delete Encounter',
      onConfirm: async () => {
        setConfirmAction(null);
        setError('');
        try {
          await deleteEncounter(campaign.id, encounterId);
          setSelectedEncounterId(current => current === encounterId ? null : current);
          setRunningEncounterId(current => current === encounterId ? null : current);
        } catch (err) {
          setError(err.response?.data?.error || 'Could not delete encounter');
        }
      },
    });
  };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-primary)',padding:24}}>
      <div style={{maxWidth:encounterSetupMode ? 'none' : 1100,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,gap:12}}>
          <div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:22,color:'var(--accent-light)'}}>RoundHero</div>
            <div style={{color:'var(--text-secondary)',fontSize:12}}>Campaigns</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="btn btn-secondary btn-sm" onClick={() => nav('/characters')}>Characters</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowFeedback(true)}>Feedback</button>
            <span style={{color:'var(--text-secondary)',fontSize:13}}>{user?.username}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Sign Out</button>
          </div>
        </div>

        {error && (
          <div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(230,57,70,0.1)',borderRadius:'var(--radius-sm)'}}>
            {error}
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:encounterSetupMode ? 'minmax(0,1fr)' : '320px minmax(0,1fr)',gap:16,alignItems:'start'}}>
          {!encounterSetupMode && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card">
              <form onSubmit={submitCreate}>
                <div className="form-group">
                  <label>New Campaign</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Campaign name" />
                </div>
                <button className="btn btn-primary" style={{width:'100%'}} disabled={!name.trim()}>Create</button>
              </form>
            </div>

            <div className="card">
              <form onSubmit={submitJoin}>
                <div className="form-group">
                  <label>Join Code</label>
                  <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="INVITE" />
                </div>
                <button className="btn btn-secondary" style={{width:'100%'}} disabled={!inviteCode.trim()}>Join</button>
              </form>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {loading && <div style={{color:'var(--text-dim)',fontSize:13,padding:12}}>Loading...</div>}
              {campaigns.map(entry => (
                <CampaignCard
                  key={entry.id}
                  campaign={entry}
                  selected={campaign?.id === entry.id}
                  onSelect={() => {
                    nav(`/campaigns?id=${entry.id}`);
                    loadCampaign(entry.id);
                  }}
                />
              ))}
            </div>
          </div>
          )}

          <div className="card" style={{minHeight:540}}>
            {!campaign ? (
              <div style={{color:'var(--text-secondary)',textAlign:'center',padding:48}}>No campaign selected.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:18}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div>
                    <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                      <h2 style={{color:'var(--text-primary)',fontSize:20,marginBottom:0}}>{campaign.name}</h2>
                      <RoleBadge role={campaign.role} isOwner={sameId(campaign.owner_user_id, user?.id)} />
                    </div>
                    <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:4}}>
                      Invite Code: <span style={{color:'var(--accent-light)',fontWeight:800,letterSpacing:1}}>{campaign.invite_code}</span>
                    </div>
                    <div style={{color:'var(--text-dim)',fontSize:11,marginTop:3,wordBreak:'break-all'}}>
                      {inviteUrlFor(campaign.invite_code)}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => setShowInviteEmail(true)}>Email Invite</button>
                    <button className="btn btn-secondary btn-sm" onClick={copyInviteLink}>Copy Link</button>
                    {campaign.is_dm && <button className="btn btn-secondary btn-sm" onClick={refreshInvite}>New Code</button>}
                    {sameId(campaign.owner_user_id, user?.id) && <button className="btn btn-secondary btn-sm" onClick={() => setShowTransferOwner(true)}>Transfer DM</button>}
                    {sameId(campaign.owner_user_id, user?.id) && <button className="btn btn-danger btn-sm" onClick={requestDeleteCampaign}>Delete Campaign</button>}
                    {!sameId(campaign.owner_user_id, user?.id) && <button className="btn btn-danger btn-sm" onClick={handleLeave}>Leave Campaign</button>}
                  </div>
                </div>

                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {TABS.map(tab => (
                    <TabButton key={tab} label={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)} />
                  ))}
                </div>

                {activeTab === 'Party' && (
                  <div style={{display:'flex',flexDirection:'column',gap:18}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                      <div>
                        <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:10}}>Members</h3>
                        {(campaign.members || []).map(member => (
                          <MemberRow
                            key={member.id}
                            member={member}
                            campaign={campaign}
                            onRole={(row, role) => updateMemberRole(campaign.id, row.id, role)}
                            onRemove={row => removeMember(campaign.id, row.id)}
                          />
                        ))}
                      </div>

                      <div>
                        <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:10}}>Add Character</h3>
                        <form onSubmit={submitAttach} style={{display:'flex',gap:8}}>
                          <select value={selectedCharacterId} onChange={e => setSelectedCharacterId(e.target.value)} style={{flex:1}}>
                            <option value="">Choose character</option>
                            {availableCharacters.map(character => (
                              <option key={character.id} value={character.id}>{character.name}</option>
                            ))}
                          </select>
                          <button className="btn btn-primary" disabled={!selectedCharacterId}>Add</button>
                        </form>
                        {availableCharacters.length === 0 && (
                          <div style={{color:'var(--text-dim)',fontSize:12,marginTop:8}}>
                            No unattached characters found for your account. Create or import a character, then return here to add it.
                          </div>
                        )}
                        {membersWithoutCharacters.length > 0 && (
                          <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:12}}>
                            Members without attached characters: {membersWithoutCharacters.map(member => member.username).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:4}}>Party Roster</h3>
                      <div style={{color:'var(--text-secondary)',fontSize:12,marginBottom:10}}>
                        These characters are your campaign allies for future ally-targeted spell effects.
                      </div>
                      {activeRoster.length === 0 ? (
                        <div style={{color:'var(--text-secondary)',fontSize:13}}>No characters attached.</div>
                      ) : activeRoster.map(entry => (
                        <RosterRow
                          key={entry.id}
                          entry={entry}
                          campaign={campaign}
                          user={user}
                          onPrimary={row => setPrimaryCharacter(campaign.id, row.id)}
                          onActive={toggleRosterActive}
                          onDetach={detachRosterCharacter}
                        />
                      ))}
                      {inactiveRoster.length > 0 && (
                        <div style={{marginTop:16}}>
                          <h3 style={{color:'var(--text-secondary)',fontSize:13,marginBottom:4}}>Inactive Characters</h3>
                          {inactiveRoster.map(entry => (
                            <RosterRow
                              key={entry.id}
                              entry={entry}
                              campaign={campaign}
                              user={user}
                              onPrimary={row => setPrimaryCharacter(campaign.id, row.id)}
                              onActive={toggleRosterActive}
                              onDetach={detachRosterCharacter}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'Effects' && (
                  <div>
                    <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:10}}>Party Effects</h3>
                    <form onSubmit={submitSpellEffect} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)',display:'grid',gridTemplateColumns:'1fr 1.2fr 1fr 0.8fr auto',gap:8,marginBottom:12,alignItems:'end'}}>
                      <div className="form-group" style={{marginBottom:0}}>
                        <label>Caster</label>
                        <select value={spellEffectForm.source_character_id} onChange={e => setSpellEffectForm(f => ({ ...f, source_character_id: e.target.value, spell_name: '' }))}>
                          <option value="">Source</option>
                          {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{marginBottom:0}}>
                        <label>Prepared Spell</label>
                        <select value={spellEffectForm.spell_name} onChange={e => setSpellEffectForm(f => ({ ...f, spell_name: e.target.value }))} disabled={!spellEffectForm.source_character_id}>
                          <option value="">Choose spell</option>
                          {preparedSpellOptions.map(spell => (
                            <option key={`${spell.name}_${spell.level ?? ''}`} value={spell.name}>
                              L{spell.level ?? '?'} {spell.name}{spell.concentration ? ' (Con)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{marginBottom:0}}>
                        <label>Target</label>
                        <select value={spellEffectForm.target_character_id} onChange={e => setSpellEffectForm(f => ({ ...f, target_character_id: e.target.value }))}>
                          <option value="">Target</option>
                          {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{marginBottom:0}}>
                        <label>Duration</label>
                        <input value={spellEffectForm.duration} onChange={e => setSpellEffectForm(f => ({ ...f, duration: e.target.value }))} placeholder={selectedPreparedSpell?.duration || 'Duration'} />
                      </div>
                      <button className="btn btn-primary" disabled={!spellEffectForm.source_character_id || !spellEffectForm.target_character_id || !spellEffectForm.spell_name}>Add Spell</button>
                      {selectedPreparedSpell && (
                        <div style={{gridColumn:'1 / -1',display:'flex',gap:8,flexWrap:'wrap',color:'var(--text-dim)',fontSize:11}}>
                          <span>Level {selectedPreparedSpell.level ?? '?'}</span>
                          {selectedPreparedSpell.casting_time && <span>{selectedPreparedSpell.casting_time}</span>}
                          {selectedPreparedSpell.concentration && <span style={{color:'var(--accent-light)',fontWeight:800}}>Concentration</span>}
                        </div>
                      )}
                    </form>
                    <form onSubmit={submitEffect} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)',display:'grid',gap:10,marginBottom:10}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr 1fr 0.8fr',gap:8}}>
                        <div className="form-group" style={{marginBottom:0}}>
                          <label>Canned Effect</label>
                          <select value={effectForm.preset_id} onChange={e => applyEffectPreset(e.target.value)}>
                            <option value="custom">Custom Effect</option>
                            {EFFECT_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{marginBottom:0}}>
                          <label>Name</label>
                          <input value={effectForm.name} onChange={e => setEffectForm(f => ({ ...f, name: e.target.value, preset_id: 'custom' }))} placeholder="Heroes Feast, poison cloud, boon..." />
                        </div>
                        <div className="form-group" style={{marginBottom:0}}>
                          <label>Source</label>
                          <select value={effectForm.source_character_id} onChange={e => setEffectForm(f => ({ ...f, source_character_id: e.target.value }))}>
                            <option value="">DM / Environment</option>
                            {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{marginBottom:0}}>
                          <label>Duration</label>
                          <input value={effectForm.duration} onChange={e => setEffectForm(f => ({ ...f, duration: e.target.value }))} placeholder="24 hr" />
                        </div>
                      </div>

                      <div style={{display:'grid',gridTemplateColumns:'180px minmax(0,1fr)',gap:10,alignItems:'start'}}>
                        <div className="form-group" style={{marginBottom:0}}>
                          <label>Targets</label>
                          <select value={effectForm.target_scope} onChange={e => setEffectForm(f => ({ ...f, target_scope: e.target.value, target_character_id: '', target_character_ids: [] }))}>
                            <option value="single">Single player</option>
                            <option value="selected">Selected players</option>
                            <option value="party">Entire active party</option>
                          </select>
                        </div>
                        <div>
                          {effectForm.target_scope === 'single' && (
                            <select value={effectForm.target_character_id} onChange={e => setEffectForm(f => ({ ...f, target_character_id: e.target.value }))}>
                              <option value="">Target</option>
                              {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                            </select>
                          )}
                          {effectForm.target_scope === 'selected' && (
                            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                              {activeRoster.map(entry => {
                                const active = (effectForm.target_character_ids || []).some(id => sameId(id, entry.character_id));
                                return (
                                  <button key={entry.id} type="button" className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} onClick={() => toggleEffectTarget(entry.character_id)}>
                                    {entry.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {effectForm.target_scope === 'party' && (
                            <div style={{color:'var(--text-secondary)',fontSize:12,padding:'9px 0'}}>
                              Applies to {activeRoster.length} active party member{activeRoster.length === 1 ? '' : 's'}.
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:8,display:'grid',gap:8}}>
                        <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase'}}>Buffs / Debuffs</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 0.65fr 1.4fr auto',gap:6}}>
                          <select value={effectForm.modifier_type} onChange={e => setEffectForm(f => ({ ...f, modifier_type: e.target.value, modifier_value: '', modifier_detail: '' }))}>
                            {MODIFIER_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <input value={effectForm.modifier_value} onChange={e => setEffectForm(f => ({ ...f, modifier_value: e.target.value }))} placeholder={selectedModifierType.valuePlaceholder || 'Value'} disabled={!selectedModifierType.needsValue} />
                          <input value={effectForm.modifier_detail} onChange={e => setEffectForm(f => ({ ...f, modifier_detail: e.target.value }))} placeholder={selectedModifierType.detailPlaceholder || 'Detail'} />
                          <button type="button" className="btn btn-secondary btn-sm" onClick={addEffectModifier}>Add Mod</button>
                        </div>
                        <div style={{display:'flex',gap:5,flexWrap:'wrap',minHeight:26}}>
                          {(effectForm.modifiers || []).length === 0 ? (
                            <span style={{color:'var(--text-dim)',fontSize:12}}>No modifiers yet. You can still add a reminder-only effect.</span>
                          ) : effectForm.modifiers.map((modifier, index) => (
                            <button key={`${modifier.type}_${index}`} type="button" onClick={() => removeEffectModifier(index)} style={{border:'1px solid rgba(124,92,252,0.45)',background:'rgba(124,92,252,0.18)',color:'var(--text-primary)',borderRadius:4,padding:'4px 7px',fontSize:11,fontWeight:800,cursor:'pointer'}}>
                              {modifierLabel(modifier)} x
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{display:'grid',gridTemplateColumns:'1fr auto auto',gap:8,alignItems:'center'}}>
                        <input value={effectForm.notes} onChange={e => setEffectForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes or reminders" />
                        <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-secondary)',fontSize:13,whiteSpace:'nowrap'}}>
                          <input type="checkbox" checked={effectForm.concentration} onChange={e => setEffectForm(f => ({ ...f, concentration: e.target.checked }))} style={{width:'auto'}} />
                          Concentration
                        </label>
                        <button className="btn btn-primary" disabled={!effectForm.name.trim() || selectedEffectTargetIds.length === 0}>Queue Effect</button>
                      </div>
                    </form>
                    {activeEffects.length === 0 ? (
                      <div style={{color:'var(--text-secondary)',fontSize:13}}>No active or pending effects.</div>
                    ) : activeEffects.map(effect => (
                      <EffectRow key={effect.id} effect={effect} roster={activeRoster} onStatus={setEffectStatus} />
                    ))}
                  </div>
                )}

                {activeTab === 'Encounters' && (
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:10}}>
                      <div>
                        <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:4}}>Encounters</h3>
                        <div style={{color:'var(--text-secondary)',fontSize:12}}>Planned and active combat scenes for this campaign.</div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowFeedback(true)}>Encounter Feedback</button>
                    </div>
                    {campaign.is_dm && (
                      <form onSubmit={submitEncounter} style={{display:'grid',gridTemplateColumns:'1fr 1fr auto',gap:8,marginBottom:10}}>
                        <input value={encounterForm.name} onChange={e => setEncounterForm(f => ({ ...f, name: e.target.value }))} placeholder="Encounter name" />
                        <input value={encounterForm.notes} onChange={e => setEncounterForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes" />
                        <button className="btn btn-primary" disabled={!encounterForm.name.trim()}>Create</button>
                      </form>
                    )}
                    {encounters.length === 0 ? (
                      <div style={{color:'var(--text-secondary)',fontSize:13}}>No encounters prepared yet.</div>
                    ) : encounters.map(encounter => (
                      <EncounterRow
                        key={encounter.id}
                        encounter={encounter}
                        selected={selectedEncounter?.id === encounter.id}
                        isDm={campaign.is_dm}
                        onStatus={setEncounterStatus}
                        onDelete={removeEncounter}
                        onSetup={id => setSelectedEncounterId(current => current === id ? null : id)}
                        onRun={setRunningEncounterId}
                      />
                    ))}
                    {selectedEncounter && campaign.is_dm && (
                      <EncounterBuilder
                        campaign={campaign}
                        encounter={selectedEncounter}
                        roster={activeRoster}
                        activeEffects={activeEffects}
                        monsters={monsters}
                        monsterSearch={monsterSearch}
                        setMonsterSearch={setMonsterSearch}
                        addMonsterQuantity={addMonsterQuantity}
                        setAddMonsterQuantity={setAddMonsterQuantity}
                        addMonsterInitiative={addMonsterInitiative}
                        setAddMonsterInitiative={setAddMonsterInitiative}
                        sharedInitiative={sharedInitiative}
                        setSharedInitiative={setSharedInitiative}
                        onPatchData={patchEncounterData}
                        onEffectStatus={setEffectStatus}
                        onDelete={removeEncounter}
                        onViewMonster={setViewingMonster}
                        onCloseSetup={() => setSelectedEncounterId(null)}
                      />
                    )}
                  </div>
                )}

                {activeTab === 'DM References' && (
                  <div style={{height:620,minHeight:0,display:'flex',flexDirection:'column',gap:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}>
                      <div>
                        <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:4}}>Reference Library</h3>
                        <div style={{color:'var(--text-secondary)',fontSize:12}}>
                          Codex mechanics, Nyx teachings, and Arcane Rebound table for campaign/DM lookup.
                        </div>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowFeedback(true)}>Reference Feedback</button>
                    </div>
                    <div style={{flex:1,minHeight:0,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)'}}>
                      <ReferenceLibraryContent docsPayload={referenceDocs} initialDocId="codex_mechanics" initialPage={1} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {runningEncounter && campaign?.is_dm && (
        <EncounterRunnerModal
          campaign={campaign}
          encounter={runningEncounter}
          roster={allRoster}
          monsters={monsters}
          onClose={() => setRunningEncounterId(null)}
          onPatchData={patchEncounterData}
          onStatus={setEncounterStatus}
          onDelete={removeEncounter}
          reloadCampaign={loadCampaign}
        />
      )}
      {viewingMonster && <MonsterDetailModal monster={viewingMonster} onClose={() => setViewingMonster(null)} />}
      {showInviteEmail && campaign && <CampaignInviteEmailModal campaign={campaign} onClose={() => setShowInviteEmail(false)} />}
      {showTransferOwner && campaign && <TransferOwnerModal campaign={campaign} onClose={() => setShowTransferOwner(false)} onTransfer={handleTransferOwner} />}
      {confirmAction && <ConfirmActionModal {...confirmAction} onCancel={() => setConfirmAction(null)} />}
      {showFeedback && <FeedbackModal contextLabel={campaign ? `Campaign: ${campaign.name}${selectedEncounter ? ` / Encounter: ${selectedEncounter.name}` : ''}` : 'Campaigns'} onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
