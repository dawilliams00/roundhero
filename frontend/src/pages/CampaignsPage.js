import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCampaign } from '../context/CampaignContext';
import { useCharacter } from '../context/CharacterContext';

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
        <span style={{color:'var(--accent-light)',fontSize:11,textTransform:'uppercase',fontWeight:700}}>
          {campaign.role || 'player'}
        </span>
      </div>
    </button>
  );
}

function RosterRow({ entry, canRemove, onRemove }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
      <div>
        <div style={{color:'var(--text-primary)',fontWeight:600}}>{entry.name}</div>
        <div style={{color:'var(--text-secondary)',fontSize:12}}>
          Level {entry.level || '?'} {entry.race} {entry.class_name} · {entry.username}
        </div>
      </div>
      {canRemove && (
        <button className="btn btn-secondary btn-sm" onClick={onRemove}>Remove</button>
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
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
      <div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <span style={{color:'var(--text-primary)',fontWeight:700}}>{effect.name}</span>
          <span style={{color:statusColor,fontSize:11,textTransform:'uppercase',fontWeight:700}}>{effect.status}</span>
        </div>
        <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:3}}>
          {effect.source_character_name || 'Unknown'} → {effect.target_character_name || 'Unassigned'}
        </div>
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

export default function CampaignsPage() {
  const nav = useNavigate();
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
    createEffect,
    updateEffectStatus,
  } = useCampaign();
  const { characters, fetchCharacters } = useCharacter();

  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState('');
  const [effectForm, setEffectForm] = useState({
    name: '',
    source_character_id: '',
    target_character_id: '',
    effect_type: 'spell',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCampaigns();
    fetchCharacters();
  }, [fetchCampaigns, fetchCharacters]);

  useEffect(() => {
    if (!campaigns.length || campaign) return;
    loadCampaign(campaigns[0].id);
  }, [campaigns, campaign, loadCampaign]);

  const availableCharacters = useMemo(() => {
    const attached = new Set((campaign?.characters || []).filter(c => c.active).map(c => c.character_id));
    return characters.filter(character => !attached.has(character.id));
  }, [campaign, characters]);

  const activeRoster = (campaign?.characters || []).filter(entry => entry.active);
  const activeEffects = (campaign?.effects || []).filter(effect => effect.status !== 'removed');

  const submitCreate = async e => {
    e.preventDefault();
    setError('');
    try {
      const created = await createCampaign(name);
      setName('');
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
        payload: {},
      });
      setEffectForm({ name: '', source_character_id: '', target_character_id: '', effect_type: 'spell' });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create effect');
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

  const removeCharacter = async entry => {
    if (!campaign) return;
    await detachCharacter(campaign.id, entry.id);
  };

  const setEffectStatus = async (effectId, status) => {
    if (!campaign) return;
    await updateEffectStatus(campaign.id, effectId, status);
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
                  onSelect={() => loadCampaign(entry.id)}
                />
              ))}
            </div>
          </div>

          <div className="card" style={{minHeight:500}}>
            {!campaign ? (
              <div style={{color:'var(--text-secondary)',textAlign:'center',padding:48}}>No campaign selected.</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:20}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div>
                    <h2 style={{color:'var(--text-primary)',fontSize:20,marginBottom:4}}>{campaign.name}</h2>
                    <div style={{color:'var(--text-secondary)',fontSize:12}}>
                      Invite Code: <span style={{color:'var(--accent-light)',fontWeight:800,letterSpacing:1}}>{campaign.invite_code}</span>
                    </div>
                  </div>
                  {campaign.is_dm && (
                    <button className="btn btn-secondary btn-sm" onClick={refreshInvite}>New Code</button>
                  )}
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div>
                    <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:10}}>Members</h3>
                    {(campaign.members || []).map(member => (
                      <div key={member.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)',gap:8}}>
                        <span style={{color:'var(--text-primary)'}}>{member.username}</span>
                        <span style={{color:'var(--text-secondary)',fontSize:12,textTransform:'uppercase'}}>{member.role}</span>
                      </div>
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
                  </div>
                </div>

                <div>
                  <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:10}}>Party Roster</h3>
                  {activeRoster.length === 0 ? (
                    <div style={{color:'var(--text-secondary)',fontSize:13}}>No characters attached.</div>
                  ) : activeRoster.map(entry => (
                    <RosterRow
                      key={entry.id}
                      entry={entry}
                      canRemove={campaign.is_dm || entry.user_id === user?.id}
                      onRemove={() => removeCharacter(entry)}
                    />
                  ))}
                </div>

                <div>
                  <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:10}}>Party Effects</h3>
                  <form onSubmit={submitEffect} style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr auto',gap:8,marginBottom:8}}>
                    <input
                      value={effectForm.name}
                      onChange={e => setEffectForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Effect or spell"
                    />
                    <select
                      value={effectForm.source_character_id}
                      onChange={e => setEffectForm(f => ({ ...f, source_character_id: e.target.value }))}
                    >
                      <option value="">Source</option>
                      {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                    </select>
                    <select
                      value={effectForm.target_character_id}
                      onChange={e => setEffectForm(f => ({ ...f, target_character_id: e.target.value }))}
                    >
                      <option value="">Target</option>
                      {activeRoster.map(entry => <option key={entry.id} value={entry.character_id}>{entry.name}</option>)}
                    </select>
                    <button className="btn btn-primary" disabled={!effectForm.name.trim()}>Add</button>
                  </form>
                  {activeEffects.length === 0 ? (
                    <div style={{color:'var(--text-secondary)',fontSize:13}}>No active or pending effects.</div>
                  ) : activeEffects.map(effect => (
                    <EffectRow key={effect.id} effect={effect} onStatus={setEffectStatus} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
