// Settings modal logic
document.addEventListener('DOMContentLoaded', function () {
  // Ensure About modal is always hidden on page load (same as settings modal)
  var aboutFocalModalInit = document.getElementById('about-focal-modal');
  if (aboutFocalModalInit) aboutFocalModalInit.classList.add('hidden');
  const settingsModalOverlay = document.getElementById('settings-modal-overlay');
  const settingsModalClose = document.querySelector('.settings-modal-close');
  const settingsMenuToggle = document.querySelector('.settings-menu-toggle');
  const exportDataBtn = document.getElementById('export-data-btn');
  const importDataBtn = document.getElementById('import-data-btn');
  const syncCloudBtn = document.getElementById('sync-cloud-btn');
  const aboutAppBtn = document.getElementById('about-app-btn');
  const aboutFocalModal = document.getElementById('about-focal-modal');
  const aboutFocalModalClose = document.getElementById('about-focal-modal-close');

  // --- NOTIFICATION BUTTON LOGIC (use existing #notifications-btn) ---
  const notificationBtn = document.getElementById('notifications-btn');
  if (notificationBtn) {
    // Only update the span text, do not add a new icon (icon is in HTML)
    let textSpan = notificationBtn.querySelector('span');
    if (!textSpan) {
      textSpan = document.createElement('span');
      notificationBtn.appendChild(textSpan);
    }

    function updateNotificationBtnLabel() {
      if (!('Notification' in window)) {
        textSpan.textContent = 'Notifications Unavailable';
        notificationBtn.disabled = true;
        notificationBtn.classList.remove('active');
        return;
      }
      const status = Notification.permission;
      if (status === 'granted') {
        textSpan.textContent = 'Disable Notifications';
        notificationBtn.classList.add('active');
        notificationBtn.classList.remove('denied');
        notificationBtn.disabled = false;
      } else if (status === 'denied') {
        textSpan.textContent = 'Notifications Blocked';
        notificationBtn.classList.remove('active');
        notificationBtn.classList.add('denied');
        notificationBtn.disabled = true;
      } else {
        textSpan.textContent = 'Enable Notifications';
        notificationBtn.classList.remove('active');
        notificationBtn.classList.remove('denied');
        notificationBtn.disabled = false;
      }
    }

    updateNotificationBtnLabel();

    notificationBtn.addEventListener('click', async function () {
      
      if (Notification.permission === 'granted') {
        alert('To disable notifications, block them in your browser settings.');
      } else {

        if (window.NotificationManager) {
          await window.NotificationManager.requestPermission();
        }
        updateNotificationBtnLabel();
        subscribeUserToPush();
      }
    });

    // Also update label if permission changes in another tab
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) updateNotificationBtnLabel();
    });
  }
  let cloudSyncEnabled = localStorage.getItem('cloudSyncEnabled') === 'true';

  function updateSyncBtn() {
    if (cloudSyncEnabled) {
      syncCloudBtn.querySelector('span').textContent = 'Cloud Sync: On';
      syncCloudBtn.classList.add('active');
    } else {
      syncCloudBtn.querySelector('span').textContent = 'Cloud Sync: Off';
      syncCloudBtn.classList.remove('active');
    }
  }

  // Open settings modal only
  settingsMenuToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    settingsModalOverlay.classList.remove('hidden');
    if (window.feather) feather.replace();
    // Always hide About modal when opening settings
    if (aboutFocalModal) aboutFocalModal.classList.add('hidden');
  });

  // ABOUT FOCAL MODAL LOGIC
  if (aboutAppBtn && aboutFocalModal && aboutFocalModalClose) {
    // Open About modal only with About button
    aboutAppBtn.addEventListener('click', function (e) {
      e.preventDefault();
      aboutFocalModal.classList.remove('hidden');
      if (window.feather) feather.replace();
    });
    // Close About modal with X
    aboutFocalModalClose.addEventListener('click', function () {
      aboutFocalModal.classList.add('hidden');
    });
    // Close About modal by clicking outside the modal content
    aboutFocalModal.addEventListener('click', function (e) {
      if (e.target === aboutFocalModal) {
        aboutFocalModal.classList.add('hidden');
      }
    });
    // Close About modal with Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !aboutFocalModal.classList.contains('hidden')) {
        aboutFocalModal.classList.add('hidden');
      }
    });
  }

  // Close modal on close button
  settingsModalClose.addEventListener('click', function () {
    settingsModalOverlay.classList.add('hidden');
  });

  // Close modal on click outside modal
  settingsModalOverlay.addEventListener('click', function (e) {
    if (e.target === settingsModalOverlay) {
      settingsModalOverlay.classList.add('hidden');
    }
  });

  // Close modal on ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') settingsModalOverlay.classList.add('hidden');
  });

  // Handle Export Data button click
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportAllData);
  }

  // Handle Import Data button click
  if (importDataBtn) {
    importDataBtn.addEventListener('click', importAllData);
  }

  document.getElementById('account-auth-btn').addEventListener('click', () => {
    if (isSignedIn) {
      signOut();
    } else {
      signIn();
    }
  });

  document.querySelector('.sync-cloud-btn').addEventListener('click', () => {
    if (!isSignedIn) {
      alert('Please sign in first.');
      return;
    }
    cloudSyncEnabled = !cloudSyncEnabled;
    localStorage.setItem('cloudSyncEnabled', cloudSyncEnabled);
    window.isCloudSyncOn = cloudSyncEnabled; // <-- Ensure global flag is set
    updateSyncBtn();
    if (cloudSyncEnabled) {
      syncWithCloud();
      // Optionally, show a toast: "Cloud sync enabled"
    } else {
      // Optionally, show a toast: "Cloud sync disabled"
    }
  });

  updateSyncBtn();

  // On page load, set the global flag based on saved state
  window.isCloudSyncOn = cloudSyncEnabled;

  // THEME LOGIC REFACTORED
  const themeToggle = document.getElementById('theme-toggle');
  const themeOptions = document.getElementById('theme-options');
  const currentThemeLabel = document.getElementById('current-theme-label');
  const themeMap = {
    light: { class: 'light-mode', label: 'Light', icon: 'sun' },
    dark: { class: 'dark-mode', label: 'Dark', icon: 'moon' },
    solarized: { class: 'solarized-mode', label: 'Solarized', icon: 'sun' },
    dracula: { class: 'dracula-mode', label: 'Dracula', icon: 'moon' }
    ,nord: { class: 'nord-mode', label: 'Nord', icon: 'moon' }
    ,gruvbox: { class: 'gruvbox-mode', label: 'Gruvbox', icon: 'sun' }
    ,monokai: { class: 'monokai-mode', label: 'Monokai', icon: 'moon' }
    ,highcontrast: { class: 'highcontrast-mode', label: 'High Contrast', icon: 'sun' }
    ,sepia: { class: 'sepia-mode', label: 'Sepia', icon: 'sun' }
    ,amoled: { class: 'amoled-mode', label: 'Amoled', icon: 'moon' }
    ,onedark: { class: 'onedark-mode', label: 'OneDark', icon: 'moon' }
    ,paper: { class: 'paper-mode', label: 'Paper', icon: 'sun' }
  };

  // Remove all theme classes from body
  function clearThemeClasses() {
    Object.values(themeMap).forEach(t => document.body.classList.remove(t.class));
  }

  // Set theme and update UI
  function setTheme(theme) {
    if (!themeMap[theme]) theme = 'light';
    clearThemeClasses();
    document.body.classList.add(themeMap[theme].class);
    if (currentThemeLabel) currentThemeLabel.textContent = themeMap[theme].label;
    if (themeToggle && themeToggle.querySelector('i')) {
      themeToggle.querySelector('i').setAttribute('data-feather', themeMap[theme].icon);
      if (window.feather) feather.replace();
    }
    // Mark selected in dropdown
    if (themeOptions) {
      Array.from(themeOptions.children).forEach(li => {
        li.setAttribute('aria-selected', li.dataset.theme === theme ? 'true' : 'false');
      });
    }
    localStorage.setItem('theme', theme);
  }

  // Open dropdown on button click only (no toggle theme on click)
  if (themeToggle && themeOptions) {
    themeToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const expanded = themeToggle.getAttribute('aria-expanded') === 'true';
      themeToggle.setAttribute('aria-expanded', !expanded);
      themeOptions.classList.toggle('hidden');
      if (!themeOptions.classList.contains('hidden')) {
        // Focus the selected item
        const selected = themeOptions.querySelector('[aria-selected="true"]');
        if (selected) selected.focus();
      }
    });

    // Select theme from dropdown
    themeOptions.addEventListener('click', function (e) {
      if (e.target.dataset.theme) {
        setTheme(e.target.dataset.theme);
        themeOptions.classList.add('hidden');
        themeToggle.setAttribute('aria-expanded', 'false');
      }
      e.stopPropagation();
    });

    // Keyboard navigation for dropdown
    themeOptions.addEventListener('keydown', function (e) {
      const items = Array.from(themeOptions.querySelectorAll('li'));
      let idx = items.findIndex(li => li.getAttribute('aria-selected') === 'true');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = (idx + 1) % items.length;
        items[idx].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = (idx - 1 + items.length) % items.length;
        items[idx].focus();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (document.activeElement.dataset.theme) {
          setTheme(document.activeElement.dataset.theme);
          themeOptions.classList.add('hidden');
          themeToggle.setAttribute('aria-expanded', 'false');
        }
      } else if (e.key === 'Escape') {
        themeOptions.classList.add('hidden');
        themeToggle.setAttribute('aria-expanded', 'false');
        themeToggle.focus();
      }
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (!themeOptions.classList.contains('hidden')) {
        themeOptions.classList.add('hidden');
        themeToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // On load, restore theme (default to light)
  let savedTheme = localStorage.getItem('theme');
  if (!savedTheme || !themeMap[savedTheme]) savedTheme = 'light';
  setTheme(savedTheme);
  // THEME LOGIC END
});
