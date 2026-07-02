import React, { createContext, useCallback, useContext, useState } from 'react';
import api from '../utils/api';

const CampaignContext = createContext(null);

export function CampaignProvider({ children }) {
  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(false);

  const campaignSummary = data => ({
    ...data,
    member_count: data.member_count ?? (data.members || []).length,
    character_count: data.character_count ?? (data.characters || []).filter(entry => entry.active).length,
  });

  const setCurrentCampaign = useCallback(data => {
    const summary = campaignSummary(data);
    setCampaign(summary);
    setCampaigns(prev => prev.map(c => c.id === summary.id ? { ...c, ...summary } : c));
    return summary;
  }, []);

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
    const summary = campaignSummary(r.data);
    setCampaign(summary);
    setCampaigns(prev => [summary, ...prev.filter(c => c.id !== summary.id)]);
    return summary;
  }, []);

  const joinCampaign = useCallback(async inviteCode => {
    const r = await api.post('/campaigns/join', { invite_code: inviteCode });
    const summary = campaignSummary(r.data);
    setCampaign(summary);
    setCampaigns(prev => [summary, ...prev.filter(c => c.id !== summary.id)]);
    return summary;
  }, []);

  const renameCampaign = useCallback(async (id, name) => {
    const r = await api.put(`/campaigns/${id}`, { name });
    setCampaign(r.data);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: r.data.name } : c));
    return r.data;
  }, []);

  const updateCampaignRules = useCallback(async (id, rules) => {
    const r = await api.put(`/campaigns/${id}`, { rules });
    setCampaign(r.data);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, rules: r.data.rules } : c));
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
    return setCurrentCampaign(r.data);
  }, [setCurrentCampaign]);

  const detachCharacter = useCallback(async (campaignId, campaignCharacterId) => {
    const r = await api.delete(`/campaigns/${campaignId}/characters/${campaignCharacterId}`);
    return setCurrentCampaign(r.data);
  }, [setCurrentCampaign]);

  const setCampaignCharacterActive = useCallback(async (campaignId, campaignCharacterId, active) => {
    const r = await api.post(`/campaigns/${campaignId}/characters/${campaignCharacterId}/active`, { active });
    return setCurrentCampaign(r.data);
  }, [setCurrentCampaign]);

  const setPrimaryCharacter = useCallback(async (campaignId, campaignCharacterId) => {
    const r = await api.post(`/campaigns/${campaignId}/characters/${campaignCharacterId}/primary`);
    return setCurrentCampaign(r.data);
  }, [setCurrentCampaign]);

  const updateMemberRole = useCallback(async (campaignId, memberId, role) => {
    const r = await api.post(`/campaigns/${campaignId}/members/${memberId}/role`, { role });
    return setCurrentCampaign(r.data);
  }, [setCurrentCampaign]);

  const transferCampaignOwner = useCallback(async (campaignId, email) => {
    const r = await api.post(`/campaigns/${campaignId}/owner/transfer`, { email });
    setCampaign(r.data);
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, ...r.data } : c));
    return r.data;
  }, []);

  const removeMember = useCallback(async (campaignId, memberId) => {
    const r = await api.delete(`/campaigns/${campaignId}/members/${memberId}`);
    return setCurrentCampaign(r.data);
  }, [setCurrentCampaign]);

  const leaveCampaign = useCallback(async campaignId => {
    await api.post(`/campaigns/${campaignId}/leave`);
    setCampaign(null);
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
  }, []);

  const deleteCampaign = useCallback(async campaignId => {
    await api.delete(`/campaigns/${campaignId}`);
    setCampaign(null);
    setCampaigns(prev => prev.filter(c => c.id !== campaignId));
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

  const createEncounter = useCallback(async (campaignId, encounter) => {
    const r = await api.post(`/campaigns/${campaignId}/encounters`, encounter);
    setCampaign(prev => prev ? { ...prev, encounters: [...(prev.encounters || []), r.data] } : prev);
    return r.data;
  }, []);

  const updateEncounter = useCallback(async (campaignId, encounterId, updates) => {
    const r = await api.put(`/campaigns/${campaignId}/encounters/${encounterId}`, updates);
    setCampaign(prev => prev ? {
      ...prev,
      encounters: (prev.encounters || []).map(encounter => encounter.id === encounterId ? r.data : encounter),
    } : prev);
    return r.data;
  }, []);

  const deleteEncounter = useCallback(async (campaignId, encounterId) => {
    const r = await api.delete(`/campaigns/${campaignId}/encounters/${encounterId}`);
    setCampaign(r.data);
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
      updateCampaignRules,
      regenerateInvite,
      attachCharacter,
      detachCharacter,
      setCampaignCharacterActive,
      setPrimaryCharacter,
      updateMemberRole,
      transferCampaignOwner,
      removeMember,
      leaveCampaign,
      deleteCampaign,
      createEffect,
      updateEffectStatus,
      createEncounter,
      updateEncounter,
      deleteEncounter,
    }}>
      {children}
    </CampaignContext.Provider>
  );
}

export const useCampaign = () => useContext(CampaignContext);
