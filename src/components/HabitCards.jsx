import React from 'react';
import { useHabits } from '../context/HabitContext';

export const HabitCards = ({ onOpenAddGoal }) => {
  const {
    habits,
    beyondGoals,
    pod,
    activeUserId,
    updateHabit,
    updateBeyondGoal,
  } = useHabits();

  const partnerId = activeUserId === 'user1' ? 'user2' : 'user1';
  const partnerName = partnerId === 'user1' ? pod.user1.name : pod.user2.name;
  const currentUserName = activeUserId === 'user1' ? pod.user1.name : pod.user2.name;

  return (
    <div className="habit-cards-section">
      {/* 1. SLEEP CARD (WIDE CARD) */}
      {habits.find((h) => h.id === 'sleep') && (
        <SleepCard
          habit={habits.find((h) => h.id === 'sleep')}
          activeUserId={activeUserId}
          partnerId={partnerId}
          pod={pod}
          onUpdate={updateHabit}
        />
      )}

      {/* 2. STEPS & MEDITATION (TWO-COLUMN GRID) */}
      <div className="habit-grid-two">
        {habits.find((h) => h.id === 'steps') && (
          <StepsCard
            habit={habits.find((h) => h.id === 'steps')}
            activeUserId={activeUserId}
            partnerId={partnerId}
            pod={pod}
            onUpdate={updateHabit}
          />
        )}

        {habits.find((h) => h.id === 'meditation') && (
          <MeditationCard
            habit={habits.find((h) => h.id === 'meditation')}
            activeUserId={activeUserId}
            partnerId={partnerId}
            pod={pod}
            onUpdate={updateHabit}
          />
        )}
      </div>

      {/* 3. WATER & READING (TWO-COLUMN GRID) */}
      <div className="habit-grid-two">
        {habits.find((h) => h.id === 'water') && (
          <WaterCard
            habit={habits.find((h) => h.id === 'water')}
            activeUserId={activeUserId}
            partnerId={partnerId}
            pod={pod}
            onUpdate={updateHabit}
          />
        )}

        {habits.find((h) => h.id === 'reading') && (
          <ReadingCard
            habit={habits.find((h) => h.id === 'reading')}
            activeUserId={activeUserId}
            partnerId={partnerId}
            pod={pod}
            onUpdate={updateHabit}
          />
        )}
      </div>

      {/* 4. WORKOUTS & VITAMINS (TWO-COLUMN GRID) */}
      <div className="habit-grid-two">
        {habits.find((h) => h.id === 'workouts') && (
          <WorkoutCard
            habit={habits.find((h) => h.id === 'workouts')}
            activeUserId={activeUserId}
            partnerId={partnerId}
            pod={pod}
            onUpdate={updateHabit}
          />
        )}

        {habits.find((h) => h.id === 'vitamins') && (
          <VitaminsCard
            habit={habits.find((h) => h.id === 'vitamins')}
            activeUserId={activeUserId}
            partnerId={partnerId}
            pod={pod}
            onUpdate={updateHabit}
          />
        )}
      </div>

      {/* 5. CUSTOM GOALS (ANY OTHERS CREATED) */}
      {habits
        .filter(
          (h) =>
            !['sleep', 'steps', 'meditation', 'water', 'reading', 'workouts', 'vitamins'].includes(
              h.id
            )
        )
        .map((custom) => (
          <GenericHabitCard
            key={custom.id}
            habit={custom}
            activeUserId={activeUserId}
            partnerId={partnerId}
            pod={pod}
            onUpdate={updateHabit}
          />
        ))}

      {/* 6. BEYOND TODAY SECTION */}
      <div className="beyond-today-header">
        <h3 className="section-title">Beyond Today</h3>
        <button className="add-goal-link-btn" onClick={onOpenAddGoal}>
          + Add Goal
        </button>
      </div>

      <div className="beyond-grid">
        {beyondGoals.map((g) => (
          <div key={g.id} className="beyond-card">
            <div className="beyond-card-header">
              <div className="beyond-title-group">
                <span className="beyond-icon">
                  {g.id === 'savings' ? '💰' : '⚖️'}
                </span>
                <span className="beyond-name">{g.name}</span>
              </div>
              <span className="beyond-tag">Sync</span>
            </div>

            <div className="beyond-values">
              <div className="beyond-user-val">
                <span className="user-dot user1-dot"></span>
                <span className="val-text">
                  {g.unit === '$' ? `$${g.user1}` : `${g.user1} ${g.unit}`}
                </span>
              </div>
              <div className="beyond-user-val">
                <span className="user-dot user2-dot"></span>
                <span className="val-text">
                  {g.unit === '$' ? `$${g.user2}` : `${g.user2} ${g.unit}`}
                </span>
              </div>
            </div>

            <div className="beyond-quick-actions">
              <button
                className="mini-stepper-btn"
                onClick={() => updateBeyondGoal(g.id, activeUserId, g.id === 'savings' ? 25 : -1)}
              >
                {g.id === 'savings' ? '+$25' : '-1 lb'}
              </button>
              <button
                className="mini-stepper-btn"
                onClick={() => updateBeyondGoal(g.id, activeUserId, g.id === 'savings' ? 50 : 1)}
              >
                {g.id === 'savings' ? '+$50' : '+1 lb'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* --- SLEEP CARD --- */
const SleepCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  const u1Val = habit.user1;
  const u2Val = habit.user2;

  // Render 8 segments representing sleep cycles
  const totalSegments = 8;
  const u1Segments = Math.min(8, Math.round((u1Val / habit.target) * totalSegments));
  const u2Segments = Math.min(8, Math.round((u2Val / habit.target) * totalSegments));

  return (
    <div className="habit-card sleep-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon sleep-icon">🌙</span>
          <span className="habit-name">{habit.name}</span>
        </div>
        <span className="habit-meta-tag">Last night</span>
      </div>

      <div className="sleep-duration-row">
        <div className="sleep-user-col">
          <span className="sleep-val user1-text">{habit.user1Display || `${u1Val}h`}</span>
          <span className="sleep-sub">{pod.user1.name}</span>
        </div>
        <div className="sleep-separator">
          <span className="moon-phase">🌓</span>
        </div>
        <div className="sleep-user-col right">
          <span className="sleep-val user2-text">{habit.user2Display || `${u2Val}h`}</span>
          <span className="sleep-sub">{pod.user2.name}</span>
        </div>
      </div>

      {/* Dual Segmented Bars */}
      <div className="sleep-segments-container">
        {/* User 1 Segment Track */}
        <div className="segment-track user1-track">
          {Array.from({ length: totalSegments }).map((_, i) => (
            <div
              key={`u1-${i}`}
              className={`sleep-bar-seg ${i < u1Segments ? 'filled u1-fill' : ''}`}
            />
          ))}
        </div>

        {/* User 2 Segment Track */}
        <div className="segment-track user2-track">
          {Array.from({ length: totalSegments }).map((_, i) => (
            <div
              key={`u2-${i}`}
              className={`sleep-bar-seg ${i < u2Segments ? 'filled u2-fill' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* Quick Stepper for Active User */}
      <div className="card-quick-footer">
        <span className="active-logging-hint">
          Log for {activeUserId === 'user1' ? pod.user1.name : pod.user2.name}:
        </span>
        <div className="stepper-group">
          <button
            className="stepper-btn"
            onClick={() => onUpdate('sleep', activeUserId, -0.5)}
            title="Minus 30 mins"
          >
            -30m
          </button>
          <button
            className="stepper-btn highlight"
            onClick={() => onUpdate('sleep', activeUserId, 0.5)}
            title="Plus 30 mins"
          >
            +30m
          </button>
          <button
            className="stepper-btn"
            onClick={() => onUpdate('sleep', activeUserId, 1.0)}
            title="Plus 1 hour"
          >
            +1h
          </button>
        </div>
      </div>
    </div>
  );
};

/* --- STEPS CARD --- */
const StepsCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  const u1Progress = Math.min(1, habit.user1 / habit.target);
  const u2Progress = Math.min(1, habit.user2 / habit.target);

  // SVG circular arc metrics
  const size = 96;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="habit-card steps-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon steps-icon">👟</span>
          <span className="habit-name">{habit.name}</span>
        </div>
      </div>

      {/* DUAL CIRCULAR PROGRESS RINGS */}
      <div className="steps-rings-container">
        <div className="dual-ring-wrap">
          <svg width={size} height={size} className="progress-ring-svg">
            {/* Background tracks */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* User 1 ring (outer) */}
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
            {/* User 2 ring (inner) */}
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
          </svg>

          <div className="ring-center-icon">
            <span className="mini-shoe">⚡</span>
          </div>
        </div>

        {/* Step counts side by side */}
        <div className="steps-count-row">
          <div className="step-val-col">
            <span className="val-user1 font-bold">{habit.user1.toLocaleString()}</span>
            <span className="sub-user">{pod.user1.name}</span>
          </div>
          <div className="step-val-col right">
            <span className="val-user2 font-bold">{habit.user2.toLocaleString()}</span>
            <span className="sub-user">{pod.user2.name}</span>
          </div>
        </div>
      </div>

      <div className="card-stepper-row">
        <button
          className="card-quick-btn"
          onClick={() => onUpdate('steps', activeUserId, 500)}
        >
          +500 steps
        </button>
        <button
          className="card-quick-btn accent"
          onClick={() => onUpdate('steps', activeUserId, 1500)}
        >
          +1.5k
        </button>
      </div>
    </div>
  );
};

/* --- MEDITATION CARD --- */
const MeditationCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  return (
    <div className="habit-card meditation-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon med-icon">🧘</span>
          <span className="habit-name">{habit.name}</span>
        </div>
      </div>

      <div className="meditation-body">
        <div className="meditation-pulse-ring">
          <div className="pulse-circle wave-1"></div>
          <div className="pulse-circle wave-2"></div>
          <div className="pulse-center">
            <span className="lotus-emoji">✨</span>
          </div>
        </div>

        <div className="med-time-display">
          <span className="med-mins font-bold">
            {habit[activeUserId]} min
          </span>
          <span className="med-target">/ {habit.target} min goal</span>
        </div>
      </div>

      <div className="card-stepper-row">
        <button
          className="card-quick-btn"
          onClick={() => onUpdate('meditation', activeUserId, 5)}
        >
          +5 min
        </button>
        <button
          className="card-quick-btn accent"
          onClick={() => onUpdate('meditation', activeUserId, 10)}
        >
          +10 min
        </button>
      </div>
    </div>
  );
};

/* --- WATER CARD --- */
const WaterCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  const currentGlasses = habit[activeUserId];
  const partnerGlasses = habit[partnerId];

  return (
    <div className="habit-card water-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon water-icon">💧</span>
          <span className="habit-name">{habit.name}</span>
        </div>
        <span className="habit-meta-tag">
          {currentGlasses} / {habit.target} {habit.unit}
        </span>
      </div>

      <div className="water-glasses-row">
        {Array.from({ length: habit.target }).map((_, i) => (
          <button
            key={i}
            className={`water-drop-btn ${i < currentGlasses ? 'filled' : ''}`}
            onClick={() => onUpdate('water', activeUserId, i + 1, true)}
            title={`Set to ${i + 1} glasses`}
          >
            💧
          </button>
        ))}
      </div>

      <div className="card-partner-peek">
        <span className="partner-peek-label">
          {pod[partnerId].name} drank {partnerGlasses} pints
        </span>
        <button
          className="card-quick-btn accent compact"
          onClick={() => onUpdate('water', activeUserId, 1)}
        >
          +1 Drink
        </button>
      </div>
    </div>
  );
};

/* --- READING CARD --- */
const ReadingCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  return (
    <div className="habit-card reading-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon reading-icon">📖</span>
          <span className="habit-name">{habit.name}</span>
        </div>
      </div>

      <div className="reading-sync-row">
        <div className="reading-stat">
          <span className="user1-dot mini-dot"></span>
          <span className="reading-pages val-user1">{habit.user1} pgs</span>
          <span className="sub-user">{pod.user1.name}</span>
        </div>
        <div className="reading-stat right">
          <span className="user2-dot mini-dot"></span>
          <span className="reading-pages val-user2">{habit.user2} pgs</span>
          <span className="sub-user">{pod.user2.name}</span>
        </div>
      </div>

      <div className="card-stepper-row">
        <button
          className="card-quick-btn"
          onClick={() => onUpdate('reading', activeUserId, 2)}
        >
          +2 pgs
        </button>
        <button
          className="card-quick-btn accent"
          onClick={() => onUpdate('reading', activeUserId, 5)}
        >
          +5 pgs
        </button>
      </div>
    </div>
  );
};

/* --- WORKOUT CARD --- */
const WorkoutCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  const currentVal = habit[activeUserId];
  const partnerVal = habit[partnerId];

  return (
    <div className="habit-card workout-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon workout-icon">🏋️</span>
          <span className="habit-name">{habit.name}</span>
        </div>
      </div>

      <div className="workout-body">
        <div className="workout-stat-hero">
          <span className="hero-time font-bold">{currentVal} min</span>
          <span className="hero-lbl">Active today</span>
        </div>
        <div className="partner-workout-note">
          {pod[partnerId].name}: {partnerVal} min
        </div>
      </div>

      <div className="card-stepper-row">
        <button
          className="card-quick-btn"
          onClick={() => onUpdate('workouts', activeUserId, 15)}
        >
          +15m
        </button>
        <button
          className="card-quick-btn accent"
          onClick={() => onUpdate('workouts', activeUserId, 30)}
        >
          +30m
        </button>
      </div>
    </div>
  );
};

/* --- VITAMINS CARD --- */
const VitaminsCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  const isDone = habit[activeUserId];
  const partnerDone = habit[partnerId];

  return (
    <div className="habit-card vitamins-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon vitamins-icon">💊</span>
          <span className="habit-name">{habit.name}</span>
        </div>
      </div>

      <div className="vitamins-body">
        <button
          className={`vitamin-pill-toggle ${isDone ? 'checked' : 'pending'}`}
          onClick={() => onUpdate('vitamins', activeUserId, !isDone, true)}
        >
          <span className="toggle-check">{isDone ? '✓' : '○'}</span>
          <span className="toggle-text">{isDone ? 'Checked' : 'Not yet'}</span>
        </button>

        <div className="partner-vitamin-status">
          <span className="partner-dot-indicator">
            {partnerDone ? '✓' : '·'}
          </span>
          <span>{pod[partnerId].name}: {partnerDone ? 'Done' : 'Not yet'}</span>
        </div>
      </div>
    </div>
  );
};

/* --- GENERIC CUSTOM GOAL CARD --- */
const GenericHabitCard = ({ habit, activeUserId, partnerId, pod, onUpdate }) => {
  const currentVal = habit[activeUserId];
  const isBool = typeof currentVal === 'boolean';

  return (
    <div className="habit-card generic-card">
      <div className="habit-card-header">
        <div className="habit-title-wrapper">
          <span className="habit-badge-icon custom-icon">{habit.icon || '🎯'}</span>
          <span className="habit-name">{habit.name}</span>
        </div>
        <span className="habit-meta-tag">{habit.unit}</span>
      </div>

      <div className="generic-body">
        {isBool ? (
          <button
            className={`vitamin-pill-toggle ${currentVal ? 'checked' : 'pending'}`}
            onClick={() => onUpdate(habit.id, activeUserId, !currentVal, true)}
          >
            <span className="toggle-check">{currentVal ? '✓' : '○'}</span>
            <span className="toggle-text">{currentVal ? 'Completed' : 'Tap to Complete'}</span>
          </button>
        ) : (
          <div className="generic-numeric-row">
            <div className="generic-val">
              <span className="val-text font-bold">{currentVal}</span>
              <span className="target-text">/ {habit.target} {habit.unit}</span>
            </div>
            <div className="stepper-group">
              <button
                className="card-quick-btn"
                onClick={() => onUpdate(habit.id, activeUserId, 1)}
              >
                +1
              </button>
              <button
                className="card-quick-btn accent"
                onClick={() => onUpdate(habit.id, activeUserId, 5)}
              >
                +5
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
