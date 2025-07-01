// --- MOBILE SIDEBAR TOGGLE ---
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburger-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const settingsModalOverlay = document.getElementById('settings-modal-overlay');
  function openSidebar() {
    document.body.classList.add('sidebar-open');
    if (window.feather) feather.replace();
  }
  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    // Hide settings modal if open
    if (settingsModalOverlay) settingsModalOverlay.classList.add('hidden');
  }
  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      openSidebar();
    });
  }
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
  // Also close sidebar if clicking outside sidebar (on mobile)
  document.addEventListener('click', (e) => {
    if (
      document.body.classList.contains('sidebar-open') &&
      window.innerWidth <= 768 &&
      sidebar &&
      !sidebar.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      closeSidebar();
    }
  });
  // Optional: close sidebar on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });
  // Optional: close sidebar if a nav link is clicked (on mobile)
  if (sidebar) {
    sidebar.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && e.target.closest('a,button')) {
        closeSidebar();
      }
    });
  }
});
// --- EVENT HANDLERS ---
// Theme logic is now handled in settings.js; no need for toggleTheme event listener
// Library search
DOM.librarySearch.addEventListener('input', renderSidebar);

// Helper function to insert markdown syntax into a textarea
function insertMarkdown(textarea, { prefix, suffix = '' }) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalValue = textarea.value;
    const selectedText = originalValue.substring(start, end);

    // Special handling for Add Checkbox button (prefix === '- [ ] ')
    if (prefix === '- [ ] ') {
        // Determine the full lines in the selection
        const lineStart = originalValue.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = originalValue.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = originalValue.length;
        const lines = originalValue.substring(lineStart, lineEnd).split('\n');
        // Toggle checkbox for each line
        const toggledLines = lines.map(line => {
            if (/^[-*]\s*\[.\]\s/.test(line)) {
                // Remove checkbox prefix
                return line.replace(/^[-*]\s*\[.\]\s/, '');
            } else {
                // Add checkbox prefix
                return prefix + line;
            }
        });
        const newText = toggledLines.join('\n');
        textarea.value =
            originalValue.substring(0, lineStart) +
            newText +
            originalValue.substring(lineEnd);
        textarea.focus();
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart + newText.length;
        return;
    }

    // Toggle for Bold (** **) and Italic (* *)
    if ((prefix === '**' && suffix === '**') || (prefix === '*' && suffix === '*')) {
        // If nothing selected, just insert as usual
        if (!selectedText) {
            const newText = prefix + suffix;
            textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
            return;
        }
        const isBold = prefix === '**';
        const isItalic = prefix === '*';
        const lines = selectedText.split('\n');
        let allWrapped;
        if (isBold) {
            allWrapped = lines.every(line => /^\*\*.*\*\*$/.test(line));
        } else if (isItalic) {
            // Remove italic if line starts and ends with * (but not already only bold)
            allWrapped = lines.every(line => /^\*.*\*$/.test(line));
        }
        let newText;
        if (allWrapped) {
            newText = lines.map(line => {
                if (isBold) {
                    return line.replace(/^\*\*(.*)\*\*$/, '$1');
                }
                if (isItalic) {
                    // Remove only one * from start and end, even if line is ***text***
                    return line.replace(/^\*(.*)\*$/, '$1');
                }
                return line;
            }).join('\n');
        } else {
            newText = lines.map(line => {
                if (!line) return line;
                if (isBold && /^\*\*.*\*\*$/.test(line)) return line; // already bold
                if (isItalic && /^\*.*\*$/.test(line)) return line; // already italic (even if also bold)
                return prefix + line + suffix;
            }).join('\n');
        }
        textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
        textarea.focus();
        textarea.selectionStart = start;
        textarea.selectionEnd = start + newText.length;
        return;
    }

    // Default: original behavior
    const newText = prefix + selectedText + suffix;
    textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
    textarea.focus();
    // Set selection
    if (selectedText) {
        // If text was selected, keep it selected inside the markdown
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + selectedText.length;
    } else {
        // If no text was selected, place cursor in the middle of the markdown
        textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    }
}


// --- Centralized Edit Mode Manager ---
const EditModeManager = {
  currentEditWrapper: null,
  enter(wrapper, key, content, options = {}) {
    if (this.currentEditWrapper && this.currentEditWrapper !== wrapper) {
      this.exit(this.currentEditWrapper);
    }
    this.currentEditWrapper = wrapper;
    const toolbar = document.createElement('div');
    toolbar.className = 'markdown-toolbar';
    let buttons = options.buttons || [
      { icon: 'check-square', action: 'task', title: 'Add Checkbox', md: { prefix: '- [ ] ' } },
      { icon: 'bold', action: 'bold', title: 'Bold', md: { prefix: '**', suffix: '**' } },
      { icon: 'italic', action: 'italic', title: 'Italic', md: { prefix: '*', suffix: '*' } },
      { icon: 'link', action: 'link', title: 'Wiki Link', md: { prefix: '[[', suffix: ']]' } },
      { icon: 'minus', action: 'hr', title: 'Horizontal Rule', md: { prefix: '\n---\n' } },
      { icon: 'hash', action: 'h1', title: 'Heading 1', md: { prefix: '# ' } },
    ];
    // If this is a page view, add extra buttons
    if (key && key.startsWith('page-')) {
      buttons = [
        { icon: 'target', action: 'goal', title: 'Insert GOAL:', md: { prefix: 'GOAL: ' } },
        { icon: 'list', action: 'tasks', title: 'Insert TASKS:', md: { prefix: 'TASKS:\n' } },
        { icon: 'bar-chart-2', action: 'progress', title: 'Insert PROGRESS: []', md: { prefix: 'PROGRESS: []' } },
        { separator: true },
        { icon: 'calendar', action: 'scheduled', title: 'Insert (SCHEDULED: )', md: { prefix: '(SCHEDULED: )' } },
        { icon: 'repeat', action: 'repeat', title: 'Insert (REPEAT: )', md: { prefix: '(REPEAT: )' } },
        { separator: true },
        ...buttons
      ];
    }
    toolbar.innerHTML = buttons.map(btn => {
      if (btn.separator) {
        return '<span class="toolbar-separator" style="display:inline-block;width:1px;height:22px;background:var(--color-border,#eee);margin:0 6px;vertical-align:middle;"></span>';
      }
      return `<button class="toolbar-btn" data-action="${btn.action}" title="${btn.title}">
         <i data-feather="${btn.icon}"></i>
       </button>`;
    }).join('');
    toolbar.querySelectorAll('button').forEach(btn => btn.tabIndex = -1);
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.spellcheck = false;
    wrapper.innerHTML = '';
    wrapper.appendChild(toolbar);
    wrapper.appendChild(textarea);
    if (window.feather) feather.replace();
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
    appState.activeEditorKey = key;
    // Use click event for toolbar buttons for better event order
    toolbar.addEventListener('click', (evt) => {
      const button = evt.target.closest('button');
      if (!button) return;
      evt.preventDefault();
      evt.stopPropagation();
      const action = button.dataset.action;
      const buttonConfig = buttons.find(b => b.action === action);
      if (buttonConfig) {
        insertMarkdown(textarea, buttonConfig.md);
      }
    });
    textarea.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") e.preventDefault();
    });
    setTimeout(() => {
      document.addEventListener('mousedown', handleOutsideClick, true);
    }, 0);
    function handleOutsideClick(ev) {
      // Only exit edit mode if click is truly outside the wrapper and toolbar
      if (wrapper.contains(ev.target)) return;
      const toolbar = wrapper.querySelector('.markdown-toolbar');
      if (toolbar && toolbar.contains(ev.target)) return;
      EditModeManager.exit(wrapper);
    }
    wrapper._exitEditMode = () => {
      setStorage(key, textarea.value);
      appState.activeEditorKey = null;
      document.removeEventListener('mousedown', handleOutsideClick, true);
      if (typeof renderLibraryPage === 'function' && key.startsWith('page-')) {
        renderLibraryPage(key.substring(5));
      } else if (key.match(/^\d{4}-W\d{1,2}-/)) {
        updatePlannerDay(key);
      } else {
        wrapper.innerHTML = parseMarkdown(textarea.value);
      }
      EditModeManager.currentEditWrapper = null;
    };
  },
  exit(wrapper) {
    if (wrapper && wrapper._exitEditMode) {
      wrapper._exitEditMode();
      delete wrapper._exitEditMode;
    }
  }
};


// Centralized click handler for all editable content (library, planner days, notes, future types)
DOM.contentArea.addEventListener('click', (e) => {
  if (e.target.type === 'checkbox') return;
  if (e.target.closest('a, [data-planner-date]')) return;
  const wrapper = e.target.closest('.content-wrapper');
  if (!wrapper || wrapper.querySelector('textarea')) return;
  const key = wrapper.dataset.key;
  if (!key) return;
  const content = getStorage(key);
  EditModeManager.enter(wrapper, key, content);
});


// NOTE: No separate click handler for planner days. All .content-wrapper clicks (pages, planner, notes) are handled by the centralized DOM.contentArea click handler above.

// Handle interactive checkbox clicks globally (planner and content)
document.addEventListener('click', e => {
  if (e.target.type === 'checkbox') {
    // If the checkbox has data-key and data-line-index, update the source page
    const dataKey = e.target.getAttribute('data-key');
    const dataLineIndex = e.target.getAttribute('data-line-index');
    if (dataKey && dataLineIndex !== null) {
      const scheduledDate = e.target.getAttribute('data-scheduled-date');
      const scheduledText = e.target.closest('li,div')?.innerText?.split(' (from ')[0]?.replace(/^[-*]\s*\[[x ]\]\s*/, '').trim();
      const fullText = getStorage(dataKey);
      const lines = fullText.split('\n');
      // Find the correct line by matching both text and normalized date
      function findScheduledLineIndex(lines, text, normalizedDate) {
        for (let idx = 0; idx < lines.length; idx++) {
          const line = lines[idx];
          if (!line.includes(text)) continue;
          const dateMatch = line.match(new RegExp(window.DATE_REGEX_PATTERN));
          const lineNormDate = dateMatch ? window.normalizeDateStringToYyyyMmDd(dateMatch[0]) : null;
          if (lineNormDate === normalizedDate) return idx;
        }
        return -1;
      }
      const idx = findScheduledLineIndex(lines, scheduledText, scheduledDate);
      if (idx === -1) {
        console.warn('Could not find scheduled item line for checkbox', {dataKey, scheduledText, scheduledDate, lines});
        return;
      }
      // Toggle the checkbox in the source line
      lines[idx] = lines[idx].includes('[ ]')
        ? lines[idx].replace('[ ]', '[x]')
        : lines[idx].replace(/\[x\]/i, '[ ]');
      setStorage(dataKey, lines.join('\n'));
      // If this is a library page, re-render with backlinks
      if (typeof renderLibraryPage === 'function' && dataKey.startsWith('page-')) {
        renderLibraryPage(dataKey.substring(5));
      } else {
        updatePlannerDay(key);
        if (appState.currentView === dataKey.replace(/^page-/, '')) {
          renderApp();
        }
      }
      return;
    }

    // Fallback: old logic for normal page checkboxes
    const wrapper = e.target.closest('.content-wrapper');
    let key = wrapper?.dataset.key;
    if (!key && e.target.dataset.key) key = e.target.dataset.key;
    if (!key) return;
    const allCheckboxes = Array.from(wrapper.querySelectorAll('input[type="checkbox"]'));
    const clickedIndex = allCheckboxes.indexOf(e.target);
    if (clickedIndex === -1) return;
    const fullText = getStorage(key);
    const lines = fullText.split('\n');
    let taskItemCounter = -1;
    const newLines = lines.map(line => {
      if (line.trim().match(/^[-*]\s*\[[x ]\]/i)) {
        taskItemCounter++;
        if (taskItemCounter === clickedIndex) {
          const newLine = line.includes('[ ]') ? line.replace('[ ]', '[x]') : line.replace(/\[x\]/i, '[ ]');
          return newLine;
        }
      }
      return line;
    });
    const newText = newLines.join('\n');
    setStorage(key, newText);
    // If this is a library page, re-render with backlinks
    if (typeof renderLibraryPage === 'function' && key.startsWith('page-')) {
      renderLibraryPage(key.substring(5));
    } else {
      wrapper.innerHTML = parseMarkdown(newText);
      updatePlannerDay(key);
    }
    // Optionally: renderApp();
  }
});


// Sidebar and page navigation
DOM.sidebar.addEventListener('click', async (e) => {
  const target = e.target.closest('a,button');
  if (!target) return;
  e.preventDefault();
  const view = target.dataset.view;
  const action = target.dataset.action;
  const page = target.dataset.page;
  if (view) {
    appState.currentView = view;
    renderView();
  } else if (action === 'pin-page' && page) {
    togglePinPage(page);
    renderSidebar();
  } else if (action === 'new-page') {
    const title = await showModal('Create New Page', 'Enter page title...');
    if (title && title.trim()) {
      const key = `page-${title.trim()}`;
      if (!getStorage(key)) {
         setStorage(key, `\n`); // Start with empty content
      }
      appState.currentView = title.trim();
      renderApp();
    }
  } else if (action === 'rename-page' && page) {
    const newTitle = await showModal(`Rename "${page}"`, 'Enter new page title...', page);
    if (newTitle && newTitle.trim() && newTitle.trim() !== page) {
      const oldKey = `page-${page}`;
      const newKey = `page-${newTitle.trim()}`;
      if (!getStorage(newKey)) {
        const content = getStorage(oldKey);
        setStorage(newKey, content);
        localStorage.removeItem(oldKey);
        updateWikiLinks(page, newTitle.trim());
        if (appState.currentView === page) {
          appState.currentView = newTitle.trim();
        }
        // Update pin state if renamed
        let pins = getPinnedPages();
        if (pins.includes(page)) {
          pins = pins.filter(t => t !== page);
          pins.unshift(newTitle.trim());
          setPinnedPages(pins);
        }
        renderApp();
      } else {
        alert("A page with that name already exists.");
      }
    }
  } else if (action === 'delete-page' && page) {
    const confirmed = await showConfirm(`Delete page <strong>"${page}"</strong>? This cannot be undone.`);
    if (confirmed) {
      const key = `page-${page}`;
      localStorage.removeItem(key);
      // Update lastModified timestamp immediately after deletion
      localStorage.setItem('lastModified', new Date().toISOString());
      // Remove from pins if present
      let pins = getPinnedPages();
      if (pins.includes(page)) {
        pins = pins.filter(t => t !== page);
        setPinnedPages(pins);
      }
      if (appState.currentView === page) {
        appState.currentView = 'weekly';
      }
      renderApp();
      // Trigger cloud sync after deletion
      if (typeof syncWithCloud === 'function') {
        syncWithCloud();
      }
    }
  }
});

document.addEventListener('click', (e) => {
  const actionTarget = e.target.closest('[data-action]');
  if (actionTarget) {
    e.preventDefault();
    const action = actionTarget.dataset.action;
    if (action === 'prev-week') appState.currentDate = dateFns.subWeeks(appState.currentDate, 1);
    if (action === 'next-week') appState.currentDate = dateFns.addWeeks(appState.currentDate, 1);
    if (action === 'today') appState.currentDate = new Date();
    renderWeeklyPlanner(true); // ensure scroll to current day on navigation
  }
  // --- Backlink navigation ---
  const plannerLinkTarget = e.target.closest('[data-planner-key]');
  if (plannerLinkTarget) {
    e.preventDefault();
    const plannerKey = plannerLinkTarget.dataset.plannerKey;
    // plannerKey: e.g. '2025-W26-tuesday'
    // Parse week and day, set appState.currentDate to that day, switch to weekly view
    const match = plannerKey.match(/(\d{4})-W(\d{1,2})-([a-z]+)/i);
    if (match && window.dateFns) {
      const [_, year, week, day] = match;
      const weekNum = parseInt(week, 10);
      const yearNum = parseInt(year, 10);
      const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const dayIndex = dayNames.indexOf(day.toLowerCase());
      if (dayIndex !== -1) {
        let start = window.dateFns.startOfISOWeek(window.dateFns.setISOWeek(new Date(yearNum, 0, 4), weekNum));
        let date = window.dateFns.addDays(start, dayIndex);
        appState.currentDate = date;
        appState.currentView = 'weekly';
        renderApp(); // scroll will be handled inside renderWeeklyPlanner
        setTimeout(() => renderWeeklyPlanner(true), 0); // force scroll after navigation
        return;
      }
    }
  }

  // --- Scheduled date navigation ---
  const scheduledLink = e.target.closest('.scheduled-link[data-planner-date]');
  if (scheduledLink) {
    e.preventDefault();
    const dateStr = scheduledLink.dataset.plannerDate;
    if (window.dateFns && dateStr) {
      const date = window.dateFns.parseISO(dateStr);
      if (!isNaN(date)) {
        appState.currentDate = date;
        appState.currentView = 'weekly';
        renderApp();
        setTimeout(() => renderWeeklyPlanner(true), 0);
      }
    }
    return;
  }
  const pageLinkTarget = e.target.closest('[data-page-link]');
  if (pageLinkTarget) {
    e.preventDefault();
    const pageTitle = pageLinkTarget.dataset.pageLink;
    const key = `page-${pageTitle}`;
    if (!getStorage(key)) {
      setStorage(key, `# ${pageTitle}\n\n`);
    }
    appState.currentView = pageTitle;
    renderApp();
  }
});

// Calendar navigation (monthly view)
document.addEventListener('click', (e) => {
  const navTarget = e.target.closest('.calendar-nav a');
  if (navTarget) {
    e.preventDefault();
    const action = navTarget.dataset.action;
    if (action === 'prev-month') goToPreviousMonth();
    if (action === 'next-month') goToNextMonth();
    if (action === 'today-month') goToCurrentMonth();
  }
});

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', async (e) => {
  // Shortcuts should not trigger when an input/textarea is focused,
  // or when a modal is active.
  if (e.target.matches('input, textarea') || DOM.modalOverlay.classList.contains('active')) {
    return;
  }

  // Use Alt for shortcuts to avoid browser conflicts
  const isAlt = e.altKey && !e.ctrlKey && !e.metaKey;

  if (isAlt) {
    switch (e.key.toLowerCase()) {
      // Shortcut: Alt + N for New Page
      case 'n':
        e.preventDefault();
        const title = await showModal('Create New Page', 'Enter page title...');
        if (title && title.trim()) {
          const key = `page-${title.trim()}`;
          if (!getStorage(key)) {
             setStorage(key, `\n`); // Start with empty content
          }
          appState.currentView = title.trim();
          renderApp();
        }
        break;

      // Shortcut: Alt + 1 for Weekly View
      case 't':
        e.preventDefault();
        if (appState.currentView !== 'weekly') {
          appState.currentView = 'weekly';
          renderApp();
        }
        break;

      // Shortcut: Alt + s for Focus the sidebar search input
      case 's':
        e.preventDefault();7
        if (DOM.librarySearch) {
          DOM.librarySearch.focus();
        }
        break;
    }
  }
});
