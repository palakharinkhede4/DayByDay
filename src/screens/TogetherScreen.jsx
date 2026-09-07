import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import { sound } from '../utils/sound';
import {
  Users,
  Plus,
  Copy,
  Check,
  Share2,
  ArrowRight,
  Flame,
  CheckCircle2,
  Trophy,
  LogOut,
  Target,
  Trash2,
  Rocket,
  Minus,
  X,
  Sparkles,
  SlidersHorizontal,
  Activity,
} from 'lucide-react';
const POD_GOAL_PRESETS = [
  { name: '10,000 Steps', category: 'Fitness', target: 10000, unit: 'steps', delta: 1000 },
  { name: 'Daily Hydration', category: 'Health', target: 8, unit: 'glasses', delta: 1 },
  { name: 'Group Workout', category: 'Fitness', target: 30, unit: 'min', delta: 5 },
  { name: 'Book Reading', category: 'Mind', target: 20, unit: 'pages', delta: 5 },
  { name: 'Deep Work', category: 'Productivity', target: 60, unit: 'min', delta: 15 },
  { name: 'Mindfulness', category: 'Mind', target: 10, unit: 'min', delta: 5 },
];

const getMemberProgressVal = (memberProgressMap, m) => {
  if (!memberProgressMap || !m) return 0;
  const raw = memberProgressMap[m.id] ??
              (m.username ? memberProgressMap[m.username] : undefined) ??
              (m.secretCode ? memberProgressMap[m.secretCode] : undefined) ??
              (m.secret_code ? memberProgressMap[m.secret_code] : undefined) ??
              memberProgressMap['user1'];
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'object') return Number(raw.value) || 0;
  return Number(raw) || 0;
};

const EditSharedGoalModal = ({ goal, onClose, onSave, onDelete }) => {
  const [name, setName] = useState(goal.name || '');
  const [category, setCategory] = useState(goal.category || 'Daily');
  const [target, setTarget] = useState(goal.target || 1);
  const [unit, setUnit] = useState(goal.unit || 'times');
  const [delta, setDelta] = useState(goal.delta || 1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    sound.press();
    onSave(goal.id, {
      name: name.trim() || goal.name,
      category,
      target: Math.max(1, Number(target) || 1),
      unit: unit.trim() || goal.unit,
      delta: Math.max(1, Number(delta) || 1),
    });
    onClose();
  };

  return (
    <div className="habit-modal-backdrop" onClick={onClose}>
      <div className="habit-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit Pod Goal">
        <div className="habit-modal-header">
          <div className="habit-modal-title-group">
            <h2 className="habit-modal-title font-extrabold">Pod Goal Settings</h2>
            <p className="habit-modal-subtitle">Update target, units, or step increments for all pod members.</p>
          </div>
          <button className="habit-modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="habit-modal-body">
          {/* Goal Name */}
          <div className="habit-modal-field">
            <label className="habit-modal-label font-bold">Goal Name</label>
            <input
              type="text"
              className="habit-modal-input font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 10,000 Steps, 3L Hydration"
              required
            />
          </div>

          {/* Category */}
          <div className="habit-modal-field">
            <label className="habit-modal-label font-bold">Category</label>
            <select
              className="habit-modal-input habit-modal-select font-medium"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Fitness">Fitness</option>
              <option value="Health">Health</option>
              <option value="Mind">Mind</option>
              <option value="Productivity">Productivity</option>
              <option value="Daily">Daily</option>
            </select>
          </div>

          {/* Target, Unit & Increment */}
          <div className="habit-modal-row-split">
            <div className="habit-modal-field">
              <label className="habit-modal-label font-bold">Target per Person</label>
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
                placeholder="steps, min, reps"
                required
              />
            </div>

            <div className="habit-modal-field">
              <label className="habit-modal-label font-bold">Step (+ / -)</label>
              <input
                type="number"
                min="1"
                max="100000"
                className="habit-modal-input font-medium"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="e.g. 1000, 5, 1"
                required
              />
            </div>
          </div>

          {/* Delete Danger Section */}
          <div className="habit-danger-section">
            {!showDeleteConfirm ? (
              <button
                type="button"
                className="habit-delete-trigger-btn font-semibold"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={16} />
                <span>Delete Pod Goal</span>
              </button>
            ) : (
              <div className="delete-confirm-card">
                <div className="confirm-text-group">
                  <span className="font-bold text-rose-400">
                    Remove this shared goal for all members?
                  </span>
                </div>
                <p className="confirm-subtext">
                  This will delete the goal and progress records for all pod members.
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
                    onClick={() => {
                      sound.warning();
                      onDelete(goal.id);
                      onClose();
                    }}
                  >
                    Yes, Delete
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

export const TogetherScreen = () => {
  const {
    user,
    groupPod,
    createGroupPod,
    joinGroupPod,
    leaveGroupPod,
    addSharedGoal,
    editSharedGoal,
    updateSharedGoalProgress,
    deleteSharedGoal,
    sendCheer,
    triggerIslandNotification,
    triggerCelebration,
  } = useHabits();

  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  
  // Shared Goal Modal Form State
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState(10000);
  const [goalUnit, setGoalUnit] = useState('steps');
  const [goalDelta, setGoalDelta] = useState(1000);
  const [goalCategory, setGoalCategory] = useState('Fitness');

  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [cheeredMemberId, setCheeredMemberId] = useState(null);

  const handleCopyCode = async (code) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareCode = async (code, name) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join my DayByDay Pod: ${name}`,
          text: `Join our habit pod with code ${code}! We are tracking shared goals together.`,
          url: window.location.href,
        });
      } else {
        await handleCopyCode(code);
      }
    } catch {
      await handleCopyCode(code);
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    createGroupPod(createName.trim());
    setCreateName('');
    setIsCreating(false);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError('');
    setIsJoining(true);
    try {
      await joinGroupPod(joinCode.trim());
      setJoinCode('');
    } catch (err) {
      setError(err.message || 'Could not join pod. Check the code and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleAddGoalSubmit = async (e) => {
    e.preventDefault();
    if (!goalName.trim()) return;
    
    await addSharedGoal({
      name: goalName.trim(),
      target: Number(goalTarget) || 1,
      unit: goalUnit.trim() || 'reps',
      delta: Number(goalDelta) || 1,
      category: goalCategory || 'Fitness',
    });

    setGoalName('');
    setGoalTarget(10000);
    setGoalUnit('steps');
    setGoalDelta(1000);
    setIsAddingGoal(false);
    triggerIslandNotification('Shared goal added to pod! 🎯', 'check');
  };

  const handleCheerMember = (member, goalName) => {
    if (!member) return;
    const isMe = (user?.id && String(user.id) === String(member.id)) ||
                 (user?.username && member.username && String(user.username).toLowerCase() === String(member.username).toLowerCase());
    if (isMe) {
      triggerIslandNotification?.('You cannot cheer yourself! 😅', 'info');
      return;
    }

    const code = member.secretCode || member.secret_code || member.username;
    const msg = goalName ? `Cheering you on for ${goalName}! Keep crushing it! 🔥` : 'Crushing it in the pod! 🔥';
    sendCheer(code, msg, goalName);
    setCheeredMemberId(member.id || member.username);
    triggerCelebration();
    triggerIslandNotification(`Encouragement sent to @${member.username}! 🚀`, 'flame');
    setTimeout(() => setCheeredMemberId(null), 2500);
  };

  return (
    <div className="screen-together-container">
      {/* Header */}
      <div className="together-header-section">
        <h1 className="screen-main-title font-extrabold">Group Pods & Shared Goals</h1>
        <p className="screen-subtitle">
          Track shared habits with friends, family, or teammates. See individual progress and who crushed their goals.
        </p>
      </div>

      {groupPod ? (
        /* ACTIVE GROUP POD VIEW */
        <div className="active-group-pod">
          {/* Pod Banner */}
          <div className="group-pod-banner">
            <div className="group-banner-info">
              <div className="group-name-row">
                <span className="group-avatar-tag font-bold">
                  <Users size={18} />
                </span>
                <h2 className="group-title font-black">{groupPod.name}</h2>
              </div>
              <div className="group-code-row">
                <span className="group-code-pill font-mono font-bold">{groupPod.code}</span>
                <span className="group-capacity-tag font-medium">
                  {groupPod.members?.length || 1} / {groupPod.maxMembers || 10} Members
                </span>
              </div>
            </div>

            <div className="group-banner-actions">
              <button
                className="group-action-btn copy"
                onClick={() => handleCopyCode(groupPod.code)}
                title="Copy group code"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                className="group-action-btn share"
                onClick={() => handleShareCode(groupPod.code, groupPod.name)}
                title="Share group code"
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
              <button
                className="group-action-btn leave"
                onClick={leaveGroupPod}
                title="Leave this group pod"
              >
                <LogOut size={16} />
                <span>Leave</span>
              </button>
            </div>
          </div>

          {/* Members Roster (up to 10 members) */}
          <div className="together-roster-section">
            <div className="together-section-header">
              <div className="together-section-title-wrap">
                <Users size={18} className="text-blue-500 flex-shrink-0" />
                <div>
                  <h3 className="together-section-title font-bold">
                    Pod Members ({groupPod.members?.length || 1} / 10)
                  </h3>
                  <span className="together-section-hint">Tap flame to cheer teammate</span>
                </div>
              </div>
            </div>

            <div className="together-members-grid">
              {(groupPod.members || []).map((m, idx) => {
                const isMe = user?.id && String(user.id) === String(m.id);
                const isCheered = (cheeredMemberId === (m.id || m.username));

                return (
                  <div key={m.id || idx} className={`group-member-card ${isMe ? 'is-me' : ''}`}>
                    <div className="member-avatar font-bold" style={{ overflow: 'hidden' }}>
                      {m.profilePicture ? (
                        <img
                          src={m.profilePicture}
                          alt={m.displayName || m.username}
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        m.avatar || (m.displayName || m.username || 'U')[0].toUpperCase()
                      )}
                    </div>
                    <div className="member-info">
                      <div className="member-name font-bold">
                        <span className="member-name-text">{m.displayName || m.username}</span>
                        {isMe && <span className="you-badge">You</span>}
                        {m.role === 'Owner' && <span className="owner-badge">Leader</span>}
                      </div>
                      <span className="member-handle">@{m.username}</span>
                    </div>
                    <div className="member-stats">
                      <span className="member-pct font-extrabold">{m.todayPercent || 0}%</span>
                      <div className="member-streak">
                        <Flame size={12} className="text-amber-500" />
                        <span>{m.streak || 0}d</span>
                      </div>
                    </div>
                    {!isMe && (
                      <button
                        className={`group-cheer-btn ${isCheered ? 'cheered' : ''}`}
                        onClick={() => handleCheerMember(m)}
                        title={`Cheer on @${m.username}`}
                      >
                        {isCheered ? <Check size={14} /> : <Flame size={14} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Goals Section - Clean, modern flat card architecture */}
          <div className="together-goals-section">
            <div className="together-section-header">
              <div className="together-section-title-wrap">
                <Target size={20} className="text-emerald-500 flex-shrink-0" />
                <div>
                  <h3 className="together-section-title font-bold">Shared Pod Goals</h3>
                  <span className="together-section-hint">Collective goals with individual progress tracking</span>
                </div>
              </div>

              <div className="together-section-actions">
                <button
                  type="button"
                  className="add-shared-goal-btn"
                  onClick={() => setIsAddingGoal(!isAddingGoal)}
                >
                  <Plus size={15} />
                  <span>Add Goal</span>
                </button>
              </div>
            </div>

            {/* Modal / Inline form for Add Shared Goal */}
            {isAddingGoal && (
              <form onSubmit={handleAddGoalSubmit} className="add-shared-goal-form">
                <div className="add-goal-form-title-row">
                  <span className="font-bold text-slate-200">New Shared Pod Goal</span>
                  <button
                    type="button"
                    className="form-close-x"
                    onClick={() => setIsAddingGoal(false)}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Quick Presets Row */}
                <div className="pod-presets-row">
                  <span className="preset-label font-bold text-xs text-slate-400">Presets:</span>
                  <div className="preset-chips-scroll">
                    {POD_GOAL_PRESETS.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        className="pod-preset-pill"
                        onClick={() => {
                          sound.selection();
                          setGoalName(p.name);
                          setGoalCategory(p.category);
                          setGoalTarget(p.target);
                          setGoalUnit(p.unit);
                          setGoalDelta(p.delta);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="shared-goal-fields-grid">
                  <div className="shared-field">
                    <label className="field-lbl">Goal Name</label>
                    <input
                      type="text"
                      placeholder="e.g. 10,000 Daily Steps, 3L Water"
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      required
                      className="shared-goal-input name"
                    />
                  </div>

                  <div className="shared-field">
                    <label className="field-lbl">Category</label>
                    <select
                      value={goalCategory}
                      onChange={(e) => setGoalCategory(e.target.value)}
                      className="shared-goal-input select"
                    >
                      <option value="Fitness">Fitness</option>
                      <option value="Health">Health</option>
                      <option value="Mind">Mind</option>
                      <option value="Productivity">Productivity</option>
                      <option value="Daily">Daily</option>
                    </select>
                  </div>

                  <div className="shared-field">
                    <label className="field-lbl">Daily Target</label>
                    <input
                      type="number"
                      min="1"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(Number(e.target.value))}
                      className="shared-goal-input target"
                      required
                    />
                  </div>

                  <div className="shared-field">
                    <label className="field-lbl">Unit</label>
                    <input
                      type="text"
                      value={goalUnit}
                      onChange={(e) => setGoalUnit(e.target.value)}
                      className="shared-goal-input unit"
                      placeholder="steps, min, reps"
                      required
                    />
                  </div>

                  <div className="shared-field">
                    <label className="field-lbl">Step Increment (+/-)</label>
                    <input
                      type="number"
                      min="1"
                      value={goalDelta}
                      onChange={(e) => setGoalDelta(Number(e.target.value))}
                      className="shared-goal-input delta"
                      placeholder="e.g. 1000, 5, 1"
                      required
                    />
                  </div>
                </div>

                <div className="shared-goal-form-actions">
                  <button
                    type="button"
                    className="cancel-form-btn"
                    onClick={() => setIsAddingGoal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="shared-goal-save-btn">
                    Save Pod Goal
                  </button>
                </div>
              </form>
            )}

            {/* Shared Goals List */}
            <div className="together-goals-list">
              {(groupPod.sharedGoals || []).map((sg) => {
                const target = Number(sg.target) || 1;
                const members = groupPod.members || [];
                const memberProgressMap = sg.memberProgress || {};
                const deltaAmount = Number(sg.delta) || (sg.unit === 'steps' ? 1000 : 1);
                const isStepGoal = sg.unit === 'steps' || sg.name?.toLowerCase().includes('step');

                // Calculate completed count
                let completedCount = 0;
                members.forEach((m) => {
                  const mVal = getMemberProgressVal(memberProgressMap, m);
                  if (mVal >= target) {
                    completedCount += 1;
                  }
                });

                const isAllCompleted = members.length > 0 && completedCount === members.length;

                return (
                  <div key={sg.id} className="together-goal-card">
                    {/* Goal Header */}
                    <div className="together-goal-header">
                      <div className="together-goal-meta">
                        <span className="together-cat-pill">{sg.category || 'Shared'}</span>
                        <h4 className="together-goal-title">{sg.name}</h4>
                        <span className="together-goal-target-sub">
                          Target: <strong className="font-bold text-slate-200">{target.toLocaleString()} {sg.unit}</strong> per person
                        </span>
                      </div>

                      <div className="together-goal-top-actions">
                        <div className={`together-completion-badge ${isAllCompleted ? 'all-done' : ''}`}>
                          {completedCount === members.length ? (
                            <>
                              <CheckCircle2 size={14} className="text-emerald-400" />
                              <span className="font-bold">All {members.length} Done! 🎉</span>
                            </>
                          ) : (
                            <span className="font-bold">{completedCount} of {members.length} Done</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="together-icon-btn edit"
                          onClick={() => {
                            sound.selection();
                            setEditingGoal(sg);
                          }}
                          title="Edit goal settings"
                        >
                          <SlidersHorizontal size={14} />
                        </button>

                        <button
                          type="button"
                          className="together-icon-btn delete"
                          onClick={() => {
                            sound.warning();
                            deleteSharedGoal(sg.id);
                          }}
                          title="Delete goal"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Member List (Direct flat list, no box-in-box wrapping) */}
                    <div className="together-members-list">
                      {members.map((m) => {
                        const mId = m.id;
                        const isMe = (user?.id && String(user.id) === String(mId)) ||
                                     (user?.username && m.username && String(user.username).toLowerCase() === String(m.username).toLowerCase());
                        const mVal = getMemberProgressVal(memberProgressMap, m);
                        const isDone = mVal >= target;
                        const pct = Math.min(100, Math.round((mVal / target) * 100));

                        return (
                          <div
                            key={mId || m.username}
                            className={`together-member-row ${isDone ? 'done' : ''} ${isMe ? 'is-me' : ''}`}
                          >
                            {/* Member row top: Avatar + Name on left, Numbers + % on right */}
                            <div className="together-member-top">
                              <div className="together-member-identity">
                                <div className="together-avatar-circle">
                                  {m.profilePicture ? (
                                    <img
                                      src={m.profilePicture}
                                      alt={m.displayName || m.username}
                                      className="together-avatar-img"
                                    />
                                  ) : (
                                    <span className="together-avatar-char">
                                      {m.avatar || (m.displayName || m.username || 'U')[0].toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="together-name-box">
                                  <span className="together-member-name">
                                    {m.displayName || m.username}
                                  </span>
                                  {isMe && <span className="together-you-badge">You</span>}
                                </div>
                              </div>

                              <div className="together-member-score-box">
                                <span className="together-score-val">
                                  {mVal.toLocaleString()} <span className="together-unit">/ {target.toLocaleString()} {sg.unit}</span>
                                </span>
                                <span className={`together-pct-tag ${isDone ? 'done' : ''}`}>
                                  {pct}%
                                </span>
                              </div>
                            </div>

                            {/* Full-width sleek progress track */}
                            <div className="together-progress-track">
                              <div
                                className={`together-progress-fill ${isDone ? 'done' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            {/* Member row bottom: remaining status on left, circular check & steppers on right */}
                            <div className="together-member-bottom">
                              <div className="together-status-info">
                                {isDone ? (
                                  <span className="together-done-text">
                                    <Check size={13} strokeWidth={2.8} />
                                    <span>Goal Completed! 🎉</span>
                                  </span>
                                ) : (
                                  <span className="together-remaining-text">
                                    {target - mVal > 0 ? `${(target - mVal).toLocaleString()} ${sg.unit} remaining` : 'In progress'}
                                  </span>
                                )}
                              </div>

                              <div className="together-actions-side">
                                {isMe ? (
                                  <div className="together-user-controls">
                                    {/* Circular completion button (replaces big Mark Done button) */}
                                    <button
                                      type="button"
                                      className={`member-check-circle-btn ${isDone ? 'checked' : ''}`}
                                      onClick={() => {
                                        if (isDone) {
                                          sound.step();
                                          updateSharedGoalProgress(sg.id, 0, 0);
                                        } else {
                                          sound.complete();
                                          updateSharedGoalProgress(sg.id, 0, target);
                                        }
                                      }}
                                      title={isDone ? 'Mark Incomplete' : 'Mark Complete'}
                                      aria-label={isDone ? 'Mark Incomplete' : 'Mark Complete'}
                                    >
                                      <Check size={17} strokeWidth={2.8} />
                                    </button>

                                    {/* Compact steppers (+ / -) */}
                                    <div className="together-steppers">
                                      <button
                                        type="button"
                                        className="together-step-btn minus"
                                        onClick={() => {
                                          sound.step();
                                          updateSharedGoalProgress(sg.id, -deltaAmount);
                                        }}
                                        disabled={mVal <= 0}
                                        title={`Subtract ${deltaAmount} ${sg.unit}`}
                                      >
                                        <Minus size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        className="together-step-btn plus"
                                        onClick={() => {
                                          sound.step();
                                          updateSharedGoalProgress(sg.id, deltaAmount);
                                        }}
                                        title={`Add ${deltaAmount} ${sg.unit}`}
                                      >
                                        <Plus size={13} />
                                        <span>{deltaAmount >= 1000 ? `${deltaAmount / 1000}k` : deltaAmount}</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="cheer-member-mini-btn"
                                    onClick={() => handleCheerMember(m, sg.name)}
                                    title={`Encourage @${m.username}`}
                                  >
                                    <Flame size={13} className="text-amber-400" />
                                    <span>Encourage</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {(!groupPod.sharedGoals || groupPod.sharedGoals.length === 0) && (
                <div className="empty-shared-goals text-center py-8">
                  <Target size={36} className="text-slate-500 mx-auto mb-2 opacity-60" />
                  <p className="font-bold text-slate-300">No shared goals yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Create a team goal (e.g. 10,000 steps, daily workout) to track together in real-time!
                  </p>
                  <button
                    className="add-shared-goal-btn mx-auto mt-4"
                    onClick={() => setIsAddingGoal(true)}
                  >
                    <Plus size={14} />
                    <span>Create First Goal</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* NO GROUP POD: CREATE OR JOIN */
        <div className="no-group-pod-view">
          <div className="group-onboard-card">
            <div className="onboard-icon-bubble">
              <Users size={32} className="text-emerald-500" />
            </div>
            <h2 className="onboard-card-title font-extrabold">Track Together as a Pod</h2>
            <p className="onboard-card-desc">
              Create a group code for your squad, study group, or fitness accountability partners.
              Every member can see live progress on shared goals (up to 10 members per pod).
            </p>

            <div className="group-options-grid">
              {/* Option 1: Create a Pod */}
              <div className="group-option-box">
                <h3 className="option-title font-bold">Create a New Pod</h3>
                <p className="option-desc">Start a private pod and get a code to share with your group.</p>

                {isCreating ? (
                  <form onSubmit={handleCreate} className="create-pod-form">
                    <input
                      type="text"
                      placeholder="e.g. Morning 5AM Club"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      required
                      className="group-input-field font-semibold"
                    />
                    <div className="create-form-btns">
                      <button type="submit" className="create-pod-confirm-btn font-bold">
                        Create Pod
                      </button>
                      <button
                        type="button"
                        className="create-pod-cancel-btn font-medium"
                        onClick={() => setIsCreating(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="group-primary-btn font-bold"
                    onClick={() => setIsCreating(true)}
                  >
                    <Plus size={16} />
                    <span>Create Group Pod</span>
                  </button>
                )}
              </div>

              {/* Option 2: Join with Code */}
              <div className="group-option-box">
                <h3 className="option-title font-bold">Join an Existing Pod</h3>
                <p className="option-desc">Enter the group code shared by your pod leader.</p>

                {error && <div className="partner-error-banner">{error}</div>}

                <form onSubmit={handleJoin} className="join-pod-form">
                  <input
                    type="text"
                    placeholder="e.g. POD-8492"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="group-input-field font-mono font-bold"
                  />
                  <button
                    type="submit"
                    disabled={joinCode.trim().length < 4 || isJoining}
                    className="group-secondary-btn font-bold"
                  >
                    <span>{isJoining ? 'Joining...' : 'Join Pod'}</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shared Goal Settings Modal */}
      {editingGoal && (
        <EditSharedGoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={editSharedGoal}
          onDelete={deleteSharedGoal}
        />
      )}
    </div>
  );
};
