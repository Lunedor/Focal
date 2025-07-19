# Focal Journal 🎯

A minimalist, local-first digital bullet journal and planner—designed to help you organize your life entirely in your browser. Track tasks, notes, goals, habits, moods, finances, books, and movies with a fast, markdown-powered interface.

![Focal Journal Screenshot](Screenshots/Screenshot_1.jpg)

> ✅ Mobile-optimized UI
> 🚀 Deployed with [GitHub Pages](https://lunedor.github.io/Focal)

---

## ✨ Features

* **Weekly, Daily & Monthly Planner:** Plan your time with markdown entries, including hourly and Gantt views.
* **Future Log Calendar:** Visualize long-term plans, recurring tasks, and scheduled events.
* **Task Management:** Create tasks with checkboxes, summaries, and status syncing across views.
* **Goal Tracker:** Set goals, track progress, link goals to tasks, and visualize achievements.
* **Habit Tracker:** Define routines, track streaks, view charts and rewards.
* **Mood Tracker:** Log moods with emojis/colors; view trends as calendar, chart, or circular.
* **Finance Tracker:** Manage income and expenses with categories, charts, and summaries.
* **Calorie Tracker:** Log daily calorie intake, set targets, and visualize with charts.
* **Workouts Tracker:** Track workouts, durations, and see progress over time.
* **Sleep Tracker:** Record sleep hours and quality, view trends and averages.
* **Book Tracker:** Track reading progress and stats, with Google Books integration.
* **Movie Tracker:** Manage watchlists, favorites, and stats via TMDB.
* **Prompt Widgets:** Add daily prompts, affirmations, or questions to any page.
* **Wiki-Style Notes:** Use `[[links]]` to create interconnected pages and backlink navigation.
* **Notifications:** Add reminders with `(NOTIFY: YYYY-MM-DD HH:mm)` syntax.
* **Recurring & Scheduled Items:** Use `(REPEAT: ...)` and `(SCHEDULED: YYYY-MM-DD)` in any planner view.
* **AI Syntax Assistant:** Auto-generate planning syntax via Google Gemini integration.
* **Keyboard Shortcuts:** Fast, keyboard-first workflow.
* **Customizable Themes:** Switch between multiple light/dark themes.
* **Local-First Privacy:** All data stays in your browser by default.
* **Cloud Sync (Optional):** Sync data securely via Firebase.
* **Responsive UI:** Fully functional on both desktop and mobile.
* **Drag-and-Drop Sidebar:** Reorder or pin pages easily.

---

## 🤖 AI Syntax Assistant

Describe what you need—like “reminder to water plants every Tuesday”—and the AI will generate correct syntax:

1. Click “AI Syntax Assistant” in the toolbar.
2. Enter a natural language request.
3. Google Gemini (with Focal's syntax prompt) returns structured planner code.
4. It's inserted and saved automatically.

---

## 📚 Markdown Syntax Extensions

Focal extends Markdown with powerful widgets and syntax:

```markdown
[[Page Title]]               # Wiki-style link
GOAL: Run 10km               # Goal
TASKS: this-week             # Task summaries
HABITS: define               # Define habits
HABITS: today|stats|chart    # Habit widgets
MOOD: chart, emoji           # Mood chart
FINANCE: chartpie, USD       # Finance overview
CALORIE: summary+chart, 2000 # Calorie tracker
WORKOUTS: summary+chart      # Workouts tracker
SLEEP: summary+chart         # Sleep tracker
BOOKS: stats|to-read         # Book tracker
MOVIES: watchlist|favorites  # Movie tracker
FUTURELOG: 6-months          # Future log calendar
PROMPT: What inspired you today? # Prompt widget
(SCHEDULED: 2025-09-01)      # Scheduled task
(REPEAT: every monday)       # Recurring task
(NOTIFY: 2025-07-20 09:00)   # Push notification
```

---

## 📝 Sample Page

```markdown
# Weekly Planner

## Tasks
- [ ] Finish project report (SCHEDULED: 2025-07-14)
- [x] Submit tax forms (SCHEDULED: 2025-07-15)
- [ ] Call Alice (REPEAT: every friday)

## Goals
GOAL: Read 3 books this month
GOAL: Run 10km by end of July

## Habits
HABITS: define
- Drink water
- Meditate
- Exercise
HABITS: day

## Mood
MOOD: calendar, emoji, 2025-07-12:😊

## Finances
FINANCE: chart, USD, this-month

## Books
BOOKS: to-read

## Movies
MOVIES: watchlist

## Future Log
FUTURELOG: 12-months
- [ ] Renew passport (SCHEDULED: 2025-09-01)
- Team meeting (REPEAT: every monday)

## Notifications
- [ ] Dentist appointment (NOTIFY: 2025-07-20 09:00)
 
## Calorie
CALORIE: summary+chart, 2000, this-week
- 2025-07-19, Breakfast (Oatmeal), 350, Morning meal
- 2025-07-19, Lunch (Chicken Salad), 600, Protein boost

## Workouts
WORKOUTS: summary+chart, , this-week
- 2025-07-19, Running, 30, Morning run
- 2025-07-18, Yoga, 45, Evening stretch

## Sleep
SLEEP: summary+chart, , this-week
- 2025-07-19, 7.5, 8, Slept well
- 2025-07-18, 6.0, 6, Woke up early

## Prompt
PROMPT: What is one thing you are grateful for today?
```

---

## 🛠 Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Libraries:** `date-fns`, `marked.js`, Feather Icons
* **Storage:** Browser `localStorage` (default), Firebase (optional)
* **Deployment:** GitHub Pages

To run locally:

```bash
# From the project root
python -m http.server
# Or for Python 2
# python -m SimpleHTTPServer
```

Visit: [http://localhost:8000](http://localhost:8000)

---

## 📄 License

MIT License

---

Created by **Lunedor**

---