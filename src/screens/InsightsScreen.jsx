import React, { useState, useMemo } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Flame,
  Award,
  TrendingUp,
  CheckCircle2,
  Calendar as CalendarIcon,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  XCircle,
  BarChart3,
  CalendarDays,
} from 'lucide-react';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_LETTERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const InsightsScreen = () => {
  const { habits, pod } = useHabits();

  // Mode: 'weekly' (7-day pulse) or 'calendar' (full interactive month view)
  const [viewMode, setViewMode] = useState('weekly');

  // Calendar navigation state
  const [calDate, setCalDate] = useState(new Date());
  const todayKey = new Date().toISOString().slice(0, 10);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();

  const handlePrevMonth = () => {
    setCalDate(new Date(calYear, calMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCalDate(new Date(calYear, calMonth + 1, 1));
  };

  const handleJumpToday = () => {
    const today = new Date();
    setCalDate(today);
    setSelectedDateKey(today.toISOString().slice(0, 10));
  };

  // 1. Last 7 Days Pulse
  const weekDays = useMemo(() => {
    const daysLetters = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = daysLetters[d.getDay()];
      const isToday = i === 0;
      const dateKey = d.toISOString().slice(0, 10);

      let completedOnDate = 0;
      habits.forEach((h) => {
        if (h.history && h.history[dateKey] !== undefined) {
          const val = h.history[dateKey];
          if (typeof h.user1 === 'boolean' ? Boolean(val) : (Number(val) || 0) >= h.target) {
            completedOnDate++;
          }
        } else if (isToday) {
          const isDone = typeof h.user1 === 'boolean' ? h.user1 : (h.user1 || 0) >= h.target;
          if (isDone) completedOnDate++;
        }
      });

      result.push({
        dayName,
        dateNum: d.getDate(),
        dateKey,
        isToday,
        completedCount: completedOnDate,
        total: habits.length || 1,
        isSuccess: completedOnDate > 0,
      });
    }
    return result;
  }, [habits]);

  // 2. Full Month Calendar Grid
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
    const totalDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const cells = [];

    // Preceding empty padding
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ type: 'empty', key: `empty-${i}` });
    }

    // Days of the current month
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateKey === todayStr;
      const isFuture = new Date(calYear, calMonth, day) > now;

      let completedCount = 0;
      habits.forEach((h) => {
        if (h.history && h.history[dateKey] !== undefined) {
          const val = h.history[dateKey];
          const isDone = typeof h.user1 === 'boolean' ? Boolean(val) : (Number(val) || 0) >= h.target;
          if (isDone) completedCount++;
        } else if (isToday) {
          const isDone = typeof h.user1 === 'boolean' ? h.user1 : (h.user1 || 0) >= h.target;
          if (isDone) completedCount++;
        }
      });

      const totalHabits = habits.length || 1;
      const pct = Math.min(100, Math.round((completedCount / totalHabits) * 100));

      cells.push({
        type: 'day',
        dayNum: day,
        dateKey,
        isToday,
        isFuture,
        completedCount,
        totalHabits,
        pct,
      });
    }

    return cells;
  }, [calYear, calMonth, habits]);

  // 3. Selected Day Details Inspector
  const selectedDayDetails = useMemo(() => {
    if (!selectedDateKey) return null;

    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dateFormatted = dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const isToday = selectedDateKey === todayKey;

    let completedCount = 0;
    const items = habits.map((h) => {
      const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
      let recordedValue = 0;
      let hasRecord = false;

      if (h.history && h.history[selectedDateKey] !== undefined) {
        recordedValue = h.history[selectedDateKey];
        hasRecord = true;
      } else if (isToday) {
        recordedValue = h.user1;
        hasRecord = true;
      }

      const isDone = isBool ? Boolean(recordedValue) : (Number(recordedValue) || 0) >= h.target;
      if (isDone) completedCount++;

      return {
        id: h.id,
        name: h.name,
        category: h.category || 'Daily',
        target: h.target,
        unit: h.unit || '',
        isBool,
        recordedValue,
        hasRecord,
        isDone,
      };
    });

    const total = habits.length || 1;
    const percent = Math.round((completedCount / total) * 100);

    return {
      dateFormatted,
      selectedDateKey,
      completedCount,
      total,
      percent,
      items,
    };
  }, [selectedDateKey, habits, todayKey]);

  // Overall completion rate for today
  const completedToday = useMemo(() => {
    return habits.filter((h) => {
      if (typeof h.user1 === 'boolean') return h.user1;
      return (h.user1 || 0) >= h.target;
    }).length;
  }, [habits]);

  const completionPercent = habits.length > 0
    ? Math.round((completedToday / habits.length) * 100)
    : 0;

  // Best streak
  const bestStreak = useMemo(() => {
    let max = pod.currentStreak || 0;
    habits.forEach((h) => {
      if (h.streak && h.streak > max) max = h.streak;
    });
    return max;
  }, [habits, pod.currentStreak]);

  return (
    <div className="screen-insights-container">
      {/* Header */}
      <div className="insights-header-section">
        <h1 className="screen-main-title font-extrabold">Habit Insights & Consistency</h1>
        <p className="screen-subtitle">
          Track your personal momentum, consistency scores, and streak milestones.
        </p>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="insights-metric-cards">
        <div className="metric-card">
          <div className="metric-icon-wrap emerald">
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
          <span className="metric-value font-black">{completionPercent}%</span>
          <span className="metric-label">Today's Rate</span>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap amber">
            <Flame size={20} className="text-amber-500" />
          </div>
          <span className="metric-value font-black">{pod.currentStreak || 0}d</span>
          <span className="metric-label">Active Streak</span>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap purple">
            <Award size={20} className="text-purple-400" />
          </div>
          <span className="metric-value font-black">{bestStreak}d</span>
          <span className="metric-label">Best Record</span>
        </div>
      </div>

      {/* View Switcher: Weekly vs Calendar */}
      <div className="insights-section-card">
        <div className="section-card-header">
          <div className="section-card-title-group">
            {viewMode === 'weekly' ? (
              <BarChart3 size={18} className="text-emerald-500" />
            ) : (
              <CalendarDays size={18} className="text-cyan-400" />
            )}
            <h3 className="section-card-title font-bold">
              {viewMode === 'weekly' ? 'Past 7 Days Consistency' : 'Habit History Calendar'}
            </h3>
          </div>

          <div className="insights-view-pills">
            <button
              type="button"
              className={`view-pill-btn font-bold ${viewMode === 'weekly' ? 'active' : ''}`}
              onClick={() => setViewMode('weekly')}
            >
              7-Day Pulse
            </button>
            <button
              type="button"
              className={`view-pill-btn font-bold ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              Calendar View
            </button>
          </div>
        </div>

        {/* View 1: 7-Day Pulse */}
        {viewMode === 'weekly' && (
          <div className="weekly-calendar-row">
            {weekDays.map((d, idx) => (
              <div
                key={idx}
                className={`calendar-day-col ${d.isToday ? 'today-col' : ''}`}
                onClick={() => {
                  setSelectedDateKey(d.dateKey);
                  setViewMode('calendar');
                }}
                title={`View ${d.dateKey}`}
              >
                <span className="cal-day-letter font-medium">{d.dayName}</span>
                <div className={`cal-indicator-circle ${d.isSuccess ? 'completed' : ''}`}>
                  {d.isSuccess ? (
                    <CheckCircle2 size={16} strokeWidth={2.8} />
                  ) : (
                    <span className="empty-dot"></span>
                  )}
                </div>
                <span className="cal-date-num font-mono">{d.dateNum}</span>
              </div>
            ))}
          </div>
        )}

        {/* View 2: Full Interactive Month Calendar */}
        {viewMode === 'calendar' && (
          <div className="interactive-calendar-wrapper">
            {/* Calendar Controls */}
            <div className="calendar-month-controls">
              <button
                type="button"
                className="cal-nav-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="cal-month-title-wrap">
                <span className="cal-month-title font-black">
                  {MONTH_NAMES[calMonth]} {calYear}
                </span>
                <button
                  type="button"
                  className="cal-today-btn font-bold"
                  onClick={handleJumpToday}
                >
                  Today
                </button>
              </div>

              <button
                type="button"
                className="cal-nav-btn"
                onClick={handleNextMonth}
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="calendar-grid-header">
              {DAY_LETTERS.map((letter, i) => (
                <span key={i} className="cal-header-cell font-bold">
                  {letter}
                </span>
              ))}
            </div>

            {/* Day Cells */}
            <div className="calendar-grid-cells">
              {calendarGrid.map((cell) => {
                if (cell.type === 'empty') {
                  return <div key={cell.key} className="cal-day-cell empty"></div>;
                }

                const isSelected = selectedDateKey === cell.dateKey;
                const isFull = cell.pct === 100;
                const isPartial = cell.pct > 0 && cell.pct < 100;

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    disabled={cell.isFuture}
                    className={`cal-day-cell ${cell.isToday ? 'is-today' : ''} ${
                      isSelected ? 'is-selected' : ''
                    } ${cell.isFuture ? 'is-future' : ''} ${isFull ? 'full-done' : ''} ${
                      isPartial ? 'partial-done' : ''
                    }`}
                    onClick={() => setSelectedDateKey(cell.dateKey)}
                    title={`${cell.dateKey}: ${cell.completedCount}/${cell.totalHabits} done (${cell.pct}%)`}
                  >
                    <span className="cal-cell-num font-mono font-bold">
                      {cell.dayNum}
                    </span>
                    {!cell.isFuture && (
                      <div className="cal-cell-indicator-dot">
                        {isFull ? (
                          <span className="cell-dot full"></span>
                        ) : isPartial ? (
                          <span className="cell-dot partial"></span>
                        ) : (
                          <span className="cell-dot none"></span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Day Inspector */}
            {selectedDayDetails && (
              <div className="selected-day-inspector-card">
                <div className="inspector-header">
                  <div>
                    <span className="inspector-date-title font-extrabold">
                      {selectedDayDetails.dateFormatted}
                    </span>
                    <span className="inspector-date-key font-mono">
                      {selectedDayDetails.selectedDateKey}
                    </span>
                  </div>
                  <div className="inspector-score-pill font-bold">
                    <span>
                      {selectedDayDetails.completedCount}/{selectedDayDetails.total} Completed
                    </span>
                    <span className="inspector-pct-tag font-mono">
                      {selectedDayDetails.percent}%
                    </span>
                  </div>
                </div>

                {/* Habit Status Breakdown */}
                <div className="inspector-habits-list">
                  {selectedDayDetails.items.map((item) => (
                    <div
                      key={item.id}
                      className={`inspector-habit-row ${item.isDone ? 'done' : 'pending'}`}
                    >
                      <div className="inspector-habit-left">
                        <div
                          className={`inspector-status-icon ${
                            item.isDone ? 'done' : 'incomplete'
                          }`}
                        >
                          {item.isDone ? (
                            <Check size={13} strokeWidth={3} />
                          ) : (
                            <span className="pending-dot"></span>
                          )}
                        </div>
                        <div>
                          <span className="inspector-habit-name font-bold">
                            {item.name}
                          </span>
                          <span className="inspector-habit-meta">
                            {item.category}
                          </span>
                        </div>
                      </div>

                      <div className="inspector-habit-right">
                        <span className="inspector-recorded-val font-mono font-bold">
                          {item.isBool
                            ? item.isDone
                              ? 'Completed'
                              : 'Pending'
                            : `${item.recordedValue || 0} / ${item.target} ${item.unit}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overall Habit Progress Breakdown List */}
      <div className="insights-section-card">
        <div className="section-card-header">
          <div className="section-card-title-group">
            <Sparkles size={18} className="text-purple-400" />
            <h3 className="section-card-title font-bold">Habit Completion Overview</h3>
          </div>
          <span className="section-card-tag font-semibold">{habits.length} Habits</span>
        </div>

        <div className="insights-habits-list">
          {habits.map((h) => {
            const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
            const val = Number(h.user1) || 0;
            const target = Number(h.target) || 1;
            const isDone = isBool ? Boolean(h.user1) : val >= target;
            const pct = isBool ? (isDone ? 100 : 0) : Math.min(100, Math.round((val / target) * 100));

            return (
              <div key={h.id} className="insight-habit-item">
                <div className="insight-habit-info">
                  <span className="insight-habit-name font-bold">{h.name}</span>
                  <span className="insight-habit-cat font-medium">{h.category || 'Daily'}</span>
                </div>

                <div className="insight-habit-progress-wrap">
                  <div className="insight-bar-track">
                    <div className="insight-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="insight-pct-badge font-bold">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
