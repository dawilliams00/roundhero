import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import CharacterHeader from '../components/CharacterHeader';
import ActionEconomyTab from '../components/ActionEconomyTab';
import TrackerTab from '../components/TrackerTab';
import SpellsTab from '../components/SpellsTab';
import InventoryTab from '../components/InventoryTab';
import NotesTab from '../components/NotesTab';
import BestiaryTab from '../components/BestiaryTab';
import CompanionTab from '../components/CompanionTab';
import LevelUpFlowModal from '../components/LevelUpFlowModal';
import SyricConsoleTab from '../components/SyricConsoleTab';
import { fetchCharacterModules } from '../utils/characterModules';
import { activeCompanionKey } from '../utils/dnd';

export default function GameView() {
  const { id }                    = useParams();
  const nav                       = useNavigate();
  const { character, loadCharacter, loading } = useCharacter();
  const [activeTab, setActiveTab] = useState(0);
  const [needsClassConfirm, setNeedsClassConfirm] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showConfirmClasses, setShowConfirmClasses] = useState(false);
  const [modules, setModules] = useState([]);

  useEffect(() => { loadCharacter(parseInt(id)); }, [id, loadCharacter]);

  // Proactively flags a PDF-imported (or otherwise unrecognized) class_name instead of
  // only surfacing it the first time the player happens to click Level Up - the same
  // read-only /class_status check LevelUpFlowModal's confirm_classes mode uses.
  useEffect(() => {
    if (!character) return;
    api.get(`/characters/${character.id}/class_status`, { suppressGlobalError: true }).then(r => setNeedsClassConfirm(r.data.needs_confirmation)).catch(() => {});
  }, [character?.id]);

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
      {needsClassConfirm && !bannerDismissed && (
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 16px',background:'var(--warning)',color:'#1a1a1a',flexShrink:0,fontSize:12}}>
          <span style={{flex:1}}>Couldn't confidently detect this character's class(es) from "{character.class_name}" - confirm them to enable level-up, subclass tracking, and ability score improvements.</span>
          <button className="btn btn-sm" style={{background:'#1a1a1a',color:'#fff'}} onClick={() => setShowConfirmClasses(true)}>Confirm Classes</button>
          <button className="btn btn-sm btn-secondary" onClick={() => setBannerDismissed(true)}>Dismiss</button>
        </div>
      )}
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
      {showConfirmClasses && (
        <LevelUpFlowModal mode="confirm_classes" onClose={() => { setShowConfirmClasses(false); setNeedsClassConfirm(false); }} />
      )}
    </div>
  );
}
