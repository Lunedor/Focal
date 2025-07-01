// --- START OF FILE cloud.js ---

// Global state variables
let isSignedIn = false;
let accessToken = null;
let authChecked = false;

// Initialize Firebase services
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');

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

      // We still need to get a fresh OAuth token for the Drive API.
      // Firebase's `user` object doesn't automatically contain it.
      // We will get it during the sign-in popup and store it.
      accessToken = localStorage.getItem('google_access_token');
      updateAuthUI();

      // If cloud sync is enabled, run the sync.
      if (isCloudSyncEnabled()) {
        console.log('[firebase] Auto-syncing on page load...');
        syncWithCloud();
      }

    } else {
      // --- User is signed out ---
      isSignedIn = false;
      accessToken = null;
      localStorage.removeItem('google_access_token');
      console.log('[firebase] User is signed out.');
      updateAuthUI();
    }
  });
}

/**
 * CHANGE 1: Simplified signIn function.
 * Its ONLY job is to trigger the popup. The onAuthStateChanged listener will handle the result.
 */
function signIn() {
  auth.signInWithPopup(googleProvider)
    .then((result) => {
      const credential = result.credential;
      accessToken = credential.accessToken;
      // Store the token so our googleFetch helper can use it.
      localStorage.setItem('google_access_token', accessToken);

      // This is the user's first time signing in during this session.
      // Let's enable sync and run it for the first time.
      if (!isCloudSyncEnabled()) {
        setCloudSyncEnabled(true);
        syncWithCloud();
      }
    }).catch((error) => {
      console.error("[firebase] Sign-in error", error);
    });
}

/**
 * Signs the user out of Firebase.
 */
function signOut() {
  auth.signOut().then(() => {
    // onAuthStateChanged will automatically handle the UI updates.
    localStorage.removeItem('google_access_token');
    setCloudSyncEnabled(false);
  });
}

/**
 * A simplified fetch helper for Google APIs.
 */
async function googleFetch(url, options = {}) {
  if (!accessToken) {
    console.warn('[cloud] Attempted to fetch without an access token. Forcing sign-out.');
    signOut();
    throw new Error('Not authenticated.');
  }
  
  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = 'Bearer ' + accessToken;

  let res = await fetch(url, options);

  if (res.status === 401) {
    console.warn('[cloud] Google API token is invalid (401). Forcing sign-out to refresh.');
    signOut();
    throw new Error('Google API token expired.');
  }
  return res;
}

function isCloudSyncEnabled() {
  const val = localStorage.getItem('cloudSyncEnabled');
  return val === null ? false : val === 'true';
}

function setCloudSyncEnabled(enabled) {
  localStorage.setItem('cloudSyncEnabled', enabled ? 'true' : 'false');
  window.isCloudSyncOn = enabled;
  console.log('[cloud] cloudSyncEnabled set to', enabled);
}

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

async function uploadAppData(data) {
  data.lastModified = new Date().toISOString();
  const fileContent = JSON.stringify(data);
  const metadata = { name: 'focal-data.json', parents: ['appDataFolder'], mimeType: 'application/json' };
  const listRes = await googleFetch('https://www.googleapis.com/drive/v3/files?q=name=%27focal-data.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id,name)');
  const list = await listRes.json();
  const fileId = list.files && list.files[0] && list.files[0].id;
  if (fileId) {
    await googleFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: fileContent });
  } else {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const multipartRequestBody = delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: application/json\r\n\r\n' + fileContent + close_delim;
    await googleFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipartRequestBody });
  }
}

async function downloadAppData() {
  const listRes = await googleFetch('https://www.googleapis.com/drive/v3/files?q=name=%27focal-data.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id,name)');
  const list = await listRes.json();
  const file = list.files && list.files[0];
  if (!file) return null;
  const resp = await googleFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
  return await resp.json();
}

/**
 * CHANGE 2: Unified and robust sync logic.
 * It now handles all cases and ensures the UI is re-rendered when necessary.
 */
async function syncWithCloud() {
  try {
    const localData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('page-') || key.match(/^\d{4}-W\d{1,2}-(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)$/)) {
        localData[key] = localStorage.getItem(key);
      }
    }
    const pinnedPages = typeof getStorage === 'function' ? getStorage('pinned-pages') : localStorage.getItem('pinned-pages');
    if (pinnedPages !== null) localData['pinned-pages'] = pinnedPages;
    const unpinnedPages = typeof getStorage === 'function' ? getStorage('unpinned-pages') : localStorage.getItem('unpinned-pages');
    if (unpinnedPages !== null) localData['unpinned-pages'] = unpinnedPages;
    const localLastModified = localStorage.getItem('lastModified');
    if (localLastModified) localData.lastModified = localLastModified;

    let cloudData = await downloadAppData();
    const localModified = localLastModified ? new Date(localLastModified) : null;
    const cloudModified = cloudData && cloudData.lastModified ? new Date(cloudData.lastModified) : null;

    let needsUIRefresh = false;

    if (!localModified && cloudData) {
      console.log('No local data found. Restoring from cloud...');
      for (const key in cloudData) {
        if (key === 'lastModified') continue;
        localStorage.setItem(key, cloudData[key]);
      }
      localStorage.setItem('lastModified', cloudData.lastModified);
      needsUIRefresh = true;
    } else if (!cloudData || (localModified && (!cloudModified || localModified > cloudModified))) {
      console.log('Local data is newer. Syncing to cloud...');
      const now = new Date().toISOString();
      localData.lastModified = now;
      localStorage.setItem('lastModified', now);
      await uploadAppData(localData);
    } else if (cloudModified && (!localModified || cloudModified > localModified)) {
      console.log('Cloud data is newer. Restoring to this device...');
      for (const key in cloudData) {
        if (key === 'lastModified') continue;
        localStorage.setItem(key, cloudData[key]);
      }
      localStorage.setItem('lastModified', cloudData.lastModified);
      needsUIRefresh = true;
    } else {
      console.log('Data is already up to date!');
    }
    
    // If we downloaded and applied new data, refresh the whole app UI.
    if (needsUIRefresh) {
        console.log("Refreshing UI with new data from the cloud.");
        if (typeof renderApp === 'function') {
            renderApp();
        } else {
            // As a fallback if renderApp() isn't available, just reload the page.
            window.location.reload();
        }
    }
  } catch (error) {
    console.error("Cloud sync failed:", error.message);
  }
}

// Make functions available globally and call init
window.initGoogleAuth = initGoogleAuth;
window.signIn = signIn;
window.signOut = signOut;
window.syncWithCloud = syncWithCloud;

// This starts the whole process on page load
initGoogleAuth();
