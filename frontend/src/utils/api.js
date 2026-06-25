import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

const token = localStorage.getItem('rh_token');
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

export default api;
