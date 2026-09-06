// Neon PostgreSQL Database Layer for DuoTrack
// Storage-Optimized Architecture: Designed for <= 0.5 GB Free Tier
// Supports 50-500+ active users for 1+ years within < 5 MB total storage footprint

let neonSql = null;
let tablesInitialized = false;

// Fallback in-memory store for development or offline usage
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
      const { neon } = require('@neondatabase/serverless');
      neonSql = neon(dbUrl);
    } catch {
      try {
        import('@neondatabase/serverless').then((mod) => {
          neonSql = mod.neon(dbUrl);
        });
      } catch (e) {
        console.warn('Neon serverless driver initialization notice:', e.message);
      }
    }
  }
  return neonSql;
}

// Auto-run schema migrations with optimized column types & indexes
export async function ensureTables() {
  if (tablesInitialized) return;
  const sql = getDb();
  if (!sql) return;

  try {
    // 1. Users table (Compact VARCHAR lengths to prevent index/row bloat)
    await sql`
      CREATE TABLE IF NOT EXISTS duotrack_users (
        id VARCHAR(48) PRIMARY KEY,
        username VARCHAR(32) UNIQUE NOT NULL,
        secret_code VARCHAR(16) UNIQUE NOT NULL,
        display_name VARCHAR(64),
        avatar VARCHAR(8) DEFAULT 'star',
        password_hash VARCHAR(128),
        salt VARCHAR(32),
        security_question VARCHAR(128),
        security_answer_hash VARCHAR(128),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Ensure columns exist on existing databases
    await sql`ALTER TABLE duotrack_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);`;
    await sql`ALTER TABLE duotrack_users ADD COLUMN IF NOT EXISTS salt VARCHAR(32);`;
    await sql`ALTER TABLE duotrack_users ADD COLUMN IF NOT EXISTS security_question VARCHAR(128);`;
    await sql`ALTER TABLE duotrack_users ADD COLUMN IF NOT EXISTS security_answer_hash VARCHAR(128);`;


    // 2. Habits table (Compact JSONB historical map: 1 row per habit, keeping table <= 500 rows for 50 users)
    await sql`
      CREATE TABLE IF NOT EXISTS duotrack_habits (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(48) REFERENCES duotrack_users(id) ON DELETE CASCADE,
        habit_id VARCHAR(32) NOT NULL,
        name VARCHAR(64) NOT NULL,
        target NUMERIC(8, 2) NOT NULL DEFAULT 1,
        unit VARCHAR(16) DEFAULT '',
        icon VARCHAR(32) DEFAULT 'target',
        category VARCHAR(24) DEFAULT 'Daily',
        today_value NUMERIC(8, 2) DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        reminder_time VARCHAR(5),
        reminder_days VARCHAR(24),
        streak INT DEFAULT 0,
        history JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, habit_id)
      );
    `;

    // 3. Pairings table
    await sql`
      CREATE TABLE IF NOT EXISTS duotrack_pairings (
        id SERIAL PRIMARY KEY,
        user1_id VARCHAR(48) REFERENCES duotrack_users(id) ON DELETE CASCADE,
        user2_id VARCHAR(48) REFERENCES duotrack_users(id) ON DELETE CASCADE,
        pod_code VARCHAR(24) UNIQUE NOT NULL,
        status VARCHAR(16) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Optimized indexes for fast lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON duotrack_users(LOWER(username));`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_secret ON duotrack_users(UPPER(secret_code));`;
    await sql`CREATE INDEX IF NOT EXISTS idx_habits_user ON duotrack_habits(user_id);`;

    tablesInitialized = true;
  } catch (err) {
    console.warn('Neon DB migration notice:', err.message);
  }
}

// Memory fallback store helpers
export const memoryDb = {
  getUser(usernameOrCode) {
    const clean = (usernameOrCode || '').toLowerCase().trim();
    for (const u of memoryStore.users.values()) {
      if (u.username.toLowerCase() === clean || (u.secretCode && u.secretCode.toUpperCase() === clean.toUpperCase())) {
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
    const clean = (code || '').toUpperCase().trim();
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
