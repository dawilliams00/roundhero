import React, { useEffect, useMemo, useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { fetchCharacterModule, findTrackerCounter, updateTrackerCounter } from '../utils/characterModules';

function CounterCard({ counter, trackerData, onAdjust }) {
  const match = findTrackerCounter(trackerData, counter);
  const value = match?.value || counter;
  const current = value?.current ?? counter.current ?? 0;
  const max = value?.max ?? counter.max ?? 0;
  const disabled = !match;
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-secondary)',padding:10}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}}>
        <div>
          <div style={{color:'var(--text-primary)',fontWeight:800,fontSize:13}}>{counter.name}</div>
          <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',marginTop:2}}>{counter.source || 'module'}</div>
        </div>
        <div style={{color:'var(--accent-light)',fontWeight:900,fontSize:18}}>{current}/{max || '-'}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:10}}>
        <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onAdjust(match, -1)}>-</button>
        <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onAdjust(match, 1)}>+</button>
      </div>
      {disabled && <div style={{color:'var(--warning)',fontSize:11,marginTop:8}}>Reference only until matched to live tracker data.</div>}
    </div>
  );
}

function FeatureList({ title, features, limit = 10 }) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? features : features.slice(0, limit);
  return (
    <section className="card" style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
        <h3 style={{color:'var(--accent-light)',fontSize:15,margin:0}}>{title}</h3>
        {features.length > limit && (
          <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(v => !v)}>
            {expanded ? 'Less' : `All ${features.length}`}
          </button>
        )}
      </div>
      {rows.map(row => (
        <details key={row.tracker_key || row.name} style={{borderTop:'1px solid var(--border)',paddingTop:7}}>
          <summary style={{cursor:'pointer',color:'var(--text-primary)',fontWeight:700}}>
            {row.name}
            <span style={{color:'var(--text-dim)',fontSize:11,fontWeight:500}}> · {row.action || 'Reference'} {row.max ? `· ${row.current ?? 0}/${row.max}` : ''}</span>
          </summary>
          <div style={{whiteSpace:'pre-wrap',color:'var(--text-secondary)',fontSize:12,lineHeight:1.45,marginTop:7}}>
            {row.description || 'No description.'}
          </div>
        </details>
      ))}
    </section>
  );
}

function ActionSections({ sections }) {
  return (
    <section className="card">
      <h3 style={{color:'var(--accent-light)',fontSize:15,marginBottom:10}}>Syric Action Framework</h3>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
        {sections.map(section => (
          <div key={section.name} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)'}}>
            <div style={{color:'var(--warning)',fontWeight:900,fontSize:12,textTransform:'uppercase',marginBottom:8}}>{section.name}</div>
            {section.actions.map(action => (
              <details key={`${section.name}_${action.name}`} style={{padding:'5px 0',borderTop:'1px solid var(--border)'}}>
                <summary style={{cursor:'pointer',color:'var(--text-primary)',fontWeight:700,fontSize:13}}>{action.name}</summary>
                <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}>{action.source} · {action.cost_type}</div>
                <div style={{whiteSpace:'pre-wrap',color:'var(--text-secondary)',fontSize:12,lineHeight:1.4,marginTop:5}}>{action.description}</div>
              </details>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SyricConsoleTab() {
  const { character, saveTrackerData } = useCharacter();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!character?.id) return;
    setLoading(true);
    setError('');
    fetchCharacterModule(character.id, 'syric_arcane')
      .then(setModule)
      .catch(err => setError(err.response?.data?.error || 'Syric module unavailable.'))
      .finally(() => setLoading(false));
  }, [character?.id]);

  const trackerData = character?.tracker_data || {};
  const counters = useMemo(() => module?.counters || [], [module]);
  const primaryCounters = counters.filter(counter => (
    /arcane charge|codex dice|resonance|burn dice/i.test(counter.name || '')
  ));
  const otherCounters = counters.filter(counter => !primaryCounters.includes(counter));

  const adjustCounter = async (match, delta) => {
    if (!match) return;
    await saveTrackerData(updateTrackerCounter(trackerData, match, delta));
  };

  if (loading) {
    return <div style={{padding:16,color:'var(--text-secondary)'}}>Loading Syric console...</div>;
  }
  if (error) {
    return <div style={{padding:16,color:'var(--danger)'}}>{error}</div>;
  }
  if (!module) {
    return <div style={{padding:16,color:'var(--text-secondary)'}}>Syric console is not available for this character.</div>;
  }

  return (
    <div style={{height:'100%',overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:12}}>
      <div className="card" style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
        <div>
          <h2 style={{color:'var(--accent-light)',fontSize:18,marginBottom:4}}>Syric Console</h2>
          <div style={{color:'var(--text-secondary)',fontSize:12}}>{module.summary}</div>
        </div>
        <div style={{color:'var(--text-dim)',fontSize:11,textAlign:'right'}}>
          Private module<br />{module.source}
        </div>
      </div>

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10}}>
        {primaryCounters.map(counter => (
          <CounterCard key={counter.tracker_key || counter.name} counter={counter} trackerData={trackerData} onAdjust={adjustCounter} />
        ))}
      </section>

      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:12}}>
        <section className="card">
          <h3 style={{color:'var(--accent-light)',fontSize:15,marginBottom:6}}>{module.shadow?.title || 'Shadow'}</h3>
          <div style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.45}}>{module.shadow?.summary}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:6,marginTop:10}}>
            {(module.shadow?.features || []).slice(0, 8).map(feature => (
              <div key={feature.tracker_key || feature.name} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:7}}>
                <div style={{color:'var(--text-primary)',fontWeight:700,fontSize:12}}>{feature.name}</div>
                <div style={{color:'var(--text-dim)',fontSize:10}}>{feature.action} {feature.max ? `· ${feature.current}/${feature.max}` : ''}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3 style={{color:'var(--accent-light)',fontSize:15,marginBottom:8}}>Codex Pages</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:6}}>
            {(module.codex_pages || []).map(page => (
              <div key={page.page} style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:7,background:'var(--bg-secondary)'}}>
                <div style={{color:'var(--warning)',fontWeight:900,fontSize:11}}>Page {page.page}</div>
                <div style={{color:'var(--text-primary)',fontWeight:700,fontSize:12}}>{page.title}</div>
                <div style={{color:'var(--text-dim)',fontSize:10}}>{page.feature_count} features · {page.counter_count} counters</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {otherCounters.length > 0 && (
        <section className="card">
          <h3 style={{color:'var(--accent-light)',fontSize:15,marginBottom:10}}>Other Counters</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:8}}>
            {otherCounters.map(counter => (
              <CounterCard key={counter.tracker_key || counter.name} counter={counter} trackerData={trackerData} onAdjust={adjustCounter} />
            ))}
          </div>
        </section>
      )}

      <ActionSections sections={module.action_sections || []} />
      <FeatureList title="Syric Features" features={module.features || []} />
      <FeatureList title="Shadow Full Reference" features={module.shadow?.features || []} limit={8} />
    </div>
  );
}
