import React, { useState, useMemo } from 'react';
import { useHabits } from '../context/HabitContext';

function formatDays(days) {
  if (!days || !days.length) return 'Daily';
  if (Array.isArray(days)) {
    if (days.length === 7) return 'Daily';
    if (days.length === 5 && !days.includes('Sat') && !days.includes('Sun')) return 'Mon-Fri';
    if (days.length === 2 && days.includes('Sat') && days.includes('Sun')) return 'Weekends';
    return days.join(', ');
  }
  return String(days);
}

export const HabitCards = ({ onOpenAddGoal }) => {
  const {
    habits,
    beyondGoals,
    pod,
    user,
    partner,
    isSolo,
    activeUserId,
    updateHabit,
    updateBeyondGoal,
    removeGoal,
  } = useHabits();

  const [selectedCategory, setSelectedCategory] = useState('All');

  const partnerId = activeUserId === 'user1' ? 'user2' : 'user1';
  const partnerName = partner ? (partner.displayName || partner.username) : pod.user2.name;
  const currentUserName = user ? (user.displayName || user.username) : pod.user1.name;

  const completedCount = useMemo(() => {
    return habits.filter((h) => {
      if (typeof h.user1 === 'boolean') return h.user1;
      return (h.user1 || 0) >= h.target;
    }).length;
  }, [habits]);

  const categories = ['All', 'Daily', 'Health', 'Fitness', 'Mind', 'Work'];

  const matchesCat = (h) => {
    if (!h) return false;
    if (selectedCategory === 'All') return true;
    const cat = (h.category || 'Daily').toLowerCase();
    const sel = selectedCategory.toLowerCase();
    if (sel === 'health') {
      return cat === 'health' || ['water', 'sleep', 'vitamins'].includes(h.id);
    }
    if (sel === 'fitness') {
      return cat === 'fitness' || ['steps', 'workouts', 'running'].includes(h.id);
    }
    if (sel === 'mind') {
      return cat === 'mind' || ['meditation', 'reading', 'journaling'].includes(h.id);
    }
    return cat === sel;
  };

  const standardIds = ['sleep', 'steps', 'meditation', 'water', 'reading', 'workouts', 'vitamins'];
  const customHabits = habits.filter((h) => !standardIds.includes(h.id));

  return (
    <div className="habit-cards-section">
      {/* Category Pills & Progress Bar */}
      <div className="habits-filter-bar">
        <div className="category-scroll-chips">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="today-progress-chip">
          <span className="progress-dot"></span>
          <span>{completedCount}/{habits.length} Done</span>
        </div>
      </div>

      {/* 1. SLEEP CARD (WIDE CARD) */}
      {habits.find((h) => h.id === 'sleep') && matchesCat(habits.find((h) => h.id === 'sleep')) && (
        <SleepCard
          habit={habits.find((h) => h.id === 'sleep')}
          activeUserId={activeUserId}
          partnerId={partnerId}
          partnerName={partnerName}
          currentUserName={currentUserName}
          isSolo={isSolo}
          onUpdate={updateHabit}
        />
      )}

      {/* 2. STEPS & MEDITATION (TWO-COLUMN GRID) */}
      {((habits.find((h) => h.id === 'steps') && matchesCat(habits.find((h) => h.id === 'steps'))) ||
        (habits.find((h) => h.id === 'meditation') && matchesCat(habits.find((h) => h.id === 'meditation')))) && (
        <div className="habit-grid-two">
          {habits.find((h) => h.id === 'steps') && matchesCat(habits.find((h) => h.id === 'steps')) && (
            <StepsCard
              habit={habits.find((h) => h.id === 'steps')}
              activeUserId={activeUserId}
              partnerId={partnerId}
              partnerName={partnerName}
              currentUserName={currentUserName}
              isSolo={isSolo}
              onUpdate={updateHabit}
            />
          )}

          {habits.find((h) => h.id === 'meditation') && matchesCat(habits.find((h) => h.id === 'meditation')) && (
            <MeditationCard
              habit={habits.find((h) => h.id === 'meditation')}
              activeUserId={activeUserId}
              partnerId={partnerId}
              partnerName={partnerName}
              currentUserName={currentUserName}
              isSolo={isSolo}
              onUpdate={updateHabit}
            />
          )}
        </div>
      )}

      {/* 3. WATER & READING (TWO-COLUMN GRID) */}
      {((habits.find((h) => h.id === 'water') && matchesCat(habits.find((h) => h.id === 'water'))) ||
        (habits.find((h) => h.id === 'reading') && matchesCat(habits.find((h) => h.id === 'reading')))) && (
        <div className="habit-grid-two">
          {habits.find((h) => h.id === 'water') && matchesCat(habits.find((h) => h.id === 'water')) && (
            <WaterCard
              habit={habits.find((h) => h.id === 'water')}
              activeUserId={activeUserId}
              partnerId={partnerId}
              partnerName={partnerName}
              currentUserName={currentUserName}
              isSolo={isSolo}
              onUpdate={updateHabit}
            />
          )}

          {habits.find((h) => h.id === 'reading') && matchesCat(habits.find((h) => h.id === 'reading')) && (
            <ReadingCard
              habit={habits.find((h) => h.id === 'reading')}
              activeUserId={activeUserId}
              partnerId={partnerId}
              partnerName={partnerName}
              currentUserName={currentUserName}
              isSolo={isSolo}
              onUpdate={updateHabit}
            />
          )}
        </div>
      )}

      {/* 4. WORKOUTS & VITAMINS (TWO-COLUMN GRID) */}
      {((habits.find((h) => h.id === 'workouts') && matchesCat(habits.find((h) => h.id === 'workouts'))) ||
        (habits.find((h) => h.id === 'vitamins') && matchesCat(habits.find((h) => h.id === 'vitamins')))) && (
        <div className="habit-grid-two">
          {habits.find((h) => h.id === 'workouts') && matchesCat(habits.find((h) => h.id === 'workouts')) && (
            <WorkoutCard
              habit={habits.find((h) => h.id === 'workouts')}
              activeUserId={activeUserId}
              partnerId={partnerId}
              partnerName={partnerName}
              currentUserName={currentUserName}
              isSolo={isSolo}
              onUpdate={updateHabit}
            />
          )}

          {habits.find((h) => h.id === 'vitamins') && matchesCat(habits.find((h) => h.id === 'vitamins')) && (
            <VitaminsCard
              habit={habits.find((h) => h.id === 'vitamins')}
              activeUserId={activeUserId}
              partnerId={partnerId}
              partnerName={partnerName}
              currentUserName={currentUserName}
              isSolo={isSolo}
              onUpdate={updateHabit}
            />
          )}
        </div>
      )}

      {/* 5. CUSTOM GOALS */}
      {customHabits.filter(matchesCat).map((custom) => (
        <GenericHabitCard
          key={custom.id}
          habit={custom}
          activeUserId={activeUserId}
          partnerId={partnerId}
          partnerName={partnerName}
          currentUserName={currentUserName}
          isSolo={isSolo}
          onUpdate={updateHabit}
          onRemove={removeGoal}
        />
      ))}

      {/* 6. BEYOND TODAY SECTION */}
      {(selectedCategory === 'All' || selectedCategory === 'Daily') && (
        <>
          <div className="beyond-today-header">
            <h3 className="beyond-title font-bold">Beyond Today</h3>
            <span className="beyond-sub">Periodic & lifestyle goals</span>
          </div>

          <div className="beyond-cards-grid">
            {beyondGoals.map((g) => (
              <div key={g.id} className="beyond-card">
                <div className="beyond-card-header">
                  <div className="beyond-title-group">
                    <span className="beyond-icon">
                      {g.id === 'savings' ? '💰' : '⚖️'}
                    </span>
                    <span className="beyond-name">{g.name}</span>
                  </div>
                  <span className="beyond-tag">{isSolo ? 'Personal' : 'Sync'}</span>
                </div>

                <div className="beyond-values">
                  <div className="beyond-user-val">
                    <span className="user-dot user1-dot"></span>
                    <span className="val-text">
                      {g.id === 'savings' ? `$${g.user1 || 0}` : `${g.user1 || 0} ${g.unit}`}
                    </span>
                    <span className="val-sub">{isSolo ? 'Current' : currentUserName}</span>
                  </div>

                  {!isSolo && (
                    <div className="beyond-user-val right">
                      <span className="user-dot user2-dot"></span>
                      <span className="val-text">
                        {g.id === 'savings' ? `$${g.user2 || 0}` : `${g.user2 || 0} ${g.unit}`}
                      </span>
                      <span className="val-sub">{partnerName}</span>
                    </div>
                  )}
                </div>

                <div className="beyond-quick-actions">
                  <button
                    className="mini-stepper-btn"
                    onClick={() => updateBeyondGoal(g.id, 'user1', g.id === 'savings' ? 25 : -1)}
                  >
                    {g.id === 'savings' ? '+$25' : '-1 lb'}
                  </button>
                  <button
                    className="mini-stepper-btn"
                    onClick={() => updateBeyondGoal(g.id, 'user1', g.id === 'savings' ? 50 : 1)}
                  >
                    {g.id === 'savings' ? '+$50' : '+1 lb'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* --- SLEEP CARD --- */
const SleepCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate }) => {
  const u1Val = habit.user1 || 0;
  const u2Val = habit.user2 || 0;

  const totalSegments = 8;
  const u1Segments = Math.min(8, Math.round((u1Val / habit.target) * totalSegments));
  const u2Segments = Math.min(8, Math.round((u2Val / habit.target) * totalSegments));

  return (
    <div className="habit-card sleep-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon sleep-icon">🌙</span>
          <div>
            <span className="habit-name">{habit.name}</span>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime} · {formatDays(habit.reminderDays)}
              </span>
            )}
          </div>
        </div>
        <div className="habit-header-meta">
          {habit.streak > 0 && <span className="habit-streak-badge">🔥 {habit.streak}d</span>}
          <span className="habit-meta-tag">Target: {habit.target}h</span>
        </div>
      </div>

      <div className="sleep-duration-row">
        <div className="sleep-user-col">
          <span className="sleep-val user1-text">{habit.user1Display || `${u1Val}h`}</span>
          <span className="sleep-sub">{isSolo ? 'Last night' : currentUserName}</span>
        </div>
        {!isSolo && (
          <>
            <div className="sleep-separator">
              <span className="moon-phase">🌓</span>
            </div>
            <div className="sleep-user-col right">
              <span className="sleep-val user2-text">{habit.user2Display || `${u2Val}h`}</span>
              <span className="sleep-sub">{partnerName}</span>
            </div>
          </>
        )}
      </div>

      {/* Segmented Bars */}
      <div className="sleep-segments-container">
        <div className="segment-track user1-track">
          {Array.from({ length: totalSegments }).map((_, i) => (
            <div
              key={`u1-${i}`}
              className={`sleep-bar-seg ${i < u1Segments ? 'filled u1-fill' : ''}`}
            />
          ))}
        </div>

        {!isSolo && (
          <div className="segment-track user2-track">
            {Array.from({ length: totalSegments }).map((_, i) => (
              <div
                key={`u2-${i}`}
                className={`sleep-bar-seg ${i < u2Segments ? 'filled u2-fill' : ''}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Stepper */}
      <div className="card-quick-footer">
        <span className="active-logging-hint">Log sleep:</span>
        <div className="stepper-group">
          <button className="stepper-btn" onClick={() => onUpdate('sleep', 'user1', -0.5)}>-30m</button>
          <button className="stepper-btn highlight" onClick={() => onUpdate('sleep', 'user1', 0.5)}>+30m</button>
          <button className="stepper-btn" onClick={() => onUpdate('sleep', 'user1', 1.0)}>+1h</button>
        </div>
      </div>
    </div>
  );
};

/* --- STEPS CARD --- */
const StepsCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate }) => {
  const u1Progress = Math.min(1, (habit.user1 || 0) / habit.target);
  const u2Progress = Math.min(1, (habit.user2 || 0) / habit.target);

  const size = 96;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="habit-card steps-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon steps-icon">👟</span>
          <div>
            <span className="habit-name">{habit.name}</span>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime}
              </span>
            )}
          </div>
        </div>
        {habit.streak > 0 && <span className="habit-streak-badge">🔥 {habit.streak}d</span>}
      </div>

      <div className="steps-rings-container">
        <div className="dual-ring-wrap">
          <svg width={size} height={size} className="progress-ring-svg">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--user1-color)"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - u1Progress)}
              strokeLinecap="round"
              className="ring-circle"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            {!isSolo && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius - 12}
                stroke="var(--user2-color)"
                strokeWidth={strokeWidth - 2}
                fill="none"
                strokeDasharray={2 * Math.PI * (radius - 12)}
                strokeDashoffset={2 * Math.PI * (radius - 12) * (1 - u2Progress)}
                strokeLinecap="round"
                className="ring-circle"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              />
            )}
          </svg>

          <div className="ring-center-icon">
            <span className="mini-shoe">⚡</span>
          </div>
        </div>

        <div className="steps-count-row">
          <div className="step-val-col">
            <span className="val-user1 font-bold">{(habit.user1 || 0).toLocaleString()}</span>
            <span className="sub-user">{isSolo ? '/ 10,000' : currentUserName}</span>
          </div>
          {!isSolo && (
            <div className="step-val-col right">
              <span className="val-user2 font-bold">{(habit.user2 || 0).toLocaleString()}</span>
              <span className="sub-user">{partnerName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-stepper-row">
        <button className="card-quick-btn" onClick={() => onUpdate('steps', 'user1', 500)}>+500</button>
        <button className="card-quick-btn highlight" onClick={() => onUpdate('steps', 'user1', 1500)}>+1.5k</button>
      </div>
    </div>
  );
};

/* --- MEDITATION CARD --- */
const MeditationCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate }) => {
  return (
    <div className="habit-card meditation-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon meditation-icon">🧘</span>
          <div>
            <span className="habit-name">{habit.name}</span>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime}
              </span>
            )}
          </div>
        </div>
        {habit.streak > 0 && <span className="habit-streak-badge">🔥 {habit.streak}d</span>}
      </div>

      <div className="meditation-visual">
        <div className="pulse-ring-outer">
          <div className="pulse-ring-inner">
            <span className="zen-lotus">✨</span>
          </div>
        </div>

        <div className="meditation-stats-row">
          <div className="med-user-stat">
            <span className="stat-min font-bold">{habit.user1 || 0}m</span>
            <span className="stat-label">{isSolo ? '/ 10m target' : currentUserName}</span>
          </div>
          {!isSolo && (
            <div className="med-user-stat right">
              <span className="stat-min font-bold stat-partner">{habit.user2 || 0}m</span>
              <span className="stat-label">{partnerName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-stepper-row">
        <button className="card-quick-btn" onClick={() => onUpdate('meditation', 'user1', 5)}>+5m</button>
        <button className="card-quick-btn highlight" onClick={() => onUpdate('meditation', 'user1', 10)}>+10m</button>
      </div>
    </div>
  );
};

/* --- WATER CARD --- */
const WaterCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate }) => {
  const currentVal = habit.user1 || 0;
  return (
    <div className="habit-card water-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon water-icon">💧</span>
          <div>
            <span className="habit-name">{habit.name}</span>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime}
              </span>
            )}
          </div>
        </div>
        <div className="habit-header-meta">
          {habit.streak > 0 && <span className="habit-streak-badge">🔥 {habit.streak}d</span>}
          <span className="habit-target-tag">{currentVal}/{habit.target} {habit.unit}</span>
        </div>
      </div>

      <div className="water-glasses-row">
        {Array.from({ length: habit.target }).map((_, i) => (
          <span
            key={i}
            className={`water-glass-dot ${i < currentVal ? 'drank' : ''}`}
            onClick={() => onUpdate('water', 'user1', i + 1, true)}
          />
        ))}
      </div>

      <div className="card-stepper-row">
        <button
          className="card-quick-btn highlight full-width"
          onClick={() => onUpdate('water', 'user1', 1)}
        >
          +1 Drink 💧
        </button>
      </div>
    </div>
  );
};

/* --- READING CARD --- */
const ReadingCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate }) => {
  return (
    <div className="habit-card reading-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon reading-icon">📖</span>
          <div>
            <span className="habit-name">{habit.name}</span>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime}
              </span>
            )}
          </div>
        </div>
        <div className="habit-header-meta">
          {habit.streak > 0 && <span className="habit-streak-badge">🔥 {habit.streak}d</span>}
          <span className="habit-target-tag">{habit.user1 || 0}/{habit.target} {habit.unit}</span>
        </div>
      </div>

      <div className="reading-progress-bar-wrap">
        <div
          className="reading-fill"
          style={{ width: `${Math.min(100, ((habit.user1 || 0) / habit.target) * 100)}%` }}
        />
      </div>

      <div className="card-stepper-row">
        <button className="card-quick-btn" onClick={() => onUpdate('reading', 'user1', 2)}>+2 pgs</button>
        <button className="card-quick-btn highlight" onClick={() => onUpdate('reading', 'user1', 5)}>+5 pgs</button>
      </div>
    </div>
  );
};

/* --- WORKOUT CARD --- */
const WorkoutCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate }) => {
  return (
    <div className="habit-card workout-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon workout-icon">🏋️</span>
          <div>
            <span className="habit-name">{habit.name}</span>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime}
              </span>
            )}
          </div>
        </div>
        <div className="habit-header-meta">
          {habit.streak > 0 && <span className="habit-streak-badge">🔥 {habit.streak}d</span>}
          <span className="habit-target-tag">{habit.user1 || 0}/{habit.target} min</span>
        </div>
      </div>

      <div className="card-stepper-row">
        <button className="card-quick-btn" onClick={() => onUpdate('workouts', 'user1', 15)}>+15m</button>
        <button className="card-quick-btn highlight" onClick={() => onUpdate('workouts', 'user1', 30)}>+30m</button>
      </div>
    </div>
  );
};

/* --- VITAMINS CARD --- */
const VitaminsCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate }) => {
  const isDone = Boolean(habit.user1);
  return (
    <div className="habit-card vitamins-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon vitamins-icon">💊</span>
          <div>
            <span className="habit-name">{habit.name}</span>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime}
              </span>
            )}
          </div>
        </div>
        {habit.streak > 0 && <span className="habit-streak-badge">🔥 {habit.streak}d</span>}
      </div>

      <div className="vitamins-action-center">
        <button
          className={`vitamin-pill-toggle ${isDone ? 'done' : ''}`}
          onClick={() => onUpdate('vitamins', 'user1', !isDone, true)}
        >
          <span className="pill-check-icon">{isDone ? '✓' : '○'}</span>
          <span>{isDone ? 'Taken Today' : 'Mark Taken'}</span>
        </button>
      </div>
    </div>
  );
};

/* --- GENERIC CUSTOM HABIT CARD --- */
const GenericHabitCard = ({ habit, activeUserId, partnerId, partnerName, currentUserName, isSolo, onUpdate, onRemove }) => {
  const isBool = typeof habit.user1 === 'boolean';
  const u1Val = habit.user1 || 0;
  const percent = isBool ? (habit.user1 ? 100 : 0) : Math.min(100, Math.round((u1Val / (habit.target || 1)) * 100));

  return (
    <div className={`habit-card generic-card ${habit.completed || (isBool && habit.user1) ? 'is-completed' : ''}`}>
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon">{habit.icon || '🎯'}</span>
          <div>
            <div className="generic-name-row">
              <span className="habit-name font-bold">{habit.name}</span>
              {habit.streak > 0 && (
                <span className="habit-streak-badge">🔥 {habit.streak}d</span>
              )}
            </div>
            {habit.reminderTime && (
              <span className="habit-reminder-pill">
                ⏰ {habit.reminderTime} · {formatDays(habit.reminderDays)}
              </span>
            )}
          </div>
        </div>

        <div className="generic-header-actions">
          <span className="habit-target-tag">
            {isBool ? (habit.user1 ? 'Done' : 'Pending') : `${u1Val}/${habit.target} ${habit.unit}`}
          </span>
          <button
            type="button"
            className="habit-remove-action-btn"
            onClick={() => onRemove(habit.id)}
            title="Delete habit"
            aria-label={`Delete ${habit.name}`}
          >
            ✕
          </button>
        </div>
      </div>

      {!isBool && (
        <div className="generic-progress-track">
          <div className="generic-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}

      <div className="card-stepper-row">
        {isBool ? (
          <button
            className={`card-quick-btn highlight full-width ${habit.user1 ? 'active' : ''}`}
            onClick={() => onUpdate(habit.id, 'user1', !habit.user1, true)}
          >
            {habit.user1 ? 'Completed ✓' : 'Mark Done'}
          </button>
        ) : (
          <>
            <button
              className="card-quick-btn subtle"
              onClick={() => onUpdate(habit.id, 'user1', -1)}
              disabled={!u1Val}
            >
              -1
            </button>
            <button className="card-quick-btn" onClick={() => onUpdate(habit.id, 'user1', 1)}>
              +1 {habit.unit}
            </button>
            <button className="card-quick-btn highlight" onClick={() => onUpdate(habit.id, 'user1', 5)}>
              +5
            </button>
          </>
        )}
      </div>
    </div>
  );
};
