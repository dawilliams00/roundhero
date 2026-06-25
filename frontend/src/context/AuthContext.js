import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('rh_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/auth/me')
        .then(r => setUser(r.data))
        .catch(() => { localStorage.removeItem('rh_token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    localStorage.setItem('rh_token', r.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`;
    setUser(r.data.user);
    return r.data;
  };

  const register = async (username, email, password) => {
    const r = await api.post('/auth/register', { username, email, password });
    localStorage.setItem('rh_token', r.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`;
    setUser(r.data.user);
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem('rh_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
