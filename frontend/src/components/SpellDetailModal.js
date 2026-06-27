import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { schoolColor, getSpellcastingBlocks, scaleSpellDamage, rollDamage } from '../utils/dnd';

const SELF_TARGET_EFFECTS = { haste: 'Hasted' };

export default function SpellDetailModal({ spell, onClose, chargeMode, onCastSuccess }) {
  const { character, useSlot, addActiveEffect } = useCharacter();
  const [casting, setCasting] = useState(false);
  const [cast, setCast]       = useState(null);
  const [awaitingTarget, setAwaitingTarget] = useState(false);
  const [pendingDamage, setPendingDamage] = useState(null);
  const [damageResult, setDamageResult] = useState(null);

  if (!character) return null;
  const slots = character.tracker_data?.spell_slots || {};
  const isCantrip = spell.level_int === 0;
  const availableLevels = Object.entries(slots)
    .filter(([lvl, s]) => parseInt(lvl) >= spell.level_int && (s.current || 0) > 0)
    .map(([lvl]) => parseInt(lvl))
    .sort((a,b) => a-b);
  const [castLevel, setCastLevel] = useState(availableLevels[0] || spell.level_int);
  const selfEffect = SELF_TARGET_EFFECTS[spell.name?.toLowerCase()];
  const spellBlocks = getSpellcastingBlocks(character.class_name, character.ability_scores, character.level, character.tracker_data?.inventory?.items);

  const finish = () => { onClose(); if (onCastSuccess) onCastSuccess(); };

  const rollNow = () => setDamageResult({ ...pendingDamage, total: rollDamage(pendingDamage) });

  const doCast = async () => {
    setCasting(true);
    try {
      let levelUsed = spell.level_int;
      if (chargeMode) {
        await chargeMode.onCast();
        setCast(`Cast using ${chargeMode.chargeCost} charge${chargeMode.chargeCost===1?'':'s'}!`);
      } else if (isCantrip) {
        setCast('Cast! (no slot used)');
      } else if (castLevel) {
        await useSlot(castLevel);
        setCast(`Cast at level ${castLevel}!`);
        levelUsed = castLevel;
      }
      const dmg = scaleSpellDamage(spell, levelUsed);
      if (dmg) {
        setPendingDamage(dmg);
      }
      if (selfEffect) {
        setAwaitingTarget(true);
      } else if (!dmg) {
        setTimeout(finish, 700);
      }
    } finally { setCasting(false); }
  };

  const chooseTarget = async (isSelf) => {
    if (isSelf) await addActiveEffect(selfEffect);
    finish();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{color: schoolColor(spell.school)}}>{spell.name}</h2>
          <div style={{color:'var(--text-dim)',fontSize:12}}>
            {spell.level_int === 0 ? 'Cantrip' : `Level ${spell.level_int}`} · {spell.school}
            {spell.ritual ? ' · Ritual' : ''}{spell.concentration ? ' · Concentration' : ''}
          </div>
          {spellBlocks.length > 0 && (
            <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:6}}>
              {spellBlocks.map(b => (
                <span key={b.className} style={{color:'var(--accent-light)',fontSize:12,fontWeight:600}}>
                  {b.className}: {b.attackMod>=0?'+':''}{b.attackMod} atk · DC {b.saveDC}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="modal-body">
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
            <div><b>Casting Time:</b> {spell.casting_time}</div>
            <div><b>Range:</b> {spell.range}</div>
            <div><b>Components:</b> {spell.components}</div>
            <div><b>Duration:</b> {spell.duration}</div>
          </div>
          {spell.damage_dice && (
            <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:12,color:'var(--text-secondary)',marginBottom:12}}>
              <div><b>Damage:</b> {spell.damage_dice} {spell.damage_type}</div>
              {spell.is_attack && <div><b>Attack:</b> {spell.attack_type}</div>}
              {spell.save_type_abbr && <div><b>Save:</b> {spell.save_type_abbr} (half on success)</div>}
            </div>
          )}
          <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap'}}>{spell.description}</p>
        </div>
        <div className="modal-footer" style={{flexDirection:'column'}}>
          {damageResult ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>
                {damageResult.label} {spell.damage_type} damage
                {spell.save_type_abbr ? ` · ${spell.save_type_abbr} DC vs caster · half on success` : ''}
                {spell.is_attack ? ' · requires a spell attack roll' : ''}
              </div>
              <div style={{color:'var(--accent-light)',fontWeight:700,fontSize:28}}>{damageResult.total}</div>
              <div style={{display:'flex',gap:8,marginTop:10}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={rollNow}>Reroll</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={finish}>Done</button>
              </div>
            </div>
          ) : pendingDamage ? (
            <div style={{width:'100%',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:12,textAlign:'center'}}>
              <div style={{color:'var(--text-dim)',fontSize:11,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>
                {pendingDamage.label} {spell.damage_type} damage
                {spell.save_type_abbr ? ` · ${spell.save_type_abbr} DC vs caster · half on success` : ''}
                {spell.is_attack ? ' · requires a spell attack roll' : ''}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={finish}>Skip</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={rollNow}>Roll Damage?</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{width:'100%'}}>
                {awaitingTarget ? (
                  <>
                    <div style={{color:'var(--text-secondary)',fontSize:13,marginBottom:8,textAlign:'center'}}>Apply {selfEffect} to:</div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-primary" style={{flex:1}} onClick={() => chooseTarget(true)}>Self</button>
                      <button className="btn btn-secondary" style={{flex:1}} onClick={() => chooseTarget(false)}>Ally</button>
                    </div>
                  </>
                ) : chargeMode ? (
                  <>
                    <div style={{color:'var(--text-dim)',fontSize:12,marginBottom:8}}>
                      {chargeMode.chargesCurrent}/{chargeMode.chargesMax} charges on {chargeMode.itemName}
                    </div>
                    {chargeMode.chargesCurrent < chargeMode.chargeCost ? (
                      <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>Not enough charges remaining.</div>
                    ) : (
                      <button className="btn btn-primary" style={{width:'100%'}} disabled={casting} onClick={doCast}>
                        {casting ? 'Casting...' : `Cast — Use ${chargeMode.chargeCost} Charge${chargeMode.chargeCost===1?'':'s'}`}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {!isCantrip && availableLevels.length > 1 && (
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                        <span style={{color:'var(--text-dim)',fontSize:12}}>Cast at level:</span>
                        <select value={castLevel} onChange={e => setCastLevel(parseInt(e.target.value))}>
                          {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                    )}
                    {!isCantrip && availableLevels.length === 0 ? (
                      <div style={{color:'var(--danger)',fontSize:12,marginBottom:8}}>No spell slots available.</div>
                    ) : (
                      <button className="btn btn-primary" style={{width:'100%'}} disabled={casting} onClick={doCast}>
                        {casting ? 'Casting...' : isCantrip ? 'Cast (Cantrip)' : `Cast — Use Level ${castLevel} Slot`}
                      </button>
                    )}
                  </>
                )}
                {cast && <div style={{color:'var(--success)',fontSize:12,marginTop:6,textAlign:'center'}}>{cast}</div>}
              </div>
              <button className="btn btn-secondary" style={{width:'100%'}} onClick={onClose}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
