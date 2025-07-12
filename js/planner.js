// --- /js/planner.js (Refactored) ---

// =========================================================================
//  PLANNER UI LOGIC
//  This file is now only responsible for rendering and updating the planner's UI.
//  It gets all its data by calling the global `window.getAllScheduledItems()`.
// =========================================================================

// REMOVED: The escapeRegExp function was moved to utils.js as it's a generic utility.
// REMOVED: The entire getAllScheduledItems function was moved to utils.js to act as the single source of truth for the whole app.

/**
 * Builds the HTML for the scheduled items block within a planner day.
 * This function remains here as it's specific to the planner's UI.
 * It now relies on the data structure provided by the centralized getAllScheduledItems.
 */
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
      // --- This entire function's inner logic remains exactly the same ---
      // It correctly processes the data structure it's given.
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
            // Improved: Extract time range in HH:mm-HH:mm format
            const repeatRangeMatch = lines[idx].match(/\(REPEAT:[^)]*\b(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\b/);
            if (repeatRangeMatch) {
              item.time = repeatRangeMatch[1];
              item.endTime = repeatRangeMatch[2];
            } else {
              // Try to extract single time (HH:mm only)
              const singleTimeMatch = lines[idx].match(/\(REPEAT:[^)]*\b(\d{2}:\d{2})\b/);
              if (singleTimeMatch) {
                item.time = singleTimeMatch[1];
                item.endTime = null;
              }
            }
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
            prefix = `${item.time}-${item.endTime}: `;
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

/**
 * Updates the content of a single planner day in the DOM.
 * @param {string} key - The planner key, e.g., '2025-W27-monday'.
 */
function updatePlannerDay(key) {
  const noteEl = document.querySelector(`.planner-note[data-key="${key}"]`);
  if (!noteEl) return;

  const oldContentWrapper = noteEl.querySelector('.content-wrapper[data-key]');
  const scrollTop = oldContentWrapper ? oldContentWrapper.scrollTop : 0;

  const checkboxStates = new Map();
  if (oldContentWrapper) {
    oldContentWrapper.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      const nextEl = checkbox.nextElementSibling;
      if (nextEl && nextEl.classList && nextEl.classList.contains('task-metadata')) {
        const key = `${nextEl.getAttribute('data-key')}-${nextEl.getAttribute('data-line-index')}`;
        checkboxStates.set(key, checkbox.checked);
      } else if (checkbox.id) {
        checkboxStates.set(checkbox.id, checkbox.checked);
      }
    });
  }

  const boxId = key.split('-').pop();
  const box = PLANNER_BOXES.find(b => b.id === boxId);
  if (!box) return;
  const startOfWeek = dateFns.startOfISOWeek(appState.currentDate);
  const index = PLANNER_BOXES.findIndex(b => b.id === boxId);
  const dayDate = dateFns.addDays(startOfWeek, index);
  const dayDateStr = dateFns.format(dayDate, 'yyyy-MM-dd');
  
  // MODIFIED: Call the global, centralized function from utils.js
  const allScheduled = window.getAllScheduledItems();
  
  let content = getStorage(key) || '';
  content = content.replace(/\n?\*\*Scheduled Items\*\*[\s\S]*?(?=\n{2,}|$)/, '').trim();

  const scheduledBlock = buildScheduledItemsHtml(dayDateStr, allScheduled);
  const parsed = parseMarkdown(content);
  let parsedClean = `<div class="rendered-content">${parsed}</div>`;

  const oldHtml = noteEl.innerHTML;
  const newHtml = `
    <div class="heading">${box.title} <span>${dateFns.format(dayDate, 'd.M')}</span></div>
    <div class="content-wrapper" data-key="${key}">
      ${parsedClean}
      ${scheduledBlock}
    </div>
  `;

  if (oldHtml !== newHtml) {
    noteEl.innerHTML = newHtml;
  }

  const contentWrapper = noteEl.querySelector('.content-wrapper[data-key]');
  attachPlannerCheckboxHandler(contentWrapper, key, content);

  if (contentWrapper) {
    contentWrapper.querySelectorAll('.task-metadata').forEach(metadataSpan => {
      const pageKey = metadataSpan.getAttribute('data-key');
      const lineIdx = metadataSpan.getAttribute('data-line-index');
      if (pageKey && lineIdx) {
        const savedKey = `${pageKey}-${lineIdx}`;
        if (checkboxStates.has(savedKey)) {
          const checkbox = metadataSpan.previousElementSibling;
          if (checkbox && checkbox.type === 'checkbox') {
            checkbox.checked = checkboxStates.get(savedKey);
          }
        } else {
          const pageContent = getStorage(pageKey);
          const lines = pageContent.split('\n');
          if (lines[lineIdx] && lines[lineIdx].includes('[x]')) {
            const checkbox = metadataSpan.previousElementSibling;
            if (checkbox && checkbox.type === 'checkbox') {
              checkbox.checked = true;
            }
          }
        }
      }
    });

    contentWrapper.querySelectorAll('input[type="checkbox"][id]').forEach(checkbox => {
      if (checkboxStates.has(checkbox.id)) {
        checkbox.checked = checkboxStates.get(checkbox.id);
      }
    });

    setTimeout(() => {
      contentWrapper.scrollTop = scrollTop;
    }, 50);
  }
}