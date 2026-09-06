import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/sound';
import { sanitizeInput, exportLocalBackup, parseLocalBackup, wipeLocalData } from '../utils/security';
import {
  fetchRemotePod,
  pushHabitUpdate,
  pushFullSync,
  registerUserRemote,
  loginUserRemote,
  getSecurityQuestionRemote,
  resetPasswordRemote,
  fetchUserRemote,
  fetchUserByCodeRemote,
  syncUserHabitsRemote,
  syncPreferencesRemote,
  pairPartnerRemote,
  unpairPartnerRemote,
  deleteHabitRemote,
  createGroupPodRemote,
  joinGroupPodRemote,
  getGroupPodRemote,
  getUserGroupPodRemote,
  addGroupGoalRemote,
  updateGroupGoalRemote,
  deleteGroupGoalRemote,
  leaveGroupPodRemote,
  sendCheerRemote,
  fetchCheersRemote,
  hasRemoteBackend,
  getApiBaseUrl,
  formatErrorMessage,
} from '../utils/api';
import {
  getHabitNotificationContent,
  requestAppNotificationPermission,
  dispatchHabitNotification,
} from '../utils/notifications';
import {
  initPersistentStorage,
  persistSessionSnapshot,
  recoverSessionFromVault,
  clearVaultSession,
  removeVaultItem,
} from '../utils/storageVault';

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
      if (localStorage.getItem('daybyday_signed_out') === 'true') {
        return null;
      }
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
      if (localStorage.getItem('daybyday_signed_out') === 'true') {
        return false;
      }
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
  const [osMode, setOsMode] = useState(() => {
    const saved = localStorage.getItem('daybyday_os');
    if (saved === 'android' || saved === 'ios') return saved;
    return detectInitialOS();
  });

  // 5. Accent theme color (Default to Sunset & Crimson)
  const [themeColor, setThemeColor] = useState(() => {
    const saved = localStorage.getItem('daybyday_theme') || localStorage.getItem('duotrack_theme');
    if (!saved || saved === 'fit' || saved === 'sapphire') return 'sunset';
    return saved;
  });

  // Material 3 Dynamic Theme Toggle (Android Expressive - Off by default)
  const [useMaterial3Theme, setUseMaterial3ThemeState] = useState(() => {
    try {
      return localStorage.getItem('daybyday_material3') === 'true';
    } catch {
      return false;
    }
  });

  const setUseMaterial3Theme = (enabled) => {
    const val = Boolean(enabled);
    setUseMaterial3ThemeState(val);
    try {
      localStorage.setItem('daybyday_material3', String(val));
    } catch {}
    if (val) {
      document.documentElement.setAttribute('data-theme-m3', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme-m3');
    }
  };

  // Profile Picture (base64 data URL or null)
  const [profilePicture, setProfilePictureState] = useState(() => {
    try {
      return localStorage.getItem('daybyday_profile_pic') || null;
    } catch {
      return null;
    }
  });

  const setProfilePicture = (picUrl) => {
    setProfilePictureState(picUrl);
    try {
      if (picUrl) {
        localStorage.setItem('daybyday_profile_pic', picUrl);
      } else {
        localStorage.removeItem('daybyday_profile_pic');
      }
    } catch {}
  };

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
      code: user ? (user.secretCode || user.secret_code || 'DAY-1000') : 'DAY-1000',
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

  // Multi-Partner Accountability Track (up to 5 partners)
  const [trackedPartners, setTrackedPartners] = useState(() => {
    try {
      const savedMulti = localStorage.getItem('daybyday_tracked_partners');
      if (savedMulti) {
        const parsed = JSON.parse(savedMulti);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
      const savedSingle = localStorage.getItem('daybyday_tracked_partner');
      if (savedSingle) {
        const parsed = JSON.parse(savedSingle);
        if (parsed) return [parsed];
      }
    } catch (e) { }
    return [];
  });

  const [activeTrackedCode, setActiveTrackedCode] = useState(() => {
    try {
      return localStorage.getItem('daybyday_active_tracked_code') || '';
    } catch {
      return '';
    }
  });

  // Derived currently selected tracked partner
  const trackedPartner = useMemo(() => {
    if (!trackedPartners || !trackedPartners.length) return null;
    if (activeTrackedCode) {
      const found = trackedPartners.find(
        (p) => (p.secretCode || p.secret_code || '').toUpperCase() === activeTrackedCode.toUpperCase()
      );
      if (found) return found;
    }
    return trackedPartners[0];
  }, [trackedPartners, activeTrackedCode]);

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

  // Custom Categories state (persisted)
  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('daybyday_categories');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['Daily', 'Health', 'Fitness', 'Mind', 'Work'];
  });

  const addCustomCategory = (name) => {
    if (!name || typeof name !== 'string') return;
    const trimmed = name.trim();
    if (!trimmed) return;
    let nextCategories = [];
    setCustomCategories((prev) => {
      if (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return prev;
      nextCategories = [...prev, trimmed];
      try { localStorage.setItem('daybyday_categories', JSON.stringify(nextCategories)); } catch {}
      return nextCategories;
    });
    if (user?.id && nextCategories.length > 0) {
      const updatedPrefs = {
        themeColor,
        themeMode,
        useMaterial3Theme,
        customCategories: nextCategories,
        profilePicture,
        activeFocusHabitId,
        beyondGoals,
      };
      syncUserHabitsRemote(user.id, habits, updatedPrefs).catch(() => {});
    }
  };

  const deleteCustomCategory = (name) => {
    if (!name || name === 'All' || name === 'Daily') return;
    const cleanName = name.trim();
    let nextCategories = [];
    setCustomCategories((prev) => {
      nextCategories = prev.filter((c) => c.toLowerCase() !== cleanName.toLowerCase());
      try { localStorage.setItem('daybyday_categories', JSON.stringify(nextCategories)); } catch {}
      return nextCategories;
    });
    // Migrate habits in the deleted category to Daily
    let updatedHabits = [];
    setHabits((prev) => {
      updatedHabits = prev.map((h) => {
        if ((h.category || '').toLowerCase() === cleanName.toLowerCase()) {
          return { ...h, category: 'Daily' };
        }
        return h;
      });
      try { localStorage.setItem('daybyday_habits', JSON.stringify(updatedHabits)); } catch {}
      return updatedHabits;
    });

    // Cloud sync category removal and habit migration
    if (user?.id) {
      const updatedPrefs = {
        themeColor,
        themeMode,
        useMaterial3Theme,
        customCategories: nextCategories,
        profilePicture,
        activeFocusHabitId,
        beyondGoals,
      };
      syncUserHabitsRemote(user.id, updatedHabits, updatedPrefs).catch(() => {});
    }
  };

  // Pinned Habit & Live Notifications removed per user request
  const pinnedHabitId = null;
  const pinHabitForLiveTracking = () => {};
  const unpinHabitForLiveTracking = () => {};

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

  const stopLiveActivity = () => {
    // Live activity is disabled; no-op stub
  };

  const setLiveActivityEnabled = (enabled) => {
    setLiveActivityEnabledState(Boolean(enabled));
    localStorage.setItem('daybyday_live_activity_enabled', String(enabled));
    if (!enabled) {
      stopLiveActivity();
    }
  };

  // Memoized Active Focus Habit (ONLY returned if explicitly pinned by user!)
  const activeFocusHabit = useMemo(() => {
    if (!habits || habits.length === 0 || !pinnedHabitId) return null;
    return habits.find((h) => h.id === pinnedHabitId) || null;
  }, [habits, pinnedHabitId]);

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

  useEffect(() => {
    if (useMaterial3Theme) {
      document.documentElement.setAttribute('data-theme-m3', 'true');
    } else {
      document.documentElement.removeAttribute('data-theme-m3');
    }
  }, [useMaterial3Theme]);

  // Persistent Storage Vault initialization (iOS Safari ITP protection & Android WebView recovery)
  useEffect(() => {
    initPersistentStorage();

    const checkVaultSession = async () => {
      try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem('daybyday_signed_out') === 'true') {
          setIsSessionRestoring(false);
          return;
        }

        const recovered = await recoverSessionFromVault();
        if (!user) {
          if (recovered && recovered.user) {
            setUser(recovered.user);
            if (recovered.partner) setPartner(recovered.partner);
            if (recovered.habits && recovered.habits.length) setHabits(recovered.habits);
            if (recovered.pod) setPod(recovered.pod);
            if (recovered.groupPod) setGroupPod(recovered.groupPod);
            if (recovered.trackedPartners && recovered.trackedPartners.length) {
              setTrackedPartners(recovered.trackedPartners);
            }
            if (recovered.activeTrackedCode) {
              setActiveTrackedCode(recovered.activeTrackedCode);
            }
          }
        } else {
          // If user loaded from localStorage, ensure groupPod & trackedPartners are also restored if missing locally
          if (!groupPod && recovered?.groupPod) {
            setGroupPod(recovered.groupPod);
          }
          if ((!trackedPartners || !trackedPartners.length) && recovered?.trackedPartners?.length) {
            setTrackedPartners(recovered.trackedPartners);
          }
          if (!activeTrackedCode && recovered?.activeTrackedCode) {
            setActiveTrackedCode(recovered.activeTrackedCode);
          }
          persistSessionSnapshot(
            user, partner, habits, pod, groupPod || recovered?.groupPod,
            (trackedPartners && trackedPartners.length) ? trackedPartners : recovered?.trackedPartners,
            activeTrackedCode || recovered?.activeTrackedCode
          );
        }

        // Automatic Cloud Sync on Startup: pull latest preferences, habits & secret code from Cloud DB
        const activeUser = user || recovered?.user;
        if (activeUser?.username) {
          fetchUserRemote(activeUser.username).then(async (remoteData) => {
            if (remoteData && remoteData.user) {
              // Sync secret code — ensures Track screen shows the current server-side code, not a stale cache
              const freshCode = remoteData.user.secretCode || remoteData.user.secret_code;
              if (freshCode && freshCode !== activeUser.secretCode && freshCode !== activeUser.secret_code) {
                const updatedUser = { ...activeUser, secretCode: freshCode, secret_code: freshCode };
                setUser(updatedUser);
                localStorage.setItem('daybyday_user', JSON.stringify(updatedUser));
              }

              if (remoteData.habits && Array.isArray(remoteData.habits) && remoteData.habits.length > 0) {
                setHabits(remoteData.habits);
                localStorage.setItem('daybyday_habits', JSON.stringify(remoteData.habits));
              }
              if (remoteData.preferences) {
                applyPreferences(remoteData.preferences);
              }
              if (remoteData.partner) {
                setPartner(remoteData.partner);
                localStorage.setItem('daybyday_partner', JSON.stringify(remoteData.partner));
              }
              if (remoteData.podCode) {
                setPod((prev) => ({ ...prev, code: remoteData.podCode, isPaired: Boolean(remoteData.partner) }));
              }
              // Restore Together Group Pod from Cloud
              if (remoteData.groupPod) {
                setGroupPod(remoteData.groupPod);
                localStorage.setItem('daybyday_group_pod', JSON.stringify(remoteData.groupPod));
              } else if (!groupPod) {
                try {
                  const foundPod = await getUserGroupPodRemote(activeUser.id, activeUser.username);
                  if (foundPod) {
                    setGroupPod(foundPod);
                    localStorage.setItem('daybyday_group_pod', JSON.stringify(foundPod));
                  }
                } catch {}
              }
            }
          }).catch(() => {});
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
      persistSessionSnapshot(user, partner, habits, pod, groupPod, trackedPartners, activeTrackedCode);
    }
  }, [user, partner, habits, pod, groupPod, trackedPartners, activeTrackedCode]);

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

  // LIVE CLOUD SYNCHRONIZATION: Adaptive sync (event-driven on focus + 35s idle poll, zero polling when hidden)
  useEffect(() => {
    if (!pod.isPaired || !pod.code) return;

    let lastKnownTimestamp = 0;

    const performSync = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;

      try {
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
                triggerIslandNotification(remoteData.lastActivity, 'flame');
                sound.complete();
              }
            }
          }
        } else if (remoteData && remoteData.notFound) {
          pushFullSync(pod.code, activeUserId, pod, habits);
          setSyncStatus('synced');
        }
      } catch {
        // Silent catch for offline resiliency
      }
    };

    // 35-second idle poll (conserves Neon DB compute units)
    const syncInterval = setInterval(performSync, 35000);

    // Immediate sync on tab visibility or window focus
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        performSync();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [pod.code, pod.isPaired, activeUserId, habits]);

  // Trigger Dynamic Island temporary expansion banner
  const triggerIslandNotification = (text, icon = 'zap') => {
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

        // 1. Cross-platform System Notification (Android Native Status Bar Banner + iOS Web App)
        dispatchHabitNotification(h).catch(() => {});

        // 2. Dynamic Island in-app banner with habit-relevant copy
        const copy = getHabitNotificationContent(h);
        triggerIslandNotification(`${copy.title} · ${copy.body}`, 'clock');

        // 3. Audio cue & haptics
        sound.complete();
      });
    };

    const reminderTimer = setInterval(checkScheduledReminders, 25000);
    checkScheduledReminders();
    return () => clearInterval(reminderTimer);
  }, [habits]);

  // Apply all user preferences & customizations from remote DB or local vault
  const applyPreferences = (prefs) => {
    if (!prefs || typeof prefs !== 'object') return;

    if (prefs.themeColor) {
      setThemeColor(prefs.themeColor);
      localStorage.setItem('daybyday_theme', prefs.themeColor);
      document.documentElement.setAttribute('data-theme', prefs.themeColor);
    }
    if (prefs.themeMode) {
      setThemeModeState(prefs.themeMode);
      localStorage.setItem('daybyday_theme_mode', prefs.themeMode);
      document.documentElement.setAttribute('data-theme-mode', prefs.themeMode);
    }
    if (prefs.useMaterial3Theme !== undefined) {
      const isM3 = Boolean(prefs.useMaterial3Theme);
      setUseMaterial3ThemeState(isM3);
      localStorage.setItem('daybyday_material3', String(isM3));
      if (isM3) {
        document.documentElement.setAttribute('data-theme-m3', 'true');
      } else {
        document.documentElement.removeAttribute('data-theme-m3');
      }
    }
    if (prefs.customCategories && Array.isArray(prefs.customCategories) && prefs.customCategories.length) {
      setCustomCategories(prefs.customCategories);
      localStorage.setItem('daybyday_categories', JSON.stringify(prefs.customCategories));
    }
    if (prefs.profilePicture !== undefined) {
      setProfilePictureState(prefs.profilePicture);
      if (prefs.profilePicture) {
        localStorage.setItem('daybyday_profile_pic', prefs.profilePicture);
      } else {
        localStorage.removeItem('daybyday_profile_pic');
      }
    }
    if (prefs.activeFocusHabitId !== undefined) {
      setActiveFocusHabitIdState(prefs.activeFocusHabitId || '');
      if (prefs.activeFocusHabitId) {
        localStorage.setItem('daybyday_focus_habit_id', prefs.activeFocusHabitId);
      } else {
        localStorage.removeItem('daybyday_focus_habit_id');
      }
    }
    if (prefs.beyondGoals && Array.isArray(prefs.beyondGoals) && prefs.beyondGoals.length) {
      setBeyondGoals(prefs.beyondGoals);
      localStorage.setItem('daybyday_beyond', JSON.stringify(prefs.beyondGoals));
    }
    if (prefs.trackedPartnerCodes && Array.isArray(prefs.trackedPartnerCodes) && prefs.trackedPartnerCodes.length) {
      const currentCodes = trackedPartners.map((p) => (p.secretCode || p.secret_code || '').toUpperCase());
      const missing = prefs.trackedPartnerCodes.filter((c) => c && !currentCodes.includes(c.toUpperCase()));
      if (missing.length > 0) {
        Promise.all(missing.map((c) => fetchUserByCodeRemote(c))).then((results) => {
          const loaded = [];
          results.forEach((remote, idx) => {
            if (remote && remote.user) {
              const partnerHabits = remote.habits || [];
              const total = partnerHabits.length;
              const completed = partnerHabits.filter((h) => {
                const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
                return isBool ? Boolean(h.user1) : (Number(h.user1) || 0) >= (Number(h.target) || 1);
              }).length;
              const calcPct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const calcStreak = partnerHabits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);
              const actualCode = missing[idx].toUpperCase();
              loaded.push({
                ...remote.user,
                habits: partnerHabits,
                streak: remote.streak ?? calcStreak,
                todayPercent: remote.todayPercent ?? calcPct,
                profilePicture: remote.preferences?.profilePicture || remote.user?.profilePicture || null,
                lastActive: 'Active today',
                secretCode: actualCode,
                secret_code: actualCode,
              });
            }
          });
          if (loaded.length > 0) {
            setTrackedPartners((prev) => {
              const merged = [...prev];
              loaded.forEach((item) => {
                if (!merged.some((p) => (p.secretCode || p.secret_code || '').toUpperCase() === item.secretCode.toUpperCase())) {
                  merged.push(item);
                }
              });
              const capped = merged.slice(0, 5);
              localStorage.setItem('daybyday_tracked_partners', JSON.stringify(capped));
              return capped;
            });
          }
        }).catch(() => {});
      }
    }
  };

  // Automatic real-time preference sync to Cloud DB
  const isInitialPrefsMount = useRef(true);
  useEffect(() => {
    if (isInitialPrefsMount.current) {
      isInitialPrefsMount.current = false;
      return;
    }
    if (!user?.id) return;

    const trackedCodes = trackedPartners.map((p) => p.secretCode || p.secret_code).filter(Boolean);
    const currentPreferences = {
      themeColor,
      themeMode,
      useMaterial3Theme,
      customCategories,
      profilePicture,
      activeFocusHabitId,
      beyondGoals,
      trackedPartnerCodes: trackedCodes,
      groupPodCode: groupPod?.code || null,
    };

    const timer = setTimeout(() => {
      syncPreferencesRemote(user.id, currentPreferences).catch(() => {});
    }, 600);

    return () => clearTimeout(timer);
  }, [themeColor, themeMode, useMaterial3Theme, customCategories, profilePicture, activeFocusHabitId, beyondGoals, trackedPartners, groupPod?.code, user?.id]);

  // Register New User (Supports remote Neon DB backend with automatic local Storage Vault fallback)
  const registerUser = async (username, password, displayName = '', avatar = '', securityQuestion = '', securityAnswer = '') => {
    sound.complete();
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');
    const cleanDisplay = displayName || cleanUsername;
    const cleanAvatar = (!avatar || avatar === 'star' || avatar === 'user') ? '' : avatar;
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

    // Clean fresh default preferences for newly registered accounts
    const freshPrefs = {
      themeColor: 'sunset',
      themeMode: 'dark',
      useMaterial3Theme: false,
      customCategories: ['Daily', 'Health', 'Fitness', 'Mind'],
      profilePicture: null,
      activeFocusHabitId: '',
      beyondGoals: [],
    };

    // Clear any stale local account records for this username
    localStorage.removeItem(`daybyday_local_acc_${cleanUsername}`);
    localStorage.removeItem(`duotrack_local_acc_${cleanUsername}`);

    try {
      const res = await registerUserRemote(cleanUsername, password, cleanDisplay, cleanAvatar, securityQuestion, securityAnswer);
      if (res && res.user) {
        newUser = res.user;
        // Immediately sync fresh initial habits and default sunset preferences to cloud account
        syncUserHabitsRemote(newUser.id, INITIAL_HABITS, freshPrefs).catch(() => {});
      }
    } catch (err) {
      const msg = formatErrorMessage(err);
      console.warn('Registration notice:', msg);
      if (msg.toLowerCase().includes('already taken') || msg.toLowerCase().includes('exists')) {
        throw new Error('Username is already taken. Please choose another username or sign in.');
      }
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('unreachable')) {
        throw new Error('Unable to connect to DayByDay Cloud. Please check your internet connection.');
      }
      throw new Error(msg);
    }

    // Apply fresh preferences immediately to UI
    applyPreferences(freshPrefs);
    setHabits(INITIAL_HABITS);
    localStorage.setItem('daybyday_habits', JSON.stringify(INITIAL_HABITS));

    // Always store offline credential record in vault so native/offline access is instantaneous
    localStorage.setItem(`daybyday_local_acc_${cleanUsername}`, JSON.stringify({
      user: newUser,
      password,
      preferences: freshPrefs,
      securityQuestion,
      securityAnswer: (securityAnswer || '').trim().toLowerCase(),
    }));

    try {
      localStorage.removeItem('daybyday_signed_out');
      removeVaultItem('daybyday_signed_out').catch(() => {});
    } catch {}

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
    triggerIslandNotification(`Welcome @${newUser.username}!`, 'sparkles');
    return newUser;
  };

  // Login Existing User (Automatically syncs all customizations, preferences, and habits from DB)
  const loginUser = async (username, password) => {
    sound.complete();
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');
    let remoteError = null;

    // Flush any cached credentials from other accounts
    Object.keys(localStorage).forEach((k) => {
      if ((k.startsWith('daybyday_local_acc_') || k.startsWith('duotrack_local_acc_')) && !k.endsWith(`_${cleanUsername}`)) {
        localStorage.removeItem(k);
      }
    });

    try {
      const res = await loginUserRemote(cleanUsername, password);
      if (res && res.user) {
        const secretCode = res.user.secretCode || res.user.secret_code || `DBD-${Math.floor(1000 + Math.random() * 9000)}`;
        const loggedInUser = {
          ...res.user,
          secretCode,
          secret_code: secretCode,
        };

        try {
          localStorage.removeItem('daybyday_signed_out');
          removeVaultItem('daybyday_signed_out').catch(() => {});
        } catch {}

        setUser(loggedInUser);

        // 1. Restore & format habits from DB
        if (res.habits && Array.isArray(res.habits) && res.habits.length > 0) {
          setHabits(res.habits);
          localStorage.setItem('daybyday_habits', JSON.stringify(res.habits));
        } else if (habits && habits.length > 0) {
          // If DB has no habits, seed it with current habits
          syncUserHabitsRemote(loggedInUser.id, habits).catch(() => {});
        }

        // 2. Restore all Preferences & Customizations from DB
        const prefs = res.preferences || loggedInUser.preferences || {};
        applyPreferences(prefs);

        if (res.partner) {
          setPartner(res.partner);
          localStorage.setItem('daybyday_partner', JSON.stringify(res.partner));
        }

        if (res.groupPod) {
          setGroupPod(res.groupPod);
          localStorage.setItem('daybyday_group_pod', JSON.stringify(res.groupPod));
        } else {
          getUserGroupPodRemote(loggedInUser.id, loggedInUser.username).then((foundPod) => {
            if (foundPod) {
              setGroupPod(foundPod);
              localStorage.setItem('daybyday_group_pod', JSON.stringify(foundPod));
            }
          }).catch(() => {});
        }
        setPod((prev) => ({
          ...prev,
          code: res.podCode || secretCode,
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

        // Cache credentials and preferences locally in vault for immediate offline access
        localStorage.setItem(`daybyday_local_acc_${cleanUsername}`, JSON.stringify({
          user: res.user,
          password,
          preferences: prefs,
          securityQuestion: res.user.securityQuestion || '',
          securityAnswer: res.user.securityAnswer || '',
        }));

        triggerCelebration();
        triggerIslandNotification(`Welcome back @${res.user.username}!`, 'user');
        return res;
      }
    } catch (err) {
      remoteError = formatErrorMessage(err);
      console.warn('Remote login notice:', remoteError);
      // If server explicitly rejected password or user credentials
      if (remoteError.includes('Invalid username') || remoteError.toLowerCase().includes('password')) {
        throw new Error(remoteError);
      }
    }

    // Local Vault Fallback (For offline use or local accounts)
    const localAcc = localStorage.getItem(`daybyday_local_acc_${cleanUsername}`);
    if (localAcc) {
      try {
        const parsed = JSON.parse(localAcc);
        if (parsed.password === password) {
          setUser(parsed.user);
          if (parsed.preferences) applyPreferences(parsed.preferences);
          triggerCelebration();
          triggerIslandNotification(`Welcome back @${parsed.user.username}!`, 'user');
          return { user: parsed.user };
        } else {
          throw new Error('Incorrect password. Please verify and try again.');
        }
      } catch (e) {
        if (e.message.includes('password')) throw e;
      }
    }

    // Error reporting
    if (remoteError) {
      if (remoteError.toLowerCase().includes('failed to fetch') || remoteError.toLowerCase().includes('network')) {
        throw new Error('Unable to connect to cloud. Please check your internet connection.');
      }
      throw new Error(remoteError);
    }
    throw new Error(`Account @${cleanUsername} not found. Check your username or tap "Create Account".`);
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
    } catch (err) {
      throw new Error(formatErrorMessage(err, 'Failed to reset password'));
    }

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
    triggerIslandNotification('Password reset successfully!', 'key');
    return { ok: true };
  };

  // Logout / Switch Account: Cleanly flush all user-specific cache and reset preferences to defaults
  const logoutUser = async () => {
    sound.tap();

    // 1. Immediately mark user as explicitly signed out so page reloads NEVER auto-login
    try {
      localStorage.setItem('daybyday_signed_out', 'true');
    } catch {}

    setUser(null);
    setPartner(null);
    setTrackedPartner(null);
    setTrackedPartners([]);
    setActiveTrackedCode('');
    setGroupPod(null);
    setProfilePicture(null);
    setActiveFocusHabitId('');
    setBeyondGoals([]);

    // 2. Clear all user storage keys (both daybyday_ and legacy duotrack_)
    const keysToRemove = [
      'daybyday_user',
      'daybyday_partner',
      'daybyday_tracked_partner',
      'daybyday_tracked_partners',
      'daybyday_active_tracked_code',
      'daybyday_group_pod',
      'daybyday_profile_picture',
      'daybyday_profile_pic',
      'daybyday_active_focus_habit',
      'daybyday_focus_habit_id',
      'daybyday_beyond_goals',
      'daybyday_beyond',
      'daybyday_theme',
      'daybyday_theme_mode',
      'daybyday_custom_categories',
      'daybyday_categories',
      'daybyday_habits',
      'daybyday_pod',
      'duotrack_user',
      'duotrack_partner',
      'duotrack_tracked_partner',
      'duotrack_habits',
      'duotrack_pod',
      'duotrack_group_pod',
    ];

    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });

    // Wipe cached local account credentials
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('daybyday_local_acc_') || k.startsWith('duotrack_local_acc_')) {
        try { localStorage.removeItem(k); } catch {}
      }
    });

    // Reset preferences to default Sunset theme
    setThemeColor('sunset');
    setThemeMode('dark');
    document.documentElement.setAttribute('data-theme', 'sunset');
    document.documentElement.setAttribute('data-theme-mode', 'dark');
    setCustomCategories(['Daily', 'Health', 'Fitness', 'Mind']);
    setHabits(INITIAL_HABITS);

    // Completely clear persistent vault
    await clearVaultSession();
    triggerIslandNotification('Signed out', 'user');
  };

  // Reorder habit up or down
  const reorderHabit = (habitId, direction) => {
    sound.tap();
    setHabits((prev) => {
      const idx = prev.findIndex((h) => h.id === habitId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      localStorage.setItem('daybyday_habits', JSON.stringify(copy));
      return copy;
    });
  };

  // Reorder habit directly to target index (atomic drag-and-drop)
  const reorderHabitToIndex = (habitId, targetIdx) => {
    sound.press();
    setHabits((prev) => {
      const fromIdx = prev.findIndex((h) => h.id === habitId);
      if (fromIdx === -1 || targetIdx < 0 || targetIdx >= prev.length || fromIdx === targetIdx) {
        return prev;
      }
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(targetIdx, 0, moved);
      localStorage.setItem('daybyday_habits', JSON.stringify(copy));
      return copy;
    });
  };

  // Track Partner by Secret Code (Multi-Partner support up to 5 friends)
  const selectTrackedPartner = (code) => {
    sound.tap();
    const clean = (code || '').toUpperCase().trim();
    setActiveTrackedCode(clean);
    localStorage.setItem('daybyday_active_tracked_code', clean);
  };

  const trackPartnerByCode = async (code) => {
    if (!code || !code.trim()) throw new Error('Please enter a valid secret code');
    const cleanCode = code.trim().toUpperCase();

    // Limit check: up to 5 partners
    const existingIdx = trackedPartners.findIndex(
      (p) => (p.secretCode || p.secret_code || '').toUpperCase() === cleanCode
    );
    if (existingIdx === -1 && trackedPartners.length >= 5) {
      throw new Error('You are tracking the maximum of 5 partners. Please untrack someone before adding another.');
    }

    sound.complete();
    let partnerData = null;
    let fetchError = null;
    try {
      let remote = await fetchUserByCodeRemote(cleanCode);
      if (!remote || !remote.user) {
        remote = await fetchUserRemote(cleanCode);
      }
      if (remote && remote.user) {
        const partnerHabits = remote.habits || [];
        const total = partnerHabits.length;
        const completed = partnerHabits.filter((h) => {
          const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
          return isBool ? Boolean(h.user1) : (Number(h.user1) || 0) >= (Number(h.target) || 1);
        }).length;
        const calcPct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const calcStreak = partnerHabits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);
        const actualCode = remote.user.secretCode || remote.user.secret_code || cleanCode;

        partnerData = {
          ...remote.user,
          habits: partnerHabits,
          streak: remote.streak ?? calcStreak,
          todayPercent: remote.todayPercent ?? calcPct,
          profilePicture: remote.preferences?.profilePicture || remote.user?.profilePicture || null,
          lastActive: 'Active today',
          secretCode: actualCode,
          secret_code: actualCode,
        };
      } else if (remote && remote.error) {
        fetchError = remote.error;
      }
    } catch (err) {
      fetchError = err.message;
    }

    if (!partnerData) {
      const myCurrentCode = user?.secretCode || user?.secret_code;
      const formatHint = myCurrentCode ? ` Codes look like "${myCurrentCode}".` : '';
      throw new Error(
        fetchError && !fetchError.toLowerCase().includes('not found')
          ? fetchError
          : `No user found with code "${cleanCode}".${formatHint} Ask your friend to share their code from the Track screen.`
      );
    }

    let updatedList = [];
    if (existingIdx >= 0) {
      updatedList = [...trackedPartners];
      updatedList[existingIdx] = partnerData;
    } else {
      updatedList = [...trackedPartners, partnerData];
    }

    setTrackedPartners(updatedList);
    setActiveTrackedCode(cleanCode);
    localStorage.setItem('daybyday_tracked_partners', JSON.stringify(updatedList));
    localStorage.setItem('daybyday_tracked_partner', JSON.stringify(partnerData));
    localStorage.setItem('daybyday_active_tracked_code', cleanCode);

    // Persist tracked partner codes to user cloud preferences
    if (user?.id) {
      const codes = updatedList.map((p) => p.secretCode || p.secret_code).filter(Boolean);
      syncPreferencesRemote(user.id, { ...(user.preferences || {}), trackedPartnerCodes: codes }).catch(() => {});
    }

    triggerCelebration();
    triggerIslandNotification(`Tracking @${partnerData.username}!`, 'target');
    return partnerData;
  };

  // Periodically refresh progress for all tracked friends
  const refreshTrackedPartners = useCallback(async () => {
    if (!trackedPartners || !trackedPartners.length) return;
    try {
      const refreshedList = await Promise.all(
        trackedPartners.map(async (p) => {
          const pCode = p.secretCode || p.secret_code;
          if (!pCode) return p;
          try {
            let res = await fetchUserByCodeRemote(pCode);
            if (!res || !res.user) res = await fetchUserRemote(pCode);
            if (res && res.user) {
              const partnerHabits = res.habits || [];
              const total = partnerHabits.length;
              const completed = partnerHabits.filter((h) => {
                const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
                return isBool ? Boolean(h.user1) : (Number(h.user1) || 0) >= (Number(h.target) || 1);
              }).length;
              const calcPct = total > 0 ? Math.round((completed / total) * 100) : 0;
              const calcStreak = partnerHabits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);
              return {
                ...p,
                ...res.user,
                habits: partnerHabits,
                streak: res.streak ?? calcStreak,
                todayPercent: res.todayPercent ?? calcPct,
                profilePicture: res.preferences?.profilePicture || res.user?.profilePicture || p.profilePicture,
                lastActive: 'Active today',
                secretCode: pCode,
                secret_code: pCode,
              };
            }
          } catch {}
          return p;
        })
      );
      setTrackedPartners(refreshedList);
      localStorage.setItem('daybyday_tracked_partners', JSON.stringify(refreshedList));
    } catch {}
  }, [trackedPartners]);

  // Auto-refresh tracked friends' progress on focus and periodically
  useEffect(() => {
    if (!trackedPartners || !trackedPartners.length) return;
    refreshTrackedPartners();
    const interval = setInterval(refreshTrackedPartners, 45000);
    const onFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refreshTrackedPartners();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [trackedPartners.length, refreshTrackedPartners]);

  const untrackPartner = (codeToUntrack) => {
    sound.tap();
    const targetCode = (codeToUntrack || trackedPartner?.secretCode || trackedPartner?.secret_code || '').toUpperCase();
    const updated = trackedPartners.filter(
      (p) => (p.secretCode || p.secret_code || '').toUpperCase() !== targetCode
    );
    setTrackedPartners(updated);
    localStorage.setItem('daybyday_tracked_partners', JSON.stringify(updated));

    if (updated.length > 0) {
      const nextCode = updated[0].secretCode || updated[0].secret_code;
      setActiveTrackedCode(nextCode);
      localStorage.setItem('daybyday_active_tracked_code', nextCode);
      localStorage.setItem('daybyday_tracked_partner', JSON.stringify(updated[0]));
    } else {
      setActiveTrackedCode('');
      localStorage.removeItem('daybyday_active_tracked_code');
      localStorage.removeItem('daybyday_tracked_partner');
    }

    if (user?.id) {
      const codes = updated.map((p) => p.secretCode || p.secret_code);
      syncPreferencesRemote(user.id, { ...(user.preferences || {}), trackedPartnerCodes: codes }).catch(() => {});
    }

    triggerIslandNotification('Stopped tracking partner', 'untrack');
  };

  // Send Cheer / Encouragement
  const sendCheer = async (targetUserId, targetUsername, targetName, targetAvatar) => {
    sound.complete();
    triggerCelebration();

    const username = targetUsername || 'partner';
    triggerIslandNotification(`Cheer sent to @${username}! 🔥`, 'flame');

    try {
      await sendCheerRemote({
        toUserId: targetUserId,
        fromUserId: user?.id,
        fromUsername: user?.username || 'friend',
        fromName: user?.displayName || user?.username || 'Friend',
        fromAvatar: user?.avatar || 'flame',
        podCode: groupPod?.code,
        message: 'Keep crushing your goals! 🔥',
      });
    } catch (e) {
      console.warn('Cheer delivery notice:', e);
    }
  };

  // Group Pod (up to 10 users)
  const createGroupPod = async (name) => {
    sound.complete();
    const cleanName = (name || 'Focus Group').trim();
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const randChar = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const podCode = `POD-${randNum}${randChar}`;
    const defaultGoals = [
      {
        id: 'sg_steps',
        name: 'Team 10k Steps',
        target: 10000,
        unit: 'steps',
        icon: 'steps',
        category: 'Fitness',
        delta: 1000,
        current: 0,
        memberProgress: {},
      },
      {
        id: 'sg_water',
        name: 'Daily Hydration',
        target: 8,
        unit: 'glasses',
        icon: 'water',
        category: 'Health',
        delta: 1,
        current: 0,
        memberProgress: {},
      },
    ];

    let newPod = null;
    try {
      newPod = await createGroupPodRemote(user?.id, cleanName, podCode, defaultGoals);
    } catch (e) {
      console.warn('Remote group pod creation notice:', e.message);
    }

    if (!newPod) {
      newPod = {
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
            avatar: user?.avatar || 'star',
            profilePicture: profilePicture || null,
            role: 'Owner',
            todayPercent: currentPercent,
            streak: pod.currentStreak || 0,
          },
        ],
        sharedGoals: defaultGoals,
      };
    }

    setGroupPod(newPod);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(newPod));
    if (user?.id) {
      syncPreferencesRemote(user.id, { ...(user.preferences || {}), groupPodCode: newPod.code }).catch(() => {});
    }
    triggerCelebration();
    triggerIslandNotification(`Group ${cleanName} created!`, 'users');
    return newPod;
  };

  const joinGroupPod = async (code) => {
    sound.complete();
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a pod code');

    let podToJoin = null;
    try {
      podToJoin = await joinGroupPodRemote(user?.id, cleanCode);
    } catch (e) {
      throw new Error(e.message || `Group pod "${cleanCode}" not found. Verify the code and try again.`);
    }

    if (!podToJoin) {
      throw new Error(`Group pod "${cleanCode}" not found. Verify the code and try again.`);
    }

    setGroupPod(podToJoin);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(podToJoin));
    if (user?.id) {
      syncPreferencesRemote(user.id, { ...(user.preferences || {}), groupPodCode: podToJoin.code }).catch(() => {});
    }
    triggerCelebration();
    triggerIslandNotification(`Joined Pod ${cleanCode}!`, 'users');
    return podToJoin;
  };

  const leaveGroupPod = async () => {
    sound.tap();
    if (groupPod?.code && user?.id) {
      leaveGroupPodRemote(groupPod.code, user.id).catch(() => {});
      syncPreferencesRemote(user.id, { ...(user.preferences || {}), groupPodCode: null }).catch(() => {});
    }
    setGroupPod(null);
    localStorage.removeItem('daybyday_group_pod');
    triggerIslandNotification('Left group pod', 'user');
  };

  const addSharedGoal = async (goalOrName, target, unit, delta, category) => {
    sound.complete();
    if (!groupPod) return;

    let goalObj = {};
    if (typeof goalOrName === 'object' && goalOrName !== null) {
      goalObj = goalOrName;
    } else {
      goalObj = {
        name: String(goalOrName || 'Shared Goal').trim(),
        target: Number(target) || 1,
        unit: (unit || 'times').trim(),
        delta: Number(delta) || 1,
        category: category || 'Daily',
      };
    }

    const currentMemberId = user?.id || user?.username || 'usr_me';
    const initProg = {
      value: 0,
      completed: false,
      updatedAt: new Date().toISOString(),
    };
    const initialMemberProgress = {
      [currentMemberId]: initProg,
    };
    if (user?.id) initialMemberProgress[user.id] = initProg;
    if (user?.username) initialMemberProgress[user.username] = initProg;

    const newGoal = {
      id: goalObj.id || `sg_${Date.now().toString(36)}`,
      name: (goalObj.name || 'Shared Goal').trim(),
      target: Math.max(1, Number(goalObj.target) || 1),
      unit: (goalObj.unit || 'times').trim(),
      icon: goalObj.icon || 'target',
      category: goalObj.category || 'Daily',
      delta: Math.max(1, Number(goalObj.delta) || 1),
      createdBy: currentMemberId,
      current: 0,
      memberProgress: initialMemberProgress,
      createdAt: new Date().toISOString(),
    };

    const updatedGoals = [...(groupPod.sharedGoals || []), newGoal];
    const updatedPod = { ...groupPod, sharedGoals: updatedGoals };
    setGroupPod(updatedPod);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(updatedPod));

    if (groupPod.code) {
      try {
        const res = await addGroupGoalRemote(groupPod.code, newGoal);
        if (res) {
          setGroupPod(res);
          localStorage.setItem('daybyday_group_pod', JSON.stringify(res));
        }
      } catch (err) {
        console.warn('Remote add group goal notice:', err);
      }
    }

    triggerCelebration();
    sound.complete();
    triggerIslandNotification('Shared goal added to pod!', 'target');
  };

  const updateSharedGoalProgress = async (goalId, delta, explicitValue) => {
    if (!groupPod) return;

    const myKey = user?.id || user?.username || 'usr_me';
    let newCompletedState = false;

    const updatedGoals = (groupPod.sharedGoals || []).map((g) => {
      if (g.id === goalId) {
        const memberProgress = { ...(g.memberProgress || {}) };
        const prevEntry = memberProgress[myKey] ??
                          (user?.id ? memberProgress[user.id] : undefined) ??
                          (user?.username ? memberProgress[user.username] : undefined) ??
                          memberProgress['user1'] ??
                          { value: 0, completed: false };

        const currentVal = typeof prevEntry === 'object'
          ? (Number(prevEntry.value) || 0)
          : (Number(prevEntry) || 0);

        let nextVal = explicitValue !== undefined
          ? Math.max(0, Number(explicitValue))
          : Math.max(0, currentVal + (Number(delta) || 0));

        newCompletedState = nextVal >= (Number(g.target) || 1);
        const updatedEntry = {
          value: nextVal,
          completed: newCompletedState,
          updatedAt: new Date().toISOString(),
        };

        memberProgress[myKey] = updatedEntry;
        if (user?.id) memberProgress[user.id] = updatedEntry;
        if (user?.username) memberProgress[user.username] = updatedEntry;

        const totalSum = Object.values(memberProgress).reduce(
          (acc, m) => acc + (typeof m === 'object' ? (Number(m.value) || 0) : (Number(m) || 0)),
          0
        );

        return {
          ...g,
          current: totalSum,
          memberProgress,
        };
      }
      return g;
    });

    const updatedPod = { ...groupPod, sharedGoals: updatedGoals };
    setGroupPod(updatedPod);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(updatedPod));

    if (newCompletedState) {
      sound.complete();
      triggerCelebration();
    } else {
      sound.step();
    }

    if (groupPod.code) {
      updateGroupGoalRemote(
        groupPod.code,
        goalId,
        delta,
        myKey,
        explicitValue,
        newCompletedState
      ).catch(() => {});
    }
  };

  const editSharedGoal = async (goalId, updates) => {
    sound.press();
    if (!groupPod) return;

    const updatedGoals = (groupPod.sharedGoals || []).map((g) => {
      if (g.id === goalId) {
        return {
          ...g,
          name: updates.name ? updates.name.trim() : g.name,
          target: updates.target ? Math.max(1, Number(updates.target) || 1) : g.target,
          unit: updates.unit ? updates.unit.trim() : g.unit,
          delta: updates.delta ? Math.max(1, Number(updates.delta) || 1) : g.delta,
          category: updates.category || g.category,
        };
      }
      return g;
    });

    const updatedPod = { ...groupPod, sharedGoals: updatedGoals };
    setGroupPod(updatedPod);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(updatedPod));

    if (groupPod.code) {
      try {
        const baseUrl = getApiBaseUrl();
        await fetch(`${baseUrl}/api/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'edit_group_goal',
            podCode: groupPod.code,
            goalId,
            updates,
          }),
        });
      } catch {}
    }
    triggerIslandNotification('Pod goal updated', 'check');
  };

  const deleteSharedGoal = async (goalId) => {
    sound.warning();
    if (!groupPod) return;
    const filtered = (groupPod.sharedGoals || []).filter((g) => g.id !== goalId);
    const updatedPod = { ...groupPod, sharedGoals: filtered };
    setGroupPod(updatedPod);
    localStorage.setItem('daybyday_group_pod', JSON.stringify(updatedPod));

    if (groupPod.code) {
      deleteGroupGoalRemote(groupPod.code, goalId).catch(() => {});
    }
    triggerIslandNotification('Shared goal removed', 'trash');
  };

  // Adaptive sync of Group Pod roster, shared goals & incoming cheers (35s idle poll, zero polling when hidden)
  const receivedCheerIdsRef = useRef(new Set());
  useEffect(() => {
    if (!groupPod?.code && !user?.id) return;
    let isMounted = true;

    const refreshPodAndCheers = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;

      // 1. Group pod refresh
      if (groupPod?.code) {
        try {
          const remote = await getGroupPodRemote(groupPod.code);
          if (remote && isMounted) {
            setGroupPod((prev) => {
              if (!prev) return remote;
              return {
                ...prev,
                members: remote.members || prev.members,
                sharedGoals: remote.sharedGoals || prev.sharedGoals,
              };
            });
            localStorage.setItem('daybyday_group_pod', JSON.stringify(remote));
          }
        } catch {}
      }

      // 2. Incoming cheers check
      if (user?.id) {
        try {
          const cheers = await fetchCheersRemote(user.id, groupPod?.code);
          if (Array.isArray(cheers) && cheers.length > 0) {
            for (const c of cheers) {
              const cheerKey = `${c.id}_${c.created_at}`;
              if (!receivedCheerIdsRef.current.has(cheerKey) && c.from_username !== user.username) {
                receivedCheerIdsRef.current.add(cheerKey);
                sound.complete();
                triggerCelebration();
                triggerIslandNotification(`🔥 @${c.from_username} cheered you on!`, 'flame');
                break;
              }
            }
          }
        } catch {}
      }
    };

    refreshPodAndCheers();
    const interval = setInterval(refreshPodAndCheers, 35000);

    const handleFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        refreshPodAndCheers();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [groupPod?.code, user?.id, user?.username]);


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
        triggerIslandNotification(`Paired with @${res.partner.username}!`, 'users');
        return res;
      }
    } catch (err) {
      // Fallback local pairing if server is offline
      const partnerName = cleanCode.split('-')[0] || 'Partner';
      const fallbackPartner = {
        username: partnerName.toLowerCase(),
        displayName: partnerName,
        secretCode: cleanCode,
        avatar: ''
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
      triggerIslandNotification(`Paired with ${partnerName}!`, 'users');
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
      code: user?.secretCode || user?.secret_code || 'DBD-1000',
      user2: { name: 'Partner', email: '', initial: 'P' }
    }));
    triggerIslandNotification('Solo mode active', 'user');
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
          triggerIslandNotification(`${h.name} completed!`, 'check');
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
      delta: Math.max(1, Number(newGoal.delta) || (newGoal.unit === 'steps' ? 1000 : 1)),
    };
    setHabits((prev) => {
      const next = [...prev, safeGoal];
      if (user?.id) {
        syncUserHabitsRemote(user.id, next).catch(() => {});
      }
      return next;
    });
    triggerIslandNotification(`Added habit: ${safeGoal.name}`, 'plus');
  };

  // Remove Goal
  const removeGoal = (goalId) => {
    sound.tap();
    if (pinnedHabitId === goalId) {
      unpinHabitForLiveTracking();
    }
    setHabits((prev) => prev.filter((h) => h.id !== goalId));
    if (user?.id) {
      deleteHabitRemote(user.id, goalId).catch(() => {});
    }
    triggerIslandNotification('Habit removed', 'trash');
  };

  // Edit Goal (Name, Target, Step Delta, Reminders)
  const editHabit = (goalId, updates) => {
    sound.tap();
    setHabits((prev) => {
      const next = prev.map((h) => {
        if (h.id === goalId) {
          const updated = { ...h, ...updates };
          if (updates.target !== undefined && typeof updated.user1 === 'number') {
            updated.completed = updated.user1 >= updated.target;
          }
          if (updates.delta !== undefined) {
            updated.delta = Math.max(1, Number(updates.delta) || 1);
          }
          return updated;
        }
        return h;
      });
      if (user?.id) {
        syncUserHabitsRemote(user.id, next).catch(() => {});
      }
      return next;
    });
    triggerIslandNotification('Habit updated', 'check');
  };

  // Request Notifications (Native Android channel & prompt, iOS Web App & Web)
  const requestNotificationPermission = async () => {
    return await requestAppNotificationPermission();
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

  // Import local backup file
  const importData = (jsonString) => {
    sound.tap();
    const result = parseLocalBackup(jsonString);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const d = result.data;
    if (d.user) setUser(d.user);
    if (d.partner) setPartner(d.partner);
    if (Array.isArray(d.habits) && d.habits.length > 0) setHabits(d.habits);
    if (Array.isArray(d.beyondGoals)) setBeyondGoals(d.beyondGoals);
    if (d.pod) setPod(d.pod);
    if (d.themeColor) setThemeColor(d.themeColor);
    if (d.themeMode) setThemeMode(d.themeMode);
    triggerIslandNotification('Backup data restored successfully', 'sparkles');
    return { success: true };
  };

  // Wipe data and reset to fresh state
  const resetAllData = async () => {
    sound.tap();
    unpinHabitForLiveTracking();
    wipeLocalData();
    setUser(null);
    setPartner(null);
    setHabits(INITIAL_HABITS);
    setBeyondGoals(INITIAL_BEYOND);
    await clearVaultSession();
  };

  // Wipe data AND delete account permanently from Neon DB & Cloud
  const deleteAccountPermanently = async () => {
    sound.tap();
    try {
      const API_URL = getApiBaseUrl();
      if (user?.id || user?.username) {
        await fetch(`${API_URL}/api/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_account',
            userId: user?.id,
            username: user?.username,
          }),
        }).catch((e) => console.warn('Remote account deletion fallback:', e));
      }
    } catch (e) {
      console.error('Delete account error:', e);
    }

    unpinHabitForLiveTracking();
    wipeLocalData();
    try {
      localStorage.removeItem('daybyday_pinned_habit_id');
      localStorage.removeItem('daybyday_profile_pic');
      localStorage.removeItem('daybyday_custom_categories');
      localStorage.removeItem('daybyday_active_focus_habit');
      localStorage.removeItem('daybyday_focus_habit_id');
      localStorage.removeItem('daybyday_user');
      localStorage.removeItem('daybyday_habits');
      localStorage.removeItem('daybyday_pod');
    } catch {}

    setUser(null);
    setPartner(null);
    setHabits(INITIAL_HABITS);
    setBeyondGoals(INITIAL_BEYOND);
    setProfilePicture(null);
    setCustomCategories(['Daily', 'Health', 'Fitness', 'Mind', 'Work']);
    await clearVaultSession();
    triggerIslandNotification('Account and all data wiped permanently', 'trash');
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
        triggerIslandNotification('Synced with Cloud', 'cloud');
      } else if (remoteData && remoteData.notFound) {
        await pushFullSync(pod.code, activeUserId, pod, habits);
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());
        triggerIslandNotification('Pod initialized on Cloud', 'cloud');
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
        useMaterial3Theme,
        setUseMaterial3Theme,
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
        isLiveActivitySupported: () => false,
        requestLiveActivityPermission: async () => false,
        updateHabit,
        editHabit,
        updateBeyondGoal,
        addGoal,
        removeGoal,
        pinnedHabitId,
        pinHabitForLiveTracking,
        unpinHabitForLiveTracking,
        deleteAccountPermanently,
        triggerCelebration,
        requestNotificationPermission,
        exportData,
        importData,
        resetAllData,
        reorderHabit,
        reorderHabitToIndex,
        customCategories,
        addCustomCategory,
        deleteCustomCategory,
        profilePicture,
        setProfilePicture,
        trackedPartners,
        activeTrackedCode,
        selectTrackedPartner,
        trackedPartner,
        trackPartnerByCode,
        untrackPartner,
        sendCheer,
        groupPod,
        createGroupPod,
        joinGroupPod,
        leaveGroupPod,
        addSharedGoal,
        editSharedGoal,
        updateSharedGoalProgress,
        deleteSharedGoal,
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
