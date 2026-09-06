// Persistent Storage Vault for iOS Safari PWA, Android Native App & Web
// Protects session and habit data across app backgrounding, OS memory pressure, and browser restarts

const DB_NAME = 'duotrack_vault';
const DB_VERSION = 1;
const STORE_NAME = 'session_store';

function openVaultDb() {
  return new Promise((resolve, reject) => {
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
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    // Non-blocking fallback
  }
}

// Dual-layer session backup: writes to both localStorage and IndexedDB Vault
// Guarantees session survival across iOS Safari 7-day ITP, PWA partitioning, and Android WebView memory flushes
export async function persistSessionSnapshot(user, partner, habits, pod) {
  if (!user || !user.username) {
    // Safety guard: Never wipe the vault from a snapshot effect when user is not loaded
    return;
  }
  try {
    localStorage.setItem('duotrack_user', JSON.stringify(user));
    await setVaultItem('duotrack_user', user);

    if (partner) {
      localStorage.setItem('duotrack_partner', JSON.stringify(partner));
      await setVaultItem('duotrack_partner', partner);
    } else {
      localStorage.removeItem('duotrack_partner');
      await removeVaultItem('duotrack_partner');
    }

    if (habits && habits.length) {
      localStorage.setItem('duotrack_habits', JSON.stringify(habits));
      await setVaultItem('duotrack_habits', habits);
    }

    if (pod) {
      localStorage.setItem('duotrack_pod', JSON.stringify(pod));
      await setVaultItem('duotrack_pod', pod);
    }
  } catch (err) {
    console.warn('Session persistence notice:', err.message);
  }
}

// Explicit session wipe: ONLY called on user-initiated sign out or data reset
export async function clearVaultSession() {
  try {
    localStorage.removeItem('duotrack_user');
    localStorage.removeItem('duotrack_partner');
    localStorage.removeItem('duotrack_habits');
    localStorage.removeItem('duotrack_pod');
    await clearVault();
  } catch (err) {
    console.warn('Session clear notice:', err.message);
  }
}

// Restore session from IndexedDB if localStorage was cleared by OS or browser
export async function recoverSessionFromVault() {
  try {
    const vaultUser = await getVaultItem('duotrack_user');
    if (!vaultUser || !vaultUser.username) return null;

    const vaultPartner = await getVaultItem('duotrack_partner');
    const vaultHabits = await getVaultItem('duotrack_habits');
    const vaultPod = await getVaultItem('duotrack_pod');

    // Re-populate localStorage to keep future synchronous loads instantaneous
    try {
      localStorage.setItem('duotrack_user', JSON.stringify(vaultUser));
      if (vaultPartner) localStorage.setItem('duotrack_partner', JSON.stringify(vaultPartner));
      if (vaultHabits) localStorage.setItem('duotrack_habits', JSON.stringify(vaultHabits));
      if (vaultPod) localStorage.setItem('duotrack_pod', JSON.stringify(vaultPod));
    } catch {
      // LocalStorage quota or restricted mode fallback
    }

    return {
      user: vaultUser,
      partner: vaultPartner || null,
      habits: vaultHabits || null,
      pod: vaultPod || null,
    };
  } catch {
    return null;
  }
}

