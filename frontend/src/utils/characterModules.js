import api from './api';

export async function fetchCharacterModules(characterId) {
  const r = await api.get(`/character-modules/${characterId}`);
  return r.data || [];
}

export async function fetchCharacterModule(characterId, moduleId) {
  const r = await api.get(`/character-modules/${characterId}/${moduleId}`);
  return r.data;
}

export function findTrackerCounter(trackerData, moduleCounter) {
  const key = moduleCounter?.tracker_key || moduleCounter?.name;
  const charges = trackerData?.item_charges || {};
  if (key && charges[key]) return { collection: 'item_charges', key, value: charges[key] };
  const features = trackerData?.features || {};
  if (key && features[key]) return { collection: 'features', key, value: features[key] };
  const byName = Object.entries(charges).find(([, value]) => (
    (value?.display_name || value?.name || '').toLowerCase() === (moduleCounter?.name || '').toLowerCase()
  ));
  if (byName) return { collection: 'item_charges', key: byName[0], value: byName[1] };
  return null;
}

export function updateTrackerCounter(trackerData, match, delta) {
  if (!match) return trackerData;
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
