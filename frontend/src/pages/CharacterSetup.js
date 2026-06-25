import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { ABILITY_KEYS, ABILITY_LABELS } from '../utils/dnd';

const STEPS = ['Basic Info', 'Race & Class', 'Ability Scores', 'Review'];

export default function CharacterSetup() {
  const nav = useNavigate();
  const [step, setStep]         = useState(0);
  const [classes, setClasses]   = useState([]);
  const [subclasses, setSubs]   = useState([]);
  const [races, setRaces]       = useState([]);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({
    name: '', race: '', class_name: '', subclass: '', level: 1,
    ability_scores: { STR:10, DEX:10, CON:10, INT:10, WIS:10, CHA:10 },
  });

  useEffect(() => {
    api.get('/content/classes').then(r => setClasses(r.data));
    api.get('/content/races').then(r => setRaces(r.data));
  }, []);

  useEffect(() => {
    if (form.class_name) {
      api.get(`/content/classes/${form.class_name}/subclasses`).then(r => setSubs(r.data));
    }
  }, [form.class_name]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setScore = (ab, v) => setForm(f => ({ ...f, ability_scores: { ...f.ability_scores, [ab]: parseInt(v) || 10 } }));
  const mod = score => { const m = Math.floor((score - 10) / 2); return m >= 0 ? `+${m}` : `${m}`; };

  const submit = async () => {
    setSaving(true);
    try {
      const r = await api.post('/characters/', form);
      nav(`/play/${r.data.id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create character');
      setSaving(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-primary)',padding:24,display:'flex',alignItems:'flex-start',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:520,marginTop:32}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:20,color:'var(--accent-light)',marginBottom:8,textAlign:'center'}}>New Character</div>
        <div style={{display:'flex',gap:0,marginBottom:28,borderRadius:'var(--radius-md)',overflow:'hidden',border:'1px solid var(--border)'}}>
          {STEPS.map((s,i) => (
            <div key={s} style={{flex:1,padding:'8px 4px',textAlign:'center',fontSize:11,fontWeight:500,
              background: i === step ? 'var(--accent)' : i < step ? 'var(--bg-hover)' : 'var(--bg-card)',
              color: i === step ? '#fff' : i < step ? 'var(--accent-light)' : 'var(--text-dim)',
              cursor: i < step ? 'pointer' : 'default',
            }} onClick={() => i < step && setStep(i)}>{s}</div>
          ))}
        </div>

        <div className="card">
          {step === 0 && (
            <div>
              <div className="form-group">
                <label>Character Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Enter character name" autoFocus />
              </div>
              <div className="form-group">
                <label>Level (1–20)</label>
                <input type="number" min={1} max={20} value={form.level} onChange={e => set('level', parseInt(e.target.value)||1)} />
              </div>
              <button className="btn btn-primary" style={{width:'100%',marginTop:8}} disabled={!form.name} onClick={() => setStep(1)}>Next →</button>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="form-group">
                <label>Race</label>
                <select value={form.race} onChange={e => set('race', e.target.value)}>
                  <option value="">Select race...</option>
                  {races.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Class</label>
                <select value={form.class_name} onChange={e => { set('class_name', e.target.value); set('subclass',''); }}>
                  <option value="">Select class...</option>
                  {classes.map(c => <option key={c.name} value={c.name}>{c.name} (d{c.hit_die})</option>)}
                </select>
              </div>
              {subclasses.length > 0 && form.level >= 3 && (
                <div className="form-group">
                  <label>Subclass (optional)</label>
                  <select value={form.subclass} onChange={e => set('subclass', e.target.value)}>
                    <option value="">Select subclass...</option>
                    {subclasses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setStep(0)}>← Back</button>
                <button className="btn btn-primary" style={{flex:2}} disabled={!form.race || !form.class_name} onClick={() => setStep(2)}>Next →</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{color:'var(--text-secondary)',fontSize:12,marginBottom:16}}>Standard array: 15, 14, 13, 12, 10, 8 — or enter your rolled scores.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {ABILITY_KEYS.map(ab => (
                  <div key={ab} className="form-group" style={{marginBottom:0}}>
                    <label>{ABILITY_LABELS[ab]}</label>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="number" min={1} max={30} value={form.ability_scores[ab]} onChange={e => setScore(ab, e.target.value)} style={{width:'70px'}} />
                      <span style={{color:'var(--accent-light)',fontWeight:600,fontSize:15,minWidth:28}}>{mod(form.ability_scores[ab])}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:8,marginTop:20}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-primary" style={{flex:2}} onClick={() => setStep(3)}>Review →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
                {[['Name',form.name],['Race',form.race],['Class',form.class_name],['Level',form.level],['Subclass',form.subclass||'—']].map(([l,v]) => (
                  <div key={l}>
                    <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:0.5}}>{l}</div>
                    <div style={{color:'var(--text-primary)',fontWeight:500}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:20,padding:12,background:'var(--bg-primary)',borderRadius:'var(--radius-sm)'}}>
                {ABILITY_KEYS.map(ab => (
                  <div key={ab} style={{textAlign:'center'}}>
                    <div style={{color:'var(--text-dim)',fontSize:10,textTransform:'uppercase'}}>{ab}</div>
                    <div style={{color:'var(--text-primary)',fontWeight:600,fontSize:16}}>{form.ability_scores[ab]}</div>
                    <div style={{color:'var(--accent-light)',fontSize:13}}>{mod(form.ability_scores[ab])}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={() => setStep(2)}>← Back</button>
                <button className="btn btn-primary" style={{flex:2}} disabled={saving} onClick={submit}>{saving ? 'Creating...' : '⚔️ Create Character'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
