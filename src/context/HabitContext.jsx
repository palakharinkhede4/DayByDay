import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/sound';
import { sanitizeInput, exportLocalBackup, wipeLocalData } from '../utils/security';
import { fetchRemotePod, pushHabitUpdate, pushFullSync } from '../utils/api';

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
    user1: 2200,
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
    user1: 6.0, // 6h
    user2: 7.16, // 7h 10m
    user1Display: '6h',
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
    user1: 5,
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
    user1: 5,
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
    user1: 5,
    user2: 3,
  },
  {
    id: 'workouts',
    name: 'Workouts',
    category: 'Daily',
    description: 'Weekly workout count',
    target: 30,
    unit: 'min',
    icon: 'workouts',
    user1: 0,
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
    user1: false,
    user2: true,
  }
];

const INITIAL_BEYOND = [
  {
    id: 'savings',
    name: 'Savings',
    category: 'Periodic',
    user1: 150,
    user2: 200,
    target: 500,
    unit: '$',
    icon: 'savings'
  },
  {
    id: 'weight',
    name: 'Weight',
    category: 'Periodic',
    user1: 172,
    user2: 148,
    target: null,
    unit: 'lbs',
    icon: 'weight'
  }
];

export const HabitProvider = ({ children }) => {
  // OS & Display
  const [osMode, setOsMode] = useState(() => localStorage.getItem('duotrack_os') || 'ios');
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('duotrack_view') || 'frame');
  const [themeColor, setThemeColor] = useState(() => localStorage.getItem('duotrack_theme') || 'emerald');

  // Active User ('user1' = Ced, 'user2' = Joe)
  const [activeUserId, setActiveUserId] = useState('user1');

  // Pod details
  const [pod, setPod] = useState(() => {
    const saved = localStorage.getItem('duotrack_pod');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return {
      isPaired: true,
      code: 'ZAU8PP',
      user1: { name: 'Ced', email: 'ced@example.invalid', initial: 'C' },
      user2: { name: 'Joe', email: 'joe@example.invalid', initial: 'J' },
      daysTogether: 12,
      currentStreak: 12,
      bestStreak: 18,
      podHealth: 86,
      healthStatus: 'THRIVING',
      yesterdayPercent: 87
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

  // Vercel / Remote Server URL (configured by user or defaults to current deployment origin)
  const [serverUrl, setServerUrlState] = useState(() => localStorage.getItem('duotrack_server_url') || '');
  const [syncStatus, setSyncStatus] = useState('synced'); // 'synced' | 'syncing' | 'offline'
  const [lastSyncedAt, setLastSyncedAt] = useState(() => Date.now());

  const setServerUrl = (url) => {
    setServerUrlState(url);
    if (url) {
      localStorage.setItem('duotrack_server_url', url.trim());
    } else {
      localStorage.removeItem('duotrack_server_url');
    }
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('duotrack_os', osMode);
    document.documentElement.setAttribute('data-os', osMode);
  }, [osMode]);

  useEffect(() => {
    localStorage.setItem('duotrack_theme', themeColor);
    document.documentElement.setAttribute('data-theme', themeColor);
  }, [themeColor]);

  useEffect(() => {
    localStorage.setItem('duotrack_view', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('duotrack_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('duotrack_pod', JSON.stringify(pod));
  }, [pod]);

  useEffect(() => {
    localStorage.setItem('duotrack_beyond', JSON.stringify(beyondGoals));
  }, [beyondGoals]);

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
        // Seed remote
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

  // LIVE CLOUD SYNCHRONIZATION: Poll remote Vercel API every 4 seconds when pod is paired
  useEffect(() => {
    if (!pod.isPaired || !pod.code) return;

    let lastKnownTimestamp = 0;

    const syncInterval = setInterval(async () => {
      // Pause polling if document is hidden to conserve battery & network
      if (document.hidden) return;

      const remoteData = await fetchRemotePod(pod.code);
      if (remoteData && !remoteData.notFound) {
        setSyncStatus('synced');
        setLastSyncedAt(Date.now());

        if (remoteData.lastUpdated && remoteData.lastUpdated > lastKnownTimestamp) {
          lastKnownTimestamp = remoteData.lastUpdated;

          // If updated by partner, update local state
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
        // Auto-seed server if wiped or cold start
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
        u1Score = Math.min(1, h.user1 / h.target);
        u2Score = Math.min(1, h.user2 / h.target);
      }

      totalScore += (u1Score + u2Score) / 2;
    });

    return Math.round((totalScore / habits.length) * 100);
  };

  // Count how many goals are "in sync" (both partners met the target)
  const calculateInSyncCount = () => {
    let inSync = 0;
    habits.forEach((h) => {
      let u1Done = typeof h.user1 === 'boolean' ? h.user1 : h.user1 >= h.target;
      let u2Done = typeof h.user2 === 'boolean' ? h.user2 : h.user2 >= h.target;
      if (u1Done && u2Done) inSync++;
    });
    return inSync;
  };

  // Update Habit Value
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

        // Format display for sleep if applicable
        let extra = {};
        if (h.id === 'sleep') {
          const hrs = Math.floor(nextValue);
          const mins = Math.round((nextValue - hrs) * 60);
          extra[`${userId}Display`] = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        }

        const updated = { ...h, [userId]: nextValue, ...extra };

        // Check if just completed
        const wasDone = typeof current === 'boolean' ? current : current >= h.target;
        const nowDone = typeof nextValue === 'boolean' ? nextValue : nextValue >= h.target;
        if (!wasDone && nowDone) {
          sound.complete();
          triggerIslandNotification(`${h.name} completed!`, '🎉');
        }

        return updated;
      })
    );

    // Asynchronously push update to Vercel Serverless Sync API
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
  };

  // Update Beyond goal (Savings / Weight)
  const updateBeyondGoal = (goalId, userId, amount) => {
    sound.tap();
    setBeyondGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          [userId]: Math.max(0, g[userId] + amount)
        };
      })
    );
  };

  // Add Custom or Preset Goal (Sanitized)
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

  // Request Notifications safely with minimal OS permissions (explicit user consent only)
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

  // Export local backup file (100% client side)
  const exportData = () => {
    sound.tap();
    exportLocalBackup({
      pod,
      habits,
      beyondGoals,
      osMode,
      themeColor,
    });
  };

  // Wipe data and reset to fresh state
  const resetAllData = () => {
    sound.tap();
    wipeLocalData();
    setHabits(INITIAL_HABITS);
    setBeyondGoals(INITIAL_BEYOND);
    setPod({
      isPaired: true,
      code: 'ZAU8PP',
      user1: { name: 'Ced', email: 'ced@example.invalid', initial: 'C' },
      user2: { name: 'Joe', email: 'joe@example.invalid', initial: 'J' },
      daysTogether: 12,
      currentStreak: 12,
      bestStreak: 18,
      podHealth: 86,
      healthStatus: 'THRIVING',
      yesterdayPercent: 87
    });
  };

  // Simulate Partner (Joe) doing an action
  const simulatePartnerActivity = () => {
    sound.tap();
    const partnerId = activeUserId === 'user1' ? 'user2' : 'user1';
    const partnerName = partnerId === 'user1' ? pod.user1.name : pod.user2.name;

    // Pick a random habit that isn't fully completed
    const eligible = habits.filter((h) => {
      if (typeof h[partnerId] === 'boolean') return !h[partnerId];
      return h[partnerId] < h.target;
    });

    const targetHabit = eligible.length > 0 ? eligible[Math.floor(Math.random() * eligible.length)] : habits[0];

    if (!targetHabit) return;

    if (typeof targetHabit[partnerId] === 'boolean') {
      updateHabit(targetHabit.id, partnerId, true, true);
    } else if (targetHabit.id === 'steps') {
      updateHabit(targetHabit.id, partnerId, 1500);
    } else if (targetHabit.id === 'water') {
      updateHabit(targetHabit.id, partnerId, 1);
    } else if (targetHabit.id === 'reading') {
      updateHabit(targetHabit.id, partnerId, 5);
    } else if (targetHabit.id === 'workouts') {
      updateHabit(targetHabit.id, partnerId, 20);
    } else if (targetHabit.id === 'meditation') {
      updateHabit(targetHabit.id, partnerId, 5);
    } else if (targetHabit.id === 'sleep') {
      updateHabit(targetHabit.id, partnerId, 0.5);
    }

    triggerIslandNotification(`${partnerName} just logged ${targetHabit.name}!`, '🔥');
  };

  // Leave pod
  const leavePod = () => {
    sound.tap();
    setPod((prev) => ({
      ...prev,
      isPaired: false,
      user2: { name: 'Partner', email: '', initial: '?' }
    }));
  };

  // Pair pod
  const pairPod = (code = 'ZAU8PP', partnerName = 'Joe') => {
    sound.complete();
    const cleanCode = sanitizeInput(code).toUpperCase();
    const cleanPartner = sanitizeInput(partnerName);
    setPod((prev) => ({
      ...prev,
      isPaired: true,
      code: cleanCode || 'ZAU8PP',
      user2: { name: cleanPartner || 'Joe', email: `${(cleanPartner || 'joe').toLowerCase()}@example.invalid`, initial: (cleanPartner || 'J')[0].toUpperCase() }
    }));
    triggerIslandNotification(`Paired with ${cleanPartner || 'Joe'}!`, '🤝');
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

  // Memoized calculations to prevent CPU churn and memory churn
  const currentPercent = useMemo(() => calculateGoalsReached(), [habits]);
  const inSyncGoalsCount = useMemo(() => calculateInSyncCount(), [habits]);

  return (
    <HabitContext.Provider
      value={{
        osMode,
        setOsMode,
        viewMode,
        setViewMode,
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
        simulatePartnerActivity,
        leavePod,
        pairPod,
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
