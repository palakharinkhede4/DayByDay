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
      <div className="habit-modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="habit-modal-header">
          <div className="habit-modal-title-group">
            <h2 className="habit-modal-title font-extrabold">Pod Goal Settings</h2>
            <p className="habit-modal-subtitle">Update target, units, or step increments for all pod members.</p>
          </div>
          <button className="habit-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="habit-modal-form">
          <div className="modal-field-group">
            <label className="modal-field-label">Goal Name</label>
            <input
              type="text"
              className="modal-text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="modal-field-group">
            <label className="modal-field-label">Category</label>
            <select
              className="modal-select-input"
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

          <div className="modal-two-col-grid">
            <div className="modal-field-group">
              <label className="modal-field-label">Target per Person</label>
              <input
                type="number"
                min="1"
                className="modal-text-input"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                required
              />
            </div>

            <div className="modal-field-group">
              <label className="modal-field-label">Unit</label>
              <input
                type="text"
                className="modal-text-input"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-field-group">
            <label className="modal-field-label">Step Increment (+ / -)</label>
            <input
              type="number"
              min="1"
              className="modal-text-input"
              value={delta}
              onChange={(e) => setDelta(Number(e.target.value))}
              required
            />
          </div>

          <div className="modal-actions-footer">
            {showDeleteConfirm ? (
              <div className="modal-delete-confirm-row">
                <span className="confirm-delete-warning font-bold text-rose-400 text-xs">
                  Remove this goal for all pod members?
                </span>
                <div className="confirm-btns-wrap">
                  <button
                    type="button"
                    className="confirm-cancel-sm-btn"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="confirm-delete-sm-btn"
                    onClick={() => {
                      onDelete(goal.id);
                      onClose();
                    }}
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-btns-standard-row">
                <button
                  type="button"
                  className="modal-delete-btn"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} />
                  <span>Delete Goal</span>
                </button>
                <div className="modal-right-btns">
                  <button type="button" className="modal-cancel-btn" onClick={onClose}>
                    Cancel
                  </button>
                  <button type="submit" className="modal-save-btn">
                    Save Changes
                  </button>
                </div>
              </div>
            )}
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

  const handleCheerMember = (member) => {
    const code = member.secretCode || member.secret_code || member.username;
    sendCheer(code, 'Crushing it in the pod! 🔥');
    setCheeredMemberId(member.id || member.username);
    triggerCelebration();
    triggerIslandNotification(`Cheer sent to @${member.username}! 🚀`, 'check');
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
          <div className="group-section-box">
            <div className="group-section-header">
              <h3 className="group-section-title font-bold">
                Pod Members ({groupPod.members?.length || 1} / 10)
              </h3>
              <span className="group-section-hint">Tap flame to cheer teammate</span>
            </div>

            <div className="group-members-grid">
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
                        {m.displayName || m.username}
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

          {/* Shared Goals Section */}
          <div className="group-section-box">
            <div className="group-section-header">
              <div className="shared-goal-title-wrap">
                <Target size={18} className="text-emerald-500" />
                <div>
                  <h3 className="group-section-title font-bold">Shared Pod Goals</h3>
                  <span className="group-section-hint">Goals tracked collectively with individual breakdowns</span>
                </div>
              </div>
              <button
                className="add-shared-goal-btn"
                onClick={() => setIsAddingGoal(!isAddingGoal)}
              >
                <Plus size={15} />
                <span>Add Goal</span>
              </button>
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
            <div className="shared-goals-list">
              {(groupPod.sharedGoals || []).map((sg) => {
                const target = Number(sg.target) || 1;
                const members = groupPod.members || [];
                const memberProgressMap = sg.memberProgress || {};
                const deltaAmount = Number(sg.delta) || (sg.unit === 'steps' ? 1000 : 1);

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
                  <div key={sg.id} className="shared-goal-card modern-group-goal">
                    {/* Goal Header */}
                    <div className="shared-goal-header-row">
                      <div className="shared-goal-name-wrap">
                        <span className="goal-category-tag font-bold">{sg.category || 'Shared'}</span>
                        <h4 className="shared-goal-title font-black">{sg.name}</h4>
                        <span className="shared-goal-target-sub">
                          Target: <strong className="text-slate-200">{target} {sg.unit}</strong> per person
                        </span>
                      </div>

                      <div className="goal-header-right">
                        <div className={`goal-completion-badge ${isAllCompleted ? 'all-done' : ''}`}>
                          {completedCount === members.length ? (
                            <>
                              <CheckCircle2 size={15} className="text-emerald-400" />
                              <span className="font-bold">All {members.length} Completed! 🎉</span>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-amber-400">{completedCount} of {members.length} Completed</span>
                            </>
                          )}
                        </div>

                        <button
                          className="edit-shared-goal-btn"
                          onClick={() => {
                            sound.selection();
                            setEditingGoal(sg);
                          }}
                          title="Edit goal settings"
                        >
                          <SlidersHorizontal size={14} />
                        </button>

                        <button
                          className="delete-shared-goal-btn"
                          onClick={() => {
                            sound.warning();
                            deleteSharedGoal(sg.id);
                          }}
                          title="Delete this shared goal"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Individual Members Progress Breakdown (Stacked one below other) */}
                    <div className="members-goal-breakdown">
                      <div className="breakdown-header-label font-bold text-xs uppercase tracking-wider text-slate-400 mb-1">
                        Individual Member Progress:
                      </div>

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
                            className={`member-progress-row ${isDone ? 'member-completed' : ''} ${isMe ? 'current-user-row' : ''}`}
                          >
                            {/* Member Identity & Profile Picture */}
                            <div className="member-avatar-box">
                              {m.profilePicture ? (
                                <img
                                  src={m.profilePicture}
                                  alt={m.displayName || m.username}
                                  className="member-mini-avatar-img"
                                />
                              ) : (
                                <div className="member-avatar-initials font-bold">
                                  {m.avatar || (m.displayName || m.username || 'U')[0].toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="member-progress-details">
                              <div className="member-progress-label-row">
                                <span className="member-row-name font-bold">
                                  {m.displayName || m.username}
                                  {isMe && <span className="you-mini-tag">You</span>}
                                </span>
                                <div className="member-row-values font-semibold">
                                  <span>{mVal} / {target} {sg.unit}</span>
                                  <span className="member-pct-tag font-bold">({pct}%)</span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="member-progress-track">
                                <div
                                  className={`member-progress-fill ${isDone ? 'done' : ''}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Status badge & Stepper if it's the current user */}
                            <div className="member-row-status-actions">
                              {isDone ? (
                                <div className="completed-pill font-bold">
                                  <Check size={13} />
                                  <span>Done</span>
                                </div>
                              ) : (
                                <div className="in-progress-pill font-bold">
                                  <span>{pct}%</span>
                                </div>
                              )}

                              {isMe && (
                                <div className="member-actions-combo">
                                  {/* 1-tap completion check button */}
                                  <button
                                    className={`member-check-toggle-btn ${isDone ? 'checked' : ''}`}
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
                                  >
                                    <Check size={13} strokeWidth={2.8} />
                                  </button>

                                  {/* Steppers */}
                                  <div className="member-steppers-group">
                                    <button
                                      className="member-step-btn minus"
                                      onClick={() => {
                                        sound.step();
                                        updateSharedGoalProgress(sg.id, -deltaAmount);
                                      }}
                                      disabled={mVal <= 0}
                                      title={`Subtract ${deltaAmount} ${sg.unit}`}
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <button
                                      className="member-step-btn plus font-bold"
                                      onClick={() => {
                                        sound.step();
                                        updateSharedGoalProgress(sg.id, deltaAmount);
                                      }}
                                      title={`Add ${deltaAmount} ${sg.unit}`}
                                    >
                                      <Plus size={12} />
                                      <span>{deltaAmount >= 1000 ? `${deltaAmount / 1000}k` : deltaAmount}</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {!isMe && (
                                <button
                                  className="cheer-member-mini-btn"
                                  onClick={() => handleCheerMember(m)}
                                  title={`Cheer @${m.username}`}
                                >
                                  <Flame size={14} className="text-amber-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {(!groupPod.sharedGoals || groupPod.sharedGoals.length === 0) && (
                <div className="empty-shared-goals text-center py-6">
                  <Target size={32} className="text-slate-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-300">No shared goals created yet</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Create a group goal (e.g. 10,000 steps, daily meditation) so all pod members can track it simultaneously!
                  </p>
                  <button
                    className="add-shared-goal-btn mx-auto mt-3"
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
