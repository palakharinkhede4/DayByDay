import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import { checkApiHealth } from '../utils/api';

export const SettingsScreen = ({ onOpenPairing, onOpenAddGoal }) => {
  const {
    user,
    partner,
    isSolo,
    pairWithPartner,
    unpairPartner,
    pod,
    themeColor,
    setThemeColor,
    themeMode,
    setThemeMode,
    osMode,
    setOsMode,
    habits,
    removeGoal,
    exportData,
    resetAllData,
    requestNotificationPermission,
    serverUrl,
    setServerUrl,
    syncStatus,
    syncWithCloud,
    logoutUser,
  } = useHabits();

  const [copiedCode, setCopiedCode] = useState(false);
  const [gentleNotifications, setGentleNotifications] = useState(true);
  const [editingGoals, setEditingGoals] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showNeonGuide, setShowNeonGuide] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState(null);

  const [customServerUrl, setCustomServerUrl] = useState(serverUrl || '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);

  const handleCopyCode = () => {
    const code = user?.secretCode || pod.code;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handlePairSubmit = async (e) => {
    e.preventDefault();
    if (!partnerCodeInput.trim()) return;
    setPairingLoading(true);
    setPairingError(null);
    try {
      await pairWithPartner(partnerCodeInput.trim().toUpperCase());
      setPartnerCodeInput('');
    } catch (err) {
      setPairingError(err.message || 'Could not pair with this code');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    const res = await checkApiHealth(customServerUrl);
    setConnectionTestResult(res);
    setTestingConnection(false);
    if (res.ok) {
      setServerUrl(customServerUrl);
      syncWithCloud();
    }
  };

  const themeOptions = [
    { id: 'emerald', label: 'Mint & Coral', c1: '#10B981', c2: '#F43F5E' },
    { id: 'ocean', label: 'Cyan & Amber', c1: '#06B6D4', c2: '#F59E0B' },
    { id: 'violet', label: 'Violet & Emerald', c1: '#8B5CF6', c2: '#10B981' },
    { id: 'sunset', label: 'Sunset & Pink', c1: '#F97316', c2: '#EC4899' },
  ];

  return (
    <div className="screen-settings-container">
      {/* Top Title */}
      <div className="settings-header">
        <h1 className="settings-main-title">Settings</h1>
      </div>

      {/* USER PROFILE CARD */}
      <div className="profile-card">
        <div className="profile-avatar-circle">
          <span>{user?.avatar || '🌱'}</span>
        </div>
        <div className="profile-info">
          <h2 className="profile-name font-bold">
            {user ? (user.displayName || `@${user.username}`) : 'Anonymous User'}
          </h2>
          <span className="profile-email">
            {user ? `@${user.username}` : 'No username set'}
          </span>
        </div>
        {user && (
          <div className="profile-actions-row">
            <button className="copy-secret-chip" onClick={handleCopyCode}>
              <span>Code: {user.secretCode}</span>
              <span className="chip-copy-txt">{copiedCode ? 'Copied! ✓' : 'Copy'}</span>
            </button>
            <button className="signout-profile-btn" onClick={logoutUser} title="Sign Out / Switch Account">
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* SECTION: ACCOUNTABILITY / PARTNER */}
      <div className="settings-group">
        <span className="group-label">ACCOUNTABILITY & PAIRING</span>
        <div className="settings-group-content">
          {!isSolo ? (
            <>
              <div className="settings-row-item">
                <div className="row-left">
                  <span className="row-icon">👥</span>
                  <div>
                    <span className="row-title">Paired Partner</span>
                    <span className="row-hint">Tracking together in a shared Pod</span>
                  </div>
                </div>
                <span className="row-value font-bold">@{partner?.username || 'partner'}</span>
              </div>

              <div className="settings-row-item">
                <div className="row-left">
                  <span className="row-icon">🔑</span>
                  <div>
                    <span className="row-title">Your Secret Code</span>
                    <span className="row-hint">Share with others to let them track your progress</span>
                  </div>
                </div>
                <button className="mini-copy-btn" onClick={handleCopyCode}>
                  {user?.secretCode} {copiedCode ? '✓' : '📋'}
                </button>
              </div>

              <div
                className="settings-row-item clickable danger-row"
                onClick={() => setShowLeaveConfirm(true)}
              >
                <div className="row-left">
                  <span className="row-icon">🚪</span>
                  <span className="row-title danger-text">Switch to Solo Tracking</span>
                </div>
                <span className="row-arrow danger-text">›</span>
              </div>
            </>
          ) : (
            <div className="solo-pairing-box">
              <div className="solo-info-row">
                <span className="row-icon">👤</span>
                <div>
                  <span className="solo-title font-bold">Solo Tracking Active</span>
                  <p className="solo-desc">
                    You are tracking your personal habits independently. Want a partner or friend to keep an eye on you?
                  </p>
                </div>
              </div>

              <div className="my-code-banner">
                <span className="code-label">Your Secret Sharing Code:</span>
                <div className="code-row-copy">
                  <span className="my-secret-val font-bold">{user?.secretCode || 'DUO-1000'}</span>
                  <button className="code-copy-btn" onClick={handleCopyCode}>
                    {copiedCode ? 'Copied! ✓' : 'Share Code 🔗'}
                  </button>
                </div>
                <span className="code-sub">Anyone with this code can connect to view or sync your progress.</span>
              </div>

              <form onSubmit={handlePairSubmit} className="pair-partner-form">
                <label className="pair-form-label">Enter a Friend's Secret Code:</label>
                <div className="pair-input-group">
                  <input
                    type="text"
                    placeholder="e.g. ALEX-4821"
                    value={partnerCodeInput}
                    onChange={(e) => setPartnerCodeInput(e.target.value.toUpperCase())}
                    maxLength={12}
                    className="pair-code-input font-bold"
                  />
                  <button
                    type="submit"
                    disabled={pairingLoading || partnerCodeInput.trim().length < 4}
                    className="pair-submit-btn"
                  >
                    {pairingLoading ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
                {pairingError && <span className="pair-error-text">⚠️ {pairingError}</span>}
              </form>
            </div>
          )}
        </div>
      </div>

      {/* LEAVE POD CONFIRMATION MODAL */}
      {showLeaveConfirm && (
        <div className="inline-confirm-card">
          <p className="confirm-title">Return to Solo Mode?</p>
          <p className="confirm-desc">
            You will disconnect from @{partner?.username}. You can pair back anytime by entering their secret code.
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
              Confirm Solo Mode
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
              <span className="row-icon">🌓</span>
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
                ☀️ Light
              </button>
              <button
                className={`mode-pill-btn ${themeMode === 'dark' ? 'active' : ''}`}
                onClick={() => setThemeMode('dark')}
              >
                🌙 Dark
              </button>
              <button
                className={`mode-pill-btn ${themeMode === 'auto' ? 'active' : ''}`}
                onClick={() => setThemeMode('auto')}
              >
                ⚙️ Auto
              </button>
            </div>
          </div>

          {/* OS ENGINE TOGGLE */}
          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">📱</span>
              <div>
                <span className="row-title">UI Style Engine</span>
                <span className="row-hint">Material 3 Expressive vs iOS Liquid Glass</span>
              </div>
            </div>
            <div className="os-toggle-pills">
              <button
                className={`os-pill-btn ${osMode === 'android' ? 'active' : ''}`}
                onClick={() => setOsMode('android')}
              >
                Android M3
              </button>
              <button
                className={`os-pill-btn ${osMode === 'ios' ? 'active' : ''}`}
                onClick={() => setOsMode('ios')}
              >
                iOS Glass
              </button>
            </div>
          </div>

          {/* COLOR SWATCH ACCENTS */}
          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">🎨</span>
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

      {/* SECTION: DATABASE & NEON DB */}
      <div className="settings-group">
        <span className="group-label">DATABASE & CLOUD STORAGE</span>
        <div className="settings-group-content">
          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">🐘</span>
              <div>
                <span className="row-title">Neon PostgreSQL Database</span>
                <span className="row-hint">
                  {process.env.DATABASE_URL ? 'Connected to Neon DB' : 'Ready for DATABASE_URL'}
                </span>
              </div>
            </div>
            <button
              className="guide-mini-toggle"
              onClick={() => setShowNeonGuide((p) => !p)}
            >
              {showNeonGuide ? 'Hide Setup' : 'How to configure Neon? ℹ️'}
            </button>
          </div>

          {showNeonGuide && (
            <div className="neon-guide-box">
              <h4 className="deploy-guide-title">🐘 How to Connect Neon PostgreSQL (Free):</h4>
              <ol className="deploy-guide-steps">
                <li>Create a free database at <a href="https://neon.tech" target="_blank" rel="noreferrer">neon.tech</a>.</li>
                <li>Copy your connection string: <code>postgres://user:password@ep-xxx.neon.tech/neondb?sslmode=require</code></li>
                <li>Go to your project settings on <a href="https://vercel.com" target="_blank" rel="noreferrer">vercel.com</a> &rarr; <strong>Settings &rarr; Environment Variables</strong>.</li>
                <li>Add variable: <code>DATABASE_URL</code> = your Neon connection string.</li>
                <li>Click <strong>Save & Redeploy</strong>. DayByDay will automatically create the tables and store all users, habits, and history permanently!</li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: GOALS */}
      <div className="settings-group">
        <span className="group-label">GOALS & HABITS</span>
        <div className="settings-group-content">
          <div
            className="settings-row-item clickable"
            onClick={() => setEditingGoals((prev) => !prev)}
          >
            <div className="row-left">
              <span className="row-icon">📝</span>
              <span className="row-title">Manage Habits</span>
            </div>
            <span className="row-arrow">{editingGoals ? '⌄' : '›'}</span>
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
                    Remove
                  </button>
                </div>
              ))}
              <button className="add-goal-mini-btn" onClick={onOpenAddGoal}>
                + Add New Habit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: INSTALLATION GUIDES */}
      <div className="settings-group">
        <span className="group-label">DEVICE INSTALLATION</span>
        <div className="settings-group-content">
          <div
            className="settings-row-item clickable"
            onClick={() => setShowInstallGuide((prev) => !prev)}
          >
            <div className="row-left">
              <span className="row-icon">📲</span>
              <span className="row-title">How to Install on iOS & Android</span>
            </div>
            <span className="row-arrow">{showInstallGuide ? '⌄' : '›'}</span>
          </div>

          {showInstallGuide && (
            <div className="install-guide-box">
              <div className="guide-card ios-guide">
                <h4 className="guide-title">🍎 iPhone / iOS Setup (No Sideloading Required!)</h4>
                <ol className="guide-steps">
                  <li>Open this link in <strong>Safari</strong> on iPhone.</li>
                  <li>Tap the <strong>Share</strong> button (box with upward arrow ⎋) at the bottom.</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>Add</strong>. Launch from your home screen with zero browser bars!</li>
                </ol>
              </div>

              <div className="guide-card android-guide">
                <h4 className="guide-title">🤖 Android Setup</h4>
                <ol className="guide-steps">
                  <li>Download the pre-compiled APK: <a href="https://github.com/palakharinkhede4/DuoTrack/raw/main/DayByDay.apk" target="_blank" rel="noreferrer">Download DayByDay.apk</a></li>
                  <li>Or open in Chrome and tap <strong>"Install App"</strong>.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: DATA BACKUP & WIPE */}
      <div className="settings-group">
        <span className="group-label">PRIVACY & DATA</span>
        <div className="settings-group-content">
          <div className="settings-row-item clickable" onClick={exportData}>
            <div className="row-left">
              <span className="row-icon">💾</span>
              <div>
                <span className="row-title">Export All Data (JSON)</span>
                <span className="row-hint">Download local encrypted backup to your device</span>
              </div>
            </div>
            <span className="row-arrow">↓</span>
          </div>

          <div
            className="settings-row-item clickable danger-row"
            onClick={() => setShowResetConfirm(true)}
          >
            <div className="row-left">
              <span className="row-icon">🗑️</span>
              <div>
                <span className="row-title danger-text">Wipe Data & Log Out</span>
                <span className="row-hint">Permanently delete stored habits and credentials</span>
              </div>
            </div>
            <span className="row-arrow danger-text">›</span>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div className="inline-confirm-card">
          <p className="confirm-title">Permanently Erase All Data?</p>
          <p className="confirm-desc">
            This will wipe your local habits, secret codes, and log you out.
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
