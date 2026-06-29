import React, { createContext, useCallback, useContext, useState } from 'react';
import api from '../utils/api';

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/campaigns/');
      setCampaigns(r.data);
      return r.data;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCampaign = useCallback(async id => {
    setLoading(true);
    try {
      const r = await api.get(`/campaigns/${id}`);
      setCampaign(r.data);
      return r.data;
    } finally {
      setLoading(false);
    }
  }, []);

  const createCampaign = useCallback(async name => {
    const r = await api.post('/campaigns/', { name });
    setCampaign(r.data);
    setCampaigns(prev => [r.data, ...prev.filter(c => c.id !== r.data.id)]);
    return r.data;
  }, []);

  const joinCampaign = useCallback(async inviteCode => {
    const r = await api.post('/campaigns/join', { invite_code: inviteCode });
    setCampaign(r.data);
    setCampaigns(prev => [r.data, ...prev.filter(c => c.id !== r.data.id)]);
    return r.data;
  }, []);

  const renameCampaign = useCallback(async (id, name) => {
    const r = await api.put(`/campaigns/${id}`, { name });
    setCampaign(r.data);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: r.data.name } : c));
    return r.data;
  }, []);

  const regenerateInvite = useCallback(async id => {
    const r = await api.post(`/campaigns/${id}/invite/regenerate`);
    setCampaign(prev => prev ? { ...prev, invite_code: r.data.invite_code } : prev);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, invite_code: r.data.invite_code } : c));
    return r.data.invite_code;
  }, []);

  const attachCharacter = useCallback(async (campaignId, characterId) => {
    const r = await api.post(`/campaigns/${campaignId}/characters`, { character_id: characterId });
    setCampaign(r.data);
    return r.data;
  }, []);

  const detachCharacter = useCallback(async (campaignId, campaignCharacterId) => {
    const r = await api.delete(`/campaigns/${campaignId}/characters/${campaignCharacterId}`);
    setCampaign(r.data);
    return r.data;
  }, []);

  const createEffect = useCallback(async (campaignId, effect) => {
    const r = await api.post(`/campaigns/${campaignId}/effects`, effect);
    setCampaign(prev => prev ? { ...prev, effects: [...(prev.effects || []), r.data] } : prev);
    return r.data;
  }, []);

  const updateEffectStatus = useCallback(async (campaignId, effectId, status) => {
    const r = await api.post(`/campaigns/${campaignId}/effects/${effectId}/status`, { status });
    setCampaign(prev => prev ? {
      ...prev,
      effects: (prev.effects || []).map(effect => effect.id === effectId ? r.data : effect),
    } : prev);
    return r.data;
  }, []);

  return (
    <CampaignContext.Provider value={{
      campaigns,
      campaign,
      loading,
      fetchCampaigns,
      loadCampaign,
      createCampaign,
      joinCampaign,
      renameCampaign,
      regenerateInvite,
      attachCharacter,
      detachCharacter,
      createEffect,
      updateEffectStatus,
    }}>
      {children}
    </CampaignContext.Provider>
  );
}

export const useCampaign = () => useContext(CampaignContext);
