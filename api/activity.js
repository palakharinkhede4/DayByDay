// Vercel Serverless Function: Real-Time Live Activity Feed & Teammate Milestones
import { getDb, ensureTables } from './db.js';

function parseSafeJson(val, fallback = {}) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      let parsed = JSON.parse(val);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return typeof parsed === 'object' && parsed !== null ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export default async function handler(req, res) {
  // CORS Headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sql = getDb();
  if (sql) {
    await ensureTables();
  }

  // 1. GET: Fetch recent activity stream for a Pod or User
  if (req.method === 'GET') {
    const { podCode, userId, limit = 25 } = req.query;
    const maxLimit = Math.min(50, Math.max(1, Number(limit) || 25));

    try {
      if (!sql) {
        return res.status(200).json({ success: true, activities: [] });
      }

      let rows = [];
      if (podCode) {
        const cleanCode = String(podCode).trim().toUpperCase();
        rows = await sql`
          SELECT * FROM daybyday_activity 
          WHERE UPPER(pod_code) = ${cleanCode}
          ORDER BY created_at DESC 
          LIMIT ${maxLimit}
        `;
      } else if (userId) {
        rows = await sql`
          SELECT * FROM daybyday_activity 
          WHERE user_id = ${userId}
          ORDER BY created_at DESC 
          LIMIT ${maxLimit}
        `;
      } else {
        rows = await sql`
          SELECT * FROM daybyday_activity 
          ORDER BY created_at DESC 
          LIMIT ${maxLimit}
        `;
      }

      const activities = rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name || r.username,
        avatar: r.avatar || 'star',
        profilePicture: r.profile_picture || null,
        type: r.type,
        podCode: r.pod_code,
        title: r.title,
        description: r.description || '',
        metadata: parseSafeJson(r.metadata, {}),
        createdAt: r.created_at,
      }));

      return res.status(200).json({ success: true, activities });
    } catch (err) {
      console.warn('Error querying activities:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve activities' });
    }
  }

  // 2. POST: Log a new micro-activity (Habit checkoff, Goal step, Cheer)
  if (req.method === 'POST') {
    const {
      userId,
      username,
      displayName,
      avatar = 'star',
      profilePicture = null,
      type = 'habit_completed',
      podCode = null,
      title,
      description = '',
      metadata = {},
    } = req.body || {};

    if (!userId || !title) {
      return res.status(400).json({ error: 'User ID and title required' });
    }

    const actId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cleanPodCode = podCode ? String(podCode).trim().toUpperCase() : null;

    try {
      if (sql) {
        await sql`
          INSERT INTO daybyday_activity (
            id, user_id, username, display_name, avatar, profile_picture,
            type, pod_code, title, description, metadata, created_at
          ) VALUES (
            ${actId}, ${userId}, ${username || 'user'}, ${displayName || username || 'User'},
            ${avatar}, ${profilePicture}, ${type}, ${cleanPodCode},
            ${title}, ${description}, ${JSON.stringify(parseSafeJson(metadata, {}))}::jsonb,
            CURRENT_TIMESTAMP
          )
        `;
      }

      return res.status(200).json({
        success: true,
        activity: {
          id: actId,
          userId,
          username,
          displayName: displayName || username,
          avatar,
          profilePicture,
          type,
          podCode: cleanPodCode,
          title,
          description,
          metadata,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn('Error logging activity:', err.message);
      return res.status(500).json({ error: 'Failed to log activity' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
