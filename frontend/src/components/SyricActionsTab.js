import React, { useEffect, useMemo, useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import { SECTION_COLORS, HASTED_EFFECT } from '../utils/dnd';
import { fetchCharacterModule, findTrackerCounter, runSyricAction, syncSyricCodexPages, updateTrackerCounter } from '../utils/characterModules';
import AbilityDetailModal from './AbilityDetailModal';
import CastSpellPickerModal from './CastSpellPickerModal';

const BUCKET_LABELS = ['Action', 'Haste', 'Bonus Action', 'Reaction', 'Movement'];
const SHADOW_BUCKET_LABELS = ['Action', 'Bonus Action', 'Reaction', 'Movement'];

const sectionColor = (section) => {
  if (section === 'Haste Action') return SECTION_COLORS.Haste;
  if (section === 'Movement') return '#455a64';
  if (section === 'Magic Items') return '#0d47a1';
  if (section === 'No Action') return '#00695c';
  if (section === 'Special') return '#5d4037';
  if (section === 'Out of Combat') return '#37474f';
  return SECTION_COLORS[section] || 'var(--border)';
};

const bucketForSection = (section, action) => {
  if (action?.cost_type === 'haste_action' || section === 'Haste Action') return 'Haste';
  if (action?.cost_type === 'action') return 'Action';
  if (action?.cost_type === 'bonus_action') return 'Bonus Action';
  if (action?.cost_type === 'reaction') return 'Reaction';
  if (['Action', 'Bonus Action', 'Reaction', 'Movement'].includes(section)) return section;
  return null;
};

const sourceBadgeColor = (sourceType) => {
  if (sourceType === 'codex') return 'var(--warning)';
  if (sourceType === 'shadow') return 'var(--accent-light)';
  if (sourceType === 'racial') return '#4caf50';
  if (sourceType === 'feat') return '#ba68c8';
  return 'var(--text-dim)';
};

function PageRail({ pages = [], pendingPages, setPendingPages, onSync }) {
  return (
    <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
      <span style={{fontSize:11,color:'var(--text-dim)',fontWeight:700,textTransform:'uppercase'}}>Codex</span>
      {pages.map(page => (
        <button key={page.page} title={page.title} className="btn btn-secondary btn-sm"
          onClick={() => setPendingPages(prev => prev.includes(page.page) ? prev.filter(p => p !== page.page) : [...prev, page.page].sort((a,b) => a-b))}
          style={{
            minWidth:26,textAlign:'center',padding:'3px 6px',fontSize:11,fontWeight:900,
            background: pendingPages.includes(page.page) ? 'rgba(0,200,120,0.2)' : 'rgba(255,255,255,0.05)',
            color: pendingPages.includes(page.page) ? 'var(--success)' : 'var(--text-dim)',
            borderColor: pendingPages.includes(page.page) ? 'var(--success)' : 'var(--border)',
          }}>
          P{page.page}
        </button>
      ))}
      <button className="btn btn-secondary btn-sm" onClick={onSync}>Sync</button>
    </div>
  );
}

function BucketBar({ owner, labels, used, onToggle, inInitiative, isHasted }) {
  const visible = labels.filter(label => label !== 'Haste' || isHasted);
  return (
    <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
      {visible.map(label => {
        const isUsed = !!used[label];
        return (
          <button key={`${owner}-${label}`} className="btn btn-secondary btn-sm"
            onClick={() => onToggle(label)}
            style={{
              padding:'3px 8px',fontSize:10,borderColor:isUsed ? 'var(--border)' : sectionColor(label === 'Haste' ? 'Haste Action' : label),
              background:isUsed ? 'var(--bg-primary)' : sectionColor(label === 'Haste' ? 'Haste Action' : label),
              color:isUsed ? 'var(--text-dim)' : '#fff',
              textDecoration:isUsed ? 'line-through' : 'none',
              opacity: !inInitiative && !isUsed ? 0.65 : 1,
            }}>
            {label === 'Bonus Action' ? 'Bonus' : label}
          </button>
        );
      })}
    </div>
  );
}

function ActionRow({ action, section, ownerKey, trackerData, inInitiative, used, markBucket, onSpend, onDetail, onCast, onSpecial }) {
  const inventoryItem = action.item_index !== undefined ? trackerData?.inventory?.items?.[action.item_index] : null;
  const match = inventoryItem?.charges
    ? { collection: 'inventory_item_charges', key: action.item_index, value: inventoryItem.charges }
    : findTrackerCounter(trackerData, action);
  const value = match?.value;
  const current = value?.current;
  const max = value?.max;
  const hasCounter = !!match && (max || 0) > 0;
  const depleted = hasCounter && (current || 0) <= 0;
  const bucket = bucketForSection(section, action);
  const bucketUsed = bucket && used[bucket];
  const isCastSpell = action.cost_type === 'cast_spell';
  const unavailable = depleted || bucketUsed;

  const useLabel = isCastSpell ? 'CAST' : bucket || hasCounter ? 'USE' : 'INFO';
  const handleClick = () => {
    if (unavailable) return;
    if (action.name === 'Arcane Venting' || action.name?.includes('Codex Surge') || action.cost_type === 'store' || action.cost_type === 'release_shadow') {
      onSpecial(action, section, bucket);
      return;
    }
    if (isCastSpell) {
      onCast(section);
      return;
    }
    if (hasCounter) onSpend(match, -1);
    if (bucket) markBucket(bucket);
    if (!hasCounter && !bucket) onDetail(action);
  };

  return (
    <div style={{
      display:'grid',gridTemplateColumns:'56px minmax(0,1fr) auto',gap:8,alignItems:'center',
      padding:'8px 10px',borderBottom:'1px solid var(--border)',
      background: unavailable ? 'var(--bg-primary)' : 'var(--bg-card)',opacity: unavailable ? 0.55 : 1,
    }}>
      <button className="btn btn-sm" disabled={!!unavailable}
        onClick={handleClick}
        style={{background: unavailable ? 'var(--border)' : 'var(--accent)',color:'#fff',minWidth:44}}>
        {useLabel}
      </button>
      <div onClick={() => onDetail(action)} style={{minWidth:0,cursor:'pointer'}}>
        <div style={{display:'flex',gap:6,alignItems:'baseline',minWidth:0}}>
          <span style={{color:'var(--text-primary)',fontWeight:700,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {action.name}
          </span>
          {action.codex_page && (
            <span style={{fontSize:10,color:'var(--success)',fontWeight:900,whiteSpace:'nowrap'}}>P{action.codex_page}</span>
          )}
        </div>
        <div style={{color:sourceBadgeColor(action.source_type),fontSize:10,fontWeight:700}}>
          {ownerKey === 'shadow' ? 'Shadow' : 'Syric'} · {action.source || 'Reference'}
        </div>
        {bucketUsed && <div style={{color:'var(--warning)',fontSize:10}}>Already used this turn</div>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:5,justifyContent:'flex-end'}}>
        {hasCounter && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => onSpend(match, -1)} disabled={(current || 0) <= 0}>-</button>
            <span style={{color:(current || 0) > 0 ? 'var(--success)' : 'var(--danger)',fontWeight:900,fontSize:13,minWidth:42,textAlign:'center'}}>
              {current}/{max}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => onSpend(match, 1)} disabled={(current || 0) >= (max || 0)}>+</button>
          </>
        )}
        {!hasCounter && action.tracker_key && (
          <span style={{color:'var(--warning)',fontSize:10,textAlign:'right'}}>ref</span>
        )}
      </div>
    </div>
  );
}

function OwnerPanel({ title, ownerKey, sections, trackerData, inInitiative, used, setUsed, isHasted, onSpend, onDetail, onCast, onSpecial }) {
  const labels = ownerKey === 'shadow' ? SHADOW_BUCKET_LABELS : BUCKET_LABELS;
  const markBucket = (bucket) => {
    if (!bucket) return;
    setUsed(prev => ({ ...prev, [bucket]: true }));
  };
  const toggleBucket = (bucket) => setUsed(prev => ({ ...prev, [bucket]: !prev[bucket] }));

  return (
    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',border:'1px solid var(--border)',background:'var(--bg-secondary)'}}>
      <div style={{padding:'8px 10px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{color:'var(--accent-light)',fontWeight:900,fontSize:14}}>{title}</div>
        <BucketBar owner={ownerKey} labels={labels} used={used} onToggle={toggleBucket} inInitiative={inInitiative} isHasted={isHasted} />
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {(sections || []).map(section => (
          <div key={`${ownerKey}-${section.name}`}>
            <div style={{position:'sticky',top:0,zIndex:2,padding:'6px 10px',background:sectionColor(section.name),color:'#fff',fontSize:11,fontWeight:900,letterSpacing:1,textTransform:'uppercase'}}>
              {section.name}
            </div>
            {(section.actions || []).map(action => (
              <ActionRow
                key={`${ownerKey}-${section.name}-${action.name}-${action.tracker_key || ''}`}
                action={action}
                section={section.name}
                ownerKey={ownerKey}
                trackerData={trackerData}
                inInitiative={inInitiative}
                used={used}
                markBucket={markBucket}
                onSpend={onSpend}
                onDetail={onDetail}
                onCast={onCast}
                onSpecial={onSpecial}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NumberActionModal({ config, onClose, onConfirm }) {
  const [value, setValue] = useState(config?.initial ?? 1);
  if (!config) return null;
  const numeric = Math.max(0, Number(value || 0));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{color:'var(--accent-light)'}}>{config.title}</h2>
          {config.subtitle && <div style={{color:'var(--text-secondary)',fontSize:12}}>{config.subtitle}</div>}
        </div>
        <div className="modal-body">
          <label style={{display:'block',color:'var(--text-dim)',fontSize:11,fontWeight:900,textTransform:'uppercase',marginBottom:6}}>
            {config.label || 'Amount'}
          </label>
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto',gap:8,alignItems:'center'}}>
            <button className="btn btn-secondary" onClick={() => setValue(v => Math.max(0, Number(v || 0) - 1))}>-</button>
            <input
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              type="number"
              min="0"
              style={{width:'100%',fontSize:18,textAlign:'center'}}
            />
            <button className="btn btn-secondary" onClick={() => setValue(v => Number(v || 0) + 1)}>+</button>
          </div>
          {config.helper && (
            <div style={{color:'var(--text-secondary)',fontSize:12,lineHeight:1.5,marginTop:12}}>
              {config.helper}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onConfirm(numeric)} style={{background:'var(--accent)',color:'#fff'}}>
            {config.confirmText || 'Use'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverloadModal({ event, onClose, onResolve }) {
  if (!event) return null;
  const dc = event.overload_dc || event.arcane?.current || 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{color:'var(--warning)'}}>Overload Check</h2>
          <div style={{color:'var(--text-secondary)',fontSize:12}}>{event.message}</div>
        </div>
        <div className="modal-body">
          <div style={{color:'var(--text-primary)',fontWeight:900,fontSize:18,marginBottom:8}}>Roll Arcana DC {dc}</div>
          <div style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.5}}>
            Success: Syric holds the current charge state and remains in control.
            <br />
            Failure: Arcane Discharge triggers. Roll/apply discharge damage manually, then reset charge.
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Later</button>
          <button className="btn" onClick={() => onResolve('pass')} style={{background:'var(--success)',color:'#fff'}}>Passed</button>
          <button className="btn btn-danger" onClick={() => onResolve('fail')}>Failed / Discharge</button>
        </div>
      </div>
    </div>
  );
}

function DischargeResultModal({ event, onClose }) {
  if (!event) return null;
  const stored = event.previousCharge ?? event.before?.arcane?.current ?? event.before?.overload_dc ?? 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{color:'var(--danger)'}}>Arcane Discharge</h2>
          <div style={{color:'var(--text-secondary)',fontSize:12}}>Failed Overload Check</div>
        </div>
        <div className="modal-body">
          <div style={{display:'grid',gap:10}}>
            <div style={{padding:10,border:'1px solid var(--danger)',borderRadius:8,background:'rgba(244,67,54,0.08)'}}>
              <div style={{color:'var(--text-primary)',fontWeight:900}}>Roll this damage manually</div>
              <div style={{color:'var(--danger)',fontSize:18,fontWeight:900,marginTop:4}}>
                Force damage = 2 x stored spell levels
              </div>
              <div style={{color:'var(--text-secondary)',fontSize:12,marginTop:4}}>
                Charge before discharge was {stored}. Use your table ruling for stored spell levels if different from current charge.
              </div>
            </div>
            <div style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.55}}>
              20-foot radius centered on Syric. Dex save for half using Syric's spell save DC. Syric auto-fails and takes full damage.
              After damage, roll Arcane Rebound if your table is using that result table.
            </div>
            <div style={{color:'var(--success)',fontSize:13,fontWeight:800}}>
              Arcane Charge reset to 0.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} style={{background:'var(--accent)',color:'#fff',width:'100%'}}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function ShadowStoreModal({ maxLevel, onStore, onClose }) {
  const { character } = useCharacter();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const known = character?.spell_data?.known_spells || [];
  const slots = character?.tracker_data?.spell_slots || {};
  const spells = known.filter(spell => (
    spell.level_int > 0 &&
    spell.level_int <= maxLevel &&
    (!search || spell.name.toLowerCase().includes(search.toLowerCase()))
  )).sort((a,b) => (a.level_int - b.level_int) || a.name.localeCompare(b.name));
  const slotLevels = selected
    ? Object.entries(slots).filter(([level, slot]) => Number(level) >= selected.level_int && Number(level) <= maxLevel && (slot.current || 0) > 0)
    : [];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Store in Shadow</h2>
          <div style={{color:'var(--text-dim)',fontSize:11}}>Nightbound Shadowcast max L{maxLevel}</div>
        </div>
        <div className="modal-body">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search known spells..." style={{width:'100%',marginBottom:10}} autoFocus />
          <div style={{display:'grid',gridTemplateColumns:'1fr 180px',gap:12}}>
            <div>
              {spells.map(spell => (
                <button key={spell.name} className="btn btn-secondary" onClick={() => setSelected(spell)}
                  style={{width:'100%',marginBottom:6,textAlign:'left',borderColor:selected?.name === spell.name ? 'var(--accent)' : 'var(--border)'}}>
                  L{spell.level_int} {spell.name}
                </button>
              ))}
            </div>
            <div>
              <div style={{color:'var(--text-secondary)',fontSize:12,marginBottom:8}}>
                {selected ? `Store ${selected.name} with:` : 'Select a spell'}
              </div>
              {slotLevels.map(([level, slot]) => (
                <button key={level} className="btn" style={{width:'100%',marginBottom:6}} onClick={() => onStore(selected, Number(level))}>
                  L{level} ({slot.current}/{slot.max})
                </button>
              ))}
              {selected && slotLevels.length === 0 && <div style={{color:'var(--danger)',fontSize:12}}>No available slot within Shadow cap.</div>}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function SyricActionsTab() {
  const { character, saveTrackerData, setCharacter, turnUsed, setTurnUsed, companionTurnUsed, setCompanionTurnUsed } = useCharacter();
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [castingBucket, setCastingBucket] = useState(null);
  const [pendingPages, setPendingPages] = useState([]);
  const [notice, setNotice] = useState('');
  const [overload, setOverload] = useState(null);
  const [discharge, setDischarge] = useState(null);
  const [shadowStore, setShadowStore] = useState(null);
  const [ventAmount, setVentAmount] = useState(2);
  const [numberAction, setNumberAction] = useState(null);

  useEffect(() => {
    if (!character?.id) return;
    setLoading(true);
    setError('');
    fetchCharacterModule(character.id, 'syric_arcane')
      .then(setModule)
      .catch(err => setError(err.response?.data?.error || 'Syric module unavailable.'))
      .finally(() => setLoading(false));
  }, [character?.id]);

  useEffect(() => {
    setPendingPages(module?.unlocked_codex_pages || []);
  }, [module?.unlocked_codex_pages]);

  const trackerData = character?.tracker_data || {};
  const inInitiative = !!trackerData.in_initiative;
  const isHasted = (trackerData.active_effects || []).includes(HASTED_EFFECT);
  const arcaneCharge = useMemo(() => (module?.counters || []).find(counter => /arcane charge/i.test(counter.name || '')), [module]);
  const arcaneMatch = findTrackerCounter(trackerData, arcaneCharge);
  const arcaneValue = arcaneMatch?.value || arcaneCharge;
  const syricSections = useMemo(() => {
    const sections = [...(module?.action_sections || [])];
    const items = trackerData?.inventory?.items || [];
    const magicItems = items.map((item, index) => ({ item, index })).filter(({ item }) => item.charges);
    if (!magicItems.length) return sections;
    const itemSection = {
      name: 'Magic Items',
      actions: magicItems.map(({ item, index }) => ({
        name: item.name,
        source: item.rarity || 'Magic Item',
        source_type: 'item',
        cost_type: item.cost_type || 'action',
        item_index: index,
        description: item.description || item.notes || 'Charged magic item.',
      })),
    };
    const insertAt = sections.findIndex(section => section.name === 'No Action' || section.name === 'Passive');
    if (insertAt >= 0) {
      return [...sections.slice(0, insertAt), itemSection, ...sections.slice(insertAt)];
    }
    return [...sections, itemSection];
  }, [module?.action_sections, trackerData]);

  const resetRound = () => {
    setTurnUsed({ Action: false, 'Bonus Action': false, Reaction: false, Haste: false, Movement: false, Attacks: 0 });
    setCompanionTurnUsed({ Action: false, 'Bonus Action': false, Reaction: false, Movement: false });
  };

  const toggleInitiative = async () => {
    const entering = !inInitiative;
    await saveTrackerData({ ...trackerData, in_initiative: entering });
    resetRound();
  };

  const spendCounter = async (match, delta) => {
    if (!match) return;
    await saveTrackerData(updateTrackerCounter(trackerData, match, delta));
  };

  const applyModuleResult = (data) => {
    if (data.tracker_data) setCharacter(prev => ({ ...prev, tracker_data: data.tracker_data }));
    if (data.module) setModule(data.module);
    const result = data.result || {};
    if (result.message) setNotice(result.message);
    if (result.overload_check_required) setOverload(result);
    return result;
  };

  const runAction = async (action, payload = {}) => {
    const data = await runSyricAction(character.id, action, payload);
    return applyModuleResult(data);
  };

  const syncPages = async () => {
    const data = await syncSyricCodexPages(character.id, pendingPages);
    if (data.tracker_data) setCharacter(prev => ({ ...prev, tracker_data: data.tracker_data }));
    if (data.module) setModule(data.module);
    setNotice(`Synced Codex pages: ${pendingPages.join(', ') || 'none'}.`);
  };

  const handleSpecial = async (action, section, bucket) => {
    if (action.name === 'Arcane Venting') {
      setNumberAction({
        title: 'Arcane Venting',
        subtitle: 'Roll your Vent Die and enter the result.',
        label: 'Vent die result',
        initial: ventAmount || 2,
        confirmText: 'Vent',
        helper: 'At Syric level 13, Vent Die is 2d6. This subtracts the amount from Arcane Charge.',
        onConfirm: async (amount) => {
          setVentAmount(amount);
          await runAction('vent', { amount });
          if (bucket) setTurnUsed(prev => ({ ...prev, [bucket]: true }));
        },
      });
      return;
    }
    if (action.name?.includes('Codex Surge')) {
      setNumberAction({
        title: action.name,
        subtitle: action.name.includes('d6') ? 'Free Action mode: d6s.' : 'Bonus Action mode: d10s.',
        label: 'Codex Dice spent',
        initial: 1,
        confirmText: 'Spend Dice',
        helper: action.name.includes('d6')
          ? 'Spend up to proficiency bonus dice as d6s.'
          : 'Spend any number of dice as d10s, using your bonus action.',
        onConfirm: async (amount) => {
          if (!amount) return;
          const result = await runAction('spend', { tracker_key: action.tracker_key, tracker_aliases: action.tracker_aliases || [], amount });
          if (result.spent && bucket) setTurnUsed(prev => ({ ...prev, [bucket]: true }));
        },
      });
      return;
    }
    if (action.cost_type === 'store') {
      setShadowStore(action);
      return;
    }
    if (action.cost_type === 'release_shadow') {
      const result = await runAction('shadow_release');
      if (result.spent) setCompanionTurnUsed(prev => ({ ...prev, 'Bonus Action': true }));
    }
  };

  const startCast = (section) => setCastingBucket(section);
  const castBucket = bucketForSection(castingBucket || 'Action', { cost_type: 'cast_spell' });

  if (loading) return <div style={{padding:16,color:'var(--text-secondary)'}}>Loading Syric actions...</div>;
  if (error) return <div style={{padding:16,color:'var(--danger)'}}>{error}</div>;
  if (!module) return <div style={{padding:16,color:'var(--text-secondary)'}}>Syric action module is not available for this character.</div>;

  return (
    <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',background:'var(--bg-primary)'}}>
      <div style={{display:'flex',gap:8,padding:'8px 10px',borderBottom:'1px solid var(--border)',alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
        <button className="btn btn-sm" onClick={toggleInitiative} style={{background:inInitiative ? 'var(--danger)' : 'var(--success)',color:'#fff',fontWeight:800}}>
          {inInitiative ? 'Stop Initiative' : 'Start Initiative'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={resetRound}>Reset Round</button>
        <button className="btn btn-secondary btn-sm" onClick={() => runAction('end_turn', { vent_amount: ventAmount })}>End Turn</button>
        <button className="btn btn-secondary btn-sm" onClick={() => setVentAmount(v => Math.max(0, Number(v || 0) - 1))}>-</button>
        <input value={ventAmount} onChange={e => setVentAmount(e.target.value)} type="number" min="0" style={{width:54}} />
        <button className="btn btn-secondary btn-sm" onClick={() => setVentAmount(v => Number(v || 0) + 1)}>+</button>
        <div style={{color:'var(--text-dim)',fontSize:11}}>
          {isHasted ? 'Haste action online' : 'Haste action hidden until Hasted'}
        </div>
        {notice && <div style={{color:'var(--accent-light)',fontSize:11,fontWeight:700}}>{notice}</div>}
        <div style={{flex:1}} />
        {arcaneValue && (
          <div style={{fontSize:12,color:'var(--text-secondary)',fontWeight:800}}>
            Arcane Charge <span style={{color:'var(--accent-light)'}}>{arcaneValue.current ?? 0}/{arcaneValue.max ?? '-'}</span>
          </div>
        )}
        <PageRail pages={module.codex_pages || []} pendingPages={pendingPages} setPendingPages={setPendingPages} onSync={syncPages} />
      </div>

      <div style={{flex:1,overflow:'hidden',display:'flex'}}>
        <OwnerPanel
          title="Syric"
          ownerKey="syric"
          sections={syricSections}
          trackerData={trackerData}
          inInitiative={inInitiative}
          used={turnUsed || {}}
          setUsed={setTurnUsed}
          isHasted={isHasted}
          onSpend={spendCounter}
          onDetail={setDetail}
          onCast={startCast}
          onSpecial={handleSpecial}
        />
        <div style={{width:2,background:'var(--border)',flexShrink:0}} />
        <OwnerPanel
          title="Shadow"
          ownerKey="shadow"
          sections={module.shadow_action_sections || []}
          trackerData={trackerData}
          inInitiative={inInitiative}
          used={companionTurnUsed || {}}
          setUsed={setCompanionTurnUsed}
          isHasted={false}
          onSpend={spendCounter}
          onDetail={setDetail}
          onCast={startCast}
          onSpecial={handleSpecial}
        />
      </div>

      {detail && <AbilityDetailModal ability={detail} onClose={() => setDetail(null)} />}
      <OverloadModal
        event={overload}
        onClose={() => setOverload(null)}
        onResolve={async (outcome) => {
          if (outcome === 'fail') {
            const before = overload;
            await runAction('discharge');
            setDischarge({ before, previousCharge: before?.arcane?.current ?? before?.overload_dc ?? 0 });
          } else {
            setNotice('Overload check passed. Syric holds the charge state.');
          }
          setOverload(null);
        }}
      />
      <DischargeResultModal event={discharge} onClose={() => setDischarge(null)} />
      <NumberActionModal
        config={numberAction}
        onClose={() => setNumberAction(null)}
        onConfirm={async (value) => {
          const handler = numberAction?.onConfirm;
          setNumberAction(null);
          if (handler) await handler(value);
        }}
      />
      {shadowStore && (
        <ShadowStoreModal
          maxLevel={Math.max(...((shadowStore.slot_levels || []).length ? shadowStore.slot_levels : [3]))}
          onStore={async (spell, level) => {
            await runAction('shadow_store', {
              spell_name: spell.name,
              level,
              tracker_key: shadowStore.tracker_key,
              tracker_aliases: shadowStore.tracker_aliases || [],
            });
            setCompanionTurnUsed(prev => ({ ...prev, Action: true }));
            setShadowStore(null);
          }}
          onClose={() => setShadowStore(null)}
        />
      )}
      {castingBucket && (
        <CastSpellPickerModal
          bucket={castingBucket}
          onCast={async (meta) => {
            if (castBucket) setTurnUsed(prev => ({ ...prev, [castBucket]: true }));
            const spell = meta?.spell || {};
            await runAction('record_spell_cast', { spell_name: spell.name, level: meta?.level || spell.level_int || 0 });
          }}
          onClose={() => setCastingBucket(null)}
        />
      )}
    </div>
  );
}
