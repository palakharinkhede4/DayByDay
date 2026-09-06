import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
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
} from 'lucide-react';

export const TogetherScreen = () => {
  const {
    user,
    groupPod,
    createGroupPod,
    joinGroupPod,
    leaveGroupPod,
    addSharedGoal,
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
                  const mVal = Number(memberProgressMap[m.id]) || 0;
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
                          className="delete-shared-goal-btn"
                          onClick={() => deleteSharedGoal(sg.id)}
                          title="Delete this shared goal"
                        >
                          <Trash2 size={15} />
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
                        const isMe = user?.id && String(user.id) === String(mId);
                        const mVal = Number(memberProgressMap[mId]) || 0;
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
                                <div className="member-steppers-group">
                                  <button
                                    className="member-step-btn minus"
                                    onClick={() => updateSharedGoalProgress(sg.id, -deltaAmount)}
                                    disabled={mVal <= 0}
                                    title={`Subtract ${deltaAmount} ${sg.unit}`}
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <button
                                    className="member-step-btn plus font-bold"
                                    onClick={() => updateSharedGoalProgress(sg.id, deltaAmount)}
                                    title={`Add ${deltaAmount} ${sg.unit}`}
                                  >
                                    <Plus size={12} />
                                    <span>{deltaAmount >= 1000 ? `${deltaAmount / 1000}k` : deltaAmount}</span>
                                  </button>
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
    </div>
  );
};
