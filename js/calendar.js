// --- /js/calendar.js (Refactored) ---

// ====================================================================================
//  MONTHLY CALENDAR VIEW LOGIC
//  This file is responsible for rendering the main monthly calendar view.
//  It is a pure UI component that gets its data from `window.getAllScheduledItems()`.
// ====================================================================================

/**
 * REMOVED: The entire scanForDataWithDates() function is now obsolete.
 * Its logic has been centralized and improved in the global `window.getAllScheduledItems()` function.
 */

/**
 * Renders the monthly calendar grid for the given date.
 * @param {Date} date - The date within the month to render.
 */
function renderMonthlyCalendar(date) {
  const startOfMonth = dateFns.startOfMonth(date);
  const endOfMonth = dateFns.endOfMonth(date);
  const startOfCalendar = dateFns.startOfISOWeek(startOfMonth);
  const endOfCalendar = dateFns.endOfISOWeek(endOfMonth);

  // Populate month and year dropdowns (UI logic, stays here)
  populateMonthYearDropdowns(date);

  DOM.calendarGrid.innerHTML = '';

  // --- REFACTORED: Get data from the single source of truth ---
  // 1. Call the centralized function to get the complete map of all scheduled items.
  const allScheduled = window.getAllScheduledItems();

  // 2. Extract just the dates (the keys of the map) into a Set for efficient lookups.
  //    This perfectly replaces the old `scanForDataWithDates()` functionality.
  const datesWithData = new Set([...allScheduled.keys()]);
  // --- END REFACTOR ---

  // Day names header
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  dayNames.forEach(name => {
    const nameEl = document.createElement('div');
    nameEl.className = 'day-name';
    nameEl.textContent = name;
    DOM.calendarGrid.appendChild(nameEl);
  });

  // --- The rest of the rendering logic is UNCHANGED ---
  // It correctly uses the `datesWithData` Set, which is now populated from a more reliable source.
  let day = startOfCalendar;
  while (dateFns.isBefore(day, dateFns.addDays(endOfCalendar, 1))) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    const dayDateStr = dateFns.format(day, 'yyyy-MM-dd');
    dayEl.dataset.date = dayDateStr;

    if (!dateFns.isSameMonth(day, date)) {
      dayEl.classList.add('other-month');
    }

    if (dateFns.isToday(day)) {
      dayEl.classList.add('today');
    }

    dayEl.innerHTML = `<div class="day-number">${dateFns.format(day, 'd')}</div>`;

    // This check now works with data from our central function
    if (datesWithData.has(dayDateStr)) {
      const dot = document.createElement('div');
      dot.className = 'dot-indicator';
      dayEl.appendChild(dot);
    }

    const thisDay = dateFns.parseISO(dateFns.format(day, 'yyyy-MM-dd'));
    dayEl.addEventListener('click', () => {
      appState.currentDate = thisDay;
      appState.currentView = 'weekly'; // Navigate to the weekly planner view for that day
      renderApp();
      setTimeout(() => renderWeeklyPlanner(true), 0);
    });

    DOM.calendarGrid.appendChild(dayEl);
    day = dateFns.addDays(day, 1);
  }
}

// ====================================================================================
//  UI HELPERS & NAVIGATION (These functions were already correct and remain unchanged)
// ====================================================================================

function populateMonthYearDropdowns(date) {
  const currentMonth = dateFns.getMonth(date);
  const currentYear = dateFns.getYear(date);

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
  const newDate = dateFns.setDate(dateFns.setYear(dateFns.setMonth(appState.currentDate, selectedMonth), selectedYear), 1);
  appState.currentDate = newDate;
  renderMonthlyCalendar(appState.currentDate);
}

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