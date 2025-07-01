// --- START OF FILE cloud.js ---

// Global state variables
let isSignedIn = false;
let accessToken = null; // This will now hold the Google Drive API access token
let authChecked = false;

// Initialize Firebase services
const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// IMPORTANT: We must request the Google Drive scope.
googleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');

/**
 * This is the main function that starts the authentication flow.
 * It sets up a listener that reacts to the user's sign-in state.
 */
function initGoogleAuth() {
  auth.onAuthStateChanged(user => {
    authChecked = true;
    if (user) {
      // --- User is signed in ---
      isSignedIn = true;
      console.log('[firebase] User is signed in:', user.displayName);

      // Check for the access token in localStorage.
      accessToken = localStorage.getItem('google_access_token');
      updateAuthUI();

      // If cloud sync is enabled, run it.
      // If the token is expired, googleFetch will now trigger a sign-out.
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
 * Triggers the Google Sign-In popup.
 * This is called when the user clicks the "Sign In" button.
 */
function signIn() {
  auth.signInWithPopup(googleProvider)
    .then((result) => {
      // This gives you a Google Access Token.
      // You can use it to access the Google API.
      const credential = result.credential;
      accessToken = credential.accessToken;

      // Store the token so it's available on page reload
      localStorage.setItem('google_access_token', accessToken);
      
      // After a fresh sign-in, enable cloud sync and perform the initial sync.
      setCloudSyncEnabled(true);
      console.log('[firebase] User signed in successfully. Syncing with cloud...');
      syncWithCloud();
      
    }).catch((error) => {
      console.error("[firebase] Sign-in error", error);
    });
}

/**
 * Signs the user out of Firebase.
 */
function signOut() {
  auth.signOut().then(() => {
    // The onAuthStateChanged listener will handle the rest.
    localStorage.removeItem('google_access_token');
    setCloudSyncEnabled(false);
  });
}

/**
 * A simplified fetch helper for Google APIs.
 * If it fails with a 401, it means the token from localStorage is stale,
 * and we should force a sign-out so the user can re-authenticate.
 */
async function googleFetch(url, options = {}) {
  if (!accessToken) {
    // This can happen if the user's session is restored but we don't have a token.
    // In this case, we force a sign-out to get them to re-auth.
    console.warn('[cloud] Attempted to fetch without an access token. Forcing sign-out.');
    signOut();
    throw new Error('Not authenticated.');
  }
  
  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = 'Bearer ' + accessToken;

  let res = await fetch(url, options);

  if (res.status === 401) {
    // Token is invalid or expired. The user needs to sign in again to get a new one.
    console.warn('[cloud] Google API token is invalid (401). Forcing sign-out to refresh.');
    signOut();
    // Throw an error to stop the sync process.
    throw new Error('Google API token expired.');
  }
  return res;
}


// --- YOUR EXISTING CODE (UNCHANGED, BUT RE-INCLUDED FOR COMPLETENESS) ---
// Note: The original refreshAccessToken function is no longer needed.

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
  const metadata = {
    name: 'focal-data.json',
    parents: ['appDataFolder'],
    mimeType: 'application/json'
  };
  const listRes = await googleFetch(
    'https://www.googleapis.com/drive/v3/files?q=name=%27focal-data.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id,name)'
  );
  const list = await listRes.json();
  const fileId = list.files && list.files[0] && list.files[0].id;

  if (fileId) {
    await googleFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: fileContent }
    );
  } else {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    const multipartRequestBody =
      delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
      delimiter + 'Content-Type: application/json\r\n\r\n' + fileContent + close_delim;
    await googleFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipartRequestBody }
    );
  }
}

async function downloadAppData() {
  const listRes = await googleFetch(
    'https://www.googleapis.com/drive/v3/files?q=name=%27focal-data.json%27+and+%27appDataFolder%27+in+parents&spaces=appDataFolder&fields=files(id,name)'
  );
  const list = await listRes.json();
  const file = list.files && list.files[0];
  if (!file) return null;
  const resp = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  );
  return await resp.json();
}

async function syncWithCloud() {
  // Try-catch block to handle errors during sync, like the token expiring.
  try {
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
    if (pinnedPages !== null) localData['pinned-pages'] = pinnedPages;
    const unpinnedPages = typeof getStorage === 'function' ? getStorage('unpinned-pages') : localStorage.getItem('unpinned-pages');
    if (unpinnedPages !== null) localData['unpinned-pages'] = unpinnedPages;
    const localLastModified = localStorage.getItem('lastModified');
    if (localLastModified) localData.lastModified = localLastModified;

    let cloudData = await downloadAppData();
    const localModified = localLastModified ? new Date(localLastModified) : null;
    const cloudModified = cloudData && cloudData.lastModified ? new Date(cloudData.lastModified) : null;

    if (!localModified && cloudData) {
      console.log('Restoring from cloud...');
      // ... (your restore logic)
    } else if (!cloudData || (localModified && (!cloudModified || localModified > cloudModified))) {
      console.log('Uploading to cloud...');
      // ... (your upload logic)
    } else if (cloudModified && cloudModified > localModified) {
      console.log('Downloading from cloud...');
      // ... (your download/restore logic)
    } else {
      console.log('Data is up to date!');
    }
  } catch (error) {
    console.error("Cloud sync failed:", error.message);
    // The error will be "Google API token expired" if it was a 401.
    // The signOut() has already been called in googleFetch.
  }
}

// Make functions available globally and call init
window.initGoogleAuth = initGoogleAuth;
window.signIn = signIn;
window.signOut = signOut;
window.syncWithCloud = syncWithCloud;

// This starts the whole process on page load
initGoogleAuth();
