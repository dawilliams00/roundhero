import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCampaign } from '../context/CampaignContext';
import { useCharacter } from '../context/CharacterContext';
import ImportAbilityConfirmModal from '../components/ImportAbilityConfirmModal';

export default function CharacterSelect() {
  const { user, logout }              = useAuth();
  const { characters, fetchCharacters, loading, importCharacter, updateCharacter, deleteCharacter, duplicateCharacter } = useCharacter();
  const { campaigns, fetchCampaigns, createCampaign, joinCampaign, loading: campaignsLoading } = useCampaign();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const nav = useNavigate();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [campaignError, setCampaignError] = useState('');
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [importSummary, setImportSummary] = useState(null); // { name, id, summary } | null
  const [confirmingAbilities, setConfirmingAbilities] = useState(null); // imported character | null

  useEffect(() => {
    fetchCharacters();
    fetchCampaigns();
  }, [fetchCharacters, fetchCampaigns]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteCharacter(confirmDelete.id);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (id) => {
    setDuplicatingId(id);
    try {
      await duplicateCharacter(id);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      const created = await importCharacter(file);
      // Ability score confirmation always comes first (the PDF never has raw scores, so
      // this is needed for every import) - the parsing-gaps summary, if any, comes after.
      setConfirmingAbilities(created);
    } catch (err) {
      setImportError(err?.response?.data?.error || 'Import failed. Make sure this is a D&D Beyond character sheet PDF.');
    } finally {
      setImporting(false);
    }
  };

  const handleAbilitiesConfirmed = async (rawScores) => {
    const created = confirmingAbilities;
    await updateCharacter(created.id, { ability_scores: rawScores });
    setConfirmingAbilities(null);
    const summary = created.import_summary;
    const hasFindings = summary && (
      summary.unmatched_items.length || summary.unmatched_spells.length || summary.missing_fields.length
    );
    if (hasFindings) {
      setImportSummary({ id: created.id, name: created.name, summary });
    } else {
      nav(`/play/${created.id}`);
    }
  };

  const handleCreateCampaign = async e => {
    e.preventDefault();
    if (!campaignName.trim()) return;
    setCampaignBusy(true);
    setCampaignError('');
    try {
      const created = await createCampaign(campaignName.trim());
      setCampaignName('');
      nav(`/campaigns?id=${created.id}`);
    } catch (err) {
      setCampaignError(err?.response?.data?.error || 'Could not create campaign.');
    } finally {
      setCampaignBusy(false);
    }
  };

  const handleJoinCampaign = async e => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setCampaignBusy(true);
    setCampaignError('');
    try {
      const joined = await joinCampaign(inviteCode.trim());
      setInviteCode('');
      nav(`/campaigns?id=${joined.id}`);
    } catch (err) {
      setCampaignError(err?.response?.data?.error || 'Could not join campaign.');
    } finally {
      setCampaignBusy(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-primary)',padding:24}}>
      <div style={{maxWidth:980,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:32}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:22,color:'var(--accent-light)'}}>RoundHero</div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <button className="btn btn-secondary btn-sm" onClick={() => nav('/campaigns')}>🗺 Campaigns</button>
            <span style={{color:'var(--text-secondary)',fontSize:13}}>{user?.username}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Sign Out</button>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:8}}>
          <h2 style={{color:'var(--text-primary)',fontSize:18,fontWeight:500}}>Active Characters</h2>
          <div style={{display:'flex',gap:8}}>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} style={{display:'none'}} />
            <button className="btn btn-secondary" disabled={importing} onClick={() => fileInputRef.current.click()}>
              {importing ? 'Importing...' : '⬆ Import PDF'}
            </button>
            <button className="btn btn-primary" onClick={() => nav('/setup')}>+ New Character</button>
          </div>
        </div>
        {importError && <div style={{color:'var(--danger)',fontSize:12,marginBottom:12}}>{importError}</div>}
        <div style={{marginBottom:20}} />
        {loading ? (
          <div style={{textAlign:'center',color:'var(--text-dim)',padding:40}}>Loading...</div>
        ) : characters.length === 0 ? (
          <div className="card" style={{textAlign:'center',padding:48}}>
            <div style={{fontSize:48,marginBottom:16}}>🎲</div>
            <div style={{color:'var(--text-secondary)',marginBottom:20}}>No characters yet.</div>
            <button className="btn btn-primary" onClick={() => nav('/setup')}>Create Your First Character</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {characters.map(c => (
              <div key={c.id} style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:16}}>
                <button onClick={() => nav(`/play/${c.id}`)} style={{flex:1,background:'none',border:'none',textAlign:'left',cursor:'pointer',padding:0}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <div>
                      <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:16,marginBottom:2}}>{c.name}</div>
                      <div style={{color:'var(--text-secondary)',fontSize:13}}>Level {c.level} {c.race} {c.class_name}</div>
                    </div>
                    <div style={{color:'var(--accent-light)',fontSize:20}}>→</div>
                  </div>
                </button>
                <button className="btn btn-secondary btn-sm" disabled={duplicatingId === c.id} onClick={() => handleDuplicate(c.id)} title="Make an independent copy to freely experiment with (leveling, build changes) without touching the original">
                  {duplicatingId === c.id ? 'Copying...' : '📋 Duplicate'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(c)}>Delete</button>
              </div>
            ))}
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 300px',gap:16,alignItems:'start',marginTop:32}}>
          <div className="card">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14}}>
              <div>
                <h2 style={{color:'var(--text-primary)',fontSize:18,fontWeight:600,marginBottom:2}}>Campaigns</h2>
                <div style={{color:'var(--text-secondary)',fontSize:12}}>Your parties and allies.</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => nav('/campaigns')}>Manage</button>
            </div>

            {campaignsLoading ? (
              <div style={{color:'var(--text-dim)',padding:'18px 0'}}>Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:13,padding:'14px 0'}}>
                You are not in a campaign yet. Your characters remain available above.
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
                {campaigns.map(campaign => (
                  <button
                    key={campaign.id}
                    onClick={() => nav(`/campaigns?id=${campaign.id}`)}
                    style={{textAlign:'left',background:'var(--bg-hover)',border:'1px solid var(--border-light)',borderRadius:'var(--radius-sm)',padding:12}}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}}>
                      <div>
                        <div style={{color:'var(--text-primary)',fontWeight:700,fontSize:15}}>{campaign.name}</div>
                        <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:3}}>
                          {campaign.member_count || 0} members · {campaign.character_count || 0} characters
                        </div>
                      </div>
                      <span style={{color:'var(--accent-light)',fontSize:10,textTransform:'uppercase',fontWeight:800}}>{campaign.role || 'player'}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{display:'flex',flexDirection:'column',gap:12}}>
            <form onSubmit={handleCreateCampaign}>
              <div className="form-group" style={{marginBottom:8}}>
                <label>Create Campaign</label>
                <input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Campaign name" />
              </div>
              <button className="btn btn-primary" style={{width:'100%'}} disabled={campaignBusy || !campaignName.trim()}>Create Campaign</button>
            </form>

            <form onSubmit={handleJoinCampaign}>
              <div className="form-group" style={{marginBottom:8}}>
                <label>Join Campaign</label>
                <input value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} placeholder="Invite code" />
              </div>
              <button className="btn btn-secondary" style={{width:'100%'}} disabled={campaignBusy || !inviteCode.trim()}>Join Campaign</button>
            </form>

            {campaignError && <div style={{color:'var(--danger)',fontSize:12}}>{campaignError}</div>}
          </div>
        </div>
      </div>

      {confirmingAbilities && (
        <ImportAbilityConfirmModal character={confirmingAbilities} onConfirm={handleAbilitiesConfirmed} />
      )}

      {importSummary && (
        <div className="modal-overlay" onClick={() => { setImportSummary(null); nav(`/play/${importSummary.id}`); }}>
          <div className="modal" style={{maxWidth:440}} onClick={e => e.stopPropagation()}>
            <h2>Imported {importSummary.name}</h2>
            <p style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.6,marginBottom:10}}>
              The PDF parsed successfully, but a few things below are worth a quick check before you start playing.
            </p>
            {importSummary.summary.missing_fields.length > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--warning)',fontSize:12,fontWeight:700,marginBottom:4}}>Not found in the PDF</div>
                <ul style={{margin:0,paddingLeft:18,color:'var(--text-secondary)',fontSize:12}}>
                  {importSummary.summary.missing_fields.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
            {importSummary.summary.unmatched_items.length > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--warning)',fontSize:12,fontWeight:700,marginBottom:4}}>
                  Items not matched to the database ({importSummary.summary.unmatched_items.length})
                </div>
                <div style={{color:'var(--text-secondary)',fontSize:12}}>
                  These kept their printed name/weight but have no charges, buffs, or description auto-filled: {importSummary.summary.unmatched_items.join(', ')}
                </div>
              </div>
            )}
            {importSummary.summary.unmatched_spells.length > 0 && (
              <div style={{marginBottom:10}}>
                <div style={{color:'var(--warning)',fontSize:12,fontWeight:700,marginBottom:4}}>
                  Spells not matched to the database ({importSummary.summary.unmatched_spells.length})
                </div>
                <div style={{color:'var(--text-secondary)',fontSize:12}}>
                  These will display, but won't have structured damage/save data: {importSummary.summary.unmatched_spells.join(', ')}
                </div>
              </div>
            )}
            <div style={{color:'var(--text-dim)',fontSize:11,marginTop:8}}>
              Parsed {importSummary.summary.features_found} features, {importSummary.summary.spells_found} spells, {importSummary.summary.items_found} items.
            </div>
            <button className="btn btn-primary" style={{width:'100%',marginTop:16}}
              onClick={() => { const id = importSummary.id; setImportSummary(null); nav(`/play/${id}`); }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="modal" style={{maxWidth:360}} onClick={e => e.stopPropagation()}>
            <h2>Delete {confirmDelete.name}?</h2>
            <p style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.6}}>
              This permanently deletes this character and all of its data. This can't be undone.
            </p>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn btn-secondary" style={{flex:1}} disabled={deleting} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" style={{flex:1}} disabled={deleting} onClick={handleDelete}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
