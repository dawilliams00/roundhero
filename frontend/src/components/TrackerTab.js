import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { sorceryDisplayName } from '../utils/dnd';
import { resolveFeatChoice, buildFeatAttachPatch } from '../utils/featChoices';
import AbilityDetailModal from './AbilityDetailModal';
import ConfirmModal from './ConfirmModal';
import CustomAbilityModal from './CustomAbilityModal';
import FeatBrowserModal from './FeatBrowserModal';
import ClassFeatureBrowserModal from './ClassFeatureBrowserModal';
import FeatureEditModal from './FeatureEditModal';
import SorceryPointsModal from './SorceryPointsModal';
import InfoModal from './InfoModal';
import FeatChoiceModal from './FeatChoiceModal';

const SECTION_COST_TYPE = { 'Action':'action', 'Bonus Action':'bonus_action', 'Reaction':'reaction', 'Free Action':'free_action', 'Passive':'passive' };

export default function TrackerTab() {
  const { character, saveTrackerData, updateCharacter } = useCharacter();
  const [detail, setDetail] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [showCustom, setCustom] = useState(false);
  const [showFeatBrowser, setShowFeatBrowser] = useState(false);
  const [showClassFeatureBrowser, setShowClassFeatureBrowser] = useState(false);
  const [infoMessage, setInfoMessage] = useState(null);
  const [editingFeature, setEditingFeature] = useState(null);
  const [showSorceryPoints, setShowSorceryPoints] = useState(false);
  const [choiceFeat, setChoiceFeat] = useState(null);

  if (!character) return null;
  const td       = character.tracker_data || {};
  const ae       = character.ae_data || {};
  const features = td.features   || {};
  const charges  = td.item_charges || {};
  const conds    = td.conditions || [];
  const items    = td.inventory?.items || [];

  // Anything that isn't a hardcoded class-engine feature can be removed - PDF-imported
  // features come back on the next Re-sync if deleted by mistake, custom ones don't need to.
  const isDeletable = (name) => Object.values(ae).some(arr => (arr||[]).some(a => a.tracker_key === name && a.source_type !== 'class'));
  const removeFeature = async (name) => {
    const newFeatures = { ...features };
    delete newFeatures[name];
    const newAe = {};
    for (const [section, arr] of Object.entries(ae)) {
      newAe[section] = (arr||[]).filter(a => a.tracker_key !== name);
    }
    await updateCharacter(character.id, { tracker_data: { ...td, features: newFeatures }, ae_data: newAe });
  };

  const attunableItems = items.map((it,i) => ({ it, idx: i })).filter(({it}) => it.attunement);
  const attunedCount = attunableItems.filter(({it}) => it.attuned).length;
  const toggleAttuned = (idx) => {
    const newItems = items.map((it,i) => {
      if (i !== idx) return it;
      const nowAttuned = !it.attuned;
      // Auto-equip when attuning - an item can't be attuned without being equipped first
      // per RAW, and having it not equipped would make its buffs silently inactive via the
      // isItemActive gating even though it shows as attuned, which has confused players.
      return { ...it, attuned: nowAttuned, ...(nowAttuned && !it.equipped ? { equipped: true } : {}) };
    });
    saveTrackerData({ ...td, inventory: { ...td.inventory, items: newItems } });
  };

  const addFeatFromLibrary = async (feat) => {
    if (feat.choice_type) { setChoiceFeat(feat); return; }
    const patch = await buildFeatAttachPatch(feat, character);
    if (patch === 'duplicate') { setInfoMessage(`"${feat.name}" is already on this character.`); return; }
    await updateCharacter(character.id, { ae_data: patch.newAe, tracker_data: patch.newTd, ...(patch.newSd ? { spell_data: patch.newSd } : {}) });
  };

  // Resilient/Magic Initiate-style feats need a choice made at the moment they're taken -
  // FeatChoiceModal gathers it, resolveFeatChoice (utils/featChoices.js) turns it into
  // patches, folded into the SAME commit as the normal feat attach.
  const confirmFeatChoice = async (choiceData) => {
    const feat = choiceFeat;
    setChoiceFeat(null);
    const patch = await buildFeatAttachPatch(feat, character);
    if (patch === 'duplicate') { setInfoMessage(`"${feat.name}" is already on this character.`); return; }
    let { newAe, newTd, newSd } = patch;
    const choice = await resolveFeatChoice(feat, choiceData);
    if (choice) {
      if (choice.saveProficiencyAdd) {
        const existing = newTd.save_proficiencies || td.save_proficiencies || [];
        if (!existing.includes(choice.saveProficiencyAdd)) newTd.save_proficiencies = [...existing, choice.saveProficiencyAdd];
      }
      if (choice.skillProficienciesAdd?.length) {
        const existing = newTd.skill_proficiencies || td.skill_proficiencies || [];
        const merged = [...existing];
        choice.skillProficienciesAdd.forEach(s => { if (!merged.includes(s)) merged.push(s); });
        newTd.skill_proficiencies = merged;
      }
      if (choice.newFeature) {
        const { key: fKey, ...fData } = choice.newFeature;
        newTd.features = { ...newTd.features, [fKey]: fData };
      }
      if (choice.newKnownSpells?.length) {
        const sd = newSd || character.spell_data || {};
        newSd = { ...sd, known_spells: [...(sd.known_spells || []), ...choice.newKnownSpells] };
      }
    }
    const updates = { ae_data: newAe, tracker_data: newTd, ...(newSd ? { spell_data: newSd } : {}) };
    if (choice?.abilityScoreIncrease) {
      const ab = character.ability_scores || {};
      updates.ability_scores = { ...ab };
      Object.entries(choice.abilityScoreIncrease).forEach(([k, v]) => {
        updates.ability_scores[k] = Math.min(20, (parseInt(ab[k]) || 10) + v);
      });
    }
    await updateCharacter(character.id, updates);
  };

  // Same shape as addFeatFromLibrary above, but for a class/subclass feature from the
  // class_features.json library (browse-and-add, same "you do it yourself, nothing is
  // auto-granted on creation or level-up" model the feat library already uses).
  const addClassFeatureFromLibrary = async (cf) => {
    const key = cf.name;
    const alreadyHas = Object.values(ae).some(arr => (arr||[]).some(a => a.tracker_key === key));
    if (alreadyHas) {
      setInfoMessage(`"${cf.name}" is already on this character.`);
      return;
    }
    const section = cf.action || 'Passive';
    const newAbility = { name: cf.name, source: cf.subclass_name || cf.class_name, source_type: 'custom', cost_type: SECTION_COST_TYPE[section] || 'passive', tracker_key: key, description: cf.description };
    const newAe = { ...ae };
    if (!newAe[section]) newAe[section] = [];
    newAe[section] = [...newAe[section], newAbility];
    const newTd = { ...td };
    if (cf.max_uses > 0) {
      newTd.features = {
        ...newTd.features,
        [key]: { current: cf.max_uses, max: cf.max_uses, rest_type: cf.rest_type || 'long', action: section, description: cf.description },
      };
    }
    await updateCharacter(character.id, { ae_data: newAe, tracker_data: newTd });
  };

  const adjustFeature = async (name, delta) => {
    const feat = features[name];
    if (!feat) return;
    const newCur = Math.max(0, Math.min(feat.max||99, (feat.current||0) + delta));
    await saveTrackerData({ ...td, features: { ...features, [name]: { ...feat, current: newCur } } });
  };

  const adjustCharge = async (name, delta) => {
    const ch = charges[name];
    if (!ch) return;
    const newCur = Math.max(0, Math.min(ch.max||99, (ch.current||0) + delta));
    await saveTrackerData({ ...td, item_charges: { ...charges, [name]: { ...ch, current: newCur } } });
  };

  const featList  = Object.entries(features).filter(([,v]) => v.max > 0);
  const infoList  = Object.entries(features).filter(([,v]) => v.max === 0);
  // Name-based, not class-based - matches whatever the feature is actually called on
  // THIS character's sheet (manually-built characters get "Font of Magic (Sorcerer
  // Points)" verbatim from content_packs.py; older or PDF-imported ones might just say
  // "Font of Magic"), so Flexible Casting/Metamagic management works either way.
  const sorceryFeatureName = Object.keys(features).find(n => n.toLowerCase().includes('font of magic'));
  const chargeList = Object.entries(charges);

  return (
    <div style={{flex:1,overflowY:'auto',padding:12}}>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginBottom:12}}>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowClassFeatureBrowser(true)}>📚 Class Features</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowFeatBrowser(true)}>Browse Feats</button>
        <button className="btn btn-primary btn-sm" onClick={() => setCustom(true)}>+ Custom</button>
      </div>

      {attunableItems.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>Attunement</div>
            <div style={{color: attunedCount > 3 ? 'var(--danger)' : 'var(--accent-light)',fontWeight:700,fontSize:15}}>{attunedCount}/3</div>
          </div>
          {attunableItems.map(({it, idx}) => (
            <div key={idx} onClick={() => toggleAttuned(idx)} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background: it.attuned ? 'var(--accent-light)' : 'transparent',border:'1px solid var(--accent-light)',flexShrink:0}}/>
              <span style={{color: it.attuned ? 'var(--text-primary)' : 'var(--text-dim)',fontSize:13,flex:1}}>{it.name}</span>
              <span style={{color:'var(--text-dim)',fontSize:11}}>{it.attuned ? 'Attuned' : 'Click to attune'}</span>
            </div>
          ))}
          {attunedCount > 3 && <div style={{color:'var(--danger)',fontSize:11,marginTop:6}}>Over the 3-item attunement limit.</div>}
        </div>
      )}

      {featList.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Features & Abilities</div>
          {featList.map(([name, feat]) => (
            <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1,cursor:'pointer'}} onClick={() => setDetail({ name, description: feat.description, source: `${feat.rest_type} rest · ${feat.action}` })}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{name === sorceryFeatureName ? sorceryDisplayName(name) : name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{feat.rest_type} rest · {feat.action}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={() => adjustFeature(name,-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>−</button>
                <span style={{color: feat.current>0 ? 'var(--success)' : 'var(--danger)',fontWeight:700,fontSize:15,minWidth:36,textAlign:'center'}}>{feat.current}/{feat.max}</span>
                <button onClick={() => adjustFeature(name,1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>+</button>
                {name === sorceryFeatureName && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowSorceryPoints(true)} style={{marginLeft:4}}>🔮 Manage</button>
                )}
                <button onClick={() => setEditingFeature(name)} title="Edit this feature" style={{background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:12,marginLeft:4}}>✏️</button>
                {isDeletable(name) && (
                  <button onClick={() => setConfirmRemove(name)} title="Remove this ability" style={{background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>×</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {chargeList.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Item Charges</div>
          {chargeList.map(([name, ch]) => (
            <div key={name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontWeight:500,fontSize:13}}>{name}</div>
                <div style={{color:'var(--text-dim)',fontSize:11}}>{ch.rest_type || 'manual'}</div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <button onClick={() => adjustCharge(name,-1)} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>−</button>
                <span style={{color:'var(--warning)',fontWeight:700,fontSize:15,minWidth:36,textAlign:'center'}}>{ch.current}/{ch.max}</span>
                <button onClick={() => adjustCharge(name,1)} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14}}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {infoList.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--text-secondary)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>Passive Features</div>
          {infoList.map(([name, feat]) => (
            <div key={name} style={{padding:'6px 0',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',gap:8,cursor:'pointer'}} onClick={() => setDetail({ name, description: feat.description, source: feat.action })}>
              <div style={{flex:1}}>
                <div style={{color:'var(--text-primary)',fontSize:13,fontWeight:500}}>{name === sorceryFeatureName ? sorceryDisplayName(name) : name}</div>
                {feat.description && <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2,lineHeight:1.5}}>{feat.description.substring(0,120)}{feat.description.length>120?'…':''}</div>}
              </div>
              {name === sorceryFeatureName && (
                <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setShowSorceryPoints(true); }}>🔮 Manage</button>
              )}
              <button onClick={(e) => { e.stopPropagation(); setEditingFeature(name); }} title="Edit this feature" style={{background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:12,flexShrink:0}}>✏️</button>
              {isDeletable(name) && (
                <button onClick={(e) => { e.stopPropagation(); setConfirmRemove(name); }} title="Remove this ability" style={{background:'var(--bg-hover)',color:'var(--text-dim)',borderRadius:4,width:22,height:22,fontWeight:700,fontSize:14,flexShrink:0}}>×</button>
              )}
            </div>
          ))}
        </div>
      )}

      {conds.length > 0 && (
        <div className="card" style={{marginBottom:12}}>
          <div style={{color:'var(--danger)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>Active Conditions</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {conds.map(c => <div key={c} style={{background:'rgba(230,57,70,0.15)',border:'1px solid var(--danger)',color:'var(--danger)',borderRadius:12,padding:'3px 10px',fontSize:12}}>{c}</div>)}
          </div>
        </div>
      )}

      {detail && <AbilityDetailModal ability={detail} onClose={() => setDetail(null)} />}
      {showCustom && <CustomAbilityModal onClose={() => setCustom(false)} />}
      {showFeatBrowser && <FeatBrowserModal onAdd={addFeatFromLibrary} onClose={() => setShowFeatBrowser(false)} />}
      {choiceFeat && <FeatChoiceModal feat={choiceFeat} onConfirm={confirmFeatChoice} onCancel={() => setChoiceFeat(null)} />}
      {showClassFeatureBrowser && <ClassFeatureBrowserModal onAdd={addClassFeatureFromLibrary} onClose={() => setShowClassFeatureBrowser(false)} />}
      {infoMessage && <InfoModal title="Feats" message={infoMessage} onClose={() => setInfoMessage(null)} />}
      {editingFeature && (
        <FeatureEditModal name={editingFeature} feature={features[editingFeature]} onClose={() => setEditingFeature(null)} />
      )}
      {showSorceryPoints && sorceryFeatureName && (
        <SorceryPointsModal featureName={sorceryFeatureName} onClose={() => setShowSorceryPoints(false)} />
      )}
      {confirmRemove && (
        <ConfirmModal
          title="Remove Ability?"
          message={`Remove "${confirmRemove}"? This can't be undone.`}
          confirmLabel="Remove"
          danger
          onConfirm={() => { removeFeature(confirmRemove); setConfirmRemove(null); }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
