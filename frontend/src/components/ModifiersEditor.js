import React from 'react';
import { ABILITY_KEYS } from '../utils/dnd';

// Shared "Modifiers" editor - originally AddItemModal's, extracted so feats (via
// CustomAbilityModal/FeatureEditModal) can offer the exact same level of control over
// AC/saves/spell attack-DC/ability scores/resistances/advantage-on-saves, rather than
// re-implementing (and inevitably drifting from) the same buff-shape logic a second time.
// weapon_attack_modifier/weapon_damage_modifier are gated behind allowWeapon - on an item
// they're inherently "this one weapon" (weaponItemBonus in dnd.js deliberately never
// pools an item's copy character-wide), but on a feat they mean "every weapon attack"
// (featWeaponBonus, a separate character-wide aggregator) - weaponScope picks the right
// wording for whichever caller this is.
const ADD_MODIFIERS = (weaponScope) => [
  { stat: 'ac_base', label: 'AC' },
  { stat: 'saving_throw_modifier', label: 'All Saving Throws' },
  { stat: 'spell_attack_modifier', label: 'Spell Attack Rolls' },
  { stat: 'spell_dc_modifier', label: 'Spell Save DC' },
  { stat: 'weapon_attack_modifier', label: `Weapon Attack Rolls (${weaponScope})` },
  { stat: 'weapon_damage_modifier', label: `Weapon Damage (${weaponScope})` },
];
const FULL_DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];
const CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

export default function ModifiersEditor({ buffs, onChange, allowWeapon = false, weaponScope = 'this weapon', activeWhileText }) {
  const addModifier = () => onChange([...buffs, { stat: 'ac_base', value: 1 }]);
  const updateModifier = (i, patch) => onChange(buffs.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const removeModifier = (i) => onChange(buffs.filter((_, idx) => idx !== i));
  const setModifierType = (i, value) => {
    if (value.startsWith('set:')) {
      updateModifier(i, { stat: value.slice(4), mode: 'set', ability: undefined, damage_type: undefined, condition: undefined, value: 19 });
    } else if (value.startsWith('add:')) {
      updateModifier(i, { stat: value.slice(4), mode: 'add', ability: undefined, damage_type: undefined, condition: undefined, value: 1 });
    } else if (value.startsWith('advsave:')) {
      updateModifier(i, { stat: 'advantage_save', mode: undefined, ability: value.slice(8), damage_type: undefined, condition: undefined, value: undefined });
    } else if (value === 'resist' || value === 'immune' || value === 'vuln') {
      const stat = { resist: 'damage_resistance', immune: 'damage_immunity', vuln: 'damage_vulnerability' }[value];
      updateModifier(i, { stat, mode: undefined, ability: undefined, damage_type: FULL_DAMAGE_TYPES[0], condition: undefined, value: undefined });
    } else if (value === 'condimmune') {
      updateModifier(i, { stat: 'condition_immunity', mode: undefined, ability: undefined, damage_type: undefined, condition: CONDITIONS[0], value: undefined });
    } else {
      updateModifier(i, { stat: value, mode: undefined, ability: undefined, damage_type: undefined, condition: undefined, value: 1 });
    }
  };

  return (
    <>
      <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,margin:'12px 0 6px'}}>Modifiers</div>
      {buffs.map((b, i) => {
        const isSetMode = b.mode === 'set';
        const isAddMode = b.mode === 'add';
        const isAdvSave = b.stat === 'advantage_save';
        const isDamageBuff = ['damage_resistance','damage_immunity','damage_vulnerability'].includes(b.stat);
        const isCondImmune = b.stat === 'condition_immunity';
        const damageBuffPrefix = { damage_resistance: 'resist', damage_immunity: 'immune', damage_vulnerability: 'vuln' }[b.stat];
        const selectValue = isSetMode ? `set:${b.stat}` : isAddMode ? `add:${b.stat}` : isAdvSave ? `advsave:${b.ability || 'all'}`
          : isDamageBuff ? damageBuffPrefix : isCondImmune ? 'condimmune' : b.stat;
        return (
          <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
            <select value={selectValue} onChange={e => setModifierType(i, e.target.value)} style={{flex:2}}>
              {ADD_MODIFIERS(weaponScope).filter(m => !m.stat.startsWith('weapon_') || allowWeapon).map(m => (
                <option key={m.stat} value={m.stat}>{m.label}</option>
              ))}
              <option value="set:ac_base">Set Base AC To... (heavy armor)</option>
              {ABILITY_KEYS.map(k => <option key={`set-${k}`} value={`set:${k}`}>Set {k} Score To...</option>)}
              {ABILITY_KEYS.map(k => <option key={`add-${k}`} value={`add:${k}`}>Add to {k} Score</option>)}
              <option value="advsave:all">Advantage on All Saving Throws</option>
              {ABILITY_KEYS.map(k => <option key={`advsave-${k}`} value={`advsave:${k}`}>Advantage on {k} Saves</option>)}
              <option value="resist">Resistance to Damage Type...</option>
              <option value="immune">Immunity to Damage Type...</option>
              <option value="vuln">Vulnerability to Damage Type...</option>
              <option value="condimmune">Immunity to Condition...</option>
            </select>
            {isDamageBuff && (
              <select value={b.damage_type} onChange={e => updateModifier(i, { damage_type: e.target.value })} style={{flex:1}}>
                {FULL_DAMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            )}
            {isCondImmune && (
              <select value={b.condition} onChange={e => updateModifier(i, { condition: e.target.value })} style={{flex:1}}>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            )}
            {!isAdvSave && !isDamageBuff && !isCondImmune && (
              <>
                <span style={{fontSize:12,color:'var(--text-dim)'}}>{isSetMode ? 'becomes' : '+'}</span>
                <input type="number" value={b.value} onChange={e => updateModifier(i, { value: parseInt(e.target.value) || 0 })} style={{width:60}} />
              </>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => removeModifier(i)}>✕</button>
          </div>
        );
      })}
      <button className="btn btn-secondary btn-sm" style={{marginBottom:8}} onClick={addModifier}>+ Add Modifier</button>
      <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:10}}>
        {activeWhileText || 'Always active.'} "Set X Score To" never lowers the character's score - it only raises it up to the value entered. "Add to X Score" is a flat bonus regardless of current score. "Set Base AC To" is for body armor whose AC replaces the unarmored calculation entirely (e.g. Plate's flat 18, ignoring DEX) rather than adding to it - it overrides the character's base AC while equipped/attuned and reverts the moment it's unequipped; a shield or other AC item should use the plain "AC" modifier above instead, since that one still adds on top. "Advantage on Saves" shows as a header chip (RAW advantage isn't auto-rolled anywhere in this app - same as conditions/exhaustion, you apply it yourself).
      </div>
    </>
  );
}
