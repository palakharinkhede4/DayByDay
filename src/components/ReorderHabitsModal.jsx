import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUpDown,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  GripVertical,
  Check,
  Flame,
} from 'lucide-react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';

export const ReorderHabitsModal = ({ isOpen, onClose }) => {
  const { habits, reorderHabit, reorderHabitToIndex } = useHabits();
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const listContainerRef = useRef(null);
  const dragOverIdxRef = useRef(null);
  const pointerYRef = useRef(null);

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Modal auto-scroll RAF loop during drag inside the sheet
  useEffect(() => {
    if (!draggedId) return;

    let rafId = null;

    const scrollLoop = () => {
      const container = listContainerRef.current;
      if (container && pointerYRef.current !== null) {
        const rect = container.getBoundingClientRect();
        const y = pointerYRef.current;
        const threshold = 70;

        if (y < rect.top + threshold) {
          const intensity = Math.min(1, (rect.top + threshold - y) / threshold);
          container.scrollTop -= Math.max(3, Math.round(intensity * 18));
        } else if (y > rect.bottom - threshold) {
          const intensity = Math.min(1, (y - (rect.bottom - threshold)) / threshold);
          container.scrollTop += Math.max(3, Math.round(intensity * 18));
        }
      }
      rafId = requestAnimationFrame(scrollLoop);
    };

    const handlePointerMove = (e) => {
      if (e.touches && e.touches.length > 0) {
        pointerYRef.current = e.touches[0].clientY;
        const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
        const item = el?.closest('.reorder-modal-item');
        if (item && item.dataset.index !== undefined) {
          const idx = parseInt(item.dataset.index, 10);
          if (!isNaN(idx) && dragOverIdxRef.current !== idx) {
            dragOverIdxRef.current = idx;
            setDragOverIdx(idx);
            sound.dragOver();
          }
        }
      } else if (e.clientY !== undefined) {
        pointerYRef.current = e.clientY;
      }
    };

    const handlePointerUp = () => {
      if (draggedId && dragOverIdxRef.current !== null) {
        const fromIdx = habits.findIndex((h) => h.id === draggedId);
        if (fromIdx !== -1 && fromIdx !== dragOverIdxRef.current) {
          reorderHabitToIndex(draggedId, dragOverIdxRef.current);
          sound.step();
        }
      }
      setDraggedId(null);
      setDragOverIdx(null);
      dragOverIdxRef.current = null;
      pointerYRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);

    rafId = requestAnimationFrame(scrollLoop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [draggedId, habits, reorderHabitToIndex]);

  if (!isOpen) return null;

  const handleMoveToTop = (e, habitId) => {
    e.stopPropagation();
    sound.tap();
    reorderHabitToIndex(habitId, 0);
  };

  const handleMoveUp = (e, habitId) => {
    e.stopPropagation();
    sound.tap();
    reorderHabit(habitId, 'up');
  };

  const handleMoveDown = (e, habitId) => {
    e.stopPropagation();
    sound.tap();
    reorderHabit(habitId, 'down');
  };

  const handleMoveToBottom = (e, habitId) => {
    e.stopPropagation();
    sound.tap();
    reorderHabitToIndex(habitId, habits.length - 1);
  };

  return (
    <div className="manage-categories-modal-backdrop" onClick={onClose}>
      <div
        className="manage-categories-modal reorder-habits-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="manage-cat-header" style={{ flexShrink: 0 }}>
          <div className="manage-cat-title-group">
            <div className="manage-cat-icon-badge" style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#3B82F6' }}>
              <ArrowUpDown size={20} />
            </div>
            <div>
              <h3 className="manage-cat-title font-extrabold">Reorder Habits</h3>
              <p className="manage-cat-subtitle">
                Move habits up, down, or straight to top/bottom
              </p>
            </div>
          </div>
          <button
            type="button"
            className="manage-cat-close-btn"
            onClick={() => {
              sound.press();
              onClose();
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Habits List */}
        <div
          ref={listContainerRef}
          className="reorder-modal-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.75rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {habits.map((habit, index) => {
            const isFirst = index === 0;
            const isLast = index === habits.length - 1;
            const isDragging = draggedId === habit.id;
            const isTarget = dragOverIdx === index;

            return (
              <div
                key={habit.id}
                data-index={index}
                className={`reorder-modal-item ${isDragging ? 'is-dragging' : ''} ${isTarget ? 'is-target' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '12px',
                  background: isDragging
                    ? 'var(--bg-surface-high, #1E293B)'
                    : isTarget
                    ? 'rgba(37, 99, 235, 0.15)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: isTarget
                    ? '1.5px dashed #3B82F6'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {/* Drag Grip */}
                <div
                  className="reorder-item-drag-handle"
                  title="Drag to reorder"
                  style={{
                    touchAction: 'none',
                    cursor: 'grab',
                    color: 'var(--text-tertiary, #64748B)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.2rem',
                  }}
                  onPointerDown={(e) => {
                    pointerYRef.current = e.clientY;
                    dragOverIdxRef.current = index;
                    setDraggedId(habit.id);
                    setDragOverIdx(index);
                    sound.dragStart();
                  }}
                >
                  <GripVertical size={16} />
                </div>

                {/* Index Order Badge */}
                <span
                  className="font-extrabold"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary, #94A3B8)',
                    minWidth: '24px',
                  }}
                >
                  #{index + 1}
                </span>

                {/* Habit Details */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    className="font-bold text-ellipsis"
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-primary, #F8FAFC)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {habit.name}
                  </span>
                  {habit.streak > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#F59E0B',
                        background: 'rgba(245, 158, 11, 0.12)',
                        padding: '1px 5px',
                        borderRadius: '6px',
                      }}
                    >
                      <Flame size={10} />
                      {habit.streak}d
                    </span>
                  )}
                </div>

                {/* Quick Action Button Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  {/* Move to Top */}
                  <button
                    type="button"
                    className="reorder-action-btn"
                    disabled={isFirst}
                    onClick={(e) => handleMoveToTop(e, habit.id)}
                    title="Move to top"
                    aria-label="Move to top"
                  >
                    <ChevronsUp size={14} />
                  </button>

                  {/* Move Up */}
                  <button
                    type="button"
                    className="reorder-action-btn"
                    disabled={isFirst}
                    onClick={(e) => handleMoveUp(e, habit.id)}
                    title="Move up"
                    aria-label="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    className="reorder-action-btn"
                    disabled={isLast}
                    onClick={(e) => handleMoveDown(e, habit.id)}
                    title="Move down"
                    aria-label="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {/* Move to Bottom */}
                  <button
                    type="button"
                    className="reorder-action-btn"
                    disabled={isLast}
                    onClick={(e) => handleMoveToBottom(e, habit.id)}
                    title="Move to bottom"
                    aria-label="Move to bottom"
                  >
                    <ChevronsDown size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Done Action */}
        <div style={{ padding: '0.75rem 1rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexShrink: 0 }}>
          <button
            type="button"
            className="confirm-btn font-bold"
            style={{
              width: '100%',
              background: 'var(--primary, #2563EB)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.75rem',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => {
              sound.complete();
              onClose();
            }}
          >
            <Check size={16} />
            <span>Done Reordering</span>
          </button>
        </div>
      </div>
    </div>
  );
};
