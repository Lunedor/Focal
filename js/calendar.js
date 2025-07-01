
/**
 * Scans localStorage for planner day keys and scheduled items.
 * Returns a Set of 'YYYY-MM-DD' strings for dates with data.
 */
function scanForDataWithDates() {
  const datesWithData = new Set();
  const scheduledRegex = new RegExp(`\\(SCHEDULED: \\s*${window.DATE_REGEX_PATTERN}\\)`, 'g');
  const repeatRegex = /\(REPEAT: ([^)]+)\)/g;

  // For REPEAT expansion, get the visible calendar range (for efficiency)
  let calendarStart = null, calendarEnd = null;
  if (typeof appState !== 'undefined' && appState.currentDate) {
    const startOfMonth = dateFns.startOfMonth(appState.currentDate);
    const endOfMonth = dateFns.endOfMonth(appState.currentDate);
    calendarStart = dateFns.startOfISOWeek(startOfMonth);
    calendarEnd = dateFns.endOfISOWeek(endOfMonth);
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    // Planner day keys: 2024-W26-monday
    const plannerMatch = key.match(/^(\d{4})-W(\d{1,2})-(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
    if (plannerMatch) {
      const year = Number(plannerMatch[1]);
      const week = Number(plannerMatch[2]);
      const dayOfWeek = plannerMatch[3];
      const content = getStorage(key) || '';
      if (content.trim()) {
        // Calculate ISO week start: new Date(year, 0, 4) is always in week 1
        const weekStart = dateFns.startOfISOWeek(dateFns.setISOWeek(new Date(year, 0, 4), week));
        const dayIndex = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(dayOfWeek);
        if (dayIndex !== -1) {
          const date = dateFns.addDays(weekStart, dayIndex);
          datesWithData.add(dateFns.format(date, 'yyyy-MM-dd'));
        }
      }
      continue;
    }

    // Scheduled and repeated items in library pages
    if (key.startsWith('page-')) {
      const content = getStorage(key) || '';
      let match;
      // SCHEDULED
      while ((match = scheduledRegex.exec(content)) !== null) {
        const normalizedDate = window.normalizeDateStringToYyyyMmDd(match[1]);
        if (normalizedDate) {
          datesWithData.add(normalizedDate);
        }
      }
      // REPEAT
      while ((match = repeatRegex.exec(content)) !== null) {
        const repeatRule = match[1];

        if (repeatRule.includes('(REPEAT:')) {
          // Try to match new syntax: every <weekday> from <start> to <end>
          const rangeMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)/i);
          let weekday = null, startDate = null, endDate = null;
          if (rangeMatch) {
            weekday = rangeMatch[1].toLowerCase();
            startDate = window.normalizeDateStringToYyyyMmDd(rangeMatch[2]);
            endDate = window.normalizeDateStringToYyyyMmDd(rangeMatch[3]);
          }
          // Fallback: every <weekday> (old logic)
          if (!weekday) {
            const everyMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
            if (everyMatch) {
              weekday = everyMatch[1].toLowerCase();
            }
          }
          if (weekday) {
            // Determine start and end date
            if (!startDate) {
              // Try to find SCHEDULED date on the same line, regardless of order
              const lineStart = content.lastIndexOf('\n', match.index) + 1;
              const lineEnd = content.indexOf('\n', match.index);
              const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
              const scheduledMatches = [...line.matchAll(/\(SCHEDULED: ([^)]+)\)/g)];
              if (scheduledMatches.length > 0) {
                startDate = window.normalizeDateStringToYyyyMmDd(scheduledMatches[0][1]);
              }
            }
            if (!startDate) continue;
            if (!endDate) endDate = calendarEnd;
            if (!calendarStart || !calendarEnd) continue;
            const targetIndex = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(weekday);
            let first = dateFns.parseISO(startDate);
            let d = dateFns.startOfDay(first);
            while (dateFns.getDay(d) !== ((targetIndex + 1) % 7)) {
              d = dateFns.addDays(d, 1);
            }
            const lastDay = dateFns.isBefore(endDate, calendarEnd) ? endDate : calendarEnd;
            for (; !dateFns.isAfter(d, lastDay); d = dateFns.addWeeks(d, 1)) {
              if (dateFns.isBefore(d, first)) continue;
              datesWithData.add(dateFns.format(d, 'yyyy-MM-dd'));
            }
          } else {
          // Handle (REPEAT: <date>) as an annual recurring event (every year on that day)
          let dateStr = repeatRule.trim();
          let norm = window.normalizeDateStringToYyyyMmDd(dateStr);
          if (norm) {
            // Add for every year in the visible calendar range
            let monthDay = norm.slice(5); // MM-DD
            let startYear = calendarStart ? calendarStart.getFullYear() : (new Date()).getFullYear() - 1;
            let endYear = calendarEnd ? calendarEnd.getFullYear() : (new Date()).getFullYear() + 1;
            for (let y = startYear; y <= endYear; y++) {
              let ymd = `${y}-${monthDay}`;
              datesWithData.add(ymd);
            }
          } else {
            // Try to match day/month only
            const dm = dateStr.match(/^(\d{2})[./-](\d{2})$/);
            if (dm) {
              let monthDay = `${dm[2]}-${dm[1]}`;
              let startYear = calendarStart ? calendarStart.getFullYear() : (new Date()).getFullYear() - 1;
              let endYear = calendarEnd ? calendarEnd.getFullYear() : (new Date()).getFullYear() + 1;
              for (let y = startYear; y <= endYear; y++) {
                let ymd = `${y}-${monthDay}`;
                datesWithData.add(ymd);
              }
            }
          }
          }
        }
      }
    }
  }
  return datesWithData;
}

/**
 * Renders the monthly calendar grid for the given date.
 * @param {Date} date - The date within the month to render.
 */
function renderMonthlyCalendar(date) {
  const startOfMonth = dateFns.startOfMonth(date);
  const endOfMonth = dateFns.endOfMonth(date);
  const startOfCalendar = dateFns.startOfISOWeek(startOfMonth);
  const endOfCalendar = dateFns.endOfISOWeek(endOfMonth);

  // Populate month and year dropdowns
  populateMonthYearDropdowns(date);

  DOM.calendarGrid.innerHTML = '';

  // Use getAllScheduledItems from planner.js for unified logic
  let datesWithData = new Set();
  if (typeof getAllScheduledItems === 'function') {
    const allScheduled = getAllScheduledItems();
    datesWithData = new Set([...allScheduled.keys()]);
  } else {
    datesWithData = scanForDataWithDates(); // fallback
  }

  // Day names header
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  dayNames.forEach(name => {
    const nameEl = document.createElement('div');
    nameEl.className = 'day-name';
    nameEl.textContent = name;
    DOM.calendarGrid.appendChild(nameEl);
  });

  let day = startOfCalendar;
  while (dateFns.isBefore(day, dateFns.addDays(endOfCalendar, 1))) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    const dayDateStr = dateFns.format(day, 'yyyy-MM-dd');
    dayEl.dataset.date = dayDateStr;

    if (!dateFns.isSameMonth(day, date)) {
      dayEl.classList.add('other-month');
    }

    dayEl.innerHTML = `<div class="day-number">${dateFns.format(day, 'd')}</div>`;

    if (datesWithData.has(dayDateStr)) {
      const dot = document.createElement('div');
      dot.className = 'dot-indicator';
      dayEl.appendChild(dot);
    }

    // Capture the correct date for the click handler
    const thisDay = dateFns.parseISO(dateFns.format(day, 'yyyy-MM-dd'));
    dayEl.addEventListener('click', () => {
      appState.currentDate = thisDay;
      appState.currentView = 'weekly';
      renderApp();
      setTimeout(() => renderWeeklyPlanner(true), 0);
    });

    DOM.calendarGrid.appendChild(dayEl);
    day = dateFns.addDays(day, 1);
  }
}

// --- MONTH/YEAR DROPDOWN LOGIC ---

function populateMonthYearDropdowns(date) {
  const currentMonth = dateFns.getMonth(date);
  const currentYear = dateFns.getYear(date);

  // Populate months
  DOM.monthSelect.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const monthOption = document.createElement('option');
    monthOption.value = i;
    monthOption.textContent = dateFns.format(dateFns.setMonth(date, i), 'MMMM');
    if (i === currentMonth) {
      monthOption.selected = true;
    }
    DOM.monthSelect.appendChild(monthOption);
  }

  // Populate years (e.g., 10 years in the past and 10 years in the future)
  DOM.yearSelect.innerHTML = '';
  const startYear = currentYear - 10;
  const endYear = currentYear + 10;
  for (let i = startYear; i <= endYear; i++) {
    const yearOption = document.createElement('option');
    yearOption.value = i;
    yearOption.textContent = i;
    if (i === currentYear) {
      yearOption.selected = true;
    }
    DOM.yearSelect.appendChild(yearOption);
  }
}

function addMonthYearDropdownListeners() {
  DOM.monthSelect.addEventListener('change', handleMonthYearChange);
  DOM.yearSelect.addEventListener('change', handleMonthYearChange);
}

function handleMonthYearChange() {
  const selectedMonth = parseInt(DOM.monthSelect.value, 10);
  const selectedYear = parseInt(DOM.yearSelect.value, 10);

  // Create a new date with the selected month and year, keeping the day as 1 to avoid issues with months having different numbers of days
  const newDate = dateFns.setDate(dateFns.setYear(dateFns.setMonth(appState.currentDate, selectedMonth), selectedYear), 1);

  appState.currentDate = newDate;
  renderMonthlyCalendar(appState.currentDate);
}

// --- CALENDAR NAVIGATION ---
function goToPreviousMonth() {
  appState.currentDate = dateFns.subMonths(appState.currentDate, 1);
  renderMonthlyCalendar(appState.currentDate);
}

function goToNextMonth() {
  appState.currentDate = dateFns.addMonths(appState.currentDate, 1);
  renderMonthlyCalendar(appState.currentDate);
}

function goToCurrentMonth() {
  appState.currentDate = new Date();
  renderMonthlyCalendar(appState.currentDate);
}