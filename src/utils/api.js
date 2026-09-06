// DuoTrack Remote Sync Client for Vercel Cloud

export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  const customUrl = localStorage.getItem('duotrack_server_url');
  if (customUrl && customUrl.trim()) {
    return customUrl.trim().replace(/\/$/, '');
  }
  // When running on web / Vercel
  if (window.location.protocol.startsWith('http') && !window.location.hostname.includes('localhost')) {
    return window.location.origin;
  }
  return ''; // Relative path for localhost or same-origin
};

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
      const data = await res.json();
      return { ok: true, latency, message: data.message || 'Connected to Vercel API' };
    }
    return { ok: false, message: `Server responded with HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err.name === 'AbortError' ? 'Connection timed out' : 'Could not reach server' };
  }
};

export const fetchRemotePod = async (code) => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.protocol === 'capacitor:')) {
    // No remote URL configured on native app yet
    return null;
  }
  try {
    const res = await fetch(`${baseUrl}/api/pod?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
      if (res.status === 404) return { notFound: true };
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('Sync fetch skipped (offline or server not reachable):', err.message);
    return null;
  }
};

export const pushHabitUpdate = async (podCode, userId, habitId, value) => {
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
    return await res.json();
  } catch (err) {
    console.warn('Push update skipped (offline):', err.message);
    return null;
  }
};

export const pushFullSync = async (podCode, userId, podInfo, habits) => {
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
    return await res.json();
  } catch (err) {
    return null;
  }
};
