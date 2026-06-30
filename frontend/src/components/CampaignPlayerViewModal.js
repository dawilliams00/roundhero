import React, { useMemo, useState } from 'react';

function cleanList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function EffectPill({ children, tone = 'neutral' }) {
  const colors = {
    enemy: { bg: 'rgba(230,57,70,0.26)', border: 'rgba(230,57,70,0.65)', color: '#ffd1d6' },
    player: { bg: 'rgba(32,201,151,0.22)', border: 'rgba(32,201,151,0.60)', color: '#c9fff0' },
    effect: { bg: 'rgba(124,92,252,0.28)', border: 'rgba(154,128,255,0.70)', color: '#e4dcff' },
    neutral: { bg: 'rgba(255,255,255,0.09)', border: 'rgba(255,255,255,0.18)', color: 'var(--text-primary)' },
  };
  const style = colors[tone] || colors.neutral;
  return (
    <span style={{border:`1px solid ${style.border}`,background:style.bg,color:style.color,borderRadius:10,padding:'2px 7px',fontSize:11,fontWeight:800,whiteSpace:'nowrap'}}>
      {children}
    </span>
  );
}

function CombatantPublicRow({ row }) {
  const isPlayer = row.type === 'player';
  const conditions = cleanList(row.conditions);
  const effects = cleanList(row.effects);
  const hasVisibleStatus = conditions.length > 0 || effects.length > 0 || row.concentration;
  return (
    <div style={{
      border:`1px solid ${isPlayer ? 'rgba(32,201,151,0.44)' : 'rgba(230,57,70,0.36)'}`,
      borderRadius:'var(--radius-sm)',
      padding:10,
      background:isPlayer ? 'rgba(19,48,64,0.82)' : 'rgba(39,29,58,0.82)',
      boxShadow:hasVisibleStatus ? 'inset 0 0 0 1px rgba(154,128,255,0.18)' : 'none',
      minHeight:96,
    }}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}>
        <div style={{minWidth:0}}>
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

function modifierLabel(modifier) {
  if (modifier.label) return modifier.label;
  const value = modifier.value ? ` ${modifier.value}` : '';
  const detail = modifier.detail ? `: ${modifier.detail}` : '';
  return `${modifier.type || 'Modifier'}${value}${detail}`;
}

export default function CampaignPlayerViewModal({ views, onClose }) {
  const [selectedId, setSelectedId] = useState(views[0]?.id || '');
  const selected = useMemo(() => (
    views.find(view => String(view.id) === String(selectedId)) || views[0]
  ), [selectedId, views]);
  const encounters = selected?.encounters || [];
  const effects = selected?.effects || [];
  const totalCombatants = encounters.reduce((count, encounter) => count + (encounter.combatants || []).length, 0);

  return (
    <div className="modal-overlay" onClick={onClose} style={{zIndex:2600,background:'rgba(2,4,12,0.82)',backdropFilter:'blur(2px)'}}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{
        width:'min(1040px,94vw)',
        maxWidth:'none',
        maxHeight:'88vh',
        display:'flex',
        flexDirection:'column',
        background:'linear-gradient(180deg, rgba(18,23,45,0.98) 0%, rgba(10,14,29,0.98) 100%)',
        border:'1px solid rgba(154,128,255,0.42)',
        boxShadow:'0 22px 80px rgba(0,0,0,0.58), 0 0 0 1px rgba(255,255,255,0.04) inset',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',borderBottom:'1px solid rgba(154,128,255,0.28)',paddingBottom:12}}>
          <div>
            <h2 style={{marginBottom:3,color:'var(--accent-light)'}}>Encounter View</h2>
            <div style={{color:'var(--text-secondary)',fontSize:12}}>
              {selected?.character_name || 'Character'} · {encounters.length} active encounter{encounters.length === 1 ? '' : 's'} · {totalCombatants} visible combatants
            </div>
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

        <div style={{overflowY:'auto',minHeight:0,paddingTop:12,display:'grid',gap:14}}>
          <section>
            <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:8,letterSpacing:0,textTransform:'uppercase'}}>Active Encounters</h3>
            {encounters.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:13}}>No running encounters are visible right now.</div>
            ) : encounters.map(encounter => (
              <div key={encounter.id} style={{border:'1px solid rgba(69,123,255,0.38)',borderRadius:'var(--radius-sm)',padding:10,background:'rgba(17,34,67,0.68)',marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginBottom:10,borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:8}}>
                  <div>
                    <div style={{color:'var(--text-primary)',fontWeight:900,fontSize:15}}>{encounter.name}</div>
                    <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2}}>{(encounter.combatants || []).length} combatants visible</div>
                  </div>
                  <EffectPill tone={encounter.status === 'running' ? 'player' : 'neutral'}>{encounter.status}</EffectPill>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:9}}>
                  {(encounter.combatants || []).map(row => <CombatantPublicRow key={row.id || row.name} row={row} />)}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:8,letterSpacing:0,textTransform:'uppercase'}}>My Campaign Effects</h3>
            {effects.length === 0 ? (
              <div style={{color:'var(--text-secondary)',fontSize:13}}>No active campaign effects for this character.</div>
            ) : effects.map(effect => (
              <div key={effect.id} style={{border:'1px solid rgba(154,128,255,0.38)',borderRadius:'var(--radius-sm)',padding:10,background:'rgba(42,32,71,0.72)',marginBottom:8}}>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{color:'var(--text-primary)',fontWeight:900}}>{effect.name}</span>
                  <EffectPill tone="effect">{effect.status}</EffectPill>
                  {effect.payload?.concentration && <EffectPill tone="effect">Concentration</EffectPill>}
                </div>
                {Array.isArray(effect.payload?.modifiers) && effect.payload.modifiers.length > 0 && (
                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:7}}>
                    {effect.payload.modifiers.map((modifier, index) => (
                      <EffectPill key={`${modifier.type}_${index}`} tone="effect">{modifierLabel(modifier)}</EffectPill>
                    ))}
                  </div>
                )}
                <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:4}}>
                  {effect.source_character_name || 'DM / Environment'} to {effect.target_character_name || 'party'}
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
