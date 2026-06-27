import React, { useState, useEffect } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import { SECTION_ORDER, ABILITY_KEYS } from '../utils/dnd';

const REST_TYPES = ['long','short','none'];
const SECTION_COST_TYPE = { 'Action':'action', 'Bonus Action':'bonus_action', 'Reaction':'reaction', 'Free Action':'free_action', 'Passive':'passive' };

// editingFeat (optional): when set, this edits an existing shared library entry instead
// of creating a new one - submit only PUTs the library row, it does NOT touch the current
// character's ae_data/features (editing the library shouldn't silently re-attach/change
// this character's own copy, same separation MonsterEditModal.js already uses for monsters).
export default function CustomAbilityModal({ onClose, editingFeat, onDelete }) {
  const { character, updateCharacter } = useCharacter();
  const [form, setForm] = useState(editingFeat ? {
    name: editingFeat.name, section: editingFeat.section, source: editingFeat.source || 'Custom',
    tracker_key: '', max_uses: editingFeat.max_uses || 0, rest_type: editingFeat.rest_type || 'long',
    description: editingFeat.description || '', isSpell: !!editingFeat.isSpell, isTuck: !!editingFeat.isTuck,
    grantsSpell: !!editingFeat.grantsSpell, grantedSpellName: editingFeat.grantedSpellName || '', abilityOverride: editingFeat.abilityOverride || '', saveToLibrary: true,
    edition: editingFeat.edition || 'expanded',
  } : { name:'', section:'Action', source:'Custom', tracker_key:'', max_uses:1, rest_type:'long', description:'', isSpell:false, isTuck:false, grantsSpell:false, grantedSpellName:'', abilityOverride:'', saveToLibrary:true, edition:'expanded' });
  const [saving, setSaving] = useState(false);

  // Search-as-you-type against the real spell library (same pattern as AddItemModal's
  // granted-spell picker) so "grants this known spell" resolves to a real spell object
  // (needed to actually add it to spell_data.known_spells), not just a typed name.
  const [spellOptions, setSpellOptions] = useState([]);
  const [spellSearchOpen, setSpellSearchOpen] = useState(false);
  useEffect(() => { api.get('/content/spells').then(r => setSpellOptions(r.data)).catch(() => {}); }, []);

  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  // Checking one of these three "what kind of ability is this" boxes turns the others
  // off - they're different mechanics (spell-like action, tuck & release, granted known
  // spell) and a feature being more than one at once would be a confusing combination
  // nothing in the rest of the app expects.
  const setExclusiveFlag = (key) => {
    setForm(f => ({ ...f, isSpell: key==='isSpell', isTuck: key==='isTuck', grantsSpell: key==='grantsSpell' }));
  };

  const submit = async () => {
    if (!form.name) return;
    setSaving(true);
    const costType = form.isSpell ? 'cast_spell' : SECTION_COST_TYPE[form.section];
    const payload = {
      name: form.name, section: form.section, cost_type: costType, source: form.source,
      description: form.description, max_uses: parseInt(form.max_uses) || 0,
      rest_type: form.rest_type, isSpell: form.isSpell, isTuck: form.isTuck,
      grantsSpell: form.grantsSpell, grantedSpellName: form.grantedSpellName, abilityOverride: form.abilityOverride,
      edition: form.edition,
    };
    if (editingFeat) {
      await api.put(`/content/feats/${editingFeat._custom_id}`, payload);
      setSaving(false);
      onClose();
      return;
    }
    const key = form.tracker_key || form.name;
    const newAbility = { name:form.name, source:form.source, source_type:'custom', cost_type:costType, tracker_key:key, description:form.description };
    const newAe = { ...character.ae_data };
    if (!newAe[form.section]) newAe[form.section] = [];
    newAe[form.section] = [...newAe[form.section], newAbility];
    const newTd = { ...character.tracker_data };
    if (form.max_uses > 0 || form.isTuck || form.grantsSpell) {
      newTd.features = {
        ...newTd.features,
        [key]: {
          current: parseInt(form.max_uses) || 0, max: parseInt(form.max_uses) || 0,
          rest_type: form.rest_type, action: form.section, description: form.description,
          ...(form.isTuck ? { spell_picker: true, tucked_spell: '', tucked_level: '' } : {}),
          ...(form.grantsSpell ? { granted_spell: form.grantedSpellName, ability_override: form.abilityOverride || null } : {}),
        },
      };
    }
    let newSd = null;
    if (form.grantsSpell && form.grantedSpellName) {
      const master = spellOptions.find(s => s.name.toLowerCase() === form.grantedSpellName.toLowerCase());
      const sd = character.spell_data || {};
      const known = sd.known_spells || [];
      if (master && !known.some(s => s.name.toLowerCase() === master.name.toLowerCase())) {
        newSd = {
          ...sd,
          known_spells: [...known, { ...master, granted_by: form.name, ability_override: form.abilityOverride || null, free_use_feature: key }],
        };
      }
    }
    if (form.saveToLibrary) {
      try {
        await api.post('/content/feats', payload);
      } catch {
        // Non-fatal - the character still gets the ability even if the library save failed.
      }
    }
    await updateCharacter(character.id, { ae_data: newAe, tracker_data: newTd, ...(newSd ? { spell_data: newSd } : {}) });
    setSaving(false);
    onClose();
  };

  const spellQuery = form.grantedSpellName.trim().toLowerCase();
  const spellMatches = spellSearchOpen && spellQuery
    ? spellOptions.filter(sp => sp.name.toLowerCase().includes(spellQuery)).slice(0, 8)
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{editingFeat ? 'Edit Custom Feat' : 'Add Custom Ability'}</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:12}}>
          {editingFeat ? 'Updates the shared library entry - anyone searching for this feat will see your changes. Characters who already added it keep their own copy as-is.' : 'Saved to your feat library too — searchable to add to any future character.'}
        </div>
        <div className="form-group"><label>Name</label><input value={form.name} onChange={e => set('name',e.target.value)} placeholder="Ability name" autoFocus /></div>
        <div className="form-row">
          <div className="form-group"><label>Section</label><select value={form.section} onChange={e => set('section',e.target.value)}>{SECTION_ORDER.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label>Source</label><input value={form.source} onChange={e => set('source',e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Uses (0=unlimited)</label><input type="number" min={0} value={form.max_uses} onChange={e => set('max_uses',e.target.value)} /></div>
          <div className="form-group"><label>Resets on</label><select value={form.rest_type} onChange={e => set('rest_type',e.target.value)}>{REST_TYPES.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
        </div>
        <div className="form-group">
          <label>Edition</label>
          <select value={form.edition} onChange={e => set('edition', e.target.value)}>
            <option value="2014">5e (2014 / PHB)</option>
            <option value="2024">5e (2024 revision)</option>
            <option value="expanded">Expanded / Homebrew</option>
          </select>
        </div>
        <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => set('description',e.target.value)} rows={3} style={{width:'100%',resize:'vertical'}} /></div>

        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,cursor:'pointer'}}>
          <input type="checkbox" checked={form.isSpell} onChange={() => setExclusiveFlag('isSpell')} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>This is a spell-like ability (shows as a "Cast" button, filtered to spells castable in this section)</span>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
          <input type="checkbox" checked={form.isTuck} onChange={() => setExclusiveFlag('isTuck')} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>🃏 Tuck &amp; release a spell (pick a known spell now, cast it later without a slot — e.g. Cartomancer)</span>
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
          <input type="checkbox" checked={form.grantsSpell} onChange={() => setExclusiveFlag('grantsSpell')} />
          <span style={{fontSize:13,color:'var(--text-secondary)'}}>🐉 Grants a known spell with a free use (e.g. Draconic Healing) — the spell becomes permanently known, with "Uses" above free casts that don't need a slot. It's also castable normally with a real slot.</span>
        </label>
        {form.grantsSpell && (
          <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:10,marginBottom:10}}>
            <div className="form-group" style={{position:'relative'}}>
              <label>Granted Spell</label>
              <input
                value={form.grantedSpellName}
                onChange={e => { set('grantedSpellName', e.target.value); setSpellSearchOpen(true); }}
                onFocus={() => setSpellSearchOpen(true)}
                onBlur={() => setTimeout(() => setSpellSearchOpen(false), 150)}
                placeholder="Search spell name..."
              />
              {spellMatches.length > 0 && (
                <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:20,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',maxHeight:160,overflowY:'auto',boxShadow:'var(--shadow)'}}>
                  {spellMatches.map(sp => (
                    <div key={sp.name} onMouseDown={() => { set('grantedSpellName', sp.name); setSpellSearchOpen(false); }} style={{padding:'6px 10px',cursor:'pointer',fontSize:12,color:'var(--text-primary)',borderBottom:'1px solid var(--border)'}}>
                      {sp.name} <span style={{color:'var(--text-dim)'}}>({sp.level_int===0?'Cantrip':`L${sp.level_int}`})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Spellcasting Ability (this spell only)</label>
              <select value={form.abilityOverride} onChange={e => set('abilityOverride', e.target.value)}>
                <option value="">Use class default</option>
                {ABILITY_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div style={{color:'var(--text-dim)',fontSize:11}}>
              "Uses" above is how many free casts (e.g. once per long rest) this grants without a slot. The spell can also always be cast normally with a real spell slot if the character has one.
            </div>
          </div>
        )}

        {!editingFeat && (
          <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
            <input type="checkbox" checked={form.saveToLibrary} onChange={e => set('saveToLibrary', e.target.checked)} />
            <span style={{fontSize:13,color:'var(--text-secondary)'}}>Save to shared feat library (searchable by anyone) — uncheck to keep this for your character only</span>
          </label>
        )}

        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          {editingFeat && onDelete && (
            <button className="btn btn-secondary" style={{flex:1,color:'var(--danger)'}} onClick={onDelete}>Delete</button>
          )}
          <button className="btn btn-primary" style={{flex:2}} disabled={!form.name||saving} onClick={submit}>{saving?'Saving...':editingFeat?'Save Changes':'Add Ability'}</button>
        </div>
      </div>
    </div>
  );
}
