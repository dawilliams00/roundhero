import React, { useState } from 'react';
import { useCharacter } from '../context/CharacterContext';
import api from '../utils/api';
import InfoModal from './InfoModal';

export default function FeedbackModal({ onClose }) {
  const { character } = useCharacter();
  const [comment, setComment] = useState('');
  const [image, setImage] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!comment.trim()) return;
    setSending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('comment', comment.trim());
      if (character?.name) form.append('character_name', character.name);
      if (image) form.append('image', image);
      await api.post('/feedback', form, { headers: { 'Content-Type': undefined } });
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not send feedback.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return <InfoModal title="Feedback Sent" message="Thanks! Your feedback was sent." onClose={onClose} />;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Send Feedback</h2>
        <div style={{color:'var(--text-dim)',fontSize:11,marginBottom:12}}>
          Found a bug, or have an idea for an enhancement? Tell us about it below — a screenshot helps a lot.
        </div>
        <div className="form-group">
          <label>Comment</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={5} placeholder="What happened, or what would you like to see?" style={{width:'100%',resize:'vertical'}} autoFocus />
        </div>
        <div className="form-group">
          <label>Screenshot (optional)</label>
          <input type="file" accept="image/*" onChange={e => setImage(e.target.files?.[0] || null)} />
        </div>
        {error && <div style={{color:'var(--danger)',fontSize:12,marginTop:8}}>{error}</div>}
        <div style={{display:'flex',gap:8,marginTop:12}}>
          <button className="btn btn-secondary" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{flex:2}} disabled={!comment.trim()||sending} onClick={submit}>{sending?'Sending...':'Send Feedback'}</button>
        </div>
      </div>
    </div>
  );
}
