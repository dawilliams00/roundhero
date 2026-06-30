import React from 'react';
import { modStr } from '../utils/dnd';

const ABILITY_LABELS = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };

function StatLine({ label, value }) {
  if (!value) return null;
  return <div style={{marginBottom:6}}><b style={{color:'var(--text-primary)'}}>{label}.</b> <span style={{color:'var(--text-secondary)'}}>{value}</span></div>;
}

function AbilityRow({ scores, saves }) {
  return (
    <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
      {Object.entries(ABILITY_LABELS).map(([key, abbr]) => {
        const score = scores?.[key] ?? 10;
        const save = saves?.[key];
        return (
          <div key={key} className="stat-box" style={{minWidth:54}}>
            <div className="stat-label" style={{marginTop:0,marginBottom:2}}>{abbr}</div>
            <div className="stat-value" style={{fontSize:14}}>{score} ({modStr(score)})</div>
            {save != null && <div className="stat-sub" style={{fontSize:10}}>save {save>=0?'+':''}{save}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ActionBlock({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{marginBottom:14}}>
      <div style={{color:'var(--accent-light)',fontFamily:"'Cinzel',serif",fontSize:14,marginBottom:6,borderBottom:'1px solid var(--border)',paddingBottom:4}}>{title}</div>
      {items.map((it, i) => (
        <div key={i} style={{marginBottom:8}}>
          <span style={{color:'var(--text-primary)',fontWeight:600,fontStyle:'italic'}}>{it.name}. </span>
          <span style={{color:'var(--text-secondary)',lineHeight:1.6}}>{it.desc}</span>
        </div>
      ))}
    </div>
  );
}

export function MonsterStatBlockContent({ monster: m }) {
  if (!m) return null;
  const speed = Object.entries(m.speed || {}).map(([k, v]) => k === 'walk' ? `${v} ft.` : `${k} ${v} ft.`).join(', ');
  const skills = Object.entries(m.skills || {}).map(([k, v]) => `${k} ${v>=0?'+':''}${v}`).join(', ');

  return (
    <>
      {m.description && <p style={{color:'var(--text-secondary)',lineHeight:1.7,whiteSpace:'pre-wrap',marginBottom:14}}>{m.description}</p>}

      <StatLine label="Armor Class" value={`${m.armor_class}${m.armor_desc ? ` (${m.armor_desc})` : ''}`} />
      <StatLine label="Hit Points" value={`${m.hit_points}${m.hit_dice ? ` (${m.hit_dice})` : ''}`} />
      <StatLine label="Speed" value={speed} />

      <AbilityRow scores={m.ability_scores} saves={m.saves} />

      <StatLine label="Skills" value={skills} />
      <StatLine label="Damage Vulnerabilities" value={m.damage_vulnerabilities} />
      <StatLine label="Damage Resistances" value={m.damage_resistances} />
      <StatLine label="Damage Immunities" value={m.damage_immunities} />
      <StatLine label="Condition Immunities" value={m.condition_immunities} />
      <StatLine label="Senses" value={m.senses} />
      <StatLine label="Languages" value={m.languages} />

      <div style={{marginTop:14}}>
        <ActionBlock title="Actions" items={m.actions} />
        <ActionBlock title="Bonus Actions" items={m.bonus_actions} />
        <ActionBlock title="Reactions" items={m.reactions} />
        {m.legendary_actions?.length > 0 && (
          <>
            {m.legendary_desc && <p style={{color:'var(--text-secondary)',lineHeight:1.6,marginBottom:8,fontSize:13}}>{m.legendary_desc}</p>}
            <ActionBlock title="Legendary Actions" items={m.legendary_actions} />
          </>
        )}
        <ActionBlock title="Special Abilities" items={m.special_abilities} />
      </div>

      {m.environments?.length > 0 && (
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:8}}>
          {m.environments.map(e => (
            <span key={e} style={{border:'1px solid var(--border-light)',color:'var(--text-dim)',borderRadius:10,padding:'1px 8px',fontSize:11}}>{e}</span>
          ))}
        </div>
      )}
    </>
  );
}

export default function MonsterDetailModal({ monster: m, onClose, onSummon, onDuplicate, onEdit }) {
  if (!m) return null;
  const isCustom = m._source === 'custom';

  return (
    <div className="modal-overlay" onClick={onClose} style={{zIndex:2800}}>

      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-header">
          <h2>{m.name}</h2>
          <div style={{color:'var(--text-dim)',fontSize:12,fontStyle:'italic'}}>
            {m.size} {m.type}{m.subtype ? ` (${m.subtype})` : ''}, {m.alignment}
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:6}}>
            <span style={{color:'var(--accent-light)',fontSize:12,fontWeight:600}}>CR {m.challenge_rating}</span>
            {m.source && <span style={{color:'var(--text-dim)',fontSize:12}}>{m.source}</span>}
            {isCustom && <span style={{color:'var(--accent-light)',fontSize:12,border:'1px solid var(--accent-light)',borderRadius:8,padding:'0 6px'}}>Homebrew</span>}
          </div>
        </div>
        <div className="modal-body">
          <MonsterStatBlockContent monster={m} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {!isCustom && onDuplicate && <button className="btn btn-secondary" onClick={() => onDuplicate(m)}>📋 Duplicate</button>}
          {isCustom && onEdit && <button className="btn btn-secondary" onClick={() => onEdit(m)}>✏️ Edit</button>}
          {onSummon && <button className="btn btn-primary" onClick={() => onSummon(m)}>🐉 Summon</button>}
        </div>
      </div>
    </div>
  );
}
