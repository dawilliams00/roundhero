import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const token = params.get('token') || '';

  const submit = async e => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const r = await api.post('/auth/reset-password', { token, password });
      setMessage(r.data?.message || 'Password updated. You can sign in now.');
      setTimeout(() => nav('/auth?mode=login'), 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset link is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'var(--bg-primary)'}}>
      <div className="modal" style={{maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:24,color:'var(--accent-light)',marginBottom:4}}>RoundHero</div>
          <div style={{color:'var(--text-secondary)',fontSize:13}}>Choose a new password.</div>
        </div>

        {!token ? (
          <div>
            <div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(230,57,70,0.1)',borderRadius:'var(--radius-sm)'}}>
              This reset link is missing its token.
            </div>
            <Link to="/auth?mode=login" className="btn btn-secondary" style={{display:'block',textAlign:'center'}}>Back to Sign In</Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                required
                autoFocus
              />
            </div>
            {error && <div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(230,57,70,0.1)',borderRadius:'var(--radius-sm)'}}>{error}</div>}
            {message && <div style={{color:'var(--success)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(42,157,143,0.12)',borderRadius:'var(--radius-sm)'}}>{message}</div>}
            <button type="submit" className="btn btn-primary" style={{width:'100%',padding:'10px',fontSize:15}} disabled={loading}>
              {loading ? '...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div style={{textAlign:'center',marginTop:16}}>
          <Link to="/auth?mode=login" style={{color:'var(--accent-light)',fontWeight:500,fontSize:13,textDecoration:'none'}}>
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
