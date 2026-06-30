import api from './api';

export async function fetchCharacterModules(characterId) {
  const r = await api.get(`/character-modules/${characterId}`);
  return r.data || [];
}

export async function fetchCharacterModule(characterId, moduleId) {
  const r = await api.get(`/character-modules/${characterId}/${moduleId}`);
  return r.data;
}

export async function syncSyricCodexPages(characterId, pages) {
  const r = await api.post(`/character-modules/${characterId}/syric_arcane/codex-pages`, { pages });
  return r.data;
}

export async function syncSyricShadowLevel(characterId, level) {
  const r = await api.post(`/character-modules/${characterId}/syric_arcane/shadow-level`, { level });
  return r.data;
}

export async function runSyricAction(characterId, action, payload = {}) {
  const r = await api.post(`/character-modules/${characterId}/syric_arcane/action`, { action, payload });
  return r.data;
}

export function findTrackerCounter(trackerData, moduleCounter) {
  const key = moduleCounter?.tracker_key || moduleCounter?.name;
  const aliases = moduleCounter?.tracker_aliases || [];
  const charges = trackerData?.item_charges || {};
  if (key && charges[key]) return { collection: 'item_charges', key, value: charges[key] };
  for (const alias of aliases) {
    if (charges[alias]) return { collection: 'item_charges', key: alias, value: charges[alias] };
  }
  const features = trackerData?.features || {};
  if (key && features[key]) return { collection: 'features', key, value: features[key] };
  for (const alias of aliases) {
    if (features[alias]) return { collection: 'features', key: alias, value: features[alias] };
  }
  const byName = Object.entries(charges).find(([, value]) => (
    (value?.display_name || value?.name || '').toLowerCase() === (moduleCounter?.name || '').toLowerCase()
  ));
  if (byName) return { collection: 'item_charges', key: byName[0], value: byName[1] };
  return null;
}

export function updateTrackerCounter(trackerData, match, delta) {
  if (!match) return trackerData;
  if (match.collection === 'inventory_item_charges') {
    const items = trackerData?.inventory?.items || [];
    const index = Number(match.key);
    const current = Number(match.value?.current || 0);
    const max = Number(match.value?.max || 0);
    const nextCurrent = Math.max(0, max ? Math.min(max, current + delta) : current + delta);
    return {
      ...trackerData,
      inventory: {
        ...(trackerData?.inventory || {}),
        items: items.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          charges: {
            ...item.charges,
            current: nextCurrent,
          },
        } : item),
      },
    };
  }
  const current = Number(match.value?.current || 0);
  const max = Number(match.value?.max || 0);
  const nextCurrent = Math.max(0, max ? Math.min(max, current + delta) : current + delta);
  return {
    ...trackerData,
    [match.collection]: {
      ...(trackerData?.[match.collection] || {}),
      [match.key]: {
        ...match.value,
        current: nextCurrent,
      },
    },
  };
}
