import React, { useState } from 'react';
import { ABILITY_KEYS, ABILITY_LABELS, guessRawAbilityScores } from '../utils/dnd';

// Shown once, right after a PDF import, since the D&D Beyond export only ever has the
// character's final ability scores baked in - there's no raw/pre-modifier number
// anywhere in the export to parse. Pre-fills a best-effort guess (see
// guessRawAbilityScores in dnd.js) rather than a blank form, since most players won't
// have their true pre-modifier numbers memorized for an already-leveled character; the
// player confirms or corrects each one before it's saved as the character's raw
// ability_scores, which is what every item/race buff layers on top of live afterward.
export default function ImportAbilityConfirmModal({ character, onConfirm }) {
  const guesses = guessRawAbilityScores(character.ability_scores, character.race, character.tracker_data?.inventory?.items);
  const [scores, setScores] = useState(guesses);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onConfirm(Object.fromEntries(ABILITY_KEYS.map(k => [k, parseInt(scores[k]) || 10])));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => {}}>
      <div className="modal" style={{maxWidth:440}} onClick={e => e.stopPropagation()}>
        <h2>Confirm Base Ability Scores</h2>
        <p style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.6,marginBottom:10}}>
          The PDF only has {character.name}'s final scores, so we've guessed the raw,
          pre-modifier numbers below (subtracting the racial and item bonuses we can
          detect). Double-check or correct each one before confirming.
        </p>
        <div style={{color:'var(--warning)',fontSize:12,lineHeight:1.6,marginBottom:14,padding:'8px 10px',background:'rgba(245,158,11,0.1)',borderRadius:'var(--radius-sm)'}}>
          ⚠ Confirming applies {character.race || 'this character\'s race'}'s racial bonus and every
          currently equipped/attuned item's stat bonus on top of the numbers below. Enter
          the raw score with <strong>no</strong> bonuses already included — otherwise they'll be
          double-counted.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
          {ABILITY_KEYS.map(k => (
            <div className="form-group" key={k}>
              <label>{ABILITY_LABELS[k]}</label>
              <input type="number" min={1} max={30} value={scores[k]}
                onChange={e => setScores(s => ({ ...s, [k]: e.target.value }))} />
            </div>
          ))}
        </div>
        <button className="btn btn-primary" style={{width:'100%'}} disabled={saving} onClick={submit}>
          {saving ? 'Saving...' : 'Confirm Base Scores'}
        </button>
      </div>
    </div>
  );
}
