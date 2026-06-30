import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';

function resultLabel(result) {
  return {
    critical_success: 'Natural 20',
    critical_failure: 'Natural 1',
    success: 'Success',
    failure: 'Failure',
  }[result] || result || '';
}

export default function DeathSaveModal({ onClose }) {
  const { character, setCharacter } = useCharacter();
  const td = character?.tracker_data || {};
  const settings = td.settings || {};
  const saved = td.death_saves || { successes: 0, failures: 0 };
  const [blind, setBlind] = useState(!!settings.death_save_roll_blind);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const rollDeathSave = async () => {
    if (!character?.id || rolling) return;
    setRolling(true);
    setError('');
    try {
      const r = await api.post(`/campaigns/player-view/${character.id}/death-save`, { blind });
      setResult(r.data);
      if (r.data?.tracker_data) {
        setCharacter(prev => prev ? { ...prev, tracker_data: r.data.tracker_data } : prev);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not roll death save.');
    } finally {
      setRolling(false);
    }
  };

  const shownSaves = result?.death_saves || saved;
  const sentToDm = (result?.updated_encounters || []).length > 0;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">x</button>
        <h2>Death Save</h2>

        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:8,color:'var(--text-primary)'}}>
          <input
            type="checkbox"
            checked={blind}
            onChange={e => setBlind(e.target.checked)}
            style={{width:'auto',flexShrink:0}}
          />
          Roll Blind
        </label>
        <div style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.5,marginBottom:14}}>
          Blind rolls are sent to the DM encounter tracker, but you will not see the roll result or pass/fail counters here.
        </div>

        {!blind && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div className="stat-box">
              <div className="stat-value" style={{color:'var(--success)'}}>{shownSaves.successes || 0}/3</div>
              <div className="stat-label">Successes</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{color:'var(--danger)'}}>{shownSaves.failures || 0}/3</div>
              <div className="stat-label">Failures</div>
            </div>
          </div>
        )}

        {result && (
          <div style={{border:'1px solid var(--border-light)',borderRadius:'var(--radius-sm)',padding:12,background:'var(--bg-card)',marginBottom:12}}>
            {result.blind ? (
              <div style={{color:'var(--accent-light)',fontWeight:800}}>Blind roll sent to the DM.</div>
            ) : (
              <>
                <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center'}}>
                  <div style={{color:'var(--text-secondary)',fontSize:12}}>d20</div>
                  <div style={{color:'var(--accent-light)',fontSize:28,fontWeight:900,lineHeight:1}}>{result.roll}</div>
                </div>
                <div style={{color:result.result?.includes('failure') ? 'var(--danger)' : 'var(--success)',fontWeight:900,marginTop:4}}>
                  {resultLabel(result.result)}
                </div>
                <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:4}}>{result.note}</div>
              </>
            )}
            <div style={{color:sentToDm ? 'var(--success)' : 'var(--warning)',fontSize:11,marginTop:8}}>
              {sentToDm ? 'DM encounter tracker updated.' : 'No active encounter row was found for this character.'}
            </div>
          </div>
        )}

        {error && <div style={{color:'var(--danger)',fontSize:12,marginBottom:10}}>{error}</div>}

        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Close</button>
          <button className="btn btn-primary" style={{flex:1}} disabled={rolling} onClick={rollDeathSave}>
            {rolling ? 'Rolling...' : 'Roll d20'}
          </button>
        </div>
      </div>
    </div>
  );
}
