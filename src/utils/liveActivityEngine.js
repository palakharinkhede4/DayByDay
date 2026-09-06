/**
 * DayByDay Live Activity & Ongoing Updates Engine
 * 
 * Bridges between the React application layer and:
 * 1. Apple ActivityKit (Dynamic Island & Lock Screen Live Activities) via WebKit MessageHandlers
 * 2. Android Live Updates API (Ongoing Progress Notifications) via Capacitor LiveActivityPlugin
 * 3. Modern Web Notifications API (Progress tags and action buttons)
 */

let currentLiveHabitId = null;

export const isLiveActivitySupported = () => {
  // Check Android Capacitor Plugin
  const hasAndroidPlugin = Boolean(
    typeof window !== 'undefined' &&
    window.Capacitor?.Plugins?.LiveActivityPlugin
  );

  // Check iOS WebKit Message Handler
  const hasIOSActivityKit = Boolean(
    typeof window !== 'undefined' &&
    window.webkit?.messageHandlers?.activityKit
  );

  // Check Web Notification API
  const hasWebNotifications = typeof window !== 'undefined' && 'Notification' in window;

  return hasAndroidPlugin || hasIOSActivityKit || hasWebNotifications;
};

export const requestLiveActivityPermission = async () => {
  if (typeof window === 'undefined') return false;

  // On Web / Android Chrome / Safari PWA
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      const status = await Notification.requestPermission();
      return status === 'granted';
    }
    return Notification.permission === 'granted';
  }

  // Native Capacitor container
  if (window.Capacitor?.isNativePlatform?.()) {
    return true;
  }

  return false;
};

/**
 * Dispatches live update payload to native subsystems and in-app listeners
 */
export const startOrUpdateLiveActivity = async ({
  habit,
  userValue = 0,
  targetValue = 1,
  unit = 'times',
  streak = 1,
  partner = null,
  partnerPercent = 0,
  podSyncPercent = 0,
  isCompleted = false,
  statusMessage = '',
}) => {
  if (!habit) return;

  currentLiveHabitId = habit.id;

  const payload = {
    habitId: habit.id,
    habitName: habit.name,
    category: habit.category || 'Daily',
    icon: habit.icon || '🎯',
    currentValue: Number(userValue) || 0,
    targetValue: Number(targetValue) || 1,
    unit: unit,
    streak: Number(streak) || 1,
    isCompleted: Boolean(isCompleted),
    partnerUsername: partner?.username || '',
    partnerProgressPercent: Number(partnerPercent) || 0,
    podSyncPercent: Number(podSyncPercent) || 0,
    statusMessage: statusMessage || `${habit.name}: ${userValue}/${targetValue} ${unit}`,
    timestamp: Date.now(),
  };

  // 1. Dispatch custom DOM event for in-app Dynamic Island HUD
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('daybyday:live-activity-update', { detail: payload })
    );
  }

  // 2. Bridge to Apple iOS ActivityKit if running in native iOS WebKit container
  if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.activityKit) {
    try {
      window.webkit.messageHandlers.activityKit.postMessage({
        action: 'update',
        data: payload,
      });
    } catch (e) {
      console.debug('iOS ActivityKit bridge message error:', e);
    }
  }

  // 3. Bridge to Android Native LiveActivityPlugin if running in Capacitor
  if (
    typeof window !== 'undefined' &&
    window.Capacitor?.Plugins?.LiveActivityPlugin
  ) {
    try {
      await window.Capacitor.Plugins.LiveActivityPlugin.updateLiveActivity(payload);
    } catch (e) {
      console.debug('Android LiveActivityPlugin update error:', e);
    }
  }

  // 4. Fallback to Web Notifications API (if permission granted and active)
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted' &&
    !window.Capacitor?.isNativePlatform?.()
  ) {
    try {
      const pct = Math.round(
        payload.targetValue > 0
          ? Math.min(100, (payload.currentValue / payload.targetValue) * 100)
          : 0
      );

      const title = `${payload.icon} ${payload.habitName} • ${pct}%`;
      const body = `${payload.currentValue} / ${payload.targetValue} ${payload.unit} | Streak: ${payload.streak}d 🔥${
        payload.partnerUsername ? ` | @${payload.partnerUsername}: ${payload.partnerProgressPercent}%` : ''
      }`;

      // Use ongoing silent tag so updates replace cleanly without chiming repeatedly
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'UPDATE_LIVE_NOTIFICATION',
          title,
          body,
          tag: 'daybyday-focus-live',
          data: payload,
        });
      }
    } catch (e) {
      console.debug('Web Live Notification notice:', e);
    }
  }
};

/**
 * Ends active live activity / ongoing notification
 */
export const stopLiveActivity = async () => {
  currentLiveHabitId = null;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('daybyday:live-activity-stop')
    );
  }

  if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.activityKit) {
    try {
      window.webkit.messageHandlers.activityKit.postMessage({ action: 'end' });
    } catch (e) {}
  }

  if (
    typeof window !== 'undefined' &&
    window.Capacitor?.Plugins?.LiveActivityPlugin
  ) {
    try {
      await window.Capacitor.Plugins.LiveActivityPlugin.stopLiveActivity();
    } catch (e) {}
  }
};

export const getActiveLiveHabitId = () => currentLiveHabitId;
