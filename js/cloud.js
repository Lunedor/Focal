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

async function removeCurrentTokenFromFirestore() {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const messaging = firebase.messaging();
    const token = await messaging.getToken();
    const user = firebase.auth().currentUser;
    if (!user || !token) return;
    const userDocRef = firebase.firestore().collection('users').doc(user.uid);
    await userDocRef.update({
      tokens: firebase.firestore.FieldValue.arrayRemove(token)
    });
    console.log('Removed FCM token from Firestore on sign-out or permission revoke.');
  } catch (e) {
    console.warn('Could not remove FCM token from Firestore:', e);
  }
}

function signOut() {
  removeCurrentTokenFromFirestore().finally(() => {
    auth.signOut().then(() => setCloudSyncEnabled(false));
  });
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
      debouncedSyncWithCloud();
    }
  }
}

function updateAuthUI() {
  const btn = document.getElementById('account-auth-btn');
  if (!btn) return;
  btn.querySelector('span').textContent = isSignedIn ? 'Sign Out' : 'Sign In';
}

/**
 * Main sync function. The new, robust syncWithCloud function
**/
async function syncWithCloud() {
  if (isSyncing) return console.log('[cloud] Sync already in progress.');
  const user = auth.currentUser;
  if (!user) return console.log('[cloud] Cannot sync, not signed in.');

  isSyncing = true;
  console.log('[cloud] Starting sync...');

  try {
    const userDocRef = db.collection('users').doc(user.uid);
    const cloudDoc = await userDocRef.get();
    const cloudData = cloudDoc.exists ? cloudDoc.data() : null;
    const cloudTimestamp = cloudData?.lastModified ? new Date(cloudData.lastModified) : null;
    
    // --- NEW LOGIC: PRESERVE TOKENS ---
    // Read the existing tokens from the cloud document *before* we do anything else.
    const existingTokens = cloudData?.tokens || []; 

    const localTimestampStr = localStorage.getItem('lastModified');
    const localTimestamp = localTimestampStr ? new Date(localTimestampStr) : null;

    if (cloudTimestamp && (!localTimestamp || cloudTimestamp > localTimestamp)) {
      // --- Case A: Cloud is newer. Download and REPLACE local. ---
      console.log('[cloud] Cloud is newer. Replacing all local data.');
      // This part remains the same, as it's a download operation.
      // ... (your existing code for Case A) ...
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('page-') || key.startsWith('pinned-') || key.startsWith('unpinned-') || key.startsWith('books-') || key.match(/^\d{4}-W\d{1,2}/)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => deleteStorage(key));

      if (cloudData.appData) {
        for (const key in cloudData.appData) {
            localStorage.setItem(key, cloudData.appData[key]);
        }
      }
      localStorage.setItem('lastModified', cloudData.lastModified);
      console.log('[cloud] Local data replaced. Reloading UI.');
      renderApp();

    } else if (localTimestamp && (!cloudTimestamp || localTimestamp > cloudTimestamp)) {
      // --- Case B & C Combined: Local is newer or Cloud is empty. UPLOAD local. ---
      console.log('[cloud] Local is newer. Replacing cloud data.');

      // Gather all relevant local data
      const localDataToUpload = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('page-') || key.startsWith('pinned-') || key.startsWith('unpinned-') || key.startsWith('books-') || key.match(/^\d{4}-W\d{1,2}/)) {
          localDataToUpload[key] = localStorage.getItem(key);
        }
      }

      const now = new Date().toISOString();
      localStorage.setItem('lastModified', now);

      // --- NEW LOGIC: CONSTRUCT THE PAYLOAD ---
      // Create the final object that will be uploaded.
      const dataToSet = {
        lastModified: now,
        appData: localDataToUpload,
        // Include the tokens we read at the beginning!
        tokens: existingTokens 
      };

      // Now, use .set() to overwrite the entire document with our new, complete object.
      // This correctly handles page deletions while preserving the tokens.
      await userDocRef.set(dataToSet);
      console.log('[cloud] Cloud data replaced, tokens preserved.');

    } else {
      // --- Case D: Timestamps match or neither is newer. Data is in sync. ---
      console.log('[cloud] Data is already in sync.');
    }

  } catch (error)
  {
    console.error("Cloud sync failed:", error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Subscribes the user to push notifications and saves the token to Firestore.
 */
// In js/cloud.js

async function subscribeUserToPush() {
  console.log('[subscribeUserToPush] called');
    try {
        // GET THE REGISTRATION OF YOUR EXISTING SERVICE WORKER
        const registration = await navigator.serviceWorker.getRegistration();
        console.log('[subscribeUserToPush] service worker registration:', registration);
        
        if (!registration) {
            throw new Error('No service worker registered. Cannot subscribe to push.');
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permission not granted for Notification');
        }

        const messaging = firebase.messaging();
        const vapidKey = 'BFech37cV60w4RmTjXHfOU043rH8DzeLUw-MM6bjz-bbSKsa_pAQIio81W0wsJocwmjJh17PACywfG92X5OSJf8'; // Your VAPID Key

        // PASS THE REGISTRATION AND VAPID KEY TO getToken()
        const token = await messaging.getToken({ 
            vapidKey: vapidKey, 
            serviceWorkerRegistration: registration 
        });

        if (token) {
            console.log('FCM Token:', token);
            saveTokenToFirestore(token);
        } else {
            console.log('No registration token available. Request permission to generate one.');
        }

        // Listen for token refresh and update Firestore
        messaging.onTokenRefresh(async () => {
            try {
                const refreshedToken = await messaging.getToken({
                    vapidKey: vapidKey,
                    serviceWorkerRegistration: registration
                });
                console.log('FCM token refreshed:', refreshedToken);
                saveTokenToFirestore(refreshedToken);
            } catch (err) {
                console.error('Unable to retrieve refreshed token ', err);
            }
        });
    } catch (error) {
        console.error('Unable to subscribe to push', error);
    }
}

/**
 * Saves the FCM token to the current user's document in Firestore.
 */
function saveTokenToFirestore(token) {
    const user = firebase.auth().currentUser;
    if (!user) {
        console.error("Cannot save token, user is not signed in.");
        return;
    }

    const userDocRef = firebase.firestore().collection('users').doc(user.uid);

    // This command will update the 'tokens' array.
    // If the document doesn't exist, it won't be created (we need to handle that).
    // If the 'tokens' field doesn't exist, it will be created.
    // FieldValue.arrayUnion() smartly adds the token only if it's not already there.
    userDocRef.set({
        tokens: firebase.firestore.FieldValue.arrayUnion(token)
    }, { merge: true }) // IMPORTANT: { merge: true } prevents overwriting other user data.
    .then(() => {
        console.log("Successfully saved token to Firestore!");
    })
    .catch((error) => {
        console.error("Error saving token to Firestore: ", error);
    });
}

// Make functions available globally and call init
window.initGoogleAuth = initGoogleAuth;
window.signIn = signIn;
window.signOut = signOut;
window.syncWithCloud = syncWithCloud;
window.subscribeUserToPush = subscribeUserToPush;

initGoogleAuth();
