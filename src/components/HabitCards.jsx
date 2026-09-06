import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Footprints,
  Moon,
  Sparkles,
  Droplets,
  BookOpen,
  Dumbbell,
  Heart,
  CheckCircle2,
  Check,
  Plus,
  Minus,
  Flame,
  SlidersHorizontal,
  Clock,
  FolderPlus,
  GripVertical,
  X,
} from 'lucide-react';
import { HabitDetailModal } from './HabitDetailModal';
import { sound } from '../utils/sound';

function formatDays(days) {
  if (!days) return 'Everyday';
  if (Array.isArray(days)) {
    if (days.length === 7) return 'Everyday';
    if (days.length === 5 && !days.includes('Sat') && !days.includes('Sun')) return 'Weekdays';
    if (days.length === 2 && days.includes('Sat') && days.includes('Sun')) return 'Weekends';
    return days.join(', ');
  }
  return String(days);
}

function getHabitIcon(id, category) {
  switch (id) {
    case 'steps':
      return <Footprints size={20} className="text-blue-500" />;
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
      return <CheckCircle2 size={20} className="text-blue-500" />;
  }
}

export const HabitCards = ({ onOpenAddGoal }) => {
  const {
    habits,
    activeUserId,
    updateHabit,
    removeGoal,
    reorderHabit,
    customCategories = ['Daily', 'Health', 'Fitness', 'Mind', 'Work'],
    addCustomCategory,
    deleteCustomCategory,
  } = useHabits();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [selectedHabitForEdit, setSelectedHabitForEdit] = useState(null);
  const [draggedHabitId, setDraggedHabitId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Smooth entry animation mount state
  const [pageMounted, setPageMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPageMounted(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const categories = useMemo(() => {
    return ['All', ...customCategories];
  }, [customCategories]);

  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    if (addCustomCategory) {
      addCustomCategory(newCatName.trim());
    }
    setSelectedCategory(newCatName.trim());
    setNewCatName('');
    setShowAddCatInput(false);
  };

  const handleDeleteCategory = (e, cat) => {
    e.stopPropagation();
    if (deleteCustomCategory) {
      deleteCustomCategory(cat);
    }
    if (selectedCategory === cat) {
      setSelectedCategory('All');
    }
  };

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

  // Drag-and-drop reorder handlers
  const handleDragStart = (habitId) => {
    setDraggedHabitId(habitId);
    sound.tap();
  };

  const handleDragEnter = (targetIdx) => {
    setDragOverIndex(targetIdx);
  };

  const handleDrop = (targetIdx) => {
    if (!draggedHabitId) return;
    const sourceIdx = habits.findIndex((h) => h.id === draggedHabitId);
    if (sourceIdx !== -1 && sourceIdx !== targetIdx && reorderHabit) {
      // Reorder based on direction
      const diff = targetIdx - sourceIdx;
      const direction = diff > 0 ? 'down' : 'up';
      for (let i = 0; i < Math.abs(diff); i++) {
        reorderHabit(draggedHabitId, direction);
      }
      sound.tap();
    }
    setDraggedHabitId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedHabitId(null);
    setDragOverIndex(null);
  };

  return (
    <div className="habit-cards-section">
      {/* Category Pills & Progress Bar */}
      <div className="habits-filter-bar">
        <div className="category-scroll-chips">
          {categories.map((cat) => {
            const isCustom = !['All', 'Daily', 'Health', 'Fitness', 'Mind'].includes(cat);
            return (
              <div
                key={cat}
                className={`category-chip-wrapper ${selectedCategory === cat ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span>{cat}</span>
                </button>
                {isCustom && (
                  <button
                    type="button"
                    className="cat-delete-btn"
                    onClick={(e) => handleDeleteCategory(e, cat)}
                    title={`Delete ${cat} category`}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}

          {showAddCatInput ? (
            <form onSubmit={handleCreateCategory} className="inline-add-cat-form">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category name"
                className="inline-cat-input"
                autoFocus
              />
              <button type="submit" className="inline-cat-submit-btn">Add</button>
              <button
                type="button"
                className="inline-cat-cancel-btn"
                onClick={() => setShowAddCatInput(false)}
              >
                ✕
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="category-chip add-category-chip font-medium"
              onClick={() => setShowAddCatInput(true)}
              title="Add custom category"
            >
              <FolderPlus size={13} />
              <span>+ Category</span>
            </button>
          )}
        </div>
        <div className="today-progress-chip">
          <span className="progress-dot"></span>
          <span className="font-semibold">{completedCount}/{habits.length} Done</span>
        </div>
      </div>

      {/* Habit Cards Grid */}
      <div className="habits-list-grid">
        {filteredHabits.map((habit, index) => (
          <ModernHabitCard
            key={habit.id}
            habit={habit}
            index={index}
            totalCount={filteredHabits.length}
            activeUserId={activeUserId}
            onUpdate={updateHabit}
            onRemove={removeGoal}
            onOpenEdit={() => setSelectedHabitForEdit(habit)}
            pageMounted={pageMounted}
            isDragging={draggedHabitId === habit.id}
            isDragOver={dragOverIndex === index}
            onDragStart={() => handleDragStart(habit.id)}
            onDragEnter={() => handleDragEnter(index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
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

      {/* Habit Detail & Options Modal */}
      {selectedHabitForEdit && (
        <HabitDetailModal
          habit={selectedHabitForEdit}
          onClose={() => setSelectedHabitForEdit(null)}
        />
      )}
    </div>
  );
};

const ModernHabitCard = ({
  habit,
  index,
  totalCount,
  activeUserId,
  onUpdate,
  onRemove,
  onOpenEdit,
  pageMounted,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}) => {
  const isBool = typeof habit.user1 === 'boolean' || habit.unit === 'check';
  const val = Number(habit.user1) || 0;
  const target = Number(habit.target) || 1;
  const isDone = isBool ? Boolean(habit.user1) : val >= target;
  const percent = isBool ? (isDone ? 100 : 0) : Math.min(100, Math.round((val / target) * 100));
  const animatedPercent = pageMounted ? percent : 0;

  const trackRef = useRef(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef(null);

  const handleToggleBool = () => {
    sound.tap();
    onUpdate(habit.id, activeUserId, !isDone, true);
  };

  const handleStep = (amount) => {
    sound.tap();
    const next = Math.max(0, val + amount);
    onUpdate(habit.id, activeUserId, next, true);
  };

  const handleCompleteFull = (e) => {
    e?.stopPropagation();
    if (isBool) {
      handleToggleBool();
    } else {
      sound.complete();
      const next = isDone ? 0 : target;
      onUpdate(habit.id, activeUserId, next, true);
    }
  };

  // Touch control & scrubbing on the progress bar track
  const handlePointerScrub = (clientX) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawNext = ratio * target;
    let nextVal;

    if (habit.unit === 'steps') {
      nextVal = Math.round(rawNext / 250) * 250;
    } else if (habit.unit === 'min' || habit.unit === 'minutes' || habit.id === 'workouts') {
      // Workouts slider: smooth 5-min intervals or 1-min for short goals
      const step = target >= 20 ? 5 : 1;
      nextVal = Math.round(rawNext / step) * step;
    } else if (habit.unit === 'hrs' || habit.unit === 'hours' || habit.id === 'sleep') {
      nextVal = Math.round(rawNext * 2) / 2;
    } else {
      nextVal = target <= 10 ? Math.round(rawNext) : Math.round(rawNext / 5) * 5;
    }

    nextVal = Math.max(0, Math.min(target, nextVal));
    if (nextVal !== val) {
      sound.scrub();
      onUpdate(habit.id, activeUserId, nextVal, true);
    }
  };

  const onTrackPointerDown = (e) => {
    e.stopPropagation();
    setIsScrubbing(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    handlePointerScrub(e.clientX);
  };

  const onTrackPointerMove = (e) => {
    if (!isScrubbing) return;
    handlePointerScrub(e.clientX);
  };

  const onTrackPointerUp = (e) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Long press detection for reordering
  const handleCardTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      sound.vibrate(35);
    }, 380);
  };

  const handleCardTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setIsLongPressing(false);
  };

  return (
    <div
      className={`modern-habit-card ${isDone ? 'completed-card' : ''} ${
        isLongPressing || isDragging ? 'is-reordering' : ''
      } ${isDragOver ? 'drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onTouchStart={handleCardTouchStart}
      onTouchEnd={handleCardTouchEnd}
      onTouchCancel={handleCardTouchEnd}
    >
      <div className="habit-card-top">
        {/* Long-press drag handle grip */}
        <div className="habit-drag-handle" title="Hold and drag to reorder">
          <GripVertical size={16} className="text-slate-500" />
        </div>

        {/* Tappable Habit Info Area */}
        <div
          className="habit-card-info clickable-card-info"
          onClick={onOpenEdit}
          title="Tap to edit habit, reminders, or delete"
        >
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

        {/* Action controls */}
        <div className="habit-actions-right">
          <button
            className="habit-options-btn"
            onClick={onOpenEdit}
            title="Edit habit settings"
            aria-label="Edit habit settings"
          >
            <SlidersHorizontal size={14} />
          </button>

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

      {/* Touch-scrubbable Progress Bar */}
      {!isBool && (
        <div className="habit-progress-section">
          <div
            ref={trackRef}
            className={`progress-bar-track interactive-track ${isScrubbing ? 'scrubbing' : ''}`}
            onPointerDown={onTrackPointerDown}
            onPointerMove={onTrackPointerMove}
            onPointerUp={onTrackPointerUp}
            onPointerCancel={onTrackPointerUp}
            title="Tap or drag along bar to adjust progress"
          >
            <div
              className="progress-bar-fill"
              style={{ width: `${animatedPercent}%` }}
            />
            {isScrubbing && (
              <div
                className="progress-scrub-thumb"
                style={{ left: `${animatedPercent}%` }}
              />
            )}
          </div>

          <div className="habit-stepper-row">
            <div className="stepper-controls">
              <button
                className="step-btn minus"
                onClick={() => handleStep(habit.unit === 'steps' ? -1000 : (habit.id === 'workouts' ? -5 : -1))}
                disabled={val <= 0}
                aria-label="Decrease habit value"
              >
                <Minus size={14} />
              </button>
              <button
                className="step-btn plus"
                onClick={() => handleStep(habit.unit === 'steps' ? 1000 : (habit.id === 'workouts' ? 5 : 1))}
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
