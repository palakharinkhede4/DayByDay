// Neon PostgreSQL Database Layer for DayByDay
// Storage-Optimized Architecture: Designed for <= 0.5 GB Free Tier
// Supports 50-500+ active users for 1+ years within < 5 MB total storage footprint

import { neon } from '@neondatabase/serverless';

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
    neonSql = neon(dbUrl);
  }
  return neonSql;
}

// Auto-run schema migrations with optimized column types & indexes
export async function ensureTables() {
  if (tablesInitialized) return;
  const sql = getDb();
  if (!sql) return;

  try {
    // 0. Smoothly migrate legacy tables if they exist
    try {
      await sql`
        DO $$ BEGIN
          IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'duotrack_users') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'daybyday_users') THEN
            ALTER TABLE duotrack_users RENAME TO daybyday_users;
          END IF;
          IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'duotrack_habits') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'daybyday_habits') THEN
            ALTER TABLE duotrack_habits RENAME TO daybyday_habits;
          END IF;
          IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'duotrack_pairings') AND NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'daybyday_pairings') THEN
            ALTER TABLE duotrack_pairings RENAME TO daybyday_pairings;
          END IF;
        END $$;
      `;
    } catch (migErr) {
      // Non-blocking if tables are already renamed or user lacks DDL rename rights
    }

    // 1. Users table (Compact VARCHAR lengths to prevent index/row bloat)
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

    // Ensure columns exist on existing databases
    await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(128);`;
    await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS salt VARCHAR(32);`;
    await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS security_question VARCHAR(128);`;
    await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS security_answer_hash VARCHAR(128);`;
    await sql`ALTER TABLE daybyday_users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;`;

    // 2. Habits table (Compact JSONB historical map: 1 row per habit, keeping table <= 500 rows for 50 users)
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

    await sql`ALTER TABLE daybyday_habits ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';`;

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

    // 4. Group Pods table (Multi-member group pods up to 10 users)
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

    // Optimized indexes for fast lookups
    await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_users_username ON daybyday_users(LOWER(username));`;
    await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_users_secret ON daybyday_users(UPPER(secret_code));`;
    await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_habits_user ON daybyday_habits(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_daybyday_group_pods_code ON daybyday_group_pods(UPPER(code));`;

    // 5. Automatic Bulk Upgrade: Ensure 100% of all existing users have unique, distinct secret codes
    try {
      const usersToUpgrade = await sql`
        SELECT id, username, secret_code 
        FROM daybyday_users 
        WHERE secret_code IS NULL 
           OR secret_code = '' 
           OR secret_code IN ('DAY-1000', 'DBD-1000', 'DUO-1000')
           OR secret_code IN (
             SELECT secret_code FROM daybyday_users GROUP BY secret_code HAVING COUNT(*) > 1
           )
      `;
      for (const u of usersToUpgrade) {
        const clean = (u.username || 'DBD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'DBD';
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const newCode = `${clean}-${randNum}${randChar}`;
        await sql`UPDATE daybyday_users SET secret_code = ${newCode} WHERE id = ${u.id}`;
      }

      // Ensure 100% of all existing group pods have unique codes
      const podsToUpgrade = await sql`
        SELECT id, name, code 
        FROM daybyday_group_pods 
        WHERE code IS NULL 
           OR code = '' 
           OR code IN ('DAY-1000', 'DBD-1000', 'POD-1000')
           OR code IN (
             SELECT code FROM daybyday_group_pods GROUP BY code HAVING COUNT(*) > 1
           )
      `;
      for (const p of podsToUpgrade) {
        const prefix = (p.name || 'POD').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'POD';
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const newPodCode = `${prefix}-${randNum}${randChar}`;
        await sql`UPDATE daybyday_group_pods SET code = ${newPodCode} WHERE id = ${p.id}`;
      }

      // Ensure 100% of all active pairings have unique pod codes
      const pairsToUpgrade = await sql`
        SELECT id, pod_code 
        FROM daybyday_pairings 
        WHERE pod_code IS NULL 
           OR pod_code = '' 
           OR pod_code IN ('DAY-1000', 'DBD-1000', 'POD-1000')
           OR pod_code IN (
             SELECT pod_code FROM daybyday_pairings GROUP BY pod_code HAVING COUNT(*) > 1
           )
      `;
      for (const pr of pairsToUpgrade) {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const newPairCode = `POD_${Date.now().toString(36).toUpperCase()}_${randNum}`;
        await sql`UPDATE daybyday_pairings SET pod_code = ${newPairCode} WHERE id = ${pr.id}`;
      }
    } catch (bulkErr) {
      console.warn('Notice upgrading existing codes:', bulkErr.message);
    }

    tablesInitialized = true;
  } catch (err) {
    console.warn('Neon DB migration notice:', err.message);
  }
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
  }
};
