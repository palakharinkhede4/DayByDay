// Vercel Serverless API for DuoTrack Real-Time Pod Synchronization

// In-memory pod store (persists across warm serverless invocations)
// For permanent multi-region persistence, configure UPSTASH_REDIS_REST_URL or KV_REST_API_URL in Vercel
const memoryPods = new Map();

// Helper to interact with Upstash / Vercel KV if environment variables are provided
async function getKV(key) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const res = await fetch(`${url}/get/${key}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      return data.result ? JSON.parse(data.result) : null;
    } catch {
      return memoryPods.get(key) || null;
    }
  }
  return memoryPods.get(key) || null;
}

async function setKV(key, value) {
  memoryPods.set(key, value);
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      await fetch(`${url}/set/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(value))
      });
    } catch { }
  }
}

export default async function handler(req, res) {
  // CORS Headers for Native Android APK and Web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { code } = req.query;

  // 0. HEALTH PING / STATUS CHECK
  if (req.query.ping === 'true') {
    return res.status(200).json({ status: 'ok', time: Date.now(), message: 'DuoTrack Cloud API is active' });
  }

  // 1. GET POD STATE
  if (req.method === 'GET') {
    if (!code) {
      return res.status(400).json({ error: 'Pod code is required' });
    }

    const cleanCode = code.toUpperCase();
    const podKey = `pod_${cleanCode}`;
    let podData = await getKV(podKey);

    // Auto-seed default initial pod for ZAU8PP so testing works immediately
    if (!podData && cleanCode === 'ZAU8PP') {
      podData = {
        code: 'ZAU8PP',
        isPaired: true,
        user1: { name: 'Ced', email: 'ced@example.invalid', initial: 'C' },
        user2: { name: 'Joe', email: 'joe@example.invalid', initial: 'J' },
        daysTogether: 12,
        currentStreak: 12,
        bestStreak: 18,
        podHealth: 86,
        healthStatus: 'THRIVING',
        yesterdayPercent: 87,
        lastUpdated: Date.now(),
        lastUpdatedBy: 'system',
        habits: [
          { id: 'steps', name: 'Steps', target: 10000, unit: 'steps', user1: 2200, user2: 7400 },
          { id: 'sleep', name: 'Sleep', target: 8, unit: 'hours', user1: 6.0, user2: 7.16, user1Display: '6h', user2Display: '7h 10m' },
          { id: 'meditation', name: 'Meditation', target: 10, unit: 'min', user1: 5, user2: 10 },
          { id: 'water', name: 'Water', target: 8, unit: 'pints', user1: 5, user2: 8 },
          { id: 'reading', name: 'Reading', target: 10, unit: 'pgs', user1: 5, user2: 3 },
          { id: 'workouts', name: 'Workouts', target: 30, unit: 'min', user1: 0, user2: 32 },
          { id: 'vitamins', name: 'Vitamins', target: 1, unit: 'done', user1: false, user2: true }
        ]
      };
      await setKV(podKey, podData);
    }

    if (!podData) {
      return res.status(404).json({ error: 'Pod not found', notFound: true });
    }

    return res.status(200).json(podData);
  }

  // 2. POST UPDATE OR CREATE POD
  if (req.method === 'POST') {
    const { action, podCode, userId, habitId, value, podInfo, habits } = req.body || {};
    const cleanCode = (podCode || code || 'ZAU8PP').toUpperCase();
    const podKey = `pod_${cleanCode}`;

    let currentPod = (await getKV(podKey)) || {
      code: cleanCode,
      user1: { name: 'Ced', email: 'ced@example.invalid', initial: 'C' },
      user2: { name: 'Joe', email: 'joe@example.invalid', initial: 'J' },
      daysTogether: 12,
      currentStreak: 12,
      bestStreak: 18,
      podHealth: 86,
      healthStatus: 'THRIVING',
      yesterdayPercent: 87,
      habits: habits || [],
      lastUpdated: Date.now(),
      lastUpdatedBy: userId || 'user1',
    };

    // Action: FULL SYNC (Push local state or initialize)
    if (action === 'sync_all') {
      currentPod = {
        ...currentPod,
        ...podInfo,
        habits: habits || currentPod.habits,
        lastUpdated: Date.now(),
        lastUpdatedBy: userId,
      };
      await setKV(podKey, currentPod);
      return res.status(200).json({ success: true, pod: currentPod });
    }

    // Action: HABIT UPDATE (Single habit changed by one user)
    if (action === 'update_habit') {
      if (currentPod.habits) {
        currentPod.habits = currentPod.habits.map((h) => {
          if (h.id === habitId) {
            return {
              ...h,
              [userId]: value,
              ...(habitId === 'sleep' && typeof value === 'number'
                ? {
                    [`${userId}Display`]: `${Math.floor(value)}h ${Math.round((value % 1) * 60)}m`
                  }
                : {})
            };
          }
          return h;
        });
      }

      currentPod.lastUpdated = Date.now();
      currentPod.lastUpdatedBy = userId;
      currentPod.lastActivity = `${userId === 'user1' ? currentPod.user1.name : currentPod.user2.name} updated ${habitId}`;

      await setKV(podKey, currentPod);
      return res.status(200).json({ success: true, pod: currentPod });
    }

    // Action: PAIR USERS
    if (action === 'join_pod') {
      const partnerName = req.body.partnerName || 'Partner';
      currentPod.isPaired = true;
      currentPod.user2 = {
        name: partnerName,
        email: `${partnerName.toLowerCase()}@example.invalid`,
        initial: partnerName[0].toUpperCase()
      };
      currentPod.lastUpdated = Date.now();
      await setKV(podKey, currentPod);
      return res.status(200).json({ success: true, pod: currentPod });
    }

    // Fallback: save whatever state was sent
    await setKV(podKey, currentPod);
    return res.status(200).json({ success: true, pod: currentPod });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
