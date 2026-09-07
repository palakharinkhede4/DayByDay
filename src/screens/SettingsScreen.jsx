import React, { useState, useRef } from 'react';
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
  Sparkles,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Plus,
  Camera,
  FileText,
  Flame,
  Activity,
  Zap,
} from 'lucide-react';
import { sound } from '../utils/sound';
import {
  checkForAppUpdate,
  openExternalUrl,
  fetchChangelog,
  RELEASES_PAGE_URL,
  DIRECT_APK_URL,
} from '../utils/updateChecker';
import { UpdateModal } from '../components/UpdateModal';


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
    osMode,
    useMaterial3Theme,
    setUseMaterial3Theme,
    habits,
    removeGoal,
    exportData,
    importData,
    resetAllData,
    deleteAccountPermanently,
    logoutUser,
    profilePicture,
    setProfilePicture,
    healthSyncEnabled,
    healthStats,
    enableHealthSync,
    disableHealthSync,
    syncDeviceHealth,
    setCustomHealthSteps,
    openFeaturesGuide,
  } = useHabits();

  const [hapticsEnabled, setHapticsEnabled] = useState(() => sound.hapticsEnabled);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [changelogModalOpen, setChangelogModalOpen] = useState(false);
  const [changelogData, setChangelogData] = useState(null);
  const [loadingChangelog, setLoadingChangelog] = useState(false);
  const [syncingHealth, setSyncingHealth] = useState(false);

  const handleManualHealthSync = async () => {
    setSyncingHealth(true);
    try {
      await syncDeviceHealth({ silent: false, force: true });
    } finally {
      setSyncingHealth(false);
    }
  };


  const handleViewChangelog = async () => {
    setLoadingChangelog(true);
    setChangelogModalOpen(true);
    try {
      const data = await fetchChangelog();
      setChangelogData(data);
    } finally {
      setLoadingChangelog(false);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 180;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setProfilePicture(resizedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateModalOpen(true);
    try {
      const res = await checkForAppUpdate();
      setUpdateInfo(res);
    } catch {
      setUpdateInfo({
        success: false,
        releasePageUrl: RELEASES_PAGE_URL,
        directApkUrl: DIRECT_APK_URL,
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const res = importData(text);
        if (res.success) {
          setImportStatus('Backup restored successfully!');
        } else {
          setImportStatus(`Restore failed: ${res.error}`);
        }
      } catch {
        setImportStatus('Failed to parse backup file.');
      }
      setTimeout(() => setImportStatus(null), 3500);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyCode = async () => {
    const code = user?.secretCode || user?.secret_code || pod?.code || '';
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
    { id: 'sunset', label: 'Sunset & Crimson (Default)', c1: '#F97316', c2: '#FF5252' },
    { id: 'sapphire', label: 'Dark Sapphire & Cyan', c1: '#2563EB', c2: '#00D2FF' },
    { id: 'fit', label: 'Activity Focus (Mint & Electric Blue)', c1: '#00D284', c2: '#2979FF' },
    { id: 'emerald', label: 'Mint & Coral', c1: '#10B981', c2: '#F43F5E' },
    { id: 'ocean', label: 'Cyan & Amber', c1: '#06B6D4', c2: '#F59E0B' },
    { id: 'violet', label: 'Violet & Mint', c1: '#8B5CF6', c2: '#00D284' },
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
        <div
          className="profile-avatar-circle clickable font-extrabold"
          onClick={() => setAvatarModalOpen(true)}
          title="Change, modify, or remove profile picture"
        >
          {profilePicture ? (
            <img src={profilePicture} alt="Avatar" className="profile-avatar-image" />
          ) : (
            <span>{userInitial}</span>
          )}
          <div className="avatar-camera-badge">
            <Camera size={12} />
          </div>
        </div>
        <input
          type="file"
          ref={avatarInputRef}
          onChange={handleAvatarUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />

        <div className="profile-info">
          <h2 className="profile-name font-bold">
            {user ? (user.displayName || `@${user.username}`) : 'Anonymous User'}
          </h2>
          <span className="profile-email font-mono">
            {user ? `@${user.username}` : 'No username set'}
          </span>
        </div>

        <div className="profile-actions-row">
          {user && (
            <button
              className="signout-profile-btn font-medium"
              onClick={logoutUser}
              title="Sign out of account (habits stay preserved)"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* SECTION: ACCOUNT & SECRET CODE */}
      <div className="settings-group">
        <span className="group-label">ACCOUNT & SECRET CODE</span>
        <div className="settings-group-content">
          <div className="settings-row-item clickable" onClick={handleCopyCode}>
            <div className="row-left">
              <Key size={18} className="text-amber-400" />
              <div>
                <span className="row-title">Your Secret Code</span>
                <span className="row-hint">Share this code with a friend for 1-on-1 partner tracking</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="font-mono font-bold text-sm" style={{ padding: '0.25rem 0.6rem', borderRadius: '8px', background: 'rgba(249, 115, 22, 0.12)', color: 'var(--primary, #F97316)' }}>
                {user?.secretCode || user?.secret_code || pod?.code || 'DAY-1000'}
              </span>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                aria-label="Copy secret code"
              >
                {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

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

          {/* MATERIAL 3 DYNAMIC COLOR SYSTEM (Android App / OS) */}
          {(osMode === 'android' || Boolean(window.Capacitor?.isNativePlatform?.()) || (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent))) && (
            <div className="settings-row-item">
              <div className="row-left">
                <Palette size={18} className="text-teal-400" />
                <div>
                  <span className="row-title">Material 3 Color Scheme</span>
                  <span className="row-hint">Android Material You expressive tonal color system</span>
                </div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={useMaterial3Theme}
                  onChange={(e) => setUseMaterial3Theme(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          )}

          {/* HAPTIC FEEDBACK TOGGLE */}
          <div className="settings-row-item">
            <div className="row-left">
              <Zap size={18} className="text-amber-400" />
              <div>
                <span className="row-title">Haptic Feedback</span>
                <span className="row-hint">Subtle vibrations for button taps and completed goals</span>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={hapticsEnabled}
                onChange={(e) => {
                  const val = e.target.checked;
                  setHapticsEnabled(val);
                  sound.setHapticsEnabled(val);
                  if (val) sound.tap();
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      {/* SECTION: HEALTH & FITNESS SYNC */}
      <div className="settings-group">
        <span className="group-label">SYSTEM HEALTH & FITNESS SYNC</span>
        <div className="settings-group-content">
          <div className="settings-row-item">
            <div className="row-left">
              <Activity size={18} className="text-emerald-400" />
              <div>
                <span className="row-title">Sync with Fitness App</span>
                <span className="row-hint">
                  {healthSyncEnabled
                    ? 'Active · Automatically updates steps, calories & distance in Habits & Together Pod'
                    : 'Auto-sync daily steps, calories & distance from Android Sensor / Apple Health'}
                </span>
              </div>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={Boolean(healthSyncEnabled)}
                onChange={async (e) => {
                  if (e.target.checked) {
                    await enableHealthSync();
                    await syncDeviceHealth({ silent: false, force: true });
                  } else {
                    disableHealthSync();
                  }
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {healthSyncEnabled && (
            <>
              {/* Daily Stats Summary: Steps, Calories, Distance */}
              <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="live-indicator-dot"></span>
                    <span className="row-title font-bold" style={{ fontSize: '0.85rem' }}>
                      Today's Activity
                    </span>
                  </div>
                  <span className="row-hint" style={{ fontSize: '0.75rem' }}>
                    {healthStats?.syncedAt ? `Synced ${new Date(healthStats.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Live'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', padding: '0.6rem 0.6rem', textAlign: 'center' }}>
                    <div className="font-extrabold text-emerald-400" style={{ fontSize: '1.2rem' }}>
                      {(healthStats?.steps || 0).toLocaleString()}
                    </div>
                    <div className="row-hint" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>Steps</div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', padding: '0.6rem 0.6rem', textAlign: 'center' }}>
                    <div className="font-extrabold text-amber-400" style={{ fontSize: '1.2rem' }}>
                      {healthStats?.calories || Math.round((healthStats?.steps || 0) * 0.04)}
                    </div>
                    <div className="row-hint" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>Calories (kcal)</div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.04)', borderRadius: '10px', padding: '0.6rem 0.6rem', textAlign: 'center' }}>
                    <div className="font-extrabold text-blue-400" style={{ fontSize: '1.2rem' }}>
                      {healthStats?.distanceKm !== undefined ? healthStats.distanceKm : (Math.round((healthStats?.steps || 0) * 0.000762 * 100) / 100)} km
                    </div>
                    <div className="row-hint" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>Distance</div>
                  </div>
                </div>
              </div>

              {/* Sync Now Direct Action (Zero manual modal popups) */}
              <div className="settings-row-item clickable" onClick={handleManualHealthSync}>
                <div className="row-left">
                  <RefreshCw size={18} className={`text-emerald-400 ${syncingHealth ? 'animate-spin' : ''}`} />
                  <div>
                    <span className="row-title font-semibold">
                      Sync Activity Now
                    </span>
                    <span className="row-hint">
                      Sync steps, calories & distance to habits & Together pod
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="check-update-trigger-btn font-semibold"
                  style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                  disabled={syncingHealth}
                >
                  {syncingHealth ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>

              {/* Apple Health Automation Info for iOS Web Users */}
              {!window.Capacitor?.isNativePlatform?.() && (
                <div className="settings-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem', padding: '0.85rem 1rem', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={16} className="text-emerald-400" />
                      <span className="row-title font-semibold" style={{ fontSize: '0.82rem' }}>
                        Apple Health Auto-Sync
                      </span>
                    </div>
                    <span className="active-badge" style={{ fontSize: '0.65rem' }}>iOS Native</span>
                  </div>
                  <span className="row-hint" style={{ fontSize: '0.75rem', lineHeight: '1.35' }}>
                    On iPhone, Apple Health data syncs automatically via Apple Shortcuts and device motion sensors with zero manual entry.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* SECTION: APP FEATURES & GUIDE */}
      <div className="settings-group">
        <span className="group-label">APP GUIDE & FEATURES</span>
        <div className="settings-group-content">
          <div className="settings-row-item clickable" onClick={openFeaturesGuide}>
            <div className="row-left">
              <Sparkles size={18} className="text-amber-400" />
              <div>
                <span className="row-title font-semibold">App Feature Guide</span>
                <span className="row-hint">Complete 1-minute tour of Habits, Track, Together, Insights & Health Sync</span>
              </div>
            </div>
            <ChevronRight size={18} />
          </div>
        </div>
      </div>

      {/* SECTION: DATA BACKUP & RESTORE */}
      <div className="settings-group">
        <span className="group-label">DATA & VAULT PORTABILITY</span>
        <div className="settings-group-content">
          <div className="settings-row-item clickable" onClick={exportData}>
            <div className="row-left">
              <Download size={18} className="text-blue-400" />
              <div>
                <span className="row-title">Export Backup (JSON)</span>
                <span className="row-hint">Save encrypted local backup of all habits and streaks</span>
              </div>
            </div>
            <ChevronRight size={18} />
          </div>

          <div
            className="settings-row-item clickable"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="row-left">
              <Upload size={18} className="text-emerald-400" />
              <div>
                <span className="row-title">Import Backup (JSON)</span>
                <span className="row-hint">Restore your habits and data from a previously saved backup</span>
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json,application/json"
              style={{ display: 'none' }}
            />
            <ChevronRight size={18} />
          </div>

          {importStatus && (
            <div className="backup-status-banner">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>{importStatus}</span>
            </div>
          )}

          <div
            className="settings-row-item clickable danger-row"
            onClick={() => setShowResetConfirm(true)}
          >
            <div className="row-left">
              <Trash2 size={18} className="danger-text" />
              <div>
                <span className="row-title danger-text">Wipe Data & Delete Account Permanently</span>
                <span className="row-hint">Permanently deletes cloud account, paired pods, and local habits</span>
              </div>
            </div>
            <ChevronRight size={18} className="danger-text" />
          </div>
        </div>
      </div>

      {/* SECTION: APP UPDATES & RELEASES */}
      <div className="settings-group">
        <span className="group-label">APP UPDATES</span>
        <div className="settings-group-content">
          {/* Check for Updates — Android only (web/iOS gets the app from the web, no APK needed) */}
          {(osMode === 'android' || Boolean(window.Capacitor?.isNativePlatform?.())) && (
            <div className="settings-row-item clickable" onClick={handleCheckUpdate}>
              <div className="row-left">
                <RefreshCw
                  size={18}
                  className={`text-blue-400 ${checkingUpdate ? 'animate-spin' : ''}`}
                />
                <div>
                  <span className="row-title">Check for Updates</span>
                  <span className="row-hint">Verify if a newer Android build is available on GitHub</span>
                </div>
              </div>
              <button className="check-update-trigger-btn font-semibold" disabled={checkingUpdate}>
                {checkingUpdate ? 'Checking...' : 'Check'}
              </button>
            </div>
          )}

          <div className="settings-row-item clickable" onClick={handleViewChangelog}>
            <div className="row-left">
              <FileText size={18} className="text-purple-400" />
              <div>
                <span className="row-title">View Changelog</span>
                <span className="row-hint">What's new in recent builds and features</span>
              </div>
            </div>
            <ChevronRight size={18} />
          </div>

          {/* Latest Releases Download Page — Android only */}
          {(osMode === 'android' || Boolean(window.Capacitor?.isNativePlatform?.())) && (
            <div
              className="settings-row-item clickable"
              onClick={() => openExternalUrl(RELEASES_PAGE_URL)}
            >
              <div className="row-left">
                <ExternalLink size={18} className="text-cyan-400" />
                <div>
                  <span className="row-title">Latest Releases Download Page</span>
                  <span className="row-hint">Direct access to DayByDay release builds and changelog</span>
                </div>
              </div>
              <ChevronRight size={18} />
            </div>
          )}
        </div>
      </div>

      {showResetConfirm && (
        <div className="inline-confirm-card">
          <p className="confirm-title">Permanently Delete Account & Wipe Data?</p>
          <p className="confirm-desc">
            This will permanently delete your account, paired pod relationships, habits, and all history from both the cloud database and your local device. This action cannot be undone.
          </p>
          <div className="confirm-btn-row">
            <button className="confirm-btn cancel" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </button>
            <button
              className="confirm-btn danger"
              onClick={async () => {
                setShowResetConfirm(false);
                await deleteAccountPermanently();
              }}
            >
              Confirm Delete & Wipe
            </button>
          </div>
        </div>
      )}

      {/* CHANGELOG MODAL */}
      {changelogModalOpen && (
        <div className="update-modal-backdrop" onClick={() => setChangelogModalOpen(false)}>
          <div className="update-modal-card changelog-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="update-modal-header">
              <div className="update-icon-circle">
                <FileText size={24} className="text-purple-400" />
              </div>
              <h3 className="update-modal-title font-extrabold">Release Changelog</h3>
              <p className="update-modal-subtitle">
                Latest updates, improvements, and fixes in DayByDay
              </p>
            </div>

            <div className="changelog-content-box font-mono">
              {loadingChangelog ? (
                <div className="changelog-loading">
                  <RefreshCw size={18} className="animate-spin text-purple-400" />
                  <span>Loading recent release history...</span>
                </div>
              ) : (
                <div className="changelog-text">
                  <div className="changelog-version-badge font-bold">
                    Version {changelogData?.version || 'v1.1.0'}
                  </div>
                  <pre className="changelog-pre">{changelogData?.notes}</pre>
                </div>
              )}
            </div>

            <div className="update-modal-actions">
              <button
                className="update-action-btn secondary font-medium"
                onClick={() => {
                  openExternalUrl(RELEASES_PAGE_URL);
                  setChangelogModalOpen(false);
                }}
              >
                <ExternalLink size={16} />
                <span>Open Full GitHub Releases</span>
              </button>
              <button
                className="update-action-btn close font-medium"
                onClick={() => setChangelogModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL */}
      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        updateInfo={updateInfo}
        isChecking={checkingUpdate}
      />

      {/* AVATAR OPTIONS ACTION MODAL */}
      {avatarModalOpen && (
        <div className="avatar-modal-backdrop" onClick={() => setAvatarModalOpen(false)}>
          <div className="avatar-options-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="avatar-modal-title font-bold">Profile Picture</h3>
            <p className="avatar-modal-subtitle">Add, modify, or remove your personal avatar.</p>

            <div className="avatar-modal-actions">
              <button
                type="button"
                className="avatar-action-btn primary font-bold"
                onClick={() => {
                  setAvatarModalOpen(false);
                  avatarInputRef.current?.click();
                }}
              >
                <Camera size={18} />
                <span>{profilePicture ? 'Change / Upload New Photo' : 'Upload Photo'}</span>
              </button>

              {profilePicture && (
                <button
                  type="button"
                  className="avatar-action-btn danger font-bold"
                  onClick={() => {
                    setProfilePicture(null);
                    setAvatarModalOpen(false);
                  }}
                >
                  <Trash2 size={18} />
                  <span>Remove Current Photo</span>
                </button>
              )}

              <button
                type="button"
                className="avatar-action-btn cancel font-medium"
                onClick={() => setAvatarModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPER ATTRIBUTION & ABOUT CARD */}
      <div className="developer-attribution-card">
        <div className="dev-badge-flame">
          <Flame size={22} className="text-amber-400" />
        </div>
        <div className="dev-info-col">
          <div className="dev-title-row">
            <span className="dev-app-title font-extrabold">DayByDay</span>
            <span className="dev-version-badge font-mono font-bold">v{__APP_VERSION__}</span>
          </div>
          <span className="dev-author-tag font-bold">
            Developed by Palak Harinkhede
          </span>
          <p className="dev-bio-text">
            Crafted for relentless daily momentum, collaborative accountability pods, and personal consistency.
          </p>
          <div className="dev-meta-row font-mono">
            <span>Client-Encrypted</span>
            <span>•</span>
            <span>Secure Vault</span>
            <span>•</span>
            <span>All Rights Reserved</span>
          </div>
        </div>
      </div>
    </div>
  );
};
