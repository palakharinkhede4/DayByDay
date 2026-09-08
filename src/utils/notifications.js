// Cross-Platform Native & Web Notification Gateway for DayByDay
// iOS web app requires: (1) service worker registered, (2) permission granted via user gesture,
// (3) registration.showNotification() — never new Notification() which is unsupported on iOS.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// ─── iOS detection ──────────────────────────────────────────────────────────
function isIosWebApp() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator?.userAgent || '';
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches;
  return isIos && isStandalone;
}

function isIosBrowser() {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(window.navigator?.userAgent || '');
}

// ─── Habit-specific motivating copy ────────────────────────────────────────
export function getHabitNotificationContent(habit) {
  const name = (habit.name || 'Daily Habit').trim();
  const lower = name.toLowerCase();
  const targetStr = habit.target ? `${habit.target} ${habit.unit || ''}`.trim() : '';

  if (lower.includes('water') || lower.includes('hydrat') || lower.includes('drink')) {
    return { title: 'Hydration Check', body: `Time for a glass of water! Hit your ${targetStr || 'daily goal'}.` };
  }
  if (lower.includes('step') || lower.includes('walk') || lower.includes('run') || lower.includes('jog')) {
    return { title: 'Step Up & Move', body: `Ready for a quick walk? Get closer to your ${targetStr || 'step'} target today!` };
  }
  if (lower.includes('read') || lower.includes('book') || lower.includes('learn') || lower.includes('study')) {
    return { title: 'Mind Fuel', body: `Time for your daily reading session. Even 10 minutes expands your mind.` };
  }
  if (lower.includes('workout') || lower.includes('gym') || lower.includes('fitness') || lower.includes('pushup') || lower.includes('exercise')) {
    return { title: 'Power Hour', body: `Time to train and keep your streak alive!` };
  }
  if (lower.includes('sleep') || lower.includes('bed') || lower.includes('rest')) {
    return { title: 'Night Wind-Down', body: `Time to wind down and recharge for tomorrow.` };
  }
  if (lower.includes('meditat') || lower.includes('breathe') || lower.includes('calm') || lower.includes('mind')) {
    return { title: 'Mindful Pause', body: `Take a deep breath. A few quiet minutes can reset your whole focus.` };
  }
  if (lower.includes('vitamin') || lower.includes('pill') || lower.includes('medicin')) {
    return { title: 'Daily Wellness', body: `Friendly reminder to take your daily ${name} and stay healthy.` };
  }
  return { title: `${name}`, body: `Time to check in on ${name} (${targetStr || 'target'}). Keep your consistency!` };
}

// ─── Ensure Android notification channel ───────────────────────────────────
let channelInitialized = false;
async function ensureAndroidChannel() {
  if (channelInitialized) return;
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: 'daybyday_reminders',
      name: 'DayByDay Habit Reminders',
      description: 'Daily habit reminders, streaks, and accountability alerts',
      importance: 5,
      visibility: 1,
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

// ─── Service Worker Registration ───────────────────────────────────────────
// Registers /sw.js and returns the registration (or null if unavailable)
let _swRegistrationPromise = null;

export function getOrRegisterServiceWorker() {
  if (_swRegistrationPromise) return _swRegistrationPromise;

  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    Capacitor.isNativePlatform()
  ) {
    _swRegistrationPromise = Promise.resolve(null);
    return _swRegistrationPromise;
  }

  _swRegistrationPromise = navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      // Trigger waiting SW to activate immediately
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      return reg;
    })
    .catch((err) => {
      console.warn('SW registration notice:', err);
      return null;
    });

  return _swRegistrationPromise;
}

// ─── Permission Status & Detection Helpers ─────────────────────────────────
export function getNotificationPermissionStatus() {
  if (Capacitor.isNativePlatform()) {
    return 'native';
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission; // 'granted', 'denied', or 'default'
}

export function isIosStandalone() {
  if (typeof window === 'undefined') return false;
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && isStandalone;
}

export function isIosSafariBrowser() {
  if (typeof window === 'undefined') return false;
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && !isStandalone;
}

// ─── Request notification permission ──────────────────────────────────────
// MUST be called directly within a user gesture (e.g. button click) for iOS to grant it.
export async function requestAppNotificationPermission() {
  // Native Android / iOS APK
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

  // Web / iOS Web App (iOS 16.4+ in standalone PWA or standard modern browsers)
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        await getOrRegisterServiceWorker();
        return true;
      }
      if (Notification.permission === 'denied') return false;

      // Request permission with promise + callback fallback for cross-engine compatibility
      let result;
      try {
        const p = Notification.requestPermission();
        if (p && typeof p.then === 'function') {
          result = await p;
        } else {
          result = await new Promise((resolve) => Notification.requestPermission(resolve));
        }
      } catch {
        result = await new Promise((resolve) => Notification.requestPermission(resolve));
      }

      if (result === 'granted') {
        // Immediately kick off and activate service worker for iOS web app
        await getOrRegisterServiceWorker();
      }
      return result === 'granted';
    } catch (err) {
      console.warn('Web notification permission notice:', err);
      return false;
    }
  }

  return false;
}

// ─── Test Notification Trigger ─────────────────────────────────────────────
export async function dispatchTestNotification() {
  return dispatchCheerNotification({
    title: 'DayByDay Notifications Active! 🔥',
    body: 'You are all set to receive cheers and habit reminders in real time.',
  });
}

// ─── Safe notification delivery via Service Worker ─────────────────────────
// Uses postMessage (message event on SW) as the primary delivery mechanism for iOS web app.
// This avoids the race condition where registration.showNotification() fails if the SW
// is still in the 'installing' state.
async function showViaServiceWorker(title, body, tag) {
  let reg = null;

  // Try the cached promise first
  try {
    reg = await getOrRegisterServiceWorker();
  } catch {}

  // If no cached reg, try navigator.serviceWorker.ready (blocks until ready)
  if (!reg && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 3000)),
      ]);
    } catch {}
  }

  if (!reg) return false;

  // Method 1: postMessage to service worker — most reliable on iOS
  try {
    const activeWorker = reg.active || reg.installing || reg.waiting;
    if (activeWorker) {
      activeWorker.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
      return true;
    }
  } catch {}

  // Method 2: registration.showNotification() — direct API
  try {
    if (reg.showNotification) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon.svg',
        tag: tag || ('daybyday-' + Date.now()),
        renotify: true,
      });
      return true;
    }
  } catch (err) {
    console.warn('SW showNotification notice:', err);
  }

  return false;
}

// ─── Dispatch habit reminder notification ─────────────────────────────────
export async function dispatchHabitNotification(habit) {
  const content = getHabitNotificationContent(habit);
  const tag = `daybyday-habit-${habit.id || 'h'}`;

  // Android native
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidChannel();
      const notifId = Math.abs(
        String(habit.id || 'habit').split('').reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0)
      ) % 100000 || Math.floor(Math.random() * 90000 + 1000);
      await LocalNotifications.schedule({
        notifications: [{
          id: notifId,
          title: content.title,
          body: content.body,
          channelId: 'daybyday_reminders',
          smallIcon: 'ic_stat_flame',
          largeIcon: 'ic_launcher',
          iconColor: '#F97316',
          autoCancel: true,
          schedule: { at: new Date(Date.now() + 200) },
        }],
      });
      return true;
    } catch (err) {
      console.warn('Capacitor LocalNotification issue:', err);
    }
  }

  // Web / iOS Web App
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  return showViaServiceWorker(content.title, content.body, tag);
}

// ─── Dispatch encouragement / cheer notification ──────────────────────────
export async function dispatchCheerNotification({ title, body }) {
  const notifTitle = title || 'DayByDay Encouragement 🔥';
  const notifBody = body || 'A teammate cheered you on! Keep crushing your goals.';
  const tag = 'daybyday-cheer-' + Date.now();

  // Android native
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureAndroidChannel();
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 90000 + 10000),
          title: notifTitle,
          body: notifBody,
          channelId: 'daybyday_reminders',
          smallIcon: 'ic_stat_flame',
          largeIcon: 'ic_launcher',
          iconColor: '#F97316',
          autoCancel: true,
          schedule: { at: new Date(Date.now() + 100) },
        }],
      });
      return true;
    } catch (err) {
      console.warn('Capacitor Cheer Notification issue:', err);
    }
  }

  // Web / iOS Web App — NEVER use new Notification() on iOS, always use SW
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  // For iOS web app and all web: route through service worker (safe from timer context)
  const swOk = await showViaServiceWorker(notifTitle, notifBody, tag);
  if (swOk) return true;

  // Non-iOS browser-only fallback: standard Notification constructor
  if (!isIosBrowser()) {
    try {
      new Notification(notifTitle, {
        body: notifBody,
        icon: '/icon-192.png',
        badge: '/icon.svg',
        tag,
      });
      return true;
    } catch {}
  }

  return false;
}
