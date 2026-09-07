import React, { useEffect } from 'react';
import {
  ArrowUpDown,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Check,
  Flame,
} from 'lucide-react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';

export const ReorderHabitsModal = ({ isOpen, onClose }) => {
  const { habits, reorderHabit, reorderHabitToIndex } = useHabits();

  // Lock body scroll while modal is active
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

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
    <div
      className="manage-categories-modal-backdrop"
      onClick={onClose}
      style={{
        zIndex: 10000,
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="manage-categories-modal reorder-habits-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.25rem 0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowUpDown size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--text-primary, #F8FAFC)',
                  letterSpacing: '-0.02em',
                }}
              >
                Reorder Habits
              </h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary, #94A3B8)',
                }}
              >
                Tap arrows to prioritize habits on home screen
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sound.press();
              onClose();
            }}
            aria-label="Close"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.05)',
              border: 'none',
              color: 'var(--text-secondary, #94A3B8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Habits List */}
        <div
          className="reorder-modal-list"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          {habits.map((habit, index) => {
            const isFirst = index === 0;
            const isLast = index === habits.length - 1;

            return (
              <div
                key={habit.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 14,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  transition: 'background 0.15s ease, transform 0.15s ease',
                }}
              >
                {/* Index Order Badge */}
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#60A5FA',
                    background: 'rgba(59, 130, 246, 0.12)',
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>

                {/* Habit Name & Streak */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span
                      style={{
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        color: 'var(--text-primary, #F8FAFC)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
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
                          padding: '1px 6px',
                          borderRadius: '6px',
                          flexShrink: 0,
                        }}
                      >
                        <Flame size={10} />
                        {habit.streak}d
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-tertiary, #64748B)',
                    }}
                  >
                    Goal: {habit.target} {habit.unit || ''}
                  </span>
                </div>

                {/* Control Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {/* Move to Top */}
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={(e) => handleMoveToTop(e, habit.id)}
                    title="Move to top"
                    aria-label="Move to top"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: 'none',
                      background: isFirst ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.07)',
                      color: isFirst ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-primary, #F8FAFC)',
                      cursor: isFirst ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <ChevronsUp size={15} />
                  </button>

                  {/* Move Up */}
                  <button
                    type="button"
                    disabled={isFirst}
                    onClick={(e) => handleMoveUp(e, habit.id)}
                    title="Move up one position"
                    aria-label="Move up"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: 'none',
                      background: isFirst ? 'rgba(255, 255, 255, 0.02)' : 'rgba(59, 130, 246, 0.15)',
                      color: isFirst ? 'rgba(255, 255, 255, 0.2)' : '#60A5FA',
                      cursor: isFirst ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <ChevronUp size={16} />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={(e) => handleMoveDown(e, habit.id)}
                    title="Move down one position"
                    aria-label="Move down"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: 'none',
                      background: isLast ? 'rgba(255, 255, 255, 0.02)' : 'rgba(59, 130, 246, 0.15)',
                      color: isLast ? 'rgba(255, 255, 255, 0.2)' : '#60A5FA',
                      cursor: isLast ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>

                  {/* Move to Bottom */}
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={(e) => handleMoveToBottom(e, habit.id)}
                    title="Move to bottom"
                    aria-label="Move to bottom"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: 'none',
                      background: isLast ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.07)',
                      color: isLast ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-primary, #F8FAFC)',
                      cursor: isLast ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <ChevronsDown size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Done Action */}
        <div
          style={{
            padding: '0.85rem 1.25rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            style={{
              width: '100%',
              background: 'var(--primary, #3B82F6)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.8rem',
              borderRadius: 12,
              border: 'none',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
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
