function getSampleData() {
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
- **Habit Tracking**: Build consistent daily habits and track progress ([[My Daily Habits]])
- **Finance Tracking**: Monitor income, expenses, and spending patterns ([[Finances]])
- **Book Tracking**: Manage your reading library and track progress ([[Reading List]])
- **Movie Tracking**: Build your watchlist and track viewing history ([[Movies]])
- **Wiki Links**: Create connected notes with [[Feature Showcase|wiki-style links]]

TASKS: Getting Started
- [ ] Explore the Weekly Planner
- [ ] Check out the [[Feature Showcase]] page
- [ ] Create your first custom page
- [ ] Try the mood tracking in the [[Daily Journal]]
- [ ] Set up habit tracking in [[My Daily Habits]]
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


## Checkboxes & Markdown

Weekly team meeting (REPEAT: every monday)
Daily standup (REPEAT: everyday)
Events with (REPEAT: every friday from ${todayDateStr} to ${dayAfterTomorrowDateStr})
Events like anniversary (REPEAT: ${dateFns.format(today, 'dd.MM')})

### REPEAT Syntax Options

All REPEAT items become clickable links that navigate to the next occurrence date in the planner.


  ## Mind Map Widget Example

  MINDMAP:
  {
    "meta": {"name": "Simple Mind Map"},
    "format": "node_tree",
    "data": {
      "id": "root1",
      "topic": "Main Idea",
      "children": [
        {"id": "n1", "topic": "Branch 1"},
        {"id": "n2", "topic": "Branch 2", "children": [
          {"id": "n3", "topic": "Sub-branch"}
        ]}
      ]
    }
  }

  This creates a mind map with a root node and two branches, one of which has a sub-branch.

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

Use the FINANCE: syntax with different view types (summary, chart, pie) and time filters.

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

## Habit Tracking
Build consistent daily habits and track your progress with visual feedback on the [[My Daily Habits]] page.

Use the HABITS: syntax with different widget types and time periods to visualize your progress.

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

FINANCE: summary+chart+pie, USD, this-month
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
- \`pie\`: Pie chart showing category distribution

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
- Example: \`FINANCE: summary+pie, USD, this-month\`
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
        isFavorite: false,
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
        status: 'watched',
        isFavorite: true,
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
        isFavorite: false,
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
        isFavorite: false,
        addedDate: yesterdayStr,
        personalRating: null,
        watchedDate: null,
        notes: ''
      }
    };
    setStorage('movies-data', JSON.stringify(sampleMoviesData));

    // 10. Create a "Habits" page to showcase the habit tracker

    // 13. Create a "Future Log" page to showcase the futurelog widget
    const futurelogContent = `
# Future Log 🗓️\n\nPlan your long-term events, deadlines, and recurring tasks with the Future Log widget.\n\n---\n\n## Upcoming Events\n\nFUTURELOG: 12-months\n- Project deadline (SCHEDULED: ${dayAfterTomorrowDateStr})\n- [ ] Renew passport (SCHEDULED: ${dateFns.format(dateFns.addDays(today, 30), 'yyyy-MM-dd')})\n- Team meeting (REPEAT: every monday)\n- [ ] Pay insurance (REPEAT: every 3 months from ${todayDateStr})\n\n---\n\n**How to use:**\n- Add new events or recurring tasks directly in the widget\n- Click a month to jump to that calendar\n- Remove or edit items via the UI\n\n**Widget Syntax:**\n\n\`FUTURELOG: 12-months\`\n\n- Use \`(SCHEDULED: YYYY-MM-DD)\` for one-time events\n- Use \`(REPEAT: every monday)\` or similar for recurring\n- Supports checkboxes for tasks\n\n---\n\nSee the main README for more details.\n    `.trim();
    setStorage('page-Future Log', futurelogContent);
    const habitsContent = `
# My Daily Habits 🎯

Build consistent daily habits and track your progress with Focal's advanced habit tracking system. Enjoy:
- **Categories** for organization
- **Goals** and smart insights
- **Achievements** and streaks
- **Targets** for quantified habits
- **Calendar grid, stats, and charts**

## How to Use
1. Define your habits using the \`HABITS: define\` block (see below for examples)
2. Track daily progress with \`HABITS: day\`
3. Visualize your progress with widgets: \`categories\`, \`goals\`, \`achievements\`, \`grid\`, \`stats\`, \`chart\`
4. Set targets, goals, and achievements for extra motivation

---

## Habit Definitions

HABITS: define

- Meditate (CATEGORY: Wellness) (GOAL: every day) (SCHEDULE: everyday) (ACHIEVEMENT: 7 day streak = Movie night)
- Exercise (CATEGORY: Health) (GOAL: 3 times per week) (SCHEDULE: Mon, Wed, Fri) (ACHIEVEMENT: 30 completions = New workout gear)
- Read (CATEGORY: Learning) (TARGET: 30 pages) (GOAL: 5 times per week) (SCHEDULE: weekdays) (ACHIEVEMENT: 50 completions = Buy 3 new books)
- Drink Water (CATEGORY: Health) (TARGET: 8 glasses) (GOAL: 7 days in a row) (ACHIEVEMENT: perfect week = Spa day)
- Journal Writing (CATEGORY: Personal) (GOAL: 4 times per week) (SCHEDULE: Tue, Thu, Sat) (ACHIEVEMENT: 30 day streak = Beautiful new journal)
- Practice Guitar (CATEGORY: Creative) (TARGET: 30 minutes) (GOAL: 3 times per week) (SCHEDULE: Mon, Wed, Fri) (ACHIEVEMENT: 25 completions = New guitar pick set)
- Walk Steps (CATEGORY: Fitness) (TARGET: 10000 steps) (GOAL: every day) (SCHEDULE: everyday) (ACHIEVEMENT: perfect month = New running shoes)
- Check Finances (CATEGORY: Finance) (GOAL: 4 times per month) (SCHEDULE: weekends) (ACHIEVEMENT: 20 completions = Financial planning book)

---

## Today's Progress

HABITS: day

---

## Categories Overview

HABITS: categories

---

## Achievements

HABITS: achievements

---

## Weekly Goals Progress

HABITS: categories

---

## Goal Progress

HABITS: goals

---

## This Month's Overview

HABITS: grid, this-month

---

## Habit Statistics

HABITS: stats

---

## Individual Habit Charts

### Meditation Progress
HABITS: chart, Meditate, last-30-days

### Reading Progress
HABITS: chart, Read, last-30-days

---

## Future Log (Sample)

FUTURELOG: 6-months

- SCHEDULED: 2025-08-01 Birthday party 🎉
- SCHEDULED: 2025-09-15 Doctor appointment (SCHEDULED: 2025-09-15)
- REPEAT: every monday from 2025-07-14 to 2025-09-01 Weekly team meeting
- REPEAT: 25.12 Christmas

---

## Widget Options

### Widget Types
- \`today\`: Interactive daily tracker
- \`grid\`: Calendar-style progress grid
- \`stats\`: Completion rates and streaks
- \`chart\`: Visual progress chart for specific habits
- \`categories\`: Category analytics
- \`goals\`: Goal progress and insights
- \`achievements\`: Achievement gallery
- \`futurelog\`: Calendar of upcoming events and repeating items

### Time Periods
- \`this-week\`, \`this-month\`, \`last-7-days\`, \`last-30-days\`, \`last-90-days\`, \`last-365-days\`, etc.

### Habit Types
- **Binary Habits**: Simple checkbox (e.g., "Meditate")
- **Quantified Habits**: Target-based with progress bars (e.g., "Read (TARGET: 30 pages)")

## Tips for Success

- Start with 2-3 habits maximum
- Make habits specific and measurable
- Track consistently for at least 21 days
- Use the [[Daily Journal]] to reflect on your habit progress
- Celebrate small wins and streaks

## Research-Based Benefits

- **Consistency**: Visual tracking increases habit adherence
- **Motivation**: Streaks and progress bars provide positive reinforcement
- **Awareness**: Daily tracking increases mindfulness of behaviors
- **Accountability**: Written goals and progress create commitment

*Remember: Small, consistent actions compound into remarkable results over time.*

# My Daily Habits 🎯

Build consistent daily habits and track your progress with Focal's advanced habit tracking system. Enjoy:
- **Categories** for organization
- **Goals** and smart insights
- **Achievements** and streaks
- **Targets** for quantified habits
- **Calendar grid, stats, and charts**

## How to Use
1. Define your habits using the "HABITS: define" block (see below for examples)
2. Track daily progress with "HABITS: day"
3. Visualize your progress with widgets: "categories", "goals", "achievements", "grid", "stats", "chart"
4. Set targets, goals, and achievements for extra motivation

---

## Habit Definitions

HABITS: define

- Meditate (CATEGORY: Wellness) (GOAL: every day) (SCHEDULE: everyday) (ACHIEVEMENT: 7 day streak = Movie night)
- Exercise (CATEGORY: Health) (GOAL: 3 times per week) (SCHEDULE: Mon, Wed, Fri) (ACHIEVEMENT: 30 completions = New workout gear)
- Read (CATEGORY: Learning) (TARGET: 30 pages) (GOAL: 5 times per week) (SCHEDULE: weekdays) (ACHIEVEMENT: 50 completions = Buy 3 new books)
- Drink Water (CATEGORY: Health) (TARGET: 8 glasses) (GOAL: 7 days in a row) (ACHIEVEMENT: perfect week = Spa day)
- Journal Writing (CATEGORY: Personal) (GOAL: 4 times per week) (SCHEDULE: Tue, Thu, Sat) (ACHIEVEMENT: 30 day streak = Beautiful new journal)
- Practice Guitar (CATEGORY: Creative) (TARGET: 30 minutes) (GOAL: 3 times per week) (SCHEDULE: Mon, Wed, Fri) (ACHIEVEMENT: 25 completions = New guitar pick set)
- Walk Steps (CATEGORY: Fitness) (TARGET: 10000 steps) (GOAL: every day) (SCHEDULE: everyday) (ACHIEVEMENT: perfect month = New running shoes)
- Check Finances (CATEGORY: Finance) (GOAL: 4 times per month) (SCHEDULE: weekends) (ACHIEVEMENT: 20 completions = Financial planning book)

---

## Today's Progress

HABITS: day

---

## Categories Overview

HABITS: categories

---

## Achievements

HABITS: achievements

---

## Weekly Goals Progress

HABITS: categories

---

## Goal Progress

HABITS: goals

---

## This Month's Overview

HABITS: grid, this-month

---

## Habit Statistics

HABITS: stats

---

## Individual Habit Charts

### Meditation Progress
HABITS: chart, Meditate, last-30-days

### Reading Progress
HABITS: chart, Read, last-30-days

---

## Future Log (Sample)

FUTURELOG: 6-months

- SCHEDULED: 2025-08-01 Birthday party 🎉
- SCHEDULED: 2025-09-15 Doctor appointment (SCHEDULED: 2025-09-15)
- REPEAT: every monday from 2025-07-14 to 2025-09-01 Weekly team meeting
- REPEAT: 25.12 Christmas

---

## Widget Options

### Widget Types
- "today": Interactive daily tracker
- "grid": Calendar-style progress grid
- "stats": Completion rates and streaks
- "chart": Visual progress chart for specific habits
- "categories": Category analytics
- "goals": Goal progress and insights
- "achievements": Achievement gallery
- "futurelog": Calendar of upcoming events and repeating items

### Time Periods
- "this-week", "this-month", "last-7-days", "last-30-days", "last-90-days", "last-365-days", etc.

### Habit Types
- **Binary Habits**: Simple checkbox (e.g., "Meditate")
- **Quantified Habits**: Target-based with progress bars (e.g., "Read (TARGET: 30 pages)")

## Tips for Success

- Start with 2-3 habits maximum
- Make habits specific and measurable
- Track consistently for at least 21 days
- Use the [[Daily Journal]] to reflect on your habit progress
- Celebrate small wins and streaks

## Research-Based Benefits

- **Consistency**: Visual tracking increases habit adherence
- **Motivation**: Streaks and progress bars provide positive reinforcement
- **Awareness**: Daily tracking increases mindfulness of behaviors
- **Accountability**: Written goals and progress create commitment

*Remember: Small, consistent actions compound into remarkable results over time.*
    `
.trim();
    setStorage('page-My Daily Habits', habitsContent);

    // 11. Add sample habit data to demonstrate the habit tracker
    const habitDefinitions = [
      {
        name: 'Meditate',
        type: 'binary',
        id: 'meditate'
      },
      {
        name: 'Exercise',
        type: 'binary',
        id: 'exercise'
      },
      {
        name: 'Read',
        type: 'quantified',
        target: '30 pages',
        id: 'read'
      },
      {
        name: 'Drink Water',
        type: 'quantified',
        target: '8 glasses',
        id: 'drink-water'
      },
      {
        name: 'Journal Writing',
        type: 'binary',
        id: 'journal-writing'
      },
      {
        name: 'Practice Guitar',
        type: 'quantified',
        target: '30 minutes',
        id: 'practice-guitar'
      },
      {
        name: 'Walk Steps',
        type: 'quantified',
        target: '10000 steps',
        id: 'walk-steps'
      }
    ];
    setStorage('habit-definitions', JSON.stringify(habitDefinitions));

    // Helper function to format dates
    function formatDate(date) {
      return date.toISOString().split('T')[0];
    }

    // Sample habit data for the last few days
    const sampleHabitData = {
      [formatDate(today)]: {
        'meditate': true,
        'exercise': false,
        'read': 25,
        'drink-water': 6,
        'journal-writing': true,
        'practice-guitar': 20,
        'walk-steps': 8500
      },
      [formatDate(yesterday)]: {
        'meditate': true,
        'exercise': true,
        'read': 35,
        'drink-water': 8,
        'journal-writing': false,
        'practice-guitar': 30,
        'walk-steps': 12000
      },
      [formatDate(twoDaysAgo)]: {
        'meditate': false,
        'exercise': true,
        'read': 20,
        'drink-water': 5,
        'journal-writing': true,
        'practice-guitar': 15,
        'walk-steps': 7500
      },
      [formatDate(threeDaysAgo)]: {
        'meditate': true,
        'exercise': false,
        'read': 40,
        'drink-water': 7,
        'journal-writing': true,
        'practice-guitar': 25,
        'walk-steps': 9000
      }
    };
    const storageKey = 'habit-data-all';
    // Save sample habit data
    setStorage(storageKey, JSON.stringify(sampleHabitData));


  // 14. Add a Health & Wellness page with Calorie, Workouts, and Sleep widgets
  const healthWellnessContent = `
# Health & Wellness 🏃‍♂️🍎💤

Track your health habits, workouts, calories, and sleep in one place!

---

## Calorie Tracker

CALORIE: summary+chart, kcal, this-week
- 2025-07-19, Breakfast (Oatmeal), 350, Morning meal
- 2025-07-19, Lunch (Chicken Salad), 600, Protein boost
- 2025-07-19, Snack (Apple), 95, Afternoon
- 2025-07-18, Dinner (Pasta), 700, Family dinner
- 2025-07-18, Snack (Yogurt), 120, Evening
- 2025-07-17, Breakfast (Eggs), 300, 
- 2025-07-17, Lunch (Sandwich), 500, 

---

## Workouts Tracker

WORKOUTS: summary+chart, , this-week
- 2025-07-19, Running, 30, Morning run
- 2025-07-18, Yoga, 45, Evening stretch
- 2025-07-17, Cycling, 60, Cardio
- 2025-07-16, Rest, 0, Recovery day

---

## Sleep Tracker

SLEEP: summary+chart, , this-week
- 2025-07-19, 7.5, 8, Slept well
- 2025-07-18, 6.0, 6, Woke up early
- 2025-07-17, 8.0, 9, Deep sleep
- 2025-07-16, 5.5, 5, Trouble falling asleep

---

## Tips
- Log your meals and workouts daily for best results
- Use the sleep tracker to spot patterns and improve rest
- Set calorie targets in the CALORIE widget config line (e.g., \`CALORIE: summary+chart, 2200, this-week\`)
  `.trim();
  setStorage('page-Health & Wellness', healthWellnessContent);

  // 15. Add a Prompts page with prompt widget examples
  const promptsContent = `
# Daily Prompts & Inspiration 💡

Use prompt widgets to add daily questions, affirmations, or reminders to your planner!

---

## Simple Prompt

PROMPT: What is one thing you are grateful for today?

---

## Daily Sequential Prompt

PROMPT(mode: daily-sequential, start: 2025-07-17):
- Reflect on a recent success.
- What challenge did you overcome this week?
- Name a skill you want to improve.
- Who inspired you recently?

---

## Daily Random Prompt

PROMPT(mode: daily-random):
- Share a favorite quote.
- What made you smile today?
- What is your top priority for tomorrow?
- Describe your ideal weekend.

---

## Prompt with Date

PROMPT(show-on: 2025-07-20):
This prompt will only appear on July 20, 2025!

---

## Tips
- Use \`mode: daily-sequential\` for rotating questions
- Use \`show-on: YYYY-MM-DD\` to show a prompt on a specific date
- Prompts can be used in any page, or in the planner for daily reflection
  `.trim();
  setStorage('page-Prompts', promptsContent);

  // 13. Set the visited flag
  localStorage.setItem('focal-journal-visited', 'true');
  }
  else {
    // If sample data already exists, do nothing
    console.log('Sample data already set up.');
  }
}