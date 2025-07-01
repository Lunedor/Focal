// Helper: fetch with Google auth, auto-refresh on 401, and retry once (robust, prevents race conditions)
let tokenRefreshPromise = null;
async function refreshAccessToken(forcePrompt = false) {
  if (!tokenClient) throw new Error('Token client not initialized');
  if (tokenRefreshPromise) return tokenRefreshPromise; // Prevent race conditions
  tokenRefreshPromise = new Promise((resolve) => {
    tokenClient.callback = (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        isSignedIn = true;
        localStorage.setItem('google_access_token', accessToken);
      } else {
        accessToken = null;
        isSignedIn = false;
        localStorage.removeItem('google_access_token');
      }
      updateAuthUI();
      tokenRefreshPromise = null;
      resolve();
    };
    tokenClient.requestAccessToken(forcePrompt ? {} : { prompt: '' });
  });
  return tokenRefreshPromise;
}

async function googleFetch(url, options = {}, retry = true) {
  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = 'Bearer ' + accessToken;
  let res = await fetch(url, options);
  if (res.status === 401 && retry && tokenClient) {
    // Token expired or invalid, try to get a new one (queue refreshes)
    await refreshAccessToken();
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
let authChecked = false; // Track if we've finished the silent check

function initGoogleAuth() {
  // 🛠️ Set up Google OAuth 2.0 Token Client
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_API_SCOPES,
    auto_select: true,
    callback: async (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        isSignedIn = true;
        localStorage.setItem('google_access_token', accessToken);
      } else {
        accessToken = null;
        isSignedIn = false;
        localStorage.removeItem('google_access_token');
      }
      authChecked = true;
      updateAuthUI();
      // After auth check, if signed in, sync with cloud
      if (isSignedIn) {
        await syncWithCloud();
      }
    }
  });

  // On load, check if a token exists in localStorage
  accessToken = localStorage.getItem('google_access_token');
  if (accessToken) {
    isSignedIn = true;
    authChecked = true;
    updateAuthUI();
    // Sync with cloud if signed in
    syncWithCloud();
  } else {
    isSignedIn = false;
    authChecked = true;
    updateAuthUI();
  }
}

function signIn() {
  if (tokenClient) {
    authChecked = false;
    updateAuthUI();
    // This will show the consent prompt
    tokenClient.requestAccessToken();
  }
}

function signOut() {
  localStorage.removeItem('google_access_token');
  accessToken = null;
  isSignedIn = false;
  updateAuthUI();
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
  const list = await listRes.json();
  const file = list.files && list.files[0];
  if (!file) return null;

  // 2. Download file content
  const resp = await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`
  );
  return await resp.json();
}

async function syncWithCloud() {
  // Gather all relevant keys (page- and planner keys)
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
  // Only add lastModified if it exists in localStorage
  const localLastModified = localStorage.getItem('lastModified');
  if (localLastModified) {
    localData.lastModified = localLastModified;
  }

  // Download cloud data
  let cloudData = await downloadAppData();
  const localModified = localLastModified ? new Date(localLastModified) : null;
  const cloudModified = cloudData && cloudData.lastModified ? new Date(cloudData.lastModified) : null;

  // --- CRITICAL LOGIC ---
  // If there is NO local lastModified but cloud data exists, always restore from cloud!
  if (!localModified && cloudData) {
    for (const key in cloudData) {
      if (key !== 'lastModified') {
        localStorage.setItem(key, cloudData[key]);
      }
    }
    if (cloudData.lastModified) {
      localStorage.setItem('lastModified', cloudData.lastModified);
    }
    alert('Cloud data restored to this device!');
    if (typeof renderWeeklyPlanner === 'function') renderWeeklyPlanner(true);
    return;
  }

  // If cloud is empty or local is newer, upload local
  if (!cloudData || (localModified && (!cloudModified || localModified > cloudModified))) {
    // Set and store lastModified
    const now = new Date().toISOString();
    localData.lastModified = now;
    localStorage.setItem('lastModified', now);
    await uploadAppData(localData);
    // alert('Local data synced to cloud!');
  } else if (cloudModified && cloudModified > localModified) {
    // Cloud is newer: restore cloud data
    for (const key in cloudData) {
      if (key !== 'lastModified') {
        localStorage.setItem(key, cloudData[key]);
      }
    }
    if (cloudData.lastModified) {
      localStorage.setItem('lastModified', cloudData.lastModified);
    }
    alert('Cloud data restored to this device!');
    if (typeof renderWeeklyPlanner === 'function') renderWeeklyPlanner(true);
  } else {
    // alert('Data is already up to date!');
  }
}

// Make it available globally
window.syncWithCloud = syncWithCloud;

window.initGoogleAuth = initGoogleAuth;
