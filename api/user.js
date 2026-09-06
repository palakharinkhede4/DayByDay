// Vercel Serverless Function: User Accounts, Authentication, Security Questions & Partner Pairing
import crypto from 'crypto';
import { getDb, ensureTables, memoryDb, isTablesInitialized } from './db.js';

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
  const code = safe.secretCode || safe.secret_code;
  safe.secretCode = code;
  safe.secret_code = code;
  return safe;
}

// Partner view: strip the secret code so other users cannot see it
function sanitizePartner(u) {
  if (!u) return null;
  const sanitized = sanitizeUser(u);
  if (sanitized) {
    delete sanitized.secretCode;
    delete sanitized.secret_code;
  }
  return sanitized;
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
  const clean = (username || 'DBD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'DBD';
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${clean}-${randNum}${randChar}`;
}

function generatePodCode(name) {
  const prefix = (name || 'POD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'POD';
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${prefix}-${randNum}${randChar}`;
}

async function resolveLatestApkCdn(explicitUrl) {
  try {
    let targetDownloadUrl = explicitUrl;
    let tagName = 'latest';
    let assetSize = null;
    let fileName = 'DayByDay.apk';

    if (!targetDownloadUrl) {
      const repoUrl = 'https://api.github.com/repos/palakharinkhede4/DayByDay/releases/latest';
      const ghRes = await fetch(repoUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DayByDay-App-Server',
        },
      });
      if (!ghRes.ok) {
        return { success: false, error: 'GitHub Releases API unavailable' };
      }
      const ghData = await ghRes.json();
      tagName = ghData.tag_name || 'latest';
      const apkAsset = Array.isArray(ghData.assets)
        ? ghData.assets.find((a) => a.name && (a.name.endsWith('.apk') || a.name === 'DayByDay.apk'))
        : null;

      if (!apkAsset || !apkAsset.browser_download_url) {
        return { success: false, error: 'No APK asset found in latest release' };
      }
      targetDownloadUrl = apkAsset.browser_download_url;
      assetSize = apkAsset.size;
      fileName = apkAsset.name;
    }

    // Follow redirect to obtain direct raw CDN link (release-assets.githubusercontent.com)
    let directCdnUrl = targetDownloadUrl;
    try {
      const headRes = await fetch(targetDownloadUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'DayByDay-CDN-Resolver',
        },
      });
      if (headRes.status >= 300 && headRes.status < 400) {
        const loc = headRes.headers.get('location');
        if (loc) {
          directCdnUrl = loc;
        }
      }
    } catch (e) {
      console.warn('Notice resolving CDN redirect:', e.message);
    }

    return {
      success: true,
      directApkUrl: directCdnUrl,
      rawGithubUrl: targetDownloadUrl,
      version: tagName,
      apkSize: assetSize,
      fileName,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default async function handler(req, res) {
  // CORS Headers for Web & Native Apps
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!isTablesInitialized()) {
    await ensureTables();
  }
  const sql = getDb();

  // 1. GET: FETCH USER PROFILE, HABITS, OR RESOLVE DIRECT APK CDN
  if (req.method === 'GET') {
    const { username, code, action, url } = req.query;

    if (action === 'resolve_latest_apk' || action === 'resolve_cdn') {
      const result = await resolveLatestApkCdn(url);
      return res.status(result.success ? 200 : 500).json(result);
    }

    if (!username && !code) {
      return res.status(400).json({ error: 'Username or secret code required' });
    }

    try {
      if (sql) {
        let user = null;
        const cleanCode = (code || '').trim().toUpperCase();
        const cleanUsername = (username || '').trim().replace(/^@/, '');

        // 1. Check by explicit code if provided
        if (cleanCode) {
          const rows = await sql`SELECT * FROM daybyday_users WHERE UPPER(secret_code) = ${cleanCode} LIMIT 1`;
          user = rows[0] || null;
        }

        // 2. Check by username or secret_code if username param was supplied (handles codes passed via username parameter)
        if (!user && cleanUsername) {
          const rows = await sql`
            SELECT * FROM daybyday_users 
            WHERE LOWER(username) = LOWER(${cleanUsername}) 
               OR UPPER(secret_code) = UPPER(${cleanUsername})
            LIMIT 1
          `;
          user = rows[0] || null;
        }

        // 3. Robust fallback: try looking up either value against both columns
        if (!user) {
          const fallbackTerm = cleanCode || cleanUsername;
          const rows = await sql`
            SELECT * FROM daybyday_users 
            WHERE UPPER(secret_code) = UPPER(${fallbackTerm})
               OR LOWER(username) = LOWER(${fallbackTerm})
            LIMIT 1
          `;
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
          const partnerRows = await sql`SELECT id, username, display_name, avatar, preferences FROM daybyday_users WHERE id = ${partnerId}`;
          const partnerHabits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${partnerId}`;
          if (partnerRows.length > 0) {
            partner = { ...sanitizePartner(partnerRows[0]), habits: partnerHabits.map(formatHabitFromRow) };
          }
        }

        // Check if user belongs to an active Together Group Pod
        let groupPod = null;
        try {
          const groupRows = await sql`
            SELECT * FROM daybyday_group_pods 
            WHERE members::text LIKE ${'%"' + user.id + '"%'}
               OR members::text LIKE ${'%"' + user.username + '"%'}
            ORDER BY updated_at DESC
            LIMIT 1
          `;
          if (groupRows.length > 0) {
            const gr = groupRows[0];
            groupPod = {
              id: gr.id,
              name: gr.name,
              code: gr.code,
              members: gr.members || [],
              sharedGoals: gr.shared_goals || [],
              createdAt: gr.created_at,
              maxMembers: 10,
            };
          }
        } catch (gpErr) {
          console.warn('Notice querying user group pod:', gpErr.message);
        }

        const formattedHabits = habits.map(formatHabitFromRow);
        const totalHabits = formattedHabits.length;
        const completedCount = formattedHabits.filter(h => {
          const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
          return isBool ? Boolean(h.user1) : (Number(h.user1) || 0) >= (Number(h.target) || 1);
        }).length;
        const todayPercent = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;
        const streak = formattedHabits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);

        return res.status(200).json({
          user: sanitizeUser(user),
          habits: formattedHabits,
          preferences: user.preferences || {},
          partner,
          podCode,
          groupPod,
          isSolo: !partner,
          todayPercent,
          streak,
        });
      }

      // Memory Store Fallback
      const lookup = (code || username || '').trim().replace(/^@/, '');
      const user = memoryDb.getUser(lookup);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const habits = memoryDb.getUserHabits(user.id);
      const totalHabits = habits.length;
      const completedCount = habits.filter(h => {
        const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
        return isBool ? Boolean(h.user1) : (Number(h.user1) || 0) >= (Number(h.target) || 1);
      }).length;
      const todayPercent = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;
      const streak = habits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);

      return res.status(200).json({
        user: sanitizeUser(user),
        habits,
        preferences: user.preferences || {},
        partner: null,
        podCode: null,
        isSolo: true,
        todayPercent,
        streak,
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

          // Ensure user has a distinct, unique secret code (upgrade legacy/missing/dummy codes)
          if (!user.secret_code || user.secret_code === 'DAY-1000' || user.secret_code === 'DBD-1000' || user.secret_code === 'DUO-1000') {
            user.secret_code = generateSecretCode(user.username);
            try {
              await sql`UPDATE daybyday_users SET secret_code = ${user.secret_code} WHERE id = ${user.id}`;
            } catch (err) {
              console.warn('Notice updating legacy secret_code:', err.message);
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
            const partnerRows = await sql`SELECT id, username, display_name, avatar, preferences FROM daybyday_users WHERE id = ${partnerId}`;
            const partnerHabits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${partnerId}`;
            if (partnerRows.length > 0) {
              partner = { ...sanitizePartner(partnerRows[0]), habits: partnerHabits.map(formatHabitFromRow) };
            }
          }

          // Check if user belongs to an active Together Group Pod
          let groupPod = null;
          try {
            const groupRows = await sql`
              SELECT * FROM daybyday_group_pods 
              WHERE members::text LIKE ${'%"' + user.id + '"%'}
                 OR members::text LIKE ${'%"' + user.username + '"%'}
              ORDER BY updated_at DESC
              LIMIT 1
            `;
            if (groupRows.length > 0) {
              const gr = groupRows[0];
              groupPod = {
                id: gr.id,
                name: gr.name,
                code: gr.code,
                members: gr.members || [],
                sharedGoals: gr.shared_goals || [],
                createdAt: gr.created_at,
                maxMembers: 10,
              };
            }
          } catch (gpErr) {
            console.warn('Notice querying user group pod on login:', gpErr.message);
          }

          return res.status(200).json({
            user: sanitizeUser(user),
            habits: habits.map(formatHabitFromRow),
            preferences: user.preferences || {},
            partner,
            podCode,
            groupPod,
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
            partner: { ...sanitizePartner(partner), habits: partnerHabits.map(formatHabitFromRow) }
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

    // ACTION: CREATE GROUP POD (Up to 10 members)
    if (action === 'create_group_pod') {
      const { userId, name, podCode, sharedGoals } = req.body;
      const cleanName = (name || 'Focus Group').trim();
      const cleanCode = (podCode || generatePodCode(cleanName)).trim().toUpperCase();
      const id = `gpod_${Date.now().toString(36)}`;

      try {
        let ownerMember = {
          id: userId || 'usr_owner',
          username: 'owner',
          displayName: 'Owner',
          avatar: 'star',
          profilePicture: null,
          role: 'Owner',
          todayPercent: 0,
          streak: 0,
        };

        if (sql && userId) {
          const uRows = await sql`SELECT id, username, display_name, avatar, preferences FROM daybyday_users WHERE id = ${userId}`;
          if (uRows.length > 0) {
            const u = uRows[0];
            const habits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${userId}`;
            const formatted = habits.map(formatHabitFromRow);
            const total = formatted.length;
            const completed = formatted.filter(h => {
              const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
              return isBool ? Boolean(h.user1) : (Number(h.user1) || 0) >= (Number(h.target) || 1);
            }).length;
            ownerMember = {
              id: u.id,
              username: u.username,
              displayName: u.display_name || u.username,
              avatar: u.avatar || 'star',
              profilePicture: u.preferences?.profilePicture || null,
              role: 'Owner',
              todayPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
              streak: formatted.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0),
            };
          }
        } else if (userId) {
          const u = memoryDb.getUser(userId);
          if (u) {
            ownerMember = {
              id: u.id,
              username: u.username,
              displayName: u.displayName || u.username,
              avatar: u.avatar || 'star',
              profilePicture: u.preferences?.profilePicture || null,
              role: 'Owner',
              todayPercent: 0,
              streak: 0,
            };
          }
        }

        const goals = Array.isArray(sharedGoals) && sharedGoals.length > 0 ? sharedGoals : [
          { id: 'sg_steps', name: 'Team 10k Steps', target: 10000, unit: 'steps', current: 0 },
          { id: 'sg_water', name: 'Daily Hydration', target: 8, unit: 'glasses', current: 0 },
        ];

        const podRecord = {
          id,
          name: cleanName,
          code: cleanCode,
          members: [ownerMember],
          sharedGoals: goals,
          createdAt: new Date().toISOString(),
          maxMembers: 10,
        };

        if (sql) {
          await sql`
            INSERT INTO daybyday_group_pods (id, name, code, members, shared_goals, created_at, updated_at)
            VALUES (${id}, ${cleanName}, ${cleanCode}, ${JSON.stringify(podRecord.members)}::jsonb, ${JSON.stringify(goals)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (code) DO UPDATE SET
              name = EXCLUDED.name,
              members = EXCLUDED.members,
              shared_goals = EXCLUDED.shared_goals,
              updated_at = CURRENT_TIMESTAMP
          `;
        }
        memoryDb.saveGroupPod(podRecord);

        return res.status(200).json({ success: true, pod: podRecord });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to create group pod: ' + err.message });
      }
    }

    // ACTION: JOIN GROUP POD
    if (action === 'join_group_pod') {
      const { userId, podCode } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      if (!cleanCode) {
        return res.status(400).json({ error: 'Pod code is required' });
      }

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
              createdAt: r.created_at,
              maxMembers: 10,
            };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) {
          return res.status(404).json({ error: `Group pod ${cleanCode} not found. Check the code and try again.` });
        }

        // Fetch joining user's live profile & completion
        let memberObj = {
          id: userId || `usr_${Date.now().toString(36)}`,
          username: 'member',
          displayName: 'Member',
          avatar: 'star',
          profilePicture: null,
          role: 'Member',
          todayPercent: 0,
          streak: 0,
        };

        if (sql && userId) {
          const uRows = await sql`SELECT id, username, display_name, avatar, preferences FROM daybyday_users WHERE id = ${userId}`;
          if (uRows.length > 0) {
            const u = uRows[0];
            const habits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${userId}`;
            const formatted = habits.map(formatHabitFromRow);
            const total = formatted.length;
            const completed = formatted.filter(h => {
              const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
              return isBool ? Boolean(h.user1) : (Number(h.user1) || 0) >= (Number(h.target) || 1);
            }).length;
            memberObj = {
              id: u.id,
              username: u.username,
              displayName: u.display_name || u.username,
              avatar: u.avatar || 'star',
              profilePicture: u.preferences?.profilePicture || null,
              role: 'Member',
              todayPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
              streak: formatted.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0),
            };
          }
        } else if (userId) {
          const u = memoryDb.getUser(userId);
          if (u) {
            memberObj = {
              id: u.id,
              username: u.username,
              displayName: u.displayName || u.username,
              avatar: u.avatar || 'star',
              profilePicture: u.preferences?.profilePicture || null,
              role: 'Member',
              todayPercent: 0,
              streak: 0,
            };
          }
        }

        const existingIdx = pod.members.findIndex(m => m.id === memberObj.id || m.username === memberObj.username);
        if (existingIdx >= 0) {
          pod.members[existingIdx] = { ...pod.members[existingIdx], ...memberObj };
        } else {
          if (pod.members.length >= 10) {
            return res.status(400).json({ error: 'This group pod has reached the maximum capacity of 10 members.' });
          }
          pod.members.push(memberObj);
        }

        if (sql) {
          await sql`
            UPDATE daybyday_group_pods 
            SET members = ${JSON.stringify(pod.members)}::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(code) = ${cleanCode}
          `;
        }
        memoryDb.saveGroupPod(pod);

        return res.status(200).json({ success: true, pod });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to join group pod: ' + err.message });
      }
    }

    // ACTION: GET GROUP POD (Lean read-only refresh of members & shared goals, zero writes on read)
    if (action === 'get_group_pod') {
      const { podCode } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      if (!cleanCode) return res.status(400).json({ error: 'Pod code required' });

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
              createdAt: r.created_at,
              maxMembers: 10,
            };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });

        // Efficient read-only profile sync: Batch query user profiles in ONE query, without writing to DB
        if (sql && pod.members && pod.members.length > 0) {
          const memberIds = pod.members.map((m) => m.id).filter(Boolean);
          if (memberIds.length > 0) {
            try {
              const uRows = await sql`
                SELECT id, username, display_name, avatar, preferences
                FROM daybyday_users
                WHERE id = ANY(${memberIds})
              `;
              const uMap = new Map(uRows.map((u) => [u.id, u]));

              pod.members = pod.members.map((m) => {
                const u = uMap.get(m.id);
                if (u) {
                  return {
                    ...m,
                    username: u.username,
                    displayName: u.display_name || u.username,
                    avatar: u.avatar || m.avatar || 'star',
                    profilePicture: u.preferences?.profilePicture || m.profilePicture || null,
                  };
                }
                return m;
              });
            } catch (err) {
              // Non-blocking lookup fallback
            }
          }
        }

        return res.status(200).json({ success: true, pod });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: GET USER'S CURRENT GROUP POD (BY USER ID OR USERNAME)
    if (action === 'get_user_group_pod') {
      const { userId, username } = req.body;
      const cleanU = (username || '').trim().replace(/^@/, '');
      try {
        let pod = null;
        if (sql) {
          const groupRows = await sql`
            SELECT * FROM daybyday_group_pods 
            WHERE ( ${userId ? sql`members::text LIKE ${'%"' + userId + '"%'}` : sql`FALSE`} )
               OR ( ${cleanU ? sql`members::text LIKE ${'%"' + cleanU + '"%'}` : sql`FALSE`} )
            ORDER BY updated_at DESC
            LIMIT 1
          `;
          if (groupRows.length > 0) {
            const r = groupRows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
              createdAt: r.created_at,
              maxMembers: 10,
            };
          }
        }
        return res.status(200).json({ success: true, pod });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: ADD SHARED GROUP GOAL (Full habit settings, persisted immediately to DB)
    if (action === 'add_group_goal') {
      const { podCode, goal } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      if (!cleanCode || !goal || !goal.name) {
        return res.status(400).json({ error: 'Pod code and goal details required' });
      }

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
              createdAt: r.created_at,
              maxMembers: 10,
            };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });

        const newGoal = {
          id: goal.id || `sg_${Date.now().toString(36)}`,
          name: goal.name.trim(),
          target: Math.max(1, Number(goal.target) || 1),
          unit: (goal.unit || 'times').trim(),
          icon: goal.icon || 'target',
          category: goal.category || 'Daily',
          delta: Math.max(1, Number(goal.delta) || 1),
          createdBy: goal.createdBy || 'member',
          current: 0,
          memberProgress: goal.memberProgress || {},
          createdAt: new Date().toISOString(),
        };

        const updatedGoals = [...(pod.sharedGoals || []), newGoal];
        pod.sharedGoals = updatedGoals;

        if (sql) {
          await sql`
            UPDATE daybyday_group_pods
            SET shared_goals = ${JSON.stringify(updatedGoals)}::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(code) = ${cleanCode}
          `;
        }
        memoryDb.saveGroupPod(pod);

        return res.status(200).json({ success: true, pod, goal: newGoal });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to add shared goal: ' + err.message });
      }
    }

    // ACTION: UPDATE GROUP SHARED GOAL (Individual member progress & aggregate tracking)
    if (action === 'update_group_goal') {
      const { podCode, goalId, delta, userId, value, completed } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      if (!cleanCode || !goalId) return res.status(400).json({ error: 'Pod code and goal ID required' });

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
              createdAt: r.created_at,
              maxMembers: 10,
            };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });

        const updatedGoals = (pod.sharedGoals || []).map((g) => {
          if (g.id === goalId) {
            const memberProgress = { ...(g.memberProgress || {}) };

            if (userId) {
              const currentMemberData = memberProgress[userId] || { value: 0, completed: false };
              let nextMemberVal = value !== undefined
                ? Math.max(0, Number(value))
                : Math.max(0, (Number(currentMemberData.value) || 0) + (Number(delta) || 0));

              const isCompleted = completed !== undefined
                ? Boolean(completed)
                : nextMemberVal >= (Number(g.target) || 1);

              memberProgress[userId] = {
                value: nextMemberVal,
                completed: isCompleted,
                updatedAt: new Date().toISOString(),
              };
            }

            // Total aggregated current value across members
            const totalSum = Object.values(memberProgress).reduce(
              (acc, m) => acc + (Number(m.value) || 0),
              0
            );

            return {
              ...g,
              current: totalSum,
              memberProgress,
            };
          }
          return g;
        });

        pod.sharedGoals = updatedGoals;
        if (sql) {
          await sql`
            UPDATE daybyday_group_pods 
            SET shared_goals = ${JSON.stringify(updatedGoals)}::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(code) = ${cleanCode}
          `;
        }
        memoryDb.saveGroupPod(pod);

        return res.status(200).json({ success: true, pod });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: DELETE SHARED GROUP GOAL
    if (action === 'delete_group_goal') {
      const { podCode, goalId } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      if (!cleanCode || !goalId) return res.status(400).json({ error: 'Pod code and goal ID required' });

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
              createdAt: r.created_at,
              maxMembers: 10,
            };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });

        const updatedGoals = (pod.sharedGoals || []).filter((g) => g.id !== goalId);
        pod.sharedGoals = updatedGoals;

        if (sql) {
          await sql`
            UPDATE daybyday_group_pods 
            SET shared_goals = ${JSON.stringify(updatedGoals)}::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(code) = ${cleanCode}
          `;
        }
        memoryDb.saveGroupPod(pod);

        return res.status(200).json({ success: true, pod });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: EDIT GROUP SHARED GOAL (title, target, unit, delta, category)
    if (action === 'edit_group_goal') {
      const { podCode, goalId, updates } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      if (!cleanCode || !goalId || !updates) {
        return res.status(400).json({ error: 'Pod code, goal ID and updates required' });
      }

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
              createdAt: r.created_at,
              maxMembers: 10,
            };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });

        const updatedGoals = (pod.sharedGoals || []).map((g) => {
          if (g.id === goalId) {
            return {
              ...g,
              name: updates.name ? updates.name.trim() : g.name,
              target: updates.target ? Math.max(1, Number(updates.target) || 1) : g.target,
              unit: updates.unit ? updates.unit.trim() : g.unit,
              delta: updates.delta ? Math.max(1, Number(updates.delta) || 1) : g.delta,
              category: updates.category || g.category,
            };
          }
          return g;
        });

        pod.sharedGoals = updatedGoals;
        if (sql) {
          await sql`
            UPDATE daybyday_group_pods 
            SET shared_goals = ${JSON.stringify(updatedGoals)}::jsonb, updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(code) = ${cleanCode}
          `;
        }
        memoryDb.saveGroupPod(pod);

        return res.status(200).json({ success: true, pod });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: RESOLVE DIRECT RAW APK RELEASE ASSET (Bypasses GitHub 302 redirect for instant Chrome downloads)
    if (action === 'resolve_latest_apk') {
      try {
        const ghRes = await fetch('https://api.github.com/repos/palakharinkhede4/DayByDay/releases/latest', {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'DayByDay-App'
          }
        });
        if (!ghRes.ok) throw new Error('GitHub API unavailable');
        const ghData = await ghRes.json();
        const apkAsset = Array.isArray(ghData.assets)
          ? ghData.assets.find((a) => a.name && (a.name.endsWith('.apk') || a.name === 'DayByDay.apk'))
          : null;
        if (!apkAsset || !apkAsset.browser_download_url) {
          return res.status(404).json({ error: 'No APK found in release' });
        }

        // Perform HEAD request with redirect: manual to capture the signed CDN URL
        let directCdnUrl = apkAsset.browser_download_url;
        try {
          const headRes = await fetch(apkAsset.browser_download_url, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { 'User-Agent': 'DayByDay-App' }
          });
          const loc = headRes.headers.get('location');
          if (loc) directCdnUrl = loc;
        } catch {}

        return res.status(200).json({
          success: true,
          directCdnUrl,
          tagName: ghData.tag_name,
          apkName: apkAsset.name,
          apkSize: apkAsset.size,
        });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to resolve APK: ' + err.message });
      }
    }

    // ACTION: SEND CHEER / ENCOURAGEMENT (Real cross-user delivery)
    if (action === 'send_cheer') {
      const { toUserId, toUsername, fromUserId, fromUsername, fromName, fromAvatar, podCode, message, goalName } = req.body;
      const cheerMessage = (message || (goalName ? `Encouraged you for ${goalName}! 🔥` : 'Keep crushing your goals! 🔥')).trim();

      try {
        let recipientId = toUserId;
        let recipientUsername = toUsername;
        if (sql && (toUserId || toUsername)) {
          const targetLookup = (toUserId || toUsername).trim();
          const found = await sql`
            SELECT id, username FROM daybyday_users
            WHERE id = ${targetLookup}
               OR LOWER(username) = LOWER(${targetLookup})
               OR UPPER(secret_code) = UPPER(${targetLookup})
            LIMIT 1
          `;
          if (found.length > 0) {
            recipientId = found[0].id;
            recipientUsername = found[0].username;
          }
        }

        if (
          (fromUserId && recipientId && String(fromUserId) === String(recipientId)) ||
          (fromUsername && recipientUsername && String(fromUsername).toLowerCase() === String(recipientUsername).toLowerCase())
        ) {
          return res.status(200).json({ success: true, message: 'Self cheer skipped' });
        }

        if (sql) {
          await sql`
            INSERT INTO daybyday_cheers (
              to_user_id, from_user_id, from_username, from_name, from_avatar, pod_code, message, goal_name, is_read
            )
            VALUES (
              ${recipientId || recipientUsername || null}, ${fromUserId || null}, ${fromUsername || 'friend'},
              ${fromName || fromUsername || 'Friend'}, ${fromAvatar || 'flame'}, ${podCode || null}, ${cheerMessage}, ${goalName || null}, false
            )
          `;
        }

        memoryDb.addCheer({
          to_user_id: recipientId || recipientUsername,
          from_user_id: fromUserId,
          from_username: fromUsername,
          from_name: fromName,
          from_avatar: fromAvatar,
          pod_code: podCode,
          message: cheerMessage,
          goal_name: goalName,
          is_read: false,
        });

        return res.status(200).json({ success: true, message: 'Encouragement delivered!' });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to deliver cheer: ' + err.message });
      }
    }

    // ACTION: GET CHEERS (Fetch incoming cheers for user or group pod)
    if (action === 'get_cheers') {
      const { userId, username, podCode } = req.body;
      const targetId = userId || username;
      const cleanUsername = (username || userId || '').trim();

      try {
        let cheers = [];
        if (sql) {
          if (targetId && podCode) {
            cheers = await sql`
              SELECT * FROM daybyday_cheers
              WHERE (
                to_user_id = ${targetId} 
                OR to_user_id = ${cleanUsername} 
                OR LOWER(to_user_id) = LOWER(${cleanUsername})
                OR (to_user_id IS NULL AND pod_code = ${podCode})
              )
              AND (from_user_id IS NULL OR from_user_id != ${targetId})
              AND (from_username IS NULL OR LOWER(from_username) != LOWER(${cleanUsername}))
              AND is_read = false
              ORDER BY created_at DESC LIMIT 20
            `;
          } else if (targetId) {
            cheers = await sql`
              SELECT * FROM daybyday_cheers
              WHERE (
                to_user_id = ${targetId} 
                OR to_user_id = ${cleanUsername} 
                OR LOWER(to_user_id) = LOWER(${cleanUsername})
              )
              AND (from_user_id IS NULL OR from_user_id != ${targetId})
              AND (from_username IS NULL OR LOWER(from_username) != LOWER(${cleanUsername}))
              AND is_read = false
              ORDER BY created_at DESC LIMIT 20
            `;
          } else if (podCode) {
            cheers = await sql`
              SELECT * FROM daybyday_cheers
              WHERE pod_code = ${podCode} 
                AND (from_user_id IS NULL OR from_user_id != ${targetId})
                AND (from_username IS NULL OR LOWER(from_username) != LOWER(${cleanUsername}))
                AND is_read = false
              ORDER BY created_at DESC LIMIT 20
            `;
          }
        } else {
          cheers = memoryDb.getCheersForUser(targetId, podCode) || [];
          cheers = cheers.filter(
            (c) =>
              !c.is_read &&
              c.from_user_id !== targetId &&
              c.from_username?.toLowerCase() !== cleanUsername.toLowerCase()
          );
        }

        return res.status(200).json({ success: true, cheers: cheers || [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: MARK CHEERS READ
    if (action === 'mark_cheers_read') {
      const { userId, username, podCode } = req.body;
      const targetId = userId || username;
      const cleanUsername = (username || userId || '').trim();
      try {
        if (sql && targetId) {
          await sql`
            UPDATE daybyday_cheers
            SET is_read = true
            WHERE to_user_id = ${targetId} 
               OR to_user_id = ${cleanUsername}
               OR LOWER(to_user_id) = LOWER(${cleanUsername})
               OR (to_user_id IS NULL AND pod_code = ${podCode || null})
          `;
          // Also cleanup any lingering self-cheers in DB
          await sql`
            UPDATE daybyday_cheers
            SET is_read = true
            WHERE from_user_id = to_user_id 
               OR LOWER(from_username) = LOWER(to_user_id)
          `;
        }
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: RESOLVE LATEST APK DIRECT CDN URL
    if (action === 'resolve_latest_apk' || action === 'resolve_cdn') {
      const result = await resolveLatestApkCdn(req.body?.url);
      return res.status(result.success ? 200 : 500).json(result);
    }

    // ACTION: LEAVE GROUP POD
    if (action === 'leave_group_pod') {
      const { podCode, userId } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      if (!cleanCode || !userId) return res.status(400).json({ error: 'Pod code and user ID required' });

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            pod = {
              id: r.id,
              name: r.name,
              code: r.code,
              members: r.members || [],
              sharedGoals: r.shared_goals || [],
            };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (pod) {
          const remaining = pod.members.filter(m => m.id !== userId);
          if (sql) {
            if (remaining.length === 0) {
              await sql`DELETE FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode}`;
            } else {
              await sql`UPDATE daybyday_group_pods SET members = ${JSON.stringify(remaining)}::jsonb WHERE UPPER(code) = ${cleanCode}`;
            }
          }
        }
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
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

    // ACTION: UPGRADE ALL CODES (Bulk assignment for all existing users and pods)
    if (action === 'upgrade_all_codes') {
      try {
        if (sql) {
          const allUsers = await sql`SELECT id, username, secret_code FROM daybyday_users`;
          const allPods = await sql`SELECT id, name, code FROM daybyday_group_pods`;
          const allPairs = await sql`SELECT id, pod_code FROM daybyday_pairings WHERE status = 'active'`;
          let upgradedUsers = 0;
          let upgradedPods = 0;
          let upgradedPairs = 0;
          const userSummary = [];

          // Detect duplicate codes across users
          const codeCounts = {};
          for (const u of allUsers) {
            const c = (u.secret_code || '').toUpperCase();
            codeCounts[c] = (codeCounts[c] || 0) + 1;
          }

          for (const u of allUsers) {
            const isDup = codeCounts[(u.secret_code || '').toUpperCase()] > 1;
            const isLegacy = !u.secret_code || u.secret_code === 'DAY-1000' || u.secret_code === 'DBD-1000' || u.secret_code === 'DUO-1000';
            const shouldUpgrade = Boolean(req.body?.force) || isLegacy || isDup;
            let finalCode = u.secret_code;

            if (shouldUpgrade) {
              finalCode = generateSecretCode(u.username);
              await sql`UPDATE daybyday_users SET secret_code = ${finalCode} WHERE id = ${u.id}`;
              upgradedUsers++;
            }
            userSummary.push({ username: u.username, secretCode: finalCode });
          }

          for (const p of allPods) {
            const shouldUpgrade = Boolean(req.body?.force) || !p.code || p.code === 'DAY-1000' || p.code === 'DBD-1000' || p.code === 'POD-1000';
            if (shouldUpgrade) {
              const newCode = generatePodCode(p.name);
              await sql`UPDATE daybyday_group_pods SET code = ${newCode} WHERE id = ${p.id}`;
              upgradedPods++;
            }
          }

          for (const pr of allPairs) {
            const shouldUpgrade = Boolean(req.body?.force) || !pr.pod_code || pr.pod_code === 'DAY-1000' || pr.pod_code === 'DBD-1000' || pr.pod_code === 'POD-1000';
            if (shouldUpgrade) {
              const randNum = Math.floor(1000 + Math.random() * 9000);
              const newCode = `POD_${Date.now().toString(36).toUpperCase()}_${randNum}`;
              await sql`UPDATE daybyday_pairings SET pod_code = ${newCode} WHERE id = ${pr.id}`;
              upgradedPairs++;
            }
          }

          return res.status(200).json({
            success: true,
            message: `Processed ${allUsers.length} users, ${allPods.length} group pods, and ${allPairs.length} pairings. Upgraded ${upgradedUsers} users and ${upgradedPods} pods.`,
            users: userSummary,
            totalUsers: allUsers.length,
            totalPods: allPods.length,
            totalPairs: allPairs.length
          });
        }

        return res.status(200).json({ success: true, message: 'In-memory fallback store active' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
