import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

const token = localStorage.getItem('rh_token');
if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// Without this, a failed save (expired session, network blip, server error) fails
// completely silently - no UI feedback - and looks identical to data loss.
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Request failed';
    window.alert(`Something didn't save: ${msg}\n\nYour last change may not have been saved - please try again.`);
    return Promise.reject(err);
  }
);

export default api;
