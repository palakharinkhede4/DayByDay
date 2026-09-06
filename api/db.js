// Neon PostgreSQL Database Layer for DuoTrack
// Connects to Neon Serverless Postgres via DATABASE_URL
// Includes resilient fallback to memory/KV if DATABASE_URL is not yet set

let neonSql = null;
let tablesInitialized = false;

// Fallback in-memory store for development or before DATABASE_URL is provided
const memoryStore = {
  users: new Map(),
  habits: new Map(),
  pairings: new Map(),
};

export function getDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  if (!neonSql) {
    try {
      // Dynamic import or direct require of @neondatabase/serverless
      const { neon } = require('@neondatabase/serverless');
      neonSql = neon(dbUrl);
    } catch {
      try {
        // ES Module fallback
        import('@neondatabase/serverless').then((mod) => {
          neonSql = mod.neon(dbUrl);
        });
      } catch (e) {
        console.warn('Could not load @neondatabase/serverless:', e.message);
      }
    }
  }
  return neonSql;
}

// Auto-run schema migrations on first invocation
export async function ensureTables() {
  if (tablesInitialized) return;
  const sql = getDb();
  if (!sql) return;

  try {
    // 1. Users table
    await sql`
      CREATE TABLE IF NOT EXISTS duotrack_users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        secret_code VARCHAR(32) UNIQUE NOT NULL,
        display_name VARCHAR(128),
        avatar VARCHAR(16) DEFAULT '🌱',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Habits table
    await sql`
      CREATE TABLE IF NOT EXISTS duotrack_habits (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES duotrack_users(id) ON DELETE CASCADE,
        habit_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        target NUMERIC NOT NULL,
        unit VARCHAR(32) DEFAULT '',
        icon VARCHAR(64) DEFAULT 'star',
        category VARCHAR(32) DEFAULT 'Daily',
        today_value NUMERIC DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        history JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, habit_id)
      );
    `;

    // 3. Pairings table (for together pods)
    await sql`
      CREATE TABLE IF NOT EXISTS duotrack_pairings (
        id SERIAL PRIMARY KEY,
        user1_id VARCHAR(64) REFERENCES duotrack_users(id) ON DELETE CASCADE,
        user2_id VARCHAR(64) REFERENCES duotrack_users(id) ON DELETE CASCADE,
        pod_code VARCHAR(32) UNIQUE NOT NULL,
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    tablesInitialized = true;
  } catch (err) {
    console.warn('Neon DB migration notice:', err.message);
  }
}

// Memory fallback store helpers
export const memoryDb = {
  getUser(usernameOrCode) {
    const clean = usernameOrCode.toLowerCase().trim();
    for (const u of memoryStore.users.values()) {
      if (u.username.toLowerCase() === clean || u.secretCode.toUpperCase() === clean.toUpperCase()) {
        return u;
      }
    }
    return null;
  },
  saveUser(user) {
    memoryStore.users.set(user.id, user);
    return user;
  },
  getUserHabits(userId) {
    return memoryStore.habits.get(userId) || [];
  },
  saveUserHabits(userId, habits) {
    memoryStore.habits.set(userId, habits);
    return habits;
  },
  getPairing(code) {
    const clean = code.toUpperCase().trim();
    for (const p of memoryStore.pairings.values()) {
      if (p.podCode === clean) return p;
    }
    return null;
  },
  savePairing(pairing) {
    memoryStore.pairings.set(pairing.podCode, pairing);
    return pairing;
  }
};
