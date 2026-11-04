import axios from 'axios';
import { localizeMessage } from './messages';

export const API_URL = process.env.REACT_APP_API_URL || '/prudential-api';
let csrfToken;
let sessionData;
let pendingSession;

export function getSession(refresh = false) {
  if (pendingSession) return pendingSession;
  if (sessionData && !refresh) return Promise.resolve(sessionData);
  pendingSession = axios.get(`${API_URL}/auth/session`, { withCredentials: true, timeout: 20000 })
    .then(({ data }) => { csrfToken = data.csrf_token; sessionData = data; return data; })
    .finally(() => { pendingSession = undefined; });
  return pendingSession;
}

const api = axios.create({ withCredentials: true, timeout: 600000 });
api.interceptors.request.use(async config => {
  await getSession();
  if (!['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
api.interceptors.response.use(response => {
  if (response.data.csrf_token) { csrfToken = response.data.csrf_token; sessionData = undefined; }
  return response;
}, error => {
  if (error.response?.status === 401 && !error.config?.url?.endsWith('/auth/login')) {
    sessionData = undefined;
    window.dispatchEvent(new Event('prudential-auth-expired'));
  }
  if (error.response?.status === 403) sessionData = undefined;
  return Promise.reject(error);
});

export async function logout() {
  try { await api.post(`${API_URL}/auth/logout`); }
  finally { csrfToken = undefined; sessionData = undefined; }
}

export function errorMessage(error, fallback = '無法完成操作，請重試。') {
  const data = error.response?.data;
  const summary = localizeMessage(data?.error, fallback);
  return Array.isArray(data?.errors) && data.errors.length
    ? `${summary} ${data.errors.map(value => localizeMessage(value, '資料格式無效，請檢查後重試。')).join(' ')}`
    : summary;
}

export default api;
