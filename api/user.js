// Vercel Serverless Function: User Accounts, Solo Habits & Partner Pairing
import { getDb, ensureTables, memoryDb } from './db.js';

function generateSecretCode(username) {
  const prefix = (username || 'DUO').slice(0, 3).toUpperCase();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${rand}`;
}

export default async function handler(req, res) {
  // CORS Headers for Web & Native Apps
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  await ensureTables();
  const sql = getDb();

  // 1. GET USER PROFILE & HABITS
  if (req.method === 'GET') {
    const { username, code } = req.query;

    if (!username && !code) {
      return res.status(400).json({ error: 'Username or secret code required' });
    }

    try {
      if (sql) {
        let user = null;
        if (username) {
          const rows = await sql`SELECT * FROM duotrack_users WHERE LOWER(username) = LOWER(${username}) LIMIT 1`;
          user = rows[0] || null;
        } else if (code) {
          const rows = await sql`SELECT * FROM duotrack_users WHERE UPPER(secret_code) = UPPER(${code}) LIMIT 1`;
          user = rows[0] || null;
        }

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Fetch user's habits
        const habits = await sql`SELECT * FROM duotrack_habits WHERE user_id = ${user.id} ORDER BY id ASC`;

        // Check if user has an active pairing
        const pairings = await sql`
          SELECT p.*, 
            u1.username as u1_name, u1.secret_code as u1_code,
            u2.username as u2_name, u2.secret_code as u2_code
          FROM duotrack_pairings p
          JOIN duotrack_users u1 ON p.user1_id = u1.id
          JOIN duotrack_users u2 ON p.user2_id = u2.id
          WHERE (p.user1_id = ${user.id} OR p.user2_id = ${user.id}) AND p.status = 'active'
          LIMIT 1
        `;

        let partner = null;
        let podCode = null;
        if (pairings.length > 0) {
          const pair = pairings[0];
          podCode = pair.pod_code;
          const partnerId = pair.user1_id === user.id ? pair.user2_id : pair.user1_id;
          const partnerRows = await sql`SELECT id, username, secret_code, display_name, avatar FROM duotrack_users WHERE id = ${partnerId}`;
          const partnerHabits = await sql`SELECT * FROM duotrack_habits WHERE user_id = ${partnerId}`;
          if (partnerRows.length > 0) {
            partner = { ...partnerRows[0], habits: partnerHabits };
          }
        }

        return res.status(200).json({
          user,
          habits,
          partner,
          podCode,
          isSolo: !partner
        });
      }

      // Memory Store Fallback
      const lookup = username || code;
      const user = memoryDb.getUser(lookup);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const habits = memoryDb.getUserHabits(user.id);
      return res.status(200).json({
        user,
        habits,
        partner: null,
        podCode: null,
        isSolo: true
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. POST: CREATE USER, SYNC HABITS, PAIR/UNPAIR
  if (req.method === 'POST') {
    const { action } = req.body || {};

    // ACTION: CREATE USER
    if (action === 'create_user') {
      const rawUsername = (req.body.username || '').trim().replace(/^@/, '');
      if (!rawUsername || rawUsername.length < 2) {
        return res.status(400).json({ error: 'Username must be at least 2 characters' });
      }

      const cleanUsername = rawUsername.toLowerCase();
      const displayName = req.body.displayName || rawUsername;
      const secretCode = generateSecretCode(cleanUsername);
      const userId = `usr_${cleanUsername}_${Date.now().toString(36)}`;
      const avatar = req.body.avatar || '🌱';

      try {
        if (sql) {
          // Check if username taken
          const existing = await sql`SELECT id FROM duotrack_users WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1`;
          if (existing.length > 0) {
            // Return existing user
            const u = existing[0];
            const habits = await sql`SELECT * FROM duotrack_habits WHERE user_id = ${u.id}`;
            return res.status(200).json({ user: u, habits, isExisting: true });
          }

          const created = await sql`
            INSERT INTO duotrack_users (id, username, secret_code, display_name, avatar)
            VALUES (${userId}, ${cleanUsername}, ${secretCode}, ${displayName}, ${avatar})
            RETURNING *
          `;
          return res.status(201).json({ user: created[0], isExisting: false });
        }

        // Memory Store Fallback
        const user = {
          id: userId,
          username: cleanUsername,
          secretCode,
          displayName,
          avatar,
          createdAt: new Date().toISOString()
        };
        memoryDb.saveUser(user);
        return res.status(201).json({ user, isExisting: false });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: SYNC HABITS (Save user's habits)
    if (action === 'sync_habits') {
      const { userId, habits } = req.body;
      if (!userId || !Array.isArray(habits)) {
        return res.status(400).json({ error: 'User ID and habits array required' });
      }

      try {
        if (sql) {
          for (const h of habits) {
            await sql`
              INSERT INTO duotrack_habits (user_id, habit_id, name, target, unit, icon, category, today_value, completed, updated_at)
              VALUES (${userId}, ${h.id}, ${h.name}, ${h.target || 1}, ${h.unit || ''}, ${h.icon || 'star'}, ${h.category || 'Daily'}, ${h.todayValue ?? h.user1 ?? 0}, ${Boolean(h.completed)}, CURRENT_TIMESTAMP)
              ON CONFLICT (user_id, habit_id) DO UPDATE SET
                today_value = EXCLUDED.today_value,
                completed = EXCLUDED.completed,
                name = EXCLUDED.name,
                target = EXCLUDED.target,
                unit = EXCLUDED.unit,
                updated_at = CURRENT_TIMESTAMP
            `;
          }
          const savedHabits = await sql`SELECT * FROM duotrack_habits WHERE user_id = ${userId} ORDER BY id ASC`;
          return res.status(200).json({ success: true, habits: savedHabits });
        }

        memoryDb.saveUserHabits(userId, habits);
        return res.status(200).json({ success: true, habits });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: PAIR WITH PARTNER VIA SECRET CODE
    if (action === 'pair') {
      const { userId, partnerCode } = req.body;
      const cleanCode = (partnerCode || '').trim().toUpperCase();

      if (!userId || !cleanCode) {
        return res.status(400).json({ error: 'User ID and partner code required' });
      }

      try {
        if (sql) {
          const partnerRows = await sql`SELECT * FROM duotrack_users WHERE UPPER(secret_code) = ${cleanCode} LIMIT 1`;
          if (partnerRows.length === 0) {
            return res.status(404).json({ error: 'No partner found with this secret code' });
          }
          const partner = partnerRows[0];
          if (partner.id === userId) {
            return res.status(400).json({ error: 'You cannot pair with your own code' });
          }

          const podCode = `POD_${Date.now().toString(36).toUpperCase()}`;
          // Deactivate old pairings
          await sql`UPDATE duotrack_pairings SET status = 'closed' WHERE user1_id = ${userId} OR user2_id = ${userId}`;
          await sql`UPDATE duotrack_pairings SET status = 'closed' WHERE user1_id = ${partner.id} OR user2_id = ${partner.id}`;

          await sql`
            INSERT INTO duotrack_pairings (user1_id, user2_id, pod_code, status)
            VALUES (${userId}, ${partner.id}, ${podCode}, 'active')
          `;

          const partnerHabits = await sql`SELECT * FROM duotrack_habits WHERE user_id = ${partner.id}`;
          return res.status(200).json({
            success: true,
            podCode,
            partner: { ...partner, habits: partnerHabits }
          });
        }

        // Memory Store Fallback
        const partner = memoryDb.getUser(cleanCode);
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        const podCode = `POD_${Date.now().toString(36).toUpperCase()}`;
        memoryDb.savePairing({ user1_id: userId, user2_id: partner.id, podCode, status: 'active' });
        return res.status(200).json({ success: true, podCode, partner });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: UNPAIR / GO SOLO
    if (action === 'unpair') {
      const { userId } = req.body;
      if (sql && userId) {
        await sql`UPDATE duotrack_pairings SET status = 'closed' WHERE user1_id = ${userId} OR user2_id = ${userId}`;
      }
      return res.status(200).json({ success: true, isSolo: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
