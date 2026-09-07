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
  Activity,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { HabitDetailModal } from './HabitDetailModal';
import { ManageCategoriesModal } from './ManageCategoriesModal';
import { ReorderHabitsModal } from './ReorderHabitsModal';
import { IosHealthSetupGuide } from './IosHealthSetupGuide';
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
    user,
    updateHabit,
    removeGoal,
    reorderHabit,
    reorderHabitToIndex,
    customCategories = ['Daily', 'Health', 'Fitness', 'Mind', 'Work'],
    addCustomCategory,
    deleteCustomCategory,
    syncDeviceHealth,
    setCustomHealthSteps,
    healthSyncEnabled,
    triggerIslandNotification,
    healthStats,
  } = useHabits();

  const [isSyncingHealth, setIsSyncingHealth] = useState(false);
  const [showIosHealthGuide, setShowIosHealthGuide] = useState(false);

  // Detect iOS web (non-native) — only then show setup guide when sync returns no data
  const isIosWeb = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.Capacitor?.isNativePlatform?.()) return false;
    return /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
  }, []);

  const handleSyncHealth = async () => {
    sound.press();
    setIsSyncingHealth(true);
    try {
      if (syncDeviceHealth) {
        const res = await syncDeviceHealth({ silent: false, force: true });
        if (res && res.success && (res.steps > 0 || res.calories > 0)) {
          sound.complete();
          const stepCount = res.steps !== undefined ? res.steps : (res.stats?.steps || 0);
          triggerIslandNotification?.(
            `Synced ${Number(stepCount).toLocaleString()} steps from device!`,
            'check'
          );
        } else if (isIosWeb) {
          // On iOS web with no data — show setup guide
          setShowIosHealthGuide(true);
        } else {
          sound.step();
          triggerIslandNotification?.(
            res?.error || 'Could not fetch health data. Check device permissions.',
            'untrack'
          );
        }
      }
    } catch (err) {
      console.warn('Health sync error in HabitCards:', err);
      if (isIosWeb) setShowIosHealthGuide(true);
    } finally {
      setIsSyncingHealth(false);
    }
  };

  const handleManualHealthEntry = async ({ steps, calories, distanceKm }) => {
    if (!setCustomHealthSteps) return;
    await setCustomHealthSteps({ steps, calories, distanceKm, source: 'manual_entry' });
    triggerIslandNotification?.(
      `Logged ${steps.toLocaleString()} steps manually!`,
      'check'
    );
  };

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [selectedHabitForEdit, setSelectedHabitForEdit] = useState(null);
  const [draggedHabitId, setDraggedHabitId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isManageCatOpen, setIsManageCatOpen] = useState(false);

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
    sound.press();
    if (addCustomCategory) {
      addCustomCategory(newCatName.trim());
    }
    setSelectedCategory(newCatName.trim());
    setNewCatName('');
    setShowAddCatInput(false);
  };

  const handleDeleteCategory = (e, cat) => {
    e.stopPropagation();
    sound.press();
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
      if (!h) return false;
      if (typeof h.user1 === 'boolean') return h.user1;
      return (Number(h.user1) || 0) >= (Number(h.target) || 1);
    }).length;
  }, [habits]);

  const [longPressCat, setLongPressCat] = useState(null);
  const catLongPressTimerRef = useRef(null);

  const pointerPosRef = useRef({ x: null, y: null });
  const dragOverIndexRef = useRef(null);
  const isDraggingActiveRef = useRef(false);

  // Universal continuous auto-scroll and pointer tracking across all 3 OS
  useEffect(() => {
    if (!draggedHabitId) {
      isDraggingActiveRef.current = false;
      pointerPosRef.current = { x: null, y: null };
      return;
    }

    isDraggingActiveRef.current = true;
    let rafId = null;

    const scrollContainerOrWindow = (speed) => {
      // 1. Primary window scroll
      window.scrollBy({ top: speed, behavior: 'instant' });

      // 2. Document scrolling element
      const scroller = document.scrollingElement || document.documentElement || document.body;
      if (scroller) {
        scroller.scrollTop += speed;
      }

      // 3. Fallback to any scrollable ancestor in DOM
      const candidates = document.querySelectorAll(
        '.app-main-content, .screen-habits-container, .screen-content, .app-container'
      );
      candidates.forEach((el) => {
        if (el && el.scrollHeight > el.clientHeight) {
          el.scrollTop += speed;
        }
      });
    };

    const updateHoverTarget = (x, y) => {
      if (typeof x !== 'number' || typeof y !== 'number') return;
      const elem = document.elementFromPoint(x, y);
      const card = elem?.closest('.modern-habit-card');
      if (card && card.dataset.index !== undefined) {
        const idx = parseInt(card.dataset.index, 10);
        if (!isNaN(idx) && dragOverIndexRef.current !== idx) {
          dragOverIndexRef.current = idx;
          setDragOverIndex(idx);
          sound.dragOver();
        }
      }
    };

    const loop = () => {
      const pos = pointerPosRef.current;
      if (pos && pos.y !== null) {
        const vh = window.innerHeight || document.documentElement.clientHeight || 800;
        const topThreshold = 140; // top trigger zone (px)
        const bottomThreshold = vh - 150; // bottom trigger zone (px, clears bottom nav bar)

        if (pos.y > bottomThreshold) {
          const ratio = Math.min(1, Math.max(0.1, (pos.y - bottomThreshold) / 120));
          const speed = Math.round(6 + ratio * 24); // 6px to 30px per tick
          scrollContainerOrWindow(speed);
          updateHoverTarget(pos.x, pos.y);
        } else if (pos.y < topThreshold) {
          const ratio = Math.min(1, Math.max(0.1, (topThreshold - pos.y) / 120));
          const speed = Math.round(6 + ratio * 24);
          scrollContainerOrWindow(-speed);
          updateHoverTarget(pos.x, pos.y);
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    const onPointerMove = (e) => {
      let x = null;
      let y = null;
      if (e.touches && e.touches.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      } else if (e.clientY !== undefined) {
        x = e.clientX;
        y = e.clientY;
      }
      if (y !== null) {
        pointerPosRef.current = { x, y };
        updateHoverTarget(x, y);
      }
    };

    const onGlobalDragOver = (e) => {
      e.preventDefault(); // REQUIRED for HTML5 dragover to stream continuously
      if (e.clientY !== undefined) {
        pointerPosRef.current = { x: e.clientX, y: e.clientY };
        updateHoverTarget(e.clientX, e.clientY);
      }
    };

    const onPointerRelease = () => {
      if (isDraggingActiveRef.current) {
        handleDrop(dragOverIndexRef.current);
      }
    };

    window.addEventListener('dragover', onGlobalDragOver, { passive: false });
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('touchend', onPointerRelease);

    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('dragover', onGlobalDragOver);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('touchend', onPointerRelease);
    };
  }, [draggedHabitId]);

  const handleCatTouchStart = (cat) => {
    catLongPressTimerRef.current = setTimeout(() => {
      setLongPressCat(cat);
      sound.press();
    }, 450);
  };

  const handleCatTouchEnd = () => {
    if (catLongPressTimerRef.current) {
      clearTimeout(catLongPressTimerRef.current);
    }
  };

  // Drag-and-drop reorder handlers with synchronized dual-haptics
  const handleDragStart = (habitId, index = null) => {
    setDraggedHabitId(habitId);
    if (index !== null) {
      setDragOverIndex(index);
      dragOverIndexRef.current = index;
    }
    sound.dragStart();
  };

  const handleDragEnter = (targetIdx) => {
    if (dragOverIndexRef.current !== targetIdx) {
      setDragOverIndex(targetIdx);
      dragOverIndexRef.current = targetIdx;
      sound.dragOver();
    }
  };

  const handleDrop = (targetIdx) => {
    const finalTarget = targetIdx !== undefined && targetIdx !== null ? targetIdx : dragOverIndexRef.current;
    if (!draggedHabitId || finalTarget === null || finalTarget === undefined) {
      setDraggedHabitId(null);
      setDragOverIndex(null);
      dragOverIndexRef.current = null;
      pointerPosRef.current = { x: null, y: null };
      return;
    }
    const sourceIdx = habits.findIndex((h) => h.id === draggedHabitId);
    if (sourceIdx !== -1 && sourceIdx !== finalTarget) {
      if (reorderHabitToIndex) {
        reorderHabitToIndex(draggedHabitId, finalTarget);
      } else if (reorderHabit) {
        const diff = finalTarget - sourceIdx;
        const direction = diff > 0 ? 'down' : 'up';
        for (let i = 0; i < Math.abs(diff); i++) {
          reorderHabit(draggedHabitId, direction);
        }
      }
      sound.step();
    }
    setDraggedHabitId(null);
    setDragOverIndex(null);
    dragOverIndexRef.current = null;
    pointerPosRef.current = { x: null, y: null };
  };

  const handleDragEnd = () => {
    setDraggedHabitId(null);
    setDragOverIndex(null);
    dragOverIndexRef.current = null;
    pointerPosRef.current = { x: null, y: null };
  };

  return (
    <div className="habit-cards-section">
      {/* Category Pills & Progress Bar */}
      <div className="habits-filter-bar">
        <div className="category-scroll-chips">
          {categories.map((cat) => {
            const isDeletable = cat !== 'All' && cat !== 'Daily';
            const showDelete = isDeletable && longPressCat === cat;

            return (
              <div
                key={cat}
                className={`category-chip-wrapper ${selectedCategory === cat ? 'active' : ''}`}
                onTouchStart={() => handleCatTouchStart(cat)}
                onTouchEnd={handleCatTouchEnd}
                onTouchCancel={handleCatTouchEnd}
                onContextMenu={(e) => {
                  if (isDeletable) {
                    e.preventDefault();
                    setLongPressCat(cat);
                  }
                }}
              >
                <button
                  type="button"
                  className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => {
                    sound.selection();
                    setSelectedCategory(cat);
                    setLongPressCat(null);
                  }}
                >
                  <span>{cat}</span>
                </button>
                {showDelete && (
                  <button
                    type="button"
                    className="cat-delete-btn"
                    onClick={(e) => {
                      handleDeleteCategory(e, cat);
                      setLongPressCat(null);
                    }}
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
            <>
              <button
                type="button"
                className="category-chip add-category-chip font-medium"
                onClick={() => setShowAddCatInput(true)}
                title="Add custom category"
              >
                <FolderPlus size={13} />
                <span>+ Category</span>
              </button>
              <button
                type="button"
                className="category-chip manage-category-chip font-medium"
                onClick={() => setIsManageCatOpen(true)}
                title="Manage and delete categories"
              >
                <SlidersHorizontal size={13} />
                <span>Manage</span>
              </button>
            </>
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
            healthStats={healthStats}
            onUpdate={updateHabit}
            onRemove={removeGoal}
            onOpenEdit={() => setSelectedHabitForEdit(habit)}
            pageMounted={pageMounted}
            isDragging={draggedHabitId === habit.id}
            isDragOver={dragOverIndex === index}
            onDragStart={() => handleDragStart(habit.id, index)}
            onDragEnter={() => handleDragEnter(index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            isReorderMode={isReorderMode}
            onMoveUp={() => {
              if (index > 0 && reorderHabit) {
                sound.tap();
                reorderHabit(habit.id, 'up');
              }
            }}
            onMoveDown={() => {
              if (index < filteredHabits.length - 1 && reorderHabit) {
                sound.tap();
                reorderHabit(habit.id, 'down');
              }
            }}
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

      {/* Manage Categories Modal */}
      <ManageCategoriesModal
        isOpen={isManageCatOpen}
        onClose={() => setIsManageCatOpen(false)}
      />

      {/* Dedicated Reorder Habits Modal */}
      <ReorderHabitsModal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
      />

      {/* iOS Health Setup Guide Modal (shown when Sync Now finds no data on iOS web) */}
      <IosHealthSetupGuide
        isOpen={showIosHealthGuide}
        onClose={() => setShowIosHealthGuide(false)}
        userSecretCode={user?.secretCode || user?.secret_code}
        onManualEntry={handleManualHealthEntry}
      />
    </div>
  );
};

const ModernHabitCard = ({
  habit,
  index,
  totalCount,
  activeUserId,
  healthStats,
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
  isReorderMode = false,
  onMoveUp,
  onMoveDown,
}) => {
  const isBool = typeof habit.user1 === 'boolean' || habit.unit === 'check';
  const val = Number(habit.user1) || 0;
  const target = Number(habit.target) || 1;
  const isDone = isBool ? Boolean(habit.user1) : val >= target;
  const percent = isBool ? (isDone ? 100 : 0) : Math.min(100, Math.round((val / target) * 100));
  const animatedPercent = pageMounted ? percent : 0;

  const isStepHabit = habit.id === 'steps' ||
                      (habit.unit || '').toLowerCase() === 'steps' ||
                      (habit.name || '').toLowerCase().includes('step') ||
                      (habit.name || '').toLowerCase().includes('walk');

  const showHealthMetrics = isStepHabit && val > 0;
  const metricsCalories = (healthStats && healthStats.steps === val && healthStats.calories)
    ? healthStats.calories
    : Math.round(val * 0.04);
  const metricsDistance = (healthStats && healthStats.steps === val && healthStats.distanceKm !== undefined)
    ? healthStats.distanceKm
    : Math.round(val * 0.000762 * 100) / 100;

  const stepDelta = Number(habit.delta) || (habit.unit === 'steps' ? 1000 : (habit.id === 'workouts' ? 5 : 1));

  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef(null);

  const handleToggleBool = () => {
    sound.step();
    onUpdate(habit.id, activeUserId, !isDone, true);
  };

  const handleStep = (amount) => {
    sound.step();
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

  const touchStartPosRef = useRef({ x: 0, y: 0 });

  // Deliberate long-press detection for reordering (cancelled immediately on scroll)
  const handleCardTouchStart = (e) => {
    const touch = e.touches?.[0];
    if (touch) {
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    }
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressing(true);
      sound.dragStart();
    }, 650);
  };

  const handleCardTouchMove = (e) => {
    const touch = e.touches?.[0];
    if (touch && touchStartPosRef.current) {
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (dx > 8 || dy > 8) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    }
  };

  const handleCardTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
  };

  return (
    <div
      className={`modern-habit-card ${isDone ? 'completed-card' : ''} ${
        isLongPressing || isDragging ? 'is-reordering' : ''
      } ${isDragOver ? 'drag-over' : ''}`}
      data-index={index}
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onTouchStart={handleCardTouchStart}
      onTouchMove={handleCardTouchMove}
      onTouchEnd={handleCardTouchEnd}
      onTouchCancel={handleCardTouchEnd}
    >
      <div className="habit-card-top">
        {/* Reorder Up / Down Controls (Accessible on all 3 OS) */}
        <div className={`habit-reorder-controls ${isReorderMode ? 'visible' : ''}`}>
          <button
            type="button"
            className="habit-reorder-btn up"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp?.();
            }}
            title="Move up"
            aria-label="Move habit up"
          >
            <ChevronUp size={15} />
          </button>
          <button
            type="button"
            className="habit-reorder-btn down"
            disabled={index === totalCount - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown?.();
            }}
            title="Move down"
            aria-label="Move habit down"
          >
            <ChevronDown size={15} />
          </button>
        </div>

        {/* Universal Touch & Pointer Drag Handle */}
        <div
          className="habit-drag-handle"
          title="Drag to reorder"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStart();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDragStart();
          }}
        >
          <GripVertical size={16} className="text-slate-500" />
        </div>

        {/* Tappable Habit Info Area */}
        <div
          className="habit-card-info clickable-card-info"
          onClick={() => {
            sound.press();
            onOpenEdit();
          }}
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
                {isBool ? (isDone ? 'Completed' : 'Pending') : `${val.toLocaleString()} / ${target.toLocaleString()} ${habit.unit || ''}`}
              </span>

              {habit.reminderTime && (
                <span className="habit-schedule-pill">
                  <Clock size={11} />
                  <span>{habit.reminderTime}</span>
                </span>
              )}
            </div>

            {showHealthMetrics && (
              <div className="habit-health-metrics-subtext" title="Logged activity metrics">
                <span className="metric-cal">🔥 {metricsCalories.toLocaleString()} kcal</span>
                <span className="metric-sep">·</span>
                <span className="metric-dist">📍 {metricsDistance} km</span>
              </div>
            )}
          </div>
        </div>

        {/* Action controls */}
        <div className="habit-actions-right">
          <button
            className="habit-options-btn"
            onClick={() => {
              sound.press();
              onOpenEdit();
            }}
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

      {/* Visual Progress Bar (accidental touch scrubbing disabled) */}
      {!isBool && (
        <div className="habit-progress-section">
          <div
            className="progress-bar-track visual-only-track"
            title={`${percent}% completed`}
          >
            <div
              className="progress-bar-fill"
              style={{ width: `${animatedPercent}%` }}
            />
          </div>

          <div className="habit-stepper-row">
            <div className="stepper-controls">
              <button
                className="step-btn minus"
                onClick={() => handleStep(-stepDelta)}
                disabled={val <= 0}
                aria-label={`Decrease by ${stepDelta} ${habit.unit || ''}`}
                title={`-${stepDelta} ${habit.unit || ''}`}
              >
                <Minus size={14} />
              </button>
              <button
                className="step-btn plus"
                onClick={() => handleStep(stepDelta)}
                aria-label={`Increase by ${stepDelta} ${habit.unit || ''}`}
                title={`+${stepDelta} ${habit.unit || ''}`}
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
