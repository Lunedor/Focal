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
        // Only sync relevant app data, ignore other localStorage items
        if (key.startsWith('page-') || key.startsWith('pinned-') || key.startsWith('unpinned-') || key.match(/^\d{4}-W\d{1,2}/)) {
            localData[key] = localStorage.getItem(key);
            localDataKeys.push(key);
        }
    }

    const collectionRef = db.collection('users').doc(user.uid).collection('appData');
    const querySnapshot = await collectionRef.get();
    const cloudData = {};
    querySnapshot.forEach(doc => {
      cloudData[doc.id] = doc.data().content;
    });
    console.log(`[cloud] Downloaded ${Object.keys(cloudData).length} items from cloud.`);

    const mergedData = { ...cloudData, ...localData };
    let needsUIRefresh = false;
    for (const key in cloudData) {
      if (!localData.hasOwnProperty(key)) {
        // Item exists in cloud but not locally, so add it to local
        localStorage.setItem(key, cloudData[key]);
        needsUIRefresh = true;
      }
    }

    const batch = db.batch();
    // --- FIX FOR DELETE ---
    // Identify keys that are in the cloud but NOT in our current local storage.
    const cloudKeys = Object.keys(cloudData);
    const keysToDelete = cloudKeys.filter(key => !localDataKeys.includes(key));
    if (keysToDelete.length > 0) {
        console.log('[cloud] Deleting obsolete keys from cloud:', keysToDelete);
        keysToDelete.forEach(key => {
            batch.delete(collectionRef.doc(key));
        });
    }

    // Identify keys that need to be uploaded/updated
    for(const key in localData) {
        if(localData[key] !== cloudData[key]) {
            console.log(`[cloud] Updating key in cloud: ${key}`);
            batch.set(collectionRef.doc(key), { content: localData[key] });
        }
    }

    await batch.commit();
    console.log('[cloud] Sync batch committed.');

    if (needsUIRefresh) {
      console.log("[cloud] UI needs refresh due to new data from cloud.");
      renderApp();
    } else {
        console.log('[cloud] Local data is already up to date or pushed to cloud.');
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

// This starts the whole process on page load
initGoogleAuth();
