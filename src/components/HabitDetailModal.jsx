import React, { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  X,
  Pin,
  Bell,
  Trash2,
  Check,
  Percent,
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

const DELTA_PERCENT_PRESETS = [5, 10, 20, 25, 50];

export const HabitDetailModal = ({ habit, onClose }) => {
  const {
    editHabit,
    removeGoal,
    pinnedHabitId,
    pinHabitForLiveTracking,
    unpinHabitForLiveTracking,
  } = useHabits();

  if (!habit) return null;

  const isPinned = pinnedHabitId === habit.id;
  const isBool = typeof habit.user1 === 'boolean' || habit.unit === 'check';

  // Form state
  const [name, setName] = useState(habit.name || '');
  const [target, setTarget] = useState(habit.target || 1);
  const [unit, setUnit] = useState(habit.unit || 'times');
  const [stepPercent, setStepPercent] = useState(habit.stepPercent || 10);
  const [isCustomPercent, setIsCustomPercent] = useState(
    !DELTA_PERCENT_PRESETS.includes(habit.stepPercent || 10)
  );
  const [customPercentVal, setCustomPercentVal] = useState(
    String(habit.stepPercent || 10)
  );

  // Pin state
  const [pinned, setPinned] = useState(isPinned);

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

  const handleSelectPercentPreset = (pct) => {
    setIsCustomPercent(false);
    setStepPercent(pct);
  };

  const handleCustomPercentChange = (val) => {
    setCustomPercentVal(val);
    const num = Math.max(1, Math.min(100, Number(val) || 1));
    setStepPercent(num);
  };

  const handleSave = (e) => {
    e?.preventDefault();

    const numericTarget = Math.max(1, Number(target) || 1);
    const finalPercent = isCustomPercent
      ? Math.max(1, Math.min(100, Number(customPercentVal) || 10))
      : stepPercent;

    editHabit(habit.id, {
      name: name.trim() || habit.name,
      target: numericTarget,
      unit: unit.trim() || habit.unit,
      stepPercent: finalPercent,
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : null,
      reminderDays: reminderEnabled ? reminderDays : null,
    });

    // Handle pin state
    if (pinned && !isPinned) {
      pinHabitForLiveTracking(habit.id);
    } else if (!pinned && isPinned) {
      unpinHabitForLiveTracking();
    }

    onClose();
  };

  const handleDelete = () => {
    removeGoal(habit.id);
    onClose();
  };

  // Calculated delta preview
  const calculatedDelta = Math.max(
    1,
    Math.round(((Number(target) || 1) * stepPercent) / 100)
  );

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
              Configure targets, notifications, and controls
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

          {/* Section 2: Target & Unit (For numerical habits) */}
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
            </div>
          )}

          {/* Section 3: Stepper Delta in Percentages */}
          {!isBool && (
            <div className="habit-modal-field">
              <div className="habit-modal-label-row">
                <label className="habit-modal-label font-bold">
                  Stepper Delta (% of Target)
                </label>
                <span className="delta-preview-badge font-mono font-bold">
                  ±{calculatedDelta} {unit} ({stepPercent}%)
                </span>
              </div>
              <div className="percent-pills-row">
                {DELTA_PERCENT_PRESETS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    className={`percent-pill-btn font-bold ${
                      !isCustomPercent && stepPercent === pct ? 'active' : ''
                    }`}
                    onClick={() => handleSelectPercentPreset(pct)}
                  >
                    {pct}%
                  </button>
                ))}
                <button
                  type="button"
                  className={`percent-pill-btn font-bold ${
                    isCustomPercent ? 'active' : ''
                  }`}
                  onClick={() => setIsCustomPercent(true)}
                >
                  Custom
                </button>
              </div>

              {isCustomPercent && (
                <div className="custom-percent-input-wrap">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="habit-modal-input custom-pct-input font-mono"
                    value={customPercentVal}
                    onChange={(e) => handleCustomPercentChange(e.target.value)}
                    placeholder="Enter %"
                  />
                  <span className="custom-pct-symbol font-bold">%</span>
                </div>
              )}
              <p className="habit-field-hint">
                Each tap on the + or - button will adjust progress by this percentage.
              </p>
            </div>
          )}

          {/* Section 4: Pin to Notification / Dynamic Island Toggle */}
          <div className="habit-setting-card">
            <div className="setting-card-left">
              <div className="setting-icon-box pin-icon-box">
                <Pin size={18} className="text-emerald-400" />
              </div>
              <div>
                <span className="setting-card-title font-bold">
                  Pin this habit on notification
                </span>
                <p className="setting-card-desc">
                  This habit will be pinned in the Android notification bar and Dynamic
                  Island for live tracking on the go.
                </p>
              </div>
            </div>
            <label className="habit-toggle-switch">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Section 5: Daily Reminder Settings */}
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

          {/* Section 6: Danger Zone / Delete Habit */}
          <div className="habit-danger-section">
            {!showDeleteConfirm ? (
              <button
                type="button"
                className="habit-delete-trigger-btn font-bold"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} />
                <span>Delete This Habit</span>
              </button>
            ) : (
              <div className="delete-confirm-card">
                <div className="confirm-text-group">
                  <AlertTriangle size={18} className="text-red-400" />
                  <span className="font-bold text-red-400">Permanently Delete Habit?</span>
                </div>
                <p className="confirm-subtext">
                  This will remove "{habit.name}" and all associated progress logs.
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

          {/* Footer Save Action */}
          <div className="habit-modal-footer">
            <button
              type="button"
              className="habit-footer-btn cancel font-medium"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="habit-footer-btn save font-bold">
              <Check size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
