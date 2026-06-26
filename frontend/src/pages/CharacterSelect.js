import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCharacter } from '../context/CharacterContext';

export default function CharacterSelect() {
  const { user, logout }              = useAuth();
  const { characters, fetchCharacters, loading, importCharacter, deleteCharacter } = useCharacter();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const nav = useNavigate();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

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

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportError('');
    try {
      const created = await importCharacter(file);
      nav(`/play/${created.id}`);
    } catch (err) {
      setImportError(err?.response?.data?.error || 'Import failed. Make sure this is a D&D Beyond character sheet PDF.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-primary)',padding:24}}>
      <div style={{maxWidth:600,margin:'0 auto'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:32}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:22,color:'var(--accent-light)'}}>RoundHero</div>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <span style={{color:'var(--text-secondary)',fontSize:13}}>{user?.username}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Sign Out</button>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:8}}>
          <h2 style={{color:'var(--text-primary)',fontSize:18,fontWeight:500}}>Your Characters</h2>
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
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(c)}>Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>

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
