import React, { useMemo } from 'react';
import { useHabits } from '../context/HabitContext';

export const HeaderDial = ({ onOpenSettings, onOpenAddGoal, onOpenPairing }) => {
  const {
    user,
    partner,
    isSolo,
    pod,
    habits,
    currentPercent,
    inSyncGoalsCount,
  } = useHabits();

  // Compute individual progress for User (user1) and Partner (user2)
  const { u1Percent, u2Percent } = useMemo(() => {
    if (!habits.length) return { u1Percent: 0, u2Percent: 0 };
    let u1Sum = 0;
    let u2Sum = 0;

    habits.forEach((h) => {
      if (typeof h.user1 === 'boolean') {
        u1Sum += h.user1 ? 1 : 0;
        u2Sum += h.user2 ? 1 : 0;
      } else {
        u1Sum += Math.min(1, (h.user1 || 0) / h.target);
        u2Sum += Math.min(1, (h.user2 || 0) / h.target);
      }
    });

    return {
      u1Percent: Math.round((u1Sum / habits.length) * 100),
      u2Percent: Math.round((u2Sum / habits.length) * 100)
    };
  }, [habits]);

  // Generate 22 arched dots:
  // - In Solo mode: all 22 dots fill based on user's own percentage
  // - In Pod mode: Left 11 for User, Right 11 for Partner
  const dots = useMemo(() => {
    const totalDots = 22;
    const half = totalDots / 2;
    const cx = 160;
    const cy = 135;
    const rx = 112;
    const ry = 98;

    const startAngle = 212 * (Math.PI / 180);
    const endAngle = -32 * (Math.PI / 180);
    const angleRange = startAngle - endAngle;

    const result = [];
    for (let i = 0; i < totalDots; i++) {
      const t = i / (totalDots - 1);
      const angle = startAngle - t * angleRange;
      const x = cx + rx * Math.cos(angle);
      const y = cy - ry * Math.sin(angle);

      let isFilled = false;
      let isUser1Side = true;

      if (isSolo) {
        // Solo mode: fills continuously from left to right
        const filledDotsCount = Math.round((u1Percent / 100) * totalDots);
        isFilled = i < filledDotsCount;
        isUser1Side = true;
      } else {
        // Pod mode: split between User 1 and Partner
        isUser1Side = i < half;
        if (isUser1Side) {
          const user1ProgressIndex = Math.round((u1Percent / 100) * half);
          isFilled = i < user1ProgressIndex;
        } else {
          const user2ProgressIndex = Math.round((u2Percent / 100) * half);
          const indexInUser2 = i - half;
          isFilled = indexInUser2 < user2ProgressIndex;
        }
      }

      result.push({
        id: i,
        x,
        y,
        isUser1Side,
        isFilled,
      });
    }

    return result;
  }, [u1Percent, u2Percent, isSolo]);

  // Today's formatted date
  const dateStr = useMemo(() => {
    const d = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`;
  }, []);

  return (
    <div className="header-dial-container">
      {/* Top action row inside screen */}
      <div className="dial-top-row">
        <button
          className="dial-btn date-pill"
          onClick={onOpenSettings}
          title="Open Pod Settings"
        >
          <span className="dot pulse-mint"></span>
          <span className="date-text">{dateStr}</span>
        </button>

        <div className="top-right-chips">
          <div className="streak-chip" title={`${pod.currentStreak} day streak!`}>
            <span className="streak-flame">🔥</span>
            <span className="streak-num">{pod.currentStreak}</span>
          </div>

          <button
            className="menu-icon-btn"
            onClick={onOpenSettings}
            aria-label="Settings and Profile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        </div>
      </div>

      {/* ARC PROGRESS DIAL */}
      <div className="arc-gauge-wrapper">
        <svg className="arc-gauge-svg" viewBox="0 0 320 180" width="100%">
          <defs>
            <filter id="glow-teal" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="glow-coral" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Dotted Arch */}
          {dots.map((dot) => {
            const fillColor = dot.isFilled
              ? dot.isUser1Side
                ? 'var(--user1-color)'
                : 'var(--user2-color)'
              : 'rgba(255, 255, 255, 0.12)';

            const filter = dot.isFilled
              ? dot.isUser1Side
                ? 'url(#glow-teal)'
                : 'url(#glow-coral)'
              : undefined;

            return (
              <circle
                key={dot.id}
                cx={dot.x}
                cy={dot.y}
                r={dot.isFilled ? 6.5 : 5}
                fill={fillColor}
                filter={filter}
                className="arc-dot-transition"
              />
            );
          })}
        </svg>

        {/* Center Text Stats */}
        <div className="gauge-center-content">
          <span className="gauge-label">{isSolo ? 'MY GOALS TODAY' : 'GOALS REACHED TODAY'}</span>
          <div className="gauge-hero-number">
            <span className="hero-digits">{currentPercent}</span>
          </div>
          <span className="gauge-percent-text">PERCENT</span>

          <div className="gauge-yesterday-pill">
            <span className="yesterday-text">
              {pod.yesterdayPercent}% YESTERDAY
            </span>
            <span className="yesterday-arrow">↗</span>
          </div>
        </div>
      </div>

      {/* Subheader: Today's Progress & Partner Legend */}
      <div className="progress-summary-bar">
        <div className="summary-left">
          <h2 className="summary-title">{isSolo ? 'Daily Progress' : "Today's Progress"}</h2>
          <p className="summary-subtitle">
            {isSolo
              ? `${inSyncGoalsCount} of ${habits.length} habits completed today`
              : `${inSyncGoalsCount} of ${habits.length} goals in sync today`}
          </p>
        </div>

        <div className="partner-legend">
          <div className="legend-item">
            <span className="legend-dot user1-dot"></span>
            <span className="legend-name">
              {user ? `@${user.username}` : 'You'} ({u1Percent}%)
            </span>
          </div>

          {!isSolo ? (
            <div className="legend-item">
              <span className="legend-dot user2-dot"></span>
              <span className="legend-name">
                @{partner.username} ({u2Percent}%)
              </span>
            </div>
          ) : (
            <button
              className="legend-pair-btn"
              onClick={onOpenPairing}
              title="Pair with accountability partner"
            >
              <span>+ Pair Partner</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
