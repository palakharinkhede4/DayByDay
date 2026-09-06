import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/sound';
import { sanitizeInput, exportLocalBackup, wipeLocalData } from '../utils/security';
import {
  fetchRemotePod,
  pushHabitUpdate,
  pushFullSync,
  registerUserRemote,
  loginUserRemote,
  getSecurityQuestionRemote,
  resetPasswordRemote,
  fetchUserRemote,
  syncUserHabitsRemote,
  pairPartnerRemote,
  unpairPartnerRemote,
  deleteHabitRemote,
} from '../utils/api';
import {
  initPersistentStorage,
  persistSessionSnapshot,
  recoverSessionFromVault,
  clearVaultSession,
} from '../utils/storageVault';
import {
  startOrUpdateLiveActivity,
  stopLiveActivity,
  isLiveActivitySupported,
  requestLiveActivityPermission,
} from '../utils/liveActivityEngine';

const HabitContext = createContext(null);

const INITIAL_HABITS = [
  {
    id: 'steps',
    name: 'Steps',
    category: 'Daily',
    description: 'Walk more each day',
    target: 10000,
    unit: 'steps',
    icon: 'steps',
    user1: 0,
    user2: 0,
    history: {},
  },
  {
    id: 'sleep',
    name: 'Sleep',
    category: 'Daily',
    description: 'Get enough rest',
    target: 8,
    unit: 'hours',
    icon: 'sleep',
    user1: 0,
    user2: 0,
    user1Display: '0h',
    user2Display: '0h',
    history: {},
  },
  {
    id: 'meditation',
    name: 'Meditation',
    category: 'Daily',
    description: 'Daily mindfulness practice',
    target: 10,
    unit: 'min',
    icon: 'meditation',
    user1: 0,
    user2: 0,
    history: {},
  },
  {
    id: 'water',
    name: 'Water',
    category: 'Daily',
    description: 'Stay hydrated',
    target: 8,
    unit: 'glasses',
    icon: 'water',
    user1: 0,
    user2: 0,
    history: {},
  },
  {
    id: 'reading',
    name: 'Reading',
    category: 'Daily',
    description: 'Pages per day or books per month',
    target: 15,
    unit: 'pages',
    icon: 'reading',
    user1: 0,
    user2: 0,
    history: {},
  },
  {
    id: 'workouts',
    name: 'Workouts',
    category: 'Daily',
    description: 'Daily active exercise',
    target: 30,
    unit: 'min',
    icon: 'workouts',
    user1: 0,
    user2: 0,
    history: {},
  },
  {
    id: 'vitamins',
    name: 'Vitamins & Health',
    category: 'Daily',
    description: 'Daily wellness supplements',
    target: 1,
    unit: 'check',
    icon: 'vitamins',
    user1: false,
    user2: false,
    history: {},
  }
];

const INITIAL_BEYOND = [];

function detectInitialOS() {
  if (typeof window === 'undefined') return 'ios';
  const ua = window.navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'ios';
}

function calculateConsecutiveStreak(history, target, isBoolean) {
  if (!history || typeof history !== 'object') return 0;
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const val = history[dateKey];
    const isDone = isBoolean ? Boolean(val) : (Number(val) || 0) >= (Number(target) || 1);
    if (isDone) {
      streak++;
    } else if (i === 0) {
      // If today is not yet marked done, check if yesterday was done to preserve active streak
      continue;
    } else {
      break;
    }
  }
  return streak;
}

export const HabitProvider = ({ children }) => {
  const firedRemindersRef = useRef(new Set());

  // 1. User Identity (Unique @username and Secret Code)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('daybyday_user') || localStorage.getItem('duotrack_user');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) { }
    return null; // Triggers OnboardingModal if null
  });

  // Flag to avoid modal flicker while querying IndexedDB Vault if localStorage was cleared
  const [isSessionRestoring, setIsSessionRestoring] = useState(() => {
    try {
      return !localStorage.getItem('daybyday_user') && !localStorage.getItem('duotrack_user');
    } catch {
      return false;
    }
  });

  // 2. Partner & Solo State
  const [partner, setPartner] = useState(() => {
    const saved = localStorage.getItem('daybyday_partner') || localStorage.getItem('duotrack_partner');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return null;
  });

  const isSolo = !partner;

  // 3. Theme Mode: 'light' | 'dark' | 'auto'
  const [themeMode, setThemeModeState] = useState(() => localStorage.getItem('daybyday_theme_mode') || localStorage.getItem('duotrack_theme_mode') || 'dark');
  const setThemeMode = (mode) => {
    setThemeModeState(mode);
    localStorage.setItem('daybyday_theme_mode', mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
  };

  // 4. OS Engine ('ios' | 'android')
  const [osMode, setOsMode] = useState(() => detectInitialOS());
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('daybyday_theme') || localStorage.getItem('duotrack_theme') || 'emerald');

  // Active User role in current view ('user1' = You, 'user2' = Partner)
  const [activeUserId, setActiveUserId] = useState('user1');

  // Pod details
  const [pod, setPod] = useState(() => {
    const saved = localStorage.getItem('daybyday_pod') || localStorage.getItem('duotrack_pod');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.yesterdayPercent === 85 || (parsed.user2 && parsed.user2.name === 'Joe')) {
          localStorage.removeItem('daybyday_pod');
          localStorage.removeItem('duotrack_pod');
        } else {
          return parsed;
        }
      } catch (e) { }
    }
    return {
      isPaired: false,
      code: user ? user.secretCode : 'DAY-1000',
      user1: { name: user?.displayName || 'You', email: '', initial: (user?.displayName || 'Y')[0].toUpperCase() },
      user2: null,
      daysTogether: 0,
      currentStreak: 0,
      bestStreak: 0,
      podHealth: 100,
      healthStatus: 'ACTIVE',
      yesterdayPercent: 0
    };
  });

  // Group Pod (up to 10 users)
  const [groupPod, setGroupPod] = useState(() => {
    const saved = localStorage.getItem('daybyday_group_pod');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return null;
  });

  // 1-on-1 Tracked Partner
  const [trackedPartner, setTrackedPartner] = useState(() => {
    const saved = localStorage.getItem('daybyday_tracked_partner');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return null;
  });

  // Habits list
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('daybyday_habits') || localStorage.getItem('duotrack_habits');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasLegacyMock = parsed.some((h) => (h.id === 'steps' && h.user1 === 6200) || (h.id === 'sleep' && h.user1 === 7.2));
        if (hasLegacyMock) {
          localStorage.removeItem('daybyday_habits');
          localStorage.removeItem('duotrack_habits');
          return INITIAL_HABITS;
        }
        return parsed;
      } catch (e) { }
    }
    return INITIAL_HABITS;
  });

  // Beyond Today list
  const [beyondGoals, setBeyondGoals] = useState(() => {
    const saved = localStorage.getItem('daybyday_beyond') || localStorage.getItem('duotrack_beyond');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return INITIAL_BEYOND;
  });

  // Dynamic Island status
  const [islandMessage, setIslandMessage] = useState(null);

  // Live Activity & Focus Habit State
  const [activeFocusHabitId, setActiveFocusHabitIdState] = useState(() => {
    return localStorage.getItem('daybyday_focus_habit_id') || '';
  });

  const [liveActivityEnabled, setLiveActivityEnabledState] = useState(() => {
    const saved = localStorage.getItem('daybyday_live_activity_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const setActiveFocusHabitId = (id) => {
    setActiveFocusHabitIdState(id || '');
    if (id) {
      localStorage.setItem('daybyday_focus_habit_id', id);
    } else {
      localStorage.removeItem('daybyday_focus_habit_id');
    }
  };

  const setLiveActivityEnabled = (enabled) => {
    setLiveActivityEnabledState(Boolean(enabled));
    localStorage.setItem('daybyday_live_activity_enabled', String(enabled));
    if (!enabled) {
      stopLiveActivity();
    }
  };

  // Memoized Active Focus Habit (Uses selected ID or picks the next unfinished habit)
  const activeFocusHabit = useMemo(() => {
    if (!habits || habits.length === 0) return null;
    if (activeFocusHabitId) {
      const selected = habits.find((h) => h.id === activeFocusHabitId);
      if (selected) return selected;
    }
    // Default to the first incomplete habit for the day
    const nextIncomplete = habits.find((h) => {
      const val = h.user1;
      return typeof val === 'boolean' ? !val : (val || 0) < h.target;
    });
    return nextIncomplete || habits[0];
  }, [habits, activeFocusHabitId]);

  // Partner completion percentage memo
  const partnerPercent = useMemo(() => {
    if (isSolo || !habits || !habits.length) return 0;
    let partnerScore = 0;
    habits.forEach((h) => {
      if (typeof h.user2 === 'boolean') {
        partnerScore += h.user2 ? 1 : 0;
      } else {
        partnerScore += Math.min(1, (h.user2 || 0) / h.target);
      }
    });
    return Math.round((partnerScore / habits.length) * 100);
  }, [habits, isSolo]);

  // Vercel Serverless Sync States
  const [serverUrl, setServerUrlState] = useState(() => localStorage.getItem('daybyday_server_url') || localStorage.getItem('duotrack_server_url') || '');
  const [syncStatus, setSyncStatus] = useState('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());

  const setServerUrl = (url) => {
    setServerUrlState(url);
    if (url) {
      localStorage.setItem('daybyday_server_url', url.trim());
    } else {
      localStorage.removeItem('daybyday_server_url');
    }
  };

  // Sync to DOM attributes
  useEffect(() => {
    localStorage.setItem('daybyday_os', osMode);
    document.documentElement.setAttribute('data-os', osMode);
  }, [osMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme-mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('daybyday_theme', themeColor);
    document.documentElement.setAttribute('data-theme', themeColor);
  }, [themeColor]);

  useEffect(() => {
    localStorage.setItem('daybyday_beyond', JSON.stringify(beyondGoals));
  }, [beyondGoals]);

  // Persistent Storage Vault initialization (iOS Safari ITP protection & Android WebView recovery)
  useEffect(() => {
    initPersistentStorage();

    const checkVaultSession = async () => {
      try {
        if (!user) {
          const recovered = await recoverSessionFromVault();
          if (recovered && recovered.user) {
            setUser(recovered.user);
            if (recovered.partner) setPartner(recovered.partner);
            if (recovered.habits && recovered.habits.length) setHabits(recovered.habits);
            if (recovered.pod) setPod(recovered.pod);
          }
        } else {
          // If user already loaded from localStorage, ensure IndexedDB vault is in sync
          persistSessionSnapshot(user, partner, habits, pod);
        }
      } catch (err) {
        console.warn('Vault recovery check notice:', err);
      } finally {
        setIsSessionRestoring(false);
      }
    };

    checkVaultSession();
  }, []);

  // Dual-layer session snapshot sync: whenever session state changes, mirror to both localStorage and IndexedDB Vault
  useEffect(() => {
    if (user) {
      persistSessionSnapshot(user, partner, habits, pod);
    }
  }, [user, partner, habits, pod]);

  // Multi-tab real-time session and habits synchronization
  useEffect(() => {
    const handleStorageEvent = (e) => {
      if (!e.key) return;
      try {
        if (e.key === 'daybyday_user' || e.key === 'duotrack_user') {
          if (e.newValue) {
            setUser(JSON.parse(e.newValue));
          } else {
            // Sign out initiated in another tab
            setUser(null);
            setPartner(null);
            setHabits(INITIAL_HABITS);
            setBeyondGoals(INITIAL_BEYOND);
          }
        } else if (e.key === 'daybyday_partner' || e.key === 'duotrack_partner') {
          setPartner(e.newValue ? JSON.parse(e.newValue) : null);
        } else if (e.key === 'daybyday_habits' || e.key === 'duotrack_habits') {
          if (e.newValue) setHabits(JSON.parse(e.newValue));
        } else if (e.key === 'daybyday_pod' || e.key === 'duotrack_pod') {
          if (e.newValue) setPod(JSON.parse(e.newValue));
        } else if (e.key === 'daybyday_theme_mode' || e.key === 'duotrack_theme_mode') {
          if (e.newValue) {
            setThemeModeState(e.newValue);
            document.documentElement.setAttribute('data-theme-mode', e.newValue);
          }
        } else if (e.key === 'daybyday_theme' || e.key === 'duotrack_theme') {
          if (e.newValue) {
            setThemeColor(e.newValue);
            document.documentElement.setAttribute('data-theme', e.newValue);
          }
        }
      } catch (err) {
        console.warn('Multi-tab sync notice:', err);
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, []);

  // LIVE CLOUD SYNCHRONIZATION: Poll remote Vercel API every 4 seconds when paired
  useEffect(() => {
    if (!pod.isPaired || !pod.code) return;

    let lastKnownTimestamp = 0;

    const syncInterval = setInterval(async () => {
      if (document.hidden) return;

      const remoteData = await fetchRemotePod(pod.code);
      if (remoteData && !remoteData.notFound) {
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());

        if (remoteData.lastUpdated && remoteData.lastUpdated > lastKnownTimestamp) {
          lastKnownTimestamp = remoteData.lastUpdated;

          if (remoteData.lastUpdatedBy && remoteData.lastUpdatedBy !== activeUserId) {
            if (remoteData.habits && remoteData.habits.length) {
              setHabits(remoteData.habits);
            }
            if (remoteData.lastActivity) {
              triggerIslandNotification(remoteData.lastActivity, '🔥');
              sound.complete();
            }
          }
        }
      } else if (remoteData && remoteData.notFound) {
        pushFullSync(pod.code, activeUserId, pod, habits);
        setSyncStatus('synced');
      }
    }, 4000);

    return () => clearInterval(syncInterval);
  }, [pod.code, pod.isPaired, activeUserId]);

  // Trigger Dynamic Island temporary expansion banner
  const triggerIslandNotification = (text, icon = '⚡') => {
    setIslandMessage({ text, icon });
    setTimeout(() => {
      setIslandMessage(null);
    }, 4500);
  };

  // SCHEDULED HABIT NOTIFICATIONS CHECKER (Checks every 25s against habit schedules)
  useEffect(() => {
    const checkScheduledReminders = () => {
      if (!habits || !habits.length) return;
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hours}:${minutes}`;
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDay = dayNames[now.getDay()];
      const todayDate = now.toISOString().slice(0, 10);

      habits.forEach((h) => {
        if (!h.reminderTime) return;
        if (h.reminderTime !== currentTime) return;

        // Check if day of week matches (default to every day if not specified)
        const days = h.reminderDays;
        const isDayActive = !days || !days.length || days.includes(currentDay);
        if (!isDayActive) return;

        const fireKey = `${todayDate}_${h.id}_${h.reminderTime}`;
        if (firedRemindersRef.current.has(fireKey)) return;
        firedRemindersRef.current.add(fireKey);

        // 1. Browser/OS Web Notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`DayByDay Reminder: ${h.name}`, {
              body: `Time to track: ${h.name} (${h.target || 1} ${h.unit || ''})`,
              icon: '/favicon.ico',
              tag: `daybyday-reminder-${h.id}`,
            });
          } catch (e) {
            console.warn('Native notification issue:', e);
          }
        }

        // 2. Dynamic Island banner
        triggerIslandNotification(`Reminder: ${h.name} (${h.target || 1} ${h.unit || ''})`, '⏰');

        // 3. Audio cue
        sound.complete();
      });
    };

    const reminderTimer = setInterval(checkScheduledReminders, 25000);
    checkScheduledReminders();
    return () => clearInterval(reminderTimer);
  }, [habits]);

  // Register New User (Supports remote Neon DB backend with automatic local Storage Vault fallback)
  const registerUser = async (username, password, displayName = '', avatar = '🌱', securityQuestion = '', securityAnswer = '') => {
    sound.complete();
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');
    const cleanDisplay = displayName || cleanUsername;
    const cleanAvatar = (!avatar || avatar === 'star') ? '🌱' : avatar;
    const prefix = cleanUsername.slice(0, 3).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const localSecretCode = `${prefix}-${rand}`;

    let newUser = {
      id: `usr_${cleanUsername}_${Date.now().toString(36)}`,
      username: cleanUsername,
      displayName: cleanDisplay,
      secretCode: localSecretCode,
      avatar: cleanAvatar,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await registerUserRemote(cleanUsername, password, cleanDisplay, cleanAvatar, securityQuestion, securityAnswer);
      if (res && res.user) {
        newUser = res.user;
      }
    } catch (err) {
      console.warn('Remote sync unavailable; continuing with local-first persistent vault:', err.message);
    }

    // Always store offline credential record in vault so native/offline access is instantaneous
    localStorage.setItem(`daybyday_local_acc_${cleanUsername}`, JSON.stringify({
      user: newUser,
      password,
      securityQuestion,
      securityAnswer: (securityAnswer || '').trim().toLowerCase(),
    }));

    setUser(newUser);
    setPod((prev) => ({
      ...prev,
      code: newUser.secretCode,
      user1: {
        name: newUser.displayName || newUser.username,
        email: `${newUser.username}@daybyday.invalid`,
        initial: (newUser.displayName || newUser.username)[0].toUpperCase(),
      }
    }));

    triggerCelebration();
    triggerIslandNotification(`Welcome @${newUser.username}!`, '🎉');
    return newUser;
  };

  // Login Existing User
  const loginUser = async (username, password) => {
    sound.complete();
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');

    try {
      const res = await loginUserRemote(cleanUsername, password);
      if (res && res.user) {
        setUser(res.user);
        if (res.habits && res.habits.length) setHabits(res.habits);
        if (res.partner) setPartner(res.partner);
        setPod((prev) => ({
          ...prev,
          code: res.podCode || res.user.secretCode,
          isPaired: Boolean(res.partner),
          user1: {
            name: res.user.displayName || res.user.username,
            email: `${res.user.username}@daybyday.invalid`,
            initial: (res.user.displayName || res.user.username)[0].toUpperCase(),
          },
          user2: res.partner
            ? {
                name: res.partner.displayName || res.partner.username,
                email: `${res.partner.username}@daybyday.invalid`,
                initial: (res.partner.displayName || res.partner.username)[0].toUpperCase(),
              }
            : null,
        }));
        triggerCelebration();
        triggerIslandNotification(`Welcome back @${res.user.username}!`, '👋');
        return res;
      }
    } catch (err) {
      console.warn('Remote login unavailable, attempting local vault fallback:', err.message);
    }

    // Local Vault Fallback
    const localAcc = localStorage.getItem(`daybyday_local_acc_${cleanUsername}`);
    if (localAcc) {
      try {
        const parsed = JSON.parse(localAcc);
        if (parsed.password === password) {
          setUser(parsed.user);
          triggerCelebration();
          triggerIslandNotification(`Welcome back @${parsed.user.username}!`, '👋');
          return { user: parsed.user };
        } else {
          throw new Error('Incorrect password');
        }
      } catch (e) {
        if (e.message === 'Incorrect password') throw e;
      }
    }
    throw new Error('Account not found or password incorrect');
  };

  // Get Security Question for User
  const getSecurityQuestion = async (username) => {
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');
    try {
      const remoteQ = await getSecurityQuestionRemote(cleanUsername);
      if (remoteQ && remoteQ.securityQuestion) return remoteQ;
    } catch { }

    const localAcc = localStorage.getItem(`daybyday_local_acc_${cleanUsername}`);
    if (localAcc) {
      const parsed = JSON.parse(localAcc);
      if (parsed.securityQuestion) return { securityQuestion: parsed.securityQuestion };
    }
    throw new Error('User not found');
  };

  // Reset Password with Security Answer
  const resetPassword = async (username, securityAnswer, newPassword) => {
    sound.complete();
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');
    try {
      await resetPasswordRemote(cleanUsername, securityAnswer, newPassword);
    } catch { }

    const localAcc = localStorage.getItem(`daybyday_local_acc_${cleanUsername}`);
    if (localAcc) {
      const parsed = JSON.parse(localAcc);
      if (parsed.securityAnswer === (securityAnswer || '').trim().toLowerCase()) {
        parsed.password = newPassword;
        localStorage.setItem(`daybyday_local_acc_${cleanUsername}`, JSON.stringify(parsed));
      } else {
        throw new Error('Security answer does not match');
      }
    }
    triggerIslandNotification('Password reset successfully!', '🔑');
    return { ok: true };
  };

  // Logout / Switch Account
  const logoutUser = async () => {
    sound.tap();
    setUser(null);
    setPartner(null);
    setTrackedPartner(null);
    setGroupPod(null);
    setHabits(INITIAL_HABITS);
    setBeyondGoals(INITIAL_BEYOND);
    setPod({
      isPaired: false,
      code: 'DAY-1000',
      user1: { name: 'You', email: '', initial: 'Y' },
      user2: null,
      daysTogether: 0,
      currentStreak: 0,
      bestStreak: 0,
      podHealth: 100,
      healthStatus: 'ACTIVE',
      yesterdayPercent: 0
    });
    localStorage.removeItem('daybyday_tracked_partner');
    localStorage.removeItem('daybyday_group_pod');
    await clearVaultSession();
    triggerIslandNotification('Logged out', '👤');
  };

  // 1-on-1 Track Partner by Secret Code
  const trackPartnerByCode = async (code) => {
    if (!code || !code.trim()) throw new Error('Please enter a valid secret code');
    sound.complete();
    const cleanCode = code.trim().toUpperCase();

    let partnerData = null;
    try {
      const remote = await fetchUserRemote(cleanCode);
      if (remote && remote.user) {
        partnerData = {
          ...remote.user,
          habits: remote.habits || [],
          streak: remote.streak || 1,
          todayPercent: remote.todayPercent || 0,
          lastActive: 'Just now'
        };
      }
    } catch { }

    if (!partnerData) {
      // Create a clean tracked profile for this code
      const namePart = cleanCode.split('-')[0] || 'Partner';
      partnerData = {
        username: namePart.toLowerCase(),
        displayName: namePart,
        secretCode: cleanCode,
        avatar: '🏃',
        todayPercent: 0,
        streak: 0,
        lastActive: 'Active today',
        habits: [
          { id: 'steps', name: 'Steps', target: 10000, user1: 0, unit: 'steps' },
          { id: 'water', name: 'Water', target: 8, user1: 0, unit: 'glasses' },
          { id: 'sleep', name: 'Sleep', target: 8, user1: 0, unit: 'hours' },
        ]
      };
    }

    setTrackedPartner(partnerData);
    localStorage.setItem('daybyday_tracked_partner', JSON.stringify(partnerData));
    triggerCelebration();
    triggerIslandNotification(`Tracking @${partnerData.username}!`, '🎯');
    return partnerData;
  };

  const untrackPartner = () => {
    sound.tap();
    setTrackedPartner(null);
    localStorage.removeItem('daybyday_tracked_partner');
    triggerIslandNotification('Stopped tracking partner', '👋');
  };

  // Group Pod (up to 10 users)
  const createGroupPod = (name) => {
    sound.complete();
    const cleanName = (name || 'Focus Group').trim();
    const podCode = `POD-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPod = {
      id: `gpod_${Date.now().toString(36)}`,
      name: cleanName,
      code: podCode,
      createdAt: new Date().toISOString(),
      maxMembers: 10,
      members: [
        {
          id: user?.id || 'usr_me',
          username: user?.username || 'you',
          displayName: user?.displayName || 'You',
          avatar: user?.avatar || '🌱',
          role: 'Owner',
          todayPercent: currentPercent,
          streak: pod.currentStreak || 0,
        }
      ],
      sharedGoals: [
        { id: 'sg_steps', name: 'Team 10k Steps', target: 10000, unit: 'steps', current: 0 },
        { id: 'sg_water', name: 'Daily Hydration', target: 8, unit: 'glasses', current: 0 },
      ]
    };

    setGroupPod(newPod);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(newPod));
    triggerCelebration();
    triggerIslandNotification(`Group ${cleanName} created!`, '👥');
    return newPod;
  };

  const joinGroupPod = (code) => {
    sound.complete();
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode.startsWith('POD-')) throw new Error('Invalid Pod Code format. Must start with POD-');

    // Create or join pod
    let existing = null;
    const saved = localStorage.getItem('daybyday_group_pod');
    if (saved) {
      try { existing = JSON.parse(saved); } catch { }
    }

    const podToJoin = (existing && existing.code === cleanCode) ? existing : {
      id: `gpod_${cleanCode.toLowerCase()}`,
      name: 'Accountability Pod',
      code: cleanCode,
      createdAt: new Date().toISOString(),
      maxMembers: 10,
      members: [
        { id: 'usr_leader', username: 'alex', displayName: 'Alex', avatar: '⚡', role: 'Owner', todayPercent: 70, streak: 5 }
      ],
      sharedGoals: [
        { id: 'sg_steps', name: 'Team 10k Steps', target: 10000, unit: 'steps', current: 0 },
        { id: 'sg_water', name: 'Daily Hydration', target: 8, unit: 'glasses', current: 0 },
      ]
    };

    if (podToJoin.members.length >= 10 && !podToJoin.members.some(m => m.username === user?.username)) {
      throw new Error('This pod has reached the maximum capacity of 10 members.');
    }

    if (!podToJoin.members.some(m => m.username === user?.username)) {
      podToJoin.members.push({
        id: user?.id || 'usr_me',
        username: user?.username || 'you',
        displayName: user?.displayName || 'You',
        avatar: user?.avatar || '🌱',
        role: 'Member',
        todayPercent: currentPercent,
        streak: pod.currentStreak || 0,
      });
    }

    setGroupPod(podToJoin);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(podToJoin));
    triggerCelebration();
    triggerIslandNotification(`Joined Pod ${cleanCode}!`, '🎉');
    return podToJoin;
  };

  const leaveGroupPod = () => {
    sound.tap();
    setGroupPod(null);
    localStorage.removeItem('daybyday_group_pod');
    triggerIslandNotification('Left group pod', '👋');
  };

  const addSharedGoal = (name, target, unit) => {
    sound.complete();
    if (!groupPod) return;
    const newGoal = {
      id: `sg_${Date.now().toString(36)}`,
      name: name.trim(),
      target: Number(target) || 1,
      unit: (unit || 'reps').trim(),
      current: 0,
    };
    const updated = {
      ...groupPod,
      sharedGoals: [...(groupPod.sharedGoals || []), newGoal]
    };
    setGroupPod(updated);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(updated));
    triggerIslandNotification(`Shared goal added!`, '✨');
  };

  const updateSharedGoalProgress = (goalId, delta) => {
    sound.tap();
    if (!groupPod) return;
    const updatedGoals = (groupPod.sharedGoals || []).map(g => {
      if (g.id === goalId) {
        const next = Math.max(0, (g.current || 0) + delta);
        return { ...g, current: next };
      }
      return g;
    });
    const updated = { ...groupPod, sharedGoals: updatedGoals };
    setGroupPod(updated);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(updated));
  };


  // Pair with Partner via Secret Code
  const pairWithPartner = async (partnerSecretCode) => {
    if (!user) throw new Error('Please set up your profile first');
    sound.complete();
    const cleanCode = partnerSecretCode.trim().toUpperCase();

    try {
      const res = await pairPartnerRemote(user.id, cleanCode);
      if (res && res.partner) {
        setPartner(res.partner);
        setPod((prev) => ({
          ...prev,
          isPaired: true,
          code: res.podCode || cleanCode,
          user2: {
            name: res.partner.displayName || res.partner.username,
            email: `${res.partner.username}@daybyday.invalid`,
            initial: (res.partner.displayName || res.partner.username)[0].toUpperCase(),
          }
        }));
        triggerCelebration();
        triggerIslandNotification(`Paired with @${res.partner.username}!`, '🤝');
        return res;
      }
    } catch (err) {
      // Fallback local pairing if server is offline
      const partnerName = cleanCode.split('-')[0] || 'Partner';
      const fallbackPartner = {
        username: partnerName.toLowerCase(),
        displayName: partnerName,
        secretCode: cleanCode,
        avatar: '🤝'
      };
      setPartner(fallbackPartner);
      setPod((prev) => ({
        ...prev,
        isPaired: true,
        code: cleanCode,
        user2: {
          name: partnerName,
          email: `${partnerName.toLowerCase()}@daybyday.invalid`,
          initial: partnerName[0].toUpperCase(),
        }
      }));
      triggerIslandNotification(`Paired with ${partnerName}!`, '🤝');
    }
  };

  // Unpair / Go Solo
  const unpairPartner = async () => {
    sound.tap();
    if (user?.id) {
      try {
        await unpairPartnerRemote(user.id);
      } catch { }
    }
    setPartner(null);
    setPod((prev) => ({
      ...prev,
      isPaired: false,
      code: user?.secretCode || 'DBD-1000',
      user2: { name: 'Partner', email: '', initial: 'P' }
    }));
    triggerIslandNotification('Switched to Solo Mode', '👤');
  };

  // Calculate Overall Daily Goals Reached Percentage
  const calculateGoalsReached = () => {
    if (!habits.length) return 0;
    let totalScore = 0;

    habits.forEach((h) => {
      let u1Score = 0;
      let u2Score = 0;

      if (typeof h.user1 === 'boolean') {
        u1Score = h.user1 ? 1 : 0;
        u2Score = h.user2 ? 1 : 0;
      } else {
        u1Score = Math.min(1, (h.user1 || 0) / h.target);
        u2Score = Math.min(1, (h.user2 || 0) / h.target);
      }

      // If Solo, calculate 100% based on user's own goals!
      if (isSolo) {
        totalScore += u1Score;
      } else {
        totalScore += (u1Score + u2Score) / 2;
      }
    });

    return Math.round((totalScore / habits.length) * 100);
  };

  // Count how many goals are "in sync" (both partners met target, or solo user met target)
  const calculateInSyncCount = () => {
    let inSync = 0;
    habits.forEach((h) => {
      let u1Done = typeof h.user1 === 'boolean' ? h.user1 : (h.user1 || 0) >= h.target;
      if (isSolo) {
        if (u1Done) inSync++;
      } else {
        let u2Done = typeof h.user2 === 'boolean' ? h.user2 : (h.user2 || 0) >= h.target;
        if (u1Done && u2Done) inSync++;
      }
    });
    return inSync;
  };

  // Update Habit Value (Single Habit Change)
  const updateHabit = (habitId, userId, amountOrValue, isAbsolute = false) => {
    sound.tap();
    let computedNextValue = null;
    let nextHabitsList = [];
    const todayKey = new Date().toISOString().slice(0, 10);

    setHabits((prev) => {
      const updatedList = prev.map((h) => {
        if (h.id !== habitId) return h;

        let current = h[userId];
        let nextValue = current;

        if (typeof current === 'boolean') {
          nextValue = isAbsolute ? amountOrValue : !current;
        } else {
          nextValue = isAbsolute ? amountOrValue : Math.max(0, (current || 0) + amountOrValue);
        }

        computedNextValue = nextValue;

        let extra = {};
        if (h.id === 'sleep') {
          const hrs = Math.floor(nextValue);
          const mins = Math.round((nextValue - hrs) * 60);
          extra[`${userId}Display`] = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        }

        // Maintain single-row history map: { "YYYY-MM-DD": value }
        const currentHistory = (h.history && typeof h.history === 'object') ? { ...h.history } : {};
        currentHistory[todayKey] = nextValue;

        const isCompleted = typeof nextValue === 'boolean' ? nextValue : nextValue >= h.target;
        const newStreak = calculateConsecutiveStreak(currentHistory, h.target, typeof nextValue === 'boolean');

        const updated = {
          ...h,
          [userId]: nextValue,
          history: currentHistory,
          streak: newStreak,
          completed: isCompleted,
          ...extra,
        };

        const wasDone = typeof current === 'boolean' ? current : (current || 0) >= h.target;
        const nowDone = isCompleted;
        if (!wasDone && nowDone) {
          sound.complete();
          triggerIslandNotification(`${h.name} completed!`, '🎉');
        }

        return updated;
      });

      nextHabitsList = updatedList;
      return updatedList;
    });

    // Asynchronously push update to Vercel Serverless Sync API & Neon DB
    if (pod.isPaired && pod.code && computedNextValue !== null) {
      pushHabitUpdate(pod.code, userId, habitId, computedNextValue)
        .then((res) => {
          if (res && res.success) {
            setSyncStatus('synced');
            setLastSyncedAt(Date.now());
          }
        })
        .catch(() => {});
    }

    // Sync to user's habits in Neon DB if logged in
    if (user?.id && nextHabitsList.length > 0) {
      syncUserHabitsRemote(user.id, nextHabitsList).catch(() => {});
    }
  };

  // Update Beyond goal (Savings / Weight)
  const updateBeyondGoal = (goalId, userId, amount) => {
    sound.tap();
    setBeyondGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          [userId]: Math.max(0, (g[userId] || 0) + amount)
        };
      })
    );
  };

  // Add Custom or Preset Goal
  const addGoal = (newGoal) => {
    sound.tap();
    const safeGoal = {
      ...newGoal,
      name: sanitizeInput(newGoal.name),
      unit: sanitizeInput(newGoal.unit || 'times'),
    };
    setHabits((prev) => {
      const next = [...prev, safeGoal];
      if (user?.id) {
        syncUserHabitsRemote(user.id, next).catch(() => {});
      }
      return next;
    });
    triggerIslandNotification(`Added goal: ${safeGoal.name}`, '✨');
  };

  // Remove Goal
  const removeGoal = (goalId) => {
    sound.tap();
    setHabits((prev) => prev.filter((h) => h.id !== goalId));
    if (user?.id) {
      deleteHabitRemote(user.id, goalId).catch(() => {});
    }
    triggerIslandNotification('Habit removed', '🗑️');
  };

  // Request Notifications
  const requestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
      return Notification.permission === 'granted';
    }
    return false;
  };

  // Export local backup file
  const exportData = () => {
    sound.tap();
    exportLocalBackup({
      user,
      partner,
      isSolo,
      pod,
      habits,
      beyondGoals,
      osMode,
      themeColor,
      themeMode,
    });
  };

  // Wipe data and reset to fresh state
  const resetAllData = async () => {
    sound.tap();
    wipeLocalData();
    setUser(null);
    setPartner(null);
    setHabits(INITIAL_HABITS);
    setBeyondGoals(INITIAL_BEYOND);
    await clearVaultSession();
  };

  // Celebrate with confetti
  const triggerCelebration = () => {
    sound.complete();
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#10B981', '#F43F5E', '#F59E0B', '#3B82F6']
    });
  };

  // Force manual sync with Vercel Cloud
  const syncWithCloud = async () => {
    if (!pod.code) return;
    setSyncStatus('syncing');
    try {
      const remoteData = await fetchRemotePod(pod.code);
      if (remoteData && !remoteData.notFound && remoteData.habits) {
        setHabits(remoteData.habits);
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
        triggerIslandNotification('Synced with Cloud!', '☁️');
      } else if (remoteData && remoteData.notFound) {
        await pushFullSync(pod.code, activeUserId, pod, habits);
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
        triggerIslandNotification('Pod initialized on Cloud!', '🚀');
      } else {
        setSyncStatus('offline');
      }
    } catch {
      setSyncStatus('offline');
    }
  };

  const currentPercent = useMemo(() => calculateGoalsReached(), [habits, isSolo]);
  const inSyncGoalsCount = useMemo(() => calculateInSyncCount(), [habits, isSolo]);

  // Quick 1-tap increment for focus habit directly from Dynamic Island
  const quickIncrementFocusHabit = (customAmount) => {
    if (!activeFocusHabit) return;
    const h = activeFocusHabit;
    if (typeof h.user1 === 'boolean') {
      updateHabit(h.id, activeUserId, true, true);
    } else {
      let increment = customAmount;
      if (!increment) {
        if (h.unit === 'steps') increment = 1000;
        else if (h.unit === 'min') increment = 5;
        else if (h.unit === 'pints') increment = 1;
        else if (h.unit === 'pgs') increment = 5;
        else increment = 1;
      }
      updateHabit(h.id, activeUserId, increment, false);
    }
  };

  // Quick 1-tap complete for focus habit directly from Dynamic Island
  const toggleFocusHabitCompleted = () => {
    if (!activeFocusHabit) return;
    const h = activeFocusHabit;
    if (typeof h.user1 === 'boolean') {
      updateHabit(h.id, activeUserId, !h.user1, true);
    } else {
      const current = h.user1 || 0;
      const next = current >= h.target ? 0 : h.target;
      updateHabit(h.id, activeUserId, next, true);
    }
  };

  // Live Activity & Dynamic Island auto-synchronization
  useEffect(() => {
    if (!liveActivityEnabled || !activeFocusHabit) return;

    const val = activeFocusHabit.user1;
    const isDone = typeof val === 'boolean' ? val : (val || 0) >= activeFocusHabit.target;

    startOrUpdateLiveActivity({
      habit: activeFocusHabit,
      userValue: val,
      targetValue: activeFocusHabit.target,
      unit: activeFocusHabit.unit,
      streak: activeFocusHabit.streak || 1,
      partner: partner,
      partnerPercent: partnerPercent,
      podSyncPercent: currentPercent,
      isCompleted: isDone,
    });
  }, [activeFocusHabit, liveActivityEnabled, partner, partnerPercent, currentPercent]);

  return (
    <HabitContext.Provider
      value={{
        user,
        isSessionRestoring,
        registerUser,
        loginUser,
        getSecurityQuestion,
        resetPassword,
        logoutUser,
        partner,
        isSolo,
        pairWithPartner,
        unpairPartner,
        themeMode,
        setThemeMode,
        osMode,
        setOsMode,
        themeColor,
        setThemeColor,
        activeUserId,
        setActiveUserId,
        pod,
        habits,
        beyondGoals,
        currentPercent,
        inSyncGoalsCount,
        islandMessage,
        triggerIslandNotification,
        activeFocusHabit,
        activeFocusHabitId,
        setActiveFocusHabitId,
        liveActivityEnabled,
        setLiveActivityEnabled,
        quickIncrementFocusHabit,
        toggleFocusHabitCompleted,
        partnerPercent,
        isLiveActivitySupported,
        requestLiveActivityPermission,
        updateHabit,
        updateBeyondGoal,
        addGoal,
        removeGoal,
        triggerCelebration,
        requestNotificationPermission,
        exportData,
        resetAllData,
        trackedPartner,
        trackPartnerByCode,
        untrackPartner,
        groupPod,
        createGroupPod,
        joinGroupPod,
        leaveGroupPod,
        addSharedGoal,
        updateSharedGoalProgress,
        serverUrl,
        setServerUrl,
        syncStatus,
        lastSyncedAt,
        syncWithCloud,
      }}
    >
      {children}
    </HabitContext.Provider>
  );
};

export const useHabits = () => {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error('useHabits must be used within a HabitProvider');
  return ctx;
};
