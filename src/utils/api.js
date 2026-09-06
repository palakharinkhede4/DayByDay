// DayByDay Remote Sync Client & Offline-First API Gateway
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const DEFAULT_API_URL = 'https://day-by-day-palak-2599.vercel.app';

export const isNativePlatform = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    Capacitor?.isNativePlatform?.() ||
    window.Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return DEFAULT_API_URL;
  const customUrl = localStorage.getItem('daybyday_server_url') || localStorage.getItem('duotrack_server_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/$/, '');
  }
  if (import.meta?.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/$/, '');
  }
  // When running on public web / Vercel with same origin
  if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return window.location.origin;
  }
  // Default cloud API for native apps (Android/iOS) and standalone clients
  return DEFAULT_API_URL;
};

export const setApiBaseUrl = (url) => {
  if (typeof window === 'undefined') return;
  const clean = (url || '').trim().replace(/\/$/, '');
  if (clean) {
    localStorage.setItem('daybyday_server_url', clean);
  } else {
    localStorage.removeItem('daybyday_server_url');
    localStorage.removeItem('duotrack_server_url');
  }
};

export const clearApiBaseUrl = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('daybyday_server_url');
  localStorage.removeItem('duotrack_server_url');
};

export const hasRemoteBackend = () => {
  const baseUrl = getApiBaseUrl();
  return Boolean(baseUrl && baseUrl.trim());
};

// Unified fetch client: Uses native Android/iOS OkHttp on mobile to completely bypass WebView CORS
export async function apiFetch(url, options = {}) {
  if (Capacitor?.isNativePlatform?.()) {
    const method = (options.method || 'GET').toUpperCase();
    let data = options.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // preserve as string
      }
    }

    try {
      const response = await CapacitorHttp.request({
        url,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers || {}),
        },
        data: method !== 'GET' ? data : undefined,
      });

      const isOk = response.status >= 200 && response.status < 300;
      const responseData = response.data;

      return {
        ok: isOk,
        status: response.status,
        statusText: String(response.status),
        headers: {
          get: (name) => {
            const key = Object.keys(response.headers || {}).find(
              (k) => k.toLowerCase() === (name || '').toLowerCase()
            );
            return key ? response.headers[key] : null;
          },
        },
        json: async () => responseData,
        text: async () => (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)),
      };
    } catch (nativeErr) {
      console.warn('Native CapacitorHttp notice, falling back to fetch:', nativeErr.message);
    }
  }

  return fetch(url, options);
}

// Safe JSON parser to handle both native responses and standard fetch responses
async function parseJsonSafe(res) {
  if (!res) return null;
  if (typeof res.json === 'function') {
    try {
      const data = await res.json();
      if (data && typeof data === 'object') return data;
    } catch { }
  }

  if (typeof res.text === 'function') {
    const text = await res.text();
    if (text.trim().startsWith('<') || text.includes('<!DOCTYPE')) {
      throw new Error('Cloud service is currently unreachable. Please check your internet connection.');
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid response from cloud service');
    }
  }
  return null;
}

export const checkApiHealth = async (url) => {
  const targetUrl = url ? url.trim().replace(/\/$/, '') : getApiBaseUrl();
  if (!targetUrl) return { ok: false, message: 'No server URL configured' };
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await apiFetch(`${targetUrl}/api/pod?ping=true`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - start;
    if (res.ok) {
      const data = await parseJsonSafe(res);
      return { ok: true, latency, message: data.message || 'Connected to DayByDay Cloud' };
    }
    return { ok: false, message: `Server responded with HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err.name === 'AbortError' ? 'Connection timed out' : 'Could not reach server' };
  }
};

export const fetchRemotePod = async (code) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/pod?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
      if (res.status === 404) return { notFound: true };
      return null;
    }
    return await parseJsonSafe(res);
  } catch (err) {
    console.warn('Pod fetch offline fallback:', err.message);
    return null;
  }
};

export const pushHabitUpdate = async (podCode, userId, habitId, value) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_habit',
        podCode,
        userId,
        habitId,
        value,
      }),
    });
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    console.warn('Push update skipped (offline):', err.message);
    return null;
  }
};

export const pushFullSync = async (podCode, userId, podInfo, habits) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/pod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_all',
        podCode,
        userId,
        podInfo,
        habits,
      }),
    });
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    return null;
  }
};

// USER ACCOUNTS & AUTHENTICATION
export const registerUserRemote = async (username, password, displayName, avatar, securityQuestion, securityAnswer) => {
  if (!hasRemoteBackend()) {
    // Offline local first
    return null;
  }
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        username,
        password,
        displayName,
        avatar,
        securityQuestion,
        securityAnswer,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to register');
    }
    return data;
  } catch (err) {
    console.warn('User register network notice:', err.message);
    throw err;
  }
};

export const loginUserRemote = async (username, password) => {
  if (!hasRemoteBackend()) {
    return null;
  }
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        username,
        password,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data?.error || 'Invalid username or password');
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const getSecurityQuestionRemote = async (username) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_security_question',
        username,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data?.error || 'User not found');
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const resetPasswordRemote = async (username, securityAnswer, newPassword) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reset_password',
        username,
        securityAnswer,
        newPassword,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data?.error || 'Failed to reset password');
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const fetchUserRemote = async (usernameOrCode) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const isCode = usernameOrCode.includes('-');
    const param = isCode ? `code=${encodeURIComponent(usernameOrCode)}` : `username=${encodeURIComponent(usernameOrCode)}`;
    const res = await apiFetch(`${baseUrl}/api/user?${param}`);
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    return null;
  }
};

export const syncUserHabitsRemote = async (userId, habits, preferences = null) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const payload = {
      action: 'sync_habits',
      userId,
      habits,
    };
    if (preferences && typeof preferences === 'object') {
      payload.preferences = preferences;
    }
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    return null;
  }
};

export const syncPreferencesRemote = async (userId, preferences) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_preferences',
        userId,
        preferences,
      }),
    });
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    return null;
  }
};

export const pairPartnerRemote = async (userId, partnerCode) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'pair',
        userId,
        partnerCode,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data?.error || 'Partner not found');
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const unpairPartnerRemote = async (userId) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unpair',
        userId,
      }),
    });
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    return null;
  }
};

export const deleteHabitRemote = async (userId, habitId) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_habit',
        userId,
        habitId,
      }),
    });
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    return null;
  }
};

// GROUP POD ("TOGETHER") APIS
export const createGroupPodRemote = async (userId, name, podCode, sharedGoals) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_group_pod',
        userId,
        name,
        podCode,
        sharedGoals,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data?.error || 'Failed to create group pod');
    return data?.pod || null;
  } catch (err) {
    throw err;
  }
};

export const joinGroupPodRemote = async (userId, podCode) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join_group_pod',
        userId,
        podCode,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(data?.error || 'Failed to join group pod');
    return data?.pod || null;
  } catch (err) {
    throw err;
  }
};

export const getGroupPodRemote = async (podCode) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_group_pod',
        podCode,
      }),
    });
    if (!res.ok) return null;
    const data = await parseJsonSafe(res);
    return data?.pod || null;
  } catch {
    return null;
  }
};

export const updateGroupGoalRemote = async (podCode, goalId, delta) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_group_goal',
        podCode,
        goalId,
        delta,
      }),
    });
    if (!res.ok) return null;
    const data = await parseJsonSafe(res);
    return data?.pod || null;
  } catch {
    return null;
  }
};

export const leaveGroupPodRemote = async (podCode, userId) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'leave_group_pod',
        podCode,
        userId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};
