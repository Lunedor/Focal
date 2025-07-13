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
    dayEl.dataset.plannerDate = dayDateStr; // Add for navigation

    if (!dateFns.isSameMonth(day, date)) {
      dayEl.classList.add('other-month');
    }

    if (dateFns.isToday(day)) {
      dayEl.classList.add('today');
    }

    // Add 'past' class if the day is before today and not today
    if (dateFns.isBefore(day, dateFns.startOfDay(new Date())) && !dateFns.isToday(day)) {
        dayEl.classList.add('past');
    }

    dayEl.innerHTML = `<div class="day-number">${dateFns.format(day, 'd')}</div>`;

    // --- NEW: Add event indicators and tooltip data ---
    const itemsForDay = allScheduled.get(dayDateStr) || [];

    if (itemsForDay.length > 0) {
        // Determine event type for styling
        const hasScheduled = itemsForDay.some(item => !item.recurring);
        const hasRepeat = itemsForDay.some(item => item.recurring);

        if (hasScheduled && hasRepeat) {
            dayEl.classList.add('has-mixed-events');
        } else if (hasRepeat) {
            dayEl.classList.add('has-repeat-events');
        } else {
            dayEl.classList.add('has-events');
        }

        // Create event indicators with appropriate colors
        const eventIndicatorsHtml = `
            <div class="event-indicators">
                ${itemsForDay.slice(0, 3).map((item, index) =>
                    `<div class="event-dot" style="background-color: ${getEventColor(index, item.recurring ? 'repeat' : 'scheduled')};"></div>`
                ).join('')}
                ${itemsForDay.length > 3 ? '<div class="event-more">+</div>' : ''}
            </div>
        `;
        dayEl.innerHTML += eventIndicatorsHtml;

        // Create tooltip content for items
        const tooltipContent = itemsForDay.map(item => {
            // Format the text properly for tooltip display
            let displayText = item.text;

            // Handle checkbox items
            if (item.isCheckbox) {
                 // Remove the markdown checkbox syntax from the text
                displayText = displayText.replace(/^[-*]\s*\[[x ]\]\s*/, '');
                // Add the proper checkbox symbol
                const checkboxSymbol = item.checkboxState ? '☑' : '☐';
                displayText = `${checkboxSymbol} ${displayText}`;
            }

            // Add repeat indicator for recurring items
            if (item.recurring) {
                 displayText = `🔁 ${displayText}`;
            }

            return `<div class="calendar-tooltip-item${item.recurring ? ' calendar-repeat-item' : ''}">${displayText}</div>`;
        }).join('');

        dayEl.dataset.tooltip = tooltipContent.replace(/"/g, '&quot;'); // Store tooltip content
    }
    // --- END NEW ---

    // This check now works with data from our central function
    // REMOVED: Old dot indicator logic is replaced by the new event indicators above
    /*
    if (datesWithData.has(dayDateStr)) {
      const dot = document.createElement('div');
      dot.className = 'dot-indicator';
      dayEl.appendChild(dot);
    }
    */

    const thisDay = dateFns.parseISO(dateFns.format(day, 'yyyy-MM-dd'));
    // Keep the existing click listener for navigation
    dayEl.addEventListener('click', () => {
      appState.currentDate = thisDay;
      appState.currentView = 'weekly'; // Navigate to the weekly planner view for that day
      renderApp();
      setTimeout(() => renderWeeklyPlanner(true), 0);
    });

    DOM.calendarGrid.appendChild(dayEl);
    day = dateFns.addDays(day, 1);
  }

  // --- NEW: Add event listeners for tooltips after rendering ---
  attachCalendarDayTooltipListeners();
  // --- END NEW ---
}

// --- NEW: Function to get event color (copied from futurelog.js) ---
function getEventColor(index, eventType = 'scheduled') {
    if (eventType === 'repeat') {
        // Orange/yellow colors for repeat events
        const repeatColors = [
            '#ff9800',                // Orange
            '#ffc107',                // Amber
            '#ff8f00',                // Dark Orange
            '#ffb300',                // Light Orange
            '#f57c00',                // Deep Orange
        ];
        return repeatColors[index % repeatColors.length];
    } else {
        // Blue/cool colors for scheduled events
        const scheduledColors = [
            '#007aff',                // Blue (default link color)
            '#4CAF50',                // Green
            '#9C27B0',                // Purple
            '#2196F3',                // Light Blue
            '#00BCD4',                // Cyan
        ];
        return scheduledColors[index % scheduledColors.length];
    }
}
// --- END NEW ---

// --- NEW: Function to attach tooltip listeners (adapted from futurelog.js) ---
function attachCalendarDayTooltipListeners() {
    const dayElements = DOM.calendarGrid.querySelectorAll('.calendar-day');

    dayElements.forEach(dayEl => {
        let tooltipEl = null;

        // Only add hover listeners for days with events
        if (dayEl.classList.contains('has-events') || dayEl.classList.contains('has-repeat-events') || dayEl.classList.contains('has-mixed-events')) {
            dayEl.addEventListener('mouseenter', (e) => {
                // Prevent edit mode on hover
                e.preventDefault();
                e.stopPropagation();

                const tooltipContent = dayEl.dataset.tooltip;
                if (!tooltipContent) return;

                // Create tooltip
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'calendar-tooltip'; // Use calendar-specific class
                tooltipEl.innerHTML = tooltipContent;
                document.body.appendChild(tooltipEl);

                // Position tooltip
                const rect = dayEl.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                tooltipEl.style.position = 'absolute';
                tooltipEl.style.left = `${rect.left + scrollLeft + rect.width / 2}px`;
                tooltipEl.style.top = `${rect.top + scrollTop - 10}px`;
                tooltipEl.style.transform = 'translate(-50%, -100%)';
                tooltipEl.style.zIndex = '1000';

                // Ensure tooltip stays within viewport (optional, but good practice)
                const tooltipRect = tooltipEl.getBoundingClientRect();
                if (tooltipRect.left < 10) {
                    tooltipEl.style.left = `${rect.left + scrollLeft}px`;
                    tooltipEl.style.transform = 'translateY(-100%)';
                } else if (tooltipRect.right > window.innerWidth - 10) {
                    tooltipEl.style.left = `${rect.right + scrollLeft}px`;
                    tooltipEl.style.transform = 'translate(-100%, -100%)';
                }
            });

            dayEl.addEventListener('mouseleave', () => {
                if (tooltipEl) {
                    tooltipEl.remove();
                    tooltipEl = null;
                }
            });
        }
    });
}
// --- END NEW ---

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