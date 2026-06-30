import React, { useState } from 'react';
import InfoModal from './InfoModal';
import DiceInput from './DiceInput';

const SCHOOLS = ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];
const DAMAGE_TYPES = ['Acid','Bludgeoning','Cold','Fire','Force','Lightning','Necrotic','Piercing','Poison','Psychic','Radiant','Slashing','Thunder'];
const SAVE_TYPES = ['STR','DEX','CON','INT','WIS','CHA'];

// Structured spell editor replacing the old raw JSON textarea. All commonly-needed fields
// have dedicated inputs; an "Advanced JSON" toggle is still available for anything not
// covered (custom fields, edge-case flags, etc.) without requiring a raw-JSON-only workflow.
export default function SpellEditModal({ spell, mode, onSave, onDelete, onClose }) {
  const { _custom_id, _source, _override_id, name: origName, ...rest } = spell;
  const [editName, setEditName] = useState(mode === 'duplicate' ? `${origName} (Homebrew)` : origName);
  const [fields, setFields] = useState({
    level_int:     rest.level_int ?? 0,
    school:        rest.school || 'Evocation',
    casting_time:  rest.casting_time || '1 action',
    range:         rest.range || 'Self',
    components:    rest.components || 'V, S',
    duration:      rest.duration || 'Instantaneous',
    concentration: !!rest.concentration,
    ritual:        !!rest.ritual,
    is_attack:     !!rest.is_attack,
    requires_weapon_attack: !!rest.requires_weapon_attack,
    attack_type:   rest.attack_type || '',
    save_type_abbr:rest.save_type_abbr || '',
    damage_dice:   rest.damage_dice || '',
    damage_type:   rest.damage_type || '',
    secondary_damage_dice: rest.secondary_damage_dice || '',
    secondary_damage_type: rest.secondary_damage_type || '',
    higher_level:  rest.higher_level || '',
    classes:       Array.isArray(rest.classes) ? rest.classes.join(', ') : (rest.classes || ''),
    description:   rest.description || '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Keep advanced JSON in sync with the structured fields so switching back and forth works
  const structuredToObj = () => ({
    ...rest,
    level_int: parseInt(fields.level_int) || 0,
    level: fields.level_int === 0 ? 'cantrip' : String(parseInt(fields.level_int) || 1),
    school: fields.school,
    casting_time: fields.casting_time,
    range: fields.range,
    components: fields.components,
    duration: fields.duration,
    concentration: fields.concentration,
    ritual: fields.ritual,
    is_attack: fields.is_attack || undefined,
    requires_weapon_attack: fields.requires_weapon_attack || undefined,
    attack_type: fields.attack_type || undefined,
    save_type_abbr: fields.save_type_abbr || undefined,
    damage_dice: fields.damage_dice || undefined,
    damage_type: fields.damage_type || undefined,
    secondary_damage_dice: fields.secondary_damage_dice || undefined,
    secondary_damage_type: fields.secondary_damage_type || undefined,
    higher_level: fields.higher_level || undefined,
    classes: fields.classes ? fields.classes.split(',').map(s => s.trim()).filter(Boolean) : rest.classes,
    description: fields.description,
  });
  const [json, setJson] = useState(() => JSON.stringify(structuredToObj(), null, 2));
  const [error, setError] = useState(null);

  const set = (k, v) => setFields(f => ({ ...f, [k]: v }));

  const submit = () => {
    if (!editName.trim()) return;
    try {
      const payload = showAdvanced ? JSON.parse(json) : structuredToObj();
      onSave({ ...payload, name: editName.trim() });
    } catch (e) {
      setError(`Invalid JSON in advanced editor: ${e.message}`);
    }
  };

  const title = mode === 'duplicate' ? 'Duplicate Spell' : mode === 'canonEdit' ? 'Admin Edit Canon Spell' : 'Edit Homebrew Spell';
  const Row = ({ label, children }) => (
    <div style={{display:'grid',gridTemplateColumns:'130px 1fr',alignItems:'center',gap:8,marginBottom:8}}>
      <label style={{fontSize:12,color:'var(--text-secondary)',textAlign:'right'}}>{label}</label>
      {children}
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-header">
          <h2>{title}</h2>
          {mode === 'canonEdit' && <div style={{color:'var(--text-dim)',fontSize:11}}>Corrects this entry for everyone — existing characters pick it up via ↺ Refresh on the Spells tab.</div>}
          {mode === 'duplicate' && <div style={{color:'var(--text-dim)',fontSize:11}}>Copies {origName}'s data under a new name. The original stays as canon.</div>}
        </div>
        <div className="modal-body">
          <Row label="Name">
            <input value={editName} onChange={e => setEditName(e.target.value)} />
          </Row>
          {!showAdvanced && (<>
            <Row label="Level">
              <select value={fields.level_int} onChange={e => set('level_int', parseInt(e.target.value))}>
                <option value={0}>Cantrip</option>
                {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Row>
            <Row label="School">
              <select value={fields.school} onChange={e => set('school', e.target.value)}>
                {SCHOOLS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Row>
            <Row label="Casting Time">
              <input value={fields.casting_time} onChange={e => set('casting_time', e.target.value)} placeholder="1 action" />
            </Row>
            <Row label="Range">
              <input value={fields.range} onChange={e => set('range', e.target.value)} placeholder="Self, 60 feet, etc." />
            </Row>
            <Row label="Components">
              <input value={fields.components} onChange={e => set('components', e.target.value)} placeholder="V, S, M (a pinch of ash)" />
            </Row>
            <Row label="Duration">
              <input value={fields.duration} onChange={e => set('duration', e.target.value)} placeholder="Instantaneous" />
            </Row>
            <Row label="Flags">
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                {[['concentration','Concentration'],['ritual','Ritual'],['is_attack','Is an Attack'],['requires_weapon_attack','Weapon-Attack Cantrip']].map(([k,label]) => (
                  <label key={k} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',fontSize:12}}>
                    <input type="checkbox" checked={!!fields[k]} onChange={e => set(k, e.target.checked)} /> {label}
                  </label>
                ))}
              </div>
            </Row>
            <Row label="Attack Type">
              <input value={fields.attack_type} onChange={e => set('attack_type', e.target.value)} placeholder="Melee / Ranged (if is_attack)" />
            </Row>
            <Row label="Save (abbr)">
              <select value={fields.save_type_abbr} onChange={e => set('save_type_abbr', e.target.value)}>
                <option value="">None</option>
                {SAVE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Row>
            <Row label="Damage Dice">
              <DiceInput value={fields.damage_dice} onChange={v => set('damage_dice', v)} />
            </Row>
            <Row label="Damage Type">
              <select value={fields.damage_type} onChange={e => set('damage_type', e.target.value)}>
                <option value="">None</option>
                {DAMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Row>
            <Row label="2nd Damage Dice">
              <DiceInput value={fields.secondary_damage_dice} onChange={v => set('secondary_damage_dice', v)} />
            </Row>
            <Row label="2nd Damage Type">
              <select value={fields.secondary_damage_type} onChange={e => set('secondary_damage_type', e.target.value)}>
                <option value="">None</option>
                {DAMAGE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Row>
            <Row label="At Higher Levels">
              <input value={fields.higher_level} onChange={e => set('higher_level', e.target.value)} placeholder="Increases by 1d6 for each slot level above 1st" />
            </Row>
            <Row label="Classes">
              <input value={fields.classes} onChange={e => set('classes', e.target.value)} placeholder="Wizard, Sorcerer, ..." />
            </Row>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:12,color:'var(--text-secondary)'}}>Description</label>
              <textarea value={fields.description} onChange={e => set('description', e.target.value)} rows={6} style={{width:'100%',marginTop:4,resize:'vertical'}} />
            </div>
          </>)}
          {showAdvanced && (<>
            <div className="form-group">
              <label>Advanced JSON (all fields)</label>
              <textarea value={json} onChange={e => setJson(e.target.value)} rows={16} style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:11}} />
            </div>
          </>)}
          <button className="btn btn-secondary btn-sm" onClick={() => {
            if (!showAdvanced) setJson(JSON.stringify(structuredToObj(), null, 2));
            setShowAdvanced(v => !v);
          }}>{showAdvanced ? 'Switch to Form View' : 'Advanced JSON Editor'}</button>
        </div>
        <div className="modal-footer">
          {mode === 'customEdit' && onDelete && <button className="btn btn-danger" onClick={onDelete}>Delete</button>}
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>{mode === 'duplicate' ? 'Duplicate' : 'Save'}</button>
        </div>
      </div>
      {error && <InfoModal title="Couldn't Save" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
