// --- START OF FILE events.js (Corrected) ---

// --- MOBILE SIDEBAR TOGGLE ---
let swipeListenersAttached = false;
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

  // --- GESTURE LISTENERS (run once) ---
  if (!swipeListenersAttached) {
    // --- Calendar Swipe Gestures ---
    const calendarView = document.getElementById('monthly-calendar-view');
    if (calendarView) {
        addSwipeListeners(calendarView,
            () => goToNextMonth(),    // Swipe Left
            () => goToPreviousMonth() // Swipe Right
        );
    }

    // --- Planner Swipe Gestures ---
    const plannerGrid = document.getElementById('plan-grid-container');
    if (plannerGrid) {
        addSwipeListeners(plannerGrid,
            () => goToNextDay(),    // Swipe Left
            () => goToPreviousDay() // Swipe Right
        );
    }

    swipeListenersAttached = true;
  }
});

// --- SWIPE GESTURE HELPER ---
function addSwipeListeners(element, onSwipeLeft, onSwipeRight) {
    let touchstartX = 0;
    let touchendX = 0;
    const swipeThreshold = 50; // minimum distance for a swipe in pixels

    element.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, { passive: true });

    element.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        const deltaX = touchendX - touchstartX;
        if (Math.abs(deltaX) < swipeThreshold) return; // not a swipe
        if (touchendX < touchstartX) onSwipeLeft();   // Swiped left
        if (touchendX > touchstartX) onSwipeRight();  // Swiped right
    }, { passive: true });
}

// Debounced version of syncWithCloud
const debouncedSyncWithCloud = debounce(() => {
  if (typeof syncWithCloud === 'function') syncWithCloud();
  console.log('Debounced syncing with cloud...');
}, 3000); // 3 seconds debounce

// --- EVENT HANDLERS ---
// Library search
DOM.librarySearch.addEventListener('input', renderSidebar);

// Helper function to insert markdown syntax into a textarea
function insertMarkdown(textarea, { prefix, suffix = '' }) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalValue = textarea.value;
    const selectedText = originalValue.substring(start, end);

    if (prefix === '- [ ] ') {
        const lineStart = originalValue.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = originalValue.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = originalValue.length;
        const lines = originalValue.substring(lineStart, lineEnd).split('\n');
        const toggledLines = lines.map(line => {
            if (/^[-*]\s*\[.\]\s/.test(line)) {
                return line.replace(/^[-*]\s*\[.\]\s/, '');
            } else {
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

    if ((prefix === '**' && suffix === '**') || (prefix === '*' && suffix === '*')) {
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
            allWrapped = lines.every(line => /^\*.*\*$/.test(line));
        }
        let newText;
        if (allWrapped) {
            newText = lines.map(line => {
                if (isBold) {
                    return line.replace(/^\*\*(.*)\*\*$/, '$1');
                }
                if (isItalic) {
                    return line.replace(/^\*(.*)\*$/, '$1');
                }
                return line;
            }).join('\n');
        } else {
            newText = lines.map(line => {
                if (!line) return line;
                if (isBold && /^\*\*.*\*\*$/.test(line)) return line;
                if (isItalic && /^\*.*\*$/.test(line)) return line;
                return prefix + line + suffix;
            }).join('\n');
        }
        textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
        textarea.focus();
        textarea.selectionStart = start;
        textarea.selectionEnd = start + newText.length;
        return;
    }

    const newText = prefix + selectedText + suffix;
    textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
    textarea.focus();
    if (selectedText) {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + selectedText.length;
    } else {
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
    if (key && key.startsWith('page-')) {
      buttons = [
        { icon: 'target', action: 'goal', title: 'Insert GOAL:', md: { prefix: 'GOAL: ' } },
        { icon: 'list', action: 'tasks', title: 'Insert TASKS:', md: { prefix: 'TASKS:\n' } },
        { icon: 'bar-chart-2', action: 'progress', title: 'Insert PROGRESS: []', md: { prefix: 'PROGRESS: []' } },
        { separator: true },
        { icon: 'clock', action: 'scheduled', title: 'Insert (SCHEDULED: )', md: { prefix: '(SCHEDULED: )' } },
        { icon: 'repeat', action: 'repeat', title: 'Insert (REPEAT: )', md: { prefix: '(REPEAT: )' } },
        { icon: 'bell', action: 'notify', title: 'Insert (NOTIFY: )', md: { prefix: '(NOTIFY: )' } },
        { separator: true },
        { icon: 'calendar', action: 'custom-date', title: 'Insert Date/Time', md: null },
        { separator: true },
        ...buttons
      ];
    }

    // Split buttons into two rows (customize the split as you like)
    const row1 = buttons.slice(0, 10); // first 10 buttons (or however you want to split)
    const row2 = buttons.slice(10);

    function renderRow(row) {
      return `<div class="toolbar-row">` +
        row.map(btn => {
          if (btn.separator) {
            return '<span class="toolbar-separator" style="display:inline-block;width:1px;height:22px;background:var(--color-border,#eee);margin:0 6px;vertical-align:middle;"></span>';
          }
          return `<button class="toolbar-btn" data-action="${btn.action}" title="${btn.title}">
            <i data-feather="${btn.icon}"></i>
          </button>`;
        }).join('') +
        `</div>`;
    }

    toolbar.innerHTML = renderRow(row1) + renderRow(row2);

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
    toolbar.addEventListener('click', (evt) => {
      const button = evt.target.closest('button');
      if (!button) return;
      evt.preventDefault();
      evt.stopPropagation();
      const action = button.dataset.action;
      const buttonConfig = buttons.find(b => b.action === action);
      if (action === 'custom-date') {
        // Show custom date picker (withTime toggle)
        window.showDateTimePicker({ withTime: false }).then(result => {
          if (result && result.date) {
            let insertText = result.date;
            if (result.withTime && result.time) insertText += ' ' + result.time;
            // Insert as yyyy-mm-dd [hh:mm] at cursor
            insertMarkdown(textarea, { prefix: `${insertText}` });
            textarea.focus();
          }
        });
        return;
      }
      if (buttonConfig && buttonConfig.md) {
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
      if (wrapper.contains(ev.target)) return;
      const toolbar = wrapper.querySelector('.markdown-toolbar');
      if (toolbar && toolbar.contains(ev.target)) return;
      EditModeManager.exit(wrapper);
    }
    wrapper._exitEditMode = () => {
      const prevValue = getStorage(key);
      const newValue = textarea.value;
      // Only save and sync if content changed
      if (prevValue !== newValue) {
        setStorage(key, newValue);
        debouncedSyncWithCloud();
      }
      appState.activeEditorKey = null;
      document.removeEventListener('mousedown', handleOutsideClick, true);
      if (typeof renderLibraryPage === 'function' && key.startsWith('page-')) {
        renderLibraryPage(key.substring(5));
      } else if (key.match(/^\d{4}-W\d{1,2}-/)) {
        updatePlannerDay(key);
      } else {
        wrapper.innerHTML = parseMarkdown(newValue);
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


// Centralized click handler for all editable content
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

// Handle interactive checkbox clicks globally
document.addEventListener('click', e => {
  if (e.target.type === 'checkbox') {
    const dataKey = e.target.getAttribute('data-key');
    const dataLineIndex = e.target.getAttribute('data-line-index');
    if (dataKey && dataLineIndex !== null) {
      const scheduledDate = e.target.getAttribute('data-scheduled-date');
      const scheduledText = e.target.closest('li,div')?.innerText?.split(' (from ')[0]?.replace(/^[-*]\s*\[[x ]\]\s*/, '').trim();
      const fullText = getStorage(dataKey);
      const lines = fullText.split('\n');
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
        return;
      }
      lines[idx] = lines[idx].includes('[ ]')
        ? lines[idx].replace('[ ]', '[x]')
        : lines[idx].replace(/\[x\]/i, '[ ]');
      setStorage(dataKey, lines.join('\n'));
      // --- FIX: TRIGGER SYNC AFTER CHECKING BOX ---
      debouncedSyncWithCloud();
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
    // --- FIX: TRIGGER SYNC AFTER CHECKING BOX ---
    debouncedSyncWithCloud();
    if (typeof renderLibraryPage === 'function' && key.startsWith('page-')) {
      renderLibraryPage(key.substring(5));
    } else {
      wrapper.innerHTML = parseMarkdown(newText);
      updatePlannerDay(key);
    }
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
         setStorage(key, `\n`);
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
        // --- FIX: CORRECT RENAME LOGIC ---
        // 1. Get content BEFORE deleting the old key.
        const content = getStorage(oldKey);
        // 2. Create the new page with the content.
        setStorage(newKey, content);
        // 3. Now remove the old page.
        localStorage.removeItem(oldKey);
        
        updateWikiLinks(page, newTitle.trim());
        
        let pins = getPinnedPages();
        const wasPinned = pins.includes(page);
        if (wasPinned) {
          pins = pins.filter(t => t !== page);
          pins.push(newTitle.trim());
          setPinnedPages(pins);
        }
        
        if (appState.currentView === page) {
          appState.currentView = newTitle.trim();
        }
        renderApp();
        debouncedSyncWithCloud();
      } else {
        alert("A page with that name already exists.");
      }
    }
  } else if (action === 'delete-page' && page) {
    const confirmed = await showConfirm(`Delete page <strong>"${page}"</strong>? This cannot be undone.`);
    if (confirmed) {
      const key = `page-${page}`;
      deleteStorage(key);
      let pins = getPinnedPages();
      if (pins.includes(page)) {
        pins = pins.filter(t => t !== page);
        setPinnedPages(pins);
      }
      if (appState.currentView === page) {
        appState.currentView = 'weekly';
      }
      renderApp();
      // --- FIX: TRIGGER SYNC AFTER DELETION ---
      debouncedSyncWithCloud();
    }
  }
});

// --- Centralized Click Handler for Navigation and Links ---
document.addEventListener('click', async (e) => {
   // Scheduled date links (from (SCHEDULED: ...) or (NOTIFY: ...))
  let scheduledLink = e.target.closest('.scheduled-link') || e.target.closest('[data-planner-date]');
  if (scheduledLink) {
    e.preventDefault();
    let dateStr = scheduledLink.dataset.plannerDate;
    if (!dateStr && scheduledLink.getAttribute('data-planner-date')) {
      dateStr = scheduledLink.getAttribute('data-planner-date');
    }
    if (dateStr) {
      const dateObj = window.parseDateString(dateStr);
      if (dateObj && !isNaN(dateObj)) {
        appState.currentView = 'weekly';
        appState.currentDate = dateObj;
        renderApp();
      }
    }
    return;
  }

  // Wiki-links (from [[Page]])
  let pageLink = e.target.closest('[data-page-link]');
  if (pageLink) {
    e.preventDefault();
    let pageTitle = pageLink.dataset.pageLink;
    if (!pageTitle && pageLink.getAttribute('data-page-link')) {
      pageTitle = pageLink.getAttribute('data-page-link');
    }
    if (pageTitle) {
      appState.currentView = pageTitle;
      renderApp();
    }
    return;
  }
  // Calendar Navigation (Monthly)
  const navTarget = e.target.closest('.calendar-nav a');
  if (navTarget) {
    e.preventDefault();
    const action = navTarget.dataset.action;
    if (action === 'prev-month') goToPreviousMonth();
    if (action === 'next-month') goToNextMonth();
    if (action === 'today-month') goToCurrentMonth();
    return; // Action handled
  }
  // Planner Navigation (Weekly)
  const plannerNavTarget = e.target.closest('.planner-nav a[data-action], .planner-nav button[data-action]');
  if (plannerNavTarget) {
    e.preventDefault();
    const action = plannerNavTarget.dataset.action;
    if (action === 'prev-week') {
      goToPreviousWeek();
    } else if (action === 'next-week') {
      goToNextWeek();
    } else if (action === 'today') {
      appState.currentDate = new Date();
      renderWeeklyPlanner(true);
      return;
    }
    return; // Action handled
  }

  // Link to a specific planner day (from backlinks)
  const plannerLinkTarget = e.target.closest('[data-planner-key]');
  if (plannerLinkTarget) {
    e.preventDefault();
    const plannerKey = plannerLinkTarget.dataset.plannerKey;
    const match = plannerKey.match(/(\d{4})-W(\d{1,2})-([a-z]+)/i);

  if (e.target.matches('input, textarea') || DOM.modalOverlay.classList.contains('active')) {
    return;
  }

  const isAlt = e.altKey && !e.ctrlKey && !e.metaKey;

  if (isAlt) {
    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        const title = await showModal('Create New Page', 'Enter page title...');
        if (title && title.trim()) {
          const key = `page-${title.trim()}`;
          if (!getStorage(key)) {
             setStorage(key, `\n`);
          }
          appState.currentView = title.trim();
          renderApp();
        }
        break;
      case 't':
        e.preventDefault();
        if (appState.currentView !== 'weekly') {
          appState.currentView = 'weekly';
          renderApp();
        }
        break;
      case 's':
        e.preventDefault();
        if (DOM.librarySearch) {
          DOM.librarySearch.focus();
        }
        break;
    }
  }
  }
});
