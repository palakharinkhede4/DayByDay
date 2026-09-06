// Vercel Serverless Function: User Accounts, Authentication, Security Questions & Partner Pairing
import crypto from 'crypto';
import { getDb, ensureTables, memoryDb } from './db.js';

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), String(salt), 1000, 32, 'sha256').toString('hex');
}

function hashSecurityAnswer(answer, salt) {
  const clean = (answer || '').toLowerCase().trim();
  return crypto.pbkdf2Sync(clean, String(salt), 1000, 32, 'sha256').toString('hex');
}

function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, salt, security_answer_hash, ...safe } = u;
  if (!safe.preferences) safe.preferences = {};
  return safe;
}

function formatHabitFromRow(row) {
  if (!row) return null;
  return {
    id: row.habit_id || String(row.id),
    name: row.name || 'Habit',
    category: row.category || 'Daily',
    description: row.description || '',
    target: Number(row.target) || 1,
    unit: row.unit || '',
    icon: row.icon || 'star',
    user1: Number(row.today_value) || 0,
    user2: 0,
    completed: Boolean(row.completed),
    reminderTime: row.reminder_time || '',
    reminderDays: row.reminder_days ? row.reminder_days.split(',') : [],
    streak: Number(row.streak) || 0,
    history: typeof row.history === 'object' && row.history !== null ? row.history : {},
  };
}

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

  // 1. GET: FETCH USER PROFILE & HABITS
  if (req.method === 'GET') {
    const { username, code } = req.query;

    if (!username && !code) {
      return res.status(400).json({ error: 'Username or secret code required' });
    }

    try {
      if (sql) {
        let user = null;
        if (username) {
          const rows = await sql`SELECT * FROM daybyday_users WHERE LOWER(username) = LOWER(${username}) LIMIT 1`;
          user = rows[0] || null;
        } else if (code) {
          const rows = await sql`SELECT * FROM daybyday_users WHERE UPPER(secret_code) = UPPER(${code}) LIMIT 1`;
          user = rows[0] || null;
        }

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Fetch user's habits
        const habits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${user.id} ORDER BY id ASC`;

        // Check if user has an active pairing
        const pairings = await sql`
          SELECT p.*, 
            u1.username as u1_name, u1.secret_code as u1_code,
            u2.username as u2_name, u2.secret_code as u2_code
          FROM daybyday_pairings p
          JOIN daybyday_users u1 ON p.user1_id = u1.id
          JOIN daybyday_users u2 ON p.user2_id = u2.id
          WHERE (p.user1_id = ${user.id} OR p.user2_id = ${user.id}) AND p.status = 'active'
          LIMIT 1
        `;

        let partner = null;
        let podCode = null;
        if (pairings.length > 0) {
          const pair = pairings[0];
          podCode = pair.pod_code;
          const partnerId = pair.user1_id === user.id ? pair.user2_id : pair.user1_id;
          const partnerRows = await sql`SELECT id, username, secret_code, display_name, avatar, preferences FROM daybyday_users WHERE id = ${partnerId}`;
          const partnerHabits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${partnerId}`;
          if (partnerRows.length > 0) {
            partner = { ...sanitizeUser(partnerRows[0]), habits: partnerHabits.map(formatHabitFromRow) };
          }
        }

        return res.status(200).json({
          user: sanitizeUser(user),
          habits: habits.map(formatHabitFromRow),
          preferences: user.preferences || {},
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
        user: sanitizeUser(user),
        habits,
        preferences: user.preferences || {},
        partner: null,
        podCode: null,
        isSolo: true
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 2. POST: AUTHENTICATION, HABIT SYNC, PAIRING & RECOVERY
  if (req.method === 'POST') {
    const { action } = req.body || {};

    // ACTION: REGISTER / CREATE USER
    if (action === 'register' || action === 'create_user') {
      const rawUsername = (req.body.username || '').trim().replace(/^@/, '');
      const password = req.body.password;
      const securityQuestion = (req.body.securityQuestion || '').trim();
      const securityAnswer = (req.body.securityAnswer || '').trim();

      if (!rawUsername || rawUsername.length < 2) {
        return res.status(400).json({ error: 'Username must be at least 2 characters' });
      }
      if (!password || String(password).length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }
      if (!securityQuestion || !securityAnswer) {
        return res.status(400).json({ error: 'Security question and answer are required for password recovery' });
      }

      const cleanUsername = rawUsername.toLowerCase();
      const displayName = req.body.displayName || rawUsername;
      const secretCode = generateSecretCode(cleanUsername);
      const userId = `usr_${cleanUsername}_${Date.now().toString(36)}`;
      const avatar = req.body.avatar || 'star';

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const answerHash = hashSecurityAnswer(securityAnswer, salt);

      try {
        if (sql) {
          // Check if username taken
          const existing = await sql`SELECT id FROM daybyday_users WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1`;
          if (existing.length > 0) {
            return res.status(409).json({ error: 'Username is already taken. Please choose another username or sign in.' });
          }

          const created = await sql`
            INSERT INTO daybyday_users (
              id, username, secret_code, display_name, avatar,
              password_hash, salt, security_question, security_answer_hash
            )
            VALUES (
              ${userId}, ${cleanUsername}, ${secretCode}, ${displayName}, ${avatar},
              ${passwordHash}, ${salt}, ${securityQuestion}, ${answerHash}
            )
            RETURNING *
          `;
          return res.status(201).json({ user: sanitizeUser(created[0]) });
        }

        // Memory Store Fallback
        if (memoryDb.getUser(cleanUsername)) {
          return res.status(409).json({ error: 'Username is already taken. Please choose another username or sign in.' });
        }

        const user = {
          id: userId,
          username: cleanUsername,
          secretCode,
          displayName,
          avatar,
          password_hash: passwordHash,
          salt,
          security_question: securityQuestion,
          security_answer_hash: answerHash,
          createdAt: new Date().toISOString()
        };
        memoryDb.saveUser(user);
        return res.status(201).json({ user: sanitizeUser(user) });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: LOGIN / SIGN IN
    if (action === 'login') {
      const rawUsername = (req.body.username || '').trim().replace(/^@/, '');
      const password = req.body.password;

      if (!rawUsername || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const cleanUsername = rawUsername.toLowerCase();

      try {
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_users WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1`;
          if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
          }

          const user = rows[0];

          // Verify password
          if (user.password_hash) {
            const expectedHash = hashPassword(password, user.salt || '');
            if (expectedHash !== user.password_hash) {
              return res.status(401).json({ error: 'Invalid username or password' });
            }
          }

          // Fetch habits
          const habits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${user.id} ORDER BY id ASC`;

          // Check pairing
          const pairings = await sql`
            SELECT p.*, 
              u1.username as u1_name, u1.secret_code as u1_code,
              u2.username as u2_name, u2.secret_code as u2_code
            FROM daybyday_pairings p
            JOIN daybyday_users u1 ON p.user1_id = u1.id
            JOIN daybyday_users u2 ON p.user2_id = u2.id
            WHERE (p.user1_id = ${user.id} OR p.user2_id = ${user.id}) AND p.status = 'active'
            LIMIT 1
          `;

          let partner = null;
          let podCode = null;
          if (pairings.length > 0) {
            const pair = pairings[0];
            podCode = pair.pod_code;
            const partnerId = pair.user1_id === user.id ? pair.user2_id : pair.user1_id;
            const partnerRows = await sql`SELECT id, username, secret_code, display_name, avatar, preferences FROM daybyday_users WHERE id = ${partnerId}`;
            const partnerHabits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${partnerId}`;
            if (partnerRows.length > 0) {
              partner = { ...sanitizeUser(partnerRows[0]), habits: partnerHabits.map(formatHabitFromRow) };
            }
          }

          return res.status(200).json({
            user: sanitizeUser(user),
            habits: habits.map(formatHabitFromRow),
            preferences: user.preferences || {},
            partner,
            podCode,
            isSolo: !partner
          });
        }

        // Memory Store Fallback
        const user = memoryDb.getUser(cleanUsername);
        if (!user) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
        if (user.password_hash) {
          const expectedHash = hashPassword(password, user.salt || '');
          if (expectedHash !== user.password_hash) {
            return res.status(401).json({ error: 'Invalid username or password' });
          }
        }
        const habits = memoryDb.getUserHabits(user.id);
        return res.status(200).json({
          user: sanitizeUser(user),
          habits,
          preferences: user.preferences || {},
          partner: null,
          podCode: null,
          isSolo: true
        });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: GET SECURITY QUESTION FOR PASSWORD RECOVERY
    if (action === 'get_security_question') {
      const rawUsername = (req.body.username || '').trim().replace(/^@/, '');
      if (!rawUsername) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const cleanUsername = rawUsername.toLowerCase();

      try {
        if (sql) {
          const rows = await sql`SELECT username, security_question FROM daybyday_users WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1`;
          if (rows.length === 0) {
            return res.status(404).json({ error: 'No account found with this username' });
          }
          const user = rows[0];
          if (!user.security_question) {
            return res.status(400).json({ error: 'No security question set for this account' });
          }
          return res.status(200).json({
            username: user.username,
            securityQuestion: user.security_question
          });
        }

        const user = memoryDb.getUser(cleanUsername);
        if (!user) return res.status(404).json({ error: 'No account found with this username' });
        if (!user.security_question) return res.status(400).json({ error: 'No security question set for this account' });
        return res.status(200).json({ username: user.username, securityQuestion: user.security_question });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: RESET PASSWORD VIA SECURITY ANSWER
    if (action === 'reset_password') {
      const rawUsername = (req.body.username || '').trim().replace(/^@/, '');
      const securityAnswer = (req.body.securityAnswer || '').trim();
      const newPassword = req.body.newPassword;

      if (!rawUsername || !securityAnswer || !newPassword) {
        return res.status(400).json({ error: 'Username, security answer, and new password are required' });
      }
      if (String(newPassword).length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters' });
      }

      const cleanUsername = rawUsername.toLowerCase();

      try {
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_users WHERE LOWER(username) = LOWER(${cleanUsername}) LIMIT 1`;
          if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
          }
          const user = rows[0];
          if (!user.security_answer_hash) {
            return res.status(400).json({ error: 'No security question configured for this account' });
          }

          const expectedAnswerHash = hashSecurityAnswer(securityAnswer, user.salt || '');
          if (expectedAnswerHash !== user.security_answer_hash) {
            return res.status(401).json({ error: 'Incorrect answer to security question' });
          }

          // Generate new salt and new hashes
          const newSalt = crypto.randomBytes(16).toString('hex');
          const newPasswordHash = hashPassword(newPassword, newSalt);
          const newAnswerHash = hashSecurityAnswer(securityAnswer, newSalt);

          await sql`
            UPDATE daybyday_users
            SET password_hash = ${newPasswordHash}, salt = ${newSalt}, security_answer_hash = ${newAnswerHash}
            WHERE id = ${user.id}
          `;

          return res.status(200).json({ success: true, message: 'Password reset successfully' });
        }

        const user = memoryDb.getUser(cleanUsername);
        if (!user) return res.status(404).json({ error: 'User not found' });
        const expectedAnswerHash = hashSecurityAnswer(securityAnswer, user.salt || '');
        if (expectedAnswerHash !== user.security_answer_hash) {
          return res.status(401).json({ error: 'Incorrect answer to security question' });
        }

        const newSalt = crypto.randomBytes(16).toString('hex');
        user.salt = newSalt;
        user.password_hash = hashPassword(newPassword, newSalt);
        user.security_answer_hash = hashSecurityAnswer(securityAnswer, newSalt);
        memoryDb.saveUser(user);

        return res.status(200).json({ success: true, message: 'Password reset successfully' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: SYNC HABITS (Save user's habits & preferences)
    if (action === 'sync_habits') {
      const { userId, habits, preferences } = req.body;
      if (!userId || !Array.isArray(habits)) {
        return res.status(400).json({ error: 'User ID and habits array required' });
      }

      try {
        if (sql) {
          if (preferences && typeof preferences === 'object') {
            await sql`UPDATE daybyday_users SET preferences = ${JSON.stringify(preferences)}::jsonb, last_active = CURRENT_TIMESTAMP WHERE id = ${userId}`;
          }
          for (const h of habits) {
            const reminderDaysStr = Array.isArray(h.reminderDays) ? h.reminderDays.join(',') : (h.reminderDays || null);
            await sql`
              INSERT INTO daybyday_habits (
                user_id, habit_id, name, description, target, unit, icon, category,
                today_value, completed, reminder_time, reminder_days, streak, history, updated_at
              )
              VALUES (
                ${userId}, ${h.id}, ${h.name}, ${h.description || ''}, ${h.target || 1}, ${h.unit || ''}, ${h.icon || 'star'}, ${h.category || 'Daily'},
                ${h.user1 ?? h.todayValue ?? 0}, ${Boolean(h.completed)}, ${h.reminderTime || null}, ${reminderDaysStr},
                ${h.streak || 0}, ${JSON.stringify(h.history || {})}::jsonb, CURRENT_TIMESTAMP
              )
              ON CONFLICT (user_id, habit_id) DO UPDATE SET
                today_value = EXCLUDED.today_value,
                completed = EXCLUDED.completed,
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                target = EXCLUDED.target,
                unit = EXCLUDED.unit,
                icon = EXCLUDED.icon,
                category = EXCLUDED.category,
                reminder_time = EXCLUDED.reminder_time,
                reminder_days = EXCLUDED.reminder_days,
                streak = EXCLUDED.streak,
                history = EXCLUDED.history,
                updated_at = CURRENT_TIMESTAMP
            `;
          }
          const savedHabits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${userId} ORDER BY id ASC`;
          return res.status(200).json({ success: true, habits: savedHabits.map(formatHabitFromRow) });
        }

        memoryDb.saveUserHabits(userId, habits);
        if (preferences) {
          const u = memoryDb.getUser(userId);
          if (u) u.preferences = preferences;
        }
        return res.status(200).json({ success: true, habits });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: SYNC PREFERENCES (Accent color, theme, profile picture, custom categories, goals)
    if (action === 'sync_preferences') {
      const { userId, preferences } = req.body;
      if (!userId || !preferences || typeof preferences !== 'object') {
        return res.status(400).json({ error: 'User ID and preferences required' });
      }

      try {
        if (sql) {
          await sql`
            UPDATE daybyday_users 
            SET preferences = ${JSON.stringify(preferences)}::jsonb, last_active = CURRENT_TIMESTAMP 
            WHERE id = ${userId}
          `;
          const rows = await sql`SELECT preferences FROM daybyday_users WHERE id = ${userId}`;
          return res.status(200).json({ success: true, preferences: rows[0]?.preferences || {} });
        }

        const u = memoryDb.getUser(userId);
        if (u) u.preferences = preferences;
        return res.status(200).json({ success: true, preferences });
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
          const partnerRows = await sql`SELECT * FROM daybyday_users WHERE UPPER(secret_code) = ${cleanCode} LIMIT 1`;
          if (partnerRows.length === 0) {
            return res.status(404).json({ error: 'No partner found with this secret code' });
          }
          const partner = partnerRows[0];
          if (partner.id === userId) {
            return res.status(400).json({ error: 'You cannot pair with your own code' });
          }

          const podCode = `POD_${Date.now().toString(36).toUpperCase()}`;
          // Deactivate old pairings
          await sql`UPDATE daybyday_pairings SET status = 'closed' WHERE user1_id = ${userId} OR user2_id = ${userId}`;
          await sql`UPDATE daybyday_pairings SET status = 'closed' WHERE user1_id = ${partner.id} OR user2_id = ${partner.id}`;

          await sql`
            INSERT INTO daybyday_pairings (user1_id, user2_id, pod_code, status)
            VALUES (${userId}, ${partner.id}, ${podCode}, 'active')
          `;

          const partnerHabits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${partner.id}`;
          return res.status(200).json({
            success: true,
            podCode,
            partner: { ...sanitizeUser(partner), habits: partnerHabits }
          });
        }

        // Memory Store Fallback
        const partner = memoryDb.getUser(cleanCode);
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        const podCode = `POD_${Date.now().toString(36).toUpperCase()}`;
        memoryDb.savePairing({ user1_id: userId, user2_id: partner.id, podCode, status: 'active' });
        return res.status(200).json({ success: true, podCode, partner: sanitizeUser(partner) });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: UNPAIR / GO SOLO
    if (action === 'unpair') {
      const { userId } = req.body;
      if (sql && userId) {
        await sql`UPDATE daybyday_pairings SET status = 'closed' WHERE user1_id = ${userId} OR user2_id = ${userId}`;
      }
      return res.status(200).json({ success: true, isSolo: true });
    }

    // ACTION: DELETE HABIT
    if (action === 'delete_habit') {
      const { userId, habitId } = req.body;
      if (sql && userId && habitId) {
        await sql`DELETE FROM daybyday_habits WHERE user_id = ${userId} AND habit_id = ${habitId}`;
      }
      return res.status(200).json({ success: true });
    }

    // ACTION: DELETE ACCOUNT PERMANENTLY (Full cloud purge)
    if (action === 'delete_account') {
      const { userId, username } = req.body;
      if (!userId && !username) {
        return res.status(400).json({ error: 'User ID or username required' });
      }

      try {
        if (sql) {
          let targetId = userId;
          if (!targetId && username) {
            const uRows = await sql`SELECT id FROM daybyday_users WHERE LOWER(username) = LOWER(${username}) LIMIT 1`;
            if (uRows.length > 0) targetId = uRows[0].id;
          }

          if (targetId) {
            // 1. Delete habits
            await sql`DELETE FROM daybyday_habits WHERE user_id = ${targetId}`;
            // 2. Delete pairings
            await sql`DELETE FROM daybyday_pairings WHERE user1_id = ${targetId} OR user2_id = ${targetId}`;
            // 3. Delete user account
            await sql`DELETE FROM daybyday_users WHERE id = ${targetId}`;
          }
        }

        // Memory store fallback
        if (username) {
          memoryDb.users?.delete(username.toLowerCase());
        }

        return res.status(200).json({ success: true, message: 'Account and associated habits permanently deleted' });
      } catch (err) {
        console.error('Account deletion error:', err);
        return res.status(500).json({ error: 'Failed to delete account: ' + err.message });
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
