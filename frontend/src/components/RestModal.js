import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { modifier, HIT_DIE } from '../utils/dnd';

export default function RestModal({ onClose, onRest }) {
  const { character, saveTrackerData } = useCharacter();
  const [view, setView] = useState('choose');
  const [rollLog, setRollLog] = useState([]);
  const [spendCount, setSpendCount] = useState(1);

  const td = character?.tracker_data || {};
  const rawHd = td.hit_dice;
  // Fallback for characters whose hit_dice was never populated (pre-dates the feature, needs a Re-sync from PDF)
  const fallbackClass = (character?.class_name || '').split(/[\s/]/)[0];
  const fallbackTotal = character?.level || 1;
  const fallbackDie = HIT_DIE[fallbackClass] || 8;
  const hd = (rawHd && rawHd.total > 0) ? rawHd : { current: fallbackTotal, total: fallbackTotal, die_size: fallbackDie };
  const usingFallback = !rawHd || !rawHd.total;

  const conMod = modifier(character?.ability_scores?.CON || 10);
  const maxHp = td.hp?.max ?? 0;
  const curHp = td.hp?.current ?? 0;

  const spendHitDice = async () => {
    const n = Math.min(spendCount, hd.current);
    if (n <= 0) return;
    let hp = td.hp?.current ?? 0;
    let dice = hd.current;
    const lines = [];
    for (let i = 0; i < n; i++) {
      if (hp >= maxHp) break;
      const roll = 1 + Math.floor(Math.random() * hd.die_size);
      const heal = Math.max(0, roll + conMod);
      hp = Math.min(maxHp, hp + heal);
      dice -= 1;
      lines.push(`d${hd.die_size} → ${roll} +${conMod} CON = ${heal} HP healed`);
    }
    await saveTrackerData({
      ...td,
      hp: { ...td.hp, current: hp },
      hit_dice: { ...hd, current: dice },
    });
    setRollLog(p => [...p, ...lines]);
    setSpendCount(1);
  };

  const finishShortRest = async () => {
    await onRest('short');
  };

  if (view === 'shortRestHitDice') {
    return (
      <div className="modal-overlay">
        <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:380}}>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
          <h2>Short Rest — Hit Dice</h2>
          <p style={{color:'var(--text-secondary)',fontSize:13,marginBottom:12}}>
            Spend Hit Dice to heal. Each die rolls a d{hd.die_size} + your CON modifier ({conMod >= 0 ? `+${conMod}` : conMod}).
          </p>
          {usingFallback && (
            <div style={{color:'var(--warning)',fontSize:11,marginBottom:10,background:'rgba(233,196,106,0.1)',borderRadius:'var(--radius-sm)',padding:8}}>
              This character's hit dice total wasn't saved (likely an older import) — showing an estimate based on level. Go to the Notes tab and click "↻ Re-sync from PDF" to fix this permanently.
            </div>
          )}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{color:'var(--text-secondary)',fontSize:13}}>Hit Dice: <b style={{color:'var(--accent-light)'}}>{hd.current}/{hd.total}</b> (d{hd.die_size})</div>
            <div style={{color:'var(--text-secondary)',fontSize:13}}>HP: <b style={{color:'var(--accent-light)'}}>{curHp}/{maxHp}</b></div>
          </div>

          {hd.current > 0 && curHp < maxHp && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,marginBottom:12}}>
              <span style={{color:'var(--text-dim)',fontSize:12}}>Dice to spend:</span>
              <button onClick={() => setSpendCount(c => Math.max(1, c-1))} style={{background:'var(--danger)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700}}>−</button>
              <span style={{fontWeight:700,color:'var(--accent-light)',minWidth:20,textAlign:'center'}}>{Math.min(spendCount, hd.current)}</span>
              <button onClick={() => setSpendCount(c => Math.min(hd.current, c+1))} style={{background:'var(--success)',color:'#fff',borderRadius:4,width:26,height:26,fontWeight:700}}>+</button>
            </div>
          )}

          <button className="btn btn-primary" style={{width:'100%',marginBottom:12}} disabled={hd.current<=0 || curHp>=maxHp} onClick={spendHitDice}>
            {hd.current<=0 ? 'No Hit Dice Left' : curHp>=maxHp ? 'HP Already Full' : `Spend ${Math.min(spendCount,hd.current)} Hit ${Math.min(spendCount,hd.current)===1?'Die':'Dice'} (d${hd.die_size}+${conMod} each)`}
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
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:320,textAlign:'center'}}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
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
