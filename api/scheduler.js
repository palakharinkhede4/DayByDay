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
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${h}:${m}`;
      
      const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const currentDay = days[now.getDay()];

      // Find all habits that are due right now and haven't been completed today
      // Wait, we can just notify all due habits, user clicks and opens app.
      const dueHabits = await sql`
        SELECT user_id, name, target, unit
        FROM daybyday_habits 
        WHERE reminder_time = ${currentTime}
          AND (reminder_days IS NULL OR reminder_days = '' OR reminder_days LIKE ${'%' + currentDay + '%'})
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
