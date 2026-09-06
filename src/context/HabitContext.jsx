import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/sound';
import { sanitizeInput, exportLocalBackup, wipeLocalData } from '../utils/security';
import {
  fetchRemotePod,
  pushHabitUpdate,
  pushFullSync,
  registerUserRemote,
  fetchUserRemote,
  syncUserHabitsRemote,
  pairPartnerRemote,
  unpairPartnerRemote,
} from '../utils/api';

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
    user1: 6200,
    user2: 7400,
  },
  {
    id: 'sleep',
    name: 'Sleep',
    category: 'Daily',
    description: 'Get enough rest',
    target: 8,
    unit: 'hours',
    icon: 'sleep',
    user1: 7.2,
    user2: 7.16,
    user1Display: '7h 12m',
    user2Display: '7h 10m',
  },
  {
    id: 'meditation',
    name: 'Meditation',
    category: 'Daily',
    description: 'Daily mindfulness practice',
    target: 10,
    unit: 'min',
    icon: 'meditation',
    user1: 10,
    user2: 10,
  },
  {
    id: 'water',
    name: 'Water',
    category: 'Daily',
    description: 'Stay hydrated',
    target: 8,
    unit: 'pints',
    icon: 'water',
    user1: 6,
    user2: 8,
  },
  {
    id: 'reading',
    name: 'Reading',
    category: 'Daily',
    description: 'Pages per day or books per month',
    target: 10,
    unit: 'pgs',
    icon: 'reading',
    user1: 8,
    user2: 3,
  },
  {
    id: 'workouts',
    name: 'Workouts',
    category: 'Daily',
    description: 'Daily active exercise',
    target: 30,
    unit: 'min',
    icon: 'workouts',
    user1: 30,
    user2: 32,
  },
  {
    id: 'vitamins',
    name: 'Vitamins',
    category: 'Daily',
    description: 'Daily vitamins, AM or PM',
    target: 1,
    unit: 'done',
    icon: 'vitamins',
    user1: true,
    user2: true,
  }
];

const INITIAL_BEYOND = [
  {
    id: 'savings',
    name: 'Savings',
    category: 'Periodic',
    user1: 250,
    user2: 200,
    target: 500,
    unit: '$',
    icon: 'savings'
  },
  {
    id: 'weight',
    name: 'Weight',
    category: 'Periodic',
    user1: 168,
    user2: 148,
    target: null,
    unit: 'lbs',
    icon: 'weight'
  }
];

function detectInitialOS() {
  if (typeof window === 'undefined') return 'ios';
  const saved = localStorage.getItem('duotrack_os');
  if (saved) return saved;
  const ua = window.navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  return 'ios';
}

export const HabitProvider = ({ children }) => {
  // 1. User Identity (Unique @username and Secret Code)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('duotrack_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return null; // Triggers OnboardingModal if null
  });

  // 2. Partner & Solo State
  const [partner, setPartner] = useState(() => {
    const saved = localStorage.getItem('duotrack_partner');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return null;
  });

  const isSolo = !partner;

  // 3. Theme Mode: 'light' | 'dark' | 'auto'
  const [themeMode, setThemeModeState] = useState(() => localStorage.getItem('duotrack_theme_mode') || 'dark');
  const setThemeMode = (mode) => {
    setThemeModeState(mode);
    localStorage.setItem('duotrack_theme_mode', mode);
    document.documentElement.setAttribute('data-theme-mode', mode);
  };

  // 4. OS Engine ('ios' | 'android')
  const [osMode, setOsMode] = useState(() => detectInitialOS());
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('duotrack_theme') || 'emerald');

  // Active User role in current view ('user1' = You, 'user2' = Partner)
  const [activeUserId, setActiveUserId] = useState('user1');

  // Pod details
  const [pod, setPod] = useState(() => {
    const saved = localStorage.getItem('duotrack_pod');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return {
      isPaired: false,
      code: user ? user.secretCode : 'DUO-1000',
      user1: { name: user?.displayName || 'You', email: '', initial: (user?.displayName || 'Y')[0].toUpperCase() },
      user2: { name: 'Partner', email: '', initial: 'P' },
      daysTogether: 1,
      currentStreak: 1,
      bestStreak: 1,
      podHealth: 90,
      healthStatus: 'THRIVING',
      yesterdayPercent: 85
    };
  });

  // Habits list
  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('duotrack_habits');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return INITIAL_HABITS;
  });

  // Beyond Today list
  const [beyondGoals, setBeyondGoals] = useState(() => {
    const saved = localStorage.getItem('duotrack_beyond');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return INITIAL_BEYOND;
  });

  // Dynamic Island status
  const [islandMessage, setIslandMessage] = useState(null);

  // Vercel Serverless Sync States
  const [serverUrl, setServerUrlState] = useState(() => localStorage.getItem('duotrack_server_url') || '');
  const [syncStatus, setSyncStatus] = useState('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());

  const setServerUrl = (url) => {
    setServerUrlState(url);
    if (url) {
      localStorage.setItem('duotrack_server_url', url.trim());
    } else {
      localStorage.removeItem('duotrack_server_url');
    }
  };

  // Sync to DOM attributes and localStorage
  useEffect(() => {
    localStorage.setItem('duotrack_os', osMode);
    document.documentElement.setAttribute('data-os', osMode);
  }, [osMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme-mode', themeMode);
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('duotrack_theme', themeColor);
    document.documentElement.setAttribute('data-theme', themeColor);
  }, [themeColor]);

  useEffect(() => {
    localStorage.setItem('duotrack_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('duotrack_pod', JSON.stringify(pod));
  }, [pod]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('duotrack_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('duotrack_user');
    }
  }, [user]);

  useEffect(() => {
    if (partner) {
      localStorage.setItem('duotrack_partner', JSON.stringify(partner));
    } else {
      localStorage.removeItem('duotrack_partner');
    }
  }, [partner]);

  useEffect(() => {
    localStorage.setItem('duotrack_beyond', JSON.stringify(beyondGoals));
  }, [beyondGoals]);

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

  // Register New User (Calls Neon DB backend or falls back to local)
  const registerUser = async (username, displayName = '', avatar = '🌱') => {
    sound.complete();
    const cleanUsername = username.toLowerCase().trim().replace(/^@/, '');
    const cleanDisplay = displayName || cleanUsername;
    const prefix = cleanUsername.slice(0, 3).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const localSecretCode = `${prefix}-${rand}`;

    let newUser = {
      id: `usr_${cleanUsername}_${Date.now().toString(36)}`,
      username: cleanUsername,
      displayName: cleanDisplay,
      secretCode: localSecretCode,
      avatar,
      createdAt: new Date().toISOString(),
    };

    try {
      const res = await registerUserRemote(cleanUsername, cleanDisplay, avatar);
      if (res && res.user) {
        newUser = res.user;
        if (res.habits && res.habits.length) {
          // Restore user's previous habits
          setHabits(res.habits);
        }
      }
    } catch {
      // Local fallback preserves user experience
    }

    setUser(newUser);
    setPod((prev) => ({
      ...prev,
      code: newUser.secretCode,
      user1: {
        name: newUser.displayName || newUser.username,
        email: `${newUser.username}@duotrack.invalid`,
        initial: (newUser.displayName || newUser.username)[0].toUpperCase(),
      }
    }));

    // Trigger celebration
    triggerCelebration();
    triggerIslandNotification(`Welcome @${newUser.username}!`, '🎉');
    return newUser;
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
            email: `${res.partner.username}@duotrack.invalid`,
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
          email: `${partnerName.toLowerCase()}@duotrack.invalid`,
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
      code: user?.secretCode || 'DUO-1000',
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

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;

        let current = h[userId];
        let nextValue = current;

        if (typeof current === 'boolean') {
          nextValue = isAbsolute ? amountOrValue : !current;
        } else {
          nextValue = isAbsolute ? amountOrValue : Math.max(0, current + amountOrValue);
        }

        computedNextValue = nextValue;

        let extra = {};
        if (h.id === 'sleep') {
          const hrs = Math.floor(nextValue);
          const mins = Math.round((nextValue - hrs) * 60);
          extra[`${userId}Display`] = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        }

        const updated = { ...h, [userId]: nextValue, ...extra };

        const wasDone = typeof current === 'boolean' ? current : current >= h.target;
        const nowDone = typeof nextValue === 'boolean' ? nextValue : nextValue >= h.target;
        if (!wasDone && nowDone) {
          sound.complete();
          triggerIslandNotification(`${h.name} completed!`, '🎉');
        }

        return updated;
      })
    );

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
    if (user?.id) {
      syncUserHabitsRemote(user.id, habits).catch(() => {});
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
    setHabits((prev) => [...prev, safeGoal]);
    triggerIslandNotification(`Added goal: ${safeGoal.name}`, '✨');
  };

  // Remove Goal
  const removeGoal = (goalId) => {
    sound.tap();
    setHabits((prev) => prev.filter((h) => h.id !== goalId));
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
  const resetAllData = () => {
    sound.tap();
    wipeLocalData();
    setUser(null);
    setPartner(null);
    setHabits(INITIAL_HABITS);
    setBeyondGoals(INITIAL_BEYOND);
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

  return (
    <HabitContext.Provider
      value={{
        user,
        registerUser,
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
        updateHabit,
        updateBeyondGoal,
        addGoal,
        removeGoal,
        triggerCelebration,
        requestNotificationPermission,
        exportData,
        resetAllData,
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
