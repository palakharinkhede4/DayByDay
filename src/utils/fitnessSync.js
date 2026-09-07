/**
 * DayByDay Cross-Platform Fitness & Health Sync Gateway
 * Bridges Android OS Step Sensor / Activity Recognition and iOS Web App / Web Health Import.
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
    // Web / iOS Safari PWA
    return true;
  } catch (err) {
    console.warn('Check health permission error:', err);
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
        if (response === 'granted') {
          return true;
        }
        return false;
      } catch {
        return true;
      }
    }

    return true;
  } catch (err) {
    console.warn('Request health permission error:', err);
    return false;
  }
};

export const importDeviceHealthStats = async () => {
  try {
    // 1. Native Android Hardware Step Counter via Capacitor Plugin
    if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.FitnessSync) {
      const stats = await window.Capacitor.Plugins.FitnessSync.getFitnessStats();
      if (stats && stats.success) {
        const payload = {
          steps: Math.max(0, Number(stats.steps) || 0),
          calories: Number(stats.calories) || Math.round((Number(stats.steps) || 0) * 0.04),
          distanceKm: Number(stats.distanceKm) || Math.round((Number(stats.steps) || 0) * 0.000762 * 100) / 100,
          activeMinutes: Number(stats.activeMinutes) || Math.round((Number(stats.steps) || 0) / 100),
          source: stats.source || 'android_step_counter',
          syncedAt: new Date().toISOString(),
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {}
        return { success: true, ...payload };
      }
    }

    // 2. iOS Web App & Browser Storage (Strictly accurate, no fabricated defaults)
    let lastSaved = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) lastSaved = JSON.parse(raw);
    } catch {}

    const todayDate = new Date().toISOString().slice(0, 10);
    const isToday = lastSaved?.syncedAt?.startsWith(todayDate);
    // Never fabricate fake numbers like 8420. If not yet set, default to 0.
    const currentSteps = isToday && typeof lastSaved?.steps === 'number' ? Math.max(0, lastSaved.steps) : 0;

    const payload = {
      steps: currentSteps,
      calories: Math.round(currentSteps * 0.04),
      distanceKm: Math.round(currentSteps * 0.000762 * 100) / 100,
      activeMinutes: Math.round(currentSteps / 100),
      source: isToday && lastSaved?.source ? lastSaved.source : 'apple_health',
      syncedAt: isToday && lastSaved?.syncedAt ? lastSaved.syncedAt : new Date().toISOString(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}

    return { success: true, ...payload };
  } catch (err) {
    console.warn('Health import failed:', err);
    return {
      success: false,
      error: err.message || 'Could not access system health data',
    };
  }
};

/**
 * Manually update steps from Apple Health or custom input (convenient for iOS web app)
 */
export const updateCustomHealthStats = (customSteps) => {
  const steps = Math.max(0, Math.round(Number(customSteps) || 0));
  const payload = {
    steps,
    calories: Math.round(steps * 0.04),
    distanceKm: Math.round(steps * 0.000762 * 100) / 100,
    activeMinutes: Math.round(steps / 100),
    source: 'apple_health',
    syncedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
  return payload;
};

/**
 * Automatically applies imported steps & calories to matching habits and pod goals
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
  if (!healthData || typeof healthData.steps !== 'number') return null;

  const steps = Math.max(0, Math.round(healthData.steps));
  let updatedHabitsCount = 0;
  let updatedGoalsCount = 0;

  // 1. Sync matching individual habits only if value actually changed
  for (const h of habits) {
    const unitLower = (h.unit || '').toLowerCase();
    const nameLower = (h.name || '').toLowerCase();
    const isStepHabit =
      unitLower === 'steps' ||
      nameLower.includes('step') ||
      nameLower.includes('walk') ||
      nameLower.includes('running');

    if (isStepHabit && typeof onUpdateHabit === 'function') {
      const curVal = h[activeUserId];
      if (curVal !== steps) {
        onUpdateHabit(h.id, activeUserId, steps, true, silent);
        updatedHabitsCount++;
      }
    }
  }

  // 2. Sync matching shared pod goals in Together only if value actually changed
  for (const sg of sharedGoals) {
    const unitLower = (sg.unit || '').toLowerCase();
    const nameLower = (sg.name || '').toLowerCase();
    const isStepGoal = unitLower === 'steps' || nameLower.includes('step') || nameLower.includes('walk');

    if (isStepGoal && typeof onUpdateSharedGoal === 'function') {
      const memberEntry = sg.memberProgress?.[activeUserId];
      const curVal = typeof memberEntry === 'object' ? Number(memberEntry?.value || 0) : Number(memberEntry || 0);
      if (curVal !== steps) {
        onUpdateSharedGoal(sg.id, 0, steps, silent);
        updatedGoalsCount++;
      }
    }
  }

  if (!silent && typeof triggerIslandNotification === 'function') {
    const msg = `Synced ${steps.toLocaleString()} steps from Health App`;
    triggerIslandNotification(msg, 'check');
  }

  return {
    success: true,
    steps,
    updatedHabitsCount,
    updatedGoalsCount,
  };
};
