import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getApiBaseUrl } from './api.js';
import { requestIgnoreBatteryOptimization } from './notifications.js';

const VAPID_PUBLIC_KEY = 'BBluDIIVxB9g-I9SbgJy_Z0eJODvpBLjs-otPdzdNzBrM4Ezl6OROaozgRreotkvouGnSOvpacFqifLwplUf7_c';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications(userId) {
  if (!userId) return;

  try {
    if (Capacitor.isNativePlatform()) {
      // Android FCM
      try {
        await requestIgnoreBatteryOptimization();
      } catch (e) {}
      
      const permStatus = await PushNotifications.requestPermissions();
      if (permStatus.receive === 'granted') {
        PushNotifications.register();
        
        PushNotifications.addListener('registration', async (token) => {
          await fetch(`${getApiBaseUrl()}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              platform: 'android',
              provider: 'fcm',
              fcmToken: token.value
            })
          });
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          // You could show a local toast here if in foreground
        });
      }
    } else {
      // iOS / Web PWA - VAPID Web Push
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const subJSON = subscription.toJSON();
      await fetch(`${getApiBaseUrl()}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          platform: 'ios_web',
          provider: 'webpush',
          endpoint: subJSON.endpoint,
          keys: subJSON.keys
        })
      });
    }
  } catch (err) {
    console.warn('Push notification registration failed', err);
  }
}
