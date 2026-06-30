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
const ENCOUNTER_STATUSES = ['planned', 'running', 'paused', 'complete'];

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

function inviteUrlFor(code) {
  const origin = window.location.origin;
  return `${origin}/campaigns?join=${encodeURIComponent(code || '')}`;
}

function mailtoForInvite(campaign) {
  const url = inviteUrlFor(campaign?.invite_code);
  const subject = encodeURIComponent(`Join my RoundHero campaign: ${campaign?.name || 'Campaign'}`);
  const body = encodeURIComponent(
    `You have been invited to join ${campaign?.name || 'my RoundHero campaign'}.\n\n` +
    `Invite code: ${campaign?.invite_code || ''}\n\n` +
    `Open this link, sign in, and join the campaign:\n${url}`
  );
  return `mailto:?subject=${subject}&body=${body}`;
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
  const hp = entry.sheet_snapshot?.hp || {};
  if (hp.current == null && hp.max == null) return 'HP ?';
  return `HP ${hp.current ?? '?'}/${hp.max ?? '?'}${hp.temp ? ` +${hp.temp}` : ''}`;
}

function rosterConText(entry) {
  const slots = entry.sheet_snapshot?.concentration_slots || [];
  if (!slots.length) return '';
  return slots.map(slot => slot.spell).filter(Boolean).join(' / ');
}

function combatantFromRosterEntry(entry) {
  const snapshot = entry.sheet_snapshot || {};
  const hp = snapshot.hp || {};
  return normalizeCombatant({
    type: 'player',
    name: entry.name,
    character_id: entry.character_id,
    user_id: entry.user_id,
    group_key: 'Players',
    hp_current: hp.current ?? '',
    hp_max: hp.max ?? '',
    temp_hp: hp.temp ?? 0,
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

function RosterRow({ entry, campaign, user, onPrimary, onActive }) {
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
        </div>
      )}
    </div>
  );
}

function EffectRow({ effect, onStatus }) {
  const statusColor = effect.status === 'applied'
    ? 'var(--success)'
    : effect.status === 'pending'
      ? 'var(--warning)'
      : 'var(--text-secondary)';
  const concentration = effect.payload?.concentration ? 'Concentration' : '';
  const duration = effect.payload?.duration || '';
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
      <div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{color:'var(--text-primary)',fontWeight:700}}>{effect.name}</span>
          <span style={{color:statusColor,fontSize:11,textTransform:'uppercase',fontWeight:700}}>{effect.status}</span>
          {concentration && <span style={{color:'var(--accent-light)',fontSize:11,fontWeight:700}}>{concentration}</span>}
        </div>
        <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:3}}>
          {effect.source_character_name || 'Unknown'} → {effect.target_character_name || 'Unassigned'}
          {duration ? ` · ${duration}` : ''}
        </div>
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

function EncounterRow({ encounter, selected, isDm, onStatus, onDelete, onSelect, onRun }) {
  const nextActions = {
    planned: [['Start', 'running']],
    running: [['Pause', 'paused'], ['Complete', 'complete']],
    paused: [['Resume', 'running'], ['Complete', 'complete']],
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
          <button className="btn btn-primary btn-sm" onClick={() => onSelect(encounter.id)}>{selected ? 'Open' : 'Build'}</button>
          <button className="btn btn-success btn-sm" onClick={() => onRun(encounter.id)}>Run</button>
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
  onStatus,
  onDelete,
  onViewMonster,
}) {
  const data = encounter?.data || {};
  const combatants = sortedCombatants(encounter);
  const filteredMonsters = monsters
    .filter(monster => !monsterSearch.trim() || monster.name.toLowerCase().includes(monsterSearch.toLowerCase()))
    .slice(0, 8);

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
            {ENCOUNTER_STATUSES.filter(status => status !== encounter.status).map(status => (
              <button key={status} className="btn btn-secondary btn-sm" onClick={() => onStatus(encounter.id, status)}>
                {status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(encounter.id)}>Delete</button>
          </div>
        )}
      </div>

      {campaign.is_dm && (
        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1.3fr)',gap:12}}>
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

          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10}}>
            <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase',marginBottom:8}}>Pull Enemy</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 64px 88px',gap:6,marginBottom:8}}>
              <input value={monsterSearch} onChange={e => setMonsterSearch(e.target.value)} placeholder="Search bestiary" />
              <input value={addMonsterQuantity} onChange={e => setAddMonsterQuantity(e.target.value)} placeholder="Qty" />
              <input value={addMonsterInitiative} onChange={e => setAddMonsterInitiative(e.target.value)} placeholder="Init" />
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-secondary)',fontSize:12,marginBottom:8}}>
              <input type="checkbox" checked={sharedInitiative} onChange={e => setSharedInitiative(e.target.checked)} style={{width:'auto'}} />
              Shared initiative for this group
            </label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:6}}>
              {filteredMonsters.map(monster => (
                <button key={monster._custom_id ? `custom_${monster._custom_id}` : monster.name} className="btn btn-secondary btn-sm" onClick={() => addMonster(monster)} style={{textAlign:'left'}}>
                  {monster.name} <span style={{color:'var(--text-dim)'}}>CR {monster.challenge_rating}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{overflowX:'auto'}}>
        <div style={{minWidth:860}}>
          <div style={{display:'grid',gridTemplateColumns:'64px 1.3fr 130px 110px 1.1fr 1fr 110px 86px',gap:6,color:'var(--text-secondary)',fontSize:11,fontWeight:800,textTransform:'uppercase',padding:'0 0 6px'}}>
            <div>Init</div>
            <div>Name</div>
            <div>HP / Temp</div>
            <div>AC / Type</div>
            <div>Conditions</div>
            <div>Concentration</div>
            <div>Death Saves</div>
            <div />
          </div>
          {combatants.length === 0 ? (
            <div style={{color:'var(--text-secondary)',fontSize:13,padding:'20px 0'}}>No combatants yet.</div>
          ) : combatants.map(row => (
            <div key={row.id} style={{display:'grid',gridTemplateColumns:'64px 1.3fr 130px 110px 1.1fr 1fr 110px 86px',gap:6,alignItems:'center',padding:'7px 0',borderTop:'1px solid var(--border)'}}>
              <input value={row.initiative} onChange={e => updateCombatant(row.id, { initiative: e.target.value })} />
              <div>
                <input value={row.name} onChange={e => updateCombatant(row.id, { name: e.target.value })} />
                <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2}}>
                  {row.group_key ? `Group: ${row.group_key.split('_')[0]}` : row.type}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                <input value={row.hp_current} onChange={e => updateCombatant(row.id, { hp_current: e.target.value })} placeholder="HP" />
                <input value={row.temp_hp} onChange={e => updateCombatant(row.id, { temp_hp: e.target.value })} placeholder="Temp" />
                <button className="btn btn-secondary btn-sm" onClick={() => updateCombatant(row.id, { hp_current: Math.max(0, toNumber(row.hp_current) - 1) })}>-1</button>
                <button className="btn btn-secondary btn-sm" onClick={() => updateCombatant(row.id, { hp_current: toNumber(row.hp_current) + 1 })}>+1</button>
              </div>
              <div>
                <input value={row.ac} onChange={e => updateCombatant(row.id, { ac: e.target.value })} placeholder="AC" />
                <div style={{color:row.type === 'player' ? 'var(--accent-light)' : 'var(--warning)',fontSize:11,marginTop:3}}>{row.type}</div>
              </div>
              <input value={(row.conditions || []).join(', ')} onChange={e => updateConditionText(row, e.target.value)} placeholder="poisoned, hexed" />
              <input value={row.concentration} onChange={e => updateCombatant(row.id, { concentration: e.target.value })} placeholder="Spell or effect" />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                <button className="btn btn-secondary btn-sm" onClick={() => setDeathSave(row, 'successes', 1)}>S {row.death_saves?.successes || 0}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setDeathSave(row, 'failures', 1)}>F {row.death_saves?.failures || 0}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => updateCombatant(row.id, { death_saves: { successes: 0, failures: 0 } })} style={{gridColumn:'1 / -1'}}>Reset</button>
              </div>
              <div style={{display:'flex',gap:4}}>
                {row.monster && <button className="btn btn-secondary btn-sm" onClick={() => onViewMonster(row.monster)}>Stats</button>}
                {campaign.is_dm && <button className="btn btn-danger btn-sm" onClick={() => removeCombatant(row.id)}>X</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
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
    setCampaignCharacterActive,
    setPrimaryCharacter,
    updateMemberRole,
    removeMember,
    leaveCampaign,
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
  const [effectForm, setEffectForm] = useState({
    name: '',
    source_character_id: '',
    target_character_id: '',
    effect_type: 'spell',
    duration: '',
    concentration: false,
    notes: '',
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
  const selectedEncounter = encounters.find(entry => entry.id === selectedEncounterId) || encounters[0] || null;
  const runningEncounter = encounters.find(entry => entry.id === runningEncounterId) || null;
  const attached = useMemo(
    () => new Set(activeRoster.map(entry => entry.character_id)),
    [activeRoster]
  );
  const availableCharacters = characters.filter(character => !attached.has(character.id));
  const membersWithoutCharacters = (campaign?.members || []).filter(member => (
    !activeRoster.some(entry => entry.user_id === member.user_id)
  ));

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
    setError('');
    try {
      await createEffect(campaign.id, {
        ...effectForm,
        source_character_id: effectForm.source_character_id ? Number(effectForm.source_character_id) : null,
        target_character_id: effectForm.target_character_id ? Number(effectForm.target_character_id) : null,
      });
      setEffectForm({ name: '', source_character_id: '', target_character_id: '', effect_type: 'spell', duration: '', concentration: false, notes: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create effect');
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

  const setEffectStatus = async (effectId, status) => {
    if (!campaign) return;
    await updateEffectStatus(campaign.id, effectId, status);
  };

  const setEncounterStatus = async (encounterId, status) => {
    if (!campaign) return;
    await updateEncounter(campaign.id, encounterId, { status });
  };

  const patchEncounterData = async (encounterId, data) => {
    if (!campaign) return;
    await updateEncounter(campaign.id, encounterId, { data });
  };

  const removeEncounter = async encounterId => {
    if (!campaign) return;
    await deleteEncounter(campaign.id, encounterId);
    setSelectedEncounterId(null);
  };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-primary)',padding:24}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
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

        <div style={{display:'grid',gridTemplateColumns:'320px minmax(0,1fr)',gap:16,alignItems:'start'}}>
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
                    <a className="btn btn-secondary btn-sm" href={mailtoForInvite(campaign)}>Email Invite</a>
                    <button className="btn btn-secondary btn-sm" onClick={copyInviteLink}>Copy Link</button>
                    {campaign.is_dm && <button className="btn btn-secondary btn-sm" onClick={refreshInvite}>New Code</button>}
                    {!sameId(campaign.owner_user_id, user?.id) && <button className="btn btn-secondary btn-sm" onClick={handleLeave}>Leave</button>}
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
                    <form onSubmit={submitEffect} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr',gap:8,marginBottom:8}}>
                      <input value={effectForm.name} onChange={e => setEffectForm(f => ({ ...f, name: e.target.value }))} placeholder="Effect or spell" />
                      <select value={effectForm.source_character_id} onChange={e => setEffectForm(f => ({ ...f, source_character_id: e.target.value }))}>
                        <option value="">Source</option>
                        {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                      </select>
                      <select value={effectForm.target_character_id} onChange={e => setEffectForm(f => ({ ...f, target_character_id: e.target.value }))}>
                        <option value="">Target</option>
                        {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                      </select>
                      <input value={effectForm.duration} onChange={e => setEffectForm(f => ({ ...f, duration: e.target.value }))} placeholder="Duration" />
                      <label style={{display:'flex',alignItems:'center',gap:8,color:'var(--text-secondary)',fontSize:13}}>
                        <input type="checkbox" checked={effectForm.concentration} onChange={e => setEffectForm(f => ({ ...f, concentration: e.target.checked }))} style={{width:'auto'}} />
                        Concentration
                      </label>
                      <button className="btn btn-primary" disabled={!effectForm.name.trim()}>Add Effect</button>
                      <input style={{gridColumn:'1 / -1'}} value={effectForm.notes} onChange={e => setEffectForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes or reminders" />
                    </form>
                    {activeEffects.length === 0 ? (
                      <div style={{color:'var(--text-secondary)',fontSize:13}}>No active or pending effects.</div>
                    ) : activeEffects.map(effect => (
                      <EffectRow key={effect.id} effect={effect} onStatus={setEffectStatus} />
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
                        onSelect={setSelectedEncounterId}
                        onRun={setRunningEncounterId}
                      />
                    ))}
                    {selectedEncounter && campaign.is_dm && (
                      <EncounterBuilder
                        campaign={campaign}
                        encounter={selectedEncounter}
                        roster={activeRoster}
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
                        onStatus={setEncounterStatus}
                        onDelete={removeEncounter}
                        onViewMonster={setViewingMonster}
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
      {showFeedback && <FeedbackModal contextLabel={campaign ? `Campaign: ${campaign.name}${selectedEncounter ? ` / Encounter: ${selectedEncounter.name}` : ''}` : 'Campaigns'} onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
