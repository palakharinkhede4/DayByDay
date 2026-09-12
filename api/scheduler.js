import { getDb } from './db.js';
import { sendNotification } from './push.js';

let schedulerInterval = null;

export function startScheduler() {
  if (schedulerInterval) return;

  console.log('Starting notification scheduler...');

  // Run every 1 minute
  schedulerInterval = setInterval(async () => {
    const sql = getDb();
    if (!sql) return;

    try {
      // Calculate the local time dynamically for each user based on their timezone_offset
      // JS getTimezoneOffset() returns (UTC - Local) in minutes. So Local = UTC - timezone_offset.
      const dueHabits = await sql`
        SELECT DISTINCT h.user_id, h.name, h.target, h.unit
        FROM daybyday_habits h
        JOIN push_subscriptions ps ON h.user_id = ps.user_id
        WHERE ps.disabled_at IS NULL
          AND h.reminder_time = to_char(
              (NOW() AT TIME ZONE 'UTC') - (ps.timezone_offset * INTERVAL '1 minute'),
              'HH24:MI'
          )
          AND (
              h.reminder_days IS NULL 
              OR h.reminder_days = '' 
              OR h.reminder_days ILIKE '%' || lower(trim(to_char((NOW() AT TIME ZONE 'UTC') - (ps.timezone_offset * INTERVAL '1 minute'), 'Dy'))) || '%'
          )
      `;

      // Group by user_id to avoid sending 5 notifications if 5 habits are due at the exact same time
      const usersToNotify = {};
      for (const habit of dueHabits) {
        if (!usersToNotify[habit.user_id]) {
          usersToNotify[habit.user_id] = [];
        }
        usersToNotify[habit.user_id].push(habit);
      }

      for (const userId of Object.keys(usersToNotify)) {
        const habits = usersToNotify[userId];
        const title = 'Time for your habit!';
        let body = '';
        if (habits.length === 1) {
          body = `Don't forget to do: ${habits[0].name}`;
        } else {
          body = `You have ${habits.length} habits scheduled right now.`;
        }

        // Send native push!
        await sendNotification(userId, {
          title,
          body,
          data: { url: '/' }
        });
      }

    } catch (err) {
      console.error('Scheduler error:', err);
    }
  }, 60000); // Check every minute
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
