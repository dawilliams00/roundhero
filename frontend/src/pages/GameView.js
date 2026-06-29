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
import CompanionTab from '../components/CompanionTab';
import SyricConsoleTab from '../components/SyricConsoleTab';
import { fetchCharacterModules } from '../utils/characterModules';
import { activeCompanionKey } from '../utils/dnd';

export default function GameView() {
  const { id }                    = useParams();
  const nav                       = useNavigate();
  const { character, loadCharacter, loading } = useCharacter();
  const [activeTab, setActiveTab] = useState(0);
  const [modules, setModules] = useState([]);

  useEffect(() => { loadCharacter(parseInt(id)); }, [id, loadCharacter]);

  useEffect(() => {
    if (!character?.id) return;
    let cancelled = false;
    fetchCharacterModules(character.id)
      .then(rows => { if (!cancelled) setModules(rows); })
      .catch(() => { if (!cancelled) setModules([]); });
    return () => { cancelled = true; };
  }, [character?.id]);

  if (loading || !character) {
    return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text-secondary)'}}>Loading character...</div>;
  }

  const td = character.tracker_data || {};
  const companion = td.companion || {};
  const companion2 = td.companion2 || {};
  // The Companion tab only exists when the player has opted into at least one slot via
  // Settings - its label reflects whichever slot is currently active, so the bottom nav
  // itself shows which form is "in play" right now (e.g. a Blood Hunter's normal form vs.
  // Hybrid Transformation) without having to open the tab first.
  const activeKey = activeCompanionKey(td);
  const activeCompanion = activeKey === 'companion2' ? companion2 : companion;
  const tabs = [
    { label: '⚔️ Actions', Component: ActionEconomyTab },
    ...(modules.some(module => module.id === 'syric_arcane') ? [{ label: '🔮 Syric', Component: SyricConsoleTab }] : []),
    { label: '📋 Feats/Attunement', Component: TrackerTab },
    { label: '✨ Spells', Component: SpellsTab },
    { label: '🎒 Inventory', Component: InventoryTab },
    { label: '📝 Notes', Component: NotesTab },
    { label: '🐉 Bestiary', Component: BestiaryTab },
    ...((companion.enabled || companion2.enabled) ? [{ label: `🐾 ${activeCompanion.tab_name || 'Companion'}`, Component: CompanionTab }] : []),
  ];
  // If a companion was just disabled in Settings while it was the active tab, fall back
  // to the first tab rather than rendering past the end of the now-shorter array.
  const safeTab = activeTab < tabs.length ? activeTab : 0;
  const ActiveComponent = tabs[safeTab].Component;

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--bg-primary)',overflow:'hidden'}}>
      <CharacterHeader onBack={() => nav('/characters')} />
      <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'var(--bg-secondary)',flexShrink:0}}>
        {tabs.map((t,i) => (
          <button key={t.label} onClick={() => setActiveTab(i)} style={{
            flex:1, padding:'10px 4px', fontSize:12, fontWeight:500,
            background:'none', border:'none', borderBottom: i===safeTab ? '2px solid var(--accent)' : '2px solid transparent',
            color: i===safeTab ? 'var(--accent-light)' : 'var(--text-secondary)',
            transition:'color 0.15s',
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <ActiveComponent />
      </div>
    </div>
  );
}
