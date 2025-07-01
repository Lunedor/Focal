// Attach checkbox event logic to a contentWrapper for a given key and content
function attachPlannerCheckboxHandler(contentWrapper, key, content) {
  if (!contentWrapper) return;
  contentWrapper.addEventListener('change', function(e) {
    if (e.target && e.target.type === 'checkbox') {
      // If this is a recurring event (has data-pagekey and data-lineidx), update the source page
      const pageKey = e.target.getAttribute('data-pagekey');
      const lineIdx = e.target.getAttribute('data-lineidx');
      if (pageKey && lineIdx !== null) {
        let pageContent = getStorage(pageKey);
        let lines = pageContent.split('\n');
        let match = lines[lineIdx].match(/^([-*])\s*\[( |x)\]\s*(.*)$/i);
        if (match) {
          let lineText = match[3].replace(/\s*(\(REPEAT:[^)]+\))?\s*(\(SCHEDULED:[^)]+\))?\s*$/, '').trim();
          let repeatTag = (lines[lineIdx].match(/\(REPEAT:[^)]+\)/) || [''])[0];
          let schedTag = (lines[lineIdx].match(/\(SCHEDULED:[^)]+\)/) || [''])[0];
          lines[lineIdx] = `${match[1]} [${e.target.checked ? 'x' : ' '}] ${lineText}`
            + (schedTag ? ' ' + schedTag : '')
            + (repeatTag ? ' ' + repeatTag : '');
          setStorage(pageKey, lines.join('\n'));
          updatePlannerDay(key);
        }
        return;
      }
      // Otherwise, scheduled item: update planner day content as before
      let checkboxText = e.target.parentNode ? e.target.parentNode.textContent.trim() : '';
      checkboxText = checkboxText.replace(/^\[.\]\s*/, '').replace(/^\s*-\s*/, '').trim();
      let lines = content.split('\n');
      let changed = false;
      for (let i = 0; i < lines.length; i++) {
        let match = lines[i].match(/^([-*])\s*\[( |x)\]\s*(.*)$/i);
        if (match) {
          let lineText = match[3].replace(/\s*(\(REPEAT:[^)]+\))?\s*(\(SCHEDULED:[^)]+\))?\s*$/, '').trim();
          if (lineText === checkboxText) {
            let repeatTag = (lines[i].match(/\(REPEAT:[^)]+\)/) || [''])[0];
            let schedTag = (lines[i].match(/\(SCHEDULED:[^)]+\)/) || [''])[0];
            lines[i] = `${match[1]} [${e.target.checked ? 'x' : ' '}] ${lineText}`
              + (schedTag ? ' ' + schedTag : '')
              + (repeatTag ? ' ' + repeatTag : '');
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        setStorage(key, lines.join('\n'));
        updatePlannerDay(key);
      }
    }
  });
}
// Update only a single planner day in the grid
function updatePlannerDay(key) {
  // key: e.g. '2025-W27-monday'
  const noteEl = document.querySelector(`.planner-note[data-key="${key}"]`);
  if (!noteEl) return;
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
  // --- Build scheduled/repeat items section as markdown, but wrap in scrollable div ---
  let scheduledBlock = '';
  if (allScheduled.has(dayDateStr)) {
    const itemsForDay = allScheduled.get(dayDateStr);
    if (itemsForDay.length > 0) {
      const scheduledItems = itemsForDay.filter(item => !item.recurring);
      const recurringItems = itemsForDay.filter(item => item.recurring);
      let scheduledContent = '';
      let recurringContent = '';
      if (scheduledItems.length > 0) {
        scheduledContent = scheduledItems
          .map(item => {
            const pageKey = item.pageKey;
            const pageContent = getStorage(pageKey);
            const lines = pageContent.split('\n');
            let foundIndex = -1;
            for (let idx = 0; idx < lines.length; idx++) {
              if (!lines[idx].includes(item.text)) continue;
              const dateMatch = lines[idx].match(new RegExp(window.DATE_REGEX_PATTERN));
              const lineNormDate = dateMatch ? window.normalizeDateStringToYyyyMmDd(dateMatch[0]) : null;
              if (lineNormDate === dayDateStr) { foundIndex = idx; break; }
            }
            if (foundIndex === -1) return '';
            const checked = /\[x\]/i.test(lines[foundIndex]);
            return `- [${checked ? 'x' : ' '}] ${item.text} (from [[${item.displayName}]]){key=${pageKey} line-index=${foundIndex} scheduled-date=${dayDateStr}}`;
          })
          .filter(Boolean)
          .join('\n');
      }
      if (recurringItems.length > 0) {
        recurringContent = recurringItems
          .map(item => {
            const pageKey = item.pageKey;
            const pageContent = getStorage(pageKey);
            const lines = pageContent.split('\n');
            let foundIndex = -1;
            for (let idx = 0; idx < lines.length; idx++) {
              if (!lines[idx].includes(item.text)) continue;
              if (lines[idx].includes('(REPEAT:')) { foundIndex = idx; break; }
            }
            if (foundIndex === -1) return '';
            const recurringIcon = '🔁 ';
            let ageStr = '';
            if (item.originalDate && item.originalDate.match(/^\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4}$/)) {
              const origDate = window.parseDateString(item.originalDate);
              if (origDate) {
                const thisYear = dateFns.getYear(dayDate);
                const origYear = dateFns.getYear(origDate);
                const years = thisYear - origYear;
                if (years > 0) ageStr = ` (${years} yr${years > 1 ? 's' : ''})`;
              }
            }
            const checked = /\[x\]/i.test(lines[foundIndex]);
            // Add metadata for handler: data-pagekey and data-lineidx
            return `<label class=\"planner-checkbox-label\"><input type=\"checkbox\" data-pagekey=\"${pageKey}\" data-lineidx=\"${foundIndex}\" ${checked ? 'checked' : ''}>${recurringIcon}${item.text}${ageStr} (from [[${item.displayName}]])</label>`;
          })
          .filter(Boolean)
          .join('\n');
      }
      let block = '';
      if (scheduledContent) block += `**Scheduled**\n${scheduledContent}`;
      if (recurringContent) block += (block ? '\n\n---\n' : '') + `**Event**\n${recurringContent}`;
      if (block) {
        scheduledBlock = `<div class="scheduled-items-scroll">${parseMarkdown(block)}</div>`;
      }
    }
  }
  const parsed = parseMarkdown(content);
  let parsedClean = parsed;
  if (typeof window !== 'undefined') {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = parsed;
    parsedClean = tempDiv.innerHTML;
  }
  noteEl.innerHTML = `
    <div class="heading">${box.title} <span>${dateFns.format(dayDate, 'd.M')}</span></div>
    <div class="content-wrapper" data-key="${key}">
      ${parsedClean}
      ${scheduledBlock}
    </div>
  `;
  // Attach checkbox handler for this day after re-render
  const contentWrapper = noteEl.querySelector('.content-wrapper[data-key]');
  attachPlannerCheckboxHandler(contentWrapper, key, content);
}
// --- Snap to center after manual scroll on mobile ---
function enablePlannerSnapToCenter() {
  const grid = document.getElementById('plan-grid-container');
  if (!grid) return;
  let scrollTimeout;
  grid.addEventListener('scroll', () => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      // Find the .planner-note closest to the center
      const gridRect = grid.getBoundingClientRect();
      const centerX = gridRect.left + gridRect.width / 2;
      let minDist = Infinity;
      let closest = null;
      grid.querySelectorAll('.planner-note').forEach(note => {
        const noteRect = note.getBoundingClientRect();
        const noteCenter = noteRect.left + noteRect.width / 2;
        const dist = Math.abs(centerX - noteCenter);
        if (dist < minDist) {
          minDist = dist;
          closest = note;
        }
      });
      if (closest) {
        // Snap the closest note to center
        const noteRect = closest.getBoundingClientRect();
        const scrollLeft = grid.scrollLeft;
        const gridCenter = gridRect.width / 2;
    // REPEAT (recurring)
    const repeatDatePattern = `(?:${window.DATE_REGEX_PATTERN}|\\d{2}[./-]\\d{2})`;
    const repeatRegex = new RegExp(`^(?:[-*]\\s*\\[[x ]\\]\\s*)?(.*)\\(REPEAT: \\s*(${repeatDatePattern})\\)`, 'i');
        const noteCenter = (noteRect.left - gridRect.left) + noteRect.width / 2;
        const delta = noteCenter - gridCenter;
        grid.scrollTo({ left: scrollLeft + delta, behavior: 'smooth' });
      }
    }, 120); // 120ms after scroll stops
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
    const scheduleRegex = new RegExp(`^(?:[-*]\\s*\\[[x ]\\]\\s*)?(.*)\\(SCHEDULED: \\s*${window.DATE_REGEX_PATTERN}\\)`, 'i');
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
                    const itemText = match[1].trim();
                    const dateStr = match[2];
                    if (!itemText) return;
                    let normalizedDate = window.normalizeDateStringToYyyyMmDd(dateStr);
                    if (!normalizedDate) return;
                    if (!scheduledItems.has(normalizedDate)) scheduledItems.set(normalizedDate, []);
                    scheduledItems.get(normalizedDate).push({
                        text: itemText,
                        pageKey: key,
                        displayName: pageTitle,
                        recurring: false,
                        originalDate: dateStr
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
                                originalDate: startDate
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
                                    originalDate: norm
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
                                        originalDate: monthDay
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


function scrollToCurrentPlannerDay() {
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
    const gridLeft = grid.offsetLeft;
    const gridWidth = grid.clientWidth;
    const noteLeft = note.offsetLeft;
    const noteWidth = note.offsetWidth;
    // Check if note is fully visible in the grid
    const visibleLeft = grid.scrollLeft;
    const visibleRight = visibleLeft + gridWidth;
    const noteStart = noteLeft;
    const noteEnd = noteLeft + noteWidth;
    // If the note is fully visible and roughly centered, do nothing
    const noteCenter = noteLeft + noteWidth / 2;
    const gridCenter = visibleLeft + gridWidth / 2;
    const delta = noteCenter - gridCenter;
    const tolerance = 5;
    if (noteStart >= visibleLeft && noteEnd <= visibleRight && Math.abs(delta) < tolerance) {
      return;
    }
    // Otherwise, center the note
    grid.scrollTo({ left: noteCenter - gridWidth / 2, behavior: 'smooth' });
  }
}

function renderWeeklyPlanner(scrollToToday = false) {
  // --- Preserve scroll positions ---
  const scrollPositions = {};
  document.querySelectorAll('.content-wrapper[data-key]').forEach(el => {
    scrollPositions[el.dataset.key] = el.scrollTop;
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

    // --- Build scheduled/repeat items section as markdown, but wrap in scrollable div ---
    let scheduledBlock = '';
    if (allScheduled.has(dayDateStr)) {
      const itemsForDay = allScheduled.get(dayDateStr);
      if (itemsForDay.length > 0) {
        // Separate scheduled and recurring items
        const scheduledItems = itemsForDay.filter(item => !item.recurring);
        const recurringItems = itemsForDay.filter(item => item.recurring);
        let scheduledContent = '';
        let recurringContent = '';
        if (scheduledItems.length > 0) {
          scheduledContent = scheduledItems
            .map(item => {
              const pageKey = item.pageKey;
              const pageContent = getStorage(pageKey);
              const lines = pageContent.split('\n');
              let foundIndex = -1;
              for (let idx = 0; idx < lines.length; idx++) {
                if (!lines[idx].includes(item.text)) continue;
                const dateMatch = lines[idx].match(new RegExp(window.DATE_REGEX_PATTERN));
                const lineNormDate = dateMatch ? window.normalizeDateStringToYyyyMmDd(dateMatch[0]) : null;
                if (lineNormDate === dayDateStr) { foundIndex = idx; break; }
              }
              if (foundIndex === -1) return '';
              const checked = /\[x\]/i.test(lines[foundIndex]);
              return `- [${checked ? 'x' : ' '}] ${item.text} (from [[${item.displayName}]]){key=${pageKey} line-index=${foundIndex} scheduled-date=${dayDateStr}}`;
            })
            .filter(Boolean)
            .join('\n');
        }
        if (recurringItems.length > 0) {
          recurringContent = recurringItems
            .map(item => {
              const pageKey = item.pageKey;
              const pageContent = getStorage(pageKey);
              const lines = pageContent.split('\n');
              let foundIndex = -1;
              for (let idx = 0; idx < lines.length; idx++) {
                if (!lines[idx].includes(item.text)) continue;
                if (lines[idx].includes('(REPEAT:')) { foundIndex = idx; break; }
              }
              if (foundIndex === -1) return '';
              const recurringIcon = '🔁 ';
              let ageStr = '';
              if (item.originalDate && item.originalDate.match(/^\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4}$/)) {
                const origDate = window.parseDateString(item.originalDate);
                if (origDate) {
                  const thisYear = dateFns.getYear(dayDate);
                  const origYear = dateFns.getYear(origDate);
                  const years = thisYear - origYear;
                  if (years > 0) ageStr = ` (${years} yr${years > 1 ? 's' : ''})`;
                }
              }
              const checked = /\[x\]/i.test(lines[foundIndex]);
              // Add metadata for handler: data-pagekey and data-lineidx
              return `<label class=\"planner-checkbox-label\"><input type=\"checkbox\" data-pagekey=\"${pageKey}\" data-lineidx=\"${foundIndex}\" ${checked ? 'checked' : ''}>${recurringIcon}${item.text}${ageStr} (from [[${item.displayName}]])</label>`;
            })
            .filter(Boolean)
            .join('\n');
        }
        let block = '';
        if (scheduledContent) block += `**Scheduled**\n${scheduledContent}`;
        if (recurringContent) block += (block ? '\n\n---\n' : '') + `**Event**\n${recurringContent}`;
        if (block) {
          scheduledBlock = `<div class="scheduled-items-scroll">${parseMarkdown(block)}</div>`;
        }
      }
    }

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

    // Checkbox logic: update only the [ ] or [x] state, preserve (REPEAT:) and (SCHEDULED:) tags
    if (contentWrapper) {
      contentWrapper.addEventListener('change', function(e) {
        if (e.target && e.target.type === 'checkbox') {
          // Find the text after the checkbox in the day content
          let checkboxText = e.target.parentNode ? e.target.parentNode.textContent.trim() : '';
          checkboxText = checkboxText.replace(/^\[.\]\s*/, '').replace(/^\s*-\s*/, '').trim();
          let lines = content.split('\n');
          let changed = false;
          for (let i = 0; i < lines.length; i++) {
            // Match a markdown task line
            let match = lines[i].match(/^([-*])\s*\[( |x)\]\s*(.*)$/i);
            if (match) {
              let lineText = match[3].replace(/\s*(\(REPEAT:[^)]+\))?\s*(\(SCHEDULED:[^)]+\))?\s*$/, '').trim();
              if (lineText === checkboxText) {
                // Preserve (REPEAT:) and (SCHEDULED:) tags
                let repeatTag = (lines[i].match(/\(REPEAT:[^)]+\)/) || [''])[0];
                let schedTag = (lines[i].match(/\(SCHEDULED:[^)]+\)/) || [''])[0];
                lines[i] = `${match[1]} [${e.target.checked ? 'x' : ' '}] ${lineText}`
                  + (schedTag ? ' ' + schedTag : '')
                  + (repeatTag ? ' ' + repeatTag : '');
                changed = true;
                break;
              }
            }
          }
          if (changed) {
            setStorage(key, lines.join('\n'));
            updatePlannerDay(key);
          }
        }
      });
    }
  });

  // Only scroll to the current day if requested
  if (scrollToToday) setTimeout(scrollToCurrentPlannerDay, 100);
  // Enable snap-to-center after manual scroll (only needs to be enabled once, but safe to call repeatedly)
  if (window.innerWidth <= 768) enablePlannerSnapToCenter();
}

