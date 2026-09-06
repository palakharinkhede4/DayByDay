import React, { useState, useEffect } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Sparkles,
  Dumbbell,
  Code,
  BookOpen,
  Activity,
  Smartphone,
  Target,
  Check,
  X,
  Bell,
  Clock,
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

const PRESETS = [
  { id: 'journaling', name: 'Journaling', category: 'Mind', desc: 'Daily reflections & thoughts', target: 1, unit: 'entry', icon: 'mind', time: '21:30' },
  { id: 'running', name: 'Morning Run', category: 'Fitness', desc: 'Cardio distance', target: 3, unit: 'km', icon: 'fitness', time: '07:00' },
  { id: 'coding', name: 'Code Practice', category: 'Work', desc: 'Deep work & building', target: 60, unit: 'min', icon: 'work', time: '10:00' },
  { id: 'reading', name: 'Reading', category: 'Mind', desc: 'Books or articles', target: 15, unit: 'pages', icon: 'reading', time: '20:00' },
  { id: 'stretching', name: 'Stretching & Mobility', category: 'Health', desc: 'Post-workout recovery', target: 10, unit: 'min', icon: 'health', time: '08:00' },
  { id: 'screen_limit', name: 'Screen Limit', category: 'Lifestyle', desc: 'Digital detox check', target: 2, unit: 'hours', icon: 'lifestyle', time: '22:00' },
];

function getPresetIcon(icon) {
  switch (icon) {
    case 'mind': return <Sparkles size={18} className="text-purple-400" />;
    case 'fitness': return <Dumbbell size={18} className="text-rose-400" />;
    case 'work': return <Code size={18} className="text-blue-400" />;
    case 'reading': return <BookOpen size={18} className="text-amber-400" />;
    case 'health': return <Activity size={18} className="text-emerald-400" />;
    case 'lifestyle': return <Smartphone size={18} className="text-indigo-400" />;
    default: return <Target size={18} className="text-emerald-500" />;
  }
}

export const AddGoalModal = ({ isOpen, onClose }) => {
  const {
    addGoal,
    habits,
    requestNotificationPermission,
    customCategories = ['Daily', 'Health', 'Fitness', 'Mind', 'Work'],
    addCustomCategory,
  } = useHabits();
  const [tab, setTab] = useState('preset'); // 'preset' or 'custom'

  // Custom habit fields
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('Daily');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [customTarget, setCustomTarget] = useState(1);
  const [customUnit, setCustomUnit] = useState('times');
  const [customIcon, setCustomIcon] = useState('target');

  // Lock background scrolling when modal is active
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

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

    let finalCategory = customCategory;
    if (isAddingNewCategory && newCategoryName.trim()) {
      finalCategory = newCategoryName.trim();
      addCustomCategory(finalCategory);
    }

    addGoal({
      id: `custom_${Date.now().toString(36)}`,
      name: customName.trim(),
      category: finalCategory,
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
        {/* Modal Handlebar / Header */}
        <div className="modal-handle-bar">
          <div className="modal-pill-indicator"></div>
        </div>

        <div className="modal-header-row">
          <div>
            <h2 className="modal-title font-extrabold">Add New Habit</h2>
            <p className="modal-subtitle">Track personal consistency or collaborate with friends</p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="modal-mode-tabs">
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
                    <div className="preset-icon-badge">
                      {getPresetIcon(p.icon)}
                    </div>
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
                    {alreadyAdded ? (
                      <>
                        <Check size={13} />
                        <span>Added</span>
                      </>
                    ) : (
                      <span>+ Add</span>
                    )}
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
                  value={isAddingNewCategory ? '__new__' : customCategory}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setIsAddingNewCategory(true);
                    } else {
                      setIsAddingNewCategory(false);
                      setCustomCategory(e.target.value);
                    }
                  }}
                  className="form-input"
                >
                  {customCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__new__">+ New Category...</option>
                </select>
                {isAddingNewCategory && (
                  <input
                    type="text"
                    placeholder="Enter category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="form-input"
                    style={{ marginTop: '6px' }}
                    autoFocus
                    required
                  />
                )}
              </div>

              <div className="form-group half">
                <label className="form-label">Daily Target</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
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
                <label className="form-label">Icon Style</label>
                <select
                  value={customIcon}
                  onChange={(e) => setCustomIcon(e.target.value)}
                  className="form-input"
                >
                  <option value="target">Target</option>
                  <option value="fitness">Fitness / Workout</option>
                  <option value="reading">Reading / Learning</option>
                  <option value="meditation">Mindfulness</option>
                  <option value="water">Hydration</option>
                  <option value="work">Work / Code</option>
                  <option value="health">Health / Wellness</option>
                  <option value="sleep">Rest / Sleep</option>
                </select>
              </div>
            </div>

            {/* SCHEDULED REMINDERS & NOTIFICATIONS */}
            <div className="reminder-settings-card">
              <div className="reminder-toggle-row">
                <div className="reminder-left-title">
                  <Bell size={16} className="text-amber-400" />
                  <div>
                    <span className="reminder-title font-bold">Schedule Reminder</span>
                    <span className="reminder-hint">Get alerted at a specific time</span>
                  </div>
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
