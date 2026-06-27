import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';

export default function ConditionsModal({ onClose }) {
  const { character, addCondition, removeCondition } = useCharacter();
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Exhaustion gets its own numeric stepper in the header - don't show it as a
    // plain checkbox here too.
    api.get('/content/conditions').then(r => {
      setConditions((r.data || []).filter(c => c.name !== 'Exhaustion'));
    }).finally(() => setLoading(false));
  }, []);

  if (!character) return null;
  const active = character.tracker_data?.conditions || [];

  const toggle = (name) => {
    if (active.includes(name)) removeCondition(name);
    else addCondition(name);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Conditions</h2>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{color:'var(--text-dim)',textAlign:'center',padding:24}}>Loading...</div>
          ) : conditions.map(c => {
            const isActive = active.includes(c.name);
            return (
              <label key={c.name} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
                <input type="checkbox" checked={isActive} onChange={() => toggle(c.name)} style={{marginTop:3}} />
                <div>
                  <div style={{color: isActive ? 'var(--danger)' : 'var(--text-primary)',fontWeight:600,fontSize:13}}>{c.name}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11,lineHeight:1.5,marginTop:2,whiteSpace:'pre-wrap'}}>{c.description}</div>
                </div>
              </label>
            );
          })}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" style={{width:'100%'}} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
