import React, { useMemo, useState } from 'react';

function cleanList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function EffectPill({ children, tone = 'neutral' }) {
  const colors = {
    enemy: 'rgba(230,57,70,0.22)',
    player: 'rgba(32,201,151,0.18)',
    effect: 'rgba(124,92,252,0.22)',
    neutral: 'rgba(255,255,255,0.08)',
  };
  return (
    <span style={{border:'1px solid var(--border)',background:colors[tone] || colors.neutral,color:'var(--text-primary)',borderRadius:10,padding:'2px 7px',fontSize:11,fontWeight:700}}>
      {children}
    </span>
  );
}

function CombatantPublicRow({ row }) {
  const isPlayer = row.type === 'player';
  const conditions = cleanList(row.conditions);
  const effects = cleanList(row.effects);
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}>
        <div>
          <div style={{display:'flex',gap:7,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{color:'var(--text-primary)',fontWeight:900}}>{row.name}</span>
            <EffectPill tone={isPlayer ? 'player' : 'enemy'}>{isPlayer ? 'Ally' : 'Enemy'}</EffectPill>
            {row.initiative !== '' && <span style={{color:'var(--text-dim)',fontSize:11}}>Init {row.initiative}</span>}
          </div>
          {isPlayer && (
            <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:4}}>
              HP {row.hp_current ?? '?'}/{row.hp_max ?? '?'}{row.temp_hp ? ` +${row.temp_hp} temp` : ''}
            </div>
          )}
          {!isPlayer && (
            <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}>Enemy HP hidden</div>
          )}
        </div>
        {row.concentration && <EffectPill tone="effect">Con: {row.concentration}</EffectPill>}
      </div>
      <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8,minHeight:22}}>
        {conditions.length === 0 && effects.length === 0 && !row.concentration && <span style={{color:'var(--text-dim)',fontSize:12}}>No visible statuses</span>}
        {conditions.map(condition => <EffectPill key={condition} tone={isPlayer ? 'player' : 'enemy'}>{condition}</EffectPill>)}
        {effects.map(effect => (
          <EffectPill key={effect.id || effect.name} tone="effect">
            {effect.name || effect}
          </EffectPill>
        ))}
      </div>
      {row.notes && <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:8,whiteSpace:'pre-wrap'}}>{row.notes}</div>}
    </div>
  );
}

export default function CampaignPlayerViewModal({ views, onClose }) {
  const [selectedId, setSelectedId] = useState(views[0]?.id || '');
  const selected = useMemo(() => (
    views.find(view => String(view.id) === String(selectedId)) || views[0]
  ), [selectedId, views]);
  const encounters = selected?.encounters || [];
  const effects = selected?.effects || [];

  return (
    <div className="modal-overlay" onClick={onClose} style={{zIndex:2600}}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{width:'min(960px,94vw)',maxWidth:'none',maxHeight:'88vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',borderBottom:'1px solid var(--border)',paddingBottom:10}}>
          <div>
            <h2 style={{marginBottom:3}}>Campaign View</h2>
            <div style={{color:'var(--text-secondary)',fontSize:12}}>Visible encounter status for {selected?.character_name || 'this character'}.</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>

        {views.length > 1 && (
          <div className="form-group" style={{marginTop:12}}>
            <label>Campaign</label>
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              {views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
          </div>
        )}

        <div style={{overflowY:'auto',minHeight:0,paddingTop:12,display:'grid',gap:12}}>
          <section>
            <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:8}}>Active Encounters</h3>
            {encounters.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:13}}>No running encounters are visible right now.</div>
            ) : encounters.map(encounter => (
              <div key={encounter.id} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-card)',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginBottom:8}}>
                  <div style={{color:'var(--text-primary)',fontWeight:900}}>{encounter.name}</div>
                  <EffectPill tone={encounter.status === 'running' ? 'player' : 'neutral'}>{encounter.status}</EffectPill>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:8}}>
                  {(encounter.combatants || []).map(row => <CombatantPublicRow key={row.id || row.name} row={row} />)}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:8}}>My Campaign Effects</h3>
            {effects.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:13}}>No active campaign effects for this character.</div>
            ) : effects.map(effect => (
              <div key={effect.id} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)',marginBottom:8}}>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{color:'var(--text-primary)',fontWeight:900}}>{effect.name}</span>
                  <EffectPill tone="effect">{effect.status}</EffectPill>
                  {effect.payload?.concentration && <EffectPill tone="effect">Concentration</EffectPill>}
                </div>
                <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:4}}>
                  {effect.source_character_name || 'Unknown'} to {effect.target_character_name || 'Unassigned'}
                  {effect.payload?.duration ? ` · ${effect.payload.duration}` : ''}
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
