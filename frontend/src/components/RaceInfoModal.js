import React from 'react';

// Read-only display of backend/data/races.json's richer SRD race writeup (alignment, age,
// size, speed, languages, traits, subrace flavor) - this data was already in the repo
// (engine/race_data.py, served at GET /content/srd-races) but nothing in the frontend ever
// read it. It's NOT mechanically applied anywhere (traits here are just names/flavor text,
// not structured effects the way item/feat buffs are) - this is reference material for the
// player, same "track what's computable, the player applies the rest" philosophy used for
// conditions/exhaustion/Fighting Styles riders elsewhere in this app. Only covers the 9 SRD
// core races + 4 subraces actually present in races.json - most of the app's 29-entry race
// dropdown (Aasimar, Firbolg, Tabaxi, etc.) has no matching SRD writeup and won't show this.
export default function RaceInfoModal({ baseRace, subrace, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <button type="button" className="modal-close-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-header">
          <h2>{subrace ? subrace.name : baseRace.name}</h2>
          <div style={{color:'var(--text-dim)',fontSize:12}}>{baseRace.size} · Speed {baseRace.speed} ft. · SRD</div>
        </div>
        <div className="modal-body">
          {subrace?.desc && (
            <p style={{color:'var(--text-secondary)',lineHeight:1.7,fontSize:13,marginBottom:12}}>{subrace.desc}</p>
          )}
          {subrace?.racial_traits?.length > 0 && (
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Subrace Traits</div>
              <div style={{color:'var(--text-secondary)',fontSize:13}}>{subrace.racial_traits.join(', ')}</div>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Base Race Traits</div>
            <div style={{color:'var(--text-secondary)',fontSize:13}}>{(baseRace.traits || []).join(', ') || '—'}</div>
          </div>
          {baseRace.languages?.length > 0 && (
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Languages</div>
              <div style={{color:'var(--text-secondary)',fontSize:13}}>{baseRace.languages.join(', ')}</div>
              {baseRace.language_desc && <div style={{color:'var(--text-dim)',fontSize:12,marginTop:4,lineHeight:1.6}}>{baseRace.language_desc}</div>}
            </div>
          )}
          {baseRace.size_description && (
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Size</div>
              <div style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.6}}>{baseRace.size_description}</div>
            </div>
          )}
          {baseRace.age && (
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Age</div>
              <div style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.6}}>{baseRace.age}</div>
            </div>
          )}
          {baseRace.alignment && (
            <div style={{marginBottom:12}}>
              <div style={{color:'var(--text-dim)',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Alignment</div>
              <div style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.6}}>{baseRace.alignment}</div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
