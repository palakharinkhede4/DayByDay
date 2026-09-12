import webpush from 'web-push';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getDb } from './db.js';

let vapidInitialized = false;

function initVapid() {
  if (vapidInitialized) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('Web Push keys not set. Web pushes will fail.');
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:palakharinkhede1@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidInitialized = true;
  return true;
}

let messaging;
try {
  initializeApp({ credential: applicationDefault() });
  messaging = getMessaging();
} catch (e) {
  console.warn('Firebase Admin SDK failed to initialize. Android pushes will fail:', e.message);
}

export async function sendWebPush(subscription, payload) {
  if (!initVapid()) return { success: false, error: new Error('VAPID not configured') };
  try {
    const pushSub = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };
    await webpush.sendNotification(pushSub, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function sendFCM(fcmToken, payload) {
  if (!messaging) return { success: false, error: new Error('Firebase not initialized') };
  try {
    await messaging.send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'daybyday_reminders',
          icon: 'ic_stat_flame',
          sound: 'default'
        }
      },
      data: payload.data || {}
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function sendNotification(userId, payload) {
  const sql = getDb();
  if (!sql) return;

  const subscriptions = await sql`
    SELECT id, provider, endpoint, p256dh, auth, fcm_token 
    FROM push_subscriptions 
    WHERE user_id = ${userId} AND disabled_at IS NULL
  `;

  for (const sub of subscriptions) {
    let result;
    if (sub.provider === 'webpush') {
      result = await sendWebPush(sub, payload);
    } else if (sub.provider === 'fcm') {
      result = await sendFCM(sub.fcm_token, payload);
    }

    if (result && result.success) {
      await sql`UPDATE push_subscriptions SET last_success_at = NOW() WHERE id = ${sub.id}`;
    } else if (result && !result.success) {
      await sql`UPDATE push_subscriptions SET last_failure_at = NOW() WHERE id = ${sub.id}`;
      const err = result.error;
      if (err.statusCode === 410 || err.statusCode === 404 || (err.code && (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered'))) {
        await sql`UPDATE push_subscriptions SET disabled_at = NOW() WHERE id = ${sub.id}`;
      }
    }
  }
}

// Handler for subscription registration
export async function handleSubscription(req, res) {
  const sql = getDb();
  if (!sql) return res.status(500).json({ error: 'Database not available' });

  const { userId, platform, provider, endpoint, keys, fcmToken, deviceId, timezoneOffset } = req.body;

  if (!userId || !platform || !provider) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    // Check if subscription exists for this device/endpoint
    if (provider === 'webpush' && endpoint) {
      const existing = await sql`SELECT id FROM push_subscriptions WHERE endpoint = ${endpoint} AND user_id = ${userId}`;
      if (existing.length > 0) {
        await sql`UPDATE push_subscriptions SET disabled_at = NULL, updated_at = NOW(), timezone_offset = ${timezoneOffset || 0} WHERE id = ${existing[0].id}`;
        return res.json({ success: true, id: existing[0].id });
      }
    } else if (provider === 'fcm' && fcmToken) {
      const existing = await sql`SELECT id FROM push_subscriptions WHERE fcm_token = ${fcmToken} AND user_id = ${userId}`;
      if (existing.length > 0) {
        await sql`UPDATE push_subscriptions SET disabled_at = NULL, updated_at = NOW(), timezone_offset = ${timezoneOffset || 0} WHERE id = ${existing[0].id}`;
        return res.json({ success: true, id: existing[0].id });
      }
    }

    await sql`
      INSERT INTO push_subscriptions (id, user_id, platform, provider, endpoint, p256dh, auth, fcm_token, device_id, timezone_offset)
      VALUES (${id}, ${userId}, ${platform}, ${provider}, ${endpoint || null}, ${keys?.p256dh || null}, ${keys?.auth || null}, ${fcmToken || null}, ${deviceId || null}, ${timezoneOffset || 0})
    `;
    return res.json({ success: true, id });
  } catch (err) {
    console.error('Subscription error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
