// --- START OF FILE cloud.js ---

// --- FIREBASE V8 COMPATIBILITY ---
// This file is written for Firebase v8 SDK (the version you are likely using).
// If you are using v9 (modular), the syntax would be different.

// Global state variables
let isSignedIn = false;
let authChecked = false;
let isSyncing = false; // Guard to prevent concurrent syncs

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore(); // --- ADD THIS --- Initialize Firestore
const googleProvider = new firebase.auth.GoogleAuthProvider();
// We no longer need the drive scope, but it's harmless to keep.
googleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');

/**
 * This is the main function that starts the authentication flow.
 */
function initGoogleAuth() {
  auth.onAuthStateChanged(user => {
    authChecked = true;
    if (user) {
      // --- User is signed in ---
      isSignedIn = true;
      console.log('[firebase] User is signed in:', user.displayName);
      updateAuthUI();

      // --- NEW: SEAMLESS SYNC ---
      // Now that we don't need a special token, we can sync on every
      // page load if the user has sync enabled.
      if (isCloudSyncEnabled()) {
        console.log('[firebase] User is authenticated. Starting cloud sync.');
        syncWithCloud();
      } else {
         console.log('[firebase] User is authenticated. Cloud sync is off.');
      }

    } else {
      // --- User is signed out ---
      isSignedIn = false;
      console.log('[firebase] User is signed out.');
      updateAuthUI();
    }
  });
}

/**
 * signIn function now uses redirect for a better mobile experience.
 */
function signIn() {
  auth.signInWithRedirect(googleProvider);
}

function signOut() {
  auth.signOut().then(() => {
    // onAuthStateChanged will automatically handle the rest.
    setCloudSyncEnabled(false);
  });
}

// --- REMOVED --- The googleFetch and ensureAccessToken functions are no longer needed.

function isCloudSyncEnabled() {
  const val = localStorage.getItem('cloudSyncEnabled');
  return val === 'true'; // Default to false if not set
}

function setCloudSyncEnabled(enabled) {
  localStorage.setItem('cloudSyncEnabled', enabled ? 'true' : 'false');
  window.isCloudSyncOn = enabled;
  const btn = document.getElementById('sync-cloud-btn');
  if (btn) {
      btn.querySelector('span').textContent = `Cloud Sync: ${enabled ? 'On' : 'Off'}`;
  }
  console.log('[cloud] cloudSyncEnabled set to', enabled);

  // If sync was just turned ON, perform an initial sync.
  if (enabled && isSignedIn) {
      syncWithCloud();
  }
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
window.isCloudSyncOn = isCloudSyncEnabled();

window.autoCloudSync = function() {
  if (isSignedIn && isCloudSyncEnabled()) {
    syncWithCloud();
  }
};

function updateAuthUI() {
  const btn = document.getElementById('account-auth-btn');
  if (!btn) return;
  if (!authChecked) {
    btn.querySelector('span').textContent = 'Checking...';
  } else {
    btn.querySelector('span').textContent = isSignedIn ? 'Sign Out' : 'Sign In';
  }
}

// --- REMOVED --- uploadAppData and downloadAppData are replaced by syncWithCloud.

/**
 * The new, all-in-one sync function using Firestore.
 */
async function syncWithCloud() {
  if (isSyncing) {
    console.log('[cloud] Sync already in progress. Skipping.');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    console.log('[cloud] Cannot sync, user is not signed in.');
    return;
  }

  isSyncing = true;
  console.log('[cloud] Starting sync with Firestore...');

  try {
    const localData = {};
    const localDataKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('page-') || key.match(/^\d{4}-W\d{1,2}-(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)$/)) {
            localData[key] = localStorage.getItem(key);
            localDataKeys.push(key);
        }
    }
    const pinned = localStorage.getItem('pinned-pages');
    if (pinned) localData['pinned-pages'] = pinned;
    const unpinned = localStorage.getItem('unpinned-pages');
    if (unpinned) localData['unpinned-pages'] = unpinned;


    // Path to the user's private data collection
    const collectionRef = db.collection('users').doc(user.uid).collection('appData');

    // 1. Download cloud data
    const querySnapshot = await collectionRef.get();
    const cloudData = {};
    querySnapshot.forEach(doc => {
      cloudData[doc.id] = doc.data().content;
    });
    console.log(`[cloud] Downloaded ${Object.keys(cloudData).length} items from cloud.`);

    // 2. Merge data (local data wins over cloud data)
    const mergedData = { ...cloudData, ...localData };

    // 3. Update local storage if cloud had newer items
    let needsUIRefresh = false;
    for (const key in mergedData) {
      if (localData[key] !== mergedData[key]) {
        localStorage.setItem(key, mergedData[key]);
        needsUIRefresh = true;
      }
    }

    // 4. Batch upload the merged data back to Firestore for consistency.
    // This is very efficient and uses only 1 write operation for any number of changes.
    const batch = db.batch();
    const mergedKeys = Object.keys(mergedData);

    // Add or update documents
    mergedKeys.forEach(key => {
        const docRef = collectionRef.doc(key);
        batch.set(docRef, { content: mergedData[key] });
    });

    // Find and delete any cloud documents that are no longer in the merged data
    const cloudKeys = Object.keys(cloudData);
    const keysToDelete = cloudKeys.filter(key => !mergedKeys.includes(key));
    keysToDelete.forEach(key => {
        batch.delete(collectionRef.doc(key));
    });

    if (mergedKeys.length > 0 || keysToDelete.length > 0) {
      await batch.commit();
      console.log(`[cloud] Uploaded/synced ${mergedKeys.length} items and deleted ${keysToDelete.length} items.`);
    } else {
      console.log('[cloud] No data to sync.');
    }

    if (needsUIRefresh) {
      console.log("[cloud] UI needs refresh due to new data from cloud.");
      if (typeof renderApp === 'function') {
        renderApp();
      } else {
        window.location.reload();
      }
    } else {
        console.log('[cloud] Local data is already up to date.');
    }

  } catch (error) {
    console.error("Cloud sync failed:", error);
    // You could add UI feedback here, like a toast notification
  } finally {
    isSyncing = false; // Release the guard
  }
}

// Make functions available globally and call init
window.initGoogleAuth = initGoogleAuth;
window.signIn = signIn;
window.signOut = signOut;
window.syncWithCloud = syncWithCloud;

// This starts the whole process on page load
initGoogleAuth();
