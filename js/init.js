// --- Unpinned Pages Order Utilities ---
function getUnpinnedPagesOrder() {
  try {
    return JSON.parse(localStorage.getItem('unpinned-pages') || '[]');
  } catch {
    return [];
  }
}

function setUnpinnedPagesOrder(arr) {
  setStorage('unpinned-pages', JSON.stringify(arr));
}

// --- DEEP LINK HANDLER ---
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const plannerKey = params.get('plannerKey');
  if (view === 'weekly' && plannerKey) {
    appState.currentView = 'weekly';
    appState.currentDate = window.parsePlannerKeyToDate(plannerKey) || new Date();
  } else if (view && !plannerKey) {
    // Assume view is a page title
    appState.currentView = view;
  } else {
    // Fallback: default view (weekly planner)
    appState.currentView = 'weekly';
    appState.currentDate = new Date();
  }
}

// --- INITIALIZATION & APP ENTRY ---
function renderApp() {
  renderSidebar();
  renderView();
}

function renderView() {
  DOM.plannerView.classList.remove('active');
  DOM.libraryView.classList.remove('active');
  DOM.monthlyCalendarView.classList.remove('active'); // Hide monthly view by default

  if (appState.currentView === 'weekly') {
    renderWeeklyPlanner(true);
    DOM.plannerView.classList.add('active');
  } else if (appState.currentView === 'monthly') { // Handle monthly view
    renderMonthlyCalendar(appState.currentDate);
    DOM.monthlyCalendarView.classList.add('active');
  } else {
    renderLibraryPage(appState.currentView);
    DOM.libraryView.classList.add('active');
  }
  updateSidebarActiveState();
}

function renderSidebar() {
  const searchTerm = DOM.librarySearch.value.toLowerCase();
  const allPages = Object.keys(localStorage)
    .filter(key => key.startsWith('page-'))
    .map(key => key.substring(5))
    .filter(page => {
      if (!searchTerm) return true;
      // Check title
      if (page.toLowerCase().includes(searchTerm)) return true;
      // Check content
      const content = (localStorage.getItem('page-' + page) || '').toLowerCase();
      return content.includes(searchTerm);
    });
  const pinned = getPinnedPages().filter(page => allPages.includes(page));
  // Use custom order for unpinned pages, fallback to alpha for new
  let unpinnedOrder = getUnpinnedPagesOrder().filter(page => allPages.includes(page) && !pinned.includes(page));
  const unpinnedNew = allPages.filter(page => !pinned.includes(page) && !unpinnedOrder.includes(page)).sort();
  const unpinned = [...unpinnedOrder, ...unpinnedNew];
  let html = '';
  const renderPinBtn = (page) =>
    `<button class="page-action-btn pin" data-action="pin-page" data-page="${page}" title="${isPagePinned(page) ? 'Unpin' : 'Pin'}"><i data-feather="${isPagePinned(page) ? 'bookmark' : 'bookmark'}" class="${isPagePinned(page) ? 'filled': ''}"></i></button>`;
  // Add draggable and data-index for pinned items
  const renderItem = (page, idx, isPinned, isUnpinned) => `
    <li class="library-page-item${isPinned ? ' pinned' : ''}${isUnpinned ? ' unpinned' : ''}"${(isPinned || isUnpinned) ? ` draggable=\"true\" data-index=\"${idx}\"` : ''} data-page="${page}">
      <a href="#" data-view="${page}">${page}</a>
      <div class="page-actions">
        ${renderPinBtn(page)}
        <button class="page-action-btn rename" data-action="rename-page" data-page="${page}" title="Rename"><i data-feather="edit-2"></i></button>
        <button class="page-action-btn delete" data-action="delete-page" data-page="${page}" title="Delete"><i data-feather="x"></i></button>
      </div>
    </li>
  `;
  if (pinned.length + unpinned.length > 0) {
    if (pinned.length > 0) {
      html += pinned.map((page, idx) => renderItem(page, idx, true, false)).join('');
    }
    if (unpinned.length > 0) {
      html += unpinned.map((page, idx) => renderItem(page, idx, false, true)).join('');
    }
  } else {
    html += '<li class="empty-library">No pages yet</li>';
  }
  DOM.libraryNavList.innerHTML = html;
  if (window.feather) feather.replace();
  updateSidebarActiveState();

  // --- Drag and drop handlers for pinned and unpinned items ---
  setupDragAndDrop('pinned', pinned, getPinnedPages, setPinnedPages);
  setupDragAndDrop('unpinned', unpinned, getUnpinnedPagesOrder, setUnpinnedPagesOrder);
}

function setupDragAndDrop(itemType, itemsArray, getData, setData) {
  let dragSrcIdx = null;
  let dragType = null;

  const items = DOM.libraryNavList.querySelectorAll(`.library-page-item.${itemType}`);

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      dragSrcIdx = Number(item.dataset.index);
      dragType = itemType;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      dragSrcIdx = null;
      dragType = null;
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const targetIdx = Number(item.dataset.index);

      if (dragType !== itemType || dragSrcIdx === null || dragSrcIdx === targetIdx) return;

      let currentItems = (itemType === 'unpinned') ? itemsArray.slice() : getData();

      const [moved] = currentItems.splice(dragSrcIdx, 1);
      currentItems.splice(targetIdx, 0, moved);

      setData(currentItems);
      renderSidebar();
    });
  });
}

function updateSidebarActiveState() {
    document.querySelectorAll('#sidebar a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`#sidebar a[data-view="${appState.currentView}"]`);
    if (activeLink) activeLink.classList.add('active');
}

function init() {
  setTheme(getPreferredTheme());
  handleDeepLink();
  if (!localStorage.getItem('focal-journal-visited')) {
    // --- SETUP SAMPLE DATA FOR FIRST-TIME USERS (SHOWCASE ALL FEATURES) ---

    // 1. Determine today's key for the planner
    const today = new Date();
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const todayDayIndex = dateFns.getISODay(today) - 1; // 0=Mon, 6=Sun
    const todayDayName = dayNames[todayDayIndex];
    const todayKey = `${getWeekKey(today)}-${todayDayName}`;

    // Get dates for this week for scheduling examples
    const tomorrow = dateFns.addDays(today, 1);
    const dayAfterTomorrow = dateFns.addDays(today, 2);

    // Format dates for (SCHEDULED: ...) and (NOTIFY: ...) tags
    const todayDateStr = dateFns.format(today, 'yyyy-MM-dd');
    const tomorrowDateStr = dateFns.format(tomorrow, 'dd.MM.yyyy'); // Use different format
    const dayAfterTomorrowDateStr = dateFns.format(dayAfterTomorrow, 'yyyy-MM-dd');
    const notificationTime = dateFns.addMinutes(today, 1); // Set for 1 minute in the future
    const notificationTimeStr = dateFns.format(notificationTime, 'yyyy-MM-dd HH:mm');

    // 2. Create a planner entry for today (show checkboxes, bold, italic, scheduled, repeat, wiki-links)
    setStorage(todayKey, `
# Today's Plan



TASKS: Today's Tasks


GOAL: Try all features
    `.trim());

    // 3. Create a "Welcome" page and pin it (showcase wiki-links, task summary, backlinks, etc)
    const welcomeContent = `
# Welcome to Focal! 🎯

Welcome to your new personal dashboard. Focal is a minimalist, local-first planner and knowledge base.


## Quick Start



## Features to Explore


TASKS: Getting Started
    `.trim();
    setStorage('page-Welcome to Focal', welcomeContent);
    setPinnedPages(['Welcome to Focal']); // Pin this page

    // 4. Create a "Feature Showcase" page with all features
    const showcaseContent = `
# Feature Showcase

This page demonstrates all features of Focal.

---

## Checkboxes & Markdown
- [ ] Simple task
- [x] Completed task
- [ ] **Bold task**
- [ ] *Italic task*
- [ ] Task with a [[Wiki Link]]
- [ ] Task with (SCHEDULED: ${todayDateStr})
- [ ] Task with a notification (NOTIFY: ${notificationTimeStr})

Events with (REPEAT: every friday from ${todayDateStr} to ${dayAfterTomorrowDateStr})
Events like anniversary (REPEAT: ${dateFns.format(today, 'dd-MM')})

---

## Task Summary
TASKS: Demo Tasks
- [x] Task 1
- [ ] Task 2
- [ ] Task 3

---

## Goal Tracking
GOAL: Read 5 books by ${dayAfterTomorrowDateStr}
1. Book One
2. Book Two
3. Book Three

GOAL: Finish project by ${dayAfterTomorrowDateStr}
PROGRESS: [60%]
- [x] Setup repo
- [x] Initial commit
- [ ] Write documentation

GOAL: Simple checklist goal
- [ ] Step 1
- [x] Step 2

---

## Backlinks
This page is linked from [[Welcome to Focal]].
    `.trim();
    setStorage('page-Feature Showcase', showcaseContent);

    // 5. Create a "Goals" page to showcase the GOAL syntax
    const goalsContent = `
# My 2025 Goals

This page demonstrates different ways to track goals.

---

GOAL: Plan summer vacation
- [ ] Decide on a destination.
- [ ] Book flights.
- [x] Research hotels.
- [ ] Create itinerary.

---

GOAL: Read 12 books by 2025-12-31
*This goal tracks a number and has a deadline.*
1. The Pragmatic Programmer
2. Clean Code
3. Atomic Habits
4. Deep Work

---

GOAL: Learn to play Guitar
*This goal uses a manual progress tracker.*
PROGRESS: [25%]
- Practice chords daily.
- Learn one new song per week.

---

GOAL: Ship side project by 2025-10-31
*This is a simple deadline-based goal.*
All tasks for this are tracked on the [[Feature Showcase]] page.
    `.trim();
    setStorage('page-My 2025 Goals', goalsContent);

    // 6. Set the visited flag
    localStorage.setItem('focal-journal-visited', 'true');
  }
  
  // Initialize Notification Manager
  if (window.NotificationManager) {
    window.NotificationManager.init();
  }
  // --- Ensure push token is registered on app load if notifications are granted and user is signed in ---
  if (window.firebase && window.subscribeUserToPush && window.firebase.auth) {
    console.log('[init] Checking auth state and notification permission...');
    window.firebase.auth().onAuthStateChanged(function(user) {
      console.log('[init] Auth state changed:', user);
      if (user && Notification.permission === 'granted') {
        console.log('[init] User is signed in and notification permission is granted.');
        window.subscribeUserToPush();
      }
    });
  }
  renderApp();
  addMonthYearDropdownListeners();
}

init();

// --- Debounce Utility ---
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// --- Debounced Sidebar Search Setup ---
if (DOM.librarySearch) {
  DOM.librarySearch.removeEventListener('_debouncedInput', DOM._debouncedSidebarHandler || (()=>{}));
  DOM._debouncedSidebarHandler = debounce(renderSidebar, 200);
  DOM.librarySearch.addEventListener('input', DOM._debouncedSidebarHandler);
}
