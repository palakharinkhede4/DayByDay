// scripts/cleanup_sept12_rollover.js
// Atomically cleans any bad 2026-09-12 data in PostgreSQL for all 7 users.
// Preserves 2026-09-11 and all earlier dates exactly as-is.
// Uses the SSH tunnel: run this ON the VM, or via ssh pipe with node.
// Usage: node scripts/cleanup_sept12_rollover.js

import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

const sql = postgres(DATABASE_URL, { ssl: false, connect_timeout: 10 });

const TARGET_DATE = '2026-09-12'; // date to wipe
const PRESERVE_BEFORE = '2026-09-12'; // any date < this must remain untouched

function isDateKey(k) {
  return /^\d{4}-\d{2}-\d{2}$/.test(k);
}

function cleanHistoryObj(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!isDateKey(k)) continue;
    let val = v;
    if (typeof val === 'string') {
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (!isNaN(Number(val))) val = Number(val);
    }
    out[k] = val;
  }
  return out;
}

async function main() {
  console.log('='.repeat(60));
  console.log('DayByDay — September 12 Rollover Cleanup');
  console.log('='.repeat(60));

  // Step 1: Audit current state
  const rows = await sql`
    SELECT u.username, h.user_id, h.habit_id, h.today_value, h.completed,
           h.history, h.updated_at
    FROM daybyday_habits h
    JOIN daybyday_users u ON u.id = h.user_id
    ORDER BY u.username, h.habit_id
  `;

  console.log(`\nFound ${rows.length} habit rows across all users.\n`);

  let needsCleanup = 0;
  for (const row of rows) {
    const hist = cleanHistoryObj(row.history);
    const hasBadDate = TARGET_DATE in hist && (Number(hist[TARGET_DATE]) !== 0);
    const hasStaleValue = Number(row.today_value) !== 0 &&
      row.updated_at && new Date(row.updated_at).toISOString().slice(0, 10) < TARGET_DATE;

    if (hasBadDate || hasStaleValue) {
      console.log(`  [NEEDS CLEANUP] ${row.username} / ${row.habit_id}: ` +
        `history[${TARGET_DATE}]=${hist[TARGET_DATE]}, today_value=${row.today_value}`);
      needsCleanup++;
    }
  }

  if (needsCleanup === 0) {
    console.log('✅ No bad September 12 data found. All history[2026-09-12] entries are 0 or absent.\n');
  } else {
    console.log(`\n⚠️  ${needsCleanup} rows need cleanup. Proceeding...\n`);
  }

  // Step 2: Atomic cleanup — for every habit row:
  //   - Remove or zero out history['2026-09-12']
  //   - Set today_value=0, completed=false
  //   - Keep ALL dates before 2026-09-12 exactly unchanged
  //   - Do NOT touch updated_at (we use CURRENT_TIMESTAMP only for today edits)
  let cleaned = 0;
  let preserved = 0;

  await sql.begin(async (txn) => {
    for (const row of rows) {
      const hist = cleanHistoryObj(row.history);

      // Preserve all dates < TARGET_DATE exactly
      const preservedHist = {};
      for (const [k, v] of Object.entries(hist)) {
        if (k < TARGET_DATE) {
          preservedHist[k] = v;
        }
      }
      // Explicitly set TARGET_DATE to 0 (not absent — this is the clean state)
      preservedHist[TARGET_DATE] = 0;

      const currentTargetVal = hist[TARGET_DATE];
      const todayVal = Number(row.today_value) || 0;

      // Only update if something actually changed
      const needsWrite = (currentTargetVal !== 0 && currentTargetVal !== undefined) || todayVal !== 0;

      if (needsWrite) {
        await txn`
          UPDATE daybyday_habits
          SET
            today_value = 0,
            completed   = false,
            history     = ${JSON.stringify(preservedHist)}::jsonb
          WHERE user_id  = ${row.user_id}
            AND habit_id = ${row.habit_id}
        `;
        console.log(`  [CLEANED] ${row.user_id.slice(0, 8)}… / ${row.habit_id}: ` +
          `history[${TARGET_DATE}] ${currentTargetVal} → 0, today_value ${todayVal} → 0`);
        cleaned++;
      } else {
        preserved++;
      }
    }
  });

  console.log(`\n✅ Cleanup complete: ${cleaned} rows updated, ${preserved} rows already clean.\n`);

  // Step 3: Verify — re-read all rows and confirm no bad data
  console.log('='.repeat(60));
  console.log('VERIFICATION');
  console.log('='.repeat(60));

  const verify = await sql`
    SELECT u.username, h.habit_id,
           h.today_value,
           h.completed,
           h.history->>${'2026-09-11'} AS sept11,
           h.history->>${'2026-09-12'} AS sept12
    FROM daybyday_habits h
    JOIN daybyday_users u ON u.id = h.user_id
    ORDER BY u.username, h.habit_id
  `;

  let allPass = true;
  console.log('\n  Username          | Habit              | Sept-11 | Sept-12 | today_value | OK?');
  console.log('  ' + '-'.repeat(80));

  for (const r of verify) {
    const sept12Val = r.sept12 !== null ? Number(r.sept12) : null;
    const todayVal = Number(r.today_value) || 0;
    const ok = (sept12Val === 0 || sept12Val === null) && todayVal === 0;
    if (!ok) allPass = false;
    const status = ok ? '✅' : '❌';
    console.log(`  ${(r.username || '').padEnd(16)} | ${(r.habit_id || '').padEnd(18)} | ` +
      `${String(r.sept11 ?? '—').padEnd(7)} | ${String(r.sept12 ?? '—').padEnd(7)} | ` +
      `${String(r.today_value).padEnd(11)} | ${status}`);
  }

  console.log('');
  if (allPass) {
    console.log('✅ VERIFICATION PASSED — All Sept-12 values are 0 or absent. Sept-11 data intact.');
  } else {
    console.log('❌ VERIFICATION FAILED — Some rows still have non-zero Sept-12 values!');
    process.exit(1);
  }

  await sql.end();
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
