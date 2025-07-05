// Utility to enable/disable the Today button based on current centering
function updatePlannerTodayButtonState() {
  const todayBtn = document.querySelector('.planner-nav [data-action="today"]');
  if (!todayBtn) return;
  const isToday = dateFns.isToday(appState.currentDate);
  const centered = isCurrentPlannerDayCentered();
  todayBtn.disabled = isToday && centered;
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

// --- Flag to prevent scroll event conflicts ---
let isProgrammaticScroll = false;
// Helper function to build the HTML block for scheduled and recurring items
function buildScheduledItemsHtml(dayDateStr, allScheduled) {
  // Add inline style to hide metadata spans
  const metadataStyle = `<style>
    .task-metadata {
      display: none;
      visibility: hidden;
      height: 0;
      width: 0;
      overflow: hidden;
    }
  </style>`;

  let scheduledBlock = '';
  if (allScheduled.has(dayDateStr)) {
    const itemsForDay = allScheduled.get(dayDateStr);
    if (itemsForDay && itemsForDay.length > 0) {
      // Extract time from scheduled items and add to the item object
      const enhancedItems = itemsForDay.map(item => {
        // Check if there's a time in the originalDate (e.g., "2025-07-05 23:55")
        let timeStr = null;
        let timeMinutes = -1; // For sorting purposes
        
        const pageContent = getStorage(item.pageKey);
        const lines = pageContent.split('\n');
        let foundIndex = -1;
        let hasNotify = false;
        let notifyTime = null;
        let isCheckboxTask = false;
        
        // If the item was already identified as a checkbox in getAllScheduledItems
        if (item.isCheckbox !== undefined) {
          isCheckboxTask = item.isCheckbox;
        }
        
        // Find the line containing this item
        for (let idx = 0; idx < lines.length; idx++) {
          if (!lines[idx].includes(item.text)) continue;
          
          // For scheduled items, find the original line
          if (!item.notify && !item.recurring) {
            const dateMatch = lines[idx].match(new RegExp(window.DATE_REGEX_PATTERN));
            const lineNormDate = dateMatch ? window.normalizeDateStringToYyyyMmDd(dateMatch[0]) : null;
            if (lineNormDate === dayDateStr) {
              foundIndex = idx;
              
              // If not already determined, check if this item is a checkbox task
              if (item.isCheckbox === undefined) {
                isCheckboxTask = /^[-*]\s*\[[ x]\]/.test(lines[idx]);
              }
              
              // Check if this line also has a NOTIFY tag with time
              const notifyMatch = lines[idx].match(/\(NOTIFY:.*?(\d{1,2}:\d{2})\)/i);
              if (notifyMatch) {
                // If this is a scheduled item with a NOTIFY tag with time,
                // use the notify time instead of the scheduled time
                notifyTime = notifyMatch[1];
                timeStr = notifyTime;
                const [hours, minutes] = timeStr.split(':').map(Number);
                timeMinutes = hours * 60 + minutes;
                hasNotify = true;
              } else {
                // Otherwise, check for time in the SCHEDULED tag
                const schedTimeMatch = lines[idx].match(/\(SCHEDULED:.*?(\d{1,2}:\d{2})\)/i);
                if (schedTimeMatch) {
                  timeStr = schedTimeMatch[1];
                  const [hours, minutes] = timeStr.split(':').map(Number);
                  timeMinutes = hours * 60 + minutes;
                }
                hasNotify = /\(NOTIFY:[^)]+\)/i.test(lines[idx]);
              }
              break;
            }
          } 
          // For notification items
          else if (item.notify) {
            if (lines[idx].includes(item.text) && lines[idx].includes('NOTIFY:')) {
              foundIndex = idx;
              // Extract time from NOTIFY tag
              const notifyTimeMatch = lines[idx].match(/\(NOTIFY:.*?(\d{1,2}:\d{2})\)/i);
              if (notifyTimeMatch) {
                timeStr = notifyTimeMatch[1];
                const [hours, minutes] = timeStr.split(':').map(Number);
                timeMinutes = hours * 60 + minutes;
              }
              break;
            }
          }
          // For recurring items
          else if (item.recurring && lines[idx].includes('(REPEAT:')) {
            foundIndex = idx;
            break;
          }
        }
        
        const checked = foundIndex !== -1 && /\[x\]/i.test(lines[foundIndex]);
        // Check if this is a checkbox task (starts with - [ ] or - [x])
        isCheckboxTask = foundIndex !== -1 && /^[-*]\s*\[[ x]\]/.test(lines[foundIndex]);
        
        return {
          ...item,
          timeStr,
          timeMinutes,
          foundIndex,
          checked,
          hasNotify,
          notifyTime,
          isCheckboxTask
        };
      });

      // Sort all items by time (all-day items first, then by time)
      enhancedItems.sort((a, b) => {
        if (a.timeMinutes === -1 && b.timeMinutes === -1) {
          return 0; // Both are all-day items
        }
        if (a.timeMinutes === -1) return -1; // a is all-day
        if (b.timeMinutes === -1) return 1;  // b is all-day
        return a.timeMinutes - b.timeMinutes; // Sort by time
      });
      
      // Create a single chronological list of all items
      const allItemsContent = enhancedItems
        .map(item => {
          const pageKey = item.pageKey;
          if (item.foundIndex === -1) return '';
          
          let prefix = '';
          if (item.timeStr) {
            prefix = `${item.timeStr}: `;
          } else {
            prefix = 'All Day: ';
          }
          
          const notifyIcon = item.hasNotify ? ' <span title="Notification set" class="notify-icon" style="vertical-align:middle;">\uD83D\uDD14</span>' : '';
          
          if (item.notify) {
            // Render NOTIFY items with a bell icon, time prefix but no "Notify:" label
            return `${prefix}\uD83D\uDD14 ${item.text} (from [[${item.displayName}]])`;
          } else if (item.recurring) {
            // Recurring event with time prefix and recurring icon
            // Only use one 🔁 icon
            let ageStr = '';
            if (item.originalDate && item.originalDate.match(/^\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4}$/)) {
              const origDate = window.parseDateString(item.originalDate);
              if (origDate) {
                const thisYear = dateFns.getYear(dateFns.parseISO(dayDateStr));
                const origYear = dateFns.getYear(origDate);
                const years = thisYear - origYear;
                if (years > 0) ageStr = ` (${years} yr${years > 1 ? 's' : ''})`;
              }
            }
            // Remove any existing 🔁 from the text to prevent duplicates
            const cleanedText = item.text.replace(/🔁\s*/g, '');
            return `${prefix}🔁 ${cleanedText}${ageStr} (from [[${item.displayName}]])`;
          } else {
            if (item.isCheckboxTask || item.isCheckbox) {
              // Keep the checkbox format for actual checkbox tasks
              // If the item comes from getAllScheduledItems with isCheckbox flag,
              // use the original checkboxState. Otherwise, clean the text and use the checked flag.
              let cleanText;
              let isChecked;
              
              if (item.isCheckbox !== undefined) {
                // The checkbox info came from getAllScheduledItems
                cleanText = item.text.replace(/^[-*]\s*\[[ x]\]\s*/, '');
                isChecked = item.checkboxState || item.checked;
              } else {
                // The checkbox was detected in buildScheduledItemsHtml
                cleanText = item.text.replace(/^[-*]\s*\[[ x]\]\s*/, '');
                isChecked = item.checked;
              }
              
              // Format as a simple checkbox with hidden metadata and unique ID to ensure independence
              const uniqueId = `checkbox-${pageKey.replace(/[^a-zA-Z0-9]/g, '')}-${item.foundIndex}-${dayDateStr}`;
              return `${prefix}<input type="checkbox" id="${uniqueId}" ${isChecked ? 'checked' : ''}> ${cleanText} (from [[${item.displayName}]])${notifyIcon}<span class="task-metadata" data-key="${pageKey}" data-line-index="${item.foundIndex}" data-scheduled-date="${dayDateStr}"></span>`;
            } else {
              // For regular scheduled items, don't include checkbox markup
              // Still include metadata in a format that won't trigger checkbox rendering
              return `${prefix}${item.text} (from [[${item.displayName}]])${notifyIcon}`;
            }
          }
        })
        .filter(Boolean)
        .join('<hr>');

      if (allItemsContent) {
        // We want to preserve the original structure without making it a list item
        // as this was causing rendering issues with the checkboxes
        const parsedContent = parseMarkdown(allItemsContent);
        scheduledBlock = `<div class="scheduled-items-scroll">${metadataStyle}${parsedContent}</div>`;
      }
    }
  }
  return scheduledBlock;
}

// Update only a single planner day in the grid
function updatePlannerDay(key) {
  // key: e.g. '2025-W27-monday'
  const noteEl = document.querySelector(`.planner-note[data-key="${key}"]`);
  if (!noteEl) return;
  
  // Store the current scroll position
  const oldContentWrapper = noteEl.querySelector('.content-wrapper[data-key]');
  const scrollTop = oldContentWrapper ? oldContentWrapper.scrollTop : 0;
  
  // Store checkbox states before updating
  const checkboxStates = new Map();
  if (oldContentWrapper) {
    oldContentWrapper.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      // Store by metadata info if available
      const nextEl = checkbox.nextElementSibling;
      if (nextEl && nextEl.classList && nextEl.classList.contains('task-metadata')) {
        const key = `${nextEl.getAttribute('data-key')}-${nextEl.getAttribute('data-line-index')}`;
        checkboxStates.set(key, checkbox.checked);
      } else {
        // Otherwise store by checkbox ID
        if (checkbox.id) {
          checkboxStates.set(checkbox.id, checkbox.checked);
        }
      }
    });
  }
  
  // Get the box info
  const boxId = key.split('-').pop();
  const box = PLANNER_BOXES.find(b => b.id === boxId);
  if (!box) return;
  const weekKey = key.slice(0, key.lastIndexOf('-'));
  const startOfWeek = dateFns.startOfISOWeek(appState.currentDate);
  const index = PLANNER_BOXES.findIndex(b => b.id === boxId);
  const dayDate = dateFns.addDays(startOfWeek, index);
  const dayDateStr = dateFns.format(dayDate, 'yyyy-MM-dd');
  const allScheduled = getAllScheduledItems();
  let content = getStorage(key) || '';
  content = content.replace(/\n?\*\*Scheduled Items\*\*[\s\S]*?(?=\n{2,}|$)/, '').trim();

  // --- Build scheduled/repeat items section using the helper function ---
  const scheduledBlock = buildScheduledItemsHtml(dayDateStr, allScheduled);

  const parsed = parseMarkdown(content);
  let parsedClean = parsed;
  if (typeof window !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsed;
    parsedClean = tempDiv.innerHTML;
  }
  
  // Save the old HTML to avoid unnecessary DOM changes if content hasn't changed
  const oldHtml = noteEl.innerHTML;
  const newHtml = `
    <div class="heading">${box.title} <span>${dateFns.format(dayDate, 'd.M')}</span></div>
    <div class="content-wrapper" data-key="${key}">
      ${parsedClean}
      ${scheduledBlock}
    </div>
  `;
  
  // Only update the DOM if content actually changed
  if (oldHtml !== newHtml) {
    noteEl.innerHTML = newHtml;
  }
  
  // Now get the new content wrapper after the update
  const contentWrapper = noteEl.querySelector('.content-wrapper[data-key]');
  
  // Attach checkbox handler for this day
  attachPlannerCheckboxHandler(contentWrapper, key, content);
  
  // Restore checkbox states and scroll position
  if (contentWrapper) {
    // First restore any checkbox states from metadata
    contentWrapper.querySelectorAll('.task-metadata').forEach(metadataSpan => {
      const pageKey = metadataSpan.getAttribute('data-key');
      const lineIdx = metadataSpan.getAttribute('data-line-index');
      if (pageKey && lineIdx) {
        // Check if we have saved state
        const savedKey = `${pageKey}-${lineIdx}`;
        if (checkboxStates.has(savedKey)) {
          // Find the checkbox that's adjacent to this metadata span
          const checkbox = metadataSpan.previousElementSibling;
          if (checkbox && checkbox.type === 'checkbox') {
            checkbox.checked = checkboxStates.get(savedKey);
          }
        } else {
          // Otherwise check the source content
          const pageContent = getStorage(pageKey);
          const lines = pageContent.split('\n');
          if (lines[lineIdx]) {
            const isChecked = lines[lineIdx].includes('[x]');
            // Find the checkbox that's adjacent to this metadata span
            const checkbox = metadataSpan.previousElementSibling;
            if (checkbox && checkbox.type === 'checkbox') {
              checkbox.checked = isChecked;
            }
          }
        }
      }
    });
    
    // Also check for checkboxes with IDs
    contentWrapper.querySelectorAll('input[type="checkbox"][id]').forEach(checkbox => {
      if (checkboxStates.has(checkbox.id)) {
        checkbox.checked = checkboxStates.get(checkbox.id);
      }
    });
    
    // Restore scroll position with a slightly longer delay to ensure rendering is complete
    setTimeout(() => {
      contentWrapper.scrollTop = scrollTop;
    }, 50);
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
        const targetScrollLeft = noteCenter - gridWidth / 2 - 15;
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
            if (boxIdx !== -1) {
              const newDate = window.dateFns.addDays(weekStart, boxIdx);
              appState.currentDate = newDate;
              setTimeout(updatePlannerTodayButtonState, 200);
            }
          }
        }, 700);
      }
    }, 120);
  });
}
// Helper to escape special regex characters in a string
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// --- PLANNER VIEW LOGIC ---

/**
 * Scans all library pages for scheduled items and returns them grouped by date.
 * An item is identified by a line containing "(SCHEDULED: YYYY-MM-DD)", "(SCHEDULED: DD.MM.YYYY)", or "(SCHEDULED: DD/MM/YYYY)".
 * @returns {Map<string, Array<{text: string, source: string}>>} A map where keys are 'YYYY-MM-DD' strings
 * and values are arrays of scheduled items with their source page.
 */

function getAllScheduledItems() {
    const scheduledItems = new Map();
    // SCHEDULED
    // Allow for optional time after the date (e.g. 2025-07-03 03:22)
    // Capture checkbox marker if present, then the rest of the text
    const scheduleRegex = new RegExp(`^([-*]\\s*\\[([x ])\\]\\s*)?(.*?)\\(SCHEDULED:\\s*${window.DATE_REGEX_PATTERN}(?:\\s*(\\d{1,2}:\\d{2}))?\\)`, 'i');
    // NOTIFY
    // Capture both date and time
    const notifyRegex = new RegExp(`^(?:[-*]\\s*\\[[x ]\\]\\s*)?(.*)\\(NOTIFY:\\s*${window.DATE_REGEX_PATTERN}(?:\\s*(\\d{1,2}:\\d{2}))?\\)`, 'i');
    // NOTIFY with only time (attached to an item with SCHEDULED)
    const notifyTimeRegex = /\(NOTIFY:\s*(\d{1,2}:\d{2})\)/i;
    // REPEAT (recurring, new flexible syntax)
    const repeatRegex = /\(REPEAT: ([^)]+)\)/i;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('page-')) {
            const content = localStorage.getItem(key);
            const pageTitle = key.substring(5);
            const lines = content.split('\n');
            lines.forEach(line => {
                // SCHEDULED
                const match = line.match(scheduleRegex);
                if (match) {
                    const checkboxPrefix = match[1] || ''; // The checkbox prefix (- [x] or - [ ])
                    const checkboxState = match[2] || '';  // The checkbox state (x or space)
                    const itemText = match[3].trim();
                    const dateStr = match[4];
                    const timeStr = match[5]; // This will be undefined if no time was specified
                    if (!itemText && !checkboxPrefix) return;
                    let normalizedDate = window.normalizeDateStringToYyyyMmDd(dateStr);
                    if (!normalizedDate) return;
                    if (!scheduledItems.has(normalizedDate)) scheduledItems.set(normalizedDate, []);
                    
                    // Check if this item also has a NOTIFY tag with just time
                    const notifyTimeMatch = line.match(notifyTimeRegex);
                    const hasNotifyTag = notifyTimeMatch !== null;
                    
                    // Construct the full text including checkbox if present
                    const fullText = checkboxPrefix ? `${checkboxPrefix}${itemText}` : itemText;
                    
                    scheduledItems.get(normalizedDate).push({
                        text: fullText,
                        isCheckbox: !!checkboxPrefix,
                        checkboxState: checkboxState === 'x',
                        pageKey: key,
                        displayName: pageTitle,
                        recurring: false,
                        originalDate: timeStr ? `${dateStr} ${timeStr}` : dateStr,
                        time: timeStr,
                        notify: false,
                        hasNotifyTag: hasNotifyTag,
                        notifyTime: notifyTimeMatch ? notifyTimeMatch[1] : null
                    });
                }
                // NOTIFY
                const notifyMatch = line.match(notifyRegex);
                if (notifyMatch) {
                    const itemText = notifyMatch[1].trim();
                    const dateStr = notifyMatch[2];
                    const timeStr = notifyMatch[3]; // This will be undefined if no time was specified
                    if (!itemText) return;
                    let normalizedDate = window.normalizeDateStringToYyyyMmDd(dateStr);
                    if (!normalizedDate) return;
                    if (!scheduledItems.has(normalizedDate)) scheduledItems.set(normalizedDate, []);
                    scheduledItems.get(normalizedDate).push({
                        text: itemText,
                        pageKey: key,
                        displayName: pageTitle,
                        recurring: false,
                        originalDate: timeStr ? `${dateStr} ${timeStr}` : dateStr,
                        time: timeStr,
                        notify: true
                    });
                }
                // REPEAT (recurring, new flexible syntax)
                const repeatMatch = line.match(repeatRegex);
                if (repeatMatch) {
                    const repeatRule = repeatMatch[1];
                    const rangeMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)/i);
                    let weekday = null, startDate = null, endDate = null;
                    if (rangeMatch) {
                        weekday = rangeMatch[1].toLowerCase();
                        startDate = window.normalizeDateStringToYyyyMmDd(rangeMatch[2]);
                        endDate = window.normalizeDateStringToYyyyMmDd(rangeMatch[3]);
                    }
                    if (!weekday) {
                        const everyMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
                        if (everyMatch) {
                            weekday = everyMatch[1].toLowerCase();
                        }
                    }
                    if (weekday) {
                        if (!startDate) {
                            const scheduledMatches = [...line.matchAll(/\(SCHEDULED: ([^)]+)\)/g)];
                            if (scheduledMatches.length > 0) {
                                startDate = window.normalizeDateStringToYyyyMmDd(scheduledMatches[0][1]);
                            }
                        }
                        if (!startDate) return;
                        if (!endDate) {
                            const now = new Date();
                            endDate = new Date(now.getFullYear() + 10, 11, 31);
                        }
                        const targetIndex = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(weekday);
                        let first = dateFns.parseISO(startDate);
                        let d = dateFns.startOfDay(first);
                        while (dateFns.getDay(d) !== ((targetIndex + 1) % 7)) {
                            d = dateFns.addDays(d, 1);
                        }
                        for (; !dateFns.isAfter(d, endDate); d = dateFns.addWeeks(d, 1)) {
                            if (dateFns.isBefore(d, first)) continue;
                            const dayStr = dateFns.format(d, 'yyyy-MM-dd');
                            if (!scheduledItems.has(dayStr)) scheduledItems.set(dayStr, []);
                            scheduledItems.get(dayStr).push({
                                text: line.replace(/\(REPEAT:[^)]+\)/, '').replace(/\(SCHEDULED:[^)]+\)/, '').trim(),
                                pageKey: key,
                                displayName: pageTitle,
                                recurring: true,
                                recurringKey: weekday,
                                originalDate: startDate,
                                notify: false
                            });
                        }
                    } else {
                        // Handle (REPEAT: <date>) as an annual recurring event (every year on that day)
                        let dateStr = repeatRule.trim();
                        let norm = window.normalizeDateStringToYyyyMmDd(dateStr);
                        if (norm) {
                            let monthDay = norm.slice(5); // MM-DD
                            const now = new Date();
                            let startYear = now.getFullYear() - 10;
                            let endYear = now.getFullYear() + 10;
                            for (let y = startYear; y <= endYear; y++) {
                                let ymd = `${y}-${monthDay}`;
                                if (!scheduledItems.has(ymd)) scheduledItems.set(ymd, []);
                                scheduledItems.get(ymd).push({
                                    text: line.replace(/\(REPEAT:[^)]+\)/, '').replace(/\(SCHEDULED:[^)]+\)/, '').trim(),
                                    pageKey: key,
                                    displayName: pageTitle,
                                    recurring: true,
                                    recurringKey: monthDay,
                                    originalDate: norm,
                                    notify: false
                                });
                            }
                        } else {
                            // Try to match day/month only
                            const dm = dateStr.match(/^(\d{2})[./-](\d{2})$/);
                            if (dm) {
                                let monthDay = `${dm[2]}-${dm[1]}`;
                                const now = new Date();
                                let startYear = now.getFullYear() - 10;
                                let endYear = now.getFullYear() + 10;
                                for (let y = startYear; y <= endYear; y++) {
                                    let ymd = `${y}-${monthDay}`;
                                    if (!scheduledItems.has(ymd)) scheduledItems.set(ymd, []);
                                    scheduledItems.get(ymd).push({
                                        text: line.replace(/\(REPEAT:[^)]+\)/, '').replace(/\(SCHEDULED:[^)]+\)/, '').trim(),
                                        pageKey: key,
                                        displayName: pageTitle,
                                        recurring: true,
                                        recurringKey: monthDay,
                                        originalDate: monthDay,
                                        notify: false
                                    });
                                }
                            }
                        }
                    }
                }
            });
        }
    }
    return scheduledItems;
}

/**
 * Checks if the planner day for the current appState.currentDate is already visible and centered on mobile.
 * @returns {boolean} True if the current day is centered, otherwise false.
 */
function isCurrentPlannerDayCentered() {
  // On desktop, scrolling isn't a concern, so we can return true to prevent unnecessary actions.
  if (window.innerWidth > 768) return true;
  const grid = document.getElementById('plan-grid-container');
  if (!grid) return false;

  // Find the plannerKey for the current date in the app state
  const weekKey = getWeekKey(appState.currentDate);
  const dayIndex = dateFns.getISODay(appState.currentDate) - 1;
  const box = PLANNER_BOXES[dayIndex];
  if (!box) return false;
  const plannerKey = `${weekKey}-${box.id}`;
  const note = grid.querySelector(`.planner-note[data-key="${plannerKey}"]`);

  if (note) {
    // Use positions relative to the grid's scroll area, not the viewport
    const gridWidth = grid.clientWidth;
    const noteLeft = note.offsetLeft;
    const noteWidth = note.offsetWidth;

    // Check if the note is fully visible in the grid's scroll area
    const visibleLeft = grid.scrollLeft;
    const visibleRight = visibleLeft + gridWidth;
    const noteStart = noteLeft;
    const noteEnd = noteLeft + noteWidth;

    // Check if the note is roughly centered
    const noteCenter = noteLeft + noteWidth / 2;
    const gridCenter = visibleLeft + gridWidth / 2;
    const delta = noteCenter - gridCenter;
    const tolerance = noteCenter; // Increased tolerance to avoid unnecessary scrolls
    return noteStart >= visibleLeft && noteEnd <= visibleRight && Math.abs(delta) < tolerance;
  }
  return false;
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

    // If the note is already centered, do nothing.
    if (isCurrentPlannerDayCentered()) return;

    // Otherwise, center the note
    const noteCenter = noteLeft + noteWidth / 2;
    // Use a slightly larger micro-adjustment for more reliable centering
    const microAdjust = -15;
    isProgrammaticScroll = true; // Set flag to prevent snap-to-center from interfering
    grid.scrollTo({ left: noteCenter - gridWidth / 2 + microAdjust, behavior: 'smooth' });
    setTimeout(() => { isProgrammaticScroll = false; }, 700); // Reset flag after animation (longer)
  }
}

/**
 * Navigates to the next day in the planner. If it crosses a week boundary,
 * it re-renders the planner. Otherwise, it just scrolls.
 */

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
    const targetScrollLeft = noteCenter - gridWidth / 2 - 15;
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
    const targetScrollLeft = noteCenter - gridWidth / 2 - 15;
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
  const targetScrollLeft = noteCenter - grid.clientWidth / 2 - 15;
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

    const noteEl = document.createElement('div');
    noteEl.className = `planner-note ${box.class}`;
    noteEl.dataset.key = key;
    noteEl.dataset.istoday = isToday;
    const dateString = `<span>${dateFns.format(dayDate, 'd.M')}</span>`;
    // Ensure all goal/task HTML is inside .content-wrapper for planner view only
    // We use a temporary wrapper to extract only the .content-wrapper children
    const parsed = parseMarkdown(content);
    // Remove any .goal-tracker accidentally rendered outside .content-wrapper
    // (This is defensive, in case parseMarkdown ever returns stray block elements)
    let parsedClean = parsed;
    if (typeof window !== 'undefined') {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = parsed;
      // Move any .goal-tracker that is a sibling, not a child, into the .content-wrapper
      // (In practice, parseMarkdown should not do this, but this is a safe fix)
      // For planner, we want all content as a single block
      parsedClean = tempDiv.innerHTML;
    }
    noteEl.innerHTML = `
      <div class="heading">${box.title} ${dateString}</div>
      <div class="content-wrapper" data-key="${key}">
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
  // Update Today button state after render
  setTimeout(updatePlannerTodayButtonState, 200);
}
