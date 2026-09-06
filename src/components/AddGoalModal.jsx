import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';

const DAYS_OF_WEEK = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'T' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'T' },
  { key: 'Fri', label: 'F' },
  { key: 'Sat', label: 'S' },
  { key: 'Sun', label: 'S' },
];

const PRESETS = [
  { id: 'journaling', name: 'Journaling', category: 'Mind', desc: 'Daily reflections & thoughts', target: 1, unit: 'entry', icon: '✍️', time: '21:30' },
  { id: 'running', name: 'Morning Run', category: 'Fitness', desc: 'Cardio distance', target: 3, unit: 'km', icon: '🏃', time: '07:00' },
  { id: 'coding', name: 'Code Practice', category: 'Work', desc: 'Deep work & building', target: 60, unit: 'min', icon: '💻', time: '10:00' },
  { id: 'reading', name: 'Reading', category: 'Mind', desc: 'Books or articles', target: 15, unit: 'pages', icon: '📚', time: '20:00' },
  { id: 'stretching', name: 'Stretching & Mobility', category: 'Health', desc: 'Post-workout recovery', target: 10, unit: 'min', icon: '🧘', time: '08:00' },
  { id: 'screen_limit', name: 'Screen Limit', category: 'Lifestyle', desc: 'Digital detox check', target: 2, unit: 'hours', icon: '📵', time: '22:00' },
];

export const AddGoalModal = ({ isOpen, onClose }) => {
  const { addGoal, habits, requestNotificationPermission } = useHabits();
  const [tab, setTab] = useState('preset'); // 'preset' or 'custom'

  // Custom habit fields
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Health');
  const [customTarget, setCustomTarget] = useState(1);
  const [customUnit, setCustomUnit] = useState('times');
  const [customIcon, setCustomIcon] = useState('🎯');

  // Reminder settings
  const [enableReminder, setEnableReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('08:00');
  const [reminderDays, setReminderDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

  if (!isOpen) return null;

  const toggleDay = (dayKey) => {
    if (reminderDays.includes(dayKey)) {
      if (reminderDays.length > 1) {
        setReminderDays(reminderDays.filter((d) => d !== dayKey));
      }
    } else {
      setReminderDays([...reminderDays, dayKey]);
    }
  };

  const selectDayPreset = (type) => {
    if (type === 'all') setReminderDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    else if (type === 'weekdays') setReminderDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    else if (type === 'weekends') setReminderDays(['Sat', 'Sun']);
  };

  const handleAddPreset = async (preset) => {
    addGoal({
      id: `${preset.id}_${Date.now().toString(36)}`,
      name: preset.name,
      category: preset.category || 'Daily',
      description: preset.desc,
      target: preset.target,
      unit: preset.unit,
      icon: preset.icon,
      user1: 0,
      user2: 0,
      reminderTime: preset.time || null,
      reminderDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    });
    onClose();
  };

  const handleCreateCustom = async (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    if (enableReminder) {
      await requestNotificationPermission();
    }

    addGoal({
      id: `custom_${Date.now().toString(36)}`,
      name: customName.trim(),
      category: customCategory,
      description: 'Custom habit',
      target: Number(customTarget) || 1,
      unit: customUnit.trim() || 'times',
      icon: customIcon,
      user1: 0,
      user2: 0,
      reminderTime: enableReminder ? reminderTime : null,
      reminderDays: enableReminder ? reminderDays : null,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet add-goal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grabber"></div>

        <div className="modal-header">
          <div>
            <span className="modal-pill-tag">HABIT CREATOR</span>
            <h2 className="modal-title">Add a New Habit</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        {/* Tab switcher */}
        <div className="add-tabs">
          <button
            type="button"
            className={`tab-btn ${tab === 'preset' ? 'active' : ''}`}
            onClick={() => setTab('preset')}
          >
            Popular Presets
          </button>
          <button
            type="button"
            className={`tab-btn ${tab === 'custom' ? 'active' : ''}`}
            onClick={() => setTab('custom')}
          >
            Custom Habit & Reminders
          </button>
        </div>

        {tab === 'preset' ? (
          <div className="preset-list">
            {PRESETS.map((p) => {
              const alreadyAdded = habits.some((h) => h.name.toLowerCase() === p.name.toLowerCase());
              return (
                <div key={p.id} className="preset-row-item">
                  <div className="preset-info">
                    <span className="preset-icon">{p.icon}</span>
                    <div>
                      <span className="preset-name font-bold">{p.name}</span>
                      <span className="preset-sub">{p.desc} · {p.target} {p.unit} · {p.category}</span>
                    </div>
                  </div>
                  <button
                    className={`add-preset-btn ${alreadyAdded ? 'added' : ''}`}
                    onClick={() => !alreadyAdded && handleAddPreset(p)}
                    disabled={alreadyAdded}
                  >
                    {alreadyAdded ? 'Added ✓' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <form onSubmit={handleCreateCustom} className="custom-goal-form">
            <div className="form-group">
              <label className="form-label">Habit Name</label>
              <input
                type="text"
                placeholder="e.g. Duolingo Lesson, Pushups, Deep Work"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                required
                className="form-input"
              />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Category</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  className="form-input"
                >
                  <option value="Health">Health</option>
                  <option value="Mind">Mind</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Work">Work</option>
                  <option value="Study">Study</option>
                  <option value="Lifestyle">Lifestyle</option>
                </select>
              </div>

              <div className="form-group half">
                <label className="form-label">Daily Target</label>
                <input
                  type="number"
                  min="1"
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label className="form-label">Unit of Measure</label>
                <input
                  type="text"
                  placeholder="e.g. reps, min, pages, times"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group half">
                <label className="form-label">Icon</label>
                <select
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  className="form-input"
                >
                  <option value="🎯">🎯 Target</option>
                  <option value="🏃">🏃 Runner</option>
                  <option value="📚">📚 Book</option>
                  <option value="🧘">🧘 Mindfulness</option>
                  <option value="💧">💧 Water</option>
                  <option value="💪">💪 Fitness</option>
                  <option value="💻">💻 Code / Work</option>
                  <option value="✍️">✍️ Writing</option>
                  <option value="🥗">🥗 Nutrition</option>
                  <option value="🌱">🌱 Habit</option>
                </select>
              </div>
            </div>

            {/* SCHEDULED REMINDERS & NOTIFICATIONS */}
            <div className="reminder-settings-card">
              <div className="reminder-toggle-row">
                <div>
                  <span className="reminder-title font-bold">Schedule Reminder Notification</span>
                  <span className="reminder-hint">Get alerted on your device at a specific time</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={enableReminder}
                    onChange={(e) => setEnableReminder(e.target.checked)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              {enableReminder && (
                <div className="reminder-details-panel">
                  <div className="form-group">
                    <label className="form-label">Notification Time</label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="form-input time-input"
                    />
                  </div>

                  <div className="form-group">
                    <div className="days-label-row">
                      <label className="form-label">Active Days</label>
                      <div className="days-quick-links">
                        <button type="button" onClick={() => selectDayPreset('all')}>Daily</button>
                        <span>·</span>
                        <button type="button" onClick={() => selectDayPreset('weekdays')}>Weekdays</button>
                        <span>·</span>
                        <button type="button" onClick={() => selectDayPreset('weekends')}>Weekends</button>
                      </div>
                    </div>

                    <div className="days-selector-pills">
                      {DAYS_OF_WEEK.map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          className={`day-pill ${reminderDays.includes(d.key) ? 'active' : ''}`}
                          onClick={() => toggleDay(d.key)}
                        >
                          {d.key}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="create-submit-btn font-bold">
              Save Habit
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
