# Focal Journal 🎯

A minimalist, local-first digital bullet journal and planner. Organize your tasks, notes, goals, habits, moods, finances, books, and movies—all in your browser, with optional secure cloud sync.

![Focal Journal Screenshot](Screenshots/Screenshot_1.jpg)



## ✨ Features

- **Weekly & Monthly Planner:** Plan your week and month with flexible, markdown-powered entries.
- **Future Log Widget:** Visualize and manage long-term plans, recurring events, and scheduled tasks with a dedicated future log calendar widget. Supports adding, editing, and removing future events, recurring rules, and scheduled items.
- **Task Management:** Create and track tasks with checkboxes and summaries.
- **Goal Tracking:** Set goals, track progress, and visualize achievements.
- **Habit Tracker:** Build routines, set targets, track streaks, and earn rewards.
- **Mood Tracker:** Log daily moods and visualize patterns (calendar, chart, circular).
- **Finance Tracker:** Track income/expenses, categorize transactions, and view charts.
- **Book Tracker:** Manage your reading list, progress, and stats (Google Books integration).
- **Movie Tracker:** Build your watchlist, track watched/favorites (TMDB integration).
- **Wiki-Style Notes:** Use `[[links]]` to connect pages and build a personal knowledge base.
- **Push Notifications:** Set reminders for tasks and events.
- **Local-First & Private:** All data is stored in your browser by default.
- **Cloud Sync (Optional):** Securely sync across devices with Firebase.
- **Customizable Themes:** Choose from multiple light/dark themes.
- **Keyboard Shortcuts:** Designed for fast, keyboard-first navigation.
- **AI Syntax Assistant:** Instantly generate Focal Journal syntax and planner blocks using Google Gemini. Describe what you want (e.g., "reminder for taking out trash every Monday"), and the AI will insert the correct syntax directly into your page. The AI assistant uses your system prompt and Focal syntax guide to ensure all output is compatible. Responses are appended to your page and saved automatically.


## 🤖 AI Syntax Assistant Usage

1. Click the "AI Syntax Assistant" button in the toolbar while editing a page.
2. Enter your request (e.g., "reminder for taking out trash every Monday").
3. The assistant sends your prompt to Google Gemini, prepending the Focal syntax guide as a system prompt.
4. The AI response is appended to your page and saved automatically. The app view updates to show the new content.
5. You can use the assistant repeatedly to build up your planner, tasks, goals, and widgets with correct syntax.


- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Cloud:** Firebase (Auth, Firestore, Messaging)
- **Libraries:** date-fns, marked.js, Feather Icons
- **Storage:** Browser `localStorage` (default), Firebase (optional)


## 📚 Markdown Extensions

Focal extends Markdown for rich planning:

- `[[Page Title]]` — Wiki-style links and backlinks
- `GOAL: ...` — Define and track goals
- `TASKS: ...` — Task summary blocks
- `HABITS: define` — Habit definitions with categories, goals, targets, and achievements
- `HABITS: today|grid|stats|chart|categories|goals|achievements` — Habit widgets
- `MOOD: calendar|chart|circular, emoji|color|all, YYYY-MM-DD:mood` — Mood widgets
- `FINANCE: summary|chart|chartpie, USD, this-month` — Finance widgets
- `FUTURELOG: [options]` — Future log widget for long-term planning. Supports options like `6-months`, `12-months`, and displays scheduled/recurring items in a calendar view. Add entries with `SCHEDULED:` or `REPEAT:` syntax inside the widget block.
- `BOOKS: full-tracker|to-read|stats|...` — Book widgets
- `MOVIES: watchlist|watched|favorites|stats|...` — Movie widgets
- `(SCHEDULED: YYYY-MM-DD)` — Schedule tasks/events
- `(REPEAT: ...)` — Recurring events
- `(NOTIFY: YYYY-MM-DD HH:mm)` — Push notifications
## 🗓️ Future Log Widget Usage

Add a future log widget to any page using:

```
FUTURELOG: 12-months
- Project deadline (SCHEDULED: 2025-08-15)
- [ ] Renew passport (SCHEDULED: 2025-09-01)
- Team meeting (REPEAT: every monday)
```

**Features:**
## ✨ Features
- **Weekly, Daily & Monthly Planner:** Plan your week, day, and month with flexible, markdown-powered entries. Hourly and Gantt timeline views for daily planning.
- **Future Log Widget:** Visualize and manage long-term plans, recurring events, and scheduled tasks with a dedicated future log calendar widget. Supports adding, editing, and removing future events, recurring rules, and scheduled items.
- **Task Management:** Create and track tasks with checkboxes, summaries, and status indicators. Interactive checkboxes sync with source content in all views.
- **Goal Tracking:** Set goals, track progress, visualize achievements, and link goals to tasks.
- **Habit Tracker:** Build routines, set targets, track streaks, earn rewards, and visualize habits with widgets and charts.
- **Mood Tracker:** Log daily moods and visualize patterns (calendar, chart, circular, emoji/color/all modes).
- **Finance Tracker:** Track income/expenses, categorize transactions, view charts, and summaries.
- **Book Tracker:** Manage your reading list, progress, stats, and integrate with Google Books.
- **Movie Tracker:** Build your watchlist, track watched/favorites, stats, and integrate with TMDB.
- **Wiki-Style Notes:** Use `[[links]]` to connect pages and build a personal knowledge base. Backlinks and page navigation.
- **Push Notifications:** Set reminders for tasks and events with NOTIFY syntax and receive browser notifications.
- **Recurring Events:** Use REPEAT syntax for flexible recurring tasks/events in all planner views.
- **Scheduled Items:** Use SCHEDULED syntax to add tasks/events to any date, visible in all planner views.
- **Drag-and-Drop Sidebar:** Pin/unpin, reorder pages with mouse or touch (mobile-friendly).
- **Local-First & Private:** All data is stored in your browser by default.
- **Cloud Sync (Optional):** Securely sync across devices with Firebase.
- **Customizable Themes:** Choose from multiple light/dark themes.
- **Keyboard Shortcuts:** Designed for fast, keyboard-first navigation.
- **Mobile & Desktop UI:** Responsive design, gesture support, and sidebar overlays for mobile.
- **Markdown Extensions:** Rich widgets for goals, habits, moods, finance, books, movies, future log, and more.
2. **Navigate to the directory:**
## 📝 Example Usage & Sample Data

```
# Sample page: Weekly Planner
# Tasks for the week
- [ ] Finish project report (SCHEDULED: 2025-07-14)
- [x] Submit tax forms (SCHEDULED: 2025-07-15)
- [ ] Call Alice (REPEAT: every friday)

# Goals
GOAL: Run 10km by end of July
GOAL: Read 3 books this month

# Habits
HABITS: define
- Drink water
- Meditate
- Exercise
HABITS: today|grid|stats|chart

# Mood
MOOD: calendar, emoji, 2025-07-12:😊

# Finance
FINANCE: summary, USD, this-month

# Books
BOOKS: to-read|stats
- The Pragmatic Programmer
- Atomic Habits

# Movies
MOVIES: watchlist|favorites
- Inception
- The Matrix

# Future Log
FUTURELOG: 12-months
- [ ] Renew passport (SCHEDULED: 2025-09-01)
- Team meeting (REPEAT: every monday)
- Project deadline (SCHEDULED: 2025-08-15)

# Notifications
- [ ] Dentist appointment (NOTIFY: 2025-07-20 09:00)
```

Now you can access the app at http://localhost:8000.
Created by Lunedor. For more, see the Screenshots and sample data in sampleData.js and init.js.

```
# From within the project directory
python -m http.server
# Or for Python 2
# python -m SimpleHTTPServer
```

Now you can access the app at http://localhost:8000.

---

📜 License
This project is licensed under the MIT License.

---

Created by Lunedor. For more, see the Screenshots and sample data in sampleData.js.
