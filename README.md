# 🎯 Focal Journal

A minimalist, **privacy-first digital bullet journal** and life planner — all in your browser.
Track tasks, goals, habits, moods, finances, books, movies, and more with a lightning-fast, markdown-powered interface.

> ✅ Works offline & online
> 📱 Optimized for mobile and desktop
> 🔒 End-to-end encrypted & local-first
> 🚀 Deployed on [GitHub Pages →](https://lunedor.github.io/Focal)

![Screenshot](Screenshots/Screenshot_1.jpg)

---

## ✨ Why Focal Journal?

* No accounts or downloads needed to get started
* Your data stays local — unless you *choose* to sync
* Markdown + natural language AI = ultra-fast planning
* Track every aspect of your life — from tasks to workouts

---

## 💡 Key Features

### 🗓️ Planners

* **Daily / Weekly / Monthly views** with Markdown syntax
* **Future Log**: visualize long-term goals & recurring events

### ✅ Task & Goal Management

* Task checkboxes, summaries, and synced status across pages
* Link goals to tasks and track achievements visually

### 📈 Trackers & Logs

* **Habits**: define routines, track streaks, view charts
* **Mood**: log emotions with emoji/colors, see trends over time
* **Sleep / Workouts / Calories**: log activity with detailed stats
* **Finance**: manage income/expenses with charts and summaries
* **Books & Movies**: manage lists with Google Books & TMDB support

### 🤖 AI Syntax Assistant *(Premium)*

* Powered by Google Gemini
* Describe anything in plain language:
  *"Remind me to work out every Monday"*
  → Focal generates proper syntax instantly

### 🔔 Reminders & Recurring Logic

* `SCHEDULED`, `REPEAT`, and `NOTIFY` tags work in any page
* Receive push notifications (cross-device)

### 📦 Import / Export

* Backup or migrate your journal with **JSON import/export**
* Supports both full data and per-page exports

### 📚 Markdown Extensions & Widgets

* Prompt/affirmation widgets for journaling
* Wiki-style `[[linked pages]]` + backlinks
* Extended Markdown widgets for all trackers

### 🎨 UI & Themes

* Multiple light/dark themes
* Drag-and-drop sidebar
* Fully responsive for desktop & mobile use

---

## 🔐 Privacy & Sync

* **Local-first** by default — all your data stays in your browser
* **Secure Firebase Sync** *(Premium)*: multi-device encrypted sync
* **End-to-end encryption** of synced data
* **PWA installable** — use it like a native app on any platform

---

## 💬 Markdown Syntax Extensions

```markdown
[[Page Title]]                # Wiki-style link
GOAL: Learn French            # Goal
TASKS: this-week              # Task summary
HABITS: today|chart           # Habit tracker widgets
MOOD: calendar, emoji         # Mood chart
FINANCE: pie, USD        # Finance overview
CALORIE: summary+chart, 2000  # Calorie intake
WORKOUTS: summary+chart       # Workouts
SLEEP: summary+chart          # Sleep tracking
BOOKS: to-read|stats          # Reading list
MOVIES: watchlist|favorites   # Movie tracker
PROMPT: What inspired you?    # Prompt widget
(SCHEDULED: 2025-07-20)       # Scheduled item
(REPEAT: every friday)        # Recurring item
(NOTIFY: 2025-07-20 09:00)    # Notification
```

---

## 🧪 Sample Page

```markdown
# Weekly Planner

## Tasks
- [ ] Finish report (SCHEDULED: 2025-07-14)
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
HABITS: today

## Mood
MOOD: calendar, emoji, 2025-07-12:😊

## Finances
FINANCE: chart, USD, this-month

## Books
BOOKS: to-read

## Movies
MOVIES: watchlist

## Notifications
- [ ] Dentist appointment (NOTIFY: 2025-07-20 09:00)

## Workouts
WORKOUTS: summary+chart
- 2025-07-19, Running, 30
- 2025-07-18, Yoga, 45

## Sleep
SLEEP: summary+chart
- 2025-07-19, 7.5
- 2025-07-18, 6.0
```

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Libraries:** `date-fns`, `marked.js`, Feather Icons
* **Storage:** `localStorage` (default), Firebase (optional cloud sync)
* **AI:** Google Gemini (for syntax generation)
* **Deployment:** GitHub Pages

### 🧪 Run Locally

```bash
# From the project root
python -m http.server
# Or (Python 2)
# python -m SimpleHTTPServer
```

Go to [http://localhost:8000](http://localhost:8000)

---

## 📄 License

MIT License

---

Built with ❤️ and Markdown by **Lunedor**
