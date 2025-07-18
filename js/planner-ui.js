// --- Flag to prevent scroll event conflicts ---
let isProgrammaticScroll = false;
const microAdjust = 25;

function goToNextDay() {
  if (window.innerWidth > 768) return;
  const grid = document.getElementById('plan-grid-container');
  if (!grid) return;
  const centered = getCenteredPlannerNote(grid);
  if (!centered) return;
  const notes = Array.from(grid.querySelectorAll('.planner-note'));
  const idx = notes.indexOf(centered);
  if (idx === -1 || idx === notes.length - 1) return;
  const next = notes[idx + 1];
  if (next) {
    const noteCenter = next.offsetLeft + next.offsetWidth / 2;
    const gridWidth = grid.clientWidth;
    const targetScrollLeft = noteCenter - gridWidth / 2 - microAdjust;
    isProgrammaticScroll = true;
    grid.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    setTimeout(() => { isProgrammaticScroll = false; }, 700);
  }
}

/**
 * Navigates to the previous day in the planner. If it crosses a week boundary,
 * it re-renders the planner. Otherwise, it just scrolls.
 */

function goToPreviousDay() {
  if (window.innerWidth > 768) return;
  const grid = document.getElementById('plan-grid-container');
  if (!grid) return;
  const centered = getCenteredPlannerNote(grid);
  if (!centered) return;
  const notes = Array.from(grid.querySelectorAll('.planner-note'));
  const idx = notes.indexOf(centered);
  if (idx <= 0) return;
  const prev = notes[idx - 1];
  if (prev) {
    const noteCenter = prev.offsetLeft + prev.offsetWidth / 2;
    const gridWidth = grid.clientWidth;
    const targetScrollLeft = noteCenter - gridWidth / 2 - microAdjust;
    isProgrammaticScroll = true;
    grid.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
    setTimeout(() => { isProgrammaticScroll = false; }, 700);
  }
}

/**
 * Navigates the planner to the previous week and re-renders.
 */
function goToPreviousWeek() {
  appState.currentDate = dateFns.subWeeks(appState.currentDate, 1);
  renderWeeklyPlanner(false);
  setTimeout(() => {
    scrollToMonday();
  }, 200);
}

/**
 * Navigates the planner to the next week and re-renders.
 */
function goToNextWeek() {
  appState.currentDate = dateFns.addWeeks(appState.currentDate, 1);
  renderWeeklyPlanner(false);
  setTimeout(() => {
    scrollToMonday();
  }, 200);
}

// Helper to scroll to Monday after week change
function scrollToMonday() {
  const grid = document.getElementById('plan-grid-container');
  if (!grid) return;
  const notes = Array.from(grid.querySelectorAll('.planner-note'));
  if (notes.length === 0) return;
  const first = notes[0];
  const noteCenter = first.offsetLeft + first.offsetWidth / 2;
  const targetScrollLeft = noteCenter - grid.clientWidth / 2 - microAdjust;
  isProgrammaticScroll = true;
  grid.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
  setTimeout(() => { isProgrammaticScroll = false; }, 700);
}

function renderWeeklyPlanner(scrollToToday = false) {
  // --- Preserve scroll positions ---
  const scrollPositions = {};
  document.querySelectorAll('.content-wrapper[data-key]').forEach(el => {
    scrollPositions[el.dataset.key] = el.scrollTop;
  });
  
  // --- Preserve checkbox states ---
  const checkboxStates = {};
  document.querySelectorAll('.task-metadata').forEach(metadataSpan => {
    const pageKey = metadataSpan.getAttribute('data-key');
    const lineIdx = metadataSpan.getAttribute('data-line-index');
    if (pageKey && lineIdx) {
      const checkbox = metadataSpan.previousElementSibling;
      if (checkbox && checkbox.type === 'checkbox') {
        const stateKey = `${pageKey}-${lineIdx}`;
        checkboxStates[stateKey] = checkbox.checked;
      }
    }
  });

  const weekKey = getWeekKey(appState.currentDate);
  const startOfWeek = dateFns.startOfISOWeek(appState.currentDate);
  const endOfWeek = dateFns.endOfISOWeek(appState.currentDate);
  DOM.plannerTitle.textContent = `${dateFns.format(startOfWeek, 'MMM d')} - ${dateFns.format(endOfWeek, 'MMM d, yyyy')}`;
  DOM.plannerGrid.innerHTML = '';
  const today = new Date();
  const todayDayIndex = dateFns.getISODay(today) - 1;
  const isCurrentWeek = getWeekKey(today) === weekKey;

  const allScheduled = getAllScheduledItems();

  PLANNER_BOXES.forEach((box, index) => {
    const key = `${weekKey}-${box.id}`;
    let content = getStorage(key);
    // Remove any previous **Scheduled Items** section to avoid duplicates and stale state
    content = content.replace(/\n?\*\*Scheduled Items\*\*[\s\S]*?(?=\n{2,}|$)/, '').trim();
    const isToday = isCurrentWeek && (box.id !== 'weekend' ? index === todayDayIndex : todayDayIndex >= 5);

    const dayDate = dateFns.addDays(startOfWeek, index);
    const dayDateStr = dateFns.format(dayDate, 'yyyy-MM-dd');

    // --- Build scheduled/repeat items section using the helper function ---
    const scheduledBlock = buildScheduledItemsHtml(dayDateStr, allScheduled);
    const promptBlock = buildPromptItemsHtml(dayDateStr);

    // --- Parse user content ---
    let parsed = parseMarkdown(content);
    let parsedClean = `<div class="rendered-content">${parsed}</div>`;
    if (typeof window !== 'undefined') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = parsedClean;
      parsedClean = tempDiv.innerHTML;
    }

    // --- Always render promptBlock as a persistent section inside content-wrapper, with blockquote styling ---
    let promptSection = '';
    if (promptBlock) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = promptBlock;
      const quotes = Array.from(tempDiv.querySelectorAll('.prompt-content')).map(q => `<blockquote><span class="prompt-icon">❝</span> ${q.innerHTML} <span class="prompt-icon">❞</span></blockquote>`).join('');
      promptSection = `<div class="prompt-section">${quotes}</div>`;
    }
    const noteEl = document.createElement('div');
    noteEl.className = `planner-note ${box.class}`;
    noteEl.dataset.key = key;
    noteEl.dataset.istoday = isToday;
    const dateString = `<span>${dateFns.format(dayDate, 'd.M')}</span>`;
    noteEl.innerHTML = `
      <div class="heading">${box.title} ${dateString}</div>
      <div class="content-wrapper" data-key="${key}">
       ${promptSection}
       ${parsedClean}
       ${scheduledBlock}
      </div>
    `;
    DOM.plannerGrid.appendChild(noteEl);

    // --- Restore scroll position immediately after appending ---
    const contentWrapper = noteEl.querySelector('.content-wrapper[data-key]');
    if (contentWrapper && scrollPositions[contentWrapper.dataset.key] !== undefined) {
      contentWrapper.scrollTop = scrollPositions[contentWrapper.dataset.key];
    }

    // Attach our improved checkbox handler instead of using the inline handler
    attachPlannerCheckboxHandler(contentWrapper, key, content);
  });
  
  // --- Restore checkbox states after rendering ---
  setTimeout(() => {
    document.querySelectorAll('.task-metadata').forEach(metadataSpan => {
      const pageKey = metadataSpan.getAttribute('data-key');
      const lineIdx = metadataSpan.getAttribute('data-line-index');
      if (pageKey && lineIdx) {
        const stateKey = `${pageKey}-${lineIdx}`;
        
        if (stateKey in checkboxStates) {
          // Find associated checkbox and set its state
          const checkbox = metadataSpan.previousElementSibling;
          if (checkbox && checkbox.type === 'checkbox') {
            checkbox.checked = checkboxStates[stateKey];
          }
        } else {
          // If state wasn't saved, check the source content
          const pageContent = getStorage(pageKey);
          if (pageContent) {
            const lines = pageContent.split('\n');
            if (lines[lineIdx] && lines[lineIdx].includes('[x]')) {
              const checkbox = metadataSpan.previousElementSibling;
              if (checkbox && checkbox.type === 'checkbox') {
                checkbox.checked = true;
              }
            }
          }
        }
      }
    });
  }, 0);

  // Only scroll to the current day if requested
  if (scrollToToday) {
    setTimeout(scrollToCurrentPlannerDay, 200); // Ensure DOM is ready
  }
  // Enable carousel snap-to-center after manual scroll (only needs to be attached once)
  if (window.innerWidth <= 768 && !window.plannerSnapInitialized) {
    enablePlannerSnapToCenter();
    window.plannerSnapInitialized = true;
  }
}

// --- Snap to center after manual scroll on mobile ---
// --- Carousel-style snap and state update logic ---
function getCenteredPlannerNote(grid) {
  // Returns the .planner-note element closest to the center of the grid
  const gridWidth = grid.clientWidth;
  const gridCenter = grid.scrollLeft + gridWidth / 2;
  let minDist = Infinity;
  let closest = null;
  grid.querySelectorAll('.planner-note').forEach(note => {
    const noteCenter = note.offsetLeft + note.offsetWidth / 2;
    const dist = Math.abs(gridCenter - noteCenter);
    if (dist < minDist) {
      minDist = dist;
      closest = note;
    }
  });
  return closest;
}

function enablePlannerSnapToCenter() {
  const grid = document.getElementById('plan-grid-container');
  if (!grid) return;
  let scrollTimeout;
  let lastCenteredKey = null;

  grid.addEventListener('scroll', () => {
    if (isProgrammaticScroll) return;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      // Snap to the closest note only (no week change logic)
      const centered = getCenteredPlannerNote(grid);
      if (centered) {
        const noteCenter = centered.offsetLeft + centered.offsetWidth / 2;
        const gridWidth = grid.clientWidth;
        const targetScrollLeft = noteCenter - gridWidth / 2 - microAdjust;
        isProgrammaticScroll = true;
        grid.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
        setTimeout(() => {
          isProgrammaticScroll = false;
          // After snap, update appState.currentDate if the centered note changed
          const newKey = centered.dataset.key;
          if (newKey && newKey !== lastCenteredKey) {
            lastCenteredKey = newKey;
            // Parse date from key
            const parts = newKey.split('-');
            const weekKey = parts.slice(0, -1).join('-');
            const boxId = parts[parts.length - 1];
            const weekStart = window.dateFns.startOfISOWeek(appState.currentDate);
            const boxIdx = PLANNER_BOXES.findIndex(b => b.id === boxId);
                      }
        }, 700);
      }
    }, 120);
  });
}

function scrollToCurrentPlannerDay(smooth = true) {
  // Only scroll on mobile (or always, if desired)
  if (window.innerWidth > 768) return;
  const grid = document.getElementById('plan-grid-container');
  if (!grid) return;
  // Find the plannerKey for the current date
  const weekKey = getWeekKey(appState.currentDate);
  const dayIndex = dateFns.getISODay(appState.currentDate) - 1;
  const box = PLANNER_BOXES[dayIndex];
  if (!box) return;
  const plannerKey = `${weekKey}-${box.id}`;
  const note = grid.querySelector(`[data-key="${plannerKey}"]`);
  if (note) {
    // Use positions relative to the grid's scroll area, not viewport
    const gridWidth = grid.clientWidth;
    const noteLeft = note.offsetLeft;
    const noteWidth = note.offsetWidth;

    // Otherwise, center the note
    const noteCenter = noteLeft + noteWidth / 2;
    // Use a slightly larger micro-adjustment for more reliable centering
    isProgrammaticScroll = true; // Set flag to prevent snap-to-center from interfering
    grid.scrollTo({ left: noteCenter - gridWidth / 2 - microAdjust, behavior: 'smooth' });
    setTimeout(() => { isProgrammaticScroll = false; }, 700); // Reset flag after animation (longer)
  }
}

function buildPromptItemsHtml(dateStr) {
  let html = '';
  const todayStr = dateFns.format(new Date(), 'yyyy-MM-dd');
  const dayDate = new Date(dateStr + 'T00:00:00');

  // Get all prompt definitions from all pages in localStorage (keys starting with page-)
  let allPrompts = [];
  // Match until next PROMPT, double newline, or empty line
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('page-')) {
      const pageContent = localStorage.getItem(key) || '';
      // Split by PROMPT blocks
      const blocks = pageContent.split(/^(?=PROMPT)/m).filter(Boolean);
      blocks.forEach(block => {
        const promptMatch = block.match(/^PROMPT(?:\(([^)]*)\))?:\s*([\s\S]*)/i);
        if (promptMatch) {
          let attributesStr = promptMatch[1] || '';
          // Capture all lines until next PROMPT, double newline, or empty line
          let textLines = [];
          const lines = promptMatch[2].split('\n');
          for (let line of lines) {
            if (/^PROMPT/.test(line) || line.trim() === '') break;
            textLines.push(line);
          }
          let text = textLines.join('\n').trim();
          let attributes = {};
          if (attributesStr) {
            attributesStr.split(',').forEach(part => {
              const [key, value] = part.split(':').map(s => s.trim());
              if (key && value) attributes[key] = value;
            });
          }
          allPrompts.push({ text, attributes });
        }
      });
    }
  });

  allPrompts.forEach(prompt => {
    const text = prompt.text;
    const attributes = prompt.attributes;
    // Use centralized prompt selection logic
    let promptText = (window.getPromptForDate || getPromptForDate)(text, attributes, dayDate);
    if (promptText) {
      html += `<div class=\"prompt-widget\"><div class=\"prompt-content\">${promptText}</div></div>`;
    }
  });
  return todayStr === dateStr && html ? `<div class=\"prompt-section\">${html}</div>` : '';
}


// Attach checkbox event logic to a contentWrapper for a given key and content
function attachPlannerCheckboxHandler(contentWrapper, key, content) {
  if (!contentWrapper) return;
  
  // Use mousedown instead of click to ensure first interaction works
  const allCheckboxes = contentWrapper.querySelectorAll('input[type="checkbox"]');
  allCheckboxes.forEach(checkbox => {
    // Remove any existing event listeners to avoid duplicates
    checkbox.removeEventListener('click', checkboxClickHandler);
    checkbox.removeEventListener('mousedown', checkboxMousedownHandler);
    checkbox.removeEventListener('change', checkboxChangeHandler);
    
    // Add mousedown handler to prevent default behavior and capture scroll position
    checkbox.addEventListener('mousedown', checkboxMousedownHandler);
    
    // Add click handler to manage the checkbox state
    checkbox.addEventListener('click', checkboxClickHandler);
    
    // Add change handler as a backup
    checkbox.addEventListener('change', checkboxChangeHandler);
  });
  
  function checkboxMousedownHandler(e) {
    // Store current scroll position in multiple ways to ensure it's preserved
    const wrapper = this.closest('.content-wrapper');
    if (wrapper) {
      // Store in dataset for potential use by other handlers
      wrapper.dataset.lastScrollTop = wrapper.scrollTop;
      
      // Also store in a closure variable that will be available to this handler's context
      const savedScrollTop = wrapper.scrollTop;
      
      // Set a timeout to restore scroll position
      setTimeout(() => {
        if (wrapper.scrollTop !== savedScrollTop) {
          wrapper.scrollTop = savedScrollTop;
        }
      }, 0);
    }
    
    // Stop propagation but don't prevent default so the checkbox can still toggle
    e.stopPropagation();
  }
  
  function checkboxClickHandler(e) {
    // Prevent default browser behavior and stop propagation
    e.stopPropagation();
    
    // Store the current scroll position immediately
    const wrapper = this.closest('.content-wrapper');
    const scrollTop = wrapper ? wrapper.scrollTop : 0;
    
    // Store the new checkbox state
    const newState = this.checked;
    
    // Get the checkbox's unique ID
    const checkboxId = this.id;
    
    // Find the metadata span next to this checkbox
    let metadataSpan = this.nextElementSibling;
    while (metadataSpan && (!metadataSpan.classList || !metadataSpan.classList.contains('task-metadata'))) {
      metadataSpan = metadataSpan.nextElementSibling;
    }
    
    // If metadata found, update the source document
    if (metadataSpan) {
      // Capture the key to update planner view later
      const pageKey = metadataSpan.getAttribute('data-key');
      const scheduledDate = metadataSpan.getAttribute('data-scheduled-date');
      
      // Update the source document
      updateSourceFromCheckbox(this, metadataSpan, newState);
      
      // If this is coming from a planner note, update that specific day too
      if (wrapper && wrapper.dataset.key) {
        const plannerKey = wrapper.dataset.key;
        // Only update if not already handling through updateSourceFromCheckbox
        if (!pageKey.startsWith('page-')) {
          updatePlannerDay(plannerKey);
        }
      }
    }
    
    // Restore scroll position immediately and after a brief delay (to ensure it works)
    if (wrapper) {
      wrapper.scrollTop = scrollTop;
      setTimeout(() => {
        wrapper.scrollTop = scrollTop;
      }, 0);
      
      // And one more time after rendering would be complete
      setTimeout(() => {
        wrapper.scrollTop = scrollTop;
      }, 50);
    }
  }
  
  function checkboxChangeHandler(e) {
    // This is a backup handler in case the click event doesn't fire
    const newState = this.checked;
    
    // Store the current scroll position
    const wrapper = this.closest('.content-wrapper');
    const scrollTop = wrapper ? wrapper.scrollTop : 0;
    
    // Find the closest metadata span
    let metadataSpan = this.nextElementSibling;
    while (metadataSpan && (!metadataSpan.classList || !metadataSpan.classList.contains('task-metadata'))) {
      metadataSpan = metadataSpan.nextElementSibling;
    }
    
    // If metadata found, update the source
    if (metadataSpan) {
      // Capture the key to update planner view later
      const pageKey = metadataSpan.getAttribute('data-key');
      
      updateSourceFromCheckbox(this, metadataSpan, newState);
      
      // If this is coming from a planner note, update that specific day too
      if (wrapper && wrapper.dataset.key) {
        const plannerKey = wrapper.dataset.key;
        // Only update if not already handling through updateSourceFromCheckbox
        if (!pageKey.startsWith('page-')) {
          updatePlannerDay(plannerKey);
        }
      }
    }
    
    // Restore scroll position
    if (wrapper) {
      wrapper.scrollTop = scrollTop;
      
      // And again after a brief delay to ensure it works
      setTimeout(() => {
        wrapper.scrollTop = scrollTop;
      }, 50);
    }
  }
  
  // Helper function to update source content from checkbox change
  function updateSourceFromCheckbox(checkbox, metadataSpan, newState) {
    const pageKey = metadataSpan.getAttribute('data-key');
    const lineIdx = metadataSpan.getAttribute('data-line-index');
    
    if (pageKey && lineIdx) {
      // Update the source document
      let pageContent = getStorage(pageKey);
      let lines = pageContent.split('\n');
      
      // Make sure the line exists and is a checkbox
      if (lines[lineIdx]) {
        let match = lines[lineIdx].match(/^([-*])\s*\[( |x)\]\s*(.*)$/i);
        if (match) {
          let lineText = match[3].replace(/\s*(\(REPEAT:[^)]+\))?\s*(\(SCHEDULED:[^)]+\))?\s*$/, '').trim();
          let repeatTag = (lines[lineIdx].match(/\(REPEAT:[^)]+\)/) || [''])[0];
          let schedTag = (lines[lineIdx].match(/\(SCHEDULED:[^)]+\)/) || [''])[0];
          
          // Update the line with the new checkbox state
          lines[lineIdx] = `${match[1]} [${newState ? 'x' : ' '}] ${lineText}`
            + (schedTag ? ' ' + schedTag : '')
            + (repeatTag ? ' ' + repeatTag : '');
            
          // Save the updated content
          setStorage(pageKey, lines.join('\n'));
          
          // Trigger cloud sync
          if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
          }
          
          // Make sure the checkbox reflects the correct state
          checkbox.checked = newState;
          
          // Get the current scroll position before updating other checkboxes
          const wrapper = checkbox.closest('.content-wrapper');
          const scrollTop = wrapper ? wrapper.scrollTop : 0;
          
          // Only update checkboxes with the same metadata (same task)
          document.querySelectorAll('.task-metadata').forEach(span => {
            if (span.getAttribute('data-key') === pageKey && 
                span.getAttribute('data-line-index') === lineIdx &&
                span !== metadataSpan) {
              const nearbyCheckbox = span.previousElementSibling;
              if (nearbyCheckbox && nearbyCheckbox.type === 'checkbox') {
                nearbyCheckbox.checked = newState;
              }
            }
          });
          
          // If this checkbox is in a library page, trigger a render of that page
          if (pageKey.startsWith('page-')) {
            const pageName = pageKey.substring(5);
            if (typeof renderLibraryPage === 'function') {
              renderLibraryPage(pageName);
            }
          }
          
          // Restore the scroll position
          if (wrapper) {
            wrapper.scrollTop = scrollTop;
          }
        }
      }
    }
  }
  
  // Add a new content-level change handler for plain text checkboxes
  // (those without task-metadata spans, which are part of the note content itself)
  contentWrapper.addEventListener('change', function(e) {
    if (e.target && e.target.type === 'checkbox') {
      // Store the current scroll position immediately
      const wrapper = this;
      const scrollTop = wrapper.scrollTop;
      
      // First check if this checkbox has an associated metadata span
      let metadataSpan = null;
      
      // Try to find the metadata span that belongs to this checkbox
      if (e.target.parentNode) {
        // First check if it's a direct sibling
        let sibling = e.target.nextElementSibling;
        while (sibling) {
          if (sibling.classList && sibling.classList.contains('task-metadata')) {
            metadataSpan = sibling;
            break;
          }
          sibling = sibling.nextElementSibling;
        }
        
        // If not found as a direct sibling, look for it in nearby elements
        if (!metadataSpan) {
          // First check if there's a metadata span as a direct child of the parent
          metadataSpan = e.target.parentNode.querySelector('.task-metadata');
          
          // Get the parent li element if exists
          const liElement = e.target.closest('li');
          if (liElement && !metadataSpan) {
            metadataSpan = liElement.querySelector('.task-metadata');
          }
          
          // Check the parent label if it's a label element
          const labelElement = e.target.closest('label');
          if (labelElement && !metadataSpan) {
            metadataSpan = labelElement.querySelector('.task-metadata');
          }
          
          // Still not found, try to find it in nearby elements
          if (!metadataSpan) {
            // Find the next element that might contain our metadata
            let nextEl = e.target.parentNode.nextElementSibling;
            while (nextEl && !metadataSpan) {
              metadataSpan = nextEl.querySelector('.task-metadata');
              nextEl = nextEl.nextElementSibling;
            }
          }
        }
      }
      
      // If we found a metadata span, this is a scheduled item checkbox and we'll handle it specially
      if (metadataSpan) {
        const pageKey = metadataSpan.getAttribute('data-key');
        const lineIdx = metadataSpan.getAttribute('data-line-index');
        
        if (pageKey && lineIdx !== null) {
          const newState = e.target.checked;
          
          // Use our updateSourceFromCheckbox helper which handles cloud sync too
          updateSourceFromCheckbox(e.target, metadataSpan, newState);
        }
      }
      // Otherwise, this is a regular checkbox in the note content
      else {
        let checkboxText = e.target.parentNode ? e.target.parentNode.textContent.trim() : '';
        
        // Clean up the text by removing the time prefix, checkbox marker, and other decorations
        // Format is now "HH:MM: - [ ] Item text (from [[Page]])"
        checkboxText = checkboxText.replace(/^\d{1,2}:\d{2}:\s*/, '')  // Remove time prefix if present
                                .replace(/^All Day:\s*/, '')           // Remove "All Day:" prefix if present
                                .replace(/^\[.\]\s*/, '')              // Remove checkbox marker
                                .replace(/^\s*-\s*/, '')               // Remove list marker
                                .replace(/\s*\(from \[\[[^\]]+\]\]\)/, '') // Remove source reference
                                .trim();
                                  
        // Try to extract the scheduled date/time tag from the label (if present)
        let schedTagMatch = checkboxText.match(/\(SCHEDULED:[^)]+\)/i);
        let schedTag = schedTagMatch ? schedTagMatch[0] : null;
        
        // Remove the tag from the text for matching
        let cleanCheckboxText = checkboxText.replace(/\(SCHEDULED:[^)]+\)/i, '').trim();
        let lines = content.split('\n');
        let changed = false;
        
        for (let i = 0; i < lines.length; i++) {
          let match = lines[i].match(/^([-*])\s*\[( |x)\]\s*(.*)$/i);
          if (match) {
            // Extract text and scheduled tag from the line
            let lineText = match[3].replace(/\s*(\(REPEAT:[^)]+\))?\s*(\(SCHEDULED:[^)]+\))?\s*$/, '').trim();
            let lineSchedTag = (lines[i].match(/\(SCHEDULED:[^)]+\)/) || [''])[0];
            
            // Match both text and scheduled tag (if present)
            let textMatch = lineText === cleanCheckboxText;
            let schedMatch = (!schedTag || (lineSchedTag && lineSchedTag === schedTag));
            
            if (textMatch && schedMatch) {
              let repeatTag = (lines[i].match(/\(REPEAT:[^)]+\)/) || [''])[0];
              lines[i] = `${match[1]} [${e.target.checked ? 'x' : ' '}] ${lineText}`
                + (lineSchedTag ? ' ' + lineSchedTag : '')
                + (repeatTag ? ' ' + repeatTag : '');
              changed = true;
              break;
            }
          }
        }
        
        if (changed) {
          setStorage(key, lines.join('\n'));
          
          // Trigger cloud sync
          if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
          }
          
          // Only update if the content has actually changed
          updatePlannerDay(key);
        }
      }
      
      // Restore scroll position
      if (wrapper) {
        wrapper.scrollTop = scrollTop;
        setTimeout(() => {
          wrapper.scrollTop = scrollTop;
        }, 0);
      }
    }
  });
}
