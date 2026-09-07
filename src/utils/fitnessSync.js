/**
 * DayByDay Cross-Platform Fitness & Health Sync Gateway
 * Bridges Android OS Step Sensor / Activity Recognition and iOS Web App / Apple Health & Shortcuts.
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
 * e.g. ?health_sync=1&steps=49&water=1500&sleep=7.5&calories=240&distance=0.8&active=25
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
      if (getVal('water')) payload.water = Math.max(0, parseInt(getVal('water'), 10) || 0);
      if (getVal('sleep')) payload.sleep = Math.max(0, parseFloat(getVal('sleep')) || 0);
      if (getVal('calories')) payload.calories = Math.max(0, parseInt(getVal('calories'), 10) || 0);
      if (getVal('distance')) payload.distanceKm = Math.max(0, parseFloat(getVal('distance')) || 0);
      if (getVal('active') || getVal('workout')) {
        payload.activeMinutes = Math.max(0, parseInt(getVal('active') || getVal('workout'), 10) || 0);
      }
      if (getVal('meditation') || getVal('mindful')) {
        payload.mindfulMinutes = Math.max(0, parseInt(getVal('meditation') || getVal('mindful'), 10) || 0);
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
 * Imports device health & fitness statistics from:
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
        const stored = getStoredHealthData() || {};
        const payload = {
          steps,
          calories: Number(stats.calories) || Math.round(steps * 0.04),
          distanceKm: Number(stats.distanceKm) || Math.round(steps * 0.000762 * 100) / 100,
          activeMinutes: Number(stats.activeMinutes) || Math.round(steps / 100),
          water: Number(stored.water) || 0,
          waterGlasses: Number(stored.waterGlasses) || Math.round((Number(stored.water) || 0) / 250),
          sleep: Number(stored.sleep) || 0,
          mindfulMinutes: Number(stored.mindfulMinutes) || 0,
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
    const userIdOrCode = user?.id || user?.secretCode || user?.username;
    if (userIdOrCode) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const url = `/api/user?action=get_health&userId=${encodeURIComponent(user?.id || '')}&code=${encodeURIComponent(user?.secretCode || '')}`;
        const resp = await fetch(url, { signal: controller.signal });
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
    const isToday = lastSaved?.syncedAt?.startsWith(todayDate);

    const steps = isToday && typeof lastSaved?.steps === 'number' ? Math.max(0, lastSaved.steps) : (Number(lastSaved?.steps) || 0);
    const calories = Number(lastSaved?.calories) || Math.round(steps * 0.04);
    const distanceKm = Number(lastSaved?.distanceKm) || Math.round(steps * 0.000762 * 100) / 100;
    const activeMinutes = Number(lastSaved?.activeMinutes) || Math.round(steps / 100);
    const water = Number(lastSaved?.water) || 0;
    const waterGlasses = Number(lastSaved?.waterGlasses) || Math.round(water / 250);
    const sleep = Number(lastSaved?.sleep) || 0;
    const mindfulMinutes = Number(lastSaved?.mindfulMinutes) || 0;

    const payload = {
      steps,
      calories,
      distanceKm,
      activeMinutes,
      water,
      waterGlasses,
      sleep,
      mindfulMinutes,
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
      activeMinutes: Math.round(steps / 100),
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
      activeMinutes: input.activeMinutes !== undefined ? Number(input.activeMinutes) : (current.activeMinutes || Math.round(steps / 100)),
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
 * Helper to match and resolve target value for any health metric
 */
function resolveMetricValue(metricType, habitOrGoal, healthData) {
  const unitLower = (habitOrGoal.unit || '').toLowerCase();

  switch (metricType) {
    case 'steps':
      return typeof healthData.steps === 'number' ? Math.max(0, Math.round(healthData.steps)) : null;

    case 'calories':
      return typeof healthData.calories === 'number' ? Math.max(0, Math.round(healthData.calories)) : null;

    case 'distance':
      return typeof healthData.distanceKm === 'number' ? Math.max(0, Math.round(healthData.distanceKm * 10) / 10) : null;

    case 'workouts':
      return typeof healthData.activeMinutes === 'number' ? Math.max(0, Math.round(healthData.activeMinutes)) : null;

    case 'sleep':
      return typeof healthData.sleep === 'number' ? Math.max(0, Math.round(healthData.sleep * 10) / 10) : null;

    case 'water': {
      if (typeof healthData.water !== 'number' && typeof healthData.waterGlasses !== 'number') return null;
      const totalMl = Number(healthData.water) || ((Number(healthData.waterGlasses) || 0) * 250);
      if (unitLower.includes('glass') || unitLower.includes('cup')) {
        return Math.max(0, healthData.waterGlasses || Math.round(totalMl / 250));
      }
      if (unitLower === 'l' || unitLower.includes('liter')) {
        return Math.max(0, Math.round((totalMl / 1000) * 10) / 10);
      }
      return Math.max(0, Math.round(totalMl));
    }

    case 'meditation':
      return typeof healthData.mindfulMinutes === 'number' ? Math.max(0, Math.round(healthData.mindfulMinutes)) : null;

    default:
      return null;
  }
}

/**
 * Determines which health metric a habit or Together shared goal corresponds to
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

  // 2. Water / Hydration
  if (
    idLower === 'water' ||
    unitLower.includes('glass') ||
    unitLower.includes('cup') ||
    unitLower === 'ml' ||
    unitLower === 'l' ||
    unitLower.includes('liter') ||
    nameLower.includes('water') ||
    nameLower.includes('hydrat') ||
    nameLower.includes('drink')
  ) {
    return 'water';
  }

  // 3. Sleep
  if (
    idLower === 'sleep' ||
    unitLower.includes('hour') ||
    unitLower === 'hrs' ||
    unitLower === 'hr' ||
    unitLower === 'h' ||
    nameLower.includes('sleep') ||
    nameLower.includes('bed') ||
    nameLower.includes('rest')
  ) {
    return 'sleep';
  }

  // 4. Workouts / Exercise
  if (
    idLower === 'workouts' ||
    idLower.includes('exercise') ||
    ((unitLower.includes('min') || unitLower === 'm') &&
      (nameLower.includes('workout') ||
        nameLower.includes('exercise') ||
        nameLower.includes('gym') ||
        nameLower.includes('active') ||
        nameLower.includes('fitness')))
  ) {
    return 'workouts';
  }

  // 5. Active Calories
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

  // 6. Distance
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

  // 7. Meditation / Mindfulness
  if (
    idLower === 'meditation' ||
    nameLower.includes('meditat') ||
    nameLower.includes('mindful') ||
    nameLower.includes('breathe')
  ) {
    return 'meditation';
  }

  return null;
}

/**
 * Automatically applies imported health & fitness data (Steps, Water, Sleep, Workouts, Calories, Distance, Mindful)
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
    if (healthData.water) summaryItems.push(`${healthData.water}ml water`);
    if (healthData.sleep) summaryItems.push(`${healthData.sleep}h sleep`);
    const summaryMsg = summaryItems.length > 0
      ? `Synced: ${summaryItems.slice(0, 3).join(', ')}`
      : 'Synced health & fitness data';
    triggerIslandNotification(summaryMsg, 'check');
  }

  return {
    success: true,
    healthData,
    updatedHabitsCount,
    updatedGoalsCount,
  };
};
