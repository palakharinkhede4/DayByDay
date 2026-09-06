import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Copy,
  Check,
  Share2,
  ArrowRight,
  Flame,
  UserCheck,
  Sparkles,
  X,
  Target,
  CheckCircle2,
} from 'lucide-react';

export const TrackScreen = () => {
  const {
    user,
    pod,
    trackedPartner,
    trackPartnerByCode,
    untrackPartner,
    triggerIslandNotification,
    triggerCelebration,
  } = useHabits();

  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const myCode = user?.secretCode || pod?.code || 'DAY-1000';

  const handleCopy = async () => {
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
      setInputCode('');
    } catch (err) {
      setError(err.message || 'Could not find user with this code');
    } finally {
      setLoading(false);
    }
  };

  const handleSendNudge = () => {
    triggerCelebration();
    triggerIslandNotification(`High-five sent to @${trackedPartner.username}!`, 'check');
  };

  return (
    <div className="screen-track-container">
      {/* Header Info */}
      <div className="track-header-section">
        <h1 className="screen-main-title font-extrabold">Accountability Track</h1>
        <p className="screen-subtitle">
          Follow a friend's daily habits, celebrate their consistency, and keep each other accountable.
        </p>
      </div>

      {/* Your Secret Code Box */}
      <div className="track-code-card">
        <div className="code-card-header">
          <span className="code-badge-label font-bold">YOUR SECRET CODE</span>
          <span className="code-hint">Share this with anyone tracking you</span>
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

      {/* Tracked Partner Card (if connected) */}
      {trackedPartner ? (
        <div className="tracked-partner-card">
          <div className="partner-card-header">
            <div className="partner-identity">
              <div className="partner-avatar-circle font-bold">
                {trackedPartner.avatar || (trackedPartner.displayName || trackedPartner.username)[0].toUpperCase()}
              </div>
              <div>
                <div className="partner-name-row">
                  <span className="partner-display font-bold">
                    {trackedPartner.displayName || trackedPartner.username}
                  </span>
                  <span className="partner-handle">@{trackedPartner.username}</span>
                </div>
                <span className="partner-status-text">
                  Code: <strong className="font-mono">{trackedPartner.secretCode}</strong> · {trackedPartner.lastActive || 'Active'}
                </span>
              </div>
            </div>

            <button
              className="partner-untrack-btn"
              onClick={untrackPartner}
              title="Stop tracking this user"
            >
              <X size={16} />
              <span>Untrack</span>
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="partner-stats-grid">
            <div className="partner-stat-box">
              <span className="stat-num font-black">{trackedPartner.todayPercent || 0}%</span>
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
              {(trackedPartner.habits || []).map((h) => {
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
                        {isBool ? (isDone ? 'Done' : 'Not yet') : `${val} / ${target} ${h.unit || ''}`}
                      </span>
                    </div>

                    <div className="partner-row-progress-wrap">
                      <div className="partner-row-bar">
                        <div className="partner-row-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="partner-pct font-bold">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cheer / Nudge Action */}
          <button className="partner-nudge-btn" onClick={handleSendNudge}>
            <Sparkles size={18} />
            <span className="font-bold">Send High-Five & Encouragement</span>
          </button>
        </div>
      ) : (
        /* Empty / Enter Code Form */
        <div className="enter-partner-box">
          <div className="enter-icon-circle">
            <UserCheck size={28} className="text-emerald-500" />
          </div>
          <h3 className="enter-title font-bold">Track a Friend</h3>
          <p className="enter-desc">
            Enter someone's secret code to follow their live habit completion and keep them on track.
          </p>

          {error && <div className="partner-error-banner">{error}</div>}

          <form onSubmit={handleTrack} className="track-input-form">
            <input
              type="text"
              placeholder="e.g. PAL-4788"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              maxLength={12}
              className="track-text-input font-bold"
            />
            <button
              type="submit"
              disabled={loading || inputCode.trim().length < 4}
              className="track-submit-btn font-bold"
            >
              {loading ? 'Finding...' : 'Track User'}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
