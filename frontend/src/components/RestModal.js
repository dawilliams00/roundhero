import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { modifier } from '../utils/dnd';

export default function RestModal({ onClose, onRest }) {
  const { character, saveTrackerData } = useCharacter();
  const [view, setView] = useState('choose');
  const [rollLog, setRollLog] = useState([]);

  const td = character?.tracker_data || {};
  const hd = td.hit_dice || { current: 0, total: 0, die_size: 8 };
  const conMod = modifier(character?.ability_scores?.CON || 10);
  const maxHp = td.hp?.max ?? 0;
  const curHp = td.hp?.current ?? 0;

  const spendHitDie = async () => {
    if (hd.current <= 0) return;
    const roll = 1 + Math.floor(Math.random() * hd.die_size);
    const heal = Math.max(0, roll + conMod);
    const newHp = Math.min(maxHp, (td.hp?.current ?? 0) + heal);
    await saveTrackerData({
      ...td,
      hp: { ...td.hp, current: newHp },
      hit_dice: { ...hd, current: hd.current - 1 },
    });
    setRollLog(p => [...p, `d${hd.die_size} → ${roll} +${conMod} CON = ${heal} HP healed`]);
  };

  const finishShortRest = async () => {
    await onRest('short');
  };

  if (view === 'shortRestHitDice') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:360}}>
          <h2>Short Rest — Hit Dice</h2>
          <p style={{color:'var(--text-secondary)',fontSize:13,marginBottom:12}}>
            Spend Hit Dice to heal. Each die rolls a d{hd.die_size} + your CON modifier ({conMod >= 0 ? `+${conMod}` : conMod}).
          </p>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{color:'var(--text-secondary)',fontSize:13}}>Hit Dice: <b style={{color:'var(--accent-light)'}}>{hd.current}/{hd.total}</b> (d{hd.die_size})</div>
            <div style={{color:'var(--text-secondary)',fontSize:13}}>HP: <b style={{color:'var(--accent-light)'}}>{curHp}/{maxHp}</b></div>
          </div>
          <button className="btn btn-primary" style={{width:'100%',marginBottom:12}} disabled={hd.current<=0 || curHp>=maxHp} onClick={spendHitDie}>
            {hd.current<=0 ? 'No Hit Dice Left' : curHp>=maxHp ? 'HP Already Full' : `Spend 1 Hit Die (d${hd.die_size}+${conMod})`}
          </button>
          {rollLog.length > 0 && (
            <div style={{maxHeight:100,overflowY:'auto',background:'var(--bg-primary)',borderRadius:'var(--radius-sm)',padding:8,marginBottom:12}}>
              {rollLog.map((l,i) => <div key={i} style={{color:'var(--text-dim)',fontSize:11}}>{l}</div>)}
            </div>
          )}
          <button className="btn btn-primary" style={{width:'100%'}} onClick={finishShortRest}>Finish Short Rest</button>
          <button className="btn btn-secondary btn-sm" style={{width:'100%',marginTop:8}} onClick={onClose}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:320,textAlign:'center'}}>
        <h2>Take a Rest</h2>
        <p style={{color:'var(--text-secondary)',marginBottom:24,fontSize:13}}>Choose rest type. All matching features and slots will reset.</p>
        <div style={{display:'flex',gap:12}}>
          <button className="btn btn-secondary" style={{flex:1,padding:'12px'}} onClick={() => setView('shortRestHitDice')}>
            <div style={{fontSize:20,marginBottom:4}}>☕</div>
            <div style={{fontWeight:500}}>Short Rest</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:2}}>Spend hit dice</div>
          </button>
          <button className="btn btn-primary" style={{flex:1,padding:'12px'}} onClick={() => onRest('long')}>
            <div style={{fontSize:20,marginBottom:4}}>🌙</div>
            <div style={{fontWeight:500}}>Long Rest</div>
            <div style={{fontSize:11,marginTop:2}}>Full reset</div>
          </button>
        </div>
        <button className="btn btn-secondary btn-sm" style={{marginTop:16}} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
