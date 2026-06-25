import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCharacter } from '../context/CharacterContext';

export default function CharacterSelect() {
  const { user, logout }              = useAuth();
  const { characters, fetchCharacters, loading } = useCharacter();
  const nav = useNavigate();

  useEffect(() => { fetchCharacters(); }, [fetchCharacters]);

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
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <h2 style={{color:'var(--text-primary)',fontSize:18,fontWeight:500}}>Your Characters</h2>
          <button className="btn btn-primary" onClick={() => nav('/setup')}>+ New Character</button>
        </div>
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
              <button key={c.id} onClick={() => nav(`/play/${c.id}`)} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:16,textAlign:'left',width:'100%',cursor:'pointer',transition:'border-color 0.15s'}}
                onMouseEnter={e => e.currentTarget.style.borderColor='var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
              >
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:16,marginBottom:2}}>{c.name}</div>
                    <div style={{color:'var(--text-secondary)',fontSize:13}}>Level {c.level} {c.race} {c.class_name}</div>
                  </div>
                  <div style={{color:'var(--accent-light)',fontSize:20}}>→</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
