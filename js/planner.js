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
        let timeStr = null;
        let timeMinutes = -1; // For sorting purposes

        if (item.time) {
          timeStr = item.time;
          if (item.endTime) {
            timeStr += '-' + item.endTime;
          }
          // For sorting, use the start time
          const [hours, minutes] = item.time.split(':').map(Number);
          timeMinutes = hours * 60 + minutes;
        } else {
          timeStr = null;
          timeMinutes = -1;
        }

        // Fallback: try to extract from originalDate if not present
        if (!timeStr && item.originalDate && /\d{2}:\d{2}/.test(item.originalDate)) {
          const match = item.originalDate.match(/(\d{2}:\d{2})(?:-(\d{2}:\d{2}))?/);
          if (match) {
            timeStr = match[1];
            if (match[2]) timeStr += '-' + match[2];
            const [hours, minutes] = match[1].split(':').map(Number);
            timeMinutes = hours * 60 + minutes;
          }
        }

        // If still not found, fallback to previous logic
        if (!timeStr) {
          timeStr = null;
          timeMinutes = -1;
        }
        
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
          if (item.time && item.endTime) {
            prefix = `${item.time} ${item.endTime}: `;
          } else if (item.time) {
            prefix = `${item.time}: `;
          } else if (item.endTime) {
            prefix = `${item.endTime}: `;
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
        scheduledBlock = `<div class="scheduled-items-scroll">${metadataStyle}<div class="rendered-content">${parsedContent}</div></div>`;
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

  // Wrap the parsed content in a div with class rendered-content
  const parsed = parseMarkdown(content);
  let parsedClean = `<div class="rendered-content">${parsed}</div>`;
  if (typeof window !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsedClean;
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
    // Allow for optional time or time range after the date
    const scheduleRegex = window.scheduledRegex;
    // NOTIFY
    // Capture both date and time
    const notifyRegex = new RegExp(`^(?:[-*]\\s*\\[[x ]\\]\\s*)?(.*)\\(NOTIFY:\\s*${window.DATE_REGEX_PATTERN}(?:\\s*(\\d{1,2}:\\d{2}))?\\)`, 'i');
    // NOTIFY with only time (attached to an item with SCHEDULED)
    const notifyTimeRegex = /\(NOTIFY:\s*(\d{1,2}:\d{2})\)/i;
    // REPEAT (recurring, new flexible syntax)
    // Allow for time or time range after the repeat rule
    // Accepts: (REPEAT: rule 09:00-10:00), (REPEAT: rule 11:00 12:00), (REPEAT: rule 08:00)
const repeatRegex = window.REPEAT_REGEX;
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
                    const startTime = match[5]; // Start time
                    const endTime = match[6];   // End time
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
                        originalDate: startTime ? `${dateStr} ${startTime}` : dateStr,
                        time: startTime,
                        endTime: endTime,
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
                    if (!repeatRule) return;
                    const repeatStartTime = repeatMatch[2];
                    const repeatEndTime = repeatMatch[3];

                    // Check for checkbox prefix in repeat items
                    const checkboxMatch = line.match(/^([-*]\s*\[([x ])\]\s*)?/);
                    const checkboxPrefix = checkboxMatch ? checkboxMatch[1] || '' : '';
                    const checkboxState = checkboxMatch ? checkboxMatch[2] || '' : '';
                    const isCheckbox = !!checkboxPrefix;
                    const checkboxChecked = checkboxState === 'x';

                    // Extract the clean text without REPEAT and SCHEDULED tags
                    let cleanText = line.replace(/\(REPEAT:[^)]+\)/, '').replace(/\(SCHEDULED:[^)]+\)/, '').trim();

                    // Helper to add a repeat item for a given date
                    function addRepeatItem(dayStr, origDate, time, endTime) {
                        if (!scheduledItems.has(dayStr)) scheduledItems.set(dayStr, []);
                        scheduledItems.get(dayStr).push({
                            text: cleanText,
                            isCheckbox: isCheckbox,
                            checkboxState: checkboxChecked,
                            pageKey: key,
                            displayName: pageTitle,
                            recurring: true,
                            recurringKey: repeatRule,
                            originalDate: origDate,
                            time: time,
                            endTime: endTime,
                            notify: false
                        });
                    }
                    
                    // Handle "everyday from date to date" format, with time
    const everydayRangeMatch = repeatRule.match(/^everyday from ([^ ]+) to ([^ )]+)(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?/i);
    if (everydayRangeMatch) {
        const startDate = window.normalizeDateStringToYyyyMmDd(everydayRangeMatch[1]);
        const endDate = window.normalizeDateStringToYyyyMmDd(everydayRangeMatch[2]);
        const time = everydayRangeMatch[3] || repeatStartTime;
        const endTime = everydayRangeMatch[4] || repeatEndTime;
        if (startDate && endDate) {
            let d = dateFns.parseISO(startDate);
            const endDateObj = dateFns.parseISO(endDate);
            for (; !dateFns.isAfter(d, endDateObj); d = dateFns.addDays(d, 1)) {
                const dayStr = dateFns.format(d, 'yyyy-MM-dd');
                addRepeatItem(dayStr, startDate, time, endTime);
            }
        }
        return;
    }

    // Handle "every <weekday> from <date> to <date> [time]" format
    const rangeMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?/i);
    let weekday = null, startDate = null, endDate = null, time = null, endTime = null;
    if (rangeMatch) {
        weekday = rangeMatch[1].toLowerCase();
        startDate = window.normalizeDateStringToYyyyMmDd(rangeMatch[2]);
        endDate = window.normalizeDateStringToYyyyMmDd(rangeMatch[3]);
        time = rangeMatch[4] || repeatStartTime;
        endTime = rangeMatch[5] || repeatEndTime;
    }
    if (!weekday) {
        const everyMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?$/i);
        if (everyMatch) {
            weekday = everyMatch[1].toLowerCase();
            time = everyMatch[2] || repeatStartTime;
            endTime = everyMatch[3] || repeatEndTime;
        }
    }
    if (weekday) {
        if (!startDate) {
            const scheduledMatches = [...line.matchAll(/\(SCHEDULED: ([^)]+)\)/g)];
            if (scheduledMatches.length > 0) {
                startDate = window.normalizeDateStringToYyyyMmDd(scheduledMatches[0][1]);
            }
        }
        if (!startDate) {
            startDate = dateFns.format(new Date(), 'yyyy-MM-dd');
        }
        if (!endDate) {
            const now = new Date();
            endDate = dateFns.format(new Date(now.getFullYear() + 1, 11, 31), 'yyyy-MM-dd');
        }
        const targetIndex = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(weekday);
        let first = dateFns.parseISO(startDate);
        let d = dateFns.startOfDay(first);
        while (dateFns.getDay(d) !== ((targetIndex + 1) % 7)) {
            d = dateFns.addDays(d, 1);
        }
        const endDateObj = dateFns.parseISO(endDate);
        for (; !dateFns.isAfter(d, endDateObj); d = dateFns.addWeeks(d, 1)) {
            if (dateFns.isBefore(d, first)) continue;
            const dayStr = dateFns.format(d, 'yyyy-MM-dd');
            addRepeatItem(dayStr, startDate, time, endTime);
        }
    } else if (repeatRule.toLowerCase().startsWith('everyday')) {
        // Handle daily recurring events with optional time and range
        let startDate = null, time = repeatStartTime, endTime = repeatEndTime;
        const scheduledMatches = [...line.matchAll(/\(SCHEDULED: ([^)]+)\)/g)];
        if (scheduledMatches.length > 0) {
            startDate = window.normalizeDateStringToYyyyMmDd(scheduledMatches[0][1]);
        }
        if (!startDate) {
            startDate = dateFns.format(new Date(), 'yyyy-MM-dd');
        }
        // Try to extract time from repeatRule if present
        const timeMatch = repeatRule.match(/everyday(?:\s+(\d{1,2}:\d{2})(?:-(\d{1,2}:\d{2}))?)?/i);
        if (timeMatch) {
            time = timeMatch[1] || time;
            endTime = timeMatch[2] || endTime;
        }
        const now = new Date();
        const endDate = dateFns.format(new Date(now.getFullYear() + 1, 11, 31), 'yyyy-MM-dd');
        let d = dateFns.parseISO(startDate);
        const endDateObj = dateFns.parseISO(endDate);
        for (; !dateFns.isAfter(d, endDateObj); d = dateFns.addDays(d, 1)) {
            const dayStr = dateFns.format(d, 'yyyy-MM-dd');
            addRepeatItem(dayStr, startDate, time, endTime);
        }
    } else {
        // Handle (REPEAT: <date>) as an annual recurring event (every year on that day)
        let dateAndTime = repeatRule.trim().split(/\s+/); // e.g. ["2001-07-05", "15:00"]
        let dateStr = dateAndTime[0];
        let timeStr = dateAndTime[1] || repeatStartTime;
        let endTimeStr = dateAndTime[2] || repeatEndTime;

        let norm = window.normalizeDateStringToYyyyMmDd(dateStr);
        if (norm) {
        // Start from the original year, not just the current year
            const startYear = parseInt(norm.slice(0, 4), 10);
            const today = new Date();
            const endYear = today.getFullYear() + 10;
            for (let y = startYear; y <= endYear; y++) {
                let ymd = `${y}-${norm.slice(5)}`;
                // Set originalDate to the actual date for this year
                addRepeatItem(ymd, ymd, timeStr, endTimeStr);
            }
        } else {
            // Try to match day/month only (e.g. 01-07)
            const dm = dateStr.match(/^(\d{2})[./-](\d{2})$/);
            if (dm) {
                let monthDay = `${dm[2]}-${dm[1]}`;
                const now = new Date();
                let startYear = now.getFullYear() - 10;
                let endYear = now.getFullYear() + 10;
                for (let y = startYear; y <= endYear; y++) {
                    let ymd = `${y}-${monthDay}`;
                    addRepeatItem(ymd, monthDay, timeStr, endTimeStr);
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
