import React, { useState, useEffect } from 'react';

const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100];
const COUNTS = Array.from({ length: 20 }, (_, i) => i + 1);

// Structured count/die-size (and optional flat bonus) picker instead of a free-text "NdM"
// field - prevents the exact class of typo this was built for ("74d20" instead of "1d20",
// a stray extra digit from a fat-fingered edit) by construction, since every selectable
// value is already valid dice notation. Used for any field this app stores as a plain
// "NdM" or "NdM+X" string: weapon/item damage_dice, bonus_damage_dice,
// two_handed_damage_dice, unarmed_bonus_damage_dice, spell damage_dice/
// secondary_damage_dice, and item recharge_amount (allowFlatBonus).
//
// value/onChange work on the same plain string the rest of the app already expects
// (weaponDamageDice/parseDice in dnd.js, rollDamageDetailed, etc. all parse "NdM" already)
// - this is purely a UI-layer change, no data shape changes needed anywhere else.
export default function DiceInput({ value, onChange, allowFlatBonus = false, allowEmpty = true }) {
  const parsed = parseDiceString(value);
  const [count, setCount] = useState(parsed.count);
  const [die, setDie] = useState(parsed.die);
  const [bonus, setBonus] = useState(parsed.bonus);

  // Re-syncs local state when the parent's value changes out from under us (e.g. a
  // different item/spell loaded into the same modal instance) - keyed on the raw value
  // string itself, not the parsed pieces, so typing in our own dropdowns doesn't fight
  // with this effect re-running.
  useEffect(() => {
    const p = parseDiceString(value);
    setCount(p.count);
    setDie(p.die);
    setBonus(p.bonus);
  }, [value]);

  const emit = (nextCount, nextDie, nextBonus) => {
    if (!nextDie) { onChange(''); return; }
    const base = `${nextCount}d${nextDie}`;
    onChange(nextBonus ? `${base}+${nextBonus}` : base);
  };

  return (
    <div style={{display:'flex',gap:6,alignItems:'center'}}>
      <select value={count} onChange={e => { const v = parseInt(e.target.value); setCount(v); emit(v, die, bonus); }} style={{width:64}}>
        {COUNTS.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <span style={{color:'var(--text-dim)'}}>d</span>
      <select value={die} onChange={e => { const v = e.target.value; setDie(v); emit(count, v, bonus); }} style={{width:80}}>
        {allowEmpty && <option value="">—</option>}
        {DIE_SIZES.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
      {allowFlatBonus && (
        <>
          <span style={{color:'var(--text-dim)'}}>+</span>
          <input type="number" min={0} value={bonus} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setBonus(v); emit(count, die, v); }}
            placeholder="0" style={{width:60}} />
        </>
      )}
    </div>
  );
}

// Tolerant of whatever's already stored (including a malformed value like "74d20" - this
// is exactly the bug this component exists to make unrepeatable) - falls back to a safe
// default (1d6, no bonus) rather than crashing on anything unparseable, so opening an item
// with already-bad data doesn't break the editor; the player just has to pick again.
function parseDiceString(value) {
  const s = String(value || '').trim();
  if (!s) return { count: 1, die: '', bonus: '' };
  const m = s.match(/^(\d+)\s*d\s*(\d+)\s*(?:\+\s*(\d+))?$/i);
  if (m) return { count: parseInt(m[1]) || 1, die: m[2], bonus: m[3] || '' };
  return { count: 1, die: '', bonus: '' };
}
