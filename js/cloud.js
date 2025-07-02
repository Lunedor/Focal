// --- START OF FILE cloud.js ---

// Global state variables
let isSignedIn = false;
let accessToken = null; // Token will now only live in memory
let authChecked = false;
let isSyncing = false; // Guard to prevent concurrent syncs

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
      updateAuthUI();

      // --- MODIFIED: DO NOT AUTO-SYNC ON PAGE LOAD ---
      // We no longer sync automatically on page load because we don't have an
      // access token, and trying to get one would be blocked by the browser.
      // The user must initiate the first sync by clicking the button.
      console.log('[firebase] User is authenticated. Ready for manual sync.');

    } else {
      // --- User is signed out ---
      isSignedIn = false;
      accessToken = null; // Clear the in-memory token
      console.log('[firebase] User is signed out.');
      updateAuthUI();
    }
  });
}

/**
 * CORRECTED signIn function.
 * Its ONLY job is to trigger the popup and get the token.
 */
function signIn() {
  auth.signInWithPopup(googleProvider)
    .then((result) => {
      // The onAuthStateChanged listener will handle the UI updates.
      // We just need to store the token for our API calls.
      const credential = result.credential;
      accessToken = credential.accessToken;
      console.log('[firebase] New access token obtained.');
      // Immediately sync after a successful manual sign-in
      if (isCloudSyncEnabled()) {
        syncWithCloud();
      }
    }).catch((error) => {
      console.error("[firebase] Sign-in error", error);
      if (error.code === 'auth/popup-blocked') {
        alert("Sign-in popup was blocked by the browser. Please allow popups for this site and try again.");
      }
    });
}

function signOut() {
  auth.signOut().then(() => {
    // onAuthStateChanged will automatically handle the rest.
    setCloudSyncEnabled(false);
  });
}

async function googleFetch(url, options = {}) {
  if (!accessToken) {
    console.warn('[cloud] Attempted to fetch without an access token.');
    throw new Error('Token missing');
  }

  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = 'Bearer ' + accessToken;

  let res = await fetch(url, options);

  if (res.status === 401) {
    console.warn('[cloud] Google API token is invalid (401). It needs to be refreshed.');
    throw new Error('Token expired');
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
  const btn = document.getElementById('sync-cloud-btn');
  if (btn) {
      btn.querySelector('span').textContent = `Cloud Sync: ${enabled ? 'On' : 'Off'}`;
  }
  console.log('[cloud] cloudSyncEnabled set to', enabled);
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

async function uploadAppData(data) {
  console.log('[cloud] Uploading keys to cloud:', Object.keys(data));
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

async function syncWithCloud(isRetry = false) {
  if (isSyncing) {
    console.log('[cloud] Sync already in progress. Skipping.');
    return;
  }
  isSyncing = true;

  try {
    // Gather local data
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

    if (cloudData && cloudModified && (!localModified || cloudModified >= localModified)) {
     const cloudKeys = new Set(Object.keys(cloudData));
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if ((key.startsWith('page-') || key.match(/^\d{4}-W\d{1,2}-(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)$/)) && !cloudKeys.has(key)) {
          localStorage.removeItem(key);
        }
      }
      for (const key in cloudData) {
        if (key === 'lastModified') continue;
        localStorage.setItem(key, cloudData[key]);
      }
      localStorage.setItem('lastModified', cloudData.lastModified);
      needsUIRefresh = true;
      for (const key in localData) { delete localData[key]; }
      for (const key in cloudData) {
        if (key !== 'lastModified') localData[key] = cloudData[key];
      }
      localData.lastModified = cloudData.lastModified;
    }

    if (!cloudData || (localModified && (!cloudModified || localModified > cloudModified))) {
      console.log('Uploading to cloud...');
      const now = new Date().toISOString();
      localData.lastModified = now;
      localStorage.setItem('lastModified', now);
      await uploadAppData(localData);
    } else if (!needsUIRefresh) {
      console.log('Data is already up to date!');
    }

    if (needsUIRefresh) {
      console.log("Refreshing UI with new data from the cloud.");
      if (typeof renderApp === 'function') {
        renderApp();
      } else {
        window.location.reload();
      }
    }
  } catch (error) {
    // This retry logic is now perfect because it will only be triggered by a user action
    // (clicking a sync button), which allows the popup to appear.
    if ((error.message === 'Token expired' || error.message === 'Token missing') && !isRetry) {
      console.log('[cloud] Token is invalid. Attempting to refresh by re-authenticating...');
      try {
        const result = await auth.signInWithPopup(googleProvider);
        const credential = result.credential;
        accessToken = credential.accessToken;
        console.log('[cloud] Token refreshed successfully. Retrying sync...');
        return syncWithCloud(true);
      } catch (reauthError) {
        console.error('[cloud] Failed to re-authenticate to refresh token. Signing out.', reauthError);
        signOut();
      }
    } else {
      console.error("Cloud sync failed:", error.message);
    }
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
