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
    if (err.config?.suppressGlobalError) {
      return Promise.reject(err);
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('rh_token');
      delete api.defaults.headers.common['Authorization'];
      window.alert('Your session expired - please log back in. Anything not yet saved will need to be redone.');
      window.location.href = '/';
      return Promise.reject(err);
    }
    const msg = err.response?.data?.error || err.message || 'Request failed';
    window.alert(`Something didn't save: ${msg}\n\nYour last change may not have been saved - please try again.`);
    return Promise.reject(err);
  }
);

export default api;
