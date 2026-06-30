import React, { useState } from 'react';
import { parseDiceFormula, rollDamage } from '../utils/dnd';

export default function RechargeItemModal({ item, onApply, onClose }) {
  const charges = item.charges || {};
  const max = charges.max || 0;
  const current = charges.current || 0;
  const dice = parseDiceFormula(charges.recharge_amount);
  const [rolled, setRolled] = useState(null);
  const [amount, setAmount] = useState('');

  const roll = () => {
    if (!dice) return;
    const n = rollDamage(dice);
    setRolled(n);
    setAmount(String(n));
  };

  const apply = () => {
    const n = parseInt(amount);
    if (isNaN(n) || n <= 0) return;
    onApply(Math.min(max, current + n));
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:320}}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <h2>Recharge — {item.name}</h2>
        <div style={{textAlign:'center',color:'var(--success)',fontWeight:700,fontSize:20,marginBottom:14}}>{current} / {max} charges</div>

        {dice && (
          <div style={{textAlign:'center',marginBottom:14}}>
            <button className="btn btn-primary" style={{width:'100%'}} onClick={roll}>Roll {charges.recharge_amount}</button>
            {rolled != null && <div style={{color:'var(--accent-light)',fontSize:24,fontWeight:700,marginTop:8}}>{rolled}</div>}
          </div>
        )}

        <div className="form-group">
          <label>Charges to add</label>
          <input type="number" min={0} max={max - current} value={amount} onChange={e => setAmount(e.target.value)} placeholder="Manual amount" />
        </div>

        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:1}} disabled={!amount || parseInt(amount) <= 0} onClick={apply}>Recharge</button>
        </div>
      </div>
    </div>
  );
}
