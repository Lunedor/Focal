// --- START OF FILE cloud.js ---

// Cloud sync setting: set to true to enable, false to disable
function isCloudSyncEnabled() {
  // Default to false if not set
  const val = localStorage.getItem('cloudSyncEnabled');
  return val === null ? false : val === 'true';
}

// Call this to enable or disable cloud sync (e.g. from a button)
function setCloudSyncEnabled(enabled) {
  localStorage.setItem('cloudSyncEnabled', enabled ? 'true' : 'false');
  window.isCloudSyncOn = enabled;
  console.log('[cloud] cloudSyncEnabled set to', enabled);
}

// On first load, set default if not present
if (localStorage.getItem('cloudSyncEnabled') === null) {
  localStorage.setItem('cloudSyncEnabled', 'false');
}
// Keep window.isCloudSyncOn in sync with the setting on load
window.isCloudSyncOn = isCloudSyncEnabled();

// Optionally, set this to auto-sync after every change
window.autoCloudSync = function() {
  if (typeof isSignedIn !== 'undefined' && isSignedIn && isCloudSyncEnabled() && typeof syncWithCloud === 'function') {
    syncWithCloud();
  }
};

// Helper: fetch with Google auth, auto-refresh on 401, and retry once (robust, prevents race conditions)
let tokenRefreshPromise = null;
async function refreshAccessToken() {
  if (!tokenClient) throw new Error('Token client not initialized');
  if (tokenRefreshPromise) return tokenRefreshPromise; // Prevent race conditions

  console.log('[cloud] Refreshing access token...');
  tokenRefreshPromise = new Promise((resolve, reject) => {
    // This callback is temporarily set to handle the response of this specific refresh request.
    tokenClient.callback = (tokenResponse) => {
      tokenRefreshPromise = null; // Allow next refresh to start
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        isSignedIn = true;
        localStorage.setItem('google_access_token', accessToken);
        console.log('[cloud] Token refreshed successfully.');
        resolve();
      } else {
        // This happens if silent refresh fails.
        console.error('[cloud] Failed to refresh token silently.');
        accessToken = null;
        isSignedIn = false;
        localStorage.removeItem('google_access_token');
        reject(new Error('Failed to refresh token.'));
      }
      updateAuthUI();
    };
    tokenClient.requestAccessToken({ prompt: '' });
  });
  return tokenRefreshPromise;
}

async function googleFetch(url, options = {}, retry = true) {
  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = 'Bearer ' + accessToken;
  let res = await fetch(url, options);

  if (res.status === 401 && retry && tokenClient) {
    // Token expired or invalid, try to get a new one silently.
    await refreshAccessToken();
    // Retry the request with the new token.
    options.headers['Authorization'] = 'Bearer ' + accessToken;
    res = await fetch(url, options);
  }
  return res;
}
const GOOGLE_CLIENT_ID = '253812985933-o2f15s5rcnimmsp9fi726avt9uenqdr2.apps.googleusercontent.com';
const GOOGLE_API_SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid profile email';

let tokenClient;
let accessToken = null;
let isSignedIn = false;
let authChecked = false;

// REFINED and CORRECTED initGoogleAuth
function initGoogleAuth() {
  // 🛠️ Set up Google OAuth 2.0 Token Client
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_API_SCOPES,
    // This callback runs only after a user explicitly clicks the Sign In button
    // and completes the popup flow.
    callback: async (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        isSignedIn = true;
        localStorage.setItem('google_access_token', accessToken);
        
        // After a fresh sign-in, enable cloud sync and perform the initial sync.
        setCloudSyncEnabled(true); 
        console.log('[cloud] User signed in successfully. Syncing with cloud...');
        await syncWithCloud();
      } else {
        // User closed the popup or the sign-in failed.
        console.log('[cloud] Token request was cancelled or failed.');
        accessToken = null;
        isSignedIn = false;
        localStorage.removeItem('google_access_token');
      }
      authChecked = true;
      updateAuthUI();
    }
  });

  // --- ON PAGE LOAD LOGIC ---
  accessToken = localStorage.getItem('google_access_token');
  if (accessToken) {
    // OPTIMISTIC: Assume user is signed in. UI will show "Sign Out".
    console.log('[cloud] Found existing token. Attempting to restore session.');
    isSignedIn = true;
    authChecked = true;
    updateAuthUI();

    // Now, check if sync is enabled and try to sync.
    // googleFetch will handle the silent token refresh if the token has expired.
    const syncEnabled = isCloudSyncEnabled();
    if (syncEnabled) {
      console.log('[cloud] Auto-syncing on page load...');
      // We wrap this in a try/catch in case the silent refresh fails
      // (e.g., user logged out of Google entirely or revoked permissions).
      syncWithCloud().catch(error => {
          console.error('[cloud] Auto-sync failed. This may be due to loss of authentication.', error);
          // If sync fails due to auth, the user is effectively signed out of our app.
          signOut(); 
      });
    }
  } else {
    // No token, definitely not signed in.
    isSignedIn = false;
    authChecked = true;
    updateAuthUI();
  }
}

// REFINED signOut
function signOut() {
  // Revoke the token to invalidate it on Google's side (best practice)
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('[cloud] Access token revoked.');
    });
  }
  
  localStorage.removeItem('google_access_token');
  accessToken = null;
  isSignedIn = false;
  // It's good practice to turn off the setting when the user explicitly signs out.
  setCloudSyncEnabled(false); 
  updateAuthUI();
}

// REVISED signIn
function signIn() {
  if (tokenClient) {
    authChecked = false;
    updateAuthUI(); // Immediately show "Checking..." for better UX
    // This will show the consent prompt, which is allowed because it's a user click
    tokenClient.requestAccessToken({});
  }
}

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
  const metadata = {
    name: 'focal-data.json',
    parents: ['appDataFolder'],
    mimeType: 'application/json'
  };

  // 1. Check if file exists
  const listRes = await googleFetch(
    'https://www.googleapis.com/drive/v3/files?q=name=%27focal-data.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id,name)'
  );
  if (!listRes.ok) throw new Error('Could not check for existing file.');
  const list = await listRes.json();
  const fileId = list.files && list.files[0] && list.files[0].id;

  if (fileId) {
    // 2. Update existing file
    await googleFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: fileContent
      }
    );
  } else {
    // 3. Create new file (multipart upload)
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      fileContent +
      close_delim;

    await googleFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/related; boundary=' + boundary
        },
        body: multipartRequestBody
      }
    );
  }
}

async function downloadAppData() {
  // 1. Find the file
  const listRes = await googleFetch(
    'https://www.googleapis.com/drive/v3/files?q=name=%27focal-data.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id,name)'
  );
  if (!listRes.ok) throw new Error('Could not list files from Google Drive.');
  const list = await listRes.json();
  const file = list.files && list.files[0];
  if (!file) return null;

  // 2. Download file content
  const resp = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  );
  if (!resp.ok) throw new Error('Could not download file content.');
  return await resp.json();
}

async function syncWithCloud() {
  // Gather all relevant local data
  const localData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key.startsWith('page-') ||
      key.match(/^\d{4}-W\d{1,2}-(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)$/)
    ) {
      localData[key] = localStorage.getItem(key);
    }
  }
  const pinnedPages = typeof getStorage === 'function' ? getStorage('pinned-pages') : localStorage.getItem('pinned-pages');
  if (pinnedPages !== null) {
    localData['pinned-pages'] = pinnedPages;
  }
  const unpinnedPages = typeof getStorage === 'function' ? getStorage('unpinned-pages') : localStorage.getItem('unpinned-pages');
  if (unpinnedPages !== null) {
    localData['unpinned-pages'] = unpinnedPages;
  }
  const localLastModified = localStorage.getItem('lastModified');
  if (localLastModified) {
    localData.lastModified = localLastModified;
  }

  // Download cloud data
  let cloudData = await downloadAppData();
  const localModified = localLastModified ? new Date(localLastModified) : null;
  const cloudModified = cloudData && cloudData.lastModified ? new Date(cloudData.lastModified) : null;

  // --- SYNC LOGIC ---
  if (!localModified && cloudData) {
    // Case: First time on a new device, restore from cloud.
    console.log('No local data found. Restoring from cloud...');
    for (const key in cloudData) {
      if (key === 'lastModified') continue;
      if (typeof setStorage === 'function' && (key === 'pinned-pages' || key === 'unpinned-pages')) {
          setStorage(key, cloudData[key]);
      } else {
          localStorage.setItem(key, cloudData[key]);
      }
    }
    if (cloudData.lastModified) {
      localStorage.setItem('lastModified', cloudData.lastModified);
    }
    console.log('Cloud data restored to this device!');
    if (typeof renderWeeklyPlanner === 'function') renderWeeklyPlanner(true);
    return;
  }

  if (!cloudData || (localModified && (!cloudModified || localModified > cloudModified))) {
    // Case: Cloud is empty or local is newer, so upload.
    console.log('Local data is newer. Syncing to cloud...');
    const now = new Date().toISOString();
    localData.lastModified = now;
    localStorage.setItem('lastModified', now);
    await uploadAppData(localData);
    console.log('Local data synced to cloud!');
  } else if (cloudModified && (!localModified || cloudModified > localModified)) {
    // Case: Cloud is newer, so download (restore).
    console.log('Cloud data is newer. Restoring to this device...');
    for (const key in cloudData) {
      if (key === 'lastModified') continue;
      if (typeof setStorage === 'function' && (key === 'pinned-pages' || key === 'unpinned-pages')) {
          setStorage(key, cloudData[key]);
      } else {
          localStorage.setItem(key, cloudData[key]);
      }
    }
    if (cloudData.lastModified) {
      localStorage.setItem('lastModified', cloudData.lastModified);
    }
    console.log('Cloud data restored to this device!');
    if (typeof renderWeeklyPlanner === 'function') renderWeeklyPlanner(true);
  } else {
    // Case: Timestamps match.
    console.log('Data is already up to date!');
  }
}

// Make functions available globally
window.syncWithCloud = syncWithCloud;
window.initGoogleAuth = initGoogleAuth;
window.signIn = signIn;
window.signOut = signOut;
