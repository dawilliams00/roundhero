import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,background:'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)'}}>
      <div style={{textAlign:'center',maxWidth:560}}>
        <div style={{fontSize:64,marginBottom:16}}>⚔️</div>
        <h1 style={{fontFamily:"'Cinzel',serif",fontSize:48,color:'var(--accent-light)',marginBottom:8,letterSpacing:2}}>RoundHero</h1>
        <p style={{color:'var(--text-secondary)',fontSize:18,marginBottom:8}}>D&D 5e Combat Tracker</p>
        <p style={{color:'var(--text-dim)',fontSize:14,marginBottom:40,lineHeight:1.8}}>
          Track your turn, your abilities, your spells — everything you need mid-combat on one screen. Works for every class and character type.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center'}}>
          {user ? (
            <button className="btn btn-primary" style={{fontSize:16,padding:'12px 32px'}} onClick={() => nav('/characters')}>My Characters</button>
          ) : (
            <>
              <button className="btn btn-primary" style={{fontSize:16,padding:'12px 32px'}} onClick={() => nav('/auth?mode=register')}>Get Started — Free</button>
              <button className="btn btn-secondary" style={{fontSize:16,padding:'12px 32px'}} onClick={() => nav('/auth?mode=login')}>Sign In</button>
            </>
          )}
        </div>
        <div style={{marginTop:60,display:'flex',gap:32,justifyContent:'center',flexWrap:'wrap'}}>
          {[
            ['🎯','Action Economy','See exactly what you can do on your turn'],
            ['⚡','All Classes','Fighter to Wizard — every class auto-populated'],
            ['🔄','Rest Tracking','Long and short rests reset everything automatically'],
            ['✏️','Fully Custom','Add any homebrew ability, feat, or item'],
          ].map(([icon,title,desc]) => (
            <div key={title} style={{textAlign:'center',maxWidth:120}}>
              <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
              <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13,marginBottom:4}}>{title}</div>
              <div style={{color:'var(--text-dim)',fontSize:11,lineHeight:1.5}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
