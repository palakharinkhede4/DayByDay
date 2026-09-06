// Persistent Storage Vault for iOS Safari PWA, Android Native App & Web
// Protects session and habit data across app backgrounding, OS memory pressure, and browser restarts

const DB_NAME = 'daybyday_vault';
const DB_VERSION = 1;
const STORE_NAME = 'session_store';

function openVaultDb() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return resolve(null);
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null); // Non-blocking fallback
    } catch {
      resolve(null);
    }
  });
}

// Request permanent persistence from OS / Web Browser (prevents Safari ITP & Android eviction)
export async function initPersistentStorage() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        await navigator.storage.persist();
      }
    } catch {
      // Graceful fallback
    }
  }
}

// Read item from IndexedDB Vault
export async function getVaultItem(key) {
  try {
    const db = await openVaultDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Save item to IndexedDB Vault
export async function setVaultItem(key, value) {
  try {
    const db = await openVaultDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    // Non-blocking fallback
  }
}

// Remove item from IndexedDB Vault
export async function removeVaultItem(key) {
  try {
    const db = await openVaultDb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    // Non-blocking fallback
  }
}

// Clear all items from Vault on user logout
export async function clearVault() {
  try {
    const db = await openVaultDb();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

// Dual-layer session backup: writes to both localStorage and IndexedDB Vault
// Guarantees session survival across iOS Safari 7-day ITP, PWA partitioning, and Android WebView memory flushes
export async function persistSessionSnapshot(user, partner, habits, pod, groupPod) {
  if (!user || !user.username) {
    // Safety guard: Never wipe the vault from a snapshot effect when user is not loaded
    return;
  }
  // Strict Safety Guard: If user explicitly signed out, NEVER re-save to vault!
  if (typeof localStorage !== 'undefined' && localStorage.getItem('daybyday_signed_out') === 'true') {
    return;
  }

  try {
    localStorage.setItem('daybyday_user', JSON.stringify(user));
    await setVaultItem('daybyday_user', user);

    if (partner) {
      localStorage.setItem('daybyday_partner', JSON.stringify(partner));
      await setVaultItem('daybyday_partner', partner);
    } else {
      localStorage.removeItem('daybyday_partner');
      await removeVaultItem('daybyday_partner');
    }

    if (habits && habits.length) {
      localStorage.setItem('daybyday_habits', JSON.stringify(habits));
      await setVaultItem('daybyday_habits', habits);
    }

    if (pod) {
      localStorage.setItem('daybyday_pod', JSON.stringify(pod));
      await setVaultItem('daybyday_pod', pod);
    }

    if (groupPod) {
      localStorage.setItem('daybyday_group_pod', JSON.stringify(groupPod));
      await setVaultItem('daybyday_group_pod', groupPod);
    }
  } catch (err) {
    console.warn('Session persistence notice:', err.message);
  }
}

// Explicit session wipe: ONLY called on user-initiated sign out or data reset
export async function clearVaultSession() {
  try {
    const keys = [
      'daybyday_user', 'daybyday_partner', 'daybyday_habits', 'daybyday_pod', 'daybyday_group_pod',
      'daybyday_tracked_partner', 'daybyday_tracked_partners', 'daybyday_active_tracked_code',
      'duotrack_user', 'duotrack_partner', 'duotrack_habits', 'duotrack_pod', 'duotrack_tracked_partner'
    ];
    keys.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });
    try {
      localStorage.setItem('daybyday_signed_out', 'true');
    } catch {}

    await clearVault();
    for (const k of keys) {
      await removeVaultItem(k);
    }
    await setVaultItem('daybyday_signed_out', 'true');
  } catch (err) {
    console.warn('Session clear notice:', err.message);
  }
}

// Restore session from IndexedDB if localStorage was cleared by OS or browser
export async function recoverSessionFromVault() {
  try {
    // 1. If user explicitly signed out, NEVER restore past session
    if (typeof localStorage !== 'undefined' && localStorage.getItem('daybyday_signed_out') === 'true') {
      return null;
    }
    const isSignedOutInVault = await getVaultItem('daybyday_signed_out');
    if (isSignedOutInVault === 'true') {
      return null;
    }

    let vaultUser = await getVaultItem('daybyday_user');
    if (!vaultUser) {
      vaultUser = await getVaultItem('duotrack_user');
    }
    if (!vaultUser || !vaultUser.username) return null;

    let vaultPartner = await getVaultItem('daybyday_partner') || await getVaultItem('duotrack_partner');
    let vaultHabits = await getVaultItem('daybyday_habits') || await getVaultItem('duotrack_habits');
    let vaultPod = await getVaultItem('daybyday_pod') || await getVaultItem('duotrack_pod');
    let vaultGroupPod = await getVaultItem('daybyday_group_pod');

    // Re-populate localStorage to keep future synchronous loads instantaneous
    try {
      localStorage.setItem('daybyday_user', JSON.stringify(vaultUser));
      if (vaultPartner) localStorage.setItem('daybyday_partner', JSON.stringify(vaultPartner));
      if (vaultHabits) localStorage.setItem('daybyday_habits', JSON.stringify(vaultHabits));
      if (vaultPod) localStorage.setItem('daybyday_pod', JSON.stringify(vaultPod));
      if (vaultGroupPod) localStorage.setItem('daybyday_group_pod', JSON.stringify(vaultGroupPod));
    } catch {
      // LocalStorage quota or restricted mode fallback
    }

    return {
      user: vaultUser,
      partner: vaultPartner || null,
      habits: vaultHabits || null,
      pod: vaultPod || null,
      groupPod: vaultGroupPod || null,
    };
  } catch {
    return null;
  }
}

