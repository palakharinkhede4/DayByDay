import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';

export const AddGoalModal = ({ isOpen, onClose }) => {
  const { addGoal, habits } = useHabits();
  const [tab, setTab] = useState('preset'); // 'preset' or 'custom'

  // Custom goal fields
  const [customName, setCustomName] = useState('');
  const [customTarget, setCustomTarget] = useState(1);
  const [customUnit, setCustomUnit] = useState('times');
  const [customIcon, setCustomIcon] = useState('🎯');

  if (!isOpen) return null;

  const presets = [
    { id: 'journaling', name: 'Journaling', desc: 'Daily reflection & thoughts', target: 1, unit: 'entry', icon: '✍️' },
    { id: 'running', name: 'Running', desc: 'Cardio distance', target: 3, unit: 'miles', icon: '🏃' },
    { id: 'guitar', name: 'Guitar Practice', desc: 'Music practice', target: 20, unit: 'min', icon: '🎸' },
    { id: 'screen_limit', name: 'Screen Limit', desc: 'Under 2 hours recreational', target: 2, unit: 'hrs', icon: '📵' },
    { id: 'healthy_meal', name: 'Healthy Cooking', desc: 'Cook home meals', target: 1, unit: 'meal', icon: '🥗' },
  ];

  const handleAddPreset = (preset) => {
    addGoal({
      id: `${preset.id}_${Date.now()}`,
      name: preset.name,
      category: 'Daily',
      description: preset.desc,
      target: preset.target,
      unit: preset.unit,
      icon: preset.icon,
      user1: 0,
      user2: 0,
    });
    onClose();
  };

  const handleCreateCustom = (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    addGoal({
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      category: 'Daily',
      description: 'Custom shared habit',
      target: Number(customTarget) || 1,
      unit: customUnit.trim() || 'times',
      icon: customIcon,
      user1: 0,
      user2: 0,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet add-goal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grabber"></div>

        <div className="modal-header">
          <div>
            <span className="modal-pill-tag">Add a Goal</span>
            <h2 className="modal-title">What would you like to add together?</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className="add-tabs">
          <button
            className={`tab-btn ${tab === 'preset' ? 'active' : ''}`}
            onClick={() => setTab('preset')}
          >
            Choose a Preset
          </button>
          <button
            className={`tab-btn ${tab === 'custom' ? 'active' : ''}`}
            onClick={() => setTab('custom')}
          >
            Create Your Own
          </button>
        </div>

        {tab === 'preset' ? (
          <div className="preset-list">
            {presets.map((p) => {
              const alreadyAdded = habits.some((h) => h.name.toLowerCase() === p.name.toLowerCase());
              return (
                <div key={p.id} className="preset-row-item">
                  <div className="preset-info">
                    <span className="preset-icon">{p.icon}</span>
                    <div>
                      <span className="preset-name font-bold">{p.name}</span>
                      <span className="preset-sub">{p.desc} · {p.target} {p.unit}</span>
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
                placeholder="e.g. Duolingo Lesson, Pushups"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                required
                className="form-input"
              />
            </div>

            <div className="form-row">
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

              <div className="form-group half">
                <label className="form-label">Unit</label>
                <input
                  type="text"
                  placeholder="e.g. reps, min, pages"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Select Icon</label>
              <div className="icon-selector-row">
                {['🎯', '🧘', '💧', '🏃', '📚', '💪', '🚴', '🌱', '🍎', '✨'].map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    className={`emoji-choice-btn ${customIcon === emoji ? 'active' : ''}`}
                    onClick={() => setCustomIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="create-submit-btn font-bold">
              Add Goal to Pod
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
