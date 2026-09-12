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
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return null;

  // On Oracle Cloud VM or production host, automatically normalize self-referential IPs or domain to 127.0.0.1 loopback
  dbUrl = dbUrl.replace(/@(137\.23\.55\.91|130\.61\.229\.21|daybypalak\.duckdns\.org|localhost):/g, '@127.0.0.1:');

  if (!sqlClient) {
    const isSsl = dbUrl.includes('sslmode=require');
    sqlClient = postgres(dbUrl, {
      ssl: isSsl ? 'require' : false,
      max: 20,
      idle_timeout: 300,
      connect_timeout: 5,
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
      // Execute entire DDL schema in a single batched multi-statement query
      await sql.unsafe(`
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
        ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);
        ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS salt VARCHAR(32);
        ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS security_question VARCHAR(128);
        ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS security_answer_hash VARCHAR(128);
        ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS security_salt VARCHAR(32);
        ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
        ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

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

        CREATE TABLE IF NOT EXISTS daybyday_pairings (
          id SERIAL PRIMARY KEY,
          user1_id VARCHAR(48) REFERENCES daybyday_users(id) ON DELETE CASCADE,
          user2_id VARCHAR(48) REFERENCES daybyday_users(id) ON DELETE CASCADE,
          pod_code VARCHAR(24) UNIQUE NOT NULL,
          status VARCHAR(16) DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS daybyday_group_pods (
          id VARCHAR(48) PRIMARY KEY,
          name VARCHAR(64) NOT NULL,
          code VARCHAR(24) UNIQUE NOT NULL,
          members JSONB DEFAULT '[]'::jsonb,
          shared_goals JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

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
        ALTER TABLE daybyday_cheers ADD COLUMN IF NOT EXISTS goal_name VARCHAR(64);

        CREATE TABLE IF NOT EXISTS daybyday_activity (
          id VARCHAR(48) PRIMARY KEY,
          user_id VARCHAR(48) NOT NULL,
          username VARCHAR(32) NOT NULL,
          display_name VARCHAR(64),
          avatar VARCHAR(32) DEFAULT 'star',
          profile_picture TEXT,
          type VARCHAR(32) NOT NULL,
          pod_code VARCHAR(24),
          title VARCHAR(128) NOT NULL,
          description VARCHAR(256),
          metadata JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_daybyday_users_username ON daybyday_users(LOWER(username));
        CREATE INDEX IF NOT EXISTS idx_daybyday_users_secret ON daybyday_users(UPPER(secret_code));
        CREATE INDEX IF NOT EXISTS idx_daybyday_habits_user ON daybyday_habits(user_id);
        CREATE INDEX IF NOT EXISTS idx_daybyday_habits_user_habit ON daybyday_habits(user_id, habit_id);
        CREATE INDEX IF NOT EXISTS idx_daybyday_group_pods_code ON daybyday_group_pods(UPPER(code));
        CREATE INDEX IF NOT EXISTS idx_daybyday_cheers_to ON daybyday_cheers(to_user_id, is_read);
        CREATE INDEX IF NOT EXISTS idx_daybyday_cheers_created ON daybyday_cheers(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_daybyday_activity_pod ON daybyday_activity(pod_code, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_daybyday_activity_user ON daybyday_activity(user_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS push_subscriptions ( 
          id VARCHAR(48) PRIMARY KEY, 
          user_id VARCHAR(48) NOT NULL REFERENCES daybyday_users(id) ON DELETE CASCADE, 
          platform VARCHAR(32) NOT NULL CHECK (platform IN ('ios_web', 'android')), 
          provider VARCHAR(32) NOT NULL CHECK (provider IN ('webpush', 'fcm')), 
          endpoint TEXT, 
          p256dh TEXT, 
          auth TEXT, 
          fcm_token TEXT, 
          device_id VARCHAR(64), 
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, 
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          last_success_at TIMESTAMPTZ, 
          last_failure_at TIMESTAMPTZ, 
          disabled_at TIMESTAMPTZ 
        ); 
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id); 
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(user_id) WHERE disabled_at IS NULL;
      `);

      tablesInitialized = true;
    } catch (err) {
      console.warn('Oracle DB schema initialization notice:', err.message);
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
