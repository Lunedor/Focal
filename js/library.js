// --- LIBRARY PAGE LOGIC ---
function renderLibraryPage(pageTitle) {
  const key = `page-${pageTitle}`;
  const content = getStorage(key);
  DOM.pageTitle.textContent = pageTitle;
  DOM.pageContentWrapper.innerHTML = parseMarkdown(content);
  DOM.pageContentWrapper.dataset.key = key;

  // --- Initialize Mood Tracker if placeholder exists ---
  const moodTrackerPlaceholder = DOM.pageContentWrapper.querySelector('.mood-tracker-placeholder');
  if (moodTrackerPlaceholder) {
    const command = moodTrackerPlaceholder.dataset.command;
    const onCommandChange = (newCommand) => {
        // Update the page content in the background without re-rendering the whole page
        const currentPageKey = DOM.pageContentWrapper.dataset.key;
        if (currentPageKey) {
            setStorage(currentPageKey, newCommand);
        }
    };
    moodTracker.init(moodTrackerPlaceholder, command, onCommandChange);
  }

  // --- Initialize Finance Tracker if placeholder exists ---
  const financeTrackerPlaceholder = DOM.pageContentWrapper.querySelector('.finance-widget-placeholder');
  if (financeTrackerPlaceholder) {
    const command = financeTrackerPlaceholder.dataset.command;
    const transactions = financeTrackerPlaceholder.dataset.transactions;
    // Ensure financeTracker is available
    if (typeof financeTracker !== 'undefined' && financeTracker.init) {
      // Create a callback to update the command in the document when filter changes
      const onCommandChange = (newCommand) => {
        // Get the current page content
        const currentPageKey = DOM.pageContentWrapper.dataset.key;
        if (!currentPageKey) return;
        
        // Get the current content
        const content = getStorage(currentPageKey);
        if (!content) return;
        
        // Replace the FINANCE command with the new one
        const oldCommand = command;
        const updatedContent = content.replace(oldCommand, newCommand);
        
        // Update the storage
        setStorage(currentPageKey, updatedContent);
        
        // Update the placeholder's command attribute
        financeTrackerPlaceholder.dataset.command = newCommand;
        
        // Trigger sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
          debouncedSyncWithCloud();
        }
        
        // Re-render the current page to reflect the command changes
        if (currentPageKey.startsWith('page-')) {
          const pageTitle = currentPageKey.substring(5);
          renderLibraryPage(pageTitle);
        }
      };
      
      // Initialize the finance tracker with the command change callback
      financeTracker.init(financeTrackerPlaceholder, command, transactions, {
        onCommandChange,
        commandNode: financeTrackerPlaceholder
      });
    }
  }

  // --- Backlinks (Linked Mentions) ---
  const backlinks = findBacklinks(pageTitle);
  let backlinksHtml = '';
  if (backlinks.length > 0) {
    backlinksHtml = `
      <section class="backlinks-section">
        <h3 class="backlinks-heading">Linked Mentions</h3>
        <ul class="backlinks-list">
          ${backlinks.map(link => {
            // If the sourceTitle is a formatted planner key, add a data-planner-key attribute
            const isPlanner = !!link.plannerKey;
            return `
              <li class="backlink-item">
                <a href="#" class="backlink-source" data-${isPlanner ? 'planner-key' : 'page-link'}="${isPlanner ? link.plannerKey : link.sourceTitle}">${link.sourceTitle}</a>
                <span class="backlink-snippet">${link.snippet}</span>
              </li>
            `;
          }).join('')}
        </ul>
      </section>
    `;
  }
  // Append backlinks below the main content
  DOM.pageContentWrapper.insertAdjacentHTML('beforeend', backlinksHtml);
}
// Find all pages and planner entries that mention the given page title as a wiki-link
function findBacklinks(targetTitle) {
  const backlinks = [];
  if (!targetTitle) return backlinks;
  // Regex to match [[Target Title]] with optional whitespace
  const escapedTitle = targetTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wikiLinkRegex = new RegExp(`\\[\\[\\s*${escapedTitle}\\s*\\]\\]`, 'i');

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Only scan pages and planner days
    if (key.startsWith('page-') || key.match(/^\d{4}-W\d{1,2}-/)) {
      const content = localStorage.getItem(key);
      if (!content) continue;
      const lines = content.split('\n');
      for (let line of lines) {
        // --- Backlink for wiki-link ---
        if (wikiLinkRegex.test(line)) {
          // Don't show self-links
          let sourceTitle, plannerKey = null;
          if (key.startsWith('page-')) {
            sourceTitle = key.substring(5);
          } else {
            sourceTitle = formatPlannerKey(key);
            plannerKey = key;
          }
          if (sourceTitle === targetTitle) continue;
          let snippet = line.replace(wikiLinkRegex, match => `<mark>${match}</mark>`).trim();
          if (snippet.length > 120) snippet = snippet.slice(0, 110) + '...';
          backlinks.push({ sourceTitle, snippet, plannerKey });
        }
        // --- Backlink for scheduled tasks ---
        // Accepts (SCHEDULED: 2025-06-24), (SCHEDULED: 31.12.2025), (SCHEDULED: 31/12/2025)
        // e.g. - [ ] Task (SCHEDULED: 2025-06-24) ... [[Target Title]]
        const scheduledRegex = new RegExp(`\\(SCHEDULED: \\s*${window.DATE_REGEX_PATTERN}\\)`, 'i');
        if (scheduledRegex.test(line) && wikiLinkRegex.test(line)) {
          // For planner keys, show a nice date
          let sourceTitle, plannerKey = null;
          let dateStr = scheduledRegex.exec(line)[1];
          // Normalize dateStr to yyyy-mm-dd for formatPlannerKey fallback
          let normalizedDate = window.normalizeDateStringToYyyyMmDd(dateStr);
          if (!normalizedDate) continue;
          if (key.startsWith('page-')) {
            sourceTitle = key.substring(5);
          } else {
            // Pass the original dateStr to formatPlannerKey
            sourceTitle = formatPlannerKey(key, dateStr);
            plannerKey = key;
          }
          if (sourceTitle === targetTitle) continue;
          let snippet = line.replace(wikiLinkRegex, match => `<mark>${match}</mark>`).trim();
          if (snippet.length > 120) snippet = snippet.slice(0, 110) + '...';
          backlinks.push({ sourceTitle, snippet, plannerKey });
        }
      }
    }
  }
  return backlinks;
}

// Helper: Format planner keys like '2025-W26-tuesday' to 'Tuesday, Jun 24, 2025'
function formatPlannerKey(key, originalDateStr) {
  // key: '2025-W26-tuesday' or similar
  const match = key.match(/(\d{4})-W(\d{1,2})-([a-z]+)/i);
  if (match) {
    const [_, year, week, day] = match;
    // Find the date for this week/day
    try {
      // Use date-fns to get start of ISO week, then add day offset
      const weekNum = parseInt(week, 10);
      const yearNum = parseInt(year, 10);
      const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const dayIndex = dayNames.indexOf(day.toLowerCase());
      if (dayIndex !== -1 && window.dateFns) {
        let start = window.dateFns.startOfISOWeek(window.dateFns.setISOWeek(new Date(yearNum, 0, 4), weekNum));
        let date = window.dateFns.addDays(start, dayIndex);
        return `${capitalize(day)}, ${window.dateFns.format(date, 'MMM d, yyyy')}`;
      }
    } catch {}
  }
  // If originalDateStr is provided, use centralized parseDateString
  if (originalDateStr && window.parseDateString && window.dateFns) {
    const date = window.parseDateString(originalDateStr);
    if (date) {
      return window.dateFns.format(date, 'MMM d, yyyy');
    }
  }
  // Fallback if no parsing succeeded
  return key;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateWikiLinks(oldTitle, newTitle) {
  const oldTitleRegex = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchRegex = new RegExp(`\\[\\[\\s*${oldTitleRegex}\\s*\\]\\]`, 'gi');
  const newLink = `[[${newTitle}]]`;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('page-') || key.match(/^\d{4}-W\d{1,2}-/)) {
      const content = localStorage.getItem(key);
      const newContent = content.replace(searchRegex, newLink);
      setStorage(key, newContent);
    }
  }
}
