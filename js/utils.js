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
// --- DATE UTILITIES ---
/**
 * Parses a date string from various supported formats.
 * @param {string} dateStr The date string to parse.
 * @returns {Date|null} A Date object if parsing is successful, otherwise null.
 */
function parseDateString(dateStr) {
  if (!dateStr || !window.dateFns) return null;
  // Try ISO parsing first as it's the most common and unambiguous
  try {
    const isoDate = window.dateFns.parseISO(dateStr);
    if (window.dateFns.isValid(isoDate)) {
      return isoDate;
    }
  } catch(e) {}

  // Try date+time formats first
  const dateTimeFormats = [
    'dd.MM.yyyy HH:mm', // 03.07.2025 16:20
    'dd/MM/yyyy HH:mm', // 03/07/2025 16:22
    'dd-MM-yyyy HH:mm', // 03-07-2025 16:21
    'yyyy-MM-dd HH:mm', // 2025-07-03 16:15
  ];
  for (const format of dateTimeFormats) {
    try {
      const date = window.dateFns.parse(dateStr, format, new Date());
      if (window.dateFns.isValid(date)) {
        return date;
      }
    } catch (e) {
      // Ignore parsing errors and try the next format
    }
  }

  // Try date-only formats
  const dateOnlyFormats = [
    'dd.MM.yyyy', // For 31.12.2025
    'dd/MM/yyyy', // For 31/12/2025
    'dd-MM-yyyy', // For 31-12-2025
    'yyyy-MM-dd', // For 2025-07-03
  ];
  for (const format of dateOnlyFormats) {
    try {
      const date = window.dateFns.parse(dateStr, format, new Date());
      if (window.dateFns.isValid(date)) {
        return date;
      }
    } catch (e) {
      // Ignore parsing errors and try the next format
    }
  }
  return null; // Return null if no format matched
}

/**
 * Normalizes a date string from various formats to 'yyyy-MM-dd'.
 * @param {string} dateStr The date string to normalize.
 * @returns {string|null} The normalized date string or null if invalid.
 */
function normalizeDateStringToYyyyMmDd(dateStr) {
  const date = parseDateString(dateStr);
  if (date) {
    return window.dateFns.format(date, 'yyyy-MM-dd');
  }
  return null;
}

// A more robust regex to find all your supported formats
const DATE_REGEX_PATTERN = '(\\d{4}-\\d{2}-\\d{2}|\\d{2}[./-]\\d{2}[./-]\\d{4})';

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
window.DATE_REGEX_PATTERN = DATE_REGEX_PATTERN;
window.parseDateString = parseDateString;
window.normalizeDateStringToYyyyMmDd = normalizeDateStringToYyyyMmDd;
window.parsePlannerKeyToDate = parsePlannerKeyToDate;
const getWeekKey = (date) => `${dateFns.getISOWeekYear(date)}-W${dateFns.getISOWeek(date)}`;
const getStorage = (key) => localStorage.getItem(key) || '';
// This function is probably in your main app.js or a utils.js file

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
const showModal = (title, placeholder = '', defaultValue = '') => {
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
      hideModal();
      resolve(value || null);
    };
    const handleCancel = () => {
      hideModal();
      resolve(null);
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
// Expose functions globally for access from other scripts
window.exportAllData = exportAllData;
window.importAllData = importAllData;