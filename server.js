// Standalone Production Server for DayByDay (Hosted on Oracle Cloud VM)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from project root directory
dotenv.config({ path: path.join(__dirname, '.env') });

import userHandler, { cleanPreferences } from './api/user.js';
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

      // Auto-heal any bloated/corrupted user preferences in PostgreSQL once on boot
      try {
        // 1. Backfill profile_picture column from preferences for all users if not already set
        await sql`
          UPDATE daybyday_users
          SET profile_picture = preferences->>'profilePicture'
          WHERE (profile_picture IS NULL OR profile_picture = '')
            AND preferences->>'profilePicture' IS NOT NULL
            AND preferences->>'profilePicture' != ''
        `.catch(() => {});

        // 2. Clean bloated/corrupted preferences
        const dirtyUsers = await sql`
          SELECT id, preferences, profile_picture FROM daybyday_users 
          WHERE jsonb_typeof(preferences) != 'object' 
             OR octet_length(preferences::text) > 5000
        `;
        if (dirtyUsers && dirtyUsers.length > 0) {
          for (const u of dirtyUsers) {
            const cleaned = cleanPreferences(u.preferences);
            const pic = cleaned.profilePicture || u.profile_picture || null;
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
