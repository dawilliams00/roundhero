import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function AuthPage() {
  const [params]              = useSearchParams();
  const [mode, setMode]       = useState(params.get('mode') === 'login' ? 'login' : 'register');
  const [form, setForm]       = useState({ username:'', email:'', password:'' });
  const [error, setError]     = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register }   = useAuth();
  const nav = useNavigate();

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const switchMode = nextMode => {
    setMode(nextMode);
    setError('');
    setMessage('');
  };

  const submit = async e => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const r = await api.post('/auth/forgot-password', { email: form.email }, { suppressGlobalError: true });
        setMessage(r.data?.message || 'If that email exists, a password reset link has been sent.');
      } else if (mode === 'login') {
        await login(form.email, form.password);
        nav('/characters');
      } else {
        await register(form.username, form.email, form.password);
        nav('/characters');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reach the password reset service. Refresh the page and try again.');
    } finally { setLoading(false); }
  };

  const subtitle = mode === 'forgot'
    ? 'Send yourself a reset link.'
    : mode === 'login'
      ? 'Welcome back, hero.'
      : 'Create your account.';

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'var(--bg-primary)'}}>
      <div className="modal" style={{maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:24,color:'var(--accent-light)',marginBottom:4}}>RoundHero</div>
          <div style={{color:'var(--text-secondary)',fontSize:13}}>{subtitle}</div>
        </div>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label>Username</label>
              <input name="username" value={form.username} onChange={handle} placeholder="HeroName42" required autoFocus />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input name="email" type="email" value={form.email} onChange={handle} placeholder="you@example.com" required autoFocus={mode === 'login'} />
          </div>
          {mode !== 'forgot' && (
            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" required />
            </div>
          )}
          {error && <div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(230,57,70,0.1)',borderRadius:'var(--radius-sm)'}}>{error}</div>}
          {message && <div style={{color:'var(--success)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(42,157,143,0.12)',borderRadius:'var(--radius-sm)'}}>{message}</div>}
          <button type="submit" className="btn btn-primary" style={{width:'100%',padding:'10px',fontSize:15}} disabled={loading}>
            {loading ? '...' : mode === 'forgot' ? 'Send Reset Link' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        {mode === 'login' && (
          <div style={{textAlign:'center',marginTop:12}}>
            <button type="button" onClick={() => switchMode('forgot')} style={{background:'none',color:'var(--text-secondary)',fontWeight:500,fontSize:13}}>
              Forgot password?
            </button>
          </div>
        )}
        <div style={{textAlign:'center',marginTop:16,color:'var(--text-dim)',fontSize:13}}>
          {mode === 'login' ? "Don't have an account? " : mode === 'forgot' ? 'Remembered it? ' : 'Already have an account? '}
          <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} style={{background:'none',color:'var(--accent-light)',fontWeight:500,fontSize:13}}>
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
