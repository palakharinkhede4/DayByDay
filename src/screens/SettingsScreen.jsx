import React, { useState } from 'react';
import { useHabits } from '../context/HabitContext';
import { checkApiHealth } from '../utils/api';

export const SettingsScreen = ({ onOpenPairing, onOpenAddGoal }) => {
  const {
    pod,
    themeColor,
    setThemeColor,
    osMode,
    setOsMode,
    leavePod,
    habits,
    removeGoal,
    exportData,
    resetAllData,
    requestNotificationPermission,
    serverUrl,
    setServerUrl,
    syncStatus,
    lastSyncedAt,
    syncWithCloud,
  } = useHabits();

  const [gentleNotifications, setGentleNotifications] = useState(true);
  const [editingGoals, setEditingGoals] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showVercelGuide, setShowVercelGuide] = useState(false);
  const [customServerUrl, setCustomServerUrl] = useState(serverUrl || '');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState(null);

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
          <span>{pod.user1.initial}</span>
        </div>
        <div className="profile-info">
          <h2 className="profile-name font-bold">{pod.user1.name}</h2>
          <span className="profile-email">{pod.user1.email}</span>
        </div>
        <button className="edit-profile-btn">Edit Profile ›</button>
      </div>

      {/* SECTION: POD */}
      <div className="settings-group">
        <span className="group-label">POD</span>
        <div className="settings-group-content">
          {pod.isPaired ? (
            <>
              <div className="settings-row-item">
                <div className="row-left">
                  <span className="row-icon">👥</span>
                  <span className="row-title">Paired with</span>
                </div>
                <span className="row-value font-bold">{pod.user2.name}</span>
              </div>

              <div className="settings-row-item clickable" onClick={onOpenPairing}>
                <div className="row-left">
                  <span className="row-icon">🔑</span>
                  <div>
                    <span className="row-title">Pod Code: <strong>{pod.code}</strong></span>
                    <span className="row-hint">Share this code to sync habits with your partner</span>
                  </div>
                </div>
                <span className="row-arrow">›</span>
              </div>

              <div
                className="settings-row-item clickable danger-row"
                onClick={() => setShowLeaveConfirm(true)}
              >
                <div className="row-left">
                  <span className="row-icon">🚪</span>
                  <span className="row-title danger-text">Leave Pod</span>
                </div>
                <span className="row-arrow danger-text">›</span>
              </div>
            </>
          ) : (
            <div className="settings-row-item clickable highlight-row" onClick={onOpenPairing}>
              <div className="row-left">
                <span className="row-icon">🤝</span>
                <span className="row-title">Pair with a Partner</span>
              </div>
              <span className="row-arrow">›</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: VERCEL CLOUD SYNC */}
      <div className="settings-group">
        <span className="group-label">CLOUD SYNC (VERCEL SERVERLESS)</span>
        <div className="settings-group-content cloud-sync-container">
          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">☁️</span>
              <div>
                <span className="row-title">Sync Status</span>
                <span className="row-hint">
                  {syncStatus === 'synced'
                    ? 'Connected & live syncing every 4s'
                    : syncStatus === 'syncing'
                    ? 'Syncing changes...'
                    : 'Local-only offline storage'}
                </span>
              </div>
            </div>
            <div className={`sync-status-badge ${syncStatus}`}>
              <span className="status-indicator-dot"></span>
              <span>{syncStatus === 'synced' ? 'Active' : syncStatus === 'syncing' ? 'Syncing' : 'Offline'}</span>
            </div>
          </div>

          {/* Connected URL / Input */}
          <div className="cloud-url-box">
            <label className="cloud-url-label">
              <span>Vercel Cloud URL</span>
              <button
                type="button"
                className="guide-mini-toggle"
                onClick={() => setShowVercelGuide((p) => !p)}
              >
                {showVercelGuide ? 'Hide Guide' : 'How to get URL? ℹ️'}
              </button>
            </label>
            <div className="cloud-input-row">
              <input
                type="url"
                value={customServerUrl}
                onChange={(e) => setCustomServerUrl(e.target.value)}
                placeholder="https://your-duotrack.vercel.app"
                className="cloud-url-input"
              />
              <button
                type="button"
                className="cloud-action-btn test"
                disabled={testingConnection}
                onClick={handleTestConnection}
              >
                {testingConnection ? 'Testing...' : 'Test & Save'}
              </button>
            </div>

            {connectionTestResult && (
              <div className={`test-feedback-box ${connectionTestResult.ok ? 'success' : 'warn'}`}>
                <span>{connectionTestResult.ok ? '✓' : '⚠️'}</span>
                <span>
                  {connectionTestResult.message}
                  {connectionTestResult.ok && ` (${connectionTestResult.latency}ms)`}
                </span>
              </div>
            )}

            <div className="cloud-btn-row">
              <button
                type="button"
                className="sync-now-btn"
                onClick={() => syncWithCloud()}
              >
                <span className="sync-icon">⟳</span>
                <span>Sync Now</span>
              </button>
            </div>
          </div>

          {showVercelGuide && (
            <div className="vercel-deploy-guide">
              <h4 className="deploy-guide-title">🚀 How Vercel Powers Multi-Device Sync & iOS:</h4>
              <p className="deploy-guide-text">
                Vercel serves <strong>both</strong> the iOS Web App and the live Serverless API (<code>/api/pod</code>) with zero server maintenance.
              </p>
              <ol className="deploy-guide-steps">
                <li>
                  <strong>Deploy Project:</strong> Run <code>npx vercel</code> in terminal, or push this repository to GitHub and click <strong>"Import"</strong> on <a href="https://vercel.com" target="_blank" rel="noreferrer">vercel.com</a>.
                </li>
                <li>
                  <strong>Get URL:</strong> Vercel gives you a free HTTPS link (e.g. <code>https://duotrack.vercel.app</code>).
                </li>
                <li>
                  <strong>For iOS Friend:</strong> Send them the Vercel link. They open it in Safari &rarr; tap Share &rarr; <strong>"Add to Home Screen"</strong>. Done!
                </li>
                <li>
                  <strong>For Android Phone:</strong> Paste your Vercel URL in the field above and tap <strong>"Test & Save"</strong>.
                </li>
                <li>
                  <strong>Real-time Sync:</strong> Both devices share Pod Code <strong>{pod.code}</strong>. When either of you updates a habit, both phones sync within 4 seconds!
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* LEAVE POD CONFIRMATION MODAL */}
      {showLeaveConfirm && (
        <div className="inline-confirm-card">
          <p className="confirm-title">Are you sure you want to leave this Pod?</p>
          <p className="confirm-desc">
            You will disconnect from {pod.user2.name}. You can pair back anytime with code {pod.code}.
          </p>
          <div className="confirm-btn-row">
            <button
              className="confirm-btn cancel"
              onClick={() => setShowLeaveConfirm(false)}
            >
              Cancel
            </button>
            <button
              className="confirm-btn danger"
              onClick={() => {
                leavePod();
                setShowLeaveConfirm(false);
              }}
            >
              Leave Pod
            </button>
          </div>
        </div>
      )}

      {/* SECTION: GOALS */}
      <div className="settings-group">
        <span className="group-label">GOALS</span>
        <div className="settings-group-content">
          <div
            className="settings-row-item clickable"
            onClick={() => setEditingGoals((prev) => !prev)}
          >
            <div className="row-left">
              <span className="row-icon">📝</span>
              <span className="row-title">Edit Goals</span>
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
                + Add New Goal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION: APPEARANCE & THEME */}
      <div className="settings-group">
        <span className="group-label">APPEARANCE</span>
        <div className="settings-group-content">
          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">🎨</span>
              <span className="row-title">Ring Color</span>
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

          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">⚡</span>
              <span className="row-title">Operating System Engine</span>
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
        </div>
      </div>

      {/* SECTION: NOTIFICATIONS */}
      <div className="settings-group">
        <span className="group-label">NOTIFICATIONS</span>
        <div className="settings-group-content">
          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">🔔</span>
              <div>
                <span className="row-title">Gentle Reminders</span>
                <span className="row-hint">I'll keep check-ins gentle (AM & PM)</span>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={gentleNotifications}
                onChange={async (e) => {
                  const val = e.target.checked;
                  if (val) {
                    await requestNotificationPermission();
                  }
                  setGentleNotifications(val);
                }}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION: PRIVACY & SECURITY */}
      <div className="settings-group">
        <span className="group-label">PRIVACY & OS PERMISSIONS</span>
        <div className="settings-group-content">
          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">🛡️</span>
              <div>
                <span className="row-title">100% Local-First & Zero Tracking</span>
                <span className="row-hint">No ad beacons, no remote trackers, no cookies</span>
              </div>
            </div>
            <span className="privacy-badge">Verified</span>
          </div>

          <div className="settings-row-item">
            <div className="row-left">
              <span className="row-icon">🔒</span>
              <div>
                <span className="row-title">Minimal OS Permissions</span>
                <span className="row-hint">Camera, Mic, GPS, Contacts are strictly disabled</span>
              </div>
            </div>
            <span className="privacy-badge safe">0 Required</span>
          </div>

          <div className="settings-row-item clickable" onClick={exportData}>
            <div className="row-left">
              <span className="row-icon">💾</span>
              <div>
                <span className="row-title">Export All Pod Data (JSON)</span>
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
                <span className="row-title danger-text">Wipe All Local Data</span>
                <span className="row-hint">Permanently delete stored habits & pairing keys</span>
              </div>
            </div>
            <span className="row-arrow danger-text">›</span>
          </div>
        </div>
      </div>

      {/* WIPE DATA CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="inline-confirm-card">
          <p className="confirm-title">Permanently Erase All Data?</p>
          <p className="confirm-desc">
            This will wipe your local habit data, pod code, and streaks. This cannot be undone.
          </p>
          <div className="confirm-btn-row">
            <button
              className="confirm-btn cancel"
              onClick={() => setShowResetConfirm(false)}
            >
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

      {/* SECTION: INSTALLATION (IOS & ANDROID) */}
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
                <h4 className="guide-title">🍎 iOS Installation (No Sideloading Required!)</h4>
                <p className="guide-text">
                  iOS does not require sideloading or an enterprise certificate for DuoTrack. It runs as a first-class <strong>Progressive Web App (PWA)</strong>:
                </p>
                <ol className="guide-steps">
                  <li>Open this app URL in <strong>Safari</strong> on your iPhone.</li>
                  <li>Tap the <strong>Share</strong> button (box with upward arrow) at the bottom.</li>
                  <li>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>Add</strong>. DuoTrack will launch full-screen with safe-area support, haptics, and zero browser bars!</li>
                </ol>
                <p className="guide-sub">
                  <em>For App Store/TestFlight builds:</em> Run <code>npx cap add ios</code> with our included Capacitor config!
                </p>
              </div>

              <div className="guide-card android-guide">
                <h4 className="guide-title">🤖 Android Installation</h4>
                <ol className="guide-steps">
                  <li>Open in <strong>Chrome</strong> on Android.</li>
                  <li>Tap the <strong>Install App</strong> banner or the 3-dots menu &gt; <strong>Install DuoTrack</strong>.</li>
                  <li>It installs as a native WebAPK with Material You theme colors and offline caching!</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
