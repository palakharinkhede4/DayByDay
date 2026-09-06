// Cross-Platform Native & Web Notification Gateway for DayByDay
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Habit-specific motivating copy generator
export function getHabitNotificationContent(habit) {
  const name = (habit.name || 'Daily Habit').trim();
  const lower = name.toLowerCase();
  const targetStr = habit.target ? `${habit.target} ${habit.unit || ''}`.trim() : '';

  if (lower.includes('water') || lower.includes('hydrat') || lower.includes('drink')) {
    return {
      title: '💧 Hydration Check',
      body: `Time for a glass of water! Keep your body refreshed and hit your ${targetStr || 'daily goal'}.`,
    };
  }

  if (lower.includes('step') || lower.includes('walk') || lower.includes('run') || lower.includes('jog')) {
    return {
      title: '👟 Step Up & Move',
      body: `Ready for a quick walk? Get closer to your ${targetStr || 'step'} target today!`,
    };
  }

  if (lower.includes('read') || lower.includes('book') || lower.includes('learn') || lower.includes('study')) {
    return {
      title: '📖 Mind Fuel',
      body: `Time for your daily reading session. Even 10 minutes expands your mind.`,
    };
  }

  if (lower.includes('workout') || lower.includes('gym') || lower.includes('fitness') || lower.includes('pushup') || lower.includes('exercise')) {
    return {
      title: '💪 Power Hour',
      body: `Time to train and keep your streak alive! Let's get it done today.`,
    };
  }

  if (lower.includes('sleep') || lower.includes('bed') || lower.includes('rest')) {
    return {
      title: '🌙 Night Wind-Down',
      body: `Time to wind down and recharge for a fresh, productive day tomorrow.`,
    };
  }

  if (lower.includes('meditat') || lower.includes('breathe') || lower.includes('calm') || lower.includes('mind')) {
    return {
      title: '🧘 Mindful Pause',
      body: `Take a deep breath. A few quiet minutes can reset your whole focus.`,
    };
  }

  if (lower.includes('vitamin') || lower.includes('pill') || lower.includes('medicin')) {
    return {
      title: '💊 Daily Wellness',
      body: `Friendly reminder to take your daily ${name} and stay healthy.`,
    };
  }

  return {
    title: `🎯 ${name}`,
    body: `Time to check in on ${name} (${targetStr || 'target'}). Keep your consistency alive!`,
  };
}

// Ensure Android notification channel is registered with HIGH importance for visual banner
let channelInitialized = false;
async function ensureAndroidChannel() {
  if (channelInitialized) return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    await LocalNotifications.createChannel({
      id: 'daybyday_reminders',
      name: 'DayByDay Habit Reminders',
      description: 'Daily habit reminders, streaks, and accountability alerts',
      importance: 5, // High priority = popup heads-up banner on screen
      visibility: 1, // Public on lockscreen
      sound: 'beep.wav',
      vibration: true,
      lights: true,
      lightColor: '#1A56C4',
    });
    channelInitialized = true;
  } catch (err) {
    console.warn('Channel creation notice:', err);
  }
}

// Request Notification Permissions (Native Android + iOS Web App + Web)
export async function requestAppNotificationPermission() {
  // 1. Native Android & iOS APK/App
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidChannel();
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch (err) {
      console.warn('Native notification permission notice:', err);
      return false;
    }
  }

  // 2. Web Browser & iOS Web App (Safari iOS 16.4+ / Chrome PWA)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'default') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
      return Notification.permission === 'granted';
    } catch (err) {
      console.warn('Web notification permission notice:', err);
      return false;
    }
  }

  return false;
}

// Dispatch System Notification (Native Status Bar on Android, Web Notification on iOS Web App)
export async function dispatchHabitNotification(habit) {
  const content = getHabitNotificationContent(habit);
  const notificationId = Math.abs(
    String(habit.id || 'habit')
      .split('')
      .reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
  ) % 100000;

  // 1. Android / iOS Native via Capacitor LocalNotifications
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidChannel();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId || Math.floor(Math.random() * 90000 + 1000),
            title: content.title,
            body: content.body,
            channelId: 'daybyday_reminders',
            smallIcon: 'ic_stat_flame',
            largeIcon: 'ic_launcher',
            iconColor: '#F97316',
            autoCancel: true,
            schedule: { at: new Date(Date.now() + 200) },
          },
        ],
      });
      return true;
    } catch (err) {
      console.warn('Capacitor LocalNotification issue:', err);
    }
  }

  // 2. Browser / iOS Web App (Service Worker or standard Web Notification)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      // Try Service Worker registration first (standard for iOS PWA)
      if (navigator.serviceWorker?.ready) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(content.title, {
            body: content.body,
            icon: '/icon-192.png',
            badge: '/icon.svg',
            tag: `daybyday-${habit.id}`,
            renotify: true,
          });
          return true;
        }
      }

      // Standard browser notification fallback
      new Notification(content.title, {
        body: content.body,
        icon: '/icon-192.png',
        badge: '/icon.svg',
        tag: `daybyday-${habit.id}`,
      });
      return true;
    } catch (webErr) {
      console.warn('Web notification dispatch notice:', webErr);
    }
  }

  return false;
}
