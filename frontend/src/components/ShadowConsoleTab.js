import React, { useEffect, useMemo, useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { fetchCharacterModule, findTrackerCounter, runSyricAction, syncSyricShadowLevel, updateTrackerCounter } from '../utils/characterModules';

const actionOrder = ['Action', 'Bonus Action', 'Reaction', 'Movement', 'Free Action', 'Passive'];

function shadowMaxHp(character) {
  const hp = character?.tracker_data?.hp || {};
  const max = Number(hp.max || hp.max_override || character?.max_hp || 0);
  return Math.floor(max / 2);
}

function CounterPill({ feature, trackerData, onAdjust }) {
  const match = findTrackerCounter(trackerData, feature);
  const value = match?.value || feature;
  const max = Number(value?.max || 0);
  if (!max) return null;
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,border:'1px solid var(--border)',borderRadius:8,padding:'4px 6px',background:'var(--bg-secondary)'}}>
      <span style={{color:'var(--text-primary)',fontWeight:800,fontSize:11}}>{feature.name}</span>
      <button className="btn btn-secondary btn-sm" disabled={!match || (value.current || 0) <= 0} onClick={() => onAdjust(match, -1)}>-</button>
      <span style={{color:(value.current || 0) > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:900,fontSize:12}}>{value.current || 0}/{max}</span>
      <button className="btn btn-secondary btn-sm" disabled={!match || (value.current || 0) >= max} onClick={() => onAdjust(match, 1)}>+</button>
    </div>
  );
}

function FeatureBlock({ title, features }) {
  if (!features.length) return null;
  return (
    <section className="card" style={{padding:0,overflow:'hidden'}}>
      <div style={{padding:'7px 10px',background:'var(--bg-secondary)',borderBottom:'1px solid var(--border)',color:'var(--accent-light)',fontWeight:900,fontSize:12,textTransform:'uppercase'}}>
        {title}
      </div>
      {features.map(feature => (
        <details key={feature.tracker_key || feature.name} style={{padding:'8px 10px',borderBottom:'1px solid var(--border)'}}>
          <summary style={{cursor:'pointer',color:'var(--text-primary)',fontWeight:800,fontSize:13}}>
            {feature.name}
            {feature.max ? <span style={{color:'var(--text-dim)',fontWeight:500,fontSize:11}}> · {feature.current || 0}/{feature.max}</span> : null}
          </summary>
          <div style={{whiteSpace:'pre-wrap',color:'var(--text-secondary)',fontSize:12,lineHeight:1.45,marginTop:8}}>
            {feature.description || 'No description.'}
          </div>
        </details>
      ))}
    </section>
  );
}

export default function ShadowConsoleTab() {
  const { character, saveTrackerData, setCharacter } = useCharacter();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [shadowLevel, setShadowLevel] = useState(character?.tracker_data?.shadow_level_synced || character?.level || 13);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!character?.id) return;
    setLoading(true);
    setError('');
    fetchCharacterModule(character.id, 'syric_arcane')
      .then(setModule)
      .catch(err => setError(err.response?.data?.error || 'Shadow module unavailable.'))
      .finally(() => setLoading(false));
  }, [character?.id]);

  const trackerData = character?.tracker_data || {};
  const moduleState = trackerData.syric_module || {};
  const shadowState = moduleState.shadow || {};
  const maxHp = shadowMaxHp(character);
  const currentHp = Math.min(maxHp, Number(shadowState.current_hp ?? maxHp));
  const tempHp = Number(shadowState.temp_hp || 0);
  const form = shadowState.form || 'Corporeal';

  const features = module?.shadow?.features || [];
  const grouped = useMemo(() => {
    const byAction = {};
    for (const action of actionOrder) byAction[action] = [];
    for (const feature of features) {
      const key = actionOrder.includes(feature.action) ? feature.action : 'Passive';
      byAction[key].push(feature);
    }
    return byAction;
  }, [features]);

  const saveShadow = (patch) => saveTrackerData({
    ...trackerData,
    syric_module: {
      ...moduleState,
      shadow: {
        ...shadowState,
        ...patch,
      },
    },
  });

  const saveShadowViaModule = async (patch) => {
    const data = await runSyricAction(character.id, 'shadow_state', patch);
    if (data.tracker_data) setCharacter(prev => ({ ...prev, tracker_data: data.tracker_data }));
    if (data.module) setModule(data.module);
  };

  const syncLevel = async () => {
    const data = await syncSyricShadowLevel(character.id, shadowLevel);
    if (data.tracker_data) setCharacter(prev => ({ ...prev, tracker_data: data.tracker_data }));
    if (data.module) setModule(data.module);
    setNotice(`Synced Shadow level ${shadowLevel}.`);
  };

  const applyHp = (kind) => {
    const value = Math.max(0, Number(amount || 0));
    if (!value) return;
    if (kind === 'damage') {
      const tempTaken = Math.min(tempHp, value);
      const remaining = value - tempTaken;
      saveShadowViaModule({ temp_hp: tempHp - tempTaken, current_hp: Math.max(0, currentHp - remaining) });
    } else if (kind === 'heal') {
      saveShadowViaModule({ current_hp: Math.min(maxHp, currentHp + value) });
    } else {
      saveShadowViaModule({ temp_hp: Math.max(tempHp, value) });
    }
    setAmount('');
  };

  const adjustCounter = async (match, delta) => {
    if (!match) return;
    await saveTrackerData(updateTrackerCounter(trackerData, match, delta));
  };

  if (loading) return <div style={{padding:16,color:'var(--text-secondary)'}}>Loading Shadow...</div>;
  if (error) return <div style={{padding:16,color:'var(--danger)'}}>{error}</div>;
  if (!module) return <div style={{padding:16,color:'var(--text-secondary)'}}>Shadow module is not available for this character.</div>;

  return (
    <div style={{height:'100%',overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:12}}>
      <section className="card" style={{display:'grid',gridTemplateColumns:'minmax(220px,1fr) minmax(260px,1.2fr)',gap:12,alignItems:'stretch'}}>
        <div>
          <h2 style={{color:'var(--accent-light)',fontSize:18,marginBottom:4}}>{module.shadow?.title || 'Shadow'}</h2>
          <div style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.45}}>{module.shadow?.summary}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
            {['Corporeal','Shadow Form','Shadowmeld'].map(name => (
              <button key={name} className="btn btn-secondary btn-sm" onClick={() => saveShadowViaModule({ form: name })}
                style={{borderColor:form === name ? 'var(--accent)' : 'var(--border)',color:form === name ? 'var(--accent-light)' : 'var(--text-secondary)'}}>
                {name}
              </button>
            ))}
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',marginTop:10,flexWrap:'wrap'}}>
            <span style={{color:'var(--text-dim)',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>Level</span>
            <select value={shadowLevel} onChange={e => setShadowLevel(Number(e.target.value))}>
              {[13,14,15,16,17,18,19,20].map(level => <option key={level} value={level}>{level}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={syncLevel}>Sync Tracker</button>
            {notice && <span style={{color:'var(--accent-light)',fontSize:11}}>{notice}</span>}
          </div>
        </div>
        <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10}}>
            <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:900,textTransform:'uppercase'}}>Shadow HP</div>
            <div style={{color:'var(--hp-high)',fontWeight:900,fontSize:26}}>{currentHp}/{maxHp}</div>
          </div>
          <div style={{color:'var(--text-secondary)',fontSize:11,marginTop:2}}>Temp HP {tempHp} · Max is half Syric max HP, rounded down</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr repeat(3,auto)',gap:6,marginTop:10}}>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" type="number" min="0" className="form-input" />
            <button className="btn btn-danger btn-sm" onClick={() => applyHp('damage')}>Damage</button>
            <button className="btn btn-sm" onClick={() => applyHp('heal')} style={{background:'var(--success)',color:'#fff'}}>Heal</button>
            <button className="btn btn-secondary btn-sm" onClick={() => applyHp('temp')}>Temp</button>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 style={{color:'var(--accent-light)',fontSize:15,marginBottom:8}}>Shadow Uses</h3>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {features.map(feature => (
            <CounterPill key={feature.tracker_key || feature.name} feature={feature} trackerData={trackerData} onAdjust={adjustCounter} />
          ))}
        </div>
      </section>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:12}}>
        {actionOrder.map(action => (
          <FeatureBlock key={action} title={action} features={grouped[action] || []} />
        ))}
      </div>
    </div>
  );
}
