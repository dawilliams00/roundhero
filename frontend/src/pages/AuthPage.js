import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [params]              = useSearchParams();
  const [mode, setMode]       = useState(params.get('mode') === 'login' ? 'login' : 'register');
  const [form, setForm]       = useState({ username:'', email:'', password:'' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register }   = useAuth();
  const nav = useNavigate();

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      nav('/characters');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:16,background:'var(--bg-primary)'}}>
      <div className="modal" style={{maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:24,color:'var(--accent-light)',marginBottom:4}}>RoundHero</div>
          <div style={{color:'var(--text-secondary)',fontSize:13}}>{mode === 'login' ? 'Welcome back, hero.' : 'Create your account.'}</div>
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
          <div className="form-group">
            <label>Password</label>
            <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" required />
          </div>
          {error && <div style={{color:'var(--danger)',fontSize:13,marginBottom:12,padding:'8px 12px',background:'rgba(230,57,70,0.1)',borderRadius:'var(--radius-sm)'}}>{error}</div>}
          <button type="submit" className="btn btn-primary" style={{width:'100%',padding:'10px',fontSize:15}} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <div style={{textAlign:'center',marginTop:16,color:'var(--text-dim)',fontSize:13}}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{background:'none',color:'var(--accent-light)',fontWeight:500,fontSize:13}}>
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
