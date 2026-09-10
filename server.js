// Standalone Production Server for DayByDay (Hosted on Oracle Cloud VM)
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import userHandler from './api/user.js';
import activityHandler from './api/activity.js';
import podHandler from './api/pod.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON & form body parsing (up to 15MB for base64 profile images)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Global CORS Middleware
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
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'daybyday', timestamp: new Date().toISOString() });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DayByDay standalone production server running on port ${PORT}`);
  console.log(`Serving API at http://localhost:${PORT}/api/user`);
  console.log(`Serving Web App from ${distPath}`);
});
