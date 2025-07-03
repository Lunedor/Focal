// --- START OF FILE cloud.js (Final "Last Write Wins" Logic) ---

// Global state variables
let isSignedIn = false;
let authChecked = false;
let isSyncing = false;

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

function initGoogleAuth() {
  auth.onAuthStateChanged(user => {
    authChecked = true;
    if (user) {
      isSignedIn = true;
      console.log('[firebase] User is signed in:', user.displayName);
      updateAuthUI();
      if (isCloudSyncEnabled()) {
        syncWithCloud();
      }
    } else {
      isSignedIn = false;
      console.log('[firebase] User is signed out.');
      updateAuthUI();
    }
  });
}

function signIn() {
  auth.signInWithPopup(googleProvider)
    .catch(error => {
      console.error("[firebase] Sign-in error", error);
      if (error.code === 'auth/popup-blocked') {
        alert("Sign-in popup was blocked by the browser. Please allow popups for this site and try again.");
      }
    });
}

function signOut() {
  auth.signOut().then(() => setCloudSyncEnabled(false));
}

function isCloudSyncEnabled() {
  return localStorage.getItem('cloudSyncEnabled') === 'true';
}

function setCloudSyncEnabled(enabled) {
  localStorage.setItem('cloudSyncEnabled', enabled ? 'true' : 'false');
  const btn = document.getElementById('sync-cloud-btn');
  if (btn) {
    btn.querySelector('span').textContent = `Cloud Sync: ${enabled ? 'On' : 'Off'}`;
  }
  if (enabled && isSignedIn) syncWithCloud();
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('sync-cloud-btn');
  if (btn) {
    btn.querySelector('span').textContent = `Cloud Sync: ${isCloudSyncEnabled() ? 'On' : 'Off'}`;
  }
});

if (localStorage.getItem('cloudSyncEnabled') === null) {
  localStorage.setItem('cloudSyncEnabled', 'false');
}

// Any data-modifying function should call this to mark local as newer
window.markLocalDataAsModified = function() {
  if (typeof window.isCloudSyncEnabled === 'function' && window.isCloudSyncEnabled()) {
    localStorage.setItem('lastModified', new Date().toISOString());
    if (typeof window.autoCloudSync === 'function') {
      window.autoCloudSync();
    }
  }
}

window.autoCloudSync = function() {
  if (isSignedIn && isCloudSyncEnabled()) {
    syncWithCloud();
  }
};

function updateAuthUI() {
  const btn = document.getElementById('account-auth-btn');
  if (!btn) return;
  btn.querySelector('span').textContent = isSignedIn ? 'Sign Out' : 'Sign In';
}

/**
 * Main sync function with "Last Write Wins" logic.
 */
async function syncWithCloud() {
  if (isSyncing) return console.log('[cloud] Sync already in progress.');
  const user = auth.currentUser;
  if (!user) return console.log('[cloud] Cannot sync, not signed in.');

  isSyncing = true;
  console.log('[cloud] Starting sync...');

  try {
    // --- Step 1: Get Cloud Data ---
    const userDocRef = db.collection('users').doc(user.uid);
    const cloudDoc = await userDocRef.get();
    const cloudData = cloudDoc.exists ? cloudDoc.data() : null;
    const cloudTimestamp = cloudData?.lastModified ? new Date(cloudData.lastModified) : null;

    // --- Step 2: Get Local Data ---
    const localTimestampStr = localStorage.getItem('lastModified');
    const localTimestamp = localTimestampStr ? new Date(localTimestampStr) : null;

    // --- Step 3: Compare and Act ---
    if (cloudTimestamp && (!localTimestamp || cloudTimestamp > localTimestamp)) {
      // --- Case A: Cloud is newer. Download and REPLACE local. ---
      console.log('[cloud] Cloud is newer. Replacing all local data.');

      // Remove all relevant local keys
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('page-') || key.startsWith('pinned-') || key.startsWith('unpinned-') || key.match(/^\d{4}-W\d{1,2}/)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => deleteStorage(key));

      // Write ALL cloud data to local storage
      for (const key in cloudData.appData) {
        localStorage.setItem(key, cloudData.appData[key]);
      }
      localStorage.setItem('lastModified', cloudData.lastModified); // Sync timestamp

      console.log('[cloud] Local data replaced. Reloading UI.');
      renderApp();

    } else if (!cloudTimestamp && localTimestamp) {
      // --- Case B: Cloud is empty, but local has a timestamp. REPLACE cloud with local. ---
      console.log('[cloud] Cloud is empty, local has timestamp. Replacing all cloud data.');

      // Gather all relevant local data
      const localDataToUpload = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('page-') || key.startsWith('pinned-') || key.startsWith('unpinned-') || key.match(/^\d{4}-W\d{1,2}/)) {
          localDataToUpload[key] = localStorage.getItem(key);
        }
      }

      // Always update the timestamp before uploading
      const now = new Date().toISOString();
      localStorage.setItem('lastModified', now);

      // Overwrite the entire cloud doc
      await userDocRef.set({
        lastModified: now,
        appData: localDataToUpload
      });
      console.log('[cloud] Cloud data replaced.');

    } else if (localTimestamp && cloudTimestamp && localTimestamp > cloudTimestamp) {
      // --- Case C: Local is newer. REPLACE cloud with local. ---
      console.log('[cloud] Local is newer. Replacing all cloud data.');

      // Gather all relevant local data
      const localDataToUpload = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('page-') || key.startsWith('pinned-') || key.startsWith('unpinned-') || key.match(/^\d{4}-W\d{1,2}/)) {
          localDataToUpload[key] = localStorage.getItem(key);
        }
      }

      // Always update the timestamp before uploading
      const now = new Date().toISOString();
      localStorage.setItem('lastModified', now);

      // Overwrite the entire cloud doc
      await userDocRef.set({
        lastModified: now,
        appData: localDataToUpload
      });
      console.log('[cloud] Cloud data replaced.');

    } else {
      // --- Case D: Timestamps match or neither is newer. Data is in sync. ---
      console.log('[cloud] Data is already in sync.');
    }

  } catch (error) {
    console.error("Cloud sync failed:", error);
  } finally {
    isSyncing = false;
  }
}

// Make functions available globally and call init
window.initGoogleAuth = initGoogleAuth;
window.signIn = signIn;
window.signOut = signOut;
window.syncWithCloud = syncWithCloud;

initGoogleAuth();
