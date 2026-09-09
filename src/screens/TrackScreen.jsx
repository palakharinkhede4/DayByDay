import React, { useState, useMemo } from 'react';
import { useHabits, enrichPartnerHabitsWithHealthAndGroup, getCleanDailyHabits, getLocalDateKey } from '../context/HabitContext';
import { sound } from '../utils/sound';
import {
  Copy,
  Check,
  Share2,
  ArrowRight,
  Flame,
  UserCheck,
  X,
  CheckCircle2,
  Users,
  Plus,
  Zap,
  Award,
} from 'lucide-react';

export const TrackScreen = () => {
  const {
    user,
    pod,
    groupPod,
    groupPods = [],
    trackedPartner,
    trackedPartners = [],
    activeTrackedCode,
    selectTrackedPartner,
    trackPartnerByCode,
    untrackPartner,
    sendCheer,
    triggerIslandNotification,
    triggerCelebration,
  } = useHabits();

  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [cheerSent, setCheerSent] = useState(false);

  const getPartnerDisplayHabits = (p) => {
    if (!p) return [];
    const todayKey = getLocalDateKey();
    const cleanHabits = getCleanDailyHabits(p.habits || [], todayKey);
    return enrichPartnerHabitsWithHealthAndGroup(
      cleanHabits,
      p,
      p.preferences,
      groupPod,
      todayKey,
      groupPods
    );
  };

  const activePartnerHabits = useMemo(() => {
    return getPartnerDisplayHabits(trackedPartner);
  }, [trackedPartner, groupPod, groupPods]);

  const myCode = user?.secretCode || user?.secret_code || pod?.code || 'DAY-1000';

  const handleCopy = async () => {
    sound.press();
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(myCode);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    sound.press();
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Track my habits on DayByDay',
          text: `Add my secret code ${myCode} on DayByDay to track my daily progress!`,
          url: window.location.href,
        });
      } else {
        await handleCopy();
      }
    } catch {
      await handleCopy();
    }
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    setError('');
    setLoading(true);

    try {
      await trackPartnerByCode(inputCode.trim());
      sound.complete();
      setInputCode('');
      setShowAddForm(false);
      triggerCelebration();
      triggerIslandNotification('Friend added to your tracking list!', 'check');
    } catch (err) {
      sound.warning();
      setError(err.message || 'Could not find user with this code');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCheer = (customMessage) => {
    if (!trackedPartner) return;
    const partnerCode = trackedPartner.secretCode || trackedPartner.secret_code || trackedPartner.username;
    const isMe =
      (user?.id && String(trackedPartner.id) === String(user.id)) ||
      (user?.username && trackedPartner.username && String(trackedPartner.username).toLowerCase() === String(user.username).toLowerCase()) ||
      (myCode && partnerCode && String(partnerCode).toUpperCase() === String(myCode).toUpperCase());

    if (isMe) {
      triggerIslandNotification?.('You cannot cheer yourself', 'info');
      return;
    }

    sound.complete();
    const msg = customMessage || 'Keep crushing your daily goals';
    sendCheer(partnerCode, msg);
    setCheerSent(true);
    triggerCelebration();
    triggerIslandNotification(`Cheer sent to @${trackedPartner.username}`, 'check');
    setTimeout(() => setCheerSent(false), 3000);
  };

  return (
    <div className="screen-track-container">
      {/* Header Info */}
      <div className="track-header-section">
        <h1 className="screen-main-title font-extrabold">Accountability Track</h1>
        <p className="screen-subtitle">
          Follow your friends' daily habits, celebrate their consistency, and keep each other accountable.
        </p>
      </div>

      {/* Your Secret Code Box */}
      <div className="track-code-card">
        <div className="code-card-header">
          <span className="code-badge-label font-bold">YOUR SECRET CODE</span>
          <span className="code-hint">Share this with friends tracking you</span>
        </div>

        <div className="code-main-row">
          <span className="code-text font-black">{myCode}</span>
          <div className="code-actions-group">
            <button className="code-action-btn copy" onClick={handleCopy} title="Copy code">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button className="code-action-btn share" onClick={handleShare} title="Share code">
              <Share2 size={16} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tracked Partners Tabs Selector (up to 5 friends) */}
      <div className="track-partners-selector-section">
        <div className="partners-selector-header">
          <div className="partners-count-badge">
            <Users size={16} className="text-primary" />
            <span className="font-bold">Tracked Partners ({trackedPartners.length}/5)</span>
            <span className="realtime-badge" style={{ marginLeft: '0.5rem' }}>
              <span className="live-indicator-bullet"></span>
              <span>Live</span>
            </span>
          </div>
          {trackedPartners.length < 5 && !showAddForm && (
            <button
              className="add-partner-toggle-btn"
              onClick={() => setShowAddForm(true)}
              title="Track another friend"
            >
              <Plus size={14} />
              <span>Add Friend</span>
            </button>
          )}
        </div>

        {trackedPartners.length > 0 && (
          <div className="partners-chips-scroll">
            {trackedPartners.map((partner) => {
              const code = partner.secretCode || partner.secret_code;
              const isActive = (activeTrackedCode && activeTrackedCode === code) ||
                (trackedPartner && (trackedPartner.secretCode === code || trackedPartner.secret_code === code));
              const displayName = partner.displayName || partner.username || 'Friend';

              const habitsList = getPartnerDisplayHabits(partner);
              const computedPct = habitsList.length > 0
                ? Math.round(
                    habitsList.reduce((acc, h) => {
                      const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
                      if (isBool) return acc + (Boolean(h.user1) ? 100 : 0);
                      const val = Math.max(0, Number(h.user1) || 0);
                      const target = Math.max(1, Number(h.target) || 1);
                      return acc + Math.min(100, Math.round((val / target) * 100));
                    }, 0) / habitsList.length
                  )
                : (partner.todayPercent || 0);

              return (
                <button
                  key={code}
                  className={`partner-chip-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    sound.selection();
                    selectTrackedPartner(code);
                  }}
                >
                  <div className="chip-avatar">
                    {partner.profilePicture ? (
                      <img
                        src={partner.profilePicture}
                        alt={displayName}
                        className="chip-avatar-img"
                      />
                    ) : (
                      partner.avatar || displayName[0].toUpperCase()
                    )}
                  </div>
                  <div className="chip-info">
                    <span className="chip-name font-bold">{displayName}</span>
                    <span className="chip-progress-pill font-semibold">
                      {computedPct}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Partner Form (when toggled or when 0 partners tracked) */}
      {(showAddForm || trackedPartners.length === 0) && (
        <div className="enter-partner-box">
          <div className="enter-icon-circle">
            <UserCheck size={28} className="text-emerald-500" />
          </div>
          <h3 className="enter-title font-bold">
            {trackedPartners.length === 0 ? 'Track a Friend' : 'Track Another Friend'}
          </h3>
          <p className="enter-desc">
            Enter someone's secret code to follow their live daily progress (track up to 5 friends).
          </p>

          {error && <div className="partner-error-banner">{error}</div>}

          <form onSubmit={handleTrack} className="track-input-form">
            <input
              type="text"
              placeholder="e.g. PAL-4788"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              maxLength={14}
              className="track-text-input font-bold font-mono"
            />
            <button
              type="submit"
              disabled={loading || inputCode.trim().length < 4}
              className="track-submit-btn font-bold"
            >
              {loading ? 'Connecting...' : 'Track User'}
              <ArrowRight size={16} />
            </button>
          </form>

          {showAddForm && trackedPartners.length > 0 && (
            <button
              type="button"
              className="cancel-add-partner-btn"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Active Tracked Partner Details Card */}
      {trackedPartner && (
        <div className="tracked-partner-card">
          <div className="partner-card-header">
            <div className="partner-identity">
              <div className="partner-avatar-circle font-bold" style={{ overflow: 'hidden' }}>
                {trackedPartner.profilePicture ? (
                  <img
                    src={trackedPartner.profilePicture}
                    alt={trackedPartner.displayName || trackedPartner.username}
                    className="partner-avatar-img"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  trackedPartner.avatar || (trackedPartner.displayName || trackedPartner.username)[0].toUpperCase()
                )}
              </div>
              <div>
                <div className="partner-name-row">
                  <span className="partner-display font-bold">
                    {trackedPartner.displayName || trackedPartner.username}
                  </span>
                  <span className="partner-handle">@{trackedPartner.username}</span>
                </div>
                <span className="partner-status-text">
                  Code: <strong className="font-mono">{trackedPartner.secretCode || trackedPartner.secret_code}</strong> · {trackedPartner.lastActive || 'Active'}
                </span>
              </div>
            </div>

            <button
              className="partner-untrack-btn"
              onClick={() => untrackPartner(trackedPartner.secretCode || trackedPartner.secret_code)}
              title="Stop tracking this user"
            >
              <X size={16} />
              <span>Untrack</span>
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="partner-stats-grid">
            <div className="partner-stat-box">
              <span className="stat-num font-black">
                {(() => {
                  if (activePartnerHabits.length > 0) {
                    return Math.round(
                      activePartnerHabits.reduce((acc, h) => {
                        const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
                        if (isBool) return acc + (Boolean(h.user1) ? 100 : 0);
                        const val = Math.max(0, Number(h.user1) || 0);
                        const target = Math.max(1, Number(h.target) || 1);
                        return acc + Math.min(100, Math.round((val / target) * 100));
                      }, 0) / activePartnerHabits.length
                    );
                  }
                  return trackedPartner.todayPercent || 0;
                })()}%
              </span>
              <span className="stat-lbl">Today's Goals Done</span>
            </div>

            <div className="partner-stat-box">
              <div className="stat-flame-wrap">
                <Flame size={18} className="text-amber-500" />
                <span className="stat-num font-black">{trackedPartner.streak || 0}d</span>
              </div>
              <span className="stat-lbl">Active Streak</span>
            </div>
          </div>

          {/* Partner Habits List */}
          <div className="partner-habits-section">
            <h3 className="section-subheading font-bold">Daily Habit Progress</h3>
            <div className="partner-habits-list">
              {activePartnerHabits.map((h) => {
                const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
                const val = Number(h.user1) || 0;
                const target = Number(h.target) || 1;
                const isDone = isBool ? Boolean(h.user1) : val >= target;
                const pct = isBool ? (isDone ? 100 : 0) : Math.min(100, Math.round((val / target) * 100));

                return (
                  <div key={h.id} className="partner-habit-row">
                    <div className="habit-row-info">
                      <span className="habit-row-name font-semibold">{h.name}</span>
                      <span className="habit-row-meta">
                        {isBool ? (isDone ? 'Completed' : 'Not yet') : `${val} / ${target} ${h.unit || ''}`}
                      </span>
                    </div>

                    <div className="partner-row-progress-wrap">
                      <div className="partner-row-bar">
                        <div className="partner-row-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="partner-pct font-bold">{pct}%</span>
                      {isDone && <CheckCircle2 size={16} className="text-emerald-500 ml-1" />}
                    </div>
                  </div>
                );
              })}
              {activePartnerHabits.length === 0 && (
                <div className="no-partner-habits font-medium text-slate-400 py-3 text-center">
                  This user hasn't created any daily habits yet.
                </div>
              )}
            </div>
          </div>

          {/* Encouragement / Cheer Feature (Only for other users, not oneself) */}
          {!((user?.id && String(trackedPartner.id) === String(user.id)) ||
             (user?.username && trackedPartner.username && String(trackedPartner.username).toLowerCase() === String(user.username).toLowerCase()) ||
             (myCode && (trackedPartner.secretCode || trackedPartner.secret_code) && String(trackedPartner.secretCode || trackedPartner.secret_code).toUpperCase() === String(myCode).toUpperCase())) && (
            <div className="partner-cheer-section">
              <div className="cheer-title-row">
                <Flame size={16} className="text-amber-400" />
                <span className="cheer-title font-bold">Send Daily Encouragement</span>
              </div>

              <div className="cheer-presets-row">
                <button
                  type="button"
                  className="cheer-preset-chip"
                  onClick={() => handleSendCheer('Keep crushing your daily streak')}
                >
                  <Flame size={14} className="text-amber-400" />
                  <span>Keep Crushing It</span>
                </button>
                <button
                  type="button"
                  className="cheer-preset-chip"
                  onClick={() => handleSendCheer('Proud of your consistency')}
                >
                  <Award size={14} className="text-indigo-400" />
                  <span>Proud of You</span>
                </button>
                <button
                  type="button"
                  className="cheer-preset-chip"
                  onClick={() => handleSendCheer('Almost there, finish strong today')}
                >
                  <Zap size={14} className="text-emerald-400" />
                  <span>Finish Strong</span>
                </button>
              </div>

              <button
                type="button"
                className={`partner-nudge-btn cheer-btn ${cheerSent ? 'sent' : ''}`}
                onClick={() => handleSendCheer()}
              >
                {cheerSent ? (
                  <>
                    <Check size={18} className="text-emerald-400" />
                    <span className="font-bold">Cheer Sent</span>
                  </>
                ) : (
                  <>
                    <Flame size={18} className="text-amber-300" />
                    <span className="font-bold">Cheer On @{trackedPartner.displayName || trackedPartner.username}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
