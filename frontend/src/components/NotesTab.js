import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';

export default function NotesTab() {
  const { character, updateCharacter, resyncCharacter } = useCharacter();
  const [text, setText]   = useState('');
  const [saved, setSaved] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState('');

  useEffect(() => {
    if (character?.notes?.general) setText(character.notes.general);
  }, [character?.id]);

  const save = async () => {
    await updateCharacter(character.id, { notes: { ...character.notes, general: text } });
    setSaved(true);
  };

  const handleChange = v => { setText(v); setSaved(false); };

  const doResync = async () => {
    setResyncing(true);
    setResyncMsg('');
    try {
      await resyncCharacter();
      setResyncMsg('Re-synced! Structural data (features, spells, items) refreshed — your HP, charges, and custom additions were preserved.');
    } catch (err) {
      setResyncMsg(err?.response?.data?.error || 'Re-sync failed.');
    } finally {
      setResyncing(false);
    }
  };

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:12,gap:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{color:'var(--text-secondary)',fontSize:12}}>Campaign Notes</div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {!saved && <span style={{color:'var(--warning)',fontSize:11}}>Unsaved changes</span>}
          <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
        </div>
      </div>
      <textarea value={text} onChange={e => handleChange(e.target.value)}
        placeholder="Session notes, NPC names, important locations, quest reminders..."
        style={{flex:1,resize:'none',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-md)',padding:12,color:'var(--text-primary)',fontSize:13,lineHeight:1.7}} />

      {character?.has_source_pdf && (
        <div className="card">
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:6}}>Imported Character</div>
          <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:8}}>
            This character was imported from a PDF. If RoundHero's import logic improves later, click below to pick up those improvements without losing your progress.
          </div>
          <button className="btn btn-secondary btn-sm" disabled={resyncing} onClick={doResync}>
            {resyncing ? 'Re-syncing...' : '↻ Re-sync from PDF'}
          </button>
          {resyncMsg && <div style={{color:'var(--success)',fontSize:11,marginTop:6}}>{resyncMsg}</div>}
        </div>
      )}
    </div>
  );
}
