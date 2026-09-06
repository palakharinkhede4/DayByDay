import React, { useState, useEffect, useRef } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Footprints,
  Moon,
  Sparkles,
  Droplets,
  BookOpen,
  Dumbbell,
  Heart,
  Target,
  Flame,
  Check,
  X,
  Zap,
} from 'lucide-react';

export const DynamicIslandHud = ({ isDesktopMockup = false }) => {
  const {
    activeFocusHabit,
    habits,
    setActiveFocusHabitId,
    quickIncrementFocusHabit,
    toggleFocusHabitCompleted,
    currentPercent,
    islandMessage,
    pod,
    liveActivityEnabled,
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
    if (typeof habit.user1 === 'boolean') return isDone ? 'Uncheck' : 'Mark Done';
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

  const getCategoryIcon = (iconId) => {
    switch (iconId) {
      case 'steps':
      case 'fitness':
        return <Footprints size={14} className="text-emerald-400" />;
      case 'sleep':
        return <Moon size={14} className="text-indigo-400" />;
      case 'meditation':
      case 'mind':
        return <Sparkles size={14} className="text-purple-400" />;
      case 'water':
        return <Droplets size={14} className="text-cyan-400" />;
      case 'reading':
        return <BookOpen size={14} className="text-amber-400" />;
      case 'workouts':
        return <Dumbbell size={14} className="text-rose-400" />;
      case 'vitamins':
      case 'health':
        return <Heart size={14} className="text-pink-400" />;
      default:
        return <Target size={14} className="text-emerald-400" />;
    }
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
        {/* 1. ALERT STATE */}
        {islandMessage ? (
          <div className="island-banner-alert">
            <span className="alert-pulse-dot"></span>
            <span className="alert-icon">
              <Sparkles size={13} className="text-emerald-400" />
            </span>
            <span className="alert-message">{islandMessage.text}</span>
          </div>
        ) : expanded ? (
          /* 2. FULL EXPANDED HUD STATE */
          <div className="island-hud-expanded" onClick={(e) => e.stopPropagation()}>
            {/* Top Row: Focus Habit Title & Streak */}
            <div className="hud-header">
              <div className="hud-title-group">
                <span className="hud-habit-glyph">{getCategoryIcon(habit?.icon || habit?.id)}</span>
                <div>
                  <h4 className="hud-habit-name font-bold">{habit?.name || 'Daily Focus'}</h4>
                  <span className="hud-habit-tag font-semibold">
                    {habit?.category || 'Daily'} • {isDone ? 'COMPLETED' : 'IN PROGRESS'}
                  </span>
                </div>
              </div>

              <div className="hud-header-right">
                <div className="hud-streak-badge font-bold" title="Current streak">
                  <Flame size={12} className="text-amber-500" />
                  <span>{habit?.streak || 1}d</span>
                </div>
                <button
                  className="hud-close-btn"
                  onClick={() => setExpanded(false)}
                  title="Collapse"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Middle: Progress Bar and Readout */}
            <div className="hud-meter-section">
              <div className="hud-meter-labels">
                <span className="hud-meter-reading font-medium">
                  {formatDisplayVal(currentValue)} / {formatDisplayVal(targetValue)} {habit?.unit || ''}
                </span>
                <span className={`hud-meter-pct font-bold ${isDone ? 'done' : ''}`}>{pct}%</span>
              </div>

              <div className="hud-progress-track">
                <div
                  className="hud-progress-fill"
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="hud-actions-row">
              <button
                className="hud-quick-btn increment font-semibold"
                onClick={() => {
                  quickIncrementFocusHabit();
                  triggerIslandNotification(`${habit?.name} updated!`, 'zap');
                }}
              >
                <Zap size={13} />
                <span>{getIncrementLabel()}</span>
              </button>

              <button
                className={`hud-quick-btn complete font-semibold ${isDone ? 'completed' : ''}`}
                onClick={() => {
                  toggleFocusHabitCompleted();
                  triggerIslandNotification(
                    isDone ? `${habit?.name} marked pending` : `${habit?.name} finished!`,
                    'check'
                  );
                }}
              >
                <Check size={14} strokeWidth={2.6} />
                <span>{isDone ? 'Done' : 'Complete'}</span>
              </button>
            </div>

            {/* Switch Focus Habit */}
            {habits.length > 1 && (
              <div className="hud-switch-section">
                <span className="hud-switch-label">Switch Focus Habit:</span>
                <div className="hud-habit-chips">
                  {habits.map((h) => (
                    <button
                      key={h.id}
                      className={`hud-chip ${h.id === habit?.id ? 'active' : ''}`}
                      onClick={() => {
                        setActiveFocusHabitId(h.id);
                        triggerIslandNotification(`Focus: ${h.name}`, 'target');
                      }}
                    >
                      <span>{getCategoryIcon(h.icon || h.id)}</span>
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
              <span className="compact-icon">{getCategoryIcon(habit?.icon || habit?.id)}</span>
              <span className="compact-label font-medium">{habit?.name || 'DayByDay'}</span>
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
                <span className="mini-ring-text font-bold">{pct}%</span>
              </div>
              <Flame size={12} className="text-amber-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
