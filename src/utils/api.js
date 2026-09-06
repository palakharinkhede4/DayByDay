// DayByDay Remote Sync Client & Offline-First API Gateway

export const isNativePlatform = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
};

export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const customUrl = localStorage.getItem('daybyday_server_url') || localStorage.getItem('duotrack_server_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/$/, '');
  }
  if (import.meta?.env?.VITE_API_URL && import.meta.env.VITE_API_URL.trim()) {
    return import.meta.env.VITE_API_URL.trim().replace(/\/$/, '');
  }
  // When running on public web / Vercel
  if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost')) {
    return window.location.origin;
  }
  return '';
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
  if (baseUrl && baseUrl.trim()) return true;
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && !isNativePlatform()) {
    return true;
  }
  return false;
};

// Safe JSON parser to prevent "Unexpected token <, <!doctype" fatal errors
async function parseJsonSafe(res) {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  
  if (text.trim().startsWith('<') || (!contentType.includes('application/json') && text.includes('<!DOCTYPE'))) {
    throw new Error('Server returned an HTML document instead of JSON. Check your backend configuration.');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid server JSON response');
  }
}

export const checkApiHealth = async (url) => {
  const targetUrl = url ? url.trim().replace(/\/$/, '') : getApiBaseUrl();
  if (!targetUrl) return { ok: false, message: 'No server URL configured' };
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${targetUrl}/api/pod?ping=true`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latency = Date.now() - start;
    if (res.ok) {
      const data = await parseJsonSafe(res);
      return { ok: true, latency, message: data.message || 'Connected to Vercel API' };
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
    const res = await fetch(`${baseUrl}/api/pod?code=${encodeURIComponent(code)}`);
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
    const res = await fetch(`${baseUrl}/api/pod`, {
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
    const res = await fetch(`${baseUrl}/api/pod`, {
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
    const res = await fetch(`${baseUrl}/api/user`, {
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
      throw new Error(data.error || 'Failed to register');
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
    const res = await fetch(`${baseUrl}/api/user`, {
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
      throw new Error(data.error || 'Invalid username or password');
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
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_security_question',
        username,
      }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new Error(data.error || 'User not found');
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
    const res = await fetch(`${baseUrl}/api/user`, {
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
      throw new Error(data.error || 'Failed to reset password');
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
    const res = await fetch(`${baseUrl}/api/user?${param}`);
    if (!res.ok) return null;
    return await parseJsonSafe(res);
  } catch (err) {
    return null;
  }
};

export const syncUserHabitsRemote = async (userId, habits) => {
  if (!hasRemoteBackend()) return null;
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/api/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_habits',
        userId,
        habits,
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
    const res = await fetch(`${baseUrl}/api/user`, {
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
      throw new Error(data.error || 'Partner not found');
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
    const res = await fetch(`${baseUrl}/api/user`, {
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
    const res = await fetch(`${baseUrl}/api/user`, {
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
