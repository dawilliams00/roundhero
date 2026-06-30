import React, { useEffect, useMemo, useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { fetchCharacterModule, findTrackerCounter, runSyricAction, syncSyricShadowLevel, updateTrackerCounter } from '../utils/characterModules';
import NumberPadPopover from './NumberPadPopover';

const actionOrder = ['Action', 'Bonus Action', 'Reaction', 'Movement', 'Free Action', 'Passive'];
const POPOVER_RESERVE = 300;

function shadowMaxHp(character) {
  const hp = character?.tracker_data?.hp || {};
  const max = Number((hp.max_override > 0 ? hp.max_override : hp.max) || character?.max_hp || 0);
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

function MiniStat({ label, value }) {
  return (
    <div className="stat-box" style={{minWidth:88,textAlign:'left',padding:'5px 7px'}}>
      <div className="stat-label" style={{marginTop:0}}>{label}</div>
      <div className="stat-sub" style={{fontSize:11,lineHeight:1.25,color:'var(--text-primary)'}}>{value}</div>
    </div>
  );
}

function ShadowHPRow({ label, value, color = 'var(--text-primary)', onApply, open, onOpen, onCloseCalc }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
      <button onClick={() => onApply(-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700,flexShrink:0}}>−</button>
      <div style={{textAlign:'center',position:'relative',minWidth:90}}>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:6}}>{label}</div>
        <div onClick={onOpen} style={{cursor:'pointer',fontSize:20,fontWeight:700,color,padding:'3px 0'}}>{value}</div>
        <div style={{color:'var(--text-dim)',fontSize:10}}>Click to modify</div>
        {open && <NumberPadPopover label={label} value={value} color={color} onApply={onApply} onClose={onCloseCalc} />}
      </div>
      <button onClick={() => onApply(1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700,flexShrink:0}}>+</button>
    </div>
  );
}

function ShadowHPModal({ currentHp, maxHp, tempHp, onSave, onClose }) {
  const [current, setCurrent] = useState(currentHp);
  const [temp, setTemp] = useState(tempHp);
  const [openCalc, setOpenCalc] = useState(null);

  const applyCurrentDelta = (delta) => {
    if (delta < 0) {
      let damage = -delta;
      const absorbed = Math.min(temp, damage);
      setTemp(value => Math.max(0, value - absorbed));
      damage -= absorbed;
      setCurrent(value => Math.max(0, value - damage));
    } else {
      setCurrent(value => Math.min(maxHp, value + delta));
    }
  };
  const applyTempDelta = (delta) => setTemp(value => Math.max(0, value + delta));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <h2>Shadow HP</h2>
        <div style={{display:'flex',flexDirection:'column',gap:18,marginBottom:16}}>
          <ShadowHPRow label="Current HP" value={current} color="var(--accent-light)" onApply={applyCurrentDelta}
            open={openCalc === 'current'} onOpen={() => setOpenCalc('current')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc === 'current' && <div style={{height:POPOVER_RESERVE}} />}
          <div style={{textAlign:'center'}}>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:4}}>Max HP</div>
            <div style={{fontSize:16,fontWeight:800,color:'var(--text-secondary)'}}>{maxHp}</div>
            <div style={{color:'var(--text-dim)',fontSize:10}}>Half Syric max HP, rounded down</div>
          </div>
          <ShadowHPRow label="Temp HP" value={temp} onApply={applyTempDelta}
            open={openCalc === 'temp'} onOpen={() => setOpenCalc('temp')} onCloseCalc={() => setOpenCalc(null)} />
          {openCalc === 'temp' && <div style={{height:POPOVER_RESERVE}} />}
        </div>
        <div style={{color:'var(--text-secondary)',fontSize:13,textAlign:'center',marginBottom:12}}>
          Current: <b style={{color:'var(--accent-light)'}}>{current}</b> / <b style={{color:'var(--accent-light)'}}>{maxHp}</b>{temp > 0 && <> + <b style={{color:'var(--accent-light)'}}>{temp}</b> temp</>}
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} onClick={() => onSave({ current_hp: Math.min(maxHp, current), temp_hp: temp })}>Save &amp; Close</button>
        </div>
      </div>
    </div>
  );
}

function ShadowStatBlockModal({ shadow, maxHp, currentHp, tempHp, onClose }) {
  const gui = shadow?.gui || {};
  const groups = [
    ['Core Stats', gui.core_stats || []],
    ['Core Rules', gui.core_rules || []],
    ['Combat Features', gui.combat_features || []],
    ['Level Features', gui.level_features || []],
    ['Action Economy', gui.action_economy || []],
    ['Manifest Load', gui.manifest_load || []],
  ].filter(([, rows]) => rows.length > 0);
  const features = shadow?.features || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{shadow?.title || 'Shadow'} Stat Block</h2>
          <div style={{color:'var(--text-secondary)',fontSize:12}}>HP {currentHp}/{maxHp}{tempHp ? ` +${tempHp} temp` : ''}</div>
        </div>
        <div className="modal-body">
          {groups.map(([title, rows]) => (
            <section key={title} style={{marginBottom:14}}>
              <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:6}}>{title}</h3>
              <div style={{display:'grid',gap:6}}>
                {rows.map(row => (
                  <div key={`${title}-${row.name}`} style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-primary)'}}>
                    <div style={{color:'var(--text-primary)',fontWeight:800,fontSize:13}}>{row.name}</div>
                    <div style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.45,whiteSpace:'pre-wrap'}}>{row.text}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {shadow?.core_reference && (
            <section style={{marginBottom:14}}>
              <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:6}}>Core Reference</h3>
              <div style={{whiteSpace:'pre-wrap',color:'var(--text-secondary)',fontSize:12,lineHeight:1.5,padding:10,border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-primary)'}}>
                {shadow.core_reference}
              </div>
            </section>
          )}
          <section>
            <h3 style={{color:'var(--accent-light)',fontSize:14,marginBottom:6}}>Feature Text</h3>
            {features.map(feature => (
              <details key={feature.tracker_key || feature.name} style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-primary)',marginBottom:6}}>
                <summary style={{cursor:'pointer',color:'var(--text-primary)',fontWeight:800,fontSize:13}}>{feature.name}</summary>
                <div style={{whiteSpace:'pre-wrap',color:'var(--text-secondary)',fontSize:12,lineHeight:1.5,marginTop:8}}>
                  {feature.description || 'No description.'}
                </div>
              </details>
            ))}
          </section>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" style={{width:'100%'}} onClick={onClose}>Close</button>
        </div>
      </div>
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
  const [shadowLevel, setShadowLevel] = useState(character?.tracker_data?.shadow_level_synced || character?.level || 13);
  const [notice, setNotice] = useState('');
  const [showHP, setShowHP] = useState(false);
  const [showStatBlock, setShowStatBlock] = useState(false);

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
  const coreStats = module?.shadow?.gui?.core_stats || [];
  const statByName = (name) => coreStats.find(row => row.name === name)?.text || '';
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
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
            <h2 style={{color:'var(--accent-light)',fontSize:18,margin:0}}>{module.shadow?.title || 'Shadow'}</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowStatBlock(true)}>[STAT]</button>
          </div>
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
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:10,alignItems:'stretch'}}>
          <button type="button" onClick={() => setShowHP(true)}
            style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 12px',background:'var(--bg-secondary)',cursor:'pointer',minWidth:112,textAlign:'center'}}>
            <div style={{color:'var(--text-dim)',fontSize:10,fontWeight:900,textTransform:'uppercase'}}>Shadow HP</div>
            <div style={{color:'var(--hp-high)',fontWeight:900,fontSize:24,lineHeight:1.1}}>{currentHp}/{maxHp}</div>
            <div style={{color:'var(--text-secondary)',fontSize:10}}>Temp {tempHp}</div>
            <div style={{color:'var(--text-dim)',fontSize:9,marginTop:2}}>Click</div>
          </button>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignContent:'flex-start'}}>
            <MiniStat label="AC / HP" value={statByName('AC / HP') || `AC ?; HP ${currentHp}/${maxHp}`} />
            <MiniStat label="Movement" value={statByName('Movement') || 'Movement not listed'} />
            <MiniStat label="Abilities" value={statByName('Ability Scores') || 'Stats not listed'} />
            <MiniStat label="Saves" value={statByName('Saving Throws') || 'Saves not listed'} />
            <MiniStat label="Skills" value={statByName('Skills') || 'Skills not listed'} />
            <MiniStat label="Senses" value={statByName('Senses / Bond') || 'Senses not listed'} />
            <MiniStat label="Load" value={statByName('Manifest Load') || 'Load not listed'} />
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
      {showHP && (
        <ShadowHPModal
          currentHp={currentHp}
          maxHp={maxHp}
          tempHp={tempHp}
          onSave={async (patch) => {
            await saveShadowViaModule(patch);
            setShowHP(false);
          }}
          onClose={() => setShowHP(false)}
        />
      )}
      {showStatBlock && (
        <ShadowStatBlockModal
          shadow={module.shadow}
          currentHp={currentHp}
          maxHp={maxHp}
          tempHp={tempHp}
          onClose={() => setShowStatBlock(false)}
        />
      )}
    </div>
  );
}
