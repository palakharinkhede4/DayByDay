import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import {
  Users,
  Key,
  Copy,
  Check,
  LogOut,
  Moon,
  Sun,
  Laptop,
  Palette,
  Zap,
  Target,
  Sparkles,
  ListChecks,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';

export const SettingsScreen = ({ onOpenPairing, onOpenAddGoal }) => {
  const {
    user,
    partner,
    isSolo,
    unpairPartner,
    pod,
    themeColor,
    setThemeColor,
    themeMode,
    setThemeMode,
    habits,
    removeGoal,
    exportData,
    resetAllData,
    logoutUser,
    activeFocusHabit,
    activeFocusHabitId,
    setActiveFocusHabitId,
    liveActivityEnabled,
    setLiveActivityEnabled,
    triggerIslandNotification,
  } = useHabits();

  const [copiedCode, setCopiedCode] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleCopyCode = async () => {
    const code = user?.secretCode || pod.code || '';
    if (!code) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
    } catch {}
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const themeOptions = [
    { id: 'emerald', label: 'Mint & Coral', c1: '#10B981', c2: '#F43F5E' },
    { id: 'ocean', label: 'Cyan & Amber', c1: '#06B6D4', c2: '#F59E0B' },
    { id: 'violet', label: 'Violet & Emerald', c1: '#8B5CF6', c2: '#10B981' },
    { id: 'sunset', label: 'Sunset & Pink', c1: '#F97316', c2: '#EC4899' },
  ];

  const userInitial = (user?.displayName || user?.username || 'U')[0].toUpperCase();

  return (
    <div className="screen-settings-container">
      {/* Top Title */}
      <div className="settings-header">
        <h1 className="settings-main-title font-extrabold">Settings</h1>
      </div>

      {/* USER PROFILE CARD */}
      <div className="profile-card">
        <div className="profile-avatar-circle font-extrabold">
          <span>{userInitial}</span>
        </div>
        <div className="profile-info">
          <h2 className="profile-name font-bold">
            {user ? (user.displayName || `@${user.username}`) : 'Anonymous User'}
          </h2>
          <span className="profile-email font-mono">
            {user ? `@${user.username}` : 'No username set'}
          </span>
        </div>
        {user && (
          <div className="profile-actions-row">
            <button
              className="signout-profile-btn font-medium"
              onClick={logoutUser}
              title="Sign Out / Switch Account"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* PROMINENT SECRET CODE CARD */}
      {user && (
        <div className="secret-code-settings-card">
          <div className="code-card-left">
            <span className="code-card-title font-bold">Your Secret Code</span>
            <p className="code-card-hint">
              Share this code with a partner in the Track tab or add friends to your Together pod.
            </p>
            <span className="code-card-val font-mono font-black">{user.secretCode}</span>
          </div>
          <button className="code-card-copy-btn font-bold" onClick={handleCopyCode}>
            {copiedCode ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
      )}

      {/* SECTION: PAIRED PARTNER (Shows only when actively paired) */}
      {!isSolo && (
        <div className="settings-group">
          <span className="group-label">PAIRED ACCOUNTABILITY</span>
          <div className="settings-group-content">
            <div className="settings-row-item">
              <div className="row-left">
                <Users size={18} className="text-emerald-500" />
                <div>
                  <span className="row-title">Paired Partner</span>
                  <span className="row-hint">Active 1-on-1 accountability pod</span>
                </div>
              </div>
              <span className="row-value font-bold">@{partner?.username || 'partner'}</span>
            </div>

            <div
              className="settings-row-item clickable danger-row"
              onClick={() => setShowLeaveConfirm(true)}
            >
              <div className="row-left">
                <LogOut size={18} className="danger-text" />
                <span className="row-title danger-text">Disconnect from Partner</span>
              </div>
              <ChevronRight size={18} className="danger-text" />
            </div>
          </div>
        </div>
      )}

      {/* LEAVE POD CONFIRMATION MODAL */}
      {showLeaveConfirm && (
        <div className="inline-confirm-card">
          <p className="confirm-title">Disconnect from Partner?</p>
          <p className="confirm-desc">
            You will return to solo tracking. You can reconnect anytime in the Track tab.
          </p>
          <div className="confirm-btn-row">
            <button className="confirm-btn cancel" onClick={() => setShowLeaveConfirm(false)}>
              Cancel
            </button>
            <button
              className="confirm-btn danger"
              onClick={() => {
                unpairPartner();
                setShowLeaveConfirm(false);
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* SECTION: APPEARANCE & THEMES */}
      <div className="settings-group">
        <span className="group-label">APPEARANCE & THEME</span>
        <div className="settings-group-content">
          {/* THEME MODE: LIGHT / DARK / AUTO */}
          <div className="settings-row-item">
            <div className="row-left">
              <Moon size={18} className="text-indigo-400" />
              <div>
                <span className="row-title">Color Mode</span>
                <span className="row-hint">Light, Dark, or System Auto</span>
              </div>
            </div>
            <div className="theme-mode-pills">
              <button
                className={`mode-pill-btn ${themeMode === 'light' ? 'active' : ''}`}
                onClick={() => setThemeMode('light')}
              >
                <Sun size={13} />
                <span>Light</span>
              </button>
              <button
                className={`mode-pill-btn ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => setThemeMode('dark')}
              >
                <Moon size={13} />
                <span>Dark</span>
              </button>
              <button
                className={`mode-pill-btn ${themeMode === 'auto' ? 'active' : ''}`}
                onClick={() => setThemeMode('auto')}
              >
                <Laptop size={13} />
                <span>System</span>
              </button>
            </div>
          </div>

          {/* COLOR SWATCH ACCENTS */}
          <div className="settings-row-item">
            <div className="row-left">
              <Palette size={18} className="text-purple-400" />
              <span className="row-title">Accent Palette</span>
            </div>
            <div className="color-swatch-picker">
              {themeOptions.map((t) => (
                <button
                  key={t.id}
                  className={`swatch-btn ${themeColor === t.id ? 'active' : ''}`}
                  onClick={() => setThemeColor(t.id)}
                  title={t.label}
                >
                  <span className="swatch-half" style={{ background: t.c1 }}></span>
                  <span className="swatch-half" style={{ background: t.c2 }}></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: LIVE ACTIVITIES & DYNAMIC ISLAND */}
      <div className="settings-group">
        <span className="group-label">LIVE NOTIFICATIONS & FOCUS</span>
        <div className="settings-group-content">
          {/* Main Toggle */}
          <div className="settings-row-item">
            <div className="row-left">
              <Zap size={18} className="text-amber-400" />
              <div>
                <span className="row-title">Live Updates & Dynamic HUD</span>
                <span className="row-hint">Real-time status banner for active habits</span>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={liveActivityEnabled}
                onChange={(e) => {
                  setLiveActivityEnabled(e.target.checked);
                  triggerIslandNotification(
                    e.target.checked ? 'Live Updates Active' : 'Live Updates Paused',
                    'zap'
                  );
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Focus Habit Selector */}
          {liveActivityEnabled && (
            <div className="settings-row-item">
              <div className="row-left">
                <Target size={18} className="text-rose-400" />
                <div>
                  <span className="row-title">Active Focus Habit</span>
                  <span className="row-hint">
                    {activeFocusHabitId ? `Pinned: ${activeFocusHabit?.name}` : 'Auto: Next pending habit'}
                  </span>
                </div>
              </div>
              <select
                className="focus-habit-select"
                value={activeFocusHabitId}
                onChange={(e) => setActiveFocusHabitId(e.target.value)}
              >
                <option value="">Auto (Next Pending Habit)</option>
                {habits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.target} {h.unit})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Test Island Pulse */}
          <div
            className="settings-row-item clickable"
            onClick={() => triggerIslandNotification('Dynamic HUD Test: Active consistency streak', 'sparkles')}
          >
            <div className="row-left">
              <Sparkles size={18} className="text-emerald-400" />
              <div>
                <span className="row-title">Preview Notification Animation</span>
                <span className="row-hint">Tap to preview dynamic celebration banner</span>
              </div>
            </div>
            <ChevronRight size={18} />
          </div>
        </div>
      </div>

      {/* SECTION: GOALS */}
      <div className="settings-group">
        <span className="group-label">HABIT CONFIGURATION</span>
        <div className="settings-group-content">
          <div
            className="settings-row-item clickable"
            onClick={() => setEditingGoals((prev) => !prev)}
          >
            <div className="row-left">
              <ListChecks size={18} className="text-cyan-400" />
              <span className="row-title">Manage Tracked Habits</span>
            </div>
            {editingGoals ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>

          {editingGoals && (
            <div className="goals-editor-list">
              {habits.map((h) => (
                <div key={h.id} className="goal-editor-row">
                  <span className="goal-row-name">
                    {h.name} ({h.target} {h.unit})
                  </span>
                  <button
                    className="goal-delete-btn"
                    onClick={() => removeGoal(h.id)}
                    title="Remove goal"
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                </div>
              ))}
              <button className="add-goal-mini-btn font-bold" onClick={onOpenAddGoal}>
                <Plus size={14} />
                <span>Add New Habit</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: DATA BACKUP & WIPE */}
      <div className="settings-group">
        <span className="group-label">PRIVACY & VAULT</span>
        <div className="settings-group-content">
          <div className="settings-row-item clickable" onClick={exportData}>
            <div className="row-left">
              <Download size={18} className="text-blue-400" />
              <div>
                <span className="row-title">Export Backup (JSON)</span>
                <span className="row-hint">Download encrypted local backup to your device</span>
              </div>
            </div>
            <ChevronRight size={18} />
          </div>

          <div
            className="settings-row-item clickable danger-row"
            onClick={() => setShowResetConfirm(true)}
          >
            <div className="row-left">
              <Trash2 size={18} className="danger-text" />
              <div>
                <span className="row-title danger-text">Wipe Data & Sign Out</span>
                <span className="row-hint">Permanently delete stored habits and local vault credentials</span>
              </div>
            </div>
            <ChevronRight size={18} className="danger-text" />
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div className="inline-confirm-card">
          <p className="confirm-title">Permanently Erase All Data?</p>
          <p className="confirm-desc">
            This will wipe your local habits, secret codes, and sign you out.
          </p>
          <div className="confirm-btn-row">
            <button className="confirm-btn cancel" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </button>
            <button
              className="confirm-btn danger"
              onClick={() => {
                resetAllData();
                setShowResetConfirm(false);
              }}
            >
              Confirm Wipe
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
