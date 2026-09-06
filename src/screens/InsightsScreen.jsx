import React from 'react';
import { useHabits } from '../context/HabitContext';

export const InsightsScreen = () => {
  const { pod, habits } = useHabits();

  // Weekly Sync Data (M T W T F S S)
  const weekDays = [
    { day: 'M', u1: true, u2: true },
    { day: 'T', u1: true, u2: true },
    { day: 'W', u1: true, u2: false },
    { day: 'T', u1: true, u2: true },
    { day: 'F', u1: true, u2: true },
    { day: 'S', u1: false, u2: true },
    { day: 'S', u1: true, u2: true },
  ];

  const inSyncDaysCount = weekDays.filter((d) => d.u1 && d.u2).length;

  // Habit breakdowns
  const habitBreakdowns = [
    {
      name: 'Steps',
      icon: '👟',
      daysCount: 5,
      history: [true, true, true, false, true, false, true]
    },
    {
      name: 'Sleep',
      icon: '🌙',
      daysCount: 4,
      history: [true, true, false, true, true, false, false]
    },
    {
      name: 'Water',
      icon: '💧',
      daysCount: 6,
      history: [true, true, true, true, true, false, true]
    },
    {
      name: 'Reading',
      icon: '📖',
      daysCount: 5,
      history: [true, false, true, true, true, true, false]
    }
  ];

  return (
    <div className="screen-insights-container">
      {/* Top Title */}
      <div className="insights-header">
        <div className="insights-title-row">
          <span className="insights-pulse-dot"></span>
          <h1 className="insights-main-title">Insights</h1>
        </div>
        <p className="insights-subtitle">
          {pod.user1.name} + {pod.user2.name} · together {pod.daysTogether} days
        </p>
      </div>

      {/* POD HEALTH GAUGE CARD */}
      <div className="pod-health-card">
        <div className="health-card-header">
          <span className="health-tag">POD HEALTH</span>
        </div>

        <div className="health-gauge-center">
          <div className="circular-dashed-gauge">
            <svg width="150" height="150" viewBox="0 0 150 150">
              <defs>
                <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#34d399" />
                  <stop offset="100%" stop-color="#10b981" />
                </linearGradient>
              </defs>
              {/* Background dashed circle */}
              <circle
                cx="75"
                cy="75"
                r="60"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="10"
                strokeDasharray="8 6"
              />
              {/* Active dashed progress */}
              <circle
                cx="75"
                cy="75"
                r="60"
                fill="none"
                stroke="url(#healthGrad)"
                strokeWidth="10"
                strokeDasharray="8 6"
                strokeDashoffset="60"
                strokeLinecap="round"
                transform="rotate(-90 75 75)"
              />
            </svg>

            <div className="health-center-number">
              <span className="health-digit font-bold">{pod.podHealth}</span>
              <span className="health-status-label">{pod.healthStatus}</span>
            </div>
          </div>
        </div>

        {/* 3 Stats Row */}
        <div className="insights-stats-row">
          <div className="stat-pill-col">
            <span className="stat-number font-bold">{pod.bestStreak}</span>
            <span className="stat-label">Best streak</span>
          </div>
          <div className="stat-pill-col">
            <span className="stat-number font-bold">{pod.daysTogether}</span>
            <span className="stat-label">Days together</span>
          </div>
          <div className="stat-pill-col highlight">
            <div className="flame-stat-val">
              <span className="flame-emoji">🔥</span>
              <span className="stat-number font-bold">{pod.currentStreak}</span>
            </div>
            <span className="stat-label">Current streak</span>
          </div>
        </div>
      </div>

      {/* WEEKLY RECAP CARD */}
      <div className="weekly-recap-card">
        <div className="weekly-card-header">
          <div className="weekly-title-wrap">
            <span className="weekly-super">YOUR WEEK</span>
            <span className="weekly-dates">Aug 17 – 23</span>
          </div>
          <button className="recap-action-link">See 7-day recap ›</button>
        </div>

        <div className="sync-days-hero">
          <span className="sync-big-digit font-bold">{inSyncDaysCount}</span>
          <span className="sync-hero-label">days in sync this week</span>
        </div>
        <p className="sync-quote">Both of you hit your shared goals that day</p>

        {/* SPLIT DUAL-COLOR PILLS (M T W T F S S) */}
        <div className="weekly-split-pills-row">
          {weekDays.map((item, idx) => (
            <div key={idx} className="day-pill-column">
              <div className="split-capsule">
                {/* Left Half: Ced (User 1 - Mint) */}
                <div
                  className={`half-pill left ${item.u1 ? 'u1-active' : 'inactive'}`}
                  title={`${pod.user1.name}: ${item.u1 ? 'Done' : 'Missed'}`}
                />
                {/* Right Half: Joe (User 2 - Coral) */}
                <div
                  className={`half-pill right ${item.u2 ? 'u2-active' : 'inactive'}`}
                  title={`${pod.user2.name}: ${item.u2 ? 'Done' : 'Missed'}`}
                />
              </div>
              <span className={`day-letter ${item.u1 && item.u2 ? 'synced' : ''}`}>
                {item.day}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* GOALS BREAKDOWN SECTION */}
      <div className="goals-breakdown-section">
        <div className="breakdown-header">
          <h3 className="section-title">Goals</h3>
          <span className="breakdown-subtitle">Where you both showed up this week</span>
        </div>

        <div className="breakdown-list">
          {habitBreakdowns.map((b) => (
            <div key={b.name} className="breakdown-row-item">
              <div className="breakdown-info">
                <span className="breakdown-icon">{b.icon}</span>
                <span className="breakdown-name font-bold">{b.name}</span>
              </div>

              {/* 7 mini split dots */}
              <div className="mini-history-dots">
                {b.history.map((synced, i) => (
                  <span
                    key={i}
                    className={`mini-sync-dot ${synced ? 'synced' : 'missed'}`}
                  />
                ))}
              </div>

              <div className="breakdown-count font-bold">
                {b.daysCount}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
