// DayByDay Remote Sync Client & Offline-First API Gateway
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const DEFAULT_API_URL = 'https://day-by-day-palak-2599.vercel.app';

export function formatErrorMessage(err, fallback = 'An unexpected error occurred') {
  if (!err) return fallback;
  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err.data) {
    if (typeof err.data === 'string') raw = err.data;
    else if (typeof err.data.error === 'string') raw = err.data.error;
    else if (typeof err.data.message === 'string') raw = err.data.message;
  } else if (typeof err.error === 'string') {
    raw = err.error;
  } else if (err.error && typeof err.error.message === 'string') {
    raw = err.error.message;
  } else if (typeof err.message === 'string') {
    raw = err.message;
  } else {
    try {
      raw = JSON.stringify(err);
    } catch {}
  }

  if (!raw || raw.trim() === '[object Object]' || raw.trim() === '{}') {
    return fallback;
  }

  // ZERO-SECRET LEAK GUARANTEE: Never display database URLs, credentials, tokens, or raw technical constructor errors to users
  const lower = raw.toLowerCase();
  if (
    lower.includes('postgres') ||
    lower.includes('neon.tech') ||
    lower.includes('npg_') ||
    lower.includes('failed to construct') ||
    lower.includes('request cannot be constructed') ||
    lower.includes('credentials') ||
    lower.includes('password') && lower.includes('@') ||
    raw.includes('://')
  ) {
    return 'Unable to connect to cloud server. Please check your internet connection.';
  }

  return raw.trim();
}

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

  // 1. Native mobile apps (Android/iOS) ALWAYS use DEFAULT_API_URL
  if (isNativePlatform()) {
    return DEFAULT_API_URL;
  }

  // 2. Custom override from localStorage (strictly validate: MUST be http/https, never database/credentials)
  const customUrl = localStorage.getItem('daybyday_server_url') || localStorage.getItem('duotrack_server_url');
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    const clean = customUrl.trim().replace(/\/$/, '');
    if ((clean.startsWith('http://') || clean.startsWith('https://')) && !clean.includes('@') && !clean.toLowerCase().includes('postgres')) {
      return clean;
    }
  }

  // 3. Web build environment variable (strictly validate: MUST be http/https, never database/credentials)
  const envUrl = import.meta?.env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const clean = envUrl.trim().replace(/\/$/, '');
    if ((clean.startsWith('http://') || clean.startsWith('https://')) && !clean.includes('@') && !clean.toLowerCase().includes('postgres')) {
      return clean;
    }
  }

  // 4. In web browser on same domain
  if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    return window.location.origin;
  }

  return DEFAULT_API_URL;
};

export const setApiBaseUrl = (url) => {
  if (typeof window === 'undefined') return;
  const clean = (url || '').trim().replace(/\/$/, '');
  if (clean && (clean.startsWith('http://') || clean.startsWith('https://')) && !clean.includes('@') && !clean.toLowerCase().includes('postgres')) {
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
  // Guarantee: Ensure target URL is ALWAYS a valid HTTP/HTTPS endpoint and never a database connection string
  let targetUrl = url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http') || targetUrl.includes('@') || targetUrl.toLowerCase().includes('postgres')) {
    const endpoint = (typeof targetUrl === 'string' && targetUrl.includes('/api/')) ? '/api/' + targetUrl.split('/api/')[1] : '/api/user';
    targetUrl = DEFAULT_API_URL + endpoint;
  }

  if (isNativePlatform()) {
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
        url: targetUrl,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(options.headers || {}),
        },
        data: method !== 'GET' ? data : undefined,
      });

      const isOk = response.status >= 200 && response.status < 300;
      let responseData = response.data;
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch {}
      }

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
      // If CapacitorHttp caught an HTTP error response (e.g. 401 Unauthorized), it contains status & data!
      if (nativeErr && (nativeErr.status || nativeErr.data)) {
        const status = Number(nativeErr.status) || 400;
        let responseData = nativeErr.data || nativeErr;
        if (typeof responseData === 'string') {
          try {
            responseData = JSON.parse(responseData);
          } catch {}
        }
        return {
          ok: false,
          status,
          statusText: String(status),
          headers: { get: () => null },
          json: async () => responseData,
          text: async () => (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)),
        };
      }
      console.warn('Native CapacitorHttp notice, falling back to fetch:', formatErrorMessage(nativeErr));
    }
  }

  return fetch(targetUrl, options);
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
    try {
      const text = await res.text();
      if (text.trim().startsWith('<') || text.includes('<!DOCTYPE')) {
        throw new Error('Cloud service is currently unreachable. Please check your internet connection.');
      }
      return JSON.parse(text);
    } catch (e) {
      if (e.message && e.message.includes('unreachable')) throw e;
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
    console.warn('Push full sync notice:', err.message);
    return null;
  }
};

export const registerUserRemote = async (username, password, securityQuestion, securityAnswer, displayName) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'register',
        username,
        password,
        securityQuestion,
        securityAnswer,
        displayName: displayName || username,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'Failed to create account'));
    return data;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Failed to create account'));
  }
};

export const loginUserRemote = async (username, password) => {
  if (!hasRemoteBackend()) return null;
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
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'Invalid username or password'));
    return data;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Sign in failed. Check username and password.'));
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
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'No security question found for this account'));
    return data;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Account not found'));
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
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'Failed to reset password'));
    return data;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Failed to reset password. Check your security answer.'));
  }
};

export const syncHabitsRemote = async (userId, habits, preferences) => {
  if (!hasRemoteBackend() || !userId) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_habits',
        userId,
        habits,
        preferences,
      }),
    });
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch {
    return null;
  }
};

export const syncUserHabitsRemote = syncHabitsRemote;

export const fetchUserRemote = async (username) => {
  if (!hasRemoteBackend() || !username) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user?username=${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch {
    return null;
  }
};

export const syncPreferencesRemote = async (userId, preferences) => {
  if (!hasRemoteBackend() || !userId) return null;
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
  } catch {
    return null;
  }
};

export const pairPartnerRemote = async (userId, partnerCode) => {
  if (!hasRemoteBackend() || !userId) return null;
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
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'Failed to connect with partner'));
    return data;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Failed to connect with partner'));
  }
};

export const unpairPartnerRemote = async (userId) => {
  if (!hasRemoteBackend() || !userId) return null;
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
    return res.ok;
  } catch {
    return false;
  }
};

export const deleteHabitRemote = async (userId, habitId) => {
  if (!hasRemoteBackend() || !userId || !habitId) return null;
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
    return res.ok;
  } catch {
    return false;
  }
};

export const deleteAccountRemote = async (userId, username) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_account',
        userId,
        username,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'Failed to permanently delete account'));
    return data;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Failed to permanently delete account'));
  }
};

// ==========================================
// GROUP PODS (Up to 10 members)
// ==========================================

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
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'Failed to create group pod'));
    return data?.pod || null;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Failed to create group pod'));
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
    if (!res.ok) throw new Error(formatErrorMessage(data?.error || data, 'Failed to join group pod'));
    return data?.pod || null;
  } catch (err) {
    throw new Error(formatErrorMessage(err, 'Failed to join group pod'));
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

export const addGroupGoalRemote = async (podCode, goal) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add_group_goal',
        podCode,
        goal,
      }),
    });
    if (!res.ok) return null;
    const data = await parseJsonSafe(res);
    return data?.pod || null;
  } catch {
    return null;
  }
};

export const updateGroupGoalRemote = async (podCode, goalId, delta, userId, value, completed) => {
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
        userId,
        value,
        completed,
      }),
    });
    if (!res.ok) return null;
    const data = await parseJsonSafe(res);
    return data?.pod || null;
  } catch {
    return null;
  }
};

export const deleteGroupGoalRemote = async (podCode, goalId) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_group_goal',
        podCode,
        goalId,
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
  if (!hasRemoteBackend()) return false;
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

// ==========================================
// CHEERS & ENCOURAGEMENT SERVICES
// ==========================================

export const sendCheerRemote = async ({ toUserId, fromUserId, fromUsername, fromName, fromAvatar, podCode, message }) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_cheer',
        toUserId,
        fromUserId,
        fromUsername,
        fromName,
        fromAvatar,
        podCode,
        message,
      }),
    });
    const data = await parseJsonSafe(res);
    return data;
  } catch {
    return null;
  }
};

export const fetchCheersRemote = async (userId, podCode) => {
  if (!hasRemoteBackend()) return [];
  const baseUrl = getApiBaseUrl();
  try {
    const res = await apiFetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_cheers',
        userId,
        podCode,
      }),
    });
    const data = await parseJsonSafe(res);
    return data?.cheers || [];
  } catch {
    return [];
  }
};
