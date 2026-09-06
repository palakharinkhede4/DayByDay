import React, { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  X,
  Bell,
  Trash2,
  Check,
  Target,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
  { key: 'Sun', label: 'S' },
];

export const HabitDetailModal = ({ habit, onClose }) => {
  const { editHabit, removeGoal } = useHabits();

  if (!habit) return null;

  const isBool = typeof habit.user1 === 'boolean' || habit.unit === 'check';

  // Form state
  const [name, setName] = useState(habit.name || '');
  const [target, setTarget] = useState(habit.target || 1);
  const [unit, setUnit] = useState(habit.unit || 'times');
  const [delta, setDelta] = useState(habit.delta || (habit.unit === 'steps' ? 1000 : 1));

  // Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(
    Boolean(habit.reminderEnabled || habit.reminderTime)
  );
  const [reminderTime, setReminderTime] = useState(habit.reminderTime || '08:00');
  const [reminderDays, setReminderDays] = useState(
    habit.reminderDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  );

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Lock background scroll while modal is active
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleToggleDay = (dayKey) => {
    setReminderDays((prev) =>
      prev.includes(dayKey)
        ? prev.filter((d) => d !== dayKey)
        : [...prev, dayKey]
    );
  };

  const handleSave = (e) => {
    e?.preventDefault();

    const numericTarget = Math.max(1, Number(target) || 1);

    editHabit(habit.id, {
      name: name.trim() || habit.name,
      target: numericTarget,
      unit: unit.trim() || habit.unit,
      delta: Math.max(1, Number(delta) || 1),
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : null,
      reminderDays: reminderEnabled ? reminderDays : null,
    });

    onClose();
  };

  const handleDelete = () => {
    removeGoal(habit.id);
    onClose();
  };

  return (
    <div className="habit-modal-backdrop" onClick={onClose}>
      <div
        className="habit-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit Habit Settings"
      >
        {/* Header */}
        <div className="habit-modal-header">
          <div className="habit-modal-title-group">
            <h2 className="habit-modal-title font-extrabold">Habit Settings</h2>
            <span className="habit-modal-subtitle">
              Configure name, daily goal, reminders, and options
            </span>
          </div>
          <button
            className="habit-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="habit-modal-body">
          {/* Section 1: Name */}
          <div className="habit-modal-field">
            <label className="habit-modal-label font-bold">Habit Name</label>
            <input
              type="text"
              className="habit-modal-input font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Steps"
              required
            />
          </div>

          {/* Section 2: Target, Unit & Increment (For numerical habits) */}
          {!isBool && (
            <div className="habit-modal-row-split">
              <div className="habit-modal-field">
                <label className="habit-modal-label font-bold">Daily Target</label>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  className="habit-modal-input font-medium"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  required
                />
              </div>
              <div className="habit-modal-field">
                <label className="habit-modal-label font-bold">Unit</label>
                <input
                  type="text"
                  className="habit-modal-input font-medium"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. steps, min, cups"
                />
              </div>
              <div className="habit-modal-field">
                <label className="habit-modal-label font-bold">Step Increment (+/-)</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  className="habit-modal-input font-medium"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="e.g. 1, 5, 250, 1000"
                />
              </div>
            </div>
          )}

          {/* Section 3: Daily Reminder Settings */}
          <div className="habit-setting-card column-layout">
            <div className="setting-card-header">
              <div className="setting-card-left">
                <div className="setting-icon-box bell-icon-box">
                  <Bell size={18} className="text-indigo-400" />
                </div>
                <div>
                  <span className="setting-card-title font-bold">
                    Daily Habit Reminder
                  </span>
                  <p className="setting-card-desc">
                    Get an alert on your device to keep your streak unbroken.
                  </p>
                </div>
              </div>
              <label className="habit-toggle-switch">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {reminderEnabled && (
              <div className="reminder-config-drawer">
                <div className="reminder-time-row">
                  <label className="habit-modal-label font-bold">Reminder Time</label>
                  <input
                    type="time"
                    className="habit-modal-input time-input font-bold"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                  />
                </div>

                <div className="reminder-days-row">
                  <label className="habit-modal-label font-bold">Active Days</label>
                  <div className="day-pills-row">
                    {DAYS_OF_WEEK.map((d) => {
                      const isActive = reminderDays.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          className={`day-pill-btn font-bold ${
                            isActive ? 'active' : ''
                          }`}
                          onClick={() => handleToggleDay(d.key)}
                          title={d.key}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Danger Zone / Delete Habit */}
          <div className="habit-danger-section">
            {!showDeleteConfirm ? (
              <button
                type="button"
                className="habit-delete-trigger-btn font-semibold"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} />
                <span>Delete Habit</span>
              </button>
            ) : (
              <div className="delete-confirm-card">
                <div className="confirm-text-group">
                  <AlertTriangle size={18} className="text-rose-500" />
                  <span className="font-bold text-rose-400">
                    Permanently delete this habit?
                  </span>
                </div>
                <p className="confirm-subtext">
                  This will remove the habit and all its logged history. This cannot be undone.
                </p>
                <div className="confirm-btn-group">
                  <button
                    type="button"
                    className="confirm-action-btn cancel font-medium"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="confirm-action-btn danger font-bold"
                    onClick={handleDelete}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="habit-modal-footer">
            <button
              type="button"
              className="habit-footer-btn cancel font-semibold"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="habit-footer-btn save font-bold"
            >
              <Check size={16} strokeWidth={2.6} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
