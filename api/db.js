// PostgreSQL Database Layer for DayByDay (Hosted on Oracle Cloud Always Free VM)
import postgres from 'postgres';

let sqlClient = null;
let tablesInitialized = false;
let tableInitPromise = null;

// Fallback in-memory store for development or offline usage
const memoryStore = {
  users: new Map(),
  habits: new Map(),
  pairings: new Map(),
  groupPods: new Map(),
  cheers: [],
};

export function getDb() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  if (!sqlClient) {
    const isSsl = dbUrl.includes('sslmode=require');
    sqlClient = postgres(dbUrl, {
      ssl: isSsl ? 'require' : false,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sqlClient;
}

export function isTablesInitialized() {
  return tablesInitialized;
}

// Auto-run schema migrations with optimized column types & indexes (strictly once per worker)
export async function ensureTables(force = false) {
  if (tablesInitialized && !force) return;
  if (tableInitPromise && !force) return tableInitPromise;

  const sql = getDb();
  if (!sql) {
    tablesInitialized = true;
    return;
  }

  tableInitPromise = (async () => {
    try {
      // 1. Users table
      await sql`
        CREATE TABLE IF NOT EXISTS daybyday_users (
          id VARCHAR(48) PRIMARY KEY,
          username VARCHAR(32) UNIQUE NOT NULL,
          secret_code VARCHAR(16) UNIQUE NOT NULL,
          display_name VARCHAR(64),
          avatar VARCHAR(8) DEFAULT 'star',
          password_hash VARCHAR(128),
          salt VARCHAR(32),
          security_question VARCHAR(128),
          security_answer_hash VARCHAR(128),
          preferences JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          last_active TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // Ensure columns exist on legacy databases
      await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);`;
      await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS salt VARCHAR(32);`;
      await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS security_question VARCHAR(128);`;
      await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS security_answer_hash VARCHAR(128);`;
      await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;`;

      // 2. Habits table
      await sql`
        CREATE TABLE IF NOT EXISTS daybyday_habits (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(48) REFERENCES daybyday_users(id) ON DELETE CASCADE,
          habit_id VARCHAR(32) NOT NULL,
          name VARCHAR(64) NOT NULL,
          description TEXT DEFAULT '',
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
        CREATE TABLE IF NOT EXISTS daybyday_pairings (
          id SERIAL PRIMARY KEY,
          user1_id VARCHAR(48) REFERENCES daybyday_users(id) ON DELETE CASCADE,
          user2_id VARCHAR(48) REFERENCES daybyday_users(id) ON DELETE CASCADE,
          pod_code VARCHAR(24) UNIQUE NOT NULL,
          status VARCHAR(16) DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // 4. Group Pods table
      await sql`
        CREATE TABLE IF NOT EXISTS daybyday_group_pods (
          id VARCHAR(48) PRIMARY KEY,
          name VARCHAR(64) NOT NULL,
          code VARCHAR(24) UNIQUE NOT NULL,
          members JSONB DEFAULT '[]'::jsonb,
          shared_goals JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // 5. Cheers / Encouragement table (Real cross-user encouragement)
      await sql`
        CREATE TABLE IF NOT EXISTS daybyday_cheers (
          id SERIAL PRIMARY KEY,
          to_user_id VARCHAR(48),
          from_user_id VARCHAR(48),
          from_username VARCHAR(32),
          from_name VARCHAR(64),
          from_avatar VARCHAR(32),
          pod_code VARCHAR(24),
          message VARCHAR(256),
          goal_name VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          is_read BOOLEAN DEFAULT FALSE
        );
      `;
      await sql`ALTER TABLE daybyday_cheers ADD COLUMN IF NOT EXISTS goal_name VARCHAR(64);`;

      // Optimized indexes for fast lookups
      await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_users_username ON daybyday_users(LOWER(username));`;
      await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_users_secret ON daybyday_users(UPPER(secret_code));`;
      await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_habits_user ON daybyday_habits(user_id);`;
      await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_group_pods_code ON daybyday_group_pods(UPPER(code));`;
      await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_cheers_to ON daybyday_cheers(to_user_id, is_read);`;

      tablesInitialized = true;
    } catch (err) {
      console.warn('Neon DB migration notice:', err.message);
      // Mark initialized to avoid repeating failed DDL on every subsequent request
      tablesInitialized = true;
    } finally {
      tableInitPromise = null;
    }
  })();

  return tableInitPromise;
}

// Memory fallback store helpers
export const memoryDb = {
  getUser(idOrUsernameOrCode) {
    if (!idOrUsernameOrCode) return null;
    if (memoryStore.users.has(idOrUsernameOrCode)) {
      return memoryStore.users.get(idOrUsernameOrCode);
    }
    const clean = String(idOrUsernameOrCode).toLowerCase().trim();
    for (const u of memoryStore.users.values()) {
      if (
        u.id === idOrUsernameOrCode ||
        u.username.toLowerCase() === clean ||
        (u.secretCode && u.secretCode.toUpperCase() === clean.toUpperCase())
      ) {
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
  },
  getGroupPod(code) {
    const clean = (code || '').toUpperCase().trim();
    if (!memoryStore.groupPods) memoryStore.groupPods = new Map();
    return memoryStore.groupPods.get(clean) || null;
  },
  saveGroupPod(pod) {
    if (!memoryStore.groupPods) memoryStore.groupPods = new Map();
    const clean = (pod.code || '').toUpperCase().trim();
    memoryStore.groupPods.set(clean, pod);
    return pod;
  },
  addCheer(cheer) {
    if (!memoryStore.cheers) memoryStore.cheers = [];
    memoryStore.cheers.push({
      id: Date.now(),
      created_at: new Date().toISOString(),
      is_read: false,
      ...cheer,
    });
    return cheer;
  },
  getCheersForUser(userId, podCode) {
    if (!memoryStore.cheers) memoryStore.cheers = [];
    return memoryStore.cheers.filter((c) => {
      if (userId && c.to_user_id === userId) return true;
      if (podCode && c.pod_code === podCode) return true;
      return false;
    });
  },
};
