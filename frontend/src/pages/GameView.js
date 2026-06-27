import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCharacter } from '../context/CharacterContext';
import CharacterHeader from '../components/CharacterHeader';
import ActionEconomyTab from '../components/ActionEconomyTab';
import TrackerTab from '../components/TrackerTab';
import SpellsTab from '../components/SpellsTab';
import InventoryTab from '../components/InventoryTab';
import NotesTab from '../components/NotesTab';
import BestiaryTab from '../components/BestiaryTab';

const TABS = ['⚔️ Actions','📋 Feats/Attunement','✨ Spells','🎒 Inventory','📝 Notes','🐉 Bestiary'];

export default function GameView() {
  const { id }                    = useParams();
  const nav                       = useNavigate();
  const { character, loadCharacter, loading } = useCharacter();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => { loadCharacter(parseInt(id)); }, [id, loadCharacter]);

  if (loading || !character) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text-secondary)'}}>Loading character...</div>;
  }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--bg-primary)',overflow:'hidden'}}>
      <CharacterHeader onBack={() => nav('/characters')} />
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'var(--bg-secondary)',flexShrink:0}}>
        {TABS.map((t,i) => (
          <button key={t} onClick={() => setActiveTab(i)} style={{
            flex:1, padding:'10px 4px', fontSize:12, fontWeight:500,
            background:'none', border:'none', borderBottom: i===activeTab ? '2px solid var(--accent)' : '2px solid transparent',
            color: i===activeTab ? 'var(--accent-light)' : 'var(--text-secondary)',
            transition:'color 0.15s',
          }}>{t}</button>
        ))}
      </div>
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        {activeTab === 0 && <ActionEconomyTab />}
        {activeTab === 1 && <TrackerTab />}
        {activeTab === 2 && <SpellsTab />}
        {activeTab === 3 && <InventoryTab />}
        {activeTab === 4 && <NotesTab />}
        {activeTab === 5 && <BestiaryTab />}
      </div>
    </div>
  );
}
