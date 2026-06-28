import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { ABILITY_KEYS } from '../utils/dnd';

const RARITIES = ['Common','Uncommon','Rare','Very Rare','Legendary','Artifact'];
// Mundane + magic item categories (5e SRD-ish grouping) - what TYPE of item this is
// gates which modifiers make sense for it (a sword shouldn't offer to buff AC, armor
// shouldn't offer weapon attack/damage), and the weapon-specific fields below this
// selector only show for "Weapon". is_weapon stays derived from this (item_type ===
// 'Weapon') for backward compatibility with every existing engine check on it.is_weapon.
const ITEM_TYPES = ['Weapon','Armor','Shield','Potion','Ring','Rod','Scroll','Staff','Wand','Wondrous Item','Tool','Adventuring Gear','Other'];
const RECHARGES = ['none','dawn','dusk','short_rest','long_rest'];
const WEAPON_CATEGORIES = ['Simple','Martial'];
const WEAPON_RANGES = ['Melee','Ranged'];
const DAMAGE_TYPES = ['Slashing','Piercing','Bludgeoning'];
const WEAPON_PROPERTIES = ['Ammunition','Finesse','Heavy','Light','Loading','Monk','Reach','Special','Thrown','Two-Handed','Versatile'];

// Every buff stat the engine actually consumes (computeItemBonuses/weaponItemBonus in
// dnd.js) - the modifier editor below is just a friendly form over this same set, so a
// "+3 weapon" (weapon_attack_modifier + weapon_damage_modifier) or a +1 AC ring (ac_base)
// can be entered without hand-writing JSON via the admin editor. ADD-mode stats sum a
// flat value; SET-mode (an ability key) overrides that ability's score while equipped
// (computeItemBonuses takes the max against the character's raw score, never lowers it).
const FULL_DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];
const CONDITIONS = ['Blinded','Charmed','Deafened','Exhaustion','Frightened','Grappled','Incapacitated','Invisible','Paralyzed','Petrified','Poisoned','Prone','Restrained','Stunned','Unconscious'];

const ADD_MODIFIERS = [
  { stat: 'ac_base', label: 'AC' },
  { stat: 'saving_throw_modifier', label: 'All Saving Throws' },
  { stat: 'spell_attack_modifier', label: 'Spell Attack Rolls' },
  { stat: 'spell_dc_modifier', label: 'Spell Save DC' },
  { stat: 'weapon_attack_modifier', label: 'Weapon Attack Rolls (this weapon)' },
  { stat: 'weapon_damage_modifier', label: 'Weapon Damage (this weapon)' },
];

export default function AddItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => item ? {
    ...item,
    has_charges: !!item.charges,
    charges_current: item.charges?.current ?? 0,
    charges_max: item.charges?.max ?? 0,
    recharge: item.charges?.recharge || 'none',
    recharge_amount: item.charges?.recharge_amount || '',
    granted_spells: item.granted_spells || [],
    is_weapon: !!item.is_weapon,
    weapon_category: item.weapon_category || 'Simple',
    weapon_range: item.weapon_range || 'Melee',
    damage_dice: item.damage_dice || '',
    damage_type: item.damage_type || 'Slashing',
    properties: item.properties || [],
    range_normal: item.range?.normal ?? '',
    range_long: item.range?.long ?? '',
    two_handed_damage_dice: item.two_handed_damage?.damage_dice || '',
    two_handed_damage_type: item.two_handed_damage?.damage_type || '',
    proficient: item.proficient ?? true,
    two_handed: !!item.two_handed,
    bonus_damage_dice: item.bonus_damage_dice || '',
    bonus_damage_type: item.bonus_damage_type || '',
    buffs: item.buffs || [],
    item_type: item.item_type || (item.is_weapon ? 'Weapon' : 'Other'),
  } : {
    name: '', quantity: 1, weight: 0, rarity: 'Common',
    equipped: false, attunement: false, attuned: false,
    has_charges: false, charges_current: 0, charges_max: 0, recharge: 'none', recharge_amount: '',
    description: '', granted_spells: [],
    is_weapon: false, weapon_category: 'Simple', weapon_range: 'Melee',
    damage_dice: '', damage_type: 'Slashing', properties: [],
    range_normal: '', range_long: '', two_handed_damage_dice: '', two_handed_damage_type: '',
    proficient: true, two_handed: false, bonus_damage_dice: '', bonus_damage_type: '',
    buffs: [],
    item_type: 'Other',
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const toggleProperty = (p) => setForm(f => ({...f, properties: f.properties.includes(p) ? f.properties.filter(x=>x!==p) : [...f.properties, p]}));

  // Modifier rows mirror the buff shapes dnd.js actually reads - an ADD-mode stat from
  // ADD_MODIFIERS, or an ability key with mode:'set' for "this item sets your score to X."
  const addModifier = () => set('buffs', [...form.buffs, { stat: 'ac_base', value: 1 }]);
  const updateModifier = (i, patch) => set('buffs', form.buffs.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const removeModifier = (i) => set('buffs', form.buffs.filter((_, idx) => idx !== i));
  const setModifierType = (i, value) => {
    // "set:STR" (ability override), "add:STR" (flat ability bonus), "advsave:STR"/
    // "advsave:all" (advantage on saves), "resist"/"immune"/"vuln" (damage type buffs,
    // defaulting to the first damage type until the player picks one), "condimmune"
    // (condition immunity) all select a different buff shape; anything else is a plain
    // ADD_MODIFIERS stat key. One update, not several sequential ones reading the same
    // stale form.buffs - that's the exact bug class this file's submit() footgun note
    // warns about, just on the read side instead of the save side.
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

  // Lets "Granted Spells" rows search the real spell library (canon + homebrew, same data
  // SpellBrowserModal uses) instead of free-typing a name - guarantees an exact match so
  // ItemSpellsModal's resolveSpell() can find it, and fills in the spell's real level_int
  // instead of it silently defaulting to 0/cantrip.
  const [spellOptions, setSpellOptions] = useState([]);
  const [activeSpellRow, setActiveSpellRow] = useState(null);
  useEffect(() => { api.get('/content/spells').then(r => setSpellOptions(r.data)).catch(() => {}); }, []);

  const addSpellRow = () => set('granted_spells', [...form.granted_spells, { name: '', level_int: 0, charge_cost: 1 }]);
  const updateSpellRow = (i, key, val) => {
    const next = form.granted_spells.map((s, idx) => idx === i ? { ...s, [key]: val } : s);
    set('granted_spells', next);
  };
  const removeSpellRow = (i) => set('granted_spells', form.granted_spells.filter((_, idx) => idx !== i));
  const pickSpell = (i, spell) => {
    // One merged update, not two sequential updateSpellRow calls - each of those reads
    // form.granted_spells from the same stale render closure, so the second call would
    // overwrite the first's change instead of compounding with it.
    const next = form.granted_spells.map((s, idx) => idx === i ? { ...s, name: spell.name, level_int: spell.level_int } : s);
    set('granted_spells', next);
    setActiveSpellRow(null);
  };

  const submit = () => {
    if (!form.name) return;
    const out = {
      name: form.name,
      quantity: parseInt(form.quantity) || 1,
      weight: parseFloat(form.weight) || 0,
      rarity: form.rarity,
      equipped: !!form.equipped,
      attunement: !!form.attunement,
      attuned: !!form.attuned,
      description: form.description,
      // recharge_amount (e.g. "2d4+2" for a partial recharge like Staff of the Magi) must be
      // carried through explicitly - omitting it here previously meant editing a partial-
      // recharge item silently turned it into a full-recharge item on every save.
      charges: form.has_charges ? { current: parseInt(form.charges_current)||0, max: parseInt(form.charges_max)||0, recharge: form.recharge, ...(form.recharge_amount.trim() ? { recharge_amount: form.recharge_amount.trim() } : {}) } : null,
      granted_spells: form.granted_spells.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), level_int: parseInt(s.level_int)||0, charge_cost: parseInt(s.charge_cost)||1 })),
      buffs: form.buffs || [],
      item_type: form.item_type,
      // Weapon fields - always include is_weapon explicitly (even false) so
      // changing item_type away from Weapon on an edit actually clears weapon-ness
      // rather than leaving stale fields from before.
      is_weapon: form.item_type === 'Weapon',
      ...(form.item_type === 'Weapon' ? {
        weapon_category: form.weapon_category,
        weapon_range: form.weapon_range,
        damage_dice: form.damage_dice,
        damage_type: form.damage_type,
        properties: form.properties || [],
        range: (form.range_normal || form.range_long) ? { normal: parseInt(form.range_normal)||0, ...(form.range_long ? { long: parseInt(form.range_long) } : {}) } : null,
        two_handed_damage: (form.properties||[]).includes('Versatile') && form.two_handed_damage_dice
          ? { damage_dice: form.two_handed_damage_dice, damage_type: form.two_handed_damage_type || form.damage_type }
          : null,
        proficient: !!form.proficient,
        two_handed: !!form.two_handed,
        // A second, independent damage component (e.g. Vicious's extra 2d6, or a
        // Flame Tongue-style different-typed die) rolled and shown alongside the base
        // weapon damage in WeaponAttackModal, not folded into it - blank type means
        // "same type as the weapon's own damage."
        bonus_damage_dice: form.bonus_damage_dice.trim(),
        bonus_damage_type: form.bonus_damage_type,
      } : {}),
    };
    onSave(out);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{item ? 'Edit Item' : 'Add Item'}</h2>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Item name" autoFocus /></div>
        <div className="form-row">
          <div className="form-group"><label>Quantity</label><input type="number" min={1} value={form.quantity} onChange={e=>set('quantity',e.target.value)} /></div>
          <div className="form-group"><label>Weight (lb)</label><input type="number" min={0} step={0.1} value={form.weight} onChange={e=>set('weight',e.target.value)} /></div>
        </div>
        <div className="form-group"><label>Rarity</label><select value={form.rarity} onChange={e=>set('rarity',e.target.value)}>{RARITIES.map(r=><option key={r}>{r}</option>)}</select></div>
        <div className="form-row">
          <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.equipped} onChange={e=>set('equipped',e.target.checked)} /> Equipped</label>
          <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.attunement} onChange={e=>set('attunement',e.target.checked)} /> Requires Attunement</label>
        </div>
        {form.attunement && (
          <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><input type="checkbox" checked={form.attuned} onChange={e=>set('attuned',e.target.checked)} /> Currently Attuned</label>
        )}
        <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><input type="checkbox" checked={form.has_charges} onChange={e=>set('has_charges',e.target.checked)} /> Has Charges</label>
        {form.has_charges && (
          <div className="form-row">
            <div className="form-group"><label>Max Charges</label><input type="number" min={0} value={form.charges_max} onChange={e=>{set('charges_max',e.target.value); set('charges_current',e.target.value);}} /></div>
            <div className="form-group"><label>Recharges On</label><select value={form.recharge} onChange={e=>set('recharge',e.target.value)}>{RECHARGES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</select></div>
            <div className="form-group"><label>Recharge Amount</label><input value={form.recharge_amount} onChange={e=>set('recharge_amount',e.target.value)} placeholder="e.g. 2d4+2 (blank = full)" /></div>
          </div>
        )}
        <div className="form-group"><label>Item Type</label><select value={form.item_type} onChange={e=>set('item_type',e.target.value)}>{ITEM_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        {form.item_type === 'Weapon' && (
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:8}}>
            <div className="form-row">
              <div className="form-group"><label>Category</label><select value={form.weapon_category} onChange={e=>set('weapon_category',e.target.value)}>{WEAPON_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label>Range</label><select value={form.weapon_range} onChange={e=>set('weapon_range',e.target.value)}>{WEAPON_RANGES.map(r=><option key={r}>{r}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Damage Dice</label><input value={form.damage_dice} onChange={e=>set('damage_dice',e.target.value)} placeholder="e.g. 1d8" /></div>
              <div className="form-group"><label>Damage Type</label><select value={form.damage_type} onChange={e=>set('damage_type',e.target.value)}>{DAMAGE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Range (normal ft)</label><input type="number" min={0} value={form.range_normal} onChange={e=>set('range_normal',e.target.value)} /></div>
              <div className="form-group"><label>Range (long ft)</label><input type="number" min={0} value={form.range_long} onChange={e=>set('range_long',e.target.value)} /></div>
            </div>
            <label style={{display:'block',fontSize:12,color:'var(--text-dim)',marginBottom:4}}>Properties</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
              {WEAPON_PROPERTIES.map(p => (
                <label key={p} style={{display:'flex',alignItems:'center',gap:4,fontSize:12}}>
                  <input type="checkbox" checked={form.properties.includes(p)} onChange={()=>toggleProperty(p)} /> {p}
                </label>
              ))}
            </div>
            {form.properties.includes('Versatile') && (
              <div className="form-row">
                <div className="form-group"><label>Two-Handed Damage Dice</label><input value={form.two_handed_damage_dice} onChange={e=>set('two_handed_damage_dice',e.target.value)} placeholder="e.g. 1d10" /></div>
                <div className="form-group"><label>Two-Handed Damage Type</label><select value={form.two_handed_damage_type} onChange={e=>set('two_handed_damage_type',e.target.value)}><option value="">(same as above)</option>{DAMAGE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
            )}
            <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.proficient} onChange={e=>set('proficient',e.target.checked)} /> Proficient</label>
            <div className="form-row" style={{marginTop:8}}>
              <div className="form-group"><label>Bonus Damage Dice (optional)</label><input value={form.bonus_damage_dice} onChange={e=>set('bonus_damage_dice',e.target.value)} placeholder="e.g. 2d6 (Vicious)" /></div>
              <div className="form-group"><label>Bonus Damage Type</label><select value={form.bonus_damage_type} onChange={e=>set('bonus_damage_type',e.target.value)}><option value="">(same as weapon)</option>{DAMAGE_TYPES.concat(['Acid','Cold','Fire','Force','Lightning','Necrotic','Poison','Psychic','Radiant','Thunder']).map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2}}>An extra damage component rolled alongside the base damage - e.g. Vicious's +2d6, or a different-typed bonus die like Flame Tongue's fire damage.</div>
          </div>
        )}
        <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,margin:'12px 0 6px'}}>Modifiers</div>
        {form.buffs.map((b, i) => {
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
                {/* weapon_attack_modifier/weapon_damage_modifier are gated to Weapon - they're
                    explicitly "(this weapon)" buffs with no meaning on anything else. AC is
                    NOT excluded for weapons - a JSON search turned up real existing items
                    (a parrying dagger, a couple of archfiend artifact weapons) that
                    legitimately grant AC while wielded, so that assumption didn't hold. */}
                {ADD_MODIFIERS.filter(m => !m.stat.startsWith('weapon_') || form.item_type === 'Weapon').map(m => (
                  <option key={m.stat} value={m.stat}>{m.label}</option>
                ))}
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
          Only applies while the item is Equipped (and Attuned, if attunement is required). "Set X Score To" never lowers the character's score - it only raises it up to the value entered. "Add to X Score" is a flat bonus regardless of current score. "Advantage on Saves" shows as a header chip (RAW advantage isn't auto-rolled anywhere in this app - same as conditions/exhaustion, you apply it yourself).
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={3} style={{width:'100%',resize:'vertical'}} /></div>

        <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,margin:'12px 0 6px'}}>Granted Spells</div>
        {form.granted_spells.map((s, i) => {
          const query = s.name.trim().toLowerCase();
          const matches = activeSpellRow === i && query
            ? spellOptions.filter(sp => sp.name.toLowerCase().includes(query)).slice(0, 8)
            : [];
          return (
            <div key={i} style={{display:'flex',gap:6,marginBottom:6,alignItems:'flex-start'}}>
              <div style={{position:'relative',flex:1}}>
                <input
                  value={s.name}
                  onChange={e => { updateSpellRow(i,'name',e.target.value); setActiveSpellRow(i); }}
                  onFocus={() => setActiveSpellRow(i)}
                  onBlur={() => setTimeout(() => setActiveSpellRow(c => c === i ? null : c), 150)}
                  placeholder="Search spell name..."
                  style={{width:'100%'}}
                />
                {matches.length > 0 && (
                  <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:20,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',maxHeight:160,overflowY:'auto',boxShadow:'var(--shadow)'}}>
                    {matches.map(sp => (
                      <div key={sp.name} onMouseDown={() => pickSpell(i, sp)} style={{padding:'6px 10px',cursor:'pointer',fontSize:12,color:'var(--text-primary)',borderBottom:'1px solid var(--border)'}}>
                        {sp.name} <span style={{color:'var(--text-dim)'}}>({sp.level_int===0?'Cantrip':`L${sp.level_int}`})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input type="number" min={1} value={s.charge_cost} onChange={e=>updateSpellRow(i,'charge_cost',e.target.value)} title="Charge cost" style={{width:56}} />
              <button className="btn btn-secondary btn-sm" onClick={()=>removeSpellRow(i)}>×</button>
            </div>
          );
        })}
        <button className="btn btn-secondary btn-sm" onClick={addSpellRow}>+ Add Granted Spell</button>

        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name} onClick={submit}>{item ? 'Save' : 'Add Item'}</button>
        </div>
      </div>
    </div>
  );
}
