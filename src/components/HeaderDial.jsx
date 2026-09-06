import React, { useState, useEffect, useMemo } from 'react';
import { useHabits } from '../context/HabitContext';
import { Flame, Menu, CheckCircle2 } from 'lucide-react';

export const HeaderDial = ({ onOpenSettings, onOpenAddGoal }) => {
  const {
    user,
    habits,
    currentPercent,
    partnerPercent,
    isSolo,
    pod,
  } = useHabits();

  const [mounted, setMounted] = useState(false);
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Smooth numeric counter animation matching the 1.1s circle stroke transition
  useEffect(() => {
    if (!mounted) {
      setDisplayPercent(0);
      return;
    }
    const targetVal = Math.min(100, Math.max(0, currentPercent || 0));
    if (targetVal === 0) {
      setDisplayPercent(0);
      return;
    }
    const duration = 1100;
    let startTime = null;
    let animId;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayPercent(Math.round(targetVal * ease));
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [mounted, currentPercent]);

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

  // Dual Concentric Rings (Activity Rings with Smooth 1.1s Animation)
  // Outer Ring: Daily Habit Completion
  const outerRadius = 68;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const animatedCurrentPercent = mounted ? (currentPercent || 0) : 0;
  const outerOffset = outerCircumference - (Math.min(100, Math.max(0, animatedCurrentPercent)) / 100) * outerCircumference;

  // Inner Ring: Partner Sync or 7-Day Consistency Momentum
  const innerRadius = 53;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const innerPercent = isSolo
    ? Math.min(100, Math.max(pod.currentStreak > 0 ? 20 : 0, Math.round(((pod.currentStreak || 0) / 7) * 100)))
    : (partnerPercent || 0);
  const animatedInnerPercent = mounted ? innerPercent : 0;
  const innerOffset = innerCircumference - (Math.min(100, Math.max(0, animatedInnerPercent)) / 100) * innerCircumference;

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

      {/* Crisp Concentric Circular Progress Dial */}
      <div className="radial-gauge-container">
        <div className="radial-svg-wrap">
          <svg className="radial-progress-svg" viewBox="0 0 160 160" width="160" height="160">
            <defs>
              {/* Outer Ring Gradient (Sunset Orange) */}
              <linearGradient id="dialOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--user1-color, #F97316)" />
                <stop offset="100%" stopColor="var(--user1-light, #FDBA74)" />
              </linearGradient>
              {/* Inner Ring Gradient (Crimson / Momentum) */}
              <linearGradient id="dialInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--user2-color, #FF5252)" />
                <stop offset="100%" stopColor="var(--user2-light, #FDA4AF)" />
              </linearGradient>
            </defs>

            {/* Outer Background Track */}
            <circle
              className="radial-bg-circle"
              cx="80"
              cy="80"
              r={outerRadius}
              fill="none"
              stroke="var(--dial-track-color, rgba(255, 255, 255, 0.08))"
              strokeWidth="8.5"
            />

            {/* Outer Foreground Progress Circle (Habits) */}
            <circle
              className="radial-fill-circle outer-ring"
              cx="80"
              cy="80"
              r={outerRadius}
              fill="none"
              stroke="url(#dialOuterGrad)"
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeDasharray={outerCircumference}
              strokeDashoffset={outerOffset}
              transform="rotate(-90 80 80)"
            />

            {/* Inner Background Track */}
            <circle
              className="radial-bg-circle inner-track"
              cx="80"
              cy="80"
              r={innerRadius}
              fill="none"
              stroke="var(--dial-track-color, rgba(255, 255, 255, 0.06))"
              strokeWidth="8.5"
            />

            {/* Inner Foreground Progress Circle (Momentum / Partner) */}
            <circle
              className="radial-fill-circle inner-ring"
              cx="80"
              cy="80"
              r={innerRadius}
              fill="none"
              stroke="url(#dialInnerGrad)"
              strokeWidth="8.5"
              strokeLinecap="round"
              strokeDasharray={innerCircumference}
              strokeDashoffset={innerOffset}
              transform="rotate(-90 80 80)"
            />
          </svg>

          {/* Center Readout */}
          <div className="radial-center-stats">
            <span className="radial-percent-val font-extrabold">{displayPercent}%</span>
            <div className="radial-ring-legend">
              <span className="legend-dot green" title="Your daily habits"></span>
              <span className="legend-dot blue" title="Streak & momentum"></span>
            </div>
          </div>
        </div>

        {/* Progress Narrative */}
        <div className="progress-narrative">
          <h2 className="narrative-heading font-bold">
            {currentPercent === 100
              ? 'All habits completed today'
              : completedCount > 0
              ? `${completedCount} of ${habits.length} habits done`
              : currentPercent > 0
              ? `${currentPercent}% daily progress`
              : 'Ready to build your streaks'}
          </h2>
          <p className="narrative-sub">
            {currentPercent === 100
              ? 'Outstanding consistency today. Keep the momentum going tomorrow!'
              : completedCount > 0
              ? `${habits.length - completedCount} habits remaining to hit 100% daily focus.`
              : currentPercent > 0
              ? 'Great start to the day. Keep going to check off your first complete habit!'
              : 'Check off your first habit below to kick off today\'s progress.'}
          </p>
        </div>
      </div>
    </div>
  );
};
