import React, { useState, useRef, useMemo } from 'react';
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
  Smartphone,
  BellRing,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { sound } from '../utils/sound';
import {
  checkForAppUpdate,
  openExternalUrl,
  fetchChangelog,
  RELEASES_PAGE_URL,
  DIRECT_APK_URL,
  isAndroidNativeApp,
} from '../utils/updateChecker';
import { UpdateModal } from '../components/UpdateModal';
import { IosHealthSetupGuide } from '../components/IosHealthSetupGuide';


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
    changePassword,
    profilePicture,
    setProfilePicture,
    healthSyncEnabled,
    healthStats,
    enableHealthSync,
    disableHealthSync,
    syncDeviceHealth,
    setCustomHealthSteps,
    openFeaturesGuide,
    requestNotificationPermission,
    getNotificationPermissionStatus,
    isIosSafariBrowser,
    dispatchTestNotification,
    triggerIslandNotification,
    triggerCelebration,
  } = useHabits();

  const [notifStatus, setNotifStatus] = useState(() => getNotificationPermissionStatus?.() || 'granted');
  const [enablingNotifs, setEnablingNotifs] = useState(false);

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
  const [showIosHealthGuide, setShowIosHealthGuide] = useState(false);

  // Change Password State Hooks
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Detect iOS web (non-native) — strictly iPhone / iPad running Safari or iOS PWA
  const isIosWeb = useMemo(() => {
    if (typeof window === 'undefined') return false;
    if (window.Capacitor?.isNativePlatform?.()) return false;
    const ua = window.navigator?.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (window.navigator?.platform === 'MacIntel' && window.navigator?.maxTouchPoints > 1);
  }, []);

  const handleManualHealthSync = async () => {
    setSyncingHealth(true);
    try {
      const res = await syncDeviceHealth({ silent: false, force: true });
      if (res && res.success && (res.steps > 0 || res.calories > 0)) {
        // success — health context already shows notification
      } else if (isIosWeb) {
        setShowIosHealthGuide(true);
      }
    } finally {
      setSyncingHealth(false);
    }
  };

  const handleManualHealthEntry = async ({ steps, calories, distanceKm }) => {
    if (!setCustomHealthSteps) return;
    await setCustomHealthSteps({ steps, calories, distanceKm, source: 'manual_entry' });
  };

  const handleNotificationAction = async () => {
    sound.press();
    setEnablingNotifs(true);
    try {
      if (notifStatus === 'granted' || notifStatus === 'native') {
        await dispatchTestNotification?.();
        triggerIslandNotification?.('Test cheer sent! Check your notification center 🔥', 'sparkles');
      } else {
        const granted = await requestNotificationPermission?.();
        if (granted) {
          sound.complete();
          setNotifStatus('granted');
          triggerCelebration?.();
          triggerIslandNotification?.('Notifications enabled! 🔥', 'sparkles');
          await dispatchTestNotification?.();
        } else {
          setNotifStatus(getNotificationPermissionStatus?.() || 'denied');
        }
      }
    } catch (err) {
      console.warn('Notification action notice:', err);
    } finally {
      setEnablingNotifs(false);
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

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess('Password successfully updated in database!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setChangingPassword(false);
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

          {user && (
            <div
              className="settings-row-item clickable"
              onClick={() => {
                sound.press();
                setPasswordModalOpen(true);
                setPasswordError('');
                setPasswordSuccess('');
              }}
            >
              <div className="row-left">
                <Lock size={18} className="text-amber-400" />
                <div>
                  <span className="row-title">Change Password</span>
                  <span className="row-hint">Update your account password securely in cloud database</span>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
            </div>
          )}
        </div>
      </div>

      {/* SECTION: PUSH NOTIFICATIONS & CHEER ALERTS */}
      <div className="settings-group">
        <span className="group-label">NOTIFICATIONS & CHEER ALERTS</span>
        <div className="settings-group-content">
          <div className="settings-row-item">
            <div className="row-left">
              <BellRing size={18} className="text-amber-400" />
              <div>
                <span className="row-title">Push Notifications</span>
                <span className="row-hint">Encouragement cheers from pod members & daily habit reminders</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {notifStatus === 'granted' || notifStatus === 'native' ? (
                <span className="notif-badge-active">
                  <Check size={12} /> Enabled
                </span>
              ) : notifStatus === 'denied' ? (
                <span className="notif-badge-blocked">
                  <AlertCircle size={12} /> Blocked
                </span>
              ) : (
                <span className="notif-badge-pending">
                  <BellRing size={12} /> Not Enabled
                </span>
              )}
            </div>
          </div>

          <div className="settings-row-item">
            <div className="row-left">
              <Sparkles size={18} className="text-orange-400" />
              <div>
                <span className="row-title">
                  {notifStatus === 'granted' || notifStatus === 'native' ? 'Test Cheer Alert' : 'Enable Notifications'}
                </span>
                <span className="row-hint">
                  {notifStatus === 'granted' || notifStatus === 'native'
                    ? 'Send a live test cheer notification with banner and sound'
                    : 'Grant notification permission for iOS Web App & browser'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="notif-enable-btn font-bold"
              onClick={handleNotificationAction}
              disabled={enablingNotifs}
            >
              {notifStatus === 'granted' || notifStatus === 'native' ? (
                <>
                  <Flame size={14} />
                  <span>{enablingNotifs ? 'Sending...' : 'Test Cheer'}</span>
                </>
              ) : (
                <>
                  <BellRing size={14} />
                  <span>{enablingNotifs ? 'Enabling...' : 'Enable Now'}</span>
                </>
              )}
            </button>
          </div>

          {isIosSafariBrowser?.() && notifStatus !== 'granted' && (
            <div style={{ padding: '0.85rem 1.1rem', background: 'rgba(59, 130, 246, 0.08)', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45, display: 'block' }}>
                💡 <strong>iOS Web App Tip</strong>: Web push on iPhone/iPad requires DayByDay to be added to your Home Screen. Tap <strong>Share 􀈂</strong> in Safari, tap <strong>'Add to Home Screen' 􀎶</strong>, then open DayByDay from your Home Screen.
              </span>
            </div>
          )}
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
                    const res = await syncDeviceHealth({ silent: false, force: true });
                    if (isIosWeb && (!res?.success || (!res?.steps && !res?.calories))) {
                      setShowIosHealthGuide(true);
                    }
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

              {/* iOS Sync Setup Guide — only displayed for iOS Web App users */}
              {isIosWeb && (
                <div
                  className="settings-row-item clickable"
                  onClick={() => {
                    sound.tap();
                    setShowIosHealthGuide(true);
                  }}
                  style={{
                    cursor: 'pointer',
                    background: 'rgba(59, 130, 246, 0.08)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div className="row-left">
                    <Smartphone size={18} className="text-blue-400" />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span className="row-title font-semibold" style={{ color: '#60A5FA' }}>
                          iOS Sync Setup Guide
                        </span>
                        <span
                          className="active-badge"
                          style={{
                            fontSize: '0.62rem',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#93C5FD',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                          }}
                        >
                          iOS Web
                        </span>
                      </div>
                      <span className="row-hint">
                        Prefilled Apple Shortcut setup & private webhook link
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-blue-400" />
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
          {/* Check for Updates — Native Android only (web and iOS webapp directly execute latest build) */}
          {isAndroidNativeApp() && (
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

      {/* CHANGE PASSWORD MODAL */}
      {passwordModalOpen && (
        <div className="avatar-modal-backdrop" onClick={() => !changingPassword && setPasswordModalOpen(false)}>
          <div className="avatar-options-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ padding: '0.5rem', borderRadius: '12px', background: 'rgba(249, 115, 22, 0.15)', color: 'var(--primary, #F97316)' }}>
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base" style={{ margin: 0 }}>Change Password</h3>
                  <p className="text-xs" style={{ margin: 0, color: 'var(--text-secondary)' }}>Instant & securely encrypted in database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !changingPassword && setPasswordModalOpen(false)}
                disabled={changingPassword}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem', padding: '0.25rem' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {passwordError && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10B981', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm"
                    style={{ paddingRight: '2.5rem', borderColor: 'var(--border, rgba(255,255,255,0.15))', color: 'inherit' }}
                    required
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm"
                    style={{ paddingRight: '2.5rem', borderColor: 'var(--border, rgba(255,255,255,0.15))', color: 'inherit' }}
                    required
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <span style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '0.2rem', display: 'block' }}>Password must be at least 6 characters</span>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 rounded-xl border bg-transparent text-sm"
                    style={{ paddingRight: '2.5rem', borderColor: 'var(--border, rgba(255,255,255,0.15))', color: 'inherit' }}
                    required
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <span style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '0.2rem', display: 'block' }}>Passwords do not match</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  disabled={changingPassword}
                  className="px-4 py-2 rounded-xl border text-sm font-semibold"
                  style={{ flex: 1, borderColor: 'var(--border, rgba(255,255,255,0.15))', background: 'transparent', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-opacity"
                  style={{ flex: 1, background: 'var(--primary, #F97316)', opacity: (changingPassword || !currentPassword || newPassword.length < 6 || newPassword !== confirmPassword) ? 0.5 : 1 }}
                >
                  {changingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
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

      {/* iOS Health Setup Guide Modal */}
      <IosHealthSetupGuide
        isOpen={showIosHealthGuide}
        onClose={() => setShowIosHealthGuide(false)}
        userSecretCode={user?.secretCode || user?.secret_code}
        onManualEntry={handleManualHealthEntry}
        currentHealthData={healthStats}
      />
    </div>
  );
};
