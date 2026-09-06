import React, { useState, useMemo } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Footprints,
  Moon,
  Sparkles,
  Droplets,
  BookOpen,
  Dumbbell,
  Heart,
  Plus,
  Minus,
  Check,
  Flame,
  Clock,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

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

function getHabitIcon(id, category) {
  switch (id) {
    case 'steps':
      return <Footprints size={20} className="text-emerald-500" />;
    case 'sleep':
      return <Moon size={20} className="text-indigo-400" />;
    case 'meditation':
      return <Sparkles size={20} className="text-purple-400" />;
    case 'water':
      return <Droplets size={20} className="text-cyan-400" />;
    case 'reading':
      return <BookOpen size={20} className="text-amber-400" />;
    case 'workouts':
      return <Dumbbell size={20} className="text-rose-400" />;
    case 'vitamins':
      return <Heart size={20} className="text-pink-400" />;
    default:
      if (category === 'Health') return <Heart size={20} className="text-pink-400" />;
      if (category === 'Fitness') return <Dumbbell size={20} className="text-rose-400" />;
      if (category === 'Mind') return <Sparkles size={20} className="text-purple-400" />;
      return <CheckCircle2 size={20} className="text-emerald-500" />;
  }
}

export const HabitCards = ({ onOpenAddGoal }) => {
  const {
    habits,
    activeUserId,
    updateHabit,
    removeGoal,
  } = useHabits();

  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', 'Daily', 'Health', 'Fitness', 'Mind', 'Work'];

  const filteredHabits = useMemo(() => {
    return habits.filter((h) => {
      if (!h) return false;
      if (selectedCategory === 'All') return true;
      const cat = (h.category || 'Daily').toLowerCase();
      const sel = selectedCategory.toLowerCase();
      if (sel === 'health') {
        return cat === 'health' || ['water', 'sleep', 'vitamins'].includes(h.id);
      }
      if (sel === 'fitness') {
        return cat === 'fitness' || ['steps', 'workouts'].includes(h.id);
      }
      if (sel === 'mind') {
        return cat === 'mind' || ['meditation', 'reading'].includes(h.id);
      }
      return cat === sel;
    });
  }, [habits, selectedCategory]);

  const completedCount = useMemo(() => {
    return habits.filter((h) => {
      if (typeof h.user1 === 'boolean') return h.user1;
      return (h.user1 || 0) >= h.target;
    }).length;
  }, [habits]);

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
          <span className="font-semibold">{completedCount}/{habits.length} Done</span>
        </div>
      </div>

      {/* Habit Cards Grid */}
      <div className="habits-list-grid">
        {filteredHabits.map((habit) => (
          <ModernHabitCard
            key={habit.id}
            habit={habit}
            activeUserId={activeUserId}
            onUpdate={updateHabit}
            onRemove={removeGoal}
          />
        ))}

        {filteredHabits.length === 0 && (
          <div className="empty-habits-card">
            <p className="empty-text font-medium">No habits found in this category.</p>
            <button className="empty-add-btn" onClick={onOpenAddGoal}>
              + Add a Habit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ModernHabitCard = ({ habit, activeUserId, onUpdate, onRemove }) => {
  const isBool = typeof habit.user1 === 'boolean' || habit.unit === 'check';
  const val = Number(habit.user1) || 0;
  const target = Number(habit.target) || 1;
  const isDone = isBool ? Boolean(habit.user1) : val >= target;
  const percent = isBool ? (isDone ? 100 : 0) : Math.min(100, Math.round((val / target) * 100));

  const standardIds = ['sleep', 'steps', 'meditation', 'water', 'reading', 'workouts', 'vitamins'];
  const isCustom = !standardIds.includes(habit.id);

  const handleToggleBool = () => {
    onUpdate(habit.id, activeUserId, !isDone, true);
  };

  const handleStep = (amount) => {
    const next = Math.max(0, val + amount);
    onUpdate(habit.id, activeUserId, next, true);
  };

  const handleCompleteFull = () => {
    if (isBool) {
      handleToggleBool();
    } else {
      const next = isDone ? 0 : target;
      onUpdate(habit.id, activeUserId, next, true);
    }
  };

  return (
    <div className={`modern-habit-card ${isDone ? 'completed-card' : ''}`}>
      <div className="habit-card-top">
        <div className="habit-card-info">
          <div className="habit-icon-box">
            {getHabitIcon(habit.id, habit.category)}
          </div>
          <div className="habit-details">
            <div className="habit-name-row">
              <span className="habit-title font-bold">{habit.name}</span>
              {habit.streak > 0 && (
                <span className="habit-streak-pill" title={`${habit.streak} day streak`}>
                  <Flame size={12} className="text-amber-500" />
                  <span>{habit.streak}d</span>
                </span>
              )}
            </div>

            <div className="habit-meta-row">
              <span className="habit-target-text font-medium">
                {isBool ? (isDone ? 'Completed' : 'Pending') : `${val} / ${target} ${habit.unit || ''}`}
              </span>

              {habit.reminderTime && (
                <span className="habit-schedule-pill">
                  <Clock size={11} />
                  <span>{habit.reminderTime}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Complete / Delete */}
        <div className="habit-actions-right">
          {isCustom && (
            <button
              className="habit-delete-btn"
              onClick={() => onRemove(habit.id)}
              title="Delete habit"
              aria-label="Delete habit"
            >
              <Trash2 size={15} />
            </button>
          )}

          <button
            className={`habit-check-btn ${isDone ? 'checked' : ''}`}
            onClick={handleCompleteFull}
            title={isDone ? 'Mark Incomplete' : 'Mark Complete'}
            aria-label="Toggle habit complete"
          >
            <Check size={18} strokeWidth={2.8} />
          </button>
        </div>
      </div>

      {/* Continuous Progress Bar & Stepper */}
      {!isBool && (
        <div className="habit-progress-section">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="habit-stepper-row">
            <div className="stepper-controls">
              <button
                className="step-btn minus"
                onClick={() => handleStep(habit.unit === 'steps' ? -1000 : -1)}
                disabled={val <= 0}
                aria-label="Decrease habit value"
              >
                <Minus size={14} />
              </button>
              <button
                className="step-btn plus"
                onClick={() => handleStep(habit.unit === 'steps' ? 1000 : 1)}
                aria-label="Increase habit value"
              >
                <Plus size={14} />
              </button>
            </div>

            <span className="percent-label font-bold">{percent}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
