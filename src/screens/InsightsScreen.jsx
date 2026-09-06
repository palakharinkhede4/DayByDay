import React, { useMemo } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Flame,
  Award,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';

export const InsightsScreen = () => {
  const { user, habits, pod } = useHabits();

  // Current week's days
  const weekDays = useMemo(() => {
    const daysLetters = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const currentDay = now.getDay();
    
    // Last 7 days
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = daysLetters[d.getDay()];
      const isToday = i === 0;

      // Count completed habits on this date from history
      const dateKey = d.toISOString().slice(0, 10);
      let completedOnDate = 0;
      habits.forEach((h) => {
        if (h.history && h.history[dateKey]) {
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
        isToday,
        completedCount: completedOnDate,
        total: habits.length || 1,
        isSuccess: completedOnDate > 0,
      });
    }
    return result;
  }, [habits]);

  // Overall completion rate
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

      {/* 7-Day Consistency Tracker */}
      <div className="insights-section-card">
        <div className="section-card-header">
          <div className="section-card-title-group">
            <Calendar size={18} className="text-emerald-500" />
            <h3 className="section-card-title font-bold">Past 7 Days Consistency</h3>
          </div>
          <span className="section-card-tag font-semibold">Weekly View</span>
        </div>

        <div className="weekly-calendar-row">
          {weekDays.map((d, idx) => (
            <div key={idx} className={`calendar-day-col ${d.isToday ? 'today-col' : ''}`}>
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
      </div>

      {/* Habit Breakdown List */}
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
