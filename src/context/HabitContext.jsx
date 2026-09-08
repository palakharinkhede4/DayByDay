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
  syncHealthDataRemote,
  syncPreferencesRemote,
  pairPartnerRemote,
  unpairPartnerRemote,
  deleteHabitRemote,
  createGroupPodRemote,
  joinGroupPodRemote,
  getGroupPodRemote,
  getUserGroupPodRemote,
  getUserGroupPodsRemote,
  addGroupGoalRemote,
  updateGroupGoalRemote,
  deleteGroupGoalRemote,
  leaveGroupPodRemote,
  editGroupNameRemote,
  sendCheerRemote,
  fetchCheersRemote,
  markCheersReadRemote,
  hasRemoteBackend,
  getApiBaseUrl,
  formatErrorMessage,
} from '../utils/api';
import {
  getHabitNotificationContent,
  requestAppNotificationPermission,
  dispatchHabitNotification,
  dispatchCheerNotification,
  getOrRegisterServiceWorker,
} from '../utils/notifications';
import {
  initPersistentStorage,
  persistSessionSnapshot,
  recoverSessionFromVault,
  clearVaultSession,
  removeVaultItem,
} from '../utils/storageVault';
import {
  checkHealthPermission,
  requestHealthPermission,
  importDeviceHealthStats,
  syncHealthDataToHabitsAndPod,
  isHealthSyncEnabled,
  setHealthSyncEnabled,
  getStoredHealthData,
  updateCustomHealthStats,
} from '../utils/fitnessSync';

export const resolveEffectiveTheme = (mode) => {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

export const calculatePartnerCompletionPercent = (partnerHabits) => {
  if (!partnerHabits || !Array.isArray(partnerHabits) || partnerHabits.length === 0) return 0;
  const total = partnerHabits.length;
  const totalProgress = partnerHabits.reduce((acc, h) => {
    const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
    if (isBool) {
      return acc + (Boolean(h.user1) ? 100 : 0);
    }
    const val = Math.max(0, Number(h.user1) || 0);
    const target = Math.max(1, Number(h.target) || 1);
    const pct = Math.min(100, Math.round((val / target) * 100));
    return acc + pct;
  }, 0);
  return Math.round(totalProgress / total);
};

export function isHabitMatchingSharedGoal(h, sg) {
  if (!h || !sg) return false;
  const hId = (h.id || '').toLowerCase();
  const hName = (h.name || '').toLowerCase();
  const hUnit = (h.unit || '').toLowerCase();
  const sgName = (sg.name || '').toLowerCase();
  const sgUnit = (sg.unit || '').toLowerCase();

  // 1. Direct name match
  if (hName === sgName) return true;

  // 2. Unit match (if specific unit like glasses, cups, steps, pages, min, km, etc.)
  if (hUnit && sgUnit && hUnit === sgUnit) return true;

  // 3. Semantic keyword matching:
  // Water / Daily Hydration (matches "Water" <-> "Daily Hydration")
  const isWaterH = hId.includes('water') || hName.includes('water') || hName.includes('hydrat') || hUnit.includes('glass') || hUnit.includes('cup');
  const isWaterSG = sgName.includes('water') || sgName.includes('hydrat') || sgUnit.includes('glass') || sgUnit.includes('cup');
  if (isWaterH && isWaterSG) return true;

  // Steps / Walking / Running
  const isStepH = hId === 'steps' || hUnit === 'steps' || hName.includes('step') || hName.includes('walk') || hName.includes('run');
  const isStepSG = sgUnit === 'steps' || sgName.includes('step') || sgName.includes('walk') || sgName.includes('run');
  if (isStepH && isStepSG) return true;

  // Reading / Book / Pages
  const isReadH = hId.includes('read') || hName.includes('read') || hName.includes('book') || hUnit.includes('page');
  const isReadSG = sgName.includes('read') || sgName.includes('book') || sgUnit.includes('page');
  if (isReadH && isReadSG) return true;

  // Meditation / Mindfulness
  const isMedH = hId.includes('meditat') || hName.includes('meditat') || hName.includes('mindful');
  const isMedSG = sgName.includes('meditat') || sgName.includes('mindful');
  if (isMedH && isMedSG) return true;

  // Workout / Exercise / Fitness / Gym
  const isWorkH = hId.includes('workout') || hName.includes('workout') || hName.includes('exercise') || hName.includes('gym') || hName.includes('train');
  const isWorkSG = sgName.includes('workout') || sgName.includes('exercise') || sgName.includes('gym') || sgName.includes('train');
  if (isWorkH && isWorkSG) return true;

  // Sleep
  const isSleepH = hId.includes('sleep') || hName.includes('sleep');
  const isSleepSG = sgName.includes('sleep');
  if (isSleepH && isSleepSG) return true;

  // 4. Substring containment
  if (hName.length >= 3 && sgName.includes(hName)) return true;
  if (sgName.length >= 3 && hName.includes(sgName)) return true;

  return false;
}

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

export function getLocalDateKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateConsecutiveStreak(history, target, isBoolean) {
  if (!history || typeof history !== 'object') return 0;
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = getLocalDateKey(d);
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

export function getCleanDailyHabits(rawHabits, targetDateKey = getLocalDateKey()) {
  if (!rawHabits || !Array.isArray(rawHabits)) return INITIAL_HABITS;
  return rawHabits.map((h) => {
    const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
    const history = (h.history && typeof h.history === 'object') ? { ...h.history } : {};
    const hasTodayEntry = history[targetDateKey] !== undefined;
    const todayVal = hasTodayEntry
      ? history[targetDateKey]
      : (isBool ? false : 0);

    const isCompleted = isBool ? Boolean(todayVal) : (Number(todayVal) || 0) >= (Number(h.target) || 1);
    const streak = calculateConsecutiveStreak(history, h.target, isBool);

    let extra = {};
    if (h.id === 'sleep') {
      const hrs = Math.floor(Number(todayVal) || 0);
      const mins = Math.round(((Number(todayVal) || 0) - hrs) * 60);
      extra.user1Display = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
      extra.user2Display = '0h';
    }

    return {
      ...h,
      user1: todayVal,
      user2: isBool ? false : 0,
      completed: isCompleted,
      streak,
      history,
      ...extra,
    };
  });
}

export function enrichPartnerHabitsWithHealthAndGroup(partnerHabits, remoteUser, remotePrefs, groupPod) {
  let habitsList = Array.isArray(partnerHabits) ? [...partnerHabits] : [];
  const remoteHealth = remotePrefs?.healthData || remoteUser?.preferences?.healthData;
  const pId = remoteUser?.id ? String(remoteUser.id) : null;
  const pUsername = (remoteUser?.username || '').toLowerCase();
  const pCode = (remoteUser?.secretCode || remoteUser?.secret_code || '').toUpperCase();

  // 1. Check preferences.healthData
  let stepsVal = remoteHealth?.steps ? Number(remoteHealth.steps) : 0;

  // 2. Cross-reference groupPod.sharedGoals
  if (groupPod && Array.isArray(groupPod.sharedGoals)) {
    for (const sg of groupPod.sharedGoals) {
      const su = (sg.unit || '').toLowerCase();
      const sn = (sg.name || '').toLowerCase();
      if (su === 'steps' || sn.includes('step') || sn.includes('walk')) {
        const memberProg = sg.memberProgress || {};
        const entry = (pId && memberProg[pId] !== undefined)
          ? memberProg[pId]
          : (pUsername && memberProg[pUsername] !== undefined)
            ? memberProg[pUsername]
            : (pCode && memberProg[pCode] !== undefined)
              ? memberProg[pCode]
              : undefined;
        const num = typeof entry === 'object' ? Number(entry.value) : Number(entry);
        if (!isNaN(num) && num > stepsVal) {
          stepsVal = num;
        }
      }
    }
  }

  if (stepsVal > 0) {
    const stepIdx = habitsList.findIndex((h) =>
      (h.id || '').toLowerCase() === 'steps' ||
      (h.unit || '').toLowerCase() === 'steps' ||
      (h.name || '').toLowerCase().includes('step')
    );
    if (stepIdx >= 0) {
      if ((Number(habitsList[stepIdx].user1) || 0) < stepsVal) {
        habitsList[stepIdx] = {
          ...habitsList[stepIdx],
          user1: stepsVal,
          completed: stepsVal >= (Number(habitsList[stepIdx].target) || 10000),
        };
      }
    } else {
      habitsList.unshift({
        id: 'steps',
        name: 'Steps',
        category: 'Daily',
        description: 'Daily steps from device',
        target: 10000,
        unit: 'steps',
        icon: 'steps',
        user1: stepsVal,
        user2: 0,
        completed: stepsVal >= 10000,
        streak: 1,
      });
    }
  }

  return habitsList;
}

export const HabitProvider = ({ children }) => {
  const firedRemindersRef = useRef(new Set());
  const isCrossSyncingRef = useRef(false);
  const isHealthSyncRunningRef = useRef(false);

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
    const effective = resolveEffectiveTheme(mode);
    document.documentElement.setAttribute('data-theme-mode', effective);
    document.documentElement.setAttribute('data-theme-preference', mode);
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

  // Untracked partner codes ref to prevent in-flight network queries from re-adding untracked friends
  const untrackedCodesRef = useRef(new Set());

  // Multiple Group Pods (up to 5 pods simultaneously)
  const [groupPods, setGroupPods] = useState(() => {
    try {
      const savedMulti = localStorage.getItem('daybyday_group_pods');
      if (savedMulti) {
        const parsed = JSON.parse(savedMulti);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
      const savedSingle = localStorage.getItem('daybyday_group_pod');
      if (savedSingle) {
        const parsed = JSON.parse(savedSingle);
        if (parsed) return [parsed];
      }
    } catch (e) { }
    return [];
  });

  const [activeGroupPodCode, setActiveGroupPodCode] = useState(() => {
    try {
      return localStorage.getItem('daybyday_active_group_pod_code') || '';
    } catch {
      return '';
    }
  });

  // Derived currently selected group pod
  const groupPod = useMemo(() => {
    if (!groupPods || !groupPods.length) return null;
    if (activeGroupPodCode) {
      const found = groupPods.find((p) => (p.code || '').toUpperCase() === activeGroupPodCode.toUpperCase());
      if (found) return found;
    }
    return groupPods[0];
  }, [groupPods, activeGroupPodCode]);

  const selectGroupPod = useCallback((code) => {
    sound.tap();
    const clean = (code || '').toUpperCase();
    setActiveGroupPodCode(clean);
    try { localStorage.setItem('daybyday_active_group_pod_code', clean); } catch {}
  }, []);

  // Multi-pod updater for compatibility with existing setGroupPod callers
  const setGroupPod = useCallback((podOrUpdater) => {
    setGroupPods((prev) => {
      let updatedActive;
      if (typeof podOrUpdater === 'function') {
        const active = (activeGroupPodCode && prev.find(p => (p.code || '').toUpperCase() === activeGroupPodCode.toUpperCase())) || prev[0] || null;
        updatedActive = podOrUpdater(active);
      } else {
        updatedActive = podOrUpdater;
      }

      if (!updatedActive) {
        const targetCode = (activeGroupPodCode || prev[0]?.code || '').toUpperCase();
        const nextList = prev.filter(p => (p.code || '').toUpperCase() !== targetCode);
        try {
          localStorage.setItem('daybyday_group_pods', JSON.stringify(nextList));
          if (nextList.length) {
            localStorage.setItem('daybyday_group_pod', JSON.stringify(nextList[0]));
            localStorage.setItem('daybyday_active_group_pod_code', nextList[0].code);
            setActiveGroupPodCode(nextList[0].code);
          } else {
            localStorage.removeItem('daybyday_group_pod');
            localStorage.removeItem('daybyday_active_group_pod_code');
            setActiveGroupPodCode('');
          }
        } catch {}
        return nextList;
      }

      const cleanCode = (updatedActive.code || '').toUpperCase();
      const idx = prev.findIndex(p => (p.code || '').toUpperCase() === cleanCode);
      let nextList;
      if (idx >= 0) {
        nextList = [...prev];
        nextList[idx] = updatedActive;
      } else {
        nextList = [updatedActive, ...prev].slice(0, 5);
      }
      try {
        localStorage.setItem('daybyday_group_pods', JSON.stringify(nextList));
        localStorage.setItem('daybyday_group_pod', JSON.stringify(updatedActive));
        localStorage.setItem('daybyday_active_group_pod_code', cleanCode);
      } catch {}
      setActiveGroupPodCode(cleanCode);
      return nextList;
    });
  }, [activeGroupPodCode]);

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

  // Habits list (Cleaned and auto-reset on startup if crossing 12 AM local midnight)
  const [habits, setHabits] = useState(() => {
    const todayKey = getLocalDateKey();
    const lastActiveDate = localStorage.getItem('daybyday_last_active_date');
    const isNewDay = lastActiveDate !== todayKey;

    const saved = localStorage.getItem('daybyday_habits') || localStorage.getItem('duotrack_habits');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasLegacyMock = parsed.some((h) => (h.id === 'steps' && h.user1 === 6200) || (h.id === 'sleep' && h.user1 === 7.2));
        if (hasLegacyMock) {
          localStorage.removeItem('daybyday_habits');
          localStorage.removeItem('duotrack_habits');
          localStorage.setItem('daybyday_last_active_date', todayKey);
          return INITIAL_HABITS;
        }
        if (isNewDay) {
          const cleanList = getCleanDailyHabits(parsed, todayKey);
          try {
            localStorage.setItem('daybyday_habits', JSON.stringify(cleanList));
            localStorage.setItem('daybyday_last_active_date', todayKey);
          } catch {}
          return cleanList;
        }
        return parsed;
      } catch (e) { }
    }
    try { localStorage.setItem('daybyday_last_active_date', todayKey); } catch {}
    return INITIAL_HABITS;
  });

  const habitsRef = useRef(habits);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const lastActiveDateRef = useRef(getLocalDateKey());

  const groupPodRef = useRef(groupPod);
  useEffect(() => {
    groupPodRef.current = groupPod;
  }, [groupPod]);

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

  // Native Health & Fitness Sync state (persisted across restarts)
  const [healthSyncEnabled, setHealthSyncEnabledState] = useState(() => isHealthSyncEnabled());
  const [healthStats, setHealthStats] = useState(() => getStoredHealthData());

  // App Features & Onboarding Tour modal state
  const [isFeaturesGuideOpen, setIsFeaturesGuideOpen] = useState(false);
  const openFeaturesGuide = () => setIsFeaturesGuideOpen(true);
  const closeFeaturesGuide = () => setIsFeaturesGuideOpen(false);

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
    const applyTheme = () => {
      const effective = resolveEffectiveTheme(themeMode);
      document.documentElement.setAttribute('data-theme-mode', effective);
      document.documentElement.setAttribute('data-theme-preference', themeMode);
    };

    applyTheme();

    if (themeMode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        applyTheme();
      };
      if (mql.addEventListener) {
        mql.addEventListener('change', handleMediaChange);
        return () => mql.removeEventListener('change', handleMediaChange);
      } else if (mql.addListener) {
        mql.addListener(handleMediaChange);
        return () => mql.removeListener(handleMediaChange);
      }
    }
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
                const todayKey = getLocalDateKey();
                const cleanRemote = getCleanDailyHabits(remoteData.habits, todayKey);
                setHabits(cleanRemote);
                habitsRef.current = cleanRemote;
                localStorage.setItem('daybyday_habits', JSON.stringify(cleanRemote));
                if (activeUser.id) {
                  syncUserHabitsRemote(activeUser.id, cleanRemote).catch(() => {});
                }
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
              // Restore Together Group Pods from Cloud (Both/all pods)
              const remotePods = Array.isArray(remoteData.groupPods) && remoteData.groupPods.length > 0
                ? remoteData.groupPods
                : (remoteData.groupPod ? [remoteData.groupPod] : []);

              if (remotePods.length > 0) {
                setGroupPods(remotePods);
                try {
                  localStorage.setItem('daybyday_group_pods', JSON.stringify(remotePods));
                  localStorage.setItem('daybyday_group_pod', JSON.stringify(remotePods[0]));
                  if (!activeGroupPodCode && remotePods[0]?.code) {
                    setActiveGroupPodCode(remotePods[0].code);
                    localStorage.setItem('daybyday_active_group_pod_code', remotePods[0].code);
                  }
                } catch {}
              } else {
                try {
                  const userCode = freshCode || activeUser.secretCode || activeUser.secret_code;
                  const fetchedPods = await getUserGroupPodsRemote(activeUser.id, activeUser.username, userCode);
                  if (fetchedPods && fetchedPods.length > 0) {
                    setGroupPods(fetchedPods);
                    try {
                      localStorage.setItem('daybyday_group_pods', JSON.stringify(fetchedPods));
                      localStorage.setItem('daybyday_group_pod', JSON.stringify(fetchedPods[0]));
                      if (!activeGroupPodCode && fetchedPods[0]?.code) {
                        setActiveGroupPodCode(fetchedPods[0].code);
                        localStorage.setItem('daybyday_active_group_pod_code', fetchedPods[0].code);
                      }
                    } catch {}
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

  // Dual-layer session snapshot sync: debounced to prevent IndexedDB lockups during batch updates
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => {
      persistSessionSnapshot(user, partner, habits, pod, groupPod, trackedPartners, activeTrackedCode);
    }, 250);
    return () => clearTimeout(timer);
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
            const effective = resolveEffectiveTheme(e.newValue);
            document.documentElement.setAttribute('data-theme-mode', effective);
            document.documentElement.setAttribute('data-theme-preference', e.newValue);
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
      const effective = resolveEffectiveTheme(prefs.themeMode);
      document.documentElement.setAttribute('data-theme-mode', effective);
      document.documentElement.setAttribute('data-theme-preference', prefs.themeMode);
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
      const missing = prefs.trackedPartnerCodes.filter((c) => c && !currentCodes.includes(c.toUpperCase()) && !untrackedCodesRef.current.has(c.toUpperCase()));
      if (missing.length > 0) {
        Promise.all(missing.map((c) => fetchUserByCodeRemote(c))).then((results) => {
          const loaded = [];
          results.forEach((remote, idx) => {
            if (remote && remote.user) {
              const partnerHabits = remote.habits || [];
              const calcPct = calculatePartnerCompletionPercent(partnerHabits);
              const calcStreak = partnerHabits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);
              const actualCode = missing[idx].toUpperCase();
              loaded.push({
                ...remote.user,
                habits: partnerHabits,
                streak: remote.streak ?? calcStreak,
                todayPercent: (partnerHabits.length > 0) ? calcPct : (remote.todayPercent ?? 0),
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
    setIsFeaturesGuideOpen(true);
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
          const todayKey = getLocalDateKey();
          const cleanRemote = getCleanDailyHabits(res.habits, todayKey);
          setHabits(cleanRemote);
          habitsRef.current = cleanRemote;
          localStorage.setItem('daybyday_habits', JSON.stringify(cleanRemote));
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
        setIsFeaturesGuideOpen(true);
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
          setIsFeaturesGuideOpen(true);
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
    try {
      localStorage.setItem('daybyday_active_tracked_code', clean);
      const partner = trackedPartners.find(
        (p) => (p.secretCode || p.secret_code || '').toUpperCase() === clean
      );
      if (partner) {
        localStorage.setItem('daybyday_tracked_partner', JSON.stringify(partner));
      }
    } catch {}
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
        const rawHabits = remote.habits || [];
        const partnerHabits = enrichPartnerHabitsWithHealthAndGroup(
          rawHabits,
          remote.user,
          remote.preferences,
          groupPodRef.current || groupPod
        );
        const calcPct = calculatePartnerCompletionPercent(partnerHabits);
        const calcStreak = partnerHabits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);
        const actualCode = remote.user.secretCode || remote.user.secret_code || cleanCode;

        partnerData = {
          ...remote.user,
          habits: partnerHabits,
          streak: remote.streak ?? calcStreak,
          todayPercent: (partnerHabits.length > 0) ? calcPct : (remote.todayPercent ?? 0),
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

    untrackedCodesRef.current.delete(cleanCode);

    setTrackedPartners((prev) => {
      const idx = prev.findIndex((p) => (p.secretCode || p.secret_code || '').toUpperCase() === cleanCode);
      let updatedList = [];
      if (idx >= 0) {
        updatedList = [...prev];
        updatedList[idx] = partnerData;
      } else {
        updatedList = [...prev, partnerData].slice(0, 5);
      }
      try {
        localStorage.setItem('daybyday_tracked_partners', JSON.stringify(updatedList));
        localStorage.setItem('daybyday_tracked_partner', JSON.stringify(partnerData));
        localStorage.setItem('daybyday_active_tracked_code', cleanCode);
      } catch {}
      return updatedList;
    });

    setActiveTrackedCode(cleanCode);

    // Persist tracked partner codes to user cloud preferences and update local user state
    if (user?.id) {
      setUser((prevUser) => {
        if (!prevUser) return prevUser;
        const currentCodes = (prevUser.preferences?.trackedPartnerCodes || []).filter(c => c.toUpperCase() !== cleanCode);
        const nextCodes = [...currentCodes, cleanCode].slice(0, 5);
        return {
          ...prevUser,
          preferences: {
            ...(prevUser.preferences || {}),
            trackedPartnerCodes: nextCodes,
          },
        };
      });
      const allCodes = [...trackedPartners.map((p) => p.secretCode || p.secret_code), cleanCode].filter(Boolean);
      syncPreferencesRemote(user.id, { ...(user.preferences || {}), trackedPartnerCodes: [...new Set(allCodes)].slice(0, 5) }).catch(() => {});
    }

    triggerCelebration();
    triggerIslandNotification(`Tracking @${partnerData.username}!`, 'target');
    return partnerData;
  };

  // Periodically refresh progress for all tracked friends
  const refreshTrackedPartners = useCallback(async () => {
    setTrackedPartners((currentList) => {
      if (!currentList || !currentList.length) return currentList;

      const activeList = currentList.filter(
        (p) => !untrackedCodesRef.current.has((p.secretCode || p.secret_code || '').toUpperCase())
      );

      Promise.all(
        activeList.map(async (p) => {
          const pCode = p.secretCode || p.secret_code;
          if (!pCode || untrackedCodesRef.current.has(pCode.toUpperCase())) return p;
          try {
            let res = await fetchUserByCodeRemote(pCode);
            if (!res || !res.user) res = await fetchUserRemote(pCode);
            if (res && res.user) {
              const rawHabits = res.habits || [];
              const partnerHabits = enrichPartnerHabitsWithHealthAndGroup(
                rawHabits,
                res.user,
                res.preferences,
                groupPodRef.current || groupPod
              );
              const calcPct = calculatePartnerCompletionPercent(partnerHabits);
              const calcStreak = partnerHabits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);
              return {
                ...p,
                ...res.user,
                habits: partnerHabits,
                streak: res.streak ?? calcStreak,
                todayPercent: (partnerHabits.length > 0) ? calcPct : (res.todayPercent ?? 0),
                profilePicture: res.preferences?.profilePicture || res.user?.profilePicture || p.profilePicture,
                lastActive: 'Active today',
                secretCode: pCode,
                secret_code: pCode,
              };
            }
          } catch {}
          return p;
        })
      ).then((refreshedList) => {
        const filtered = refreshedList.filter(
          (p) => !untrackedCodesRef.current.has((p.secretCode || p.secret_code || '').toUpperCase())
        );
        setTrackedPartners(filtered);
        try { localStorage.setItem('daybyday_tracked_partners', JSON.stringify(filtered)); } catch {}
      });

      return activeList;
    });
  }, []);

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

  // 12:00 AM Daily Reset Throughout App
  const performDailyReset = useCallback(() => {
    const todayKey = getLocalDateKey();
    const prevDateKey = lastActiveDateRef.current;

    lastActiveDateRef.current = todayKey;
    try {
      localStorage.setItem('daybyday_last_active_date', todayKey);
    } catch {}

    setHabits((prev) => {
      const sourceList = (prev && prev.length) ? prev : habitsRef.current;
      const cleanList = (sourceList && sourceList.length ? sourceList : INITIAL_HABITS).map((h) => {
        const isBool = typeof h.user1 === 'boolean' || h.unit === 'check';
        const history = (h.history && typeof h.history === 'object') ? { ...h.history } : {};

        // Archive prior day's value if it existed and wasn't archived yet
        if (prevDateKey && prevDateKey !== todayKey && history[prevDateKey] === undefined && h.user1 !== undefined) {
          history[prevDateKey] = h.user1;
        }

        const streak = calculateConsecutiveStreak(history, h.target, isBool);

        let extra = {};
        if (h.id === 'sleep') {
          extra.user1Display = '0h';
          extra.user2Display = '0h';
        }

        return {
          ...h,
          user1: isBool ? false : 0,
          user2: isBool ? false : 0,
          completed: false,
          streak,
          history,
          ...extra,
        };
      });

      habitsRef.current = cleanList;
      try {
        localStorage.setItem('daybyday_habits', JSON.stringify(cleanList));
      } catch {}

      if (user?.id) {
        syncUserHabitsRemote(user.id, cleanList).catch(() => {});
      }

      return cleanList;
    });

    // Reset healthStats for the new day
    setHealthStats((prev) => {
      const resetStats = {
        ...(prev || {}),
        steps: 0,
        calories: 0,
        distanceKm: 0,
        syncedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem('daybyday_health_sync_data', JSON.stringify(resetStats));
      } catch {}
      return resetStats;
    });

    // Reset group pod shared goals progress for new day
    setGroupPod((prev) => {
      if (!prev || !Array.isArray(prev.sharedGoals)) return prev;
      const resetGoals = prev.sharedGoals.map((g) => ({
        ...g,
        progress: 0,
        completed: false,
        memberProgress: {},
      }));
      const updated = { ...prev, sharedGoals: resetGoals };
      try {
        localStorage.setItem('daybyday_group_pod', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // Refresh tracked partners for new day
    if (typeof refreshTrackedPartners === 'function') {
      refreshTrackedPartners();
    }
  }, [user?.id, refreshTrackedPartners, setGroupPod]);

  // Schedule midnight 12:00:01 AM local reset + multi-tier wake triggers
  useEffect(() => {
    let midnightTimer = null;

    const scheduleNextMidnight = () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
      const msUntilMidnight = Math.max(1000, tomorrow.getTime() - now.getTime());

      midnightTimer = setTimeout(() => {
        performDailyReset();
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    scheduleNextMidnight();

    // Catch app wakeup / tab un-minimize / phone unlock
    const checkDateOnWake = () => {
      const todayKey = getLocalDateKey();
      if (todayKey !== lastActiveDateRef.current) {
        performDailyReset();
        scheduleNextMidnight();
      }
    };

    window.addEventListener('focus', checkDateOnWake);
    window.addEventListener('visibilitychange', checkDateOnWake);

    // Heartbeat check every 30 seconds in case device slept through setTimeout
    const heartbeat = setInterval(checkDateOnWake, 30000);

    return () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      clearInterval(heartbeat);
      window.removeEventListener('focus', checkDateOnWake);
      window.removeEventListener('visibilitychange', checkDateOnWake);
    };
  }, [performDailyReset]);

  const untrackPartner = (codeToUntrack) => {
    sound.tap();
    const targetCode = (codeToUntrack || trackedPartner?.secretCode || trackedPartner?.secret_code || activeTrackedCode || '').toUpperCase();
    if (!targetCode) return;

    // Immediately mark in ref to block any in-flight background query
    untrackedCodesRef.current.add(targetCode);

    setTrackedPartners((prev) => {
      const remaining = prev.filter(
        (p) => (p.secretCode || p.secret_code || '').toUpperCase() !== targetCode
      );

      try {
        localStorage.setItem('daybyday_tracked_partners', JSON.stringify(remaining));
        if (remaining.length > 0) {
          const currentActive = (activeTrackedCode || '').toUpperCase();
          if (currentActive === targetCode) {
            const nextCode = remaining[0].secretCode || remaining[0].secret_code;
            setActiveTrackedCode(nextCode);
            localStorage.setItem('daybyday_active_tracked_code', nextCode);
            localStorage.setItem('daybyday_tracked_partner', JSON.stringify(remaining[0]));
          }
        } else {
          setActiveTrackedCode('');
          localStorage.removeItem('daybyday_active_tracked_code');
          localStorage.removeItem('daybyday_tracked_partner');
        }
      } catch {}

      if (user?.id) {
        const remainingCodes = remaining.map((p) => p.secretCode || p.secret_code).filter(Boolean);
        setUser((prevUser) => {
          if (!prevUser) return prevUser;
          return {
            ...prevUser,
            preferences: {
              ...(prevUser.preferences || {}),
              trackedPartnerCodes: remainingCodes,
            },
          };
        });
        syncPreferencesRemote(user.id, { ...(user.preferences || {}), trackedPartnerCodes: remainingCodes }).catch(() => {});
      }

      return remaining;
    });

    triggerIslandNotification('Stopped tracking partner', 'untrack');
  };

  // Send Cheer / Encouragement with goal context
  const sendCheer = async (target, customMessage, goalName) => {
    const toId = typeof target === 'object' && target !== null ? target.targetId : target;
    const toUname = typeof target === 'object' && target !== null ? target.targetUsername : target;
    const toCode = typeof target === 'object' && target !== null ? target.targetSecretCode : target;

    // Prevent self-cheering completely!
    const myCode = user?.secretCode || user?.secret_code;
    const isTargetingMe =
      (toId && user?.id && String(toId) === String(user.id)) ||
      (toUname && user?.username && String(toUname).toLowerCase() === String(user.username).toLowerCase()) ||
      (toCode && myCode && String(toCode).toUpperCase() === String(myCode).toUpperCase());

    if (isTargetingMe) {
      console.log('Skipping self cheer');
      return;
    }

    sound.complete();
    triggerCelebration();

    const msg = customMessage || (goalName ? `Encouraged you for ${goalName}!` : 'Keep crushing your goals!');

    try {
      await sendCheerRemote({
        toUserId: toId,
        toUsername: toUname,
        toSecretCode: toCode,
        fromUserId: user?.id,
        fromUsername: user?.username || 'friend',
        fromName: user?.displayName || user?.username || 'Friend',
        fromAvatar: user?.avatar || 'flame',
        podCode: groupPod?.code,
        message: msg,
        goalName,
      });
    } catch (e) {
      console.warn('Cheer delivery notice:', e);
    }
  };

  // Incoming Cheer Notification Listener (Notifies user when teammates encourage them)
  const seenCheerIdsRef = useRef(new Set());

  // Load previously seen cheer IDs from localStorage on mount so force-closing the app doesn't re-trigger them
  useEffect(() => {
    try {
      const saved = localStorage.getItem('daybyday_seen_cheer_ids');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => seenCheerIdsRef.current.add(id));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user?.id && !user?.username) return;

    let isSubscribed = true;
    const myCode = user?.secretCode || user?.secret_code;

    const checkCheers = async () => {
      try {
        const targetId = user.id || user.username;
        const cheers = await fetchCheersRemote(targetId, user.username, groupPod?.code, myCode);
        if (!isSubscribed || !Array.isArray(cheers) || cheers.length === 0) return;

        const unread = cheers.filter((c) => {
          if (!c || c.is_read) return false;
          if (seenCheerIdsRef.current.has(c.id)) return false;

          // 1. NEVER notify yourself of a cheer sent by yourself!
          const isFromMe =
            (user?.id && String(c.from_user_id) === String(user.id)) ||
            (user?.username && c.from_username && String(c.from_username).toLowerCase() === String(user.username).toLowerCase()) ||
            (user?.username && c.from_name && String(c.from_name).toLowerCase() === String(user.username).toLowerCase()) ||
            (myCode && c.from_user_id && String(c.from_user_id).toUpperCase() === String(myCode).toUpperCase());

          if (isFromMe) {
            seenCheerIdsRef.current.add(c.id);
            return false;
          }

          return true;
        });

        if (unread.length > 0) {
          unread.forEach((c) => {
            seenCheerIdsRef.current.add(c.id);

            // 1. Dynamic Island HUD
            const fromWho = c.from_name || (c.from_username ? `@${c.from_username}` : 'A teammate');
            const goalContext = c.goal_name || c.goalName;
            const islandText = goalContext
              ? `${fromWho} encouraged you for "${goalContext}"! 🔥`
              : `${fromWho}: "${c.message}"`;
            triggerIslandNotification(islandText, 'flame');

            // 2. Local OS & Web System Notification
            const notifTitle = goalContext
              ? `DayByDay · Encouraged for ${goalContext} 🔥`
              : `DayByDay Encouragement 🔥`;
            const notifBody = goalContext
              ? `${fromWho} cheered you on for "${goalContext}"! "${c.message}"`
              : `${fromWho} cheered you on: "${c.message}"`;

            dispatchCheerNotification({ title: notifTitle, body: notifBody });
          });

          // Save seen IDs to localStorage
          try {
            const arr = Array.from(seenCheerIdsRef.current).slice(-300);
            localStorage.setItem('daybyday_seen_cheer_ids', JSON.stringify(arr));
          } catch {}

          sound.complete();
          triggerCelebration();

          // Mark read on backend
          markCheersReadRemote(targetId, user.username).catch(() => {});
        }
      } catch {}
    };

    checkCheers();
    const interval = setInterval(checkCheers, 15000);

    const handleFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        checkCheers();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user?.id, user?.username, user?.secretCode, user?.secret_code, groupPod?.code]);

  // Active user streak computed dynamically from habits
  const activeUserStreak = useMemo(() => {
    if (!habits || !habits.length) return 0;
    return habits.reduce((acc, h) => Math.max(acc, Number(h.streak) || 0), 0);
  }, [habits]);

  // Group Pods (up to 5 groups, up to 10 members each)
  const createGroupPod = async (name) => {
    sound.complete();
    if (groupPods.length >= 5) {
      throw new Error('You can participate in up to 5 group pods simultaneously. Please leave a group before creating a new one.');
    }

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
            streak: activeUserStreak,
          },
        ],
        sharedGoals: defaultGoals,
      };
    }

    setGroupPod(newPod);
    if (user?.id) {
      const allPodCodes = [...groupPods.map((p) => p.code), newPod.code].filter(Boolean);
      syncPreferencesRemote(user.id, {
        ...(user.preferences || {}),
        groupPodCode: newPod.code,
        groupPodCodes: [...new Set(allPodCodes)].slice(0, 5),
      }).catch(() => {});
    }
    triggerCelebration();
    triggerIslandNotification(`Group ${cleanName} created!`, 'users');
    return newPod;
  };

  const joinGroupPod = async (code) => {
    sound.complete();
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Please enter a pod code');

    const alreadyJoined = groupPods.find((p) => (p.code || '').toUpperCase() === cleanCode);
    if (alreadyJoined) {
      selectGroupPod(cleanCode);
      triggerIslandNotification(`Switched to Group ${cleanCode}`, 'users');
      return alreadyJoined;
    }

    if (groupPods.length >= 5) {
      throw new Error('You can participate in up to 5 group pods simultaneously. Please leave a group before joining a new one.');
    }

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
    if (user?.id) {
      const allPodCodes = [...groupPods.map((p) => p.code), podToJoin.code].filter(Boolean);
      syncPreferencesRemote(user.id, {
        ...(user.preferences || {}),
        groupPodCode: podToJoin.code,
        groupPodCodes: [...new Set(allPodCodes)].slice(0, 5),
      }).catch(() => {});
    }
    triggerCelebration();
    triggerIslandNotification(`Joined Pod ${cleanCode}!`, 'users');
    return podToJoin;
  };

  const leaveGroupPod = async (codeToLeave) => {
    sound.tap();
    const targetCode = (codeToLeave || groupPod?.code || activeGroupPodCode || '').toUpperCase();
    if (targetCode && user?.id) {
      leaveGroupPodRemote(targetCode, user.id).catch(() => {});
      const remainingCodes = groupPods.filter((p) => (p.code || '').toUpperCase() !== targetCode).map((p) => p.code);
      syncPreferencesRemote(user.id, {
        ...(user.preferences || {}),
        groupPodCode: remainingCodes[0] || null,
        groupPodCodes: remainingCodes,
      }).catch(() => {});
    }
    setGroupPod(null);
    triggerIslandNotification('Left group pod', 'user');
  };

  // Pull all group pods belonging to current user from cloud
  const fetchUserGroupPods = useCallback(async () => {
    const myId = user?.id;
    const myUname = user?.username;
    const myCode = user?.secretCode || user?.secret_code;
    if (!myId && !myUname && !myCode) return [];

    try {
      const pods = await getUserGroupPodsRemote(myId, myUname, myCode);
      if (Array.isArray(pods) && pods.length > 0) {
        setGroupPods(pods);
        try {
          localStorage.setItem('daybyday_group_pods', JSON.stringify(pods));
          if (!activeGroupPodCode && pods[0]?.code) {
            setActiveGroupPodCode(pods[0].code);
            localStorage.setItem('daybyday_active_group_pod_code', pods[0].code);
          }
        } catch {}
        return pods;
      }
    } catch (e) {
      console.warn('Fetch user group pods notice:', e);
    }
    return [];
  }, [user?.id, user?.username, user?.secretCode, user?.secret_code, activeGroupPodCode]);

  // Option to edit group pod name
  const editGroupName = async (podCode, newName) => {
    if (!podCode || !newName?.trim()) return;
    const cleanCode = podCode.trim().toUpperCase();
    const trimmedName = newName.trim();
    sound.press();

    // 1. Optimistically update all groupPods in state & storage
    setGroupPods((prev) => {
      const nextList = (prev || []).map((p) =>
        (p.code || '').toUpperCase() === cleanCode ? { ...p, name: trimmedName } : p
      );
      try {
        localStorage.setItem('daybyday_group_pods', JSON.stringify(nextList));
        const active = nextList.find((p) => (p.code || '').toUpperCase() === cleanCode);
        if (active) localStorage.setItem('daybyday_group_pod', JSON.stringify(active));
      } catch {}
      return nextList;
    });

    try {
      const res = await editGroupNameRemote(cleanCode, trimmedName);
      const updatedPod = res?.pod || res;
      if (updatedPod && updatedPod.code) {
        setGroupPods((prev) => {
          const nextList = (prev || []).map((p) =>
            (p.code || '').toUpperCase() === cleanCode ? { ...p, ...updatedPod, name: trimmedName } : p
          );
          try {
            localStorage.setItem('daybyday_group_pods', JSON.stringify(nextList));
            const active = nextList.find((p) => (p.code || '').toUpperCase() === cleanCode);
            if (active) localStorage.setItem('daybyday_group_pod', JSON.stringify(active));
          } catch {}
          return nextList;
        });
      }
      triggerIslandNotification('Group name updated!', 'check');
    } catch (err) {
      console.warn('Edit group name error:', err);
    }
  };

  const addSharedGoal = async (goalOrName, target, unit, delta, category) => {
    if (!groupPod) return;
    sound.press();

    let goalObj;
    if (goalOrName && typeof goalOrName === 'object') {
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

    // Instant Stat Sync: Check if this new shared goal matches any existing habit in user's habits
    const latestHabits = (habitsRef.current && habitsRef.current.length) ? habitsRef.current : habits;
    const matchingHabit = (latestHabits || []).find((h) => isHabitMatchingSharedGoal(h, goalObj));
    let initialUserProgress = 0;
    if (matchingHabit) {
      initialUserProgress = typeof matchingHabit.user1 === 'boolean'
        ? (matchingHabit.user1 ? 1 : 0)
        : Math.max(0, Number(matchingHabit.user1) || 0);
    }

    const isGoalDone = initialUserProgress >= (Number(goalObj.target) || 1);
    const initialProgressEntry = {
      value: initialUserProgress,
      completed: isGoalDone,
      updatedAt: new Date().toISOString(),
    };

    const memberProgress = {};
    (groupPod.members || []).forEach((m) => {
      const isMe = m.id === currentMemberId || m.username === user?.username || m.id === user?.id;
      if (isMe) {
        memberProgress[m.id] = initialProgressEntry;
      } else {
        // Instant check: Look if this friend is tracked in trackedPartners
        let friendVal = 0;
        const matchingPartner = (trackedPartners || []).find((tp) =>
          (tp.id && m.id && String(tp.id) === String(m.id)) ||
          (tp.username && m.username && String(tp.username).toLowerCase() === String(m.username).toLowerCase()) ||
          (tp.secretCode && m.secretCode && String(tp.secretCode).toUpperCase() === String(m.secretCode).toUpperCase()) ||
          (tp.secret_code && m.secretCode && String(tp.secret_code).toUpperCase() === String(m.secretCode).toUpperCase())
        );

        if (matchingPartner && Array.isArray(matchingPartner.habits)) {
          const partnerHabit = matchingPartner.habits.find((h) => isHabitMatchingSharedGoal(h, goalObj));
          if (partnerHabit) {
            friendVal = typeof partnerHabit.user1 === 'boolean'
              ? (partnerHabit.user1 ? 1 : 0)
              : Math.max(0, Number(partnerHabit.user1) || 0);
          }
        }
        if (matchingPartner?.preferences?.healthData?.steps && (goalObj.unit === 'steps' || goalObj.name?.toLowerCase().includes('step'))) {
          friendVal = Math.max(friendVal, Number(matchingPartner.preferences.healthData.steps) || 0);
        }

        const friendDone = friendVal >= (Number(goalObj.target) || 1);
        const friendEntry = {
          value: friendVal,
          completed: friendDone,
          updatedAt: new Date().toISOString(),
        };
        memberProgress[m.id] = friendEntry;
        if (m.username) memberProgress[m.username] = friendEntry;
      }
    });
    memberProgress[currentMemberId] = initialProgressEntry;
    if (user?.id) memberProgress[user.id] = initialProgressEntry;
    if (user?.username) memberProgress[user.username] = initialProgressEntry;

    const initialTotalCurrent = Object.values(memberProgress).reduce(
      (acc, v) => acc + (typeof v === 'object' ? (Number(v.value) || 0) : (Number(v) || 0)),
      0
    );

    const newGoal = {
      id: goalObj.id || `sg_${Date.now().toString(36)}`,
      name: (goalObj.name || 'Shared Goal').trim(),
      target: Math.max(1, Number(goalObj.target) || 1),
      unit: (goalObj.unit || 'times').trim(),
      icon: goalObj.icon || 'target',
      category: goalObj.category || 'Daily',
      delta: Math.max(1, Number(goalObj.delta) || 1),
      createdBy: currentMemberId,
      current: initialTotalCurrent,
      memberProgress,
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

  const updateSharedGoalProgress = async (goalId, delta, explicitValue, silent = false, origin = 'user') => {
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

    if (!silent) {
      if (newCompletedState) {
        sound.complete();
        triggerCelebration();
      } else {
        sound.step();
      }
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

    // Bidirectional sync: propagate updated value to matching habit in Habits tab (STRICTLY GUARDED against recursion)
    if (origin !== 'habit' && !isCrossSyncingRef.current) {
      const matchedGoal = updatedGoals.find((g) => g.id === goalId);
      if (matchedGoal) {
        const latestHabits = (habitsRef.current && habitsRef.current.length) ? habitsRef.current : habits;
        const targetHabit = latestHabits.find((h) => isHabitMatchingSharedGoal(h, matchedGoal));
        if (targetHabit) {
          const myEntry = matchedGoal.memberProgress?.[myKey];
          const myVal = typeof myEntry === 'object' ? Number(myEntry.value) : Number(myEntry);
          if (myVal !== undefined && !isNaN(myVal) && Number(targetHabit.user1) !== myVal) {
            try {
              isCrossSyncingRef.current = true;
              updateHabit(targetHabit.id, 'user1', myVal, true, true, 'sharedGoal');
            } finally {
              isCrossSyncingRef.current = false;
            }
          }
        }
      }
    }
  };

  // Instant sync: Reconciles all shared goals with user's current habits (called on mount, goal add, & Together tab open)
  const syncTogetherPodWithHabits = async () => {
    if (!groupPod || !Array.isArray(groupPod.sharedGoals) || groupPod.sharedGoals.length === 0) return;
    const latestHabits = (habitsRef.current && habitsRef.current.length) ? habitsRef.current : habits;
    if (!latestHabits || !latestHabits.length) return;

    const myKey = user?.id || user?.username || 'usr_me';
    let podChanged = false;

    const reconciledGoals = groupPod.sharedGoals.map((sg) => {
      let goalChanged = false;
      const memberProgress = { ...(sg.memberProgress || {}) };

      // 1. Reconcile for current user (me)
      const matchingHabit = latestHabits.find((h) => isHabitMatchingSharedGoal(h, sg));
      if (matchingHabit) {
        const habitVal = typeof matchingHabit.user1 === 'boolean'
          ? (matchingHabit.user1 ? 1 : 0)
          : Math.max(0, Number(matchingHabit.user1) || 0);

        const myEntry = memberProgress[myKey] ??
                        (user?.id ? memberProgress[user.id] : undefined) ??
                        (user?.username ? memberProgress[user.username] : undefined) ??
                        memberProgress['user1'];

        const currentVal = typeof myEntry === 'object'
          ? (Number(myEntry?.value) || 0)
          : (Number(myEntry) || 0);

        if (habitVal !== currentVal) {
          goalChanged = true;
          const isDone = habitVal >= (Number(sg.target) || 1);
          const updatedEntry = {
            value: habitVal,
            completed: isDone,
            updatedAt: new Date().toISOString(),
          };
          memberProgress[myKey] = updatedEntry;
          if (user?.id) memberProgress[user.id] = updatedEntry;
          if (user?.username) memberProgress[user.username] = updatedEntry;

          if (groupPod.code) {
            updateGroupGoalRemote(groupPod.code, sg.id, 0, myKey, habitVal, isDone).catch(() => {});
          }
        }
      }

      // 2. Reconcile for any pod members present in trackedPartners
      (groupPod.members || []).forEach((m) => {
        const isMe = m.id === myKey || m.username === user?.username || m.id === user?.id;
        if (isMe) return;

        const matchingPartner = (trackedPartners || []).find((tp) =>
          (tp.id && m.id && String(tp.id) === String(m.id)) ||
          (tp.username && m.username && String(tp.username).toLowerCase() === String(m.username).toLowerCase()) ||
          (tp.secretCode && m.secretCode && String(tp.secretCode).toUpperCase() === String(m.secretCode).toUpperCase()) ||
          (tp.secret_code && m.secretCode && String(tp.secret_code).toUpperCase() === String(m.secretCode).toUpperCase())
        );

        if (matchingPartner && Array.isArray(matchingPartner.habits)) {
          const partnerHabit = matchingPartner.habits.find((h) => isHabitMatchingSharedGoal(h, sg));
          if (partnerHabit) {
            let partnerVal = typeof partnerHabit.user1 === 'boolean'
              ? (partnerHabit.user1 ? 1 : 0)
              : Math.max(0, Number(partnerHabit.user1) || 0);

            if (matchingPartner?.preferences?.healthData?.steps && (sg.unit === 'steps' || sg.name?.toLowerCase().includes('step'))) {
              partnerVal = Math.max(partnerVal, Number(matchingPartner.preferences.healthData.steps) || 0);
            }

            const currentEntry = memberProgress[m.id] ?? memberProgress[m.username];
            const curVal = typeof currentEntry === 'object' ? (Number(currentEntry?.value) || 0) : (Number(currentEntry) || 0);

            if (partnerVal > curVal) {
              goalChanged = true;
              const isDone = partnerVal >= (Number(sg.target) || 1);
              const updatedEntry = {
                value: partnerVal,
                completed: isDone,
                updatedAt: new Date().toISOString(),
              };
              memberProgress[m.id] = updatedEntry;
              if (m.username) memberProgress[m.username] = updatedEntry;
            }
          }
        }
      });

      if (goalChanged) {
        podChanged = true;
        const totalSum = Object.values(memberProgress).reduce(
          (acc, m) => acc + (typeof m === 'object' ? (Number(m.value) || 0) : (Number(m) || 0)),
          0
        );
        return {
          ...sg,
          current: totalSum,
          memberProgress,
        };
      }
      return sg;
    });

    if (podChanged) {
      // Use functional updater to avoid stale closure overwriting a freshly renamed pod
      setGroupPod((prev) => {
        if (!prev) return prev;
        const merged = { ...prev, sharedGoals: reconciledGoals };
        try { localStorage.setItem('daybyday_group_pod', JSON.stringify(merged)); } catch {}
        return merged;
      });
    }
  };

  // Unified global sync function: syncs all stats as soon as user opens or clicks any tab
  const syncAllStats = async (targetTab) => {
    try {
      // 1. Sync device health stats non-blockingly
      if (isHealthSyncEnabled()) {
        syncDeviceHealth({ silent: true, force: false }).catch(() => {});
      }

      // 2. Reconcile Together group goals with latest habits
      if (targetTab === 'together' || !targetTab) {
        syncTogetherPodWithHabits().catch(() => {});
      }

      // 3. Refresh group pod from cloud
      if (groupPod?.code) {
        getGroupPodRemote(groupPod.code).then((remote) => {
          if (remote) {
            setGroupPod((prev) => prev ? { ...prev, members: remote.members || prev.members, sharedGoals: remote.sharedGoals || prev.sharedGoals } : remote);
          }
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('syncAllStats notice:', err);
    }
  };

  // Auto-reconciliation: Ensure Habits progress always reflects into matching Together Group Pod shared goals
  useEffect(() => {
    if (!groupPod || !Array.isArray(groupPod.sharedGoals) || !Array.isArray(habits) || habits.length === 0) return;

    let podNeedsUpdate = false;
    const myKey = user?.id || user?.username || 'usr_me';

    const reconciledGoals = groupPod.sharedGoals.map((sg) => {
      const matchingHabit = habits.find((h) => isHabitMatchingSharedGoal(h, sg));
      if (!matchingHabit) return sg;

      const habitVal = typeof matchingHabit.user1 === 'boolean'
        ? (matchingHabit.user1 ? 1 : 0)
        : Math.max(0, Number(matchingHabit.user1) || 0);

      const memberProgress = { ...(sg.memberProgress || {}) };
      const myEntry = memberProgress[myKey] ??
                      (user?.id ? memberProgress[user.id] : undefined) ??
                      (user?.username ? memberProgress[user.username] : undefined) ??
                      memberProgress['user1'];

      const currentVal = typeof myEntry === 'object'
        ? (Number(myEntry?.value) || 0)
        : (Number(myEntry) || 0);

      if (habitVal > currentVal) {
        podNeedsUpdate = true;
        const newCompleted = habitVal >= (Number(sg.target) || 1);
        const updatedEntry = {
          value: habitVal,
          completed: newCompleted,
          updatedAt: new Date().toISOString(),
        };
        memberProgress[myKey] = updatedEntry;
        if (user?.id) memberProgress[user.id] = updatedEntry;
        if (user?.username) memberProgress[user.username] = updatedEntry;

        const totalSum = Object.values(memberProgress).reduce(
          (acc, m) => acc + (typeof m === 'object' ? (Number(m.value) || 0) : (Number(m) || 0)),
          0
        );

        if (groupPod.code) {
          updateGroupGoalRemote(
            groupPod.code,
            sg.id,
            0,
            myKey,
            habitVal,
            newCompleted
          ).catch(() => {});
        }

        return {
          ...sg,
          current: totalSum,
          memberProgress,
        };
      }

      return sg;
    });

    if (podNeedsUpdate) {
      // Use functional updater to avoid stale closure overwriting a freshly renamed pod
      setGroupPod((prev) => {
        if (!prev) return prev;
        const merged = { ...prev, sharedGoals: reconciledGoals };
        try { localStorage.setItem('daybyday_group_pod', JSON.stringify(merged)); } catch {}
        return merged;
      });
    }
  }, [habits, groupPod?.code]);

  // Enable Native OS / Health App Sync (Asks permission one-time and retains it)
  const enableHealthSync = async () => {
    sound.press();
    const hasPerm = await checkHealthPermission();
    if (!hasPerm) {
      const granted = await requestHealthPermission();
      if (!granted) {
        triggerIslandNotification('Activity permission required to sync steps', 'untrack');
        return { success: false, reason: 'permission_denied' };
      }
    }
    setHealthSyncEnabled(true);
    setHealthSyncEnabledState(true);
    const data = await syncDeviceHealth({ silent: false, force: true });
    return { success: true, data };
  };

  // Disable Native OS Health Sync
  const disableHealthSync = () => {
    sound.press();
    setHealthSyncEnabled(false);
    setHealthSyncEnabledState(false);
    triggerIslandNotification('Health sync paused', 'info');
  };

  // Import Native OS Fitness & Step Stats and Auto-Sync to Habits and Together Pod
  const syncDeviceHealth = async ({ silent = false, force = false } = {}) => {
    if (!force && !isHealthSyncEnabled()) return null;
    if (isHealthSyncRunningRef.current) return healthStats;

    isHealthSyncRunningRef.current = true;
    if (!silent) sound.press();

    try {
      const healthData = await importDeviceHealthStats(user);
      if (healthData && healthData.success) {
        setHealthStats(healthData);
        await syncHealthDataToHabitsAndPod({
          healthData,
          habits: habitsRef.current || habits,
          sharedGoals: groupPod?.sharedGoals || [],
          activeUserId: 'user1',
          onUpdateHabit: (hId, uId, val, isAbs, isSil) => updateHabit(hId, uId, val, isAbs, isSil, 'health'),
          onUpdateSharedGoal: (gId, d, exp, isSil) => updateSharedGoalProgress(gId, d, exp, isSil, 'health'),
          triggerIslandNotification: silent ? null : triggerIslandNotification,
          silent: Boolean(silent),
        });
        const targetIdOrCode = user?.id || user?.secretCode || user?.secret_code;
        if (targetIdOrCode) {
          syncHealthDataRemote(targetIdOrCode, healthData).catch(() => {});
        }
        return healthData;
      } else {
        if (!silent) {
          triggerIslandNotification(healthData?.error || 'Could not import health stats', 'untrack');
        }
        return healthData;
      }
    } finally {
      isHealthSyncRunningRef.current = false;
    }
  };

  // Update custom health stats directly (helpful for iOS Web App & manual calibration)
  const setCustomHealthSteps = async (customSteps) => {
    const updated = updateCustomHealthStats(customSteps);
    setHealthStats(updated);
    await syncHealthDataToHabitsAndPod({
      healthData: updated,
      habits: habitsRef.current || habits,
      sharedGoals: groupPod?.sharedGoals || [],
      activeUserId: 'user1',
      onUpdateHabit: (hId, uId, val, isAbs, isSil) => updateHabit(hId, uId, val, isAbs, isSil, 'health'),
      onUpdateSharedGoal: (gId, d, exp, isSil) => updateSharedGoalProgress(gId, d, exp, isSil, 'health'),
      triggerIslandNotification,
    });
    const targetIdOrCode = user?.id || user?.secretCode || user?.secret_code;
    if (targetIdOrCode) {
      syncHealthDataRemote(targetIdOrCode, updated).catch(() => {});
    }
    return updated;
  };

  // Automatic Daily Health & Fitness Background Fetcher (Retains permission & updates day by day)
  useEffect(() => {
    if (!healthSyncEnabled) return;

    // 1. Fetch on app launch
    syncDeviceHealth({ silent: true, force: true });

    // 2. Fetch whenever app resumes / user brings window to front
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncDeviceHealth({ silent: true, force: true });
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 3. Periodic fetch every 30 minutes while active (every half an hour)
    const interval = setInterval(() => {
      syncDeviceHealth({ silent: true, force: true });
    }, 30 * 60 * 1000);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [healthSyncEnabled]);

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

      // 1. Group pod refresh — always preserve local name over stale remote
      if (groupPod?.code) {
        try {
          const remote = await getGroupPodRemote(groupPod.code);
          if (remote && isMounted) {
            setGroupPod((prev) => {
              if (!prev) return remote;
              const merged = {
                ...prev,
                members: remote.members || prev.members,
                sharedGoals: remote.sharedGoals || prev.sharedGoals,
                // Keep whichever name is more recently set (prefer non-empty remote, fallback to local)
                name: remote.name || prev.name,
              };
              try { localStorage.setItem('daybyday_group_pod', JSON.stringify(merged)); } catch {}
              return merged;
            });
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
  const updateHabit = (habitId, userId, amountOrValue, isAbsolute = false, silent = false, origin = 'user') => {
    if (!silent) sound.tap();
    let computedNextValue = null;
    const todayKey = getLocalDateKey();

    const currentList = (habitsRef.current && habitsRef.current.length) ? habitsRef.current : habits;
    const updatedList = currentList.map((h) => {
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
      if (!wasDone && nowDone && !silent) {
        sound.complete();
        triggerIslandNotification(`${h.name} completed!`, 'check');
      }

      return updated;
    });

    habitsRef.current = updatedList;
    setHabits(updatedList);
    try {
      localStorage.setItem('daybyday_habits', JSON.stringify(updatedList));
      localStorage.setItem('daybyday_last_active_date', todayKey);
    } catch {}

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
    if (user?.id && updatedList.length > 0) {
      syncUserHabitsRemote(user.id, updatedList).catch(() => {});
    }

    // Keep Health Stats and Together Pod goals synchronized with exact habits
    if (userId === 'user1' && computedNextValue !== null && computedNextValue !== undefined) {
      const targetHabit = updatedList.find((h) => h.id === habitId);
      if (targetHabit) {
        const u = (targetHabit.unit || '').toLowerCase();
        const n = (targetHabit.name || '').toLowerCase();
        const isStepHabit = u === 'steps' || n.includes('step') || n.includes('walk');

        if (isStepHabit) {
          const steps = Math.max(0, Math.round(Number(computedNextValue) || 0));
          const calories = Math.round(steps * 0.04);
          const distanceKm = Math.round(steps * 0.000762 * 100) / 100;
          const healthPayload = {
            steps,
            calories,
            distanceKm,
            source: 'habit_entry',
            syncedAt: new Date().toISOString(),
          };
          setHealthStats((prev) => {
            const updated = {
              ...(prev || {}),
              ...healthPayload,
            };
            try {
              localStorage.setItem('daybyday_health_sync_data', JSON.stringify(updated));
            } catch {}
            return updated;
          });

          // Sync health steps to cloud so friends tracking this user see it!
          const targetIdOrCode = user?.id || user?.secretCode || user?.secret_code;
          if (targetIdOrCode) {
            syncHealthDataRemote(targetIdOrCode, healthPayload).catch(() => {});
          }
        }

        // UNIFIED SYNC: Update ANY matching shared goal in the Together pod (STRICTLY GUARDED against circular recursion)
        if (origin !== 'sharedGoal' && !isCrossSyncingRef.current) {
          if (groupPod && Array.isArray(groupPod.sharedGoals)) {
            const valToSync = typeof computedNextValue === 'boolean'
              ? (computedNextValue ? 1 : 0)
              : Math.max(0, Number(computedNextValue) || 0);

            for (const sg of groupPod.sharedGoals) {
              if (isHabitMatchingSharedGoal(targetHabit, sg)) {
                try {
                  isCrossSyncingRef.current = true;
                  updateSharedGoalProgress(sg.id, 0, valToSync, silent, 'habit');
                } finally {
                  isCrossSyncingRef.current = false;
                }
              }
            }
          }
        }
      }
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
    const granted = await requestAppNotificationPermission();
    // If permission granted on web/iOS, ensure service worker is ready for future delivery
    const isNative = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.();
    if (granted && !isNative) {
      getOrRegisterServiceWorker().catch(() => {});
    }
    return granted;
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
        groupPods,
        activeGroupPodCode,
        selectGroupPod,
        groupPod,
        createGroupPod,
        joinGroupPod,
        leaveGroupPod,
        editGroupName,
        addSharedGoal,
        editSharedGoal,
        updateSharedGoalProgress,
        deleteSharedGoal,
        syncTogetherPodWithHabits,
        fetchUserGroupPods,
        syncAllStats,
        serverUrl,
        setServerUrl,
        syncStatus,
        lastSyncedAt,
        syncWithCloud,
        syncDeviceHealth,
        healthSyncEnabled,
        healthStats,
        enableHealthSync,
        disableHealthSync,
        performDailyReset,
        setCustomHealthSteps,
        isFeaturesGuideOpen,
        setIsFeaturesGuideOpen,
        openFeaturesGuide,
        closeFeaturesGuide,
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
