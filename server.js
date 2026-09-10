// Standalone Production Server for DayByDay (Hosted on Oracle Cloud VM)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from project root directory
dotenv.config({ path: path.join(__dirname, '.env') });

import userHandler, { cleanPreferences, isValidProfilePicture } from './api/user.js';
import activityHandler from './api/activity.js';
import podHandler from './api/pod.js';
import { getDb, ensureTables } from './api/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON & form body parsing (up to 15MB for base64 profile images)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Global CORS & Request Timing Middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.path.startsWith('/api/')) {
    const t0 = Date.now();
    res.on('finish', () => {
      console.log(`[API ${req.method}] ${req.originalUrl || req.url} - ${res.statusCode} in ${Date.now() - t0}ms`);
    });
  }
  next();
});

// Health check endpoint with real-time PostgreSQL database check
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;
  let userCount = 0;
  try {
    const sql = getDb();
    if (sql) {
      const [row] = await sql`SELECT COUNT(*)::int AS count FROM daybyday_users`;
      dbStatus = 'connected';
      userCount = row?.count ?? 0;
    } else {
      dbStatus = 'no_database_url';
    }
  } catch (err) {
    dbStatus = 'error';
    dbError = err.message;
  }

  res.status(200).json({
    status: 'ok',
    service: 'daybyday',
    database: dbStatus,
    usersInDb: userCount,
    error: dbError,
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.all('/api/user', async (req, res) => {
  try {
    await userHandler(req, res);
  } catch (err) {
    console.error('API /api/user error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
});

app.all('/api/activity', async (req, res) => {
  try {
    await activityHandler(req, res);
  } catch (err) {
    console.error('API /api/activity error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
});

app.all('/api/pod', async (req, res) => {
  try {
    await podHandler(req, res);
  } catch (err) {
    console.error('API /api/pod error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }
});

// Serve frontend static build (SPA)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA Fallback: Any non-API route serves index.html
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`DayByDay standalone production server running on port ${PORT}`);
  console.log(`Serving API at http://localhost:${PORT}/api/user`);
  console.log(`Serving Web App from ${distPath}`);

  // Pre-warm database connection and ensure tables on startup
  try {
    const sql = getDb();
    if (sql) {
      console.log('Pre-warming PostgreSQL connection & ensuring tables...');
      await ensureTables();
      console.log('PostgreSQL tables ensured and ready.');

      // Universal Auto-Heal: Profile picture restoration, tracked partners recovery, and preference cleanup
      try {
        // 1. Restore authentic profile pictures from activity history or group pods if user has corrupt/1x1 dummy pixel
        const usersNeedingPic = await sql`
          SELECT id, username, profile_picture, preferences FROM daybyday_users
          WHERE profile_picture IS NULL 
             OR length(profile_picture) < 250 
             OR profile_picture LIKE '%AAAAEAAAAB%'
             OR profile_picture LIKE '%iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB%'
        `;
        for (const u of usersNeedingPic) {
          const actRows = await sql`
            SELECT profile_picture FROM daybyday_activity
            WHERE user_id = ${u.id}
              AND profile_picture IS NOT NULL
              AND length(profile_picture) > 250
              AND profile_picture NOT LIKE '%AAAAEAAAAB%'
            ORDER BY created_at DESC LIMIT 1
          `;
          let realPic = actRows.length > 0 ? actRows[0].profile_picture : null;
          if (!realPic) {
            const podRows = await sql`
              SELECT members FROM daybyday_group_pods
              WHERE members::text LIKE ${'%"' + u.id + '"%'}
            `;
            for (const pr of podRows) {
              const mems = Array.isArray(pr.members) ? pr.members : [];
              const m = mems.find((item) => item && (item.id === u.id || item.username === u.username));
              if (m && isValidProfilePicture(m.profilePicture)) {
                realPic = m.profilePicture;
                break;
              }
            }
          }
          if (realPic && isValidProfilePicture(realPic)) {
            const curP = cleanPreferences(u.preferences);
            curP.profilePicture = realPic;
            await sql`
              UPDATE daybyday_users
              SET profile_picture = ${realPic},
                  preferences = ${JSON.stringify(curP)}::jsonb
              WHERE id = ${u.id}
            `;
            console.log(`[AutoHeal] Restored authentic profile picture (${realPic.length} bytes) for ${u.username}`);
          }
        }

        // 2. Restore Palak's tracked partner codes if missing or empty
        const palakRows = await sql`
          SELECT id, preferences FROM daybyday_users WHERE LOWER(username) = 'palakharinkhede' LIMIT 1
        `;
        if (palakRows.length > 0) {
          const pPrefs = cleanPreferences(palakRows[0].preferences);
          const pCodes = Array.isArray(pPrefs.trackedPartnerCodes) ? pPrefs.trackedPartnerCodes : [];
          if (!pCodes.includes('GAYA-4241C') || !pCodes.includes('JANK-1777K')) {
            const updated = Array.from(new Set([...pCodes, 'GAYA-4241C', 'JANK-1777K']));
            pPrefs.trackedPartnerCodes = updated;
            await sql`
              UPDATE daybyday_users
              SET preferences = ${JSON.stringify(pPrefs)}::jsonb
              WHERE id = ${palakRows[0].id}
            `;
            console.log('[AutoHeal] Restored trackedPartnerCodes for palakharinkhede:', updated);
          }
        }

        // 3. Ensure group pods members also have valid profile pictures (replace 118-byte dummy pixel)
        const allPods = await sql`SELECT id, code, members FROM daybyday_group_pods`;
        for (const p of allPods) {
          const membersList = Array.isArray(p.members) ? p.members : [];
          let podChanged = false;
          const updatedMems = membersList.map((m) => {
            if (m.profilePicture && !isValidProfilePicture(m.profilePicture)) {
              podChanged = true;
              return { ...m, profilePicture: null };
            }
            return m;
          });
          if (podChanged) {
            await sql`
              UPDATE daybyday_group_pods
              SET members = ${JSON.stringify(updatedMems)}::jsonb
              WHERE id = ${p.id}
            `;
            console.log(`[AutoHeal] Cleaned dummy member pictures in pod ${p.code}`);
          }
        }

        // 4. Clean bloated/corrupted preferences
        const dirtyUsers = await sql`
          SELECT id, preferences, profile_picture FROM daybyday_users 
          WHERE jsonb_typeof(preferences) != 'object' 
             OR octet_length(preferences::text) > 5000
        `;
        if (dirtyUsers && dirtyUsers.length > 0) {
          for (const u of dirtyUsers) {
            const cleaned = cleanPreferences(u.preferences);
            const pic = (isValidProfilePicture(cleaned.profilePicture) ? cleaned.profilePicture : null) ||
                        (isValidProfilePicture(u.profile_picture) ? u.profile_picture : null);
            await sql`
              UPDATE daybyday_users 
              SET preferences = ${JSON.stringify(cleaned)}::jsonb,
                  profile_picture = ${pic}
              WHERE id = ${u.id}
            `;
            console.log(`[AutoHeal] Restored clean preferences for user ${u.id}`);
          }
        }
      } catch (hErr) {
        console.warn('Startup preferences auto-heal notice:', hErr.message);
      }
    }
  } catch (e) {
    console.warn('Startup database notice:', e.message);
  }
});
