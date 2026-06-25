import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';

export default function NotesTab() {
  const { character, updateCharacter } = useCharacter();
  const [text, setText]   = useState('');
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (character?.notes?.general) setText(character.notes.general);
  }, [character?.id]);

  const save = async () => {
    await updateCharacter(character.id, { notes: { ...character.notes, general: text } });
    setSaved(true);
  };

  const handleChange = v => { setText(v); setSaved(false); };

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
    </div>
  );
}
