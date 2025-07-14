// --- THEME UTILITIES (for early theme init, non-dropdown logic) ---
function getPreferredTheme() {
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) return storedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(mode) {
  document.body.classList.remove('light-mode', 'dark-mode', 'solarized-mode', 'dracula-mode');
  if (["light", "dark", "solarized", "dracula"].includes(mode)) {
    document.body.classList.add(`${mode}-mode`);
    localStorage.setItem('theme', mode);
  }
}
// --- UTILITIES ---

// --- PLANNER KEY PARSER ---
/**
 * Parses a plannerKey like '2025-W27-thursday' to a Date object (start of that day).
 * Returns null if invalid.
 */
function parsePlannerKeyToDate(plannerKey) {
  const match = plannerKey.match(/(\d{4})-W(\d{1,2})-([a-z]+)/i);
  if (!match || !window.dateFns) return null;
  const [_, year, week, day] = match;
  const weekNum = parseInt(week, 10);
  const yearNum = parseInt(year, 10);
  const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const dayIndex = dayNames.indexOf(day.toLowerCase());
  if (dayIndex === -1) return null;
  try {
    let start = window.dateFns.startOfISOWeek(window.dateFns.setISOWeek(new Date(yearNum, 0, 4), weekNum));
    let date = window.dateFns.addDays(start, dayIndex);
    return date;
  } catch {
    return null;
  }
}

// Expose date utilities globally for use in other scripts (after all functions and code are defined)
const getWeekKey = (date) => `${dateFns.getISOWeekYear(date)}-W${dateFns.getISOWeek(date)}`;
const getStorage = (key) => localStorage.getItem(key) || '';

function setStorage(key, value) {
  localStorage.setItem(key, value);
  setTimeout(() => {
    if (window.NotificationManager && typeof window.NotificationManager.scanAndSchedule === 'function') {
      window.NotificationManager.scanAndSchedule();
    }
  }, 0);
  window.markLocalDataAsModified();
}

function deleteStorage(key) {
  localStorage.removeItem(key);
  setTimeout(() => {
    if (window.NotificationManager && typeof window.NotificationManager.scanAndSchedule === 'function') {
      window.NotificationManager.scanAndSchedule();
    }
  }, 0);
  window.markLocalDataAsModified();
}

// Debounced sync function
const debouncedSyncWithCloud = debounce(() => {
    if (typeof syncWithCloud === 'function') syncWithCloud();
    
}, 3000);

// Expose globally for use in other scripts
window.getStorage = getStorage;
window.setStorage = setStorage;
window.deleteStorage = deleteStorage;

// Modal utilities
// Add option to only close overlay, not exit edit mode (for AI)
const showModal = (title, placeholder = '', defaultValue = '', options = {}) => {
  return new Promise((resolve) => {
    DOM.modalTitle.textContent = title;
    DOM.modalInput.placeholder = placeholder;
    DOM.modalInput.value = defaultValue;
    DOM.modalOverlay.classList.add('active');
    if (DOM.modalInput.style.display !== 'none') {
      DOM.modalInput.focus();
      DOM.modalInput.select();
    }
    const handleConfirm = () => {
      const value = DOM.modalInput.value.trim();
      if (options && options.onlyCloseOverlay) {
        DOM.modalOverlay.classList.remove('active');
        DOM.modalInput.value = '';
        resolve(value || null);
      } else {
        hideModal();
        resolve(value || null);
      }
    };
    const handleCancel = () => {
      if (options && options.onlyCloseOverlay) {
        DOM.modalOverlay.classList.remove('active');
        DOM.modalInput.value = '';
        resolve(null);
      } else {
        hideModal();
        resolve(null);
      }
    };
    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    DOM.modalConfirm.onclick = null;
    DOM.modalCancel.onclick = null;
    DOM.modalClose.onclick = null;
    DOM.modalInput.onkeydown = null;
    DOM.modalConfirm.onclick = handleConfirm;
    DOM.modalCancel.onclick = handleCancel;
    DOM.modalClose.onclick = handleCancel;
    DOM.modalInput.onkeydown = handleKeydown;
  });
};

// Expose showModal globally for AI assistant prompt
window.showModal = showModal;

const hideModal = () => {
  DOM.modalOverlay.classList.remove('active');
  DOM.modalInput.value = '';
};

const showConfirm = (message) => {
  return new Promise((resolve) => {
    DOM.modalTitle.textContent = 'Confirm Action';
    DOM.modalInput.style.display = 'none';
    let messageEl = DOM.modalOverlay.querySelector('.modal-message');
    if (!messageEl) {
      messageEl = document.createElement('div');
      messageEl.className = 'modal-message';
      DOM.modalInput.parentNode.insertBefore(messageEl, DOM.modalInput);
    }
    messageEl.innerHTML = message;
    messageEl.style.display = 'block';
    DOM.modalConfirm.textContent = 'Delete';
    DOM.modalCancel.textContent = 'Cancel';
    DOM.modalOverlay.classList.add('active');
    DOM.modalCancel.focus();
    const handleConfirm = () => {
      hideConfirmModal();
      resolve(true);
    };
    const handleCancel = () => {
      hideConfirmModal();
      resolve(false);
    };
    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    };
    DOM.modalConfirm.onclick = null;
    DOM.modalCancel.onclick = null;
    DOM.modalClose.onclick = null;
    document.onkeydown = null;
    DOM.modalConfirm.onclick = handleConfirm;
    DOM.modalCancel.onclick = handleCancel;
    DOM.modalClose.onclick = handleCancel;
    document.onkeydown = handleKeydown;
  });
};

const hideConfirmModal = () => {
  DOM.modalOverlay.classList.remove('active');
  DOM.modalInput.style.display = 'block';
  DOM.modalConfirm.textContent = 'OK';
  DOM.modalCancel.textContent = 'Cancel';
  const messageEl = DOM.modalOverlay.querySelector('.modal-message');
  if (messageEl) {
    messageEl.style.display = 'none';
  }
  document.onkeydown = null;
};

// --- PINNED PAGES UTILITIES ---
const getPinnedPages = () => {
  try {
    return JSON.parse(getStorage('pinned-pages') || '[]');
  } catch {
    return [];
  }
};

function setPinnedPages(arr) {
  setStorage('pinned-pages', JSON.stringify(arr));
}

const isPagePinned = (title) => getPinnedPages().includes(title);

const togglePinPage = (title) => {
  let pins = getPinnedPages();
  if (pins.includes(title)) {
    pins = pins.filter(t => t !== title);
  } else {
    pins.unshift(title);
  }
  setPinnedPages(pins);
};

/**
 * Exports all application data from localStorage to a JSON file.
 * Only exports keys that are relevant to the application (e.g., 'page-', 'pinnedPages', 'theme').
 */
function exportAllData() {
  const appData = {};
  const relevantKeys = ['pinnedPages', 'theme', 'currentView', 'currentDate']; // Add other global state keys if needed

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Export all 'page-' keys and other explicitly relevant keys
    if (key.startsWith('page-') || relevantKeys.includes(key)) {
      try {
        appData[key] = localStorage.getItem(key);
      } catch (e) {
        console.error(`Error reading localStorage key "${key}":`, e);
      }
    }
  }

  const dataStr = JSON.stringify(appData, null, 2); // Pretty print JSON
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const date = dateFns.format(new Date(), 'yyyy-MM-dd');
  a.download = `focal-journal-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert('Your Focal Journal data has been exported!');
}

/**
 * Imports data from a JSON file into localStorage.
 * Prompts the user for confirmation before overwriting existing data.
 */
async function importAllData() {
  const confirmed = await showConfirm('Importing data will overwrite your current journal entries and settings. Are you sure you want to proceed?');
  if (!confirmed) {
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.style.display = 'none'; // Hide the input element

  input.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Clear existing app-specific data before importing
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('page-') || ['pinnedPages', 'theme', 'currentView', 'currentDate'].includes(key)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => deleteStorage(key));

        // Populate localStorage with imported data
        for (const key in importedData) {
          localStorage.setItem(key, importedData[key]);
        }
        alert('Data imported successfully! The application will now refresh.');
        location.reload(); // Reload the page to apply new data and re-render UI
      } catch (error) {
        alert('Error importing data: Invalid JSON file or corrupted data. Please ensure you are importing a valid Focal Journal backup file.');
        console.error('Error parsing imported JSON:', error);
      }
    };
    reader.readAsText(file);
  });
  input.click(); // Programmatically click the hidden input to open file dialog
}

// --- Debounce Utility ---
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Add this near the top, after your imports and before parseMarkdown
window.getNextRepeatOccurrence = function(rule, start, end) {
  console.log(`[DEBUG] getNextRepeatOccurrence: Called with rule: "${rule}"`);
  // Use today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to format date as yyyy-MM-dd
  function formatDate(d) {
    if (!d || isNaN(d.getTime())) {
        console.log(`[DEBUG] getNextRepeatOccurrence: Invalid date passed to formatDate:`, d);
        return null; // Add check for invalid date
    }
    return d.toISOString().slice(0, 10);
  }

  // Handle "everyday"
  if (/^everyday$/i.test(rule.trim())) {
    const next = new Date(today);
    next.setDate(today.getDate() + 1);
    const formattedNext = formatDate(next);
    console.log(`[DEBUG] getNextRepeatOccurrence: "everyday" rule, next occurrence: ${formattedNext}`);
    return formattedNext;
  }

  // Handle "everyday" with time(s) - the time part is handled by the regex, not the date calculation
  if (/^everyday/i.test(rule.trim())) {
    const next = new Date(today);
    next.setDate(today.getDate() + 1);
     const formattedNext = formatDate(next);
    console.log(`[DEBUG] getNextRepeatOccurrence: "everyday" with time rule, next occurrence: ${formattedNext}`);
    return formattedNext;
  }

  // Handle "every <weekday>"
  const weekdayMatch = rule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
  if (weekdayMatch) {
    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = weekdays.indexOf(weekdayMatch[1].toLowerCase());
    let next = new Date(today);
    let days = (target - today.getDay() + 7) % 7;
    if (days === 0) days = 7; // If today is the target day, next occurrence is next week
    next.setDate(today.getDate() + days);
     const formattedNext = formatDate(next);
    console.log(`[DEBUG] getNextRepeatOccurrence: "every weekday" rule, next occurrence: ${formattedNext}`);
    return formattedNext;
  }

  // Handle "every <weekday> from <start> to <end>"
  const rangeMatch = rule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)/i);
  if (rangeMatch) {
    const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target = weekdays.indexOf(rangeMatch[1].toLowerCase());
    let startDate = window.parseDateString ? window.parseDateString(rangeMatch[2]) : null;
    let endDate = window.parseDateString ? window.parseDateString(rangeMatch[3]) : null;
    if (!startDate || !endDate) {
        console.log(`[DEBUG] getNextRepeatOccurrence: Invalid start/end dates for weekly range rule.`);
        return null;
    }
    
    // Ensure start and end dates are at the beginning of the day for comparison
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    let next = new Date(today > startDate ? today : startDate);
    next.setHours(0, 0, 0, 0); // Ensure next is at start of day

    // Find the first occurrence on or after 'next' (which is max(today, startDate))
    while (next.getDay() !== target) {
        next.setDate(next.getDate() + 1);
    }

    // If the found date is after the end date, there are no more occurrences in the range
    if (next > endDate) {
        console.log(`[DEBUG] getNextRepeatOccurrence: Next occurrence ${formatDate(next)} is after end date ${formatDate(endDate)}.`);
        return null;
    }
    const formattedNext = formatDate(next);
    console.log(`[DEBUG] getNextRepeatOccurrence: "every weekday from date to date" rule, next occurrence: ${formattedNext}`);
    return formattedNext;
  }

  // Handle "everyday from <start> to <end>"
  const everydayRangeMatch = rule.match(/^everyday from ([^ ]+) to ([^ )]+)/i);
  if (everydayRangeMatch) {
    let startDate = window.parseDateString ? window.parseDateString(everydayRangeMatch[1]) : null;
    let endDate = window.parseDateString ? window.parseDateString(everydayRangeMatch[2]) : null;
    if (!startDate || !endDate) {
        console.log(`[DEBUG] getNextRepeatOccurrence: Invalid start/end dates for everyday range rule.`);
        return null;
    }
    
    // Ensure start and end dates are at the beginning of the day for comparison
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    let next = new Date(today > startDate ? today : startDate);
    next.setHours(0, 0, 0, 0); // Ensure next is at start of day

    // If the found date is after the end date, there are no more occurrences in the range
    if (next > endDate) {
         console.log(`[DEBUG] getNextRepeatOccurrence: Next occurrence ${formatDate(next)} is after end date ${formatDate(endDate)}.`);
        return null;
    }
    const formattedNext = formatDate(next);
    console.log(`[DEBUG] getNextRepeatOccurrence: "everyday from date to date" rule, next occurrence: ${formattedNext}`);
    return formattedNext;
  }

   // Handle annual (DD-MM or DD.MM or DD/MM) and full date (YYYY-MM-DD)
  let dateStr = rule.trim();
  let parsedDate = window.parseDateString ? window.parseDateString(dateStr) : null;

  if (parsedDate && !isNaN(parsedDate.getTime())) {
      // For both full dates (with year) and annual repeats (without year),
      // calculate the next occurrence of the month and day on or after today.
      const targetMonth = parsedDate.getMonth();
      const targetDay = parsedDate.getDate();

      let year = today.getFullYear();
      let next = new Date(year, targetMonth, targetDay);
       console.log(`[DEBUG] getNextRepeatOccurrence: Parsed date "${dateStr}", initial next: ${formatDate(next)}`);

      // If the date this year is in the past, use next year
      if (next < today) {
          next.setFullYear(year + 1);
           console.log(`[DEBUG] getNextRepeatOccurrence: Initial next is in the past, using next year: ${formatDate(next)}`);
      }
      const formattedNext = formatDate(next);
      console.log(`[DEBUG] getNextRepeatOccurrence: Annual/Full date rule, next occurrence: ${formattedNext}`);
      return formattedNext;
  }

  // Fallback: try parseDateString (should be covered by the logic above, but keep as a final fallback)
  if (window.parseDateString) {
    const d = window.parseDateString(rule);
    if (d && !isNaN(d.getTime())) {
        const formattedNext = formatDate(d);
        console.log(`[DEBUG] getNextRepeatOccurrence: Fallback parseDateString, result: ${formattedNext}`);
        return formattedNext;
    }
  }
  console.log(`[DEBUG] getNextRepeatOccurrence: No match found for rule: "${rule}"`);
  return null; // Return null if no format matched or date is invalid
};

// utils.js
// Modified REPEAT_REGEX to make the rule capture group greedy
window.REPEAT_REGEX = /\(REPEAT:\s*([^)]+)\)/gi;
window.scheduledRegex = new RegExp(
  `^([-*]\\s*\\[([x ])\\]\\s*)?(.*?)\\(SCHEDULED:\\s*${window.DATE_REGEX_PATTERN}(?:\\s*(\\d{1,2}:\\d{2})(?:[- ](\\d{1,2}:\\d{2}))?)?\\)`,
  'i'
);


// --- /js/utils.js ---

// =================================================================================
//  SHARED CONSTANTS (Single Source of Truth for Regex)
// =================================================================================

// Matches [[wiki links]]
window.WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

// Matches various date formats like YYYY-MM-DD, DD.MM.YYYY, etc.
window.DATE_REGEX_PATTERN = '(\\d{4}-\\d{2}-\\d{2}|\\d{2}[./-]\\d{2}[./-]\\d{4})';

// Matches (SCHEDULED: <date> [time])
window.SCHEDULED_REGEX = new RegExp(
  // Optional checkbox prefix: ` - [ ] `
  `^([-*]\\s*\\[([x ])\\]\\s*)?` +
  // The task text (non-greedy)
  `(.*?)` +
  // The SCHEDULED tag, capturing date, optional start time, and optional end time
  `\\(SCHEDULED:\\s*${window.DATE_REGEX_PATTERN}(?:\\s*(\\d{1,2}:\\d{2})(?:[- ](\\d{1,2}:\\d{2}))?)?\\)`,
  'i'
);

// Matches (REPEAT: <rule>)
window.REPEAT_REGEX = /\(REPEAT:\s*([^)]+)\)/gi;

// Matches (NOTIFY: <date> [time])
window.NOTIFY_REGEX = new RegExp(
    `^(?:[-*]\\s*\\[[x ]\\]\\s*)?(.*)\\(NOTIFY:\\s*${window.DATE_REGEX_PATTERN}(?:\\s*(\\d{1,2}:\\d{2}))?\\)`,
    'i'
);


// =================================================================================
//  CENTRALIZED DATE & RECURRENCE PARSING
// =================================================================================

/**
 * The single, authoritative function for parsing a date string from various formats.
 * @param {string} dateStr The date string to parse.
 * @returns {Date|null} A Date object or null.
 */
function parseDateString(dateStr) {
  if (!dateStr || !window.dateFns) return null;
  // Define formats from most specific (datetime) to least specific (date)
  const formats = [
    'dd.MM.yyyy HH:mm', 'dd/MM/yyyy HH:mm', 'dd-MM-yyyy HH:mm',
    'yyyy-MM-dd HH:mm', 'yyyy-MM-dd', 'dd.MM.yyyy', 'dd/MM/yyyy', 'dd-MM-yyyy'
  ];
  for (const format of formats) {
    try {
      const date = window.dateFns.parse(dateStr, format, new Date());
      if (window.dateFns.isValid(date)) return date;
    } catch (e) { /* continue */ }
  }
  // Final attempt with ISO parsing
  try {
      const isoDate = window.dateFns.parseISO(dateStr);
      if (window.dateFns.isValid(isoDate)) return isoDate;
  } catch(e) {}
  return null;
}

/**
 * Normalizes a date string from various formats to the universal 'yyyy-MM-dd' format.
 * @param {string} dateStr The date string to normalize.
 * @returns {string|null} The normalized date string or null if invalid.
 */
function normalizeDateStringToYyyyMmDd(dateStr) {
  const date = parseDateString(dateStr);
  return date ? window.dateFns.format(date, 'yyyy-MM-dd') : null;
}

// In js/utils.js

// In js/utils.js

/**
 * The single, authoritative function to expand a recurrence rule into an array of dates.
 * This is the final, robust version that handles all formats, including intervals with date ranges.
 * @param {object} item - An object containing the repeatRule and other context.
 * @param {object} options - An object with { rangeStart, rangeEnd } Dates for the expansion window.
 * @returns {Date[]} An array of Date objects for each occurrence.
 */
function expandRecurrence(item, options) {
    const { repeatRule, fullLine = '' } = item;
    const { rangeStart, rangeEnd } = options;
    const results = [];

    if (!repeatRule || !rangeStart || !rangeEnd || !window.dateFns) return results;

    // --- RULE 1: INTERVAL-BASED (now with optional date range) ---
    // Matches "every 2 days", "every 3 weeks from YYYY-MM-DD to YYYY-MM-DD", etc.
    const intervalMatch = repeatRule.match(/^every (\d+)\s+(day|week|month|year)s?(?: from ([^ ]+) to ([^ )]+))?$/i);
    
    if (intervalMatch) {
        const quantity = parseInt(intervalMatch[1], 10);
        const unit = intervalMatch[2].toLowerCase();
        // These will be undefined if the "from...to" part is not present
        const ruleStartDateStr = intervalMatch[3];
        const ruleEndDateStr = intervalMatch[4];

        const addInterval = (date) => {
            if (unit === 'day') return dateFns.addDays(date, quantity);
            if (unit === 'week') return dateFns.addWeeks(date, quantity);
            if (unit === 'month') return dateFns.addMonths(date, quantity);
            if (unit === 'year') return dateFns.addYears(date, quantity);
            return date;
        };

        // Determine the effective start and end dates for the rule itself
        const ruleStartDate = ruleStartDateStr ? parseDateString(ruleStartDateStr) : null;
        const ruleEndDate = ruleEndDateStr ? parseDateString(ruleEndDateStr) : null;

        // Determine the absolute starting point for the iteration
        let effectiveStartDate;
        if (ruleStartDate) {
            effectiveStartDate = ruleStartDate;
        } else {
            const scheduledMatch = fullLine.match(/\(SCHEDULED:\s*([^)]+)\)/i);
            effectiveStartDate = scheduledMatch ? (parseDateString(scheduledMatch[1]) || new Date()) : new Date();
        }
        effectiveStartDate.setHours(0, 0, 0, 0);

        let current = new Date(effectiveStartDate);

        // Optimization: If the start date is way in the past, fast-forward to the visible window
        if (current < rangeStart) {
            // This loop is safe because we check if the next date is greater
            while (current < rangeStart) {
                const next = addInterval(current);
                if (next <= current) break; // Prevents infinite loops
                current = next;
            }
        }
        
        // Generate occurrences, stopping at the EARLIEST of the rule's end date or the overall range end
        const finalEndDate = ruleEndDate ? (ruleEndDate < rangeEnd ? ruleEndDate : rangeEnd) : rangeEnd;
        
        while (current <= finalEndDate) {
            // Only add the date if it's also within the visible range start
            if (current >= rangeStart) {
                results.push(new Date(current));
            }
            const next = addInterval(current);
            if (next <= current) break;
            current = next;
        }
        return results;
    }

    // --- ALL OTHER RULES (WEEKLY, EVERYDAY, ANNUAL) REMAIN UNCHANGED ---
    // They are correctly handled by the logic below.

    const weeklyMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?: from ([^ ]+) to ([^ )]+))?/i);
    if (weeklyMatch) {
        const weekdayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(weeklyMatch[1].toLowerCase());
        const ruleStartDate = weeklyMatch[2] ? parseDateString(weeklyMatch[2]) : rangeStart;
        const ruleEndDate = weeklyMatch[3] ? parseDateString(weeklyMatch[3]) : rangeEnd;
        if (!ruleStartDate || !ruleEndDate) return results;

        let current = new Date(ruleStartDate > rangeStart ? ruleStartDate : rangeStart);
        
        while (current.getDay() !== weekdayIndex) {
            current = dateFns.addDays(current, 1);
        }
        while (current <= ruleEndDate && current <= rangeEnd) {
            results.push(new Date(current));
            current = dateFns.addWeeks(current, 1);
        }
        return results;
    }

    const everydayRangeMatch = repeatRule.match(/^everyday from ([^ ]+) to ([^ )]+)/i);
    if (everydayRangeMatch) {
        let current = parseDateString(everydayRangeMatch[1]);
        const ruleEndDate = parseDateString(everydayRangeMatch[2]);
        if (!current || !ruleEndDate) return results;
        while (current <= ruleEndDate) {
            if (current >= rangeStart && current <= rangeEnd) results.push(new Date(current));
            current = dateFns.addDays(current, 1);
        }
        return results;
    }
    if (repeatRule.toLowerCase() === 'everyday') {
        let current = new Date(rangeStart);
        while (current <= rangeEnd) {
            results.push(new Date(current));
            current = dateFns.addDays(current, 1);
        }
        return results;
    }
    
    const parsedDate = parseDateString(repeatRule);
    if (parsedDate) {
        const month = parsedDate.getMonth();
        const day = parsedDate.getDate();
        for (let year = rangeStart.getFullYear(); year <= rangeEnd.getFullYear(); year++) {
            const annualDate = new Date(year, month, day);
            if (annualDate.getMonth() === month && annualDate >= rangeStart && annualDate <= rangeEnd) {
                results.push(annualDate);
            }
        }
    }

    return results;
}

/**
 * The single, authoritative function to get all scheduled and recurring items.
 * This should be the ONLY function that iterates through localStorage to find tasks.
 * @returns {Map<string, Array<object>>} A map where keys are 'YYYY-MM-DD' and values are arrays of item objects.
 */
function getAllScheduledItems() {
  const scheduledItems = new Map();
  // Set a reasonable range to avoid infinite loops with recurrence
  const rangeStart = dateFns.subYears(new Date(), 2);
  const rangeEnd = dateFns.addYears(new Date(), 5);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Only process pages, which contain the planner content
    if (!key.startsWith('page-')) continue;

    const content = localStorage.getItem(key);
    const pageTitle = key.substring(5);
    const lines = content.split('\n');

    lines.forEach((line, lineIndex) => {
      const baseItem = {
        pageKey: key,
        displayName: pageTitle,
        lineIndex: lineIndex,
        isCheckbox: /^[-*]\s*\[[ x]\]/.test(line),
        checkboxState: /\[x\]/i.test(line),
      };

      const addItem = (date, itemDetails) => {
        const dateStr = dateFns.format(date, 'yyyy-MM-dd');
        if (!scheduledItems.has(dateStr)) scheduledItems.set(dateStr, []);
        scheduledItems.get(dateStr).push({ ...baseItem, ...itemDetails });
      };
      
      const scheduleMatch = line.match(window.SCHEDULED_REGEX);
      const notifyMatch = line.match(window.NOTIFY_REGEX);
      const repeatMatches = [...line.matchAll(window.REPEAT_REGEX)];

      if (scheduleMatch) {
        const date = parseDateString(scheduleMatch[4]);
        if (date) {
          addItem(date, {
            text: scheduleMatch[3].trim(),
            time: scheduleMatch[5] || null,
            endTime: scheduleMatch[6] || null,
            recurring: false,
            notify: false,
            originalDate: scheduleMatch[4],
          });
        }
      }
      
      if (repeatMatches.length > 0) {
        repeatMatches.forEach(repeatMatch => {
          const fullRepeatRule = repeatMatch[1];
          let ruleForDateExpansion = fullRepeatRule;
          let startTime = null, endTime = null;

          const timeRegex = /\b(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?\s*$/;
          const timeMatch = fullRepeatRule.match(timeRegex);
          
          if (timeMatch) {
            startTime = timeMatch[1];
            endTime = timeMatch[2];
            if (!endTime && startTime) {
                const start = dateFns.parse(startTime, 'HH:mm', new Date());
                if (dateFns.isValid(start)) endTime = dateFns.format(dateFns.addHours(start, 1), 'HH:mm');
            }
            ruleForDateExpansion = fullRepeatRule.replace(timeRegex, '').trim();
          }
          
          // THE FIX: Pass the fullLine property to the expandRecurrence function
          const itemToExpand = { repeatRule: ruleForDateExpansion, fullLine: line };
          const occurrences = expandRecurrence(itemToExpand, { rangeStart, rangeEnd });
          
          occurrences.forEach(occurrenceDate => {
              const cleanText = line.replace(/\(SCHEDULED:[^)]+\)/gi, '').replace(/\(REPEAT:[^)]+\)/gi, '').replace(/^[-*]\s*\[[ x]\]\s*/, '').trim();
              addItem(occurrenceDate, {
                  text: cleanText,
                  recurring: true,
                  notify: false,
                  recurringKey: itemToExpand.repeatRule,
                  time: startTime,
                  endTime: endTime,
              });
          });
        });
      }

      if (notifyMatch) {
          const date = parseDateString(notifyMatch[2]);
          if(date) {
              addItem(date, {
                  text: notifyMatch[1].trim(),
                  time: notifyMatch[3] || null,
                  recurring: false,
                  notify: true,
                  originalDate: notifyMatch[2]
              });
          }
      }
    });
  }
  return scheduledItems;
}

// Add this new function to the bottom of js/utils.js, before the global exports

/**
 * The new central query hub for getting data from any widget API.
 * This acts as a safe, centralized access point.
 * @param {string} widgetName - The name of the target widget (e.g., 'books').
 * @param {string} methodName - The name of the method to call on the widget's API.
 * @param {any} [params] - Optional parameters to pass to the method.
 * @returns {any} The result from the API method, or null if it fails.
 */
function queryWidget(widgetName, methodName, params) {
    let widgetApi = null;

    // Map the widgetName to the global object you've created
    switch (widgetName.toLowerCase()) {
        case 'books':
            widgetApi = window.BookTracker;
            break;
        case 'movies':
            widgetApi = window.MovieTracker;
            break;
        // Add other widgets here as they develop APIs
        // case 'habits':
        //     widgetApi = window.HabitTracker;
        //     break;
        default:
            console.warn(`Query failed: Widget API for "${widgetName}" is not defined.`);
            return null;
    }

    if (!widgetApi) {
        console.warn(`Query failed: Widget "${widgetName}" is not loaded or available.`);
        return null;
    }

    const method = widgetApi[methodName];
    if (typeof method !== 'function') {
        console.warn(`Query failed: Method "${methodName}" not found on widget "${widgetName}".`);
        return null;
    }

    try {
        // Call the method from the widget's exposed API
        return method(params);
    } catch (e) {
        console.error(`Error executing method "${methodName}" on widget "${widgetName}":`, e);
        return null;
    }
}

// --- Now, add this new function to your list of global exports at the end of utils.js ---
window.queryWidget = queryWidget;

// Expose globally
window.parseDateString = parseDateString;
window.normalizeDateStringToYyyyMmDd = normalizeDateStringToYyyyMmDd;
window.getAllScheduledItems = getAllScheduledItems;
window.exportAllData = exportAllData;
window.importAllData = importAllData;
window.DATE_REGEX_PATTERN = DATE_REGEX_PATTERN;
window.parseDateString = parseDateString;
window.normalizeDateStringToYyyyMmDd = normalizeDateStringToYyyyMmDd;
window.parsePlannerKeyToDate = parsePlannerKeyToDate;