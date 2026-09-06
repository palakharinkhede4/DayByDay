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
  } = useHabits();

  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState(10);
  const [goalUnit, setGoalUnit] = useState('reps');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

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

  const handleAddGoalSubmit = (e) => {
    e.preventDefault();
    if (!goalName.trim()) return;
    addSharedGoal(goalName.trim(), goalTarget, goalUnit);
    setGoalName('');
    setIsAddingGoal(false);
  };

  return (
    <div className="screen-together-container">
      {/* Header */}
      <div className="together-header-section">
        <h1 className="screen-main-title font-extrabold">Group Pods & Shared Goals</h1>
        <p className="screen-subtitle">
          Track shared habits with friends, family, or teammates. Groups support up to 10 members.
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
                Members Roster ({groupPod.members?.length || 1} / 10)
              </h3>
              <span className="group-section-hint">Live daily completion</span>
            </div>

            <div className="group-members-grid">
              {(groupPod.members || []).map((m, idx) => (
                <div key={m.id || idx} className="group-member-card">
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
                </div>
              ))}
            </div>
          </div>

          {/* Shared Goals */}
          <div className="group-section-box">
            <div className="group-section-header">
              <div className="shared-goal-title-wrap">
                <Target size={18} className="text-emerald-500" />
                <h3 className="group-section-title font-bold">Shared Group Goals</h3>
              </div>
              <button
                className="add-shared-goal-btn"
                onClick={() => setIsAddingGoal(!isAddingGoal)}
              >
                <Plus size={15} />
                <span>Add Shared Goal</span>
              </button>
            </div>

            {isAddingGoal && (
              <form onSubmit={handleAddGoalSubmit} className="add-shared-goal-form">
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Goal name (e.g. 10k Steps, Hydration)"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    required
                    className="shared-goal-input name"
                  />
                  <input
                    type="number"
                    min="1"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(Number(e.target.value))}
                    className="shared-goal-input target"
                    placeholder="Target"
                  />
                  <input
                    type="text"
                    value={goalUnit}
                    onChange={(e) => setGoalUnit(e.target.value)}
                    className="shared-goal-input unit"
                    placeholder="Unit"
                  />
                  <button type="submit" className="shared-goal-save-btn">
                    Save
                  </button>
                </div>
              </form>
            )}

            <div className="shared-goals-list">
              {(groupPod.sharedGoals || []).map((sg) => {
                const current = sg.current || 0;
                const target = sg.target || 1;
                const pct = Math.min(100, Math.round((current / target) * 100));

                return (
                  <div key={sg.id} className="shared-goal-card">
                    <div className="shared-goal-header">
                      <div className="shared-goal-name font-bold">{sg.name}</div>
                      <div className="shared-goal-meta font-semibold">
                        {current} / {target} {sg.unit} ({pct}%)
                      </div>
                    </div>

                    <div className="shared-goal-bar">
                      <div className="shared-goal-fill" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="shared-goal-actions">
                      <span className="goal-action-hint">Log your contribution:</span>
                      <div className="goal-steppers">
                        <button
                          className="mini-step-btn"
                          onClick={() => updateSharedGoalProgress(sg.id, -1)}
                          disabled={current <= 0}
                        >
                          -1
                        </button>
                        <button
                          className="mini-step-btn plus"
                          onClick={() => updateSharedGoalProgress(sg.id, 1)}
                        >
                          +1 {sg.unit}
                        </button>
                        <button
                          className="mini-step-btn bulk"
                          onClick={() => updateSharedGoalProgress(sg.id, sg.unit === 'steps' ? 1000 : 5)}
                        >
                          +{sg.unit === 'steps' ? '1k' : '5'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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
