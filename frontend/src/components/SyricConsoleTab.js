import React, { useEffect, useMemo, useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { fetchCharacterModule, fetchSyricReferences, findTrackerCounter, syncSyricCodexPages, updateTrackerCounter } from '../utils/characterModules';
import ReferenceLibraryModal from './ReferenceLibrary';
import FeatureEditModal from './FeatureEditModal';

function CounterCard({ counter, trackerData, onAdjust }) {
  const match = findTrackerCounter(trackerData, counter);
  const value = match?.value || counter;
  const current = value?.current ?? counter.current ?? 0;
  const max = value?.max ?? counter.max ?? 0;
  const disabled = !match;
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',background:'var(--bg-secondary)',padding:'6px 8px',minWidth:0}}>
      <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:6,alignItems:'center'}}>
        <div style={{minWidth:0}}>
          <div style={{color:'var(--text-primary)',fontWeight:800,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{counter.name}</div>
          <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase',marginTop:2}}>{counter.source || 'module'}</div>
        </div>
        <div style={{color:'var(--accent-light)',fontWeight:900,fontSize:15,whiteSpace:'nowrap'}}>{current}/{max || '-'}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginTop:6}}>
        <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onAdjust(match, -1)}>-</button>
        <button className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onAdjust(match, 1)}>+</button>
      </div>
      {disabled && <div style={{color:'var(--warning)',fontSize:10,marginTop:5}}>Reference only.</div>}
    </div>
  );
}

function FeatureList({ title, features, limit = 10, onEdit }) {
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
            <span>{row.name}</span>
            <span style={{color:'var(--text-dim)',fontSize:11,fontWeight:500}}> · {row.action || 'Reference'} {row.max ? `· ${row.current ?? 0}/${row.max}` : ''}</span>
          </summary>
          {onEdit && (
            <button className="btn btn-secondary btn-sm" style={{marginTop:7}} onClick={() => onEdit(row)}>Edit in Feature Editor</button>
          )}
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
  const { character, saveTrackerData, setCharacter } = useCharacter();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingPages, setPendingPages] = useState([]);
  const [notice, setNotice] = useState('');
  const [references, setReferences] = useState(null);
  const [referenceView, setReferenceView] = useState(null);
  const [editingFeature, setEditingFeature] = useState(null);
  const [editingFeaturePayload, setEditingFeaturePayload] = useState(null);

  useEffect(() => {
    if (!character?.id) return;
    setLoading(true);
    setError('');
    fetchCharacterModule(character.id, 'syric_arcane')
      .then(setModule)
      .catch(err => setError(err.response?.data?.error || 'Syric module unavailable.'))
      .finally(() => setLoading(false));
  }, [character?.id]);

  useEffect(() => {
    setPendingPages(module?.unlocked_codex_pages || []);
  }, [module?.unlocked_codex_pages]);

  useEffect(() => {
    fetchSyricReferences().then(setReferences).catch(() => {});
  }, []);

  const trackerData = character?.tracker_data || {};
  const counters = useMemo(() => module?.counters || [], [module]);
  const primaryCounters = counters.filter(counter => (
    /arcane charge|codex dice|resonance|burn dice/i.test(counter.name || '')
  ));

  const adjustCounter = async (match, delta) => {
    if (!match) return;
    await saveTrackerData(updateTrackerCounter(trackerData, match, delta));
  };

  const editModuleFeature = async (feature) => {
    const key = feature.tracker_key || feature.name;
    const currentFeatures = trackerData.features || {};
    const nextFeature = currentFeatures[key] || {
      current: feature.current ?? feature.max ?? 0,
      max: feature.max ?? 0,
      rest: feature.rest || feature.rest_type || '',
      rest_type: feature.rest_type || feature.rest || 'none',
      description: feature.description || '',
      source: feature.source || 'Syric Arcane Module',
      reminder: !!feature.reminder,
    };
    if (!currentFeatures[key]) {
      await saveTrackerData({
        ...trackerData,
        features: {
          ...currentFeatures,
          [key]: nextFeature,
        },
      });
    }
    setEditingFeaturePayload(nextFeature);
    setEditingFeature(key);
  };

  const togglePage = (pageNum) => {
    setPendingPages(prev => (
      prev.includes(pageNum)
        ? prev.filter(page => page !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b)
    ));
  };

  const syncPages = async () => {
    const data = await syncSyricCodexPages(character.id, pendingPages);
    if (data.tracker_data) setCharacter(prev => ({ ...prev, tracker_data: data.tracker_data }));
    if (data.module) setModule(data.module);
    setNotice(`Synced Codex pages: ${pendingPages.join(', ') || 'none'}.`);
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

      <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(118px,150px))',gap:6,alignItems:'start'}}>
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
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:8}}>
            <h3 style={{color:'var(--accent-light)',fontSize:15,margin:0}}>Codex Pages</h3>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button className="btn btn-secondary btn-sm" onClick={() => setReferenceView({ docId: 'arcane_rebound' })}>Rebound</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setReferenceView({ docId: 'codex_nyx_teachings', page: 1 })}>Teachings</button>
              <button className="btn btn-secondary btn-sm" onClick={syncPages}>Sync</button>
            </div>
          </div>
          {notice && <div style={{color:'var(--accent-light)',fontSize:11,marginBottom:8}}>{notice}</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(92px,1fr))',gap:6}}>
            {(module.codex_pages || []).map(page => (
              <div key={page.page}
                style={{
                  display:'grid',gridTemplateColumns:'1fr auto',gap:4,alignItems:'stretch',border:'1px solid var(--border)',
                  borderColor:pendingPages.includes(page.page) ? 'var(--success)' : 'var(--border)',
                  background:pendingPages.includes(page.page) ? 'rgba(0,200,120,0.16)' : 'var(--bg-secondary)',
                  borderRadius:'var(--radius-sm)',padding:5,
                }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setReferenceView({ docId: 'codex_mechanics', page: page.page })}
                  title={`Read ${page.title}`}
                  style={{textAlign:'left',display:'block',background:'transparent',border:0,padding:2,minWidth:0}}>
                  <div style={{color:pendingPages.includes(page.page) ? 'var(--success)' : 'var(--text-dim)',fontWeight:900,fontSize:11}}>P{page.page}</div>
                  <div style={{color:'var(--text-primary)',fontWeight:700,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{page.title}</div>
                  <div style={{color:'var(--text-dim)',fontSize:9}}>{page.feature_count}+{page.counter_count}</div>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => togglePage(page.page)}
                  title={pendingPages.includes(page.page) ? 'Mark page unavailable' : 'Mark page found'}
                  style={{
                    minWidth:26,padding:'2px 5px',fontWeight:900,
                    background:pendingPages.includes(page.page) ? 'var(--success)' : 'var(--bg-primary)',
                    color:pendingPages.includes(page.page) ? '#fff' : 'var(--text-dim)',
                  }}>
                  {pendingPages.includes(page.page) ? 'ON' : '+'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ActionSections sections={module.action_sections || []} />
      <FeatureList title="Syric Features" features={module.features || []} onEdit={editModuleFeature} />
      <FeatureList title="Shadow Full Reference" features={module.shadow?.features || []} limit={8} onEdit={editModuleFeature} />
      {referenceView && references && (
        <ReferenceLibraryModal
          docsPayload={references}
          initialDocId={referenceView.docId}
          initialPage={referenceView.page || 1}
          onClose={() => setReferenceView(null)}
        />
      )}
      {editingFeature && (
        <FeatureEditModal
          name={editingFeature}
          feature={(character?.tracker_data?.features || {})[editingFeature] || (trackerData.features || {})[editingFeature] || editingFeaturePayload}
          onClose={() => {
            setEditingFeature(null);
            setEditingFeaturePayload(null);
          }}
        />
      )}
    </div>
  );
}
