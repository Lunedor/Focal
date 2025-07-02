// --- START OF FILE cloud.js (Corrected and Simplified) ---

// Global state variables
let isSignedIn = false;
let authChecked = false;
let isSyncing = false; // Guard to prevent concurrent syncs

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore(); // Initialize Firestore
const googleProvider = new firebase.auth.GoogleAuthProvider();

/**
 * This is the main function that starts the authentication flow.
 * It is the single source of truth for handling sign-in state.
 */
function initGoogleAuth() {
  auth.onAuthStateChanged(user => {
    authChecked = true;
    if (user) {
      // --- User is signed in ---
      isSignedIn = true;
      console.log('[firebase] User is signed in:', user.displayName);
      updateAuthUI();

      // If cloud sync is enabled, sync the data.
      if (isCloudSyncEnabled()) {
        console.log('[firebase] User authenticated. Starting cloud sync.');
        syncWithCloud();
      } else {
        console.log('[firebase] User authenticated, but cloud sync is off.');
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
 * The original, working signIn function using a popup.
 * Its job is to trigger the popup. The onAuthStateChanged listener handles the rest.
 */
function signIn() {
  auth.signInWithPopup(googleProvider)
    .then((result) => {
      // The onAuthStateChanged listener will automatically run and handle
      // the UI updates and initial sync. We don't need to do anything else here.
      console.log('[firebase] Sign-in via popup successful.');
    }).catch((error) => {
      console.error("[firebase] Sign-in error", error);
      if (error.code === 'auth/popup-blocked') {
        alert("Sign-in popup was blocked by the browser. Please allow popups for this site and try again.");
      }
    });
}

/**
 * The original, working signOut function.
 */
function signOut() {
  auth.signOut().then(() => {
    // onAuthStateChanged will automatically handle the rest.
    setCloudSyncEnabled(false);
  });
}

function isCloudSyncEnabled() {
  // Defaults to false if the item doesn't exist.
  return localStorage.getItem('cloudSyncEnabled') === 'true';
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
 * The new sync function using Firestore. This is the only major change from
 * the original logic, replacing the Drive API calls.
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
        // Gather all relevant local data
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
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

        let needsUIRefresh = false;
        // Merge cloud data into local storage.
        for (const key in cloudData) {
            if (localData[key] !== cloudData[key]) {
                 // Only update local storage and flag for refresh if cloud data is different.
                 // This assumes local data is the source of truth if a key exists in both.
                 if(!localData.hasOwnProperty(key)) {
                    localStorage.setItem(key, cloudData[key]);
                    needsUIRefresh = true;
                 }
            }
        }
        
        const batch = db.batch();
        const cloudKeys = Object.keys(cloudData);

        // Delete items from cloud that are no longer in local storage
        const keysToDelete = cloudKeys.filter(key => !localDataKeys.includes(key));
        if (keysToDelete.length > 0) {
            console.log('[cloud] Deleting keys from cloud:', keysToDelete);
            keysToDelete.forEach(key => batch.delete(collectionRef.doc(key)));
        }

        // Update/set items in cloud from local storage
        for (const key in localData) {
            if (localData[key] !== cloudData[key]) {
                console.log(`[cloud] Updating/setting key in cloud: ${key}`);
                batch.set(collectionRef.doc(key), { content: localData[key] });
            }
        }

        await batch.commit();
        console.log('[cloud] Sync batch committed.');

        if (needsUIRefresh) {
            console.log("[cloud] UI needs refresh due to new data from cloud.");
            if(typeof renderApp === 'function') {
                renderApp();
            } else {
                window.location.reload();
            }
        } else {
            console.log('[cloud] Sync complete. No UI refresh needed.');
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
