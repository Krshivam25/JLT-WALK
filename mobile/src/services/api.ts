import axios from 'axios';
import * as Keychain from 'react-native-keychain';

const BASE_URL = 'https://jltwalk-api.fly.dev/api/v1';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// --- Token storage ---

export async function getToken(): Promise<string | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: 'jltwalk_access' });
    return creds ? creds.password : null;
  } catch { return null; }
}

export async function setToken(key: string, value: string): Promise<void> {
  try {
    await Keychain.setGenericPassword(key, value, { service: `jltwalk_${key}` });
  } catch {}
}

export async function removeTokens(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: 'jltwalk_access' });
    await Keychain.resetGenericPassword({ service: 'jltwalk_refresh' });
    await Keychain.resetGenericPassword({ service: 'jltwalk_credentials' });
  } catch {}
}

// --- Credential storage for silent re-login ---

export async function saveCredentials(email: string, password: string): Promise<void> {
  try {
    await Keychain.setGenericPassword(email, password, { service: 'jltwalk_credentials' });
  } catch {}
}

async function getSavedCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: 'jltwalk_credentials' });
    if (creds) return { email: creds.username, password: creds.password };
    return null;
  } catch { return null; }
}

// --- Silent re-login ---

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function silentReLogin(): Promise<string | null> {
  // Prevent multiple concurrent re-logins
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      // Try refresh token first
      const refreshCreds = await Keychain.getGenericPassword({ service: 'jltwalk_refresh' });
      if (refreshCreds) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshCreds.password }, { timeout: 10000 });
          const newToken = res.data.token || res.data.access_token;
          if (newToken) {
            await setToken('access', newToken);
            if (res.data.refresh_token) await setToken('refresh', res.data.refresh_token);
            return newToken;
          }
        } catch {
          // Refresh failed, try re-login
        }
      }

      // Fall back to silent re-login with saved credentials
      const creds = await getSavedCredentials();
      if (creds) {
        const res = await axios.post(`${BASE_URL}/auth/login`, { email: creds.email, password: creds.password }, { timeout: 10000 });
        const newToken = res.data.token || res.data.access_token;
        if (newToken) {
          await setToken('access', newToken);
          if (res.data.refresh_token) await setToken('refresh', res.data.refresh_token);
          return newToken;
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// --- Interceptors ---

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // On 401, try silent re-login (but not for login/register requests themselves)
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/login') && !original.url?.includes('/auth/register')) {
      original._retry = true;
      const newToken = await silentReLogin();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      // Re-login failed — don't remove tokens yet, let AuthContext handle it
    }
    return Promise.reject(error);
  }
);

// --- API endpoints ---

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (email: string, password: string, display_name?: string) => api.post('/auth/register', { email, password, display_name }),
  me: () => api.get('/auth/me'),
};

export const tracesApi = {
  submit: (data: { geometry: object; started_at: string; ended_at: string; mode: string }) => api.post('/traces/', data),
  mine: (limit = 20, offset = 0) => api.get(`/traces/mine?limit=${limit}&offset=${offset}`),
  anonymous: (data: { geometry: object; started_at: string; ended_at: string; mode: string }) => api.post('/traces/anonymous', data),
};

export const routeApi = {
  find: (orig: string, dest: string, opts?: { avoid_stairs?: boolean; prefer_shade?: boolean }) => {
    const params = new URLSearchParams({ orig, dest });
    if (opts?.avoid_stairs) params.set('avoid_stairs', 'true');
    if (opts?.prefer_shade) params.set('prefer_shade', 'true');
    return api.get(`/route/?${params}`);
  },
};

export const pinsApi = {
  list: (bbox: string) => api.get(`/pins/?bbox=${bbox}`),
  get: (id: string) => api.get(`/pins/${id}`),
  create: (data: { lat: number; lon: number; type: string; title: string; description?: string }) => api.post('/pins/', data),
  delete: (id: string) => api.delete(`/pins/${id}`),
  verify: (id: string) => api.post(`/pins/${id}/verify`),
};

export const heatmapApi = {
  density: (bbox: string) => api.get(`/heatmap/?bbox=${bbox}`),
  speed: (bbox: string) => api.get(`/heatmap/speed?bbox=${bbox}`),
};

export const edgesApi = {
  stats: (bbox: string) => api.get(`/edges/stats?bbox=${bbox}`),
  get: (id: number) => api.get(`/edges/${id}`),
};

export const userApi = {
  preferences: (prefs: object) => api.put('/user/preferences', prefs),
  export: () => api.post('/user/export'),
  deleteData: () => api.delete('/user/data'),
  points: () => api.get('/user/points'),
  recentPoints: () => api.get('/user/points/recent'),
  profile: () => api.get('/user/profile'),
  badges: () => api.get('/user/badges'),
};

export const leaderboardApi = {
  list: (period = 'all', limit = 20) => api.get(`/leaderboard/?period=${period}&limit=${limit}`),
  me: () => api.get('/leaderboard/me'),
};

export const shortcutsApi = {
  list: (bbox: string) => api.get(`/shortcuts/?bbox=${bbox}`),
  create: (data: { geometry: object; name: string; time_saved_s: number }) => api.post('/shortcuts/', data),
  validate: (id: string) => api.post(`/shortcuts/${id}/validate`),
  delete: (id: string) => api.delete(`/shortcuts/${id}`),
};

export const discoveredRoutesApi = {
  find: (orig_lat: number, orig_lon: number, dest_lat: number, dest_lon: number) =>
    api.get(`/discovered-routes/?orig_lat=${orig_lat}&orig_lon=${orig_lon}&dest_lat=${dest_lat}&dest_lon=${dest_lon}`),
  bbox: (bbox: string) => api.get(`/discovered-routes/bbox?bbox=${bbox}`),
  get: (id: string) => api.get(`/discovered-routes/${id}`),
  endorse: (id: string) => api.post(`/discovered-routes/${id}/endorse`),
};

export default api;
