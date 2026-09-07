/**
 * DayByDay Cross-Platform Fitness & Health Sync Gateway
 * Bridges Android OS Step Sensor / Activity Recognition and iOS Web App / Apple Health & Shortcuts.
 * Strictly focuses on 3 core fitness metrics: Steps, Active Calories, and Distance.
 */

const STORAGE_KEY = 'daybyday_health_sync_data';
const ENABLED_KEY = 'daybyday_health_sync_enabled';

export const isHealthSyncEnabled = () => {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setHealthSyncEnabled = (enabled) => {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {}
};

export const getStoredHealthData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const checkHealthPermission = async () => {
  try {
    if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.FitnessSync) {
      const res = await window.Capacitor.Plugins.FitnessSync.checkFitnessPermissions();
      return Boolean(res?.granted);
    }
    return true;
  } catch (err) {
    console.warn('Check health permission notice:', err);
    return false;
  }
};

export const requestHealthPermission = async () => {
  try {
    if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.FitnessSync) {
      const res = await window.Capacitor.Plugins.FitnessSync.requestFitnessPermissions();
      return Boolean(res?.granted);
    }

    // iOS Web App / Safari Motion Sensor Permission (iOS 13+)
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEvent.requestPermission();
        return response === 'granted';
      } catch {
        return true;
      }
    }

    return true;
  } catch (err) {
    console.warn('Request health permission notice:', err);
    return false;
  }
};

/**
 * Parses URL query parameters or hash fragments passed from iOS Shortcuts, Apple Health automations, or webhooks.
 * e.g. ?health_sync=1&steps=10240&calories=410&distance=7.8
 */
export const ingestUrlHealthData = () => {
  if (typeof window === 'undefined') return null;
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const hash = (window.location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);

    const hasParam =
      searchParams.has('health_sync') ||
      searchParams.has('steps') ||
      searchParams.has('apple_health') ||
      hashParams.has('health_sync') ||
      hashParams.has('steps') ||
      hashParams.has('apple_health');

    if (!hasParam) return null;

    let payload = {};
    if (searchParams.has('apple_health') || hashParams.has('apple_health')) {
      const raw = searchParams.get('apple_health') || hashParams.get('apple_health');
      payload = JSON.parse(decodeURIComponent(raw));
    } else {
      const getVal = (key) => searchParams.get(key) || hashParams.get(key);
      if (getVal('steps')) payload.steps = Math.max(0, parseInt(getVal('steps'), 10) || 0);
      if (getVal('calories')) payload.calories = Math.max(0, parseInt(getVal('calories'), 10) || 0);
      if (getVal('distance') || getVal('distanceKm')) {
        payload.distanceKm = Math.max(0, parseFloat(getVal('distance') || getVal('distanceKm')) || 0);
      }
    }

    if (payload.steps !== undefined && payload.steps !== null) {
      if (payload.calories === undefined) {
        payload.calories = Math.round(payload.steps * 0.04);
      }
      if (payload.distanceKm === undefined) {
        payload.distanceKm = Math.round(payload.steps * 0.000762 * 100) / 100;
      }
    }

    if (Object.keys(payload).length > 0) {
      const stored = getStoredHealthData() || {};
      const merged = {
        ...stored,
        ...payload,
        source: 'apple_health',
        syncedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

      // Clean the URL silently without triggering page reload
      try {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
      } catch {}

      return merged;
    }
  } catch (err) {
    console.warn('Notice ingesting health params from URL:', err);
  }
  return null;
};

/**
 * Imports device fitness statistics (Steps, Calories, Distance) from:
 * 1. Native Android Hardware Step Counter (Capacitor)
 * 2. URL parameters from iOS Apple Shortcuts
 * 3. Remote cloud health sync (from iOS Shortcuts or Webhooks posted to /api/user)
 * 4. Local storage cache calibrated with today's activity
 */
export const importDeviceHealthStats = async (user = null) => {
  try {
    // 1. Ingest any URL parameters from Apple Shortcuts first
    const urlPayload = ingestUrlHealthData();

    // 2. Native Android Hardware Step Counter via Capacitor Plugin
    if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.FitnessSync) {
      const stats = await window.Capacitor.Plugins.FitnessSync.getFitnessStats();
      if (stats && stats.success) {
        const steps = Math.max(0, Number(stats.steps) || 0);
        const payload = {
          steps,
          calories: Number(stats.calories) || Math.round(steps * 0.04),
          distanceKm: Number(stats.distanceKm) || Math.round(steps * 0.000762 * 100) / 100,
          source: stats.source || 'android_step_counter',
          syncedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {}
        return { success: true, ...payload };
      }
    }

    // 3. iOS Web App & Browser Storage
    let lastSaved = urlPayload || getStoredHealthData() || {};

    // Check remote cloud health sync if logged in (e.g. iOS Shortcut pushed data to backend)
    const userCode = user?.secretCode || user?.secret_code || '';
    const userIdVal = user?.id || '';
    const userNameVal = user?.username || '';
    const userIdOrCode = userIdVal || userCode || userNameVal;

    if (userIdOrCode) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const cacheBuster = Date.now();
        const url = `/api/user?action=get_health&userId=${encodeURIComponent(userIdVal)}&code=${encodeURIComponent(userCode)}&username=${encodeURIComponent(userNameVal)}&_t=${cacheBuster}`;
        const resp = await fetch(url, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache',
          },
        });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const json = await resp.json();
          if (json?.success && json?.healthData) {
            lastSaved = { ...lastSaved, ...json.healthData };
          }
        }
      } catch {}
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const isToday = lastSaved?.syncedAt ? lastSaved.syncedAt.startsWith(todayDate) : true;

    const steps = typeof lastSaved?.steps === 'number' ? Math.max(0, lastSaved.steps) : (Number(lastSaved?.steps) || 0);
    const calories = Number(lastSaved?.calories) || Math.round(steps * 0.04);
    const distanceKm = Number(lastSaved?.distanceKm) || Math.round(steps * 0.000762 * 100) / 100;

    const payload = {
      steps,
      calories,
      distanceKm,
      source: isToday && lastSaved?.source ? lastSaved.source : 'apple_health',
      syncedAt: isToday && lastSaved?.syncedAt ? lastSaved.syncedAt : new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}

    return { success: true, ...payload };
  } catch (err) {
    console.warn('Health import notice:', err);
    return {
      success: false,
      error: err.message || 'Could not access system health data',
    };
  }
};

/**
 * Updates custom health stats directly (accepts number for steps or full health object)
 */
export const updateCustomHealthStats = (input) => {
  const current = getStoredHealthData() || {};
  let payload = {};

  if (typeof input === 'number') {
    const steps = Math.max(0, Math.round(input));
    payload = {
      ...current,
      steps,
      calories: Math.round(steps * 0.04),
      distanceKm: Math.round(steps * 0.000762 * 100) / 100,
      source: 'apple_health',
      syncedAt: new Date().toISOString(),
    };
  } else if (input && typeof input === 'object') {
    const steps = input.steps !== undefined ? Math.max(0, Math.round(Number(input.steps) || 0)) : (current.steps || 0);
    payload = {
      ...current,
      ...input,
      steps,
      calories: input.calories !== undefined ? Number(input.calories) : (current.calories || Math.round(steps * 0.04)),
      distanceKm: input.distanceKm !== undefined ? Number(input.distanceKm) : (current.distanceKm || Math.round(steps * 0.000762 * 100) / 100),
      source: input.source || 'apple_health',
      syncedAt: new Date().toISOString(),
    };
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  return payload;
};

/**
 * Helper to match and resolve target value for fitness metrics (steps, calories, distance)
 */
function resolveMetricValue(metricType, habitOrGoal, healthData) {
  switch (metricType) {
    case 'steps':
      return typeof healthData.steps === 'number' ? Math.max(0, Math.round(healthData.steps)) : null;

    case 'calories':
      return typeof healthData.calories === 'number' ? Math.max(0, Math.round(healthData.calories)) : null;

    case 'distance':
      return typeof healthData.distanceKm === 'number' ? Math.max(0, Math.round(healthData.distanceKm * 10) / 10) : null;

    default:
      return null;
  }
}

/**
 * Determines which fitness metric a habit or Together shared goal corresponds to:
 * ONLY steps, calories, or distance.
 */
function identifyHealthMetric(item) {
  const idLower = (item.id || '').toLowerCase();
  const unitLower = (item.unit || '').toLowerCase();
  const nameLower = (item.name || '').toLowerCase();

  // 1. Steps
  if (
    idLower === 'steps' ||
    unitLower === 'steps' ||
    unitLower === 'step' ||
    nameLower.includes('step') ||
    nameLower.includes('walk') ||
    nameLower.includes('running')
  ) {
    return 'steps';
  }

  // 2. Calories
  if (
    idLower.includes('calorie') ||
    unitLower === 'kcal' ||
    unitLower.includes('cal') ||
    nameLower.includes('calorie') ||
    nameLower.includes('burn') ||
    nameLower.includes('energy')
  ) {
    return 'calories';
  }

  // 3. Distance
  if (
    idLower.includes('distance') ||
    unitLower === 'km' ||
    unitLower.includes('kilo') ||
    unitLower === 'miles' ||
    unitLower === 'mi' ||
    nameLower.includes('distance')
  ) {
    return 'distance';
  }

  return null;
}

/**
 * Automatically applies imported fitness data (Steps, Calories, Distance)
 * to any matching habits and Together pod goals.
 */
export const syncHealthDataToHabitsAndPod = async ({
  healthData,
  habits = [],
  sharedGoals = [],
  activeUserId = 'user1',
  onUpdateHabit,
  onUpdateSharedGoal,
  triggerIslandNotification,
  silent = false,
}) => {
  if (!healthData || typeof healthData !== 'object') return null;

  let updatedHabitsCount = 0;
  let updatedGoalsCount = 0;
  const summaryItems = [];

  // 1. Sync matching individual habits only if value actually changed
  for (const h of habits) {
    const metric = identifyHealthMetric(h);
    if (!metric) continue;

    const targetVal = resolveMetricValue(metric, h, healthData);
    if (targetVal === null || targetVal === undefined) continue;

    const curVal = h[activeUserId];
    if (curVal !== targetVal && typeof onUpdateHabit === 'function') {
      onUpdateHabit(h.id, activeUserId, targetVal, true, silent);
      updatedHabitsCount++;
    }
  }

  // 2. Sync matching shared pod goals in Together only if value actually changed
  for (const sg of sharedGoals) {
    const metric = identifyHealthMetric(sg);
    if (!metric) continue;

    const targetVal = resolveMetricValue(metric, sg, healthData);
    if (targetVal === null || targetVal === undefined) continue;

    const memberEntry = sg.memberProgress?.[activeUserId];
    const curVal = typeof memberEntry === 'object' ? Number(memberEntry?.value || 0) : Number(memberEntry || 0);

    if (curVal !== targetVal && typeof onUpdateSharedGoal === 'function') {
      onUpdateSharedGoal(sg.id, 0, targetVal, silent);
      updatedGoalsCount++;
    }
  }

  if (!silent && typeof triggerIslandNotification === 'function') {
    if (healthData.steps) summaryItems.push(`${healthData.steps.toLocaleString()} steps`);
    if (healthData.calories) summaryItems.push(`${healthData.calories} kcal`);
    if (healthData.distanceKm) summaryItems.push(`${healthData.distanceKm} km`);
    const summaryMsg = summaryItems.length > 0
      ? `Synced: ${summaryItems.join(', ')}`
      : 'Synced fitness data';
    triggerIslandNotification(summaryMsg, 'check');
  }

  return {
    success: true,
    healthData,
    updatedHabitsCount,
    updatedGoalsCount,
  };
};
