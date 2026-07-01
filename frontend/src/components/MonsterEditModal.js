import React, { useState } from 'react';
import ConfirmModal from './ConfirmModal';
import InfoModal from './InfoModal';

const ABILITIES = [
  ['strength', 'STR'],
  ['dexterity', 'DEX'],
  ['constitution', 'CON'],
  ['intelligence', 'INT'],
  ['wisdom', 'WIS'],
  ['charisma', 'CHA'],
];
const SPEEDS = ['walk', 'burrow', 'climb', 'fly', 'swim'];
const ACTION_GROUPS = [
  ['special_abilities', 'Special Abilities'],
  ['actions', 'Actions'],
  ['bonus_actions', 'Bonus Actions'],
  ['reactions', 'Reactions'],
  ['legendary_actions', 'Legendary Actions'],
];

const toNumberOrBlank = value => value === '' || value == null ? '' : Number(value);
const asText = value => value == null ? '' : String(value);
const csvToList = text => String(text || '').split(',').map(part => part.trim()).filter(Boolean);

function mapToText(map) {
  return Object.entries(map || {})
    .map(([key, value]) => `${key} ${Number(value) >= 0 ? '+' : ''}${value}`)
    .join(', ');
}

function textToMap(text) {
  const result = {};
  String(text || '').split(',').map(part => part.trim()).filter(Boolean).forEach(part => {
    const match = part.match(/^(.+?)\s*([+-]?\d+)$/);
    if (!match) return;
    result[match[1].trim().toLowerCase()] = Number(match[2]);
  });
  return result;
}

function cleanActionList(items) {
  return (items || [])
    .map(item => ({
      name: item.name?.trim() || '',
      desc: item.desc?.trim() || '',
      ...(item.attack_bonus !== '' && item.attack_bonus != null ? { attack_bonus: Number(item.attack_bonus) } : {}),
      ...(item.damage_dice ? { damage_dice: item.damage_dice.trim() } : {}),
      ...(item.damage_bonus !== '' && item.damage_bonus != null ? { damage_bonus: Number(item.damage_bonus) } : {}),
    }))
    .filter(item => item.name || item.desc);
}

function ActionEditor({ title, items, onChange }) {
  const update = (index, patch) => onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const remove = index => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...(items || []), { name: '', desc: '', attack_bonus: '', damage_dice: '', damage_bonus: '' }]);

  return (
    <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',marginBottom:8}}>
        <h3 style={{color:'var(--accent-light)',fontSize:13,margin:0}}>{title}</h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>Add</button>
      </div>
      {(items || []).length === 0 ? (
        <div style={{color:'var(--text-dim)',fontSize:12}}>No entries.</div>
      ) : items.map((item, index) => (
        <div key={index} style={{display:'grid',gap:6,borderTop:index ? '1px solid var(--border)' : 0,paddingTop:index ? 8 : 0,marginTop:index ? 8 : 0}}>
          <div style={{display:'grid',gridTemplateColumns:'minmax(160px,1fr) 72px 90px 72px auto',gap:6,alignItems:'end'}}>
            <label style={{display:'grid',gap:3}}>
              <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Name</span>
              <input value={item.name || ''} onChange={e => update(index, { name: e.target.value })} />
            </label>
            <label style={{display:'grid',gap:3}}>
              <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Attack</span>
              <input type="number" value={item.attack_bonus ?? ''} onChange={e => update(index, { attack_bonus: e.target.value })} />
            </label>
            <label style={{display:'grid',gap:3}}>
              <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Dice</span>
              <input value={item.damage_dice || ''} onChange={e => update(index, { damage_dice: e.target.value })} placeholder="2d6" />
            </label>
            <label style={{display:'grid',gap:3}}>
              <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Bonus</span>
              <input type="number" value={item.damage_bonus ?? ''} onChange={e => update(index, { damage_bonus: e.target.value })} />
            </label>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(index)}>Remove</button>
          </div>
          <label style={{display:'grid',gap:3}}>
            <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Description</span>
            <textarea value={item.desc || ''} onChange={e => update(index, { desc: e.target.value })} rows={3} style={{width:'100%',resize:'vertical'}} />
          </label>
        </div>
      ))}
    </section>
  );
}

export default function MonsterEditModal({ monster, onSave, onDelete, onClose }) {
  const { _custom_id, _source, name, ...rest } = monster;
  const [form, setForm] = useState({
    ...rest,
    name,
    description: rest.description || '',
    size: rest.size || 'Medium',
    type: rest.type || '',
    subtype: rest.subtype || '',
    group: rest.group || '',
    alignment: rest.alignment || '',
    armor_class: rest.armor_class ?? '',
    armor_desc: rest.armor_desc || '',
    hit_points: rest.hit_points ?? '',
    hit_dice: rest.hit_dice || '',
    challenge_rating: rest.challenge_rating || '',
    cr: rest.cr ?? '',
    source: rest.source || 'Homebrew',
    speed: { walk: '', burrow: '', climb: '', fly: '', swim: '', ...(rest.speed || {}) },
    ability_scores: {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
      ...(rest.ability_scores || {}),
    },
    saves: { ...(rest.saves || {}) },
    skills_text: mapToText(rest.skills || {}),
    damage_vulnerabilities: rest.damage_vulnerabilities || '',
    damage_resistances: rest.damage_resistances || '',
    damage_immunities: rest.damage_immunities || '',
    condition_immunities: rest.condition_immunities || '',
    senses: rest.senses || '',
    languages: rest.languages || '',
    legendary_desc: rest.legendary_desc || '',
    environments_text: Array.isArray(rest.environments) ? rest.environments.join(', ') : '',
    special_abilities: rest.special_abilities || [],
    actions: rest.actions || [],
    bonus_actions: rest.bonus_actions || [],
    reactions: rest.reactions || [],
    legendary_actions: rest.legendary_actions || [],
  });
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const setSpeed = (field, value) => setForm(prev => ({ ...prev, speed: { ...(prev.speed || {}), [field]: value } }));
  const setAbility = (field, value) => setForm(prev => ({ ...prev, ability_scores: { ...(prev.ability_scores || {}), [field]: value } }));
  const setSave = (field, value) => setForm(prev => ({ ...prev, saves: { ...(prev.saves || {}), [field]: value } }));

  const submit = () => {
    if (!form.name.trim()) return;
    const speed = {};
    SPEEDS.forEach(key => {
      const value = toNumberOrBlank(form.speed?.[key]);
      if (value !== '' && Number.isFinite(value)) speed[key] = value;
    });
    const saves = {};
    ABILITIES.forEach(([key]) => {
      const value = toNumberOrBlank(form.saves?.[key]);
      if (value !== '' && Number.isFinite(value)) saves[key] = value;
    });
    const crNumber = Number(form.cr);
    const payload = {
      ...rest,
      name: form.name.trim(),
      description: form.description,
      size: form.size,
      type: form.type,
      subtype: form.subtype,
      group: form.group || null,
      alignment: form.alignment,
      armor_class: Number(form.armor_class) || 0,
      armor_desc: form.armor_desc,
      hit_points: Number(form.hit_points) || 0,
      hit_dice: form.hit_dice,
      speed,
      ability_scores: Object.fromEntries(ABILITIES.map(([key]) => [key, Number(form.ability_scores?.[key]) || 10])),
      saves,
      skills: textToMap(form.skills_text),
      damage_vulnerabilities: form.damage_vulnerabilities,
      damage_resistances: form.damage_resistances,
      damage_immunities: form.damage_immunities,
      condition_immunities: form.condition_immunities,
      senses: form.senses,
      languages: form.languages,
      challenge_rating: form.challenge_rating,
      cr: Number.isFinite(crNumber) ? crNumber : rest.cr,
      source: form.source || 'Homebrew',
      legendary_desc: form.legendary_desc,
      environments: csvToList(form.environments_text),
      special_abilities: cleanActionList(form.special_abilities),
      actions: cleanActionList(form.actions),
      bonus_actions: cleanActionList(form.bonus_actions),
      reactions: cleanActionList(form.reactions),
      legendary_actions: cleanActionList(form.legendary_actions),
    };
    onSave(payload);
  };

  return (
    <div className="modal-overlay">
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-header">
          <h2>Edit Homebrew Creature</h2>
          <div style={{color:'var(--text-dim)',fontSize:11}}>Changes save to the shared custom creature database used by Bestiary and encounters.</div>
        </div>
        <div className="modal-body">
          <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)',marginBottom:10}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
              {[
                ['name', 'Name'],
                ['size', 'Size'],
                ['type', 'Type'],
                ['subtype', 'Subtype'],
                ['group', 'Group'],
                ['alignment', 'Alignment'],
                ['source', 'Source'],
              ].map(([field, label]) => (
                <label key={field} style={{display:'grid',gap:3}}>
                  <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>{label}</span>
                  <input value={asText(form[field])} onChange={e => set(field, e.target.value)} />
                </label>
              ))}
              <label style={{display:'grid',gap:3}}>
                <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>CR</span>
                <input value={form.challenge_rating || ''} onChange={e => set('challenge_rating', e.target.value)} />
              </label>
              <label style={{display:'grid',gap:3}}>
                <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>CR Number</span>
                <input type="number" step="0.01" value={form.cr ?? ''} onChange={e => set('cr', e.target.value)} />
              </label>
            </div>
            <label style={{display:'grid',gap:3,marginTop:8}}>
              <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Description</span>
              <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} style={{width:'100%',resize:'vertical'}} />
            </label>
          </section>

          <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)',marginBottom:10}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(92px,1fr))',gap:8}}>
              <label style={{display:'grid',gap:3}}>
                <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>AC</span>
                <input type="number" value={form.armor_class ?? ''} onChange={e => set('armor_class', e.target.value)} />
              </label>
              <label style={{display:'grid',gap:3}}>
                <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Armor</span>
                <input value={form.armor_desc || ''} onChange={e => set('armor_desc', e.target.value)} placeholder="natural armor" />
              </label>
              <label style={{display:'grid',gap:3}}>
                <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>HP</span>
                <input type="number" value={form.hit_points ?? ''} onChange={e => set('hit_points', e.target.value)} />
              </label>
              <label style={{display:'grid',gap:3}}>
                <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Hit Dice</span>
                <input value={form.hit_dice || ''} onChange={e => set('hit_dice', e.target.value)} placeholder="18d10+36" />
              </label>
            </div>
          </section>

          <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10,marginBottom:10}}>
            <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)'}}>
              <h3 style={{color:'var(--accent-light)',fontSize:13,margin:'0 0 8px'}}>Speeds</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(74px,1fr))',gap:6}}>
                {SPEEDS.map(key => (
                  <label key={key} style={{display:'grid',gap:3}}>
                    <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>{key}</span>
                    <input type="number" value={form.speed?.[key] ?? ''} onChange={e => setSpeed(key, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
            <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)'}}>
              <h3 style={{color:'var(--accent-light)',fontSize:13,margin:'0 0 8px'}}>Ability Scores</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,minmax(48px,1fr))',gap:6}}>
                {ABILITIES.map(([key, label]) => (
                  <label key={key} style={{display:'grid',gap:3}}>
                    <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>{label}</span>
                    <input type="number" value={form.ability_scores?.[key] ?? 10} onChange={e => setAbility(key, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)',marginBottom:10}}>
            <h3 style={{color:'var(--accent-light)',fontSize:13,margin:'0 0 8px'}}>Saves / Skills</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {ABILITIES.map(([key, label]) => (
                  <label key={key} style={{display:'grid',gap:3}}>
                    <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>{label} Save</span>
                    <input type="number" value={form.saves?.[key] ?? ''} onChange={e => setSave(key, e.target.value)} placeholder="blank" />
                  </label>
                ))}
              </div>
              <label style={{display:'grid',gap:3}}>
                <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Skills</span>
                <input value={form.skills_text || ''} onChange={e => set('skills_text', e.target.value)} placeholder="perception +10, stealth +5" />
              </label>
            </div>
          </section>

          <section style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,background:'var(--bg-secondary)',marginBottom:10}}>
            <h3 style={{color:'var(--accent-light)',fontSize:13,margin:'0 0 8px'}}>Defenses / Senses</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8}}>
              {[
                ['damage_vulnerabilities', 'Vulnerabilities'],
                ['damage_resistances', 'Resistances'],
                ['damage_immunities', 'Damage Immunities'],
                ['condition_immunities', 'Condition Immunities'],
                ['senses', 'Senses'],
                ['languages', 'Languages'],
                ['environments_text', 'Environments'],
              ].map(([field, label]) => (
                <label key={field} style={{display:'grid',gap:3}}>
                  <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>{label}</span>
                  <input value={form[field] || ''} onChange={e => set(field, e.target.value)} />
                </label>
              ))}
            </div>
          </section>

          <label style={{display:'grid',gap:3,marginBottom:10}}>
            <span style={{color:'var(--text-secondary)',fontSize:10,fontWeight:800,textTransform:'uppercase'}}>Legendary Action Note</span>
            <textarea value={form.legendary_desc || ''} onChange={e => set('legendary_desc', e.target.value)} rows={2} style={{width:'100%',resize:'vertical'}} />
          </label>

          <div style={{display:'grid',gap:10}}>
            {ACTION_GROUPS.map(([field, title]) => (
              <ActionEditor key={field} title={title} items={form[field] || []} onChange={items => set(field, items)} />
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save</button>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmModal
          title="Delete Homebrew Creature?"
          message={`Permanently delete "${name}"? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => { onDelete(); setConfirmDelete(false); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {error && <InfoModal title="Couldn't Save" message={error} onClose={() => setError(null)} />}
    </div>
  );
}
