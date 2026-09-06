import React, { useMemo } from 'react';
import { useHabits } from '../context/HabitContext';
import { Flame, Menu, CheckCircle2 } from 'lucide-react';

export const HeaderDial = ({ onOpenSettings, onOpenAddGoal }) => {
  const {
    user,
    habits,
    currentPercent,
    pod,
  } = useHabits();

  const completedCount = useMemo(() => {
    return habits.filter((h) => {
      if (typeof h.user1 === 'boolean') return h.user1;
      return (h.user1 || 0) >= h.target;
    }).length;
  }, [habits]);

  // Today's formatted date
  const dateStr = useMemo(() => {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  }, []);

  // Arc math for sharp SVG gauge (240-degree open gauge)
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (currentPercent / 100) * circumference;

  return (
    <div className="modern-header-dial">
      {/* Top action row */}
      <div className="dial-top-row">
        <div className="dial-date-chip">
          <span className="live-indicator-dot"></span>
          <span className="date-label font-medium">{dateStr}</span>
        </div>

        <div className="top-right-chips">
          <div className="streak-chip" title={`${pod.currentStreak} day streak`}>
            <Flame size={16} className="streak-flame-icon text-amber-500" />
            <span className="streak-num font-bold">{pod.currentStreak}</span>
          </div>

          <button
            className="menu-icon-btn"
            onClick={onOpenSettings}
            aria-label="Settings and Profile"
            title="Open Settings"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* Crisp Circular / Radial Progress Dial */}
      <div className="radial-gauge-container">
        <div className="radial-svg-wrap">
          <svg className="radial-progress-svg" viewBox="0 0 160 160" width="160" height="160">
            <defs>
              <linearGradient id="dialProgressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>

            {/* Background Circle */}
            <circle
              className="radial-bg-circle"
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="var(--dial-track-color, rgba(148, 163, 184, 0.15))"
              strokeWidth="10"
            />

            {/* Foreground Progress Circle */}
            <circle
              className="radial-fill-circle"
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="url(#dialProgressGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 80 80)"
            />
          </svg>

          {/* Center Readout */}
          <div className="radial-center-stats">
            <span className="radial-percent-val font-extrabold">{currentPercent}%</span>
            <span className="radial-label-sub">TODAY</span>
          </div>
        </div>

        {/* Progress Narrative */}
        <div className="progress-narrative">
          <h2 className="narrative-heading font-bold">
            {currentPercent === 100
              ? 'All habits completed today'
              : currentPercent > 0
              ? `${completedCount} of ${habits.length} habits done`
              : 'Ready to build your streaks'}
          </h2>
          <p className="narrative-sub">
            {currentPercent === 100
              ? 'Outstanding consistency today. Keep the momentum going tomorrow!'
              : currentPercent > 0
              ? `${habits.length - completedCount} habits remaining to hit 100% daily focus.`
              : 'Check off your first habit below to kick off today\'s progress.'}
          </p>
        </div>
      </div>
    </div>
  );
};
