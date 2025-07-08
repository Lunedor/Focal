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
    const dayAfterTomorrow = dateFns.addDays(today, 2);

    // Format dates for (SCHEDULED: ...) and (NOTIFY: ...) tags
    const todayDateStr = dateFns.format(today, 'yyyy-MM-dd');
    const dayAfterTomorrowDateStr = dateFns.format(dayAfterTomorrow, 'yyyy-MM-dd');
    const notificationTime = dateFns.addMinutes(today, 1); // Set for 1 minute in the future
    const notificationTimeStr = dateFns.format(notificationTime, 'yyyy-MM-dd HH:mm');

    // Dates for mood tracker example
    const yesterday = dateFns.subDays(today, 1);
    const twoDaysAgo = dateFns.subDays(today, 2);
    const threeDaysAgo = dateFns.subDays(today, 3);
    const yesterdayStr = dateFns.format(yesterday, 'yyyy-MM-dd');
    const twoDaysAgoStr = dateFns.format(twoDaysAgo, 'yyyy-MM-dd');
    const threeDaysAgoStr = dateFns.format(threeDaysAgo, 'yyyy-MM-dd');

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

- Use the Weekly Planner for your day-to-day planning
- Create new pages using the + icon in the sidebar
- Try out the markdown editor with our extended syntax

## Features to Explore

- **Weekly Planner**: Plan your week with a day-by-day view
- **Monthly Calendar**: Get a bird's eye view of your month
- **Task Management**: Create and track tasks with checkboxes
- **Goal Tracking**: Set and monitor goals with progress bars
- **Mood Tracking**: Log and visualize your daily moods ([[Daily Journal]])
- **Finance Tracking**: Monitor income, expenses, and spending patterns ([[Finances]])
- **Book Tracking**: Manage your reading library and track progress ([[Reading List]])
- **Movie Tracking**: Build your watchlist and track viewing history ([[Movies]])
- **Wiki Links**: Create connected notes with [[Feature Showcase|wiki-style links]]

TASKS: Getting Started
- [ ] Explore the Weekly Planner
- [ ] Check out the [[Feature Showcase]] page
- [ ] Create your first custom page
- [ ] Try the mood tracking in the [[Daily Journal]]
- [ ] Set up your finances in the [[Finances]] page
- [ ] Add books to your [[Reading List]]
- [ ] Create a movie watchlist in [[Movies]]
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

## Mood Tracking
Log your daily mood and visualize patterns on the [[Daily Journal]] page.

Use the MOOD: syntax with different view types (calendar, circular, chart) and styles (color, emoji, all).

---

## Finance Tracking
Track your finances and visualize spending patterns on the [[Finances]] page.

Use the FINANCE: syntax with different view types (summary, chart, chartpie) and time filters.

Each transaction follows this format: Date, Description, Amount, Category

---

## Book Tracking
Manage your reading library and track progress on the [[Reading List]] page.

Use the BOOKS: syntax with different widget types (to-read, currently-reading, finished, bookshelf, stats, full-tracker).

Search and add books using the Google Books API integration.

---

## Movie Tracking
Build your watchlist and track viewing history on the [[Movies]] page.

Use the MOVIES: syntax with different widget types (watchlist, watched, favorites, stats, full-tracker).

Search and add movies using The Movie Database (TMDB) API integration.

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

    // 6. Create a "Daily Journal" page with a mood tracker
    const journalContent = `
# Daily Journal

Use this page for your daily thoughts, reflections, and mood tracking. Tracking your mood can help you identify patterns and improve your mental well-being over time.

---

## Mood Tracking System

The Mood Tracking feature lets you visualize your emotional states over time with different display options.

### Calendar View
*See your moods laid out in a calendar format*

MOOD: calendar, emoji, ${threeDaysAgoStr}:calm, ${twoDaysAgoStr}:happy, ${yesterdayStr}:sad, ${todayDateStr}:excited

---

## Mood Widget Options

You can customize mood tracking widgets with:

### View Types
- \`calendar\`: Display moods on a monthly calendar
- \`circular\`: Show moods in a circular timeline
- \`chart\`: Visualize mood trends in a line chart

### Display Styles
- \`emoji\`: Show moods as emojis (😀, 😐, 😔)
- \`color\`: Represent moods with colors
- \`all\`: Display both emoji and color indicators

---

## Today's Journal Entry

### What went well?
- Started using Focal for my journal and mood tracking
- Made progress on my main project
- Had a productive meeting with the team

### What could be improved?
- Need to manage my time better
- Should take more breaks during focused work

### Notes
- Remember to check out the [[Feature Showcase]] page to learn more about Focal
- Try the new finance tracking features on the [[Finances]] page
    `.trim();
    setStorage('page-Daily Journal', journalContent);

    // 7. Create a "Finances" page to showcase the finance tracker
    const financesContent = `
# Financial Management

Track all your income and expenses in one place with Focal's finance tracking system. The finance widgets automatically summarize and visualize your transactions to help you understand your spending patterns.

## How to Use
1. Add transactions using the format: \`Date, Description, Amount, Category\`
2. Use positive amounts for income (e.g., +500.00) and negative for expenses (e.g., -45.00)
3. Group transactions under FINANCE: widgets with different visualizations

---

## This Month's Summary

FINANCE: summary+chart+chartpie, USD, this-month
- ${todayDateStr}, Coffee, -4.50, Food
- ${todayDateStr}, Lunch, -12.75, Food
- ${yesterdayStr}, Freelance Payment, +500.00, Income
- ${yesterdayStr}, Internet Bill, -65.00, Utilities
- ${twoDaysAgoStr}, Groceries, -85.20, Food
- ${twoDaysAgoStr}, Gas, -45.00, Transportation
- ${threeDaysAgoStr}, Movie Tickets, -25.00, Entertainment
- ${threeDaysAgoStr}, Monthly Salary, +2500.00, Income
- ${dateFns.format(dateFns.subDays(today, 4), 'yyyy-MM-dd')}, Rent, -1200.00, Housing
- ${dateFns.format(dateFns.subDays(today, 5), 'yyyy-MM-dd')}, Phone Bill, -45.00, Utilities
- ${dateFns.format(dateFns.subDays(today, 6), 'yyyy-MM-dd')}, Dinner with Friends, -65.00, Food
- ${dateFns.format(dateFns.subDays(today, 7), 'yyyy-MM-dd')}, Book Purchase, -15.00, Entertainment

---

## Widget Options

You can customize finance widgets with the following options:

### View Types
- \`summary\`: Shows total income, expenses, and balance
- \`chart\`: Bar chart of income/expenses over time
- \`chartpie\`: Pie chart showing category distribution

### Time Filters
- \`this-week\`: Current week transactions
- \`this-month\`: Current month transactions 
- \`this-year\`: Current year transactions
- \`last-month\`: Previous month transactions
- \`custom:YYYY-MM-DD:YYYY-MM-DD\`: Custom date range

### Currency Support
- Specify currency code (USD, EUR, GBP, etc.)
- Example: \`FINANCE: summary, EUR, this-month\`

### Combined Widgets
- Combine multiple views using +
- Example: \`FINANCE: summary+chartpie, USD, this-month\`
    `.trim();
    setStorage('page-Finances', financesContent);

    // 8. Create a "Reading List" page to showcase the books tracker
    const readingListContent = `
# My Reading List 📚

Welcome to your personal library! Track your reading progress, discover new books, and organize your literary journey with Focal's integrated book tracking system.

## How to Use
1. Use the search feature to find books from Google Books API
2. Track reading progress with visual progress bars
3. Organize books by status: To Read, Reading, Finished, DNF, On Hold
4. Set reading goals and track your progress

---

## Current Reading Progress

BOOKS: currently-reading

---

## Books To Read

BOOKS: to-read

---

## Reading Statistics

BOOKS: stats

---

## Complete Library

BOOKS: full-tracker

---

## Reading Goals Integration

Your reading progress automatically integrates with goal tracking. Try creating goals like:

- **GOAL: Read 12 books in 2025**
- **GOAL: Finish the Harry Potter series**
- **GOAL: Read one non-fiction book per month**

Books marked as "Finished" will automatically count towards your reading goals when you use the checkbox interface.

## Tips for Success

- Set realistic reading goals based on your schedule
- Use the progress tracker to maintain momentum
- Explore different genres to keep reading interesting
- Join the [[Daily Journal]] to reflect on what you've read
    `.trim();
    setStorage('page-Reading List', readingListContent);

    // 9. Create a "Movies" page to showcase the movie tracker
    const moviesContent = `
# My Movie Watchlist 🎬

Discover, track, and organize your movie viewing experience with Focal's integrated movie tracking system powered by The Movie Database (TMDB).

## How to Use
1. Search for movies using the TMDB database integration
2. Track viewing status: To Watch, Watched, Favorites, Dropped
3. Rate movies and add personal notes
4. Filter and organize your collection

---

## Movies To Watch

MOVIES: watchlist

---

## Recently Watched

MOVIES: watched

---

## My Favorites

MOVIES: favorites

---

## Viewing Statistics

MOVIES: stats

---

## Complete Movie Library

MOVIES: full-tracker

---

## Movie Night Ideas

### By Genre
- **Action**: Check out the latest blockbusters
- **Drama**: Explore critically acclaimed films
- **Comedy**: Find something light and fun
- **Documentary**: Learn something new

### By Mood
- **Feel Good**: Uplifting stories and comedies
- **Thought Provoking**: Complex narratives and deep themes
- **Adventure**: Exciting journeys and escapism
- **Classic**: Timeless films everyone should see

## Integration with Goals

Create movie-watching goals and track your progress:

- **GOAL: Watch 50 movies in 2025**
- **GOAL: Explore international cinema**
- **GOAL: Watch all Marvel movies in order**

Use the checkbox interface in the watchlist to mark movies as watched - they'll automatically count towards your viewing goals!

## Notes
- All movie data is sourced from The Movie Database (TMDB)
- Ratings and personal notes are stored locally
- Use the [[Daily Journal]] to record thoughts about movies you've watched
    `.trim();
    setStorage('page-Movies', moviesContent);

    // 11. Add sample books data to demonstrate the book tracker
    const sampleBooksData = {
      'gbooks_abc123': {
        id: 'gbooks_abc123',
        title: 'The Pragmatic Programmer',
        author: 'David Thomas, Andrew Hunt',
        cover: 'https://books.google.com/books/content?id=5wBQEp6ruIAC&printsec=frontcover&img=1&zoom=1&source=gbs_api',
        publishedDate: '1999',
        description: 'A classic guide to programming practices and principles.',
        status: 'reading',
        progress: 45,
        dateAdded: todayDateStr
      },
      'gbooks_def456': {
        id: 'gbooks_def456',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        cover: 'https://books.google.com/books/content?id=hjEFCAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api',
        publishedDate: '2008',
        description: 'A handbook of agile software craftsmanship.',
        status: 'to-read',
        progress: 0,
        dateAdded: yesterdayStr
      },
      'gbooks_ghi789': {
        id: 'gbooks_ghi789',
        title: 'Atomic Habits',
        author: 'James Clear',
        cover: 'https://books.google.com/books/content?id=XfFvDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api',
        publishedDate: '2018',
        description: 'Tiny changes, remarkable results - an easy & proven way to build good habits & break bad ones.',
        status: 'finished',
        progress: 100,
        dateAdded: twoDaysAgoStr,
        dateFinished: yesterdayStr
      }
    };
    setStorage('books-data', JSON.stringify(sampleBooksData));

    // 12. Add sample movies data to demonstrate the movie tracker
    const sampleMoviesData = {
      '550': {
        id: '550',
        title: 'Fight Club',
        releaseDate: '1999-10-15',
        poster: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression.',
        rating: 8.4,
        genres: 'Drama',
        runtime: 139,
        status: 'watched',
        addedDate: threeDaysAgoStr,
        personalRating: 5,
        watchedDate: twoDaysAgoStr,
        notes: 'Incredible film with amazing plot twists!'
      },
      '13': {
        id: '13',
        title: 'Forrest Gump',
        releaseDate: '1994-06-23',
        poster: 'https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
        overview: 'A man with a low IQ has accomplished great things in his life and been present during significant historic events.',
        rating: 8.5,
        genres: 'Comedy, Drama, Romance',
        runtime: 142,
        status: 'favorites',
        addedDate: threeDaysAgoStr,
        personalRating: 5,
        watchedDate: threeDaysAgoStr,
        notes: 'Life is like a box of chocolates...'
      },
      '680': {
        id: '680',
        title: 'Pulp Fiction',
        releaseDate: '1994-09-10',
        poster: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
        overview: 'A burger-loving hit man, his philosophical partner, and a drug-addled gangster embark on three interconnected stories.',
        rating: 8.9,
        genres: 'Crime, Drama',
        runtime: 154,
        status: 'to-watch',
        addedDate: todayDateStr,
        personalRating: null,
        watchedDate: null,
        notes: ''
      },
      '155': {
        id: '155',
        title: 'The Dark Knight',
        releaseDate: '2008-07-16',
        poster: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
        overview: 'Batman raises the stakes in his war on crime with the help of Lt. Jim Gordon and District Attorney Harvey Dent.',
        rating: 9.0,
        genres: 'Action, Crime, Drama',
        runtime: 152,
        status: 'to-watch',
        addedDate: yesterdayStr,
        personalRating: null,
        watchedDate: null,
        notes: ''
      }
    };
    setStorage('movies-data', JSON.stringify(sampleMoviesData));

    // 13. Set the visited flag
    // 13. Set the visited flag
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

// --- Debounced Sidebar Search Setup ---
if (DOM.librarySearch) {
  DOM.librarySearch.removeEventListener('_debouncedInput', DOM._debouncedSidebarHandler || (()=>{}));
  DOM._debouncedSidebarHandler = debounce(renderSidebar, 200);
  DOM.librarySearch.addEventListener('input', DOM._debouncedSidebarHandler);
}
