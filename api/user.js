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

export function cleanHistory(raw) {
  const result = {};
  function extract(item) {
    if (item === null || item === undefined) return;
    if (typeof item === 'string') {
      try {
        let parsed = JSON.parse(item);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        extract(parsed);
      } catch {}
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(extract);
      return;
    }
    if (typeof item === 'object') {
      for (const [k, v] of Object.entries(item)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
          let val = v;
          if (typeof val === 'string') {
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
            else if (!isNaN(Number(val))) val = Number(val);
          }
          const isBool = typeof val === 'boolean';
          const numVal = isBool ? (val ? 1 : 0) : (Number(val) || 0);

          if (result[k] === undefined) {
            result[k] = isBool ? val : numVal;
          } else {
            const curIsBool = typeof result[k] === 'boolean';
            const curNum = curIsBool ? (result[k] ? 1 : 0) : (Number(result[k]) || 0);
            if (numVal > curNum) {
              result[k] = isBool ? val : numVal;
            }
          }
        } else if (/^\d+$/.test(k) || k === 'history' || typeof v === 'object') {
          extract(v);
        }
      }
    }
  }
  extract(raw);
  return result;
}

function sanitizeUser(u) {
  if (!u) return null;
  const { password_hash, salt, security_answer_hash, ...safe } = u;
  safe.preferences = parseSafeJson(safe.preferences, {});
  if (safe.preferences.profilePicture) {
    safe.profilePicture = safe.preferences.profilePicture;
  }
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

function getIstDateKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(date));
  } catch {
    const d = new Date(date);
    // Fallback +5:30 offset
    const ist = new Date(d.getTime() + (330 * 60 * 1000));
    return ist.toISOString().slice(0, 10);
  }
}

function getIstYesterdayKey(date = new Date()) {
  try {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return getIstDateKey(d);
  } catch {
    return null;
  }
}

function formatHabitFromRow(row, explicitSql = null) {
  if (!row) return null;
  const sql = (typeof explicitSql === 'function') ? explicitSql : getDb();
  const todayKey = getIstDateKey();
  const yesterdayKey = getIstYesterdayKey();
  const history = cleanHistory(row.history);

  // Determine if this habit row was updated today in IST
  let wasUpdatedToday = false;
  let lastUpdatedDateKey = null;
  if (row.updated_at) {
    try {
      lastUpdatedDateKey = getIstDateKey(new Date(row.updated_at));
      wasUpdatedToday = (lastUpdatedDateKey === todayKey);
    } catch {
      wasUpdatedToday = false;
    }
  }

  const isBool = row.unit === 'check';
  const target = Number(row.target) || 1;
  const rowTodayVal = (row.today_value !== undefined && row.today_value !== null) ? (Number(row.today_value) || 0) : 0;
  // 1. If row was NOT updated today in IST:
  // Any value in row.today_value belongs to lastUpdatedDateKey (yesterday or earlier)
  if (!wasUpdatedToday && lastUpdatedDateKey) {
    if (history[lastUpdatedDateKey] === undefined && (rowTodayVal > 0 || row.completed)) {
      history[lastUpdatedDateKey] = isBool ? Boolean(row.completed) : rowTodayVal;
    }
    // And today's history entry cannot hold yesterday's lingering value
    if (history[todayKey] !== undefined && history[todayKey] !== 0 && history[todayKey] !== false) {
      history[todayKey] = isBool ? false : 0;
    }
  }

  // 3. Authoritative today's value:
  // If row was NOT updated today, todayVal is strictly 0.
  let todayVal;
  if (!wasUpdatedToday) {
    todayVal = isBool ? false : 0;
  } else if (history[todayKey] !== undefined) {
    todayVal = isBool ? Boolean(history[todayKey]) : (Number(history[todayKey]) || 0);
  } else {
    todayVal = isBool ? Boolean(row.completed) : rowTodayVal;
  }

  const isCompleted = isBool ? Boolean(todayVal) : (Number(todayVal) || 0) >= target;

  return {
    id: row.habit_id || String(row.id),
    name: row.name || 'Habit',
    category: row.category || 'Daily',
    description: row.description || '',
    target,
    unit: row.unit || '',
    icon: row.icon || 'star',
    user1: todayVal,
    user2: 0,
    completed: isCompleted,
    reminderTime: row.reminder_time || '',
    reminderDays: row.reminder_days ? row.reminder_days.split(',') : [],
    streak: Number(row.streak) || 0,
    history,
  };
}

function formatGroupPodFromRow(row, sql = null) {
  if (!row) return null;
  const todayKey = getIstDateKey();
  let rawGoals = parseSafeJson(row.shared_goals, []);

  // Self-healing database check: detect corrupted single-char spread goals or string-split artifacts
  if (Array.isArray(rawGoals) && rawGoals.length > 0) {
    const hasCorruptedGoals = rawGoals.some(
      (g) => !g || typeof g !== 'object' || !g.name || typeof g.name !== 'string' || g['0'] !== undefined
    );

    if (hasCorruptedGoals) {
      console.warn(`[AutoHeal Pod] Detected corrupted goals in pod ${row.code || row.id} (total items: ${rawGoals.length}). Healing...`);
      const fragments = rawGoals.filter((g) => g && (g['0'] !== undefined || typeof g === 'string'));
      let reconstructed = [];
      if (fragments.length > 0) {
        try {
          const jsonStr = fragments.map((g) => (typeof g === 'string' ? g : g['0'] !== undefined ? g['0'] : '')).join('');
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            reconstructed = parsed;
          }
        } catch (healParseErr) {
          console.warn('[AutoHeal Pod] JSON reconstruct failed:', healParseErr.message);
        }
      }

      // Keep any valid whole goals that were appended (e.g., Sleep)
      const validWholeGoals = rawGoals.filter(
        (g) => g && typeof g === 'object' && typeof g.name === 'string' && g.name.trim() !== '' && g['0'] === undefined
      );

      // Merge and deduplicate by id or lowercase trimmed name
      const goalMap = new Map();
      [...reconstructed, ...validWholeGoals].forEach((g) => {
        if (g && typeof g === 'object' && typeof g.name === 'string' && g.name.trim() !== '') {
          const key = (g.id || g.name).toLowerCase().trim();
          goalMap.set(key, g);
        }
      });

      const healedGoals = Array.from(goalMap.values());
      rawGoals = healedGoals;
    }
  }

  // Filter rawGoals to strictly valid goal objects with string names
  const validGoalsList = (Array.isArray(rawGoals) ? rawGoals : []).filter(
    (sg) => sg && typeof sg === 'object' && typeof sg.name === 'string' && sg.name.trim() !== '' && sg['0'] === undefined
  );

  const cleanGoals = validGoalsList.map((sg) => {
    const memberProgress = { ...(sg.memberProgress || {}) };
    let activeTotal = 0;
    const cleanMemberProg = {};

    for (const [k, v] of Object.entries(memberProgress)) {
      let isToday = false;
      let val = 0;
      let isDone = false;

      if (v && typeof v === 'object') {
        const updateDate = v.updatedAt ? getIstDateKey(new Date(v.updatedAt)) : null;
        isToday = (updateDate === todayKey);
        val = isToday ? (Number(v.value) || 0) : 0;
        isDone = isToday ? Boolean(v.completed) : false;
        cleanMemberProg[k] = {
          ...v,
          value: val,
          completed: isDone,
        };
      } else {
        const podUpdateDate = row.updated_at ? getIstDateKey(new Date(row.updated_at)) : null;
        isToday = (podUpdateDate === todayKey);
        val = isToday ? (Number(v) || 0) : 0;
        cleanMemberProg[k] = val;
      }
      activeTotal += val;
    }

    return {
      ...sg,
      current: activeTotal,
      memberProgress: cleanMemberProg,
    };
  });

  return {
    id: row.id,
    name: row.name,
    code: (row.code || '').toUpperCase(),
    members: parseSafeJson(row.members, []),
    sharedGoals: cleanGoals,
    maxMembers: row.max_members || 10,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

async function findUserByIdentifier(sql, { userId, code, secretCode, username }) {
  const cleanCode = (secretCode || code || '').trim().toUpperCase();
  const cleanUser = (username || '').trim().toLowerCase().replace(/^@/, '');
  const uid = (userId || '').trim();

  if (sql) {
    if (uid) {
      const rows = await sql`SELECT * FROM daybyday_users WHERE id = ${uid} LIMIT 1`;
      if (rows.length > 0) return rows[0];
    }
    if (cleanCode) {
      const rows = await sql`SELECT * FROM daybyday_users WHERE UPPER(secret_code) = ${cleanCode} LIMIT 1`;
      if (rows.length > 0) return rows[0];
    }
    if (cleanUser) {
      const rows = await sql`SELECT * FROM daybyday_users WHERE LOWER(username) = ${cleanUser} LIMIT 1`;
      if (rows.length > 0) return rows[0];
    }
  } else {
    const lookup = (cleanCode || cleanUser || uid).replace(/^@/, '');
    const memUser = memoryDb.getUser(lookup);
    if (memUser) return memUser;
  }
  return null;
}

async function applyHealthSyncToUser(sql, targetUser, healthPayload) {
  const steps = Math.max(0, Math.round(Number(healthPayload.steps) || 0));
  const calories = healthPayload.calories !== undefined
    ? Math.max(0, Math.round(Number(healthPayload.calories) || 0))
    : Math.round(steps * 0.04);
  const distanceKm = healthPayload.distanceKm !== undefined
    ? Math.max(0, Math.round(Number(healthPayload.distanceKm) * 100) / 100)
    : Math.round(steps * 0.000762 * 100) / 100;

  const todayStr = getIstDateKey();
  const payloadDate = healthPayload.date || (healthPayload.syncedAt ? getIstDateKey(new Date(healthPayload.syncedAt)) : todayStr);
  const isToday = (payloadDate === todayStr);
  const isReset = healthPayload.source === 'reset' || (steps === 0 && isToday);

  const normalized = {
    steps: isToday ? steps : 0,
    calories: isToday ? calories : 0,
    distanceKm: isToday ? distanceKm : 0,
    source: healthPayload.source || 'apple_health',
    syncedAt: healthPayload.syncedAt || new Date().toISOString(),
  };

  if (sql && targetUser?.id) {
    const existingPrefs = targetUser.preferences || {};
    const updatedPrefs = { ...existingPrefs, healthData: normalized };
    await sql`
      UPDATE daybyday_users 
      SET preferences = ${JSON.stringify(updatedPrefs)}::jsonb, last_active = CURRENT_TIMESTAMP
      WHERE id = ${targetUser.id}
    `;

    try {
      const stepHabits = await sql`
        SELECT * FROM daybyday_habits 
        WHERE user_id = ${targetUser.id} 
          AND (LOWER(habit_id) = 'steps' OR LOWER(unit) = 'steps' OR LOWER(name) LIKE '%step%' OR LOWER(name) LIKE '%walk%')
      `;
      if (stepHabits.length > 0) {
        for (const sh of stepHabits) {
          const target = Number(sh.target) || 10000;
          const history = cleanHistory(sh.history);
          history[payloadDate] = steps;

          if (isToday) {
            const completed = steps >= target;
            await sql`
              UPDATE daybyday_habits
              SET today_value = ${steps},
                  completed = ${completed},
                  history = ${JSON.stringify(history)}::jsonb,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${sh.id}
            `;
          } else {
            // Stale sync from yesterday: archive to payloadDate, ensure today remains 0
            if (history[todayStr] === undefined) {
              history[todayStr] = 0;
            }
            await sql`
              UPDATE daybyday_habits
              SET history = ${JSON.stringify(history)}::jsonb,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${sh.id}
            `;
          }
        }
      } else {
        // If user doesn't have a step habit row yet, create one
        const history = { [payloadDate]: steps };
        if (!isToday) history[todayStr] = 0;
        const completed = isToday ? (steps >= 10000) : false;
        const todayVal = isToday ? steps : 0;
        await sql`
          INSERT INTO daybyday_habits (
            user_id, habit_id, name, description, target, unit, icon, category,
            today_value, completed, reminder_time, reminder_days, streak, history, updated_at
          )
          VALUES (
            ${targetUser.id}, 'steps', 'Steps', 'Daily steps from device', 10000, 'steps', 'steps', 'Daily',
            ${todayVal}, ${completed}, null, null, 1, ${JSON.stringify(history)}::jsonb, CURRENT_TIMESTAMP
          )
          ON CONFLICT (user_id, habit_id) DO UPDATE SET
            today_value = EXCLUDED.today_value,
            completed = EXCLUDED.completed,
            history = EXCLUDED.history,
            updated_at = CURRENT_TIMESTAMP
        `;
      }
    } catch (hErr) {
      console.warn('Notice updating step habit in health_sync:', hErr.message);
    }
  } else if (targetUser) {
    if (!targetUser.preferences) targetUser.preferences = {};
    targetUser.preferences.healthData = normalized;
    if (steps > 0) {
      const todayStr = getIstDateKey();
      const habits = memoryDb.getUserHabits(targetUser.id);
      let stepH = habits.find(h => (h.id || '').toLowerCase() === 'steps' || (h.unit || '').toLowerCase() === 'steps');
      if (stepH) {
        stepH.today_value = steps;
        stepH.user1 = steps;
        stepH.completed = steps >= (Number(stepH.target) || 10000);
        if (!stepH.history) stepH.history = {};
        stepH.history[todayStr] = steps;
      } else {
        stepH = {
          id: 'steps',
          habit_id: 'steps',
          name: 'Steps',
          description: 'Daily steps from device',
          target: 10000,
          unit: 'steps',
          icon: 'steps',
          category: 'Daily',
          today_value: steps,
          user1: steps,
          user2: 0,
          completed: steps >= 10000,
          streak: 1,
          history: { [todayStr]: steps },
        };
        habits.unshift(stepH);
      }
    }
  }
  return normalized;
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

  // Set strict cache headers to prevent stale data on iOS Safari / WebKit PWAs
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (!isTablesInitialized()) {
    await ensureTables();
  }
  const sql = getDb();

  // 1. GET: FETCH USER PROFILE, HABITS, OR RESOLVE DIRECT APK CDN
  if (req.method === 'GET') {
    const { username, code, action, url, userId } = req.query;

    if (action === 'resolve_latest_apk' || action === 'resolve_cdn') {
      const result = await resolveLatestApkCdn(url);
      return res.status(result.success ? 200 : 500).json(result);
    }

    if (action === 'get_health') {
      try {
        const cleanCode = (code || '').trim().toUpperCase();
        const cleanUser = (username || '').trim().toLowerCase().replace(/^@/, '');

        if (sql) {
          let user = null;
          if (userId) {
            const rows = await sql`SELECT preferences FROM daybyday_users WHERE id = ${userId} LIMIT 1`;
            if (rows.length > 0) user = rows[0];
          }
          if (!user && cleanCode) {
            const rows = await sql`SELECT preferences FROM daybyday_users WHERE UPPER(secret_code) = ${cleanCode} LIMIT 1`;
            if (rows.length > 0) user = rows[0];
          }
          if (!user && cleanUser) {
            const rows = await sql`SELECT preferences FROM daybyday_users WHERE LOWER(username) = ${cleanUser} LIMIT 1`;
            if (rows.length > 0) user = rows[0];
          }
          if (user && user.preferences && user.preferences.healthData) {
            const hData = user.preferences.healthData;
            const todayKey = getIstDateKey();
            const syncedDate = hData.syncedAt ? getIstDateKey(new Date(hData.syncedAt)) : null;
            if (syncedDate !== todayKey) {
              return res.status(200).json({
                success: true,
                healthData: {
                  ...hData,
                  steps: 0,
                  calories: 0,
                  distanceKm: 0,
                  syncedAt: new Date().toISOString(),
                }
              });
            }
            return res.status(200).json({ success: true, healthData: user.preferences.healthData });
          }
        }

        // Memory Store Fallback
        const lookup = (cleanCode || cleanUser || userId || '').trim().replace(/^@/, '');
        const memUser = memoryDb.getUser(lookup);
        if (memUser && memUser.preferences && memUser.preferences.healthData) {
          const hData = memUser.preferences.healthData;
          const todayKey = getIstDateKey();
          const syncedDate = hData.syncedAt ? getIstDateKey(new Date(hData.syncedAt)) : null;
          if (syncedDate !== todayKey) {
            return res.status(200).json({
              success: true,
              healthData: {
                ...hData,
                steps: 0,
                calories: 0,
                distanceKm: 0,
                syncedAt: new Date().toISOString(),
              }
            });
          }
          return res.status(200).json({ success: true, healthData: memUser.preferences.healthData });
        }

        return res.status(200).json({ success: false, message: 'No remote health data found' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === 'health_sync') {
      try {
        const user = await findUserByIdentifier(sql, {
          userId,
          code,
          secretCode: req.query.secretCode,
          username,
        });
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found. Check your private Secret Code.' });
        }
        const healthPayload = {
          steps: req.query.steps,
          calories: req.query.calories,
          distanceKm: req.query.distance || req.query.distanceKm,
          source: req.query.source || 'apple_health',
        };
        const synced = await applyHealthSyncToUser(sql, user, healthPayload);
        return res.status(200).json({ success: true, message: 'Health data synced', healthData: synced });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
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
            partner = { ...sanitizePartner(partnerRows[0]), habits: partnerHabits.map((h) => formatHabitFromRow(h, sql)) };
          }
        }

        // Check if user belongs to active Together Group Pods (up to 5 pods)
        let groupPods = [];
        let groupPod = null;
        try {
          const userPodCodes = Array.isArray(user.preferences?.groupPodCodes) ? user.preferences.groupPodCodes.filter(Boolean) : [];
          const groupRows = await sql`
            SELECT * FROM daybyday_group_pods 
            WHERE (members::text LIKE ${'%"' + user.id + '"%'})
               OR (members::text LIKE ${'%"' + user.username + '"%'})
               OR ( ${user.secret_code ? sql`members::text LIKE ${'%"' + user.secret_code + '"%'}` : sql`FALSE`} )
               ${userPodCodes.length > 0 ? sql`OR code = ANY(${userPodCodes})` : sql``}
            ORDER BY updated_at DESC
            LIMIT 5
          `;
          if (groupRows.length > 0) {
            groupPods = groupRows.map((r) => formatGroupPodFromRow(r, sql));

            // Enrich members with latest profilePicture & secretCode so avatars load instantly
            const allMemberIds = [...new Set(groupPods.flatMap((p) => (p.members || []).map((m) => m.id)).filter(Boolean))];
            if (allMemberIds.length > 0) {
              try {
                const memberRows = await sql`
                  SELECT id, username, display_name, avatar, secret_code, preferences
                  FROM daybyday_users
                  WHERE id = ANY(${allMemberIds})
                `;
                const uMap = new Map(memberRows.map((u) => [u.id, u]));
                groupPods.forEach((p) => {
                  p.members = (p.members || []).map((m) => {
                    const u = uMap.get(m.id);
                    if (u) {
                      return {
                        ...m,
                        username: u.username || m.username,
                        displayName: u.display_name || u.username || m.displayName,
                        avatar: u.avatar || m.avatar || 'star',
                        secretCode: u.secret_code || m.secretCode,
                        profilePicture: parseSafeJson(u.preferences, {}).profilePicture || m.profilePicture || null,
                      };
                    }
                    return m;
                  });
                });
              } catch (uErr) {
                // Non-blocking, best effort
              }
            }

            groupPod = groupPods[0] || null;
          }
        } catch (gpErr) {
          console.warn('Notice querying user group pods:', gpErr.message);
        }

        const todayDateStr = getIstDateKey();
        const remoteHealthData = user.preferences?.healthData;
        let remoteHealthSteps = 0;
        if (remoteHealthData?.steps && remoteHealthData?.syncedAt) {
          const syncedDate = getIstDateKey(new Date(remoteHealthData.syncedAt));
          if (syncedDate === todayDateStr) {
            remoteHealthSteps = Number(remoteHealthData.steps) || 0;
          }
        }

        let formattedHabits = habits.map((h) => formatHabitFromRow(h, sql)).map((h) => {
          if (remoteHealthSteps > 0) {
            const isStep = (h.id || '').toLowerCase() === 'steps' ||
                           (h.unit || '').toLowerCase() === 'steps' ||
                           (h.name || '').toLowerCase().includes('step') ||
                           (h.name || '').toLowerCase().includes('walk');
            if (isStep && (Number(h.user1) || 0) < remoteHealthSteps) {
              return {
                ...h,
                user1: remoteHealthSteps,
                completed: remoteHealthSteps >= (Number(h.target) || 10000),
              };
            }
          }
          return h;
        });

        // Ensure step habit exists if user has remote health steps
        const hasStepHabit = formattedHabits.some((h) =>
          (h.id || '').toLowerCase() === 'steps' ||
          (h.unit || '').toLowerCase() === 'steps' ||
          (h.name || '').toLowerCase().includes('step')
        );
        if (!hasStepHabit && remoteHealthSteps > 0) {
          formattedHabits.unshift({
            id: 'steps',
            name: 'Steps',
            category: 'Daily',
            description: 'Daily steps from device',
            target: 10000,
            unit: 'steps',
            icon: 'steps',
            user1: remoteHealthSteps,
            user2: 0,
            completed: remoteHealthSteps >= 10000,
            streak: 1,
            history: { [todayDateStr]: remoteHealthSteps },
          });
        }

        // Cross-reference Together Group Pod shared goals for this user's steps!
        if (groupPod && Array.isArray(groupPod.sharedGoals)) {
          for (const sg of groupPod.sharedGoals) {
            const su = (sg.unit || '').toLowerCase();
            const sn = (sg.name || '').toLowerCase();
            if (su === 'steps' || sn.includes('step') || sn.includes('walk')) {
              const memberProg = sg.memberProgress || {};
              const entry = memberProg[user.id] ?? (user.username ? memberProg[user.username] : undefined);
              if (entry) {
                let isEntryToday = false;
                let pVal = 0;
                if (typeof entry === 'object' && entry !== null) {
                  const entryDate = entry.updatedAt ? getIstDateKey(new Date(entry.updatedAt)) : null;
                  isEntryToday = (entryDate === todayDateStr);
                  pVal = isEntryToday ? Number(entry.value) : 0;
                } else {
                  isEntryToday = false;
                  pVal = 0;
                }
                if (isEntryToday && !isNaN(pVal) && pVal > 0) {
                  const stepH = formattedHabits.find((h) =>
                    (h.id || '').toLowerCase() === 'steps' ||
                    (h.unit || '').toLowerCase() === 'steps' ||
                    (h.name || '').toLowerCase().includes('step')
                  );
                  if (stepH) {
                    const habitTodayHistory = stepH.history ? stepH.history[todayDateStr] : undefined;
                    const habitIsResetToday = habitTodayHistory === 0 || habitTodayHistory === false;
                    if (habitIsResetToday) {
                      // Do NOT overwrite stepH.user1! Habit is strictly 0 for today.
                      // Also reset lingering progress for this user in the group pod so it doesn't linger!
                      if (typeof entry === 'object' && entry !== null) {
                        entry.value = 0;
                        entry.completed = false;
                      }
                      if (sql && groupPod.id) {
                        sql`
                          UPDATE daybyday_group_pods
                          SET shared_goals = ${JSON.stringify(groupPod.sharedGoals)}::jsonb,
                              updated_at = CURRENT_TIMESTAMP
                          WHERE id = ${groupPod.id}
                        `.catch((gpErr) => {
                          console.warn('Notice resetting group pod steps in DB:', gpErr.message);
                        });
                      }
                    } else if ((Number(stepH.user1) || 0) < pVal) {
                      stepH.user1 = pVal;
                      stepH.completed = pVal >= (Number(stepH.target) || 10000);
                    }
                  }
                }
              }
            }
          }
        }

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
          preferences: parseSafeJson(user.preferences, {}),
          partner,
          podCode,
          groupPod,
          groupPods,
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

      let habits = memoryDb.getUserHabits(user.id);
      const memHealth = user.preferences?.healthData;
      if (memHealth?.steps > 0) {
        const stepH = habits.find(h => (h.id || '').toLowerCase() === 'steps' || (h.unit || '').toLowerCase() === 'steps');
        if (stepH) {
          stepH.user1 = memHealth.steps;
          stepH.today_value = memHealth.steps;
        } else {
          habits.unshift({
            id: 'steps',
            name: 'Steps',
            category: 'Daily',
            target: 10000,
            unit: 'steps',
            icon: 'steps',
            user1: memHealth.steps,
            completed: memHealth.steps >= 10000,
            streak: 1,
          });
        }
      }

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
        preferences: parseSafeJson(user.preferences, {}),
        partner: null,
        podCode: user.secretCode || user.secret_code || 'DAY-1000',
        groupPod: null,
        groupPods: [],
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

          const initialPreferences = {
            groupPodCode: null,
            groupPodCodes: [],
            trackedPartnerCodes: [],
          };

          const created = await sql`
            INSERT INTO daybyday_users (
              id, username, secret_code, display_name, avatar,
              password_hash, salt, security_question, security_answer_hash, preferences
            )
            VALUES (
              ${userId}, ${cleanUsername}, ${secretCode}, ${displayName}, ${avatar},
              ${passwordHash}, ${salt}, ${securityQuestion}, ${answerHash}, ${JSON.stringify(initialPreferences)}::jsonb
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
          preferences: {},
          createdAt: new Date().toISOString()
        };
        memoryDb.saveUser(user);
        return res.status(201).json({ user: sanitizeUser(user) });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ACTION: CLOUD HEALTH & FITNESS SYNC (Apple Health Shortcuts, Webhooks, Android)
    if (action === 'health_sync' || action === 'sync_health') {
      const { secretCode, username, userId, healthData } = req.body || {};
      if (!healthData || typeof healthData !== 'object') {
        return res.status(400).json({ error: 'healthData object is required' });
      }

      try {
        const cleanSteps = typeof healthData.steps === 'number' ? Math.max(0, Math.round(healthData.steps)) : 0;
        const cleanCalories = typeof healthData.calories === 'number' ? Math.max(0, Math.round(healthData.calories)) : Math.round(cleanSteps * 0.04);
        const cleanDistance = typeof healthData.distanceKm === 'number' ? Math.max(0, Math.round(healthData.distanceKm * 100) / 100) : Math.round(cleanSteps * 0.000762 * 100) / 100;
        const cleanHealthData = {
          steps: cleanSteps,
          calories: cleanCalories,
          distanceKm: cleanDistance,
          source: healthData.source || 'fitness_sync',
          syncedAt: new Date().toISOString(),
        };

        if (sql) {
          let user = null;
          const cleanCode = String(secretCode || '').trim().toUpperCase();
          const cleanUser = String(username || '').trim().toLowerCase().replace(/^@/, '');

          if (cleanCode) {
            const rows = await sql`SELECT * FROM daybyday_users WHERE UPPER(secret_code) = ${cleanCode} LIMIT 1`;
            if (rows.length > 0) user = rows[0];
          }
          if (!user && userId) {
            const rows = await sql`SELECT * FROM daybyday_users WHERE id = ${userId} LIMIT 1`;
            if (rows.length > 0) user = rows[0];
          }
          if (!user && cleanUser) {
            const rows = await sql`SELECT * FROM daybyday_users WHERE LOWER(username) = ${cleanUser} LIMIT 1`;
            if (rows.length > 0) user = rows[0];
          }

          if (user) {
            const currentPrefs = parseSafeJson(user.preferences, {});
            const updatedPrefs = {
              ...currentPrefs,
              healthData: cleanHealthData,
            };
            await sql`UPDATE daybyday_users SET preferences = ${JSON.stringify(updatedPrefs)}::jsonb WHERE id = ${user.id}`;

            // Also keep user's step habit row in daybyday_habits in perfect sync
            try {
              const todayKey = getIstDateKey();
              const syncDate = (healthData && healthData.date) ? healthData.date : (cleanHealthData.syncedAt ? getIstDateKey(new Date(cleanHealthData.syncedAt)) : todayKey);
              const isToday = (syncDate === todayKey);

              const userHabits = await sql`SELECT * FROM daybyday_habits WHERE user_id = ${user.id}`;
              for (const h of userHabits) {
                const isStep = (h.habit_id || '').toLowerCase() === 'steps' ||
                               (h.unit || '').toLowerCase() === 'steps' ||
                               (h.name || '').toLowerCase().includes('step') ||
                               (h.name || '').toLowerCase().includes('walk');
                if (isStep) {
                  const history = cleanHistory(h.history);
                  history[syncDate] = cleanHealthData.steps;
                  if (isToday) {
                    const targetNum = Number(h.target) || 10000;
                    const isDone = cleanHealthData.steps >= targetNum;
                    await sql`
                      UPDATE daybyday_habits 
                      SET today_value = ${cleanHealthData.steps}, history = ${JSON.stringify(history)}::jsonb, completed = ${isDone}, updated_at = CURRENT_TIMESTAMP
                      WHERE id = ${h.id}
                    `;
                  } else {
                    if (history[todayKey] === undefined) history[todayKey] = 0;
                    await sql`
                      UPDATE daybyday_habits 
                      SET today_value = 0, completed = false, history = ${JSON.stringify(history)}::jsonb, updated_at = CURRENT_TIMESTAMP
                      WHERE id = ${h.id}
                    `;
                  }
                }
              }
            } catch (hSyncErr) {
              console.warn('Notice updating step habit row in SQL:', hSyncErr.message);
            }

            return res.status(200).json({ success: true, healthData: cleanHealthData });
          }
        }

        // Memory store fallback
        const lookup = (secretCode || username || userId || '').trim().replace(/^@/, '');
        const memUser = memoryDb.getUser(lookup);
        if (memUser) {
          memUser.preferences = parseSafeJson(memUser.preferences, {});
          memUser.preferences.healthData = cleanHealthData;
          memoryDb.saveUser(memUser);
        }

        return res.status(200).json({ success: true, healthData: cleanHealthData });
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
              partner = { ...sanitizePartner(partnerRows[0]), habits: partnerHabits.map((h) => formatHabitFromRow(h, sql)) };
            }
          }

          // Check if user belongs to active Together Group Pods (up to 5 pods)
          let groupPods = [];
          let groupPod = null;
          try {
            const userPodCodes = Array.isArray(user.preferences?.groupPodCodes) ? user.preferences.groupPodCodes.filter(Boolean) : [];
            const groupRows = await sql`
              SELECT * FROM daybyday_group_pods 
              WHERE (members::text LIKE ${'%"' + user.id + '"%'})
                 OR (members::text LIKE ${'%"' + user.username + '"%'})
                 OR ( ${user.secret_code ? sql`members::text LIKE ${'%"' + user.secret_code + '"%'}` : sql`FALSE`} )
                 ${userPodCodes.length > 0 ? sql`OR code = ANY(${userPodCodes})` : sql``}
              ORDER BY updated_at DESC
              LIMIT 5
            `;
            if (groupRows.length > 0) {
              groupPods = groupRows.map((r) => formatGroupPodFromRow(r, sql));

              // Enrich members with latest profilePicture & secretCode so avatars load instantly
              const allMemberIds = [...new Set(groupPods.flatMap((p) => (p.members || []).map((m) => m.id)).filter(Boolean))];
              if (allMemberIds.length > 0) {
                try {
                  const memberRows = await sql`
                    SELECT id, username, display_name, avatar, secret_code, preferences
                    FROM daybyday_users
                    WHERE id = ANY(${allMemberIds})
                  `;
                  const uMap = new Map(memberRows.map((u) => [u.id, u]));
                  groupPods.forEach((p) => {
                    p.members = (p.members || []).map((m) => {
                      const u = uMap.get(m.id);
                      if (u) {
                        return {
                          ...m,
                          username: u.username || m.username,
                          displayName: u.display_name || u.username || m.displayName,
                          avatar: u.avatar || m.avatar || 'star',
                          secretCode: u.secret_code || m.secretCode,
                          profilePicture: parseSafeJson(u.preferences, {}).profilePicture || m.profilePicture || null,
                        };
                      }
                      return m;
                    });
                  });
                } catch (uErr) {
                  // Non-blocking, best effort
                }
              }

              groupPod = groupPods[0] || null;
            }
          } catch (gpErr) {
            console.warn('Notice querying user group pods on login:', gpErr.message);
          }

          const userHabitsFormatted = habits.map((h) => formatHabitFromRow(h, sql));

          return res.status(200).json({
            user: sanitizeUser(user),
            habits: userHabitsFormatted,
            preferences: parseSafeJson(user.preferences, {}),
            partner,
            podCode,
            groupPod,
            groupPods,
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
          preferences: parseSafeJson(user.preferences, {}),
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

    // ACTION: HEALTH SYNC (Apple Shortcuts / iOS Webhooks / Daily Auto-Sync)
    if (action === 'health_sync') {
      try {
        const body = req.body || {};
        const user = await findUserByIdentifier(sql, {
          userId: body.userId,
          code: body.code,
          secretCode: body.secretCode,
          username: body.username,
        });
        if (!user) {
          return res.status(404).json({ success: false, error: 'User not found. Check your private Secret Code.' });
        }
        const rawHealth = body.healthData || body;
        const healthPayload = {
          steps: rawHealth.steps !== undefined ? rawHealth.steps : body.steps,
          calories: rawHealth.calories !== undefined ? rawHealth.calories : body.calories,
          distanceKm: rawHealth.distanceKm !== undefined ? rawHealth.distanceKm : (rawHealth.distance || body.distance || body.distanceKm),
          source: rawHealth.source || body.source || 'apple_health',
        };
        const synced = await applyHealthSyncToUser(sql, user, healthPayload);
        return res.status(200).json({ success: true, message: 'Health synced successfully', healthData: synced });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ACTION: SYNC HABITS (Save user's habits & preferences)
    if (action === 'sync_habits') {
      const { userId, habits, preferences, lastActiveDate } = req.body;
      if (!userId || !Array.isArray(habits)) {
        return res.status(400).json({ error: 'User ID and habits array required' });
      }

      try {
        if (sql) {
          if (preferences) {
            await sql`UPDATE daybyday_users SET preferences = ${JSON.stringify(parseSafeJson(preferences, {}))}::jsonb, last_active = CURRENT_TIMESTAMP WHERE id = ${userId}`;
          }
          const todayStr = getIstDateKey();
          const yesterdayStr = getIstYesterdayKey();
          const clientActiveDate = lastActiveDate || (preferences && preferences.lastActiveDate);
          const isPriorDaySync = Boolean(clientActiveDate && clientActiveDate !== todayStr);

          // Fetch existing habits for user to merge & preserve all historical dates in memory before writing
          const existingHabits = await sql`SELECT habit_id, history FROM daybyday_habits WHERE user_id = ${userId}`;
          const existingHistoryMap = new Map(existingHabits.map((r) => [r.habit_id, cleanHistory(r.history)]));

          for (const h of habits) {
            const reminderDaysStr = Array.isArray(h.reminderDays) ? h.reminderDays.join(',') : (h.reminderDays || null);
            const existingHist = existingHistoryMap.get(h.id) || {};
            const incomingHist = cleanHistory(h.history);
            const historyObj = { ...existingHist, ...incomingHist };
            const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
            const habitVal = h.user1 ?? h.todayValue ?? (historyObj[todayStr] !== undefined ? historyObj[todayStr] : 0);
            const numOrBoolVal = isBool ? Boolean(habitVal) : (Number(habitVal) || 0);

            let todayValueToSave;
            let completedToSave;

            if (isPriorDaySync) {
              // The incoming habit data is from clientActiveDate (yesterday or earlier).
              historyObj[clientActiveDate] = numOrBoolVal;
              historyObj[todayStr] = isBool ? false : 0;
              todayValueToSave = isBool ? false : 0;
              completedToSave = false;
            } else {
              todayValueToSave = isBool ? (numOrBoolVal ? 1 : 0) : numOrBoolVal;
              completedToSave = Boolean(h.completed);
              historyObj[todayStr] = todayValueToSave;
            }

            await sql`
              INSERT INTO daybyday_habits (
                user_id, habit_id, name, description, target, unit, icon, category,
                today_value, completed, reminder_time, reminder_days, streak, history, updated_at
              )
              VALUES (
                ${userId}, ${h.id}, ${h.name}, ${h.description || ''}, ${h.target || 1}, ${h.unit || ''}, ${h.icon || 'star'}, ${h.category || 'Daily'},
                ${todayValueToSave}, ${completedToSave}, ${h.reminderTime || null}, ${reminderDaysStr},
                ${h.streak || 0}, ${JSON.stringify(historyObj)}::jsonb, CURRENT_TIMESTAMP
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
          const formattedSaved = savedHabits.map((h) => formatHabitFromRow(h, sql));
          return res.status(200).json({ success: true, habits: formattedSaved });
        }

        memoryDb.saveUserHabits(userId, habits);
        if (preferences) {
          const u = memoryDb.getUser(userId);
          if (u) u.preferences = parseSafeJson(preferences, {});
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
            SET preferences = ${JSON.stringify(parseSafeJson(preferences, {}))}::jsonb, last_active = CURRENT_TIMESTAMP 
            WHERE id = ${userId}
          `;
          const rows = await sql`SELECT preferences FROM daybyday_users WHERE id = ${userId}`;
          return res.status(200).json({ success: true, preferences: parseSafeJson(rows[0]?.preferences, {}) });
        }

        const u = memoryDb.getUser(userId);
        if (u) u.preferences = parseSafeJson(preferences, {});
        return res.status(200).json({ success: true, preferences: parseSafeJson(preferences, {}) });
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
              profilePicture: parseSafeJson(u.preferences, {}).profilePicture || null,
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
              profilePicture: parseSafeJson(u.preferences, {}).profilePicture || null,
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
          const existingPod = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (existingPod.length > 0) {
            const randSuffix = Math.floor(1000 + Math.random() * 9000);
            cleanCode = `${cleanCode.slice(0, 4)}-${randSuffix}`;
            podRecord.code = cleanCode;
          }
          await sql`
            INSERT INTO daybyday_group_pods (id, name, code, members, shared_goals, created_at, updated_at)
            VALUES (${id}, ${cleanName}, ${cleanCode}, ${JSON.stringify(podRecord.members)}::jsonb, ${JSON.stringify(goals)}::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (code) DO UPDATE SET
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
            pod = formatGroupPodFromRow(rows[0], sql);
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
              profilePicture: parseSafeJson(u.preferences, {}).profilePicture || null,
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
              profilePicture: parseSafeJson(u.preferences, {}).profilePicture || null,
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
            pod = formatGroupPodFromRow(rows[0], sql);
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

    if (action === 'get_user_group_pods' || action === 'get_user_group_pod') {
      const { userId, username, secretCode } = req.body;
      const cleanU = (username || '').trim().replace(/^@/, '');
      const cleanCode = (secretCode || '').trim().toUpperCase();
      try {
        let pods = [];
        if (sql) {
          // Look up user preferences for any stored groupPodCodes
          let prefCodes = [];
          try {
            const uRows = await sql`
              SELECT preferences FROM daybyday_users
              WHERE ( ${userId ? sql`id = ${userId}` : sql`FALSE`} )
                 OR ( ${cleanU ? sql`LOWER(username) = LOWER(${cleanU})` : sql`FALSE`} )
                 OR ( ${cleanCode ? sql`UPPER(secret_code) = UPPER(${cleanCode})` : sql`FALSE`} )
              LIMIT 1
            `;
            if (uRows.length > 0 && Array.isArray(uRows[0].preferences?.groupPodCodes)) {
              prefCodes = uRows[0].preferences.groupPodCodes.filter(Boolean);
            }
          } catch {}

          const groupRows = await sql`
            SELECT * FROM daybyday_group_pods 
            WHERE ( ${userId ? sql`members::text LIKE ${'%"' + userId + '"%'}` : sql`FALSE`} )
               OR ( ${cleanU ? sql`members::text LIKE ${'%"' + cleanU + '"%'}` : sql`FALSE`} )
               OR ( ${cleanCode ? sql`members::text LIKE ${'%"' + cleanCode + '"%'}` : sql`FALSE`} )
               ${prefCodes.length > 0 ? sql`OR code = ANY(${prefCodes})` : sql``}
            ORDER BY updated_at DESC
            LIMIT 5
          `;
          pods = groupRows.map((r) => formatGroupPodFromRow(r, sql));

          // Enrich members with latest profilePicture & secretCode
          if (pods.length > 0) {
            const allMemberIds = [...new Set(pods.flatMap((p) => (p.members || []).map((m) => m.id)).filter(Boolean))];
            if (allMemberIds.length > 0) {
              try {
                const uRows = await sql`
                  SELECT id, username, display_name, avatar, secret_code, preferences
                  FROM daybyday_users
                  WHERE id = ANY(${allMemberIds})
                `;
                const uMap = new Map(uRows.map((u) => [u.id, u]));

                pods.forEach((p) => {
                  p.members = (p.members || []).map((m) => {
                    const u = uMap.get(m.id);
                    if (u) {
                      return {
                        ...m,
                        username: u.username || m.username,
                        displayName: u.display_name || u.username || m.displayName,
                        avatar: u.avatar || m.avatar || 'star',
                        secretCode: u.secret_code || m.secretCode,
                        profilePicture: parseSafeJson(u.preferences, {}).profilePicture || m.profilePicture || null,
                      };
                    }
                    return m;
                  });
                });
              } catch (uErr) {
                // Non-blocking lookup fallback
              }
            }
          }
        }
        return res.status(200).json({ success: true, pods, pod: pods[0] || null });
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
            pod = formatGroupPodFromRow(rows[0], sql);
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });

        const memberProgress = { ...(goal.memberProgress || {}) };

        // Auto-reconcile all pod members' progress from their latest habits in daybyday_habits & healthData
        if (sql && Array.isArray(pod.members) && pod.members.length > 0) {
          const memberIds = pod.members.map((m) => m.id).filter(Boolean);
          if (memberIds.length > 0) {
            try {
              const allHabits = await sql`
                SELECT user_id, habit_id, name, category, target, unit, user1, completed
                FROM daybyday_habits
                WHERE user_id = ANY(${memberIds})
              `;
              const usersRows = await sql`
                SELECT id, username, preferences
                FROM daybyday_users
                WHERE id = ANY(${memberIds})
              `;
              const userMap = new Map(usersRows.map((u) => [u.id, u]));

              pod.members.forEach((m) => {
                const u = userMap.get(m.id);
                // If member progress is already populated and > 0, keep it
                const existingVal = memberProgress[m.id]?.value ?? memberProgress[m.username]?.value ?? 0;
                if (existingVal > 0) return;

                const mHabits = allHabits.filter((h) => h.user_id === m.id);
                const targetGoalName = (goal.name || '').toLowerCase().trim();
                const targetUnit = (goal.unit || '').toLowerCase().trim();

                let foundVal = 0;
                for (const h of mHabits) {
                  const hName = (h.name || '').toLowerCase().trim();
                  const hUnit = (h.unit || '').toLowerCase().trim();

                  const isMatch =
                    hName === targetGoalName ||
                    hName.includes(targetGoalName) ||
                    targetGoalName.includes(hName) ||
                    (targetUnit === 'steps' && (hName.includes('step') || hUnit.includes('step'))) ||
                    (targetUnit === 'glasses' && (hName.includes('water') || hName.includes('hydrat'))) ||
                    (targetGoalName.includes('workout') && hName.includes('workout')) ||
                    (targetGoalName.includes('read') && hName.includes('read'));

                  if (isMatch) {
                    const v = typeof h.user1 === 'boolean' ? (h.user1 ? 1 : 0) : (Number(h.user1) || 0);
                    foundVal = Math.max(foundVal, v);
                  }
                }

                // Also check steps from user preferences.healthData if step goal
                if ((targetUnit === 'steps' || targetGoalName.includes('step')) && u?.preferences?.healthData?.steps) {
                  foundVal = Math.max(foundVal, Number(u.preferences.healthData.steps) || 0);
                }

                if (foundVal > 0) {
                  const isDone = foundVal >= (Number(goal.target) || 1);
                  const entry = {
                    value: foundVal,
                    completed: isDone,
                    updatedAt: new Date().toISOString(),
                  };
                  memberProgress[m.id] = entry;
                  if (m.username) memberProgress[m.username] = entry;
                }
              });
            } catch (reconErr) {
              console.warn('Reconcile new goal error:', reconErr);
            }
          }
        }

        // Calculate total current sum
        const currentSum = Object.values(memberProgress).reduce(
          (acc, v) => acc + (typeof v === 'object' ? (Number(v.value) || 0) : (Number(v) || 0)),
          0
        );

        const newGoal = {
          id: goal.id || `sg_${Date.now().toString(36)}`,
          name: goal.name.trim(),
          target: Math.max(1, Number(goal.target) || 1),
          unit: (goal.unit || 'times').trim(),
          icon: goal.icon || 'target',
          category: goal.category || 'Daily',
          delta: Math.max(1, Number(goal.delta) || 1),
          createdBy: goal.createdBy || 'member',
          current: currentSum,
          memberProgress,
          createdAt: new Date().toISOString(),
        };

        const existingGoals = Array.isArray(pod.sharedGoals)
          ? pod.sharedGoals.filter((g) => g && typeof g === 'object' && typeof g.name === 'string' && g.name.trim() !== '' && g['0'] === undefined)
          : [];
        const updatedGoals = [...existingGoals, newGoal];
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
            pod = formatGroupPodFromRow(rows[0], sql);
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });

        const todayKey = getIstDateKey();
        const updatedGoals = (pod.sharedGoals || []).map((g) => {
          if (g.id === goalId) {
            const memberProgress = { ...(g.memberProgress || {}) };

            if (userId) {
              const currentMemberData = memberProgress[userId] || { value: 0, completed: false };
              let curMemberVal = 0;
              if (currentMemberData && typeof currentMemberData === 'object') {
                const entryDate = currentMemberData.updatedAt ? getIstDateKey(new Date(currentMemberData.updatedAt)) : null;
                curMemberVal = (entryDate === todayKey) ? (Number(currentMemberData.value) || 0) : 0;
              } else {
                curMemberVal = Number(currentMemberData) || 0;
              }

              let nextMemberVal = value !== undefined
                ? Math.max(0, Number(value))
                : Math.max(0, curMemberVal + (Number(delta) || 0));

              const isCompleted = completed !== undefined
                ? Boolean(completed)
                : nextMemberVal >= (Number(g.target) || 1);

              memberProgress[userId] = {
                value: nextMemberVal,
                completed: isCompleted,
                updatedAt: new Date().toISOString(),
              };
            }

            // Total aggregated current value across members for today
            const totalSum = Object.values(memberProgress).reduce((acc, m) => {
              if (m && typeof m === 'object') {
                const entryDate = m.updatedAt ? getIstDateKey(new Date(m.updatedAt)) : null;
                return acc + (entryDate === todayKey ? (Number(m.value) || 0) : 0);
              }
              return acc;
            }, 0);

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
            pod = formatGroupPodFromRow(rows[0], sql);
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
            pod = formatGroupPodFromRow(rows[0], sql);
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

    // ACTION: EDIT GROUP POD NAME
    if (action === 'edit_group_name' || action === 'edit_group_pod_name') {
      const { podCode, name } = req.body;
      const cleanCode = (podCode || '').trim().toUpperCase();
      const cleanName = (name || '').trim();
      if (!cleanCode || !cleanName) {
        return res.status(400).json({ error: 'Pod code and new name required' });
      }

      try {
        let pod = null;
        if (sql) {
          const rows = await sql`SELECT * FROM daybyday_group_pods WHERE UPPER(code) = ${cleanCode} LIMIT 1`;
          if (rows.length > 0) {
            const r = rows[0];
            await sql`
              UPDATE daybyday_group_pods
              SET name = ${cleanName}, updated_at = CURRENT_TIMESTAMP
              WHERE UPPER(code) = ${cleanCode}
            `;
            pod = { ...formatGroupPodFromRow(r, sql), name: cleanName };
          }
        } else {
          pod = memoryDb.getGroupPod(cleanCode);
          if (pod) {
            pod.name = cleanName;
            memoryDb.saveGroupPod(pod);
          }
        }

        if (!pod) return res.status(404).json({ error: 'Pod not found' });
        return res.status(200).json({ success: true, pod });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to update group name: ' + err.message });
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
      const { toUserId, toUsername, toSecretCode, fromUserId, fromUsername, fromName, fromAvatar, podCode, message, goalName } = req.body;
      const cheerMessage = (message || (goalName ? `Encouraged you for ${goalName}! 🔥` : 'Keep crushing your goals! 🔥')).trim();

      try {
        let recipientId = toUserId || null;
        let recipientUsername = toUsername || null;
        let recipientSecretCode = toSecretCode || null;

        if (sql && (toUserId || toUsername || toSecretCode)) {
          const u1 = (toUserId || '').trim();
          const u2 = (toUsername || '').trim().replace(/^@/, '');
          const u3 = (toSecretCode || '').trim().toUpperCase();

          try {
            const found = await sql`
              SELECT id, username, secret_code FROM daybyday_users
              WHERE ( ${u1 ? sql`id = ${u1}` : sql`FALSE`} )
                 OR ( ${u1 ? sql`LOWER(username) = LOWER(${u1.replace(/^@/, '')})` : sql`FALSE`} )
                 OR ( ${u1 ? sql`UPPER(secret_code) = UPPER(${u1})` : sql`FALSE`} )
                 OR ( ${u2 ? sql`LOWER(username) = LOWER(${u2})` : sql`FALSE`} )
                 OR ( ${u2 ? sql`id = ${u2}` : sql`FALSE`} )
                 OR ( ${u3 ? sql`UPPER(secret_code) = UPPER(${u3})` : sql`FALSE`} )
              LIMIT 1
            `;
            if (found.length > 0) {
              recipientId = found[0].id;
              recipientUsername = found[0].username;
              recipientSecretCode = found[0].secret_code;
            }
          } catch (lookupErr) {
            console.warn('Recipient lookup notice:', lookupErr.message);
          }
        }

        if (
          (fromUserId && recipientId && String(fromUserId) === String(recipientId)) ||
          (fromUsername && recipientUsername && String(fromUsername).toLowerCase() === String(recipientUsername).toLowerCase())
        ) {
          return res.status(200).json({ success: true, message: 'Self cheer skipped' });
        }

        const finalToId = recipientId || recipientUsername || recipientSecretCode || 'teammate';

        if (sql) {
          await sql`
            INSERT INTO daybyday_cheers (
              to_user_id, from_user_id, from_username, from_name, from_avatar, pod_code, message, goal_name, is_read
            )
            VALUES (
              ${finalToId}, ${fromUserId || null}, ${fromUsername || 'friend'},
              ${fromName || fromUsername || 'Friend'}, ${fromAvatar || 'flame'}, ${podCode || null}, ${cheerMessage}, ${goalName || null}, false
            )
          `;
        }

        memoryDb.addCheer({
          to_user_id: finalToId,
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
      const { userId, username, secretCode, podCode } = req.body;
      const targetId = (userId || '').trim();
      const cleanUsername = (username || userId || '').trim().replace(/^@/, '');
      const cleanCode = (secretCode || '').trim().toUpperCase();
      const cleanPod = (podCode || '').trim().toUpperCase();

      try {
        let cheers = [];
        if (sql) {
          // Resolve all user identifiers for the recipient to ensure 100% reliable matching
          const knownIds = new Set();
          if (targetId) knownIds.add(targetId);
          if (cleanUsername) knownIds.add(cleanUsername);
          if (cleanCode) knownIds.add(cleanCode);

          if (targetId || cleanUsername || cleanCode) {
            try {
              const userLookup = await sql`
                SELECT id, username, secret_code FROM daybyday_users
                WHERE ( ${targetId ? sql`id = ${targetId}` : sql`FALSE`} )
                   OR ( ${cleanUsername ? sql`LOWER(username) = LOWER(${cleanUsername})` : sql`FALSE`} )
                   OR ( ${cleanCode ? sql`UPPER(secret_code) = UPPER(${cleanCode})` : sql`FALSE`} )
                LIMIT 1
              `;
              if (userLookup.length > 0) {
                const u = userLookup[0];
                if (u.id) knownIds.add(u.id);
                if (u.username) knownIds.add(u.username);
                if (u.secret_code) knownIds.add(u.secret_code);
              }
            } catch {}
          }
          const idsList = Array.from(knownIds).filter(Boolean);

          if (idsList.length > 0 || cleanPod) {
            cheers = await sql`
              SELECT * FROM daybyday_cheers
              WHERE (
                ( ${idsList.length > 0 ? sql`to_user_id = ANY(${idsList})` : sql`FALSE`} )
                ${cleanUsername ? sql`OR LOWER(to_user_id) = LOWER(${cleanUsername})` : sql``}
                ${cleanPod ? sql`OR (pod_code = ${cleanPod} AND (to_user_id IS NULL OR to_user_id = ANY(${idsList})))` : sql``}
              )
              AND is_read = false
              ORDER BY created_at DESC LIMIT 30
            `;
          }

          // Clean filter out self-cheers in JS
          cheers = (cheers || []).filter((c) => {
            const isFromSelf =
              (c.from_user_id && idsList.includes(c.from_user_id)) ||
              (c.from_username && cleanUsername && c.from_username.toLowerCase() === cleanUsername.toLowerCase());
            return !isFromSelf;
          });
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
            pod = formatGroupPodFromRow(rows[0], sql);
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
