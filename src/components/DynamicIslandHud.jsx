import React, { useState, useEffect, useRef } from 'react';
import { useHabits } from '../context/HabitContext';

export const DynamicIslandHud = ({ isDesktopMockup = false }) => {
  const {
    activeFocusHabit,
    habits,
    setActiveFocusHabitId,
    quickIncrementFocusHabit,
    toggleFocusHabitCompleted,
    currentPercent,
    partnerPercent,
    islandMessage,
    pod,
    partner,
    isSolo,
    liveActivityEnabled,
    setLiveActivityEnabled,
    triggerIslandNotification,
  } = useHabits();

  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef(null);

  // Close expanded HUD when user clicks outside
  useEffect(() => {
    const handlePointerDownOutside = (e) => {
      if (expanded && containerRef.current && !containerRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [expanded]);

  // Compute stats for focus habit
  const habit = activeFocusHabit;
  const currentValue = habit ? (typeof habit.user1 === 'boolean' ? (habit.user1 ? 1 : 0) : (habit.user1 || 0)) : 0;
  const targetValue = habit ? (typeof habit.user1 === 'boolean' ? 1 : (habit.target || 1)) : 1;
  const isDone = habit ? (typeof habit.user1 === 'boolean' ? habit.user1 : currentValue >= targetValue) : false;
  const pct = Math.min(100, Math.round((currentValue / targetValue) * 100));

  // Determine context-sensitive quick increment label
  const getIncrementLabel = () => {
    if (!habit) return '+1';
    if (typeof habit.user1 === 'boolean') return isDone ? 'Uncheck' : '✓ Mark Done';
    if (habit.unit === 'steps') return '+1,000';
    if (habit.unit === 'min') return '+5m';
    if (habit.unit === 'pints') return '+1 pint';
    if (habit.unit === 'pgs') return '+5 pgs';
    return `+1 ${habit.unit}`;
  };

  const formatDisplayVal = (val) => {
    if (val === undefined || val === null) return '0';
    return typeof val === 'number' && val % 1 !== 0 ? val.toFixed(1) : String(val);
  };

  const getCategoryIcon = (icon) => {
    const map = {
      steps: '🏃',
      sleep: '🌙',
      meditation: '🧘',
      water: '💧',
      reading: '📚',
      workouts: '💪',
      vitamins: '💊',
      savings: '💰',
    };
    return map[icon] || habit?.icon || '🎯';
  };

  return (
    <div
      ref={containerRef}
      className={`dynamic-island-wrapper ${isDesktopMockup ? 'mockup-island' : 'native-island'}`}
    >
      <div
        className={`dynamic-island-capsule ${islandMessage ? 'is-alert' : expanded ? 'is-expanded' : 'is-compact'}`}
        onClick={() => !islandMessage && setExpanded((prev) => !prev)}
        role="button"
        tabIndex={0}
        aria-label="Dynamic Island Focus Habit HUD"
      >
        {/* 1. ALERT / CELEBRATION STATE */}
        {islandMessage ? (
          <div className="island-banner-alert">
            <span className="alert-pulse-dot"></span>
            <span className="alert-icon">{islandMessage.icon}</span>
            <span className="alert-message">{islandMessage.text}</span>
          </div>
        ) : expanded ? (
          /* 2. FULL EXPANDED HUD STATE */
          <div className="island-hud-expanded" onClick={(e) => e.stopPropagation()}>
            {/* Top Row: Focus Habit Title & Streak */}
            <div className="hud-header">
              <div className="hud-title-group">
                <span className="hud-habit-glyph">{getCategoryIcon(habit?.icon)}</span>
                <div>
                  <h4 className="hud-habit-name">{habit?.name || 'Daily Focus'}</h4>
                  <span className="hud-habit-tag">{habit?.category || 'Daily'} • {isDone ? 'COMPLETED' : 'IN PROGRESS'}</span>
                </div>
              </div>

              <div className="hud-header-right">
                <div className="hud-streak-badge" title="Current streak">
                  <span>🔥</span>
                  <span>{habit?.streak || 1}d</span>
                </div>
                <button
                  className="hud-close-btn"
                  onClick={() => setExpanded(false)}
                  title="Collapse Dynamic Island"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Middle: Progress Bar and Readout */}
            <div className="hud-meter-section">
              <div className="hud-meter-labels">
                <span className="hud-meter-reading">
                  {formatDisplayVal(currentValue)} / {formatDisplayVal(targetValue)} {habit?.unit || ''}
                </span>
                <span className={`hud-meter-pct ${isDone ? 'done' : ''}`}>{pct}%</span>
              </div>

              <div className="hud-progress-track">
                <div
                  className="hud-progress-fill"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>

            {/* 1-Tap Quick Action Buttons directly in Dynamic Island */}
            <div className="hud-actions-row">
              <button
                className="hud-quick-btn increment"
                onClick={() => {
                  quickIncrementFocusHabit();
                  triggerIslandNotification(`${habit?.name} updated!`, getCategoryIcon(habit?.icon));
                }}
              >
                <span>⚡ {getIncrementLabel()}</span>
              </button>

              <button
                className={`hud-quick-btn complete ${isDone ? 'completed' : ''}`}
                onClick={() => {
                  toggleFocusHabitCompleted();
                  triggerIslandNotification(
                    isDone ? `${habit?.name} reset` : `${habit?.name} completed! 🎉`,
                    isDone ? '↺' : '✓'
                  );
                }}
              >
                <span>{isDone ? '↺ Undo' : '✓ Mark Done'}</span>
              </button>
            </div>

            {/* Accountability Pulse Subtitle */}
            <div className="hud-accountability-bar">
              <div className="hud-partner-pulse">
                <span className={`pulse-indicator ${!isSolo ? 'pod-active' : ''}`}></span>
                {!isSolo ? (
                  <span className="hud-pulse-text">
                    @{partner?.username || 'Partner'}: {partnerPercent}% completed today
                  </span>
                ) : (
                  <span className="hud-pulse-text">
                    Pod Sync: {currentPercent}% today
                  </span>
                )}
              </div>
              <span className="hud-live-tag">LIVE</span>
            </div>

            {/* Focus Habit Quick Switcher */}
            {habits && habits.length > 1 && (
              <div className="hud-habit-switcher">
                <span className="switcher-label">Switch Focus Habit:</span>
                <div className="switcher-scroll-row">
                  {habits.map((h) => (
                    <button
                      key={h.id}
                      className={`switcher-pill ${h.id === habit?.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveFocusHabitId(h.id);
                        triggerIslandNotification(`Focus switched to ${h.name}`, getCategoryIcon(h.icon));
                      }}
                    >
                      <span>{getCategoryIcon(h.icon)}</span>
                      <span>{h.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 3. COMPACT STATE (PILL) */
          <div className="island-compact-view">
            {/* Leading (Left) */}
            <div className="compact-leading">
              <span className="compact-icon">{getCategoryIcon(habit?.icon)}</span>
              <span className="compact-label">{habit?.name || 'DayByDay'}</span>
            </div>

            {/* Physical Hardware Cam / Sensor Cutout */}
            <div className="compact-sensor-cutout"></div>

            {/* Trailing (Right) */}
            <div className="compact-trailing">
              <div className="mini-ring-gauge" title={`${pct}% complete`}>
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <circle
                    cx="11"
                    cy="11"
                    r="8"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <circle
                    cx="11"
                    cy="11"
                    r="8"
                    stroke={isDone ? '#10B981' : '#06B6D4'}
                    strokeWidth="2.5"
                    strokeDasharray="50.2"
                    strokeDashoffset={50.2 - (50.2 * pct) / 100}
                    strokeLinecap="round"
                    fill="none"
                    transform="rotate(-90 11 11)"
                  />
                </svg>
                <span className="mini-ring-text">{pct}%</span>
              </div>
              <span className="compact-flame">🔥</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
