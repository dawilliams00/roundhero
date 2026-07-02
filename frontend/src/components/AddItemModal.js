import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ModifiersEditor from './ModifiersEditor';
import DiceInput from './DiceInput';

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
const FULL_DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];

export default function AddItemModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => item ? {
    ...item,
    has_charges: !!item.charges,
    charges_current: item.charges?.current ?? 0,
    charges_max: item.charges?.max ?? 0,
    recharge: item.charges?.recharge || 'none',
    recharge_mode: item.charges?.recharge_amount ? 'roll' : 'full',
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
    bonus_heal_or_advantage: !!item.bonus_heal_or_advantage,
    buffs: item.buffs || [],
    item_type: item.item_type || (item.is_weapon ? 'Weapon' : 'Other'),
    grants_unarmed_bonus: !!item.grants_unarmed_bonus,
    unarmed_bonus_damage_dice: item.unarmed_bonus_damage_dice || '',
    unarmed_bonus_damage_type: item.unarmed_bonus_damage_type || '',
    unarmed_heal_or_advantage: !!item.unarmed_heal_or_advantage,
    grants_concentration_slot: !!item.grants_concentration_slot,
  } : {
    name: '', quantity: 1, weight: 0, rarity: 'Common',
    equipped: false, attunement: false, attuned: false,
    has_charges: false, charges_current: 0, charges_max: 0, recharge: 'none', recharge_mode: 'full', recharge_amount: '',
    description: '', granted_spells: [],
    is_weapon: false, weapon_category: 'Simple', weapon_range: 'Melee',
    damage_dice: '', damage_type: 'Slashing', properties: [],
    range_normal: '', range_long: '', two_handed_damage_dice: '', two_handed_damage_type: '',
    proficient: true, two_handed: false, bonus_damage_dice: '', bonus_damage_type: '', bonus_heal_or_advantage: false,
    buffs: [],
    item_type: 'Other',
    grants_unarmed_bonus: false, unarmed_bonus_damage_dice: '', unarmed_bonus_damage_type: '', unarmed_heal_or_advantage: false,
    grants_concentration_slot: false,
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const toggleProperty = (p) => setForm(f => ({...f, properties: f.properties.includes(p) ? f.properties.filter(x=>x!==p) : [...f.properties, p]}));

  // Lets "Granted Spells" rows search the real spell library (canon + homebrew, same data
  // SpellBrowserModal uses) instead of free-typing a name - guarantees an exact match so
  // ItemSpellsModal's resolveSpell() can find it, and fills in the spell's real level_int
  // instead of it silently defaulting to 0/cantrip.
  const [spellOptions, setSpellOptions] = useState([]);
  const [activeSpellRow, setActiveSpellRow] = useState(null);
  useEffect(() => { api.get('/content/spells').then(r => setSpellOptions(r.data)).catch(() => {}); }, []);

  const addSpellRow = () => set('granted_spells', [...form.granted_spells, { name: '', level_int: 0, charge_cost: 1, cast_level: '' }]);
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

  const buildOutput = () => {
    return {
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
      // recharge item silently turned it into a full-recharge item on every save. Gated on
      // recharge_mode==='roll' (not just whether the text box happens to be non-empty) so
      // switching the dropdown back to "Full Recharge" reliably clears a stale roll formula.
      charges: form.has_charges ? { current: parseInt(form.charges_current)||0, max: parseInt(form.charges_max)||0, recharge: form.recharge, ...(form.recharge_mode === 'roll' && form.recharge_amount.trim() ? { recharge_amount: form.recharge_amount.trim() } : {}) } : null,
      // cast_level is the slot level the item forces this spell to cast at (e.g. Staff of
      // the Magi casting Fireball at 7th), independent of the spell's own base level_int.
      // Left blank => casts at the spell's base level; ItemSpellsModal's resolveSpell reads
      // `granted.cast_level ?? master.level_int` and preserves base_level_int so damage
      // scaling stays correct. Only written when it's a real number >= the spell's base
      // level (you can't downcast), otherwise stored null so the fallback kicks in.
      granted_spells: form.granted_spells.filter(s => s.name.trim()).map(s => {
        const baseLvl = parseInt(s.level_int) || 0;
        const cl = parseInt(s.cast_level);
        return { name: s.name.trim(), level_int: baseLvl, charge_cost: parseInt(s.charge_cost)||1, cast_level: (!isNaN(cl) && cl >= baseLvl) ? cl : null };
      }),
      buffs: form.buffs || [],
      item_type: form.item_type,
      // Gloves/gauntlets-style items that boost unarmed strikes specifically (e.g.
      // Gloves of the Galeb Duhr's 2d10 force + heal-or-advantage) - consumed by
      // ActionEconomyTab to build the Unarmed Strike row's bonus damage, same
      // bonus_damage_dice/type shape weapons use, plus the heal-or-advantage follow-up
      // choice WeaponAttackModal offers after the bonus damage is rolled.
      grants_unarmed_bonus: !!form.grants_unarmed_bonus,
      ...(form.grants_unarmed_bonus ? {
        unarmed_bonus_damage_dice: form.unarmed_bonus_damage_dice.trim(),
        unarmed_bonus_damage_type: form.unarmed_bonus_damage_type,
        unarmed_heal_or_advantage: !!form.unarmed_heal_or_advantage,
      } : {}),
      // Explicit flag instead of a fuzzy description-text match (see concentrationSlotCount
      // in dnd.js) - grants a second concentration slot while equipped+attuned, on top of
      // the wearer's own base slot if they're a caster at all.
      grants_concentration_slot: !!form.grants_concentration_slot,
      // is_weapon is its own explicit checkbox, independent of item_type - a Staff or Rod
      // can be a real spellcasting focus (item_type='Staff', granted spells, charges) AND
      // a wieldable quarterstaff at the same time (e.g. Staff of Power: +2 attack/damage
      // as a weapon, +2 spell attack/DC while held). Tying is_weapon to item_type==='Weapon'
      // made that combination impossible to model - this field always saves explicitly
      // (even false) so unchecking it on an edit actually clears weapon-ness.
      is_weapon: !!form.is_weapon,
      ...(form.is_weapon ? {
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
        bonus_heal_or_advantage: !!form.bonus_heal_or_advantage,
      } : {}),
    };
  };

  const submit = () => {
    if (!form.name) return;
    onSave(buildOutput());
    onClose();
  };

  // Pushes this item's current data to the shared library so every player can pull the
  // fix/addition instead of it only ever living in one person's inventory - same
  // collective-editing model ItemBrowserModal already gives canon/homebrew items, just
  // reachable from the player's own item edit screen instead of a separate browser. If
  // the name matches a canon entry, this corrects it in place (item_override); if it
  // matches an already-published custom entry, this updates that; otherwise it's a brand
  // new homebrew library entry. Doesn't touch this character's own copy at all - publish
  // and Save/Cancel are independent actions.
  const [publishMsg, setPublishMsg] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const publishToLibrary = async () => {
    if (!form.name.trim()) return;
    setPublishing(true);
    setPublishMsg(null);
    try {
      const out = buildOutput();
      const library = (await api.get('/content/items')).data;
      const nameLower = out.name.trim().toLowerCase();
      const canonMatch = library.find(it => it.name.toLowerCase() === nameLower && it._source !== 'custom');
      const customMatch = library.find(it => it.name.toLowerCase() === nameLower && it._source === 'custom');
      if (canonMatch) {
        await api.put('/content/items/override', { ...out, _canon_name: canonMatch.name });
        setPublishMsg(`Updated the canon "${out.name}" entry for everyone.`);
      } else if (customMatch) {
        await api.put(`/content/items/${customMatch._custom_id}`, out);
        setPublishMsg(`Updated the shared "${out.name}" entry for everyone.`);
      } else {
        await api.post('/content/items', out);
        setPublishMsg(`Added "${out.name}" to the shared item library - searchable by anyone now.`);
      }
    } catch {
      setPublishMsg('Could not publish to the database - try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{maxWidth:960}} onClick={e => e.stopPropagation()}>
        <div className="modal-sticky-header">
          <h2>{item ? 'Edit Item' : 'Add Item'}</h2>
          <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        </div>
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
            <div className="form-group">
              <label>Recharge</label>
              <select value={form.recharge_mode} onChange={e=>set('recharge_mode',e.target.value)}>
                <option value="full">Full Recharge</option>
                <option value="roll">Roll to Recharge</option>
              </select>
            </div>
            <div className="form-group">
              <label>{form.recharge_mode === 'roll' ? 'Rolls At' : 'Recharges On'}</label>
              <select value={form.recharge} onChange={e=>set('recharge',e.target.value)}>{RECHARGES.map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}</select>
            </div>
            {form.recharge_mode === 'roll' && (
              <div className="form-group"><label>Roll Amount</label><DiceInput value={form.recharge_amount} onChange={v=>set('recharge_amount',v)} allowFlatBonus /></div>
            )}
          </div>
        )}
        <div className="form-group"><label>Item Type</label><select value={form.item_type} onChange={e=>setForm(f=>({...f, item_type:e.target.value, is_weapon: e.target.value === 'Weapon' ? true : f.is_weapon}))}>{ITEM_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
        <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}} title="Independent of Item Type - a Staff or Rod can be both a spellcasting focus AND a wieldable weapon at the same time (e.g. Staff of Power)">
          <input type="checkbox" checked={form.is_weapon} onChange={e=>set('is_weapon',e.target.checked)} /> Can Also Be Wielded as a Weapon
        </label>
        {form.is_weapon && (
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:8}}>
            <div className="form-row">
              <div className="form-group"><label>Category</label><select value={form.weapon_category} onChange={e=>set('weapon_category',e.target.value)}>{WEAPON_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label>Range</label><select value={form.weapon_range} onChange={e=>set('weapon_range',e.target.value)}>{WEAPON_RANGES.map(r=><option key={r}>{r}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Damage Dice</label><DiceInput value={form.damage_dice} onChange={v=>set('damage_dice',v)} /></div>
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
                <div className="form-group"><label>Two-Handed Damage Dice</label><DiceInput value={form.two_handed_damage_dice} onChange={v=>set('two_handed_damage_dice',v)} /></div>
                <div className="form-group"><label>Two-Handed Damage Type</label><select value={form.two_handed_damage_type} onChange={e=>set('two_handed_damage_type',e.target.value)}><option value="">(same as above)</option>{DAMAGE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
            )}
            <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={form.proficient} onChange={e=>set('proficient',e.target.checked)} /> Proficient</label>
            <div className="form-row" style={{marginTop:8}}>
              <div className="form-group"><label>Bonus Damage Dice (optional)</label><DiceInput value={form.bonus_damage_dice} onChange={v=>set('bonus_damage_dice',v)} /></div>
              <div className="form-group"><label>Bonus Damage Type</label><select value={form.bonus_damage_type} onChange={e=>set('bonus_damage_type',e.target.value)}><option value="">(same as weapon)</option>{DAMAGE_TYPES.concat(['Acid','Cold','Fire','Force','Lightning','Necrotic','Poison','Psychic','Radiant','Thunder']).map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:8}}>An extra damage component rolled alongside the base damage - e.g. Vicious's +2d6, or a different-typed bonus die like Flame Tongue's fire damage.</div>
            {form.bonus_damage_dice.trim() && (
              <label style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="checkbox" checked={form.bonus_heal_or_advantage} onChange={e=>set('bonus_heal_or_advantage',e.target.checked)} />
                After dealing this bonus damage, offer Heal (equal to the damage) OR Advantage on next roll
              </label>
            )}
          </div>
        )}
        <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><input type="checkbox" checked={form.grants_unarmed_bonus} onChange={e=>set('grants_unarmed_bonus',e.target.checked)} /> Boosts Unarmed Strikes (e.g. magic gauntlets)</label>
        <label style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}} title="While equipped/attuned, lets the wearer concentrate on a second spell at once - on top of their own normal slot if they're a caster at all">
          <input type="checkbox" checked={form.grants_concentration_slot} onChange={e=>set('grants_concentration_slot',e.target.checked)} /> Grants an Extra Concentration Slot (this item concentrates for you)
        </label>
        {form.grants_unarmed_bonus && (
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:8}}>
            <div className="form-row">
              <div className="form-group"><label>Bonus Damage Dice</label><DiceInput value={form.unarmed_bonus_damage_dice} onChange={v=>set('unarmed_bonus_damage_dice',v)} /></div>
              <div className="form-group"><label>Bonus Damage Type</label><select value={form.unarmed_bonus_damage_type} onChange={e=>set('unarmed_bonus_damage_type',e.target.value)}><option value="">(Bludgeoning)</option>{FULL_DAMAGE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:6}}>
              <input type="checkbox" checked={form.unarmed_heal_or_advantage} onChange={e=>set('unarmed_heal_or_advantage',e.target.checked)} />
              After dealing this bonus damage, offer Heal (equal to the damage) OR Advantage on next roll
            </label>
            <div style={{color:'var(--text-dim)',fontSize:11,marginTop:2}}>Adds a bonus damage component to the Unarmed Strike row in Action Economy, only while this item is equipped (and attuned, if required) - same as Vicious's weapon bonus dice, just for fists instead of a weapon.</div>
          </div>
        )}
        <ModifiersEditor
          buffs={form.buffs}
          onChange={(buffs) => set('buffs', buffs)}
          allowWeapon={form.is_weapon}
          activeWhileText="Only applies while the item is Equipped (and Attuned, if attunement is required)."
        />
        <div className="form-group">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={e => { set('description', e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
            ref={el => { if (el && !el.dataset.sized) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; el.dataset.sized = '1'; } }}
            rows={3}
            style={{width:'100%',resize:'vertical',minHeight:60,overflow:'hidden'}}
          />
        </div>

        <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,margin:'12px 0 6px'}}>Granted Spells</div>
        {form.granted_spells.length > 0 && (
          <div style={{display:'flex',gap:6,marginBottom:4,paddingRight:30}}>
            <div style={{flex:1}} />
            <div style={{width:56,textAlign:'center',fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.5}}>Cast Lvl</div>
            <div style={{width:56,textAlign:'center',fontSize:10,color:'var(--text-dim)',textTransform:'uppercase',letterSpacing:0.5}}>Charges</div>
          </div>
        )}
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
              <input type="number" min={s.level_int || 0} value={s.cast_level ?? ''} onChange={e=>updateSpellRow(i,'cast_level',e.target.value)} title="Cast at this slot level (blank = the spell's own level). Affects damage scaling when the player uses the item." placeholder={s.level_int ? `L${s.level_int}` : 'base'} style={{width:56}} />
              <input type="number" min={1} value={s.charge_cost} onChange={e=>updateSpellRow(i,'charge_cost',e.target.value)} title="Charges consumed per cast" style={{width:56}} />
              <button className="btn btn-secondary btn-sm" onClick={()=>removeSpellRow(i)}>×</button>
            </div>
          );
        })}
        <button className="btn btn-secondary btn-sm" onClick={addSpellRow}>+ Add Granted Spell</button>

        <button className="btn btn-secondary" style={{width:'100%',marginTop:12}} disabled={!form.name.trim() || publishing} onClick={publishToLibrary}>
          {publishing ? 'Publishing...' : '📤 Add to Database (share with everyone)'}
        </button>
        {publishMsg && <div style={{color:'var(--success)',fontSize:11,marginTop:6}}>{publishMsg}</div>}
        <div style={{color:'var(--text-dim)',fontSize:11,marginTop:4}}>
          Pushes this item's current data (including any edits above) to the shared library, correcting the canon entry in place if the name matches one. Doesn't change what's saved on this character - use Save below for that.
        </div>

        <div style={{display:'flex',gap:8,marginTop:16}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name} onClick={submit}>{item ? 'Save' : 'Add Item'}</button>
        </div>
      </div>
    </div>
  );
}
