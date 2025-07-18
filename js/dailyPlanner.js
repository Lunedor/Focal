// --- /js/dailyPlanner.js (Refactored for CSS file & DRY Principle) ---

// ====================================================================================
//  DAILY PLANNER VIEW LOGIC
//  This file is responsible for rendering the Daily Planner (Hourly & Gantt views).
//  It is a pure UI component that consumes data from the centralized `window.getAllScheduledItems()`.
// ====================================================================================

/**
 * Main function to render the entire Daily Planner component.
 * @param {boolean} scrollToToday - If true, scrolls the view to the current date.
 */
function renderDailyPlanner(scrollToToday = false) {
    // --- Get DOM elements ---
    const dailyView = document.getElementById('daily-view');
    const dailyTitle = document.getElementById('daily-title');
    const dailyContent = document.getElementById('daily-content-wrapper');
    if (!dailyTitle || !dailyContent) return;

    // --- Get state and user preferences ---
    const today = appState.currentDate || new Date();
    const mode = localStorage.getItem('dailyPlannerMode') || 'hourly';
    const startHour = parseInt(localStorage.getItem('dailyPlannerStartHour') || '0', 10);
    const endHour = parseInt(localStorage.getItem('dailyPlannerEndHour') || '24', 10);

    // Set title
    dailyTitle.textContent = `Daily Planner`;

    // --- Render shell and controls ---
    renderShellAndControls(dailyContent, today, mode, startHour, endHour);

    // --- Attach general event listeners ---
    attachNavigationHandlers(today);
    attachControlHandlers(startHour, endHour);

    // --- Get and process data ---
    const itemsForToday = getAndSortItemsForToday(today);


    // Filter out PROMPT items so they are not treated as all-day events in views
    const itemsForView = itemsForToday.filter(item => !/^PROMPT:?/i.test(item.text));

    // --- Render main content based on mode ---
    const mainContent = document.getElementById('daily-main-content');
    const promptHtml = generatePromptsHtml(itemsForToday, today); // Generate prompts once

    if (mode === 'hourly') {
        renderHourlyView(mainContent, itemsForView, startHour, endHour, promptHtml);
    } else if (mode === 'gantt') {
        renderGanttView(mainContent, itemsForView, startHour, endHour, promptHtml);
    }

    // --- Attach universal event handlers ---
    attachUniversalWikiLinkHandlers(mainContent);
    attachUniversalCheckboxHandlers(mainContent);
}

/**
 * Renders the main structure (shell), controls (dropdowns), and date navigation.
 */
function renderShellAndControls(container, today, mode) {
    container.innerHTML = `
    <div class="planner-dropdown-group">
      <div class="planner-control-group">
        <select id="daily-mode-select" class="planner-dropdown">
          <option value="hourly"${mode === 'hourly' ? ' selected' : ''}>Hourly Table</option>
          <option value="gantt"${mode === 'gantt' ? ' selected' : ''}>Gantt Timeline</option>
        </select>
      </div>
      <div class="planner-control-group">
        <select id="start-hour-select" class="planner-dropdown time-picker-select"></select>
        <select id="end-hour-select" class="planner-dropdown time-picker-select"></select>
      </div>
    </div>
    <div class="daily-date-nav-row" id="planner-date-nav-row">
      <div class="daily-date-nav">
        <button class="daily-nav-btn" id="planner-prev-day-btn" title="Previous day"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"></polyline></svg></button>
        <div class="daily-date-display">
          <div class="daily-date-main" id="planner-date-main">${dateFns.format(today, 'yyyy-MM-dd')}</div>
          <div class="daily-date-info" id="planner-date-info">${dateFns.isToday(today) ? 'Today' : dateFns.isFuture(today) ? 'Future' : 'Past'}</div>
        </div>
        <button class="daily-nav-btn" id="planner-next-day-btn" title="Next day"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"></polyline></svg></button>
      </div>
      <div class="daily-date-nav-actions">
        <button class="planner-today-btn" id="planner-today-btn" title="Go to today" style="display:${dateFns.isToday(today) ? 'none' : 'inline-flex'}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg> Today</button>
        <button class="planner-date-picker-button" id="planner-date-picker-btn" title="Pick a date"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Date</button>
      </div>
    </div>
    <div id="daily-main-content"></div>`;
}

/**
 * Attaches event listeners for date navigation buttons.
 */
function attachNavigationHandlers(today) {
    const setPlannerDate = (newDate) => {
        appState.currentDate = newDate;
        renderDailyPlanner();
    };

    document.getElementById('planner-prev-day-btn').addEventListener('click', () => {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        setPlannerDate(d);
    });

    document.getElementById('planner-next-day-btn').addEventListener('click', () => {
        const d = new Date(today);
        d.setDate(d.getDate() + 1);
        setPlannerDate(d);
    });

    document.getElementById('planner-today-btn').addEventListener('click', () => setPlannerDate(new Date()));

    document.getElementById('planner-date-picker-btn').addEventListener('click', (e) => {
        window.CentralizedDatePicker.showModalDatePicker({
            anchorElement: e.currentTarget,
            initialDate: today,
            theme: 'unified',
            onDateSelected: (pickedDateObj) => {
                if (pickedDateObj && pickedDateObj.pickedDate) {
                    setPlannerDate(pickedDateObj.pickedDate);
                }
            }
        });
    });
}

/**
 * Attaches event listeners for view mode and time range controls.
 */
function attachControlHandlers(startHour, endHour) {
    // Mode switcher
    document.getElementById('daily-mode-select').addEventListener('change', function() {
        localStorage.setItem('dailyPlannerMode', this.value);
        renderDailyPlanner();
    });

    // Time pickers
    const startSelect = document.getElementById('start-hour-select');
    const endSelect = document.getElementById('end-hour-select');
    if (!startSelect || !endSelect) return;

    let startOptions = '';
    for (let i = 0; i <= 23; i++) {
        startOptions += `<option value="${i}"${i === startHour ? ' selected' : ''}>${i.toString().padStart(2, '0')}:00</option>`;
    }
    startSelect.innerHTML = startOptions;

    let endOptions = '';
    for (let i = startHour + 1; i <= 24; i++) {
        endOptions += `<option value="${i}"${i === endHour ? ' selected' : ''}>${i.toString().padStart(2, '0')}:00</option>`;
    }
    endSelect.innerHTML = endOptions;

    startSelect.addEventListener('change', function() {
        const newStart = parseInt(this.value, 10);
        localStorage.setItem('dailyPlannerStartHour', newStart);
        if (newStart >= endHour) {
            localStorage.setItem('dailyPlannerEndHour', newStart + 1);
        }
        renderDailyPlanner();
    });

    endSelect.addEventListener('change', function() {
        localStorage.setItem('dailyPlannerEndHour', parseInt(this.value, 10));
        renderDailyPlanner();
    });
}

/**
 * Fetches data for the given day and sorts it.
 * @returns {Array} Sorted array of scheduled items.
 */
function getAndSortItemsForToday(today) {
    const todayDateStr = dateFns.format(today, 'yyyy-MM-dd');
    const allScheduled = window.getAllScheduledItems();
    let itemsForToday = allScheduled.get(todayDateStr) || [];

    itemsForToday.sort((a, b) => {
        const aIsAllDay = !a.time;
        const bIsAllDay = !b.time;
        if (aIsAllDay !== bIsAllDay) return aIsAllDay ? -1 : 1;
        if (aIsAllDay && bIsAllDay) return (a.text || '').localeCompare(b.text || '');
        if (a.time === b.time) {
            if (a.endTime && b.endTime) return a.endTime.localeCompare(b.endTime);
            if (a.endTime) return -1;
            if (b.endTime) return 1;
            return 0;
        }
        return a.time.localeCompare(b.time);
    });
    return itemsForToday;
}

/**
 * Generates the HTML for the PROMPTs section. This logic is shared between views.
 * @returns {string} The HTML string for the prompts section.
 */
function generatePromptsHtml(itemsForToday, today) {
    let html = '';
    let allPrompts = [];
    const pageKey = itemsForToday.length > 0 ? itemsForToday[0].pageKey : null;
    const pageContent = pageKey ? getStorage(pageKey) : '';
    const todayDateStr = dateFns.format(today, 'yyyy-MM-dd');

    if (pageContent) {
        const blocks = pageContent.split(/^(?=PROMPT)/m).filter(Boolean);
        blocks.forEach(block => {
            const promptMatch = block.match(/^PROMPT(?:\(([^)]*)\))?:\s*([\s\S]*)/i);
            if (!promptMatch) return;

            let attributesStr = promptMatch[1] || '';
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
        });
    }

    if (allPrompts.length > 0) {
        html += `<div id="daily-prompts-section">`;
        allPrompts.forEach(item => {
            let promptText = (window.getPromptForDate || getPromptForDate)(item.text, item.attributes, today);
                if (typeof console !== 'undefined') {
                    console.log('[PROMPT UI DEBUG] Rendering prompt', {
                        date: dateFns.format(today, 'yyyy-MM-dd'),
                        item,
                        promptText
                    });
                }
            if (promptText) {
                html += `<blockquote class="prompt-blockquote"><span class="prompt-icon">❝</span> ${promptText} <span class="prompt-icon">❞</span></blockquote>`;
            }
        });
        html += `</div>`;
    }
    return html;
}

/**
 * Renders the Hourly table view.
 */
function renderHourlyView(container, items, startHour, endHour, promptHtml) {
    let html = promptHtml;
    html += `<table class="hourly-table app-table">
        <thead><tr><th class="hour-col">Time</th><th class="task-col">Task</th><th class="status-col">Status</th></tr></thead>
        <tbody>`;

    const allDayTasks = items.filter(item => !item.time && !/^PROMPT:?/i.test(item.text));
    if (allDayTasks.length > 0) {
        html += `<tr class="hour-row all-day-row"><td class="hour-label">All Day</td><td class="task-cell">`;
        html += allDayTasks.map(item => `<div class="task-block all-day-task-block"><span>${item.displayName ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${item.displayName}'>${item.text || ''}</a>` : (item.text || '')}</span></div>`).join('');
        html += `</td><td class="status-cell">`;
        html += allDayTasks.map(item => `<div class="all-day-status">${item.isCheckbox ? `<input type="checkbox" class="hourly-checkbox" data-key="${item.pageKey}" data-line-index="${item.lineIndex}" ${item.checkboxState ? 'checked' : ''} />` : (item.checkboxState ? '✔' : '📅')}</div>`).join('');
        html += `</td></tr>`;
    }

    const occupied = {};
    items.forEach((item, idx) => {
        if (!item.time) return;
        const [startH, startM] = item.time.split(':').map(Number);
        const startMin = startH * 60 + (startM || 0);
        let endMin = startMin;
        if (item.endTime) {
            const [endH, endM] = item.endTime.split(':').map(Number);
            endMin = endH * 60 + (endM || 0);
        }
        for (let m = startMin; m < (item.endTime ? endMin : startMin + 1); m++) {
            occupied[m] = idx;
        }
    });

    const getColor = idx => ['#5DADE2', '#58D68D', '#F5B041', '#AF7AC5', '#EC7063', '#48C9B0', '#F7DC6F', '#AAB7B8'][idx % 8];
    const renderedTaskRows = new Set();

    for (let hour = startHour; hour < endHour; hour++) {
        const hourStart = hour * 60;
        let foundTaskIdx = Object.values(occupied).find(idx => items[idx] && items[idx].time && (Math.floor((items[idx].time.split(':')[0] * 60 + (items[idx].time.split(':')[1] || 0))) === hourStart));
        
        let foundTask = foundTaskIdx !== undefined ? items[foundTaskIdx] : null;

        let showDetails = false;
        let showBar = false;
        let barLeft = 0, barWidth = 0;

        // Determine if a task starts in this hour slot for rendering its details
        const taskInThisHour = items.find((item, idx) => {
            if (!item.time) return false;
            const itemHour = new Date(`1970-01-01T${item.time}`).getHours();
            if (hour === itemHour && !renderedTaskRows.has(idx)) {
                foundTask = item;
                foundTaskIdx = idx;
                return true;
            }
            return false;
        });

        if (foundTask && !renderedTaskRows.has(foundTaskIdx)) {
            if (foundTask.time && foundTask.endTime) {
                const [startH, startM] = foundTask.time.split(':').map(Number);
                const [endH, endM] = foundTask.endTime.split(':').map(Number);
                const startMin = startH * 60 + startM;
                const endMin = endH * 60 + endM;
                if (hour >= Math.floor(startMin / 60) && hour < Math.ceil(endMin / 60)) {
                    showBar = true;
                    const currentBarStart = Math.max(startMin, hour * 60);
                    const currentBarEnd = Math.min(endMin, (hour + 1) * 60);
                    barLeft = ((currentBarStart - hour * 60) / 60) * 100;
                    barWidth = ((currentBarEnd - currentBarStart) / 60) * 100;
                }
            }
             if (hour === new Date(`1970-01-01T${foundTask.time}`).getHours()) {
                showDetails = true;
             }
        }
        
        html += `<tr class="hour-row ${hour % 2 === 0 ? 'even-row' : 'odd-row'}">
            <td class="hour-label">${hour.toString().padStart(2, '0')}:00</td>
            <td class="task-cell">`;

        if (showBar) {
            html += `<div class="hourly-gantt-bar" style="left:${barLeft}%; width:${barWidth}%; background:${getColor(foundTaskIdx)};"></div>`;
        }

        if (showDetails) {
            let timeDisplay = foundTask.time ? (foundTask.endTime ? `${foundTask.time}-${foundTask.endTime}` : foundTask.time) : 'All Day';
            let taskContent = foundTask.displayName ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${foundTask.displayName}'>${foundTask.text || ''}</a>` : `<span>${foundTask.text || ''}</span>`;
            html += `<div class="task-block hourly-task-block" ${!foundTask.endTime ? 'style="border-left: 3px solid #5DADE2; border-radius:6px; padding: 0.3em 0.7em;"' : ''}>
                        <span class="hourly-task-time">${timeDisplay}</span> ${taskContent}
                     </div>`;
            renderedTaskRows.add(foundTaskIdx);
        }
        
        html += `</td><td class="status-cell">`;
        if (showDetails && foundTask) {
            html += foundTask.isCheckbox ? `<input type="checkbox" class="hourly-checkbox" data-key="${foundTask.pageKey}" data-line-index="${foundTask.lineIndex}" ${foundTask.checkboxState ? 'checked' : ''} />` : (foundTask.checkboxState ? '✔' : '📅');
        }
        html += `</td></tr>`;
    }
    html += `</tbody></table>`;
    container.innerHTML = html;
}

/**
 * Renders the Gantt timeline view.
 */
function renderGanttView(container, items, startHour, endHour, promptHtml) {
    const timelineStart = startHour * 60;
    const timelineEnd = endHour * 60;
    const timelineDuration = timelineEnd - timelineStart;

    const itemsInView = items.filter(item => {
        if (!item.time) return true;
        const [itemStartH] = item.time.split(':').map(Number);
        if (!item.endTime) return itemStartH >= startHour && itemStartH < endHour;
        const [itemEndH, itemEndM] = item.endTime.split(':').map(Number);
        const effectiveEndH = (itemEndH === 0 && itemEndM === 0) ? 24 : itemEndH;
        return itemStartH < endHour && effectiveEndH > startHour;
    });

    const getColor = idx => ['#5DADE2', '#58D68D', '#F5B041', '#AF7AC5', '#EC7063', '#48C9B0', '#F7DC6F', '#AAB7B8'][items.indexOf(itemsInView[idx]) % 8];

    let hourLabels = '';
    if (timelineDuration > 0) {
        for (let h = startHour; h <= endHour; h++) {
            const left = ((h * 60 - timelineStart) / timelineDuration) * 100;
            let transform = 'translateX(-50%)';
            if (h === startHour) transform = 'translateX(0)';
            else if (h === endHour) transform = 'translateX(-100%)';
            hourLabels += `<span class="gantt-hour-label" style="left: ${left}%; transform: ${transform};">${h.toString().padStart(2, '0')}:00</span>`;
        }
    }

    let html = promptHtml + `<div class="gantt-container"><div class="gantt-labels-column"><div class="gantt-header-spacer"></div>`;
    itemsInView.forEach(item => {
        let labelClass = "gantt-task-label" + (!item.time ? " type-allday" : (item.time && !item.endTime ? " type-point" : ""));
        html += `<div class="${labelClass}">`;
        if (item.isCheckbox) {
            html += `<input type="checkbox" class="gantt-checkbox" data-key="${item.pageKey}" data-line-index="${item.lineIndex}" ${item.checkboxState ? 'checked' : ''} />`;
        }
        html += item.displayName ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${item.displayName}'>${item.text || ''}</a>` : `<span>${item.text || ''}</span>`;
        html += `</div>`;
    });
    html += `</div><div class="gantt-timeline-column"><div class="gantt-timeline-inner"><div class="gantt-hour-labels">${hourLabels}</div>`;

    if (timelineDuration > 0) {
        itemsInView.forEach((item, idx) => {
            html += `<div class="gantt-timeline-row">`;
            for (let h = startHour + 1; h < endHour; h++) {
                html += `<div class="gantt-hour-line" style="left:${((h * 60 - timelineStart) / timelineDuration) * 100}%;"></div>`;
            }

            if (!item.time) {
                html += `<div class="gantt-bar-allday" style="background:${getColor(idx)};"><span class="gantt-bar-allday-text">All Day</span></div>`;
            } else if (item.time && item.endTime) {
                const [startH, startM] = item.time.split(':').map(Number);
                const [endH, endM] = item.endTime.split(':').map(Number);
                const startTotal = startH * 60 + startM;
                const endTotal = endH * 60 + endM;
                const clampedStart = Math.max(startTotal, timelineStart);
                const clampedEnd = Math.min(endTotal, timelineEnd);
                const left = ((clampedStart - timelineStart) / timelineDuration) * 100;
                const width = ((clampedEnd - clampedStart) / timelineDuration) * 100;

                if (width > 0) {
                    html += `<span class="gantt-bar-time-label gantt-bar-time-label-start" style='left:calc(${left}% - 75px);'>${item.time}</span>`;
                    html += `<div class="gantt-bar-timed" style="left:${left}%; width:${width}%; background:${getColor(idx)};"></div>`;
                    html += `<span class="gantt-bar-time-label gantt-bar-time-label-end" style='left:calc(${left + width}% - 35px);'>${item.endTime}</span>`;
                }
            } else if (item.time) {
                const [startH, startM] = item.time.split(':').map(Number);
                const left = (((startH * 60 + startM) - timelineStart) / timelineDuration) * 100;
                html += `<div class="gantt-point-container" style="left:calc(${left}% - 8px);">
                           <div class="gantt-point-marker" style="background:${getColor(idx)}; box-shadow: 0 0 0 2px ${getColor(idx)};"></div>
                           <span class="gantt-point-label">${item.time}</span></div>`;
            }
            html += `</div>`;
        });
    }
    html += `</div></div></div>`;
    container.innerHTML = html;
}

/**
 * Attaches event handlers to all wiki links in the main content area.
 */
function attachUniversalWikiLinkHandlers(mainContent) {
    mainContent.querySelectorAll('.wiki-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageName = this.getAttribute('data-page-link');
            if (pageName && window.appState) {
                appState.currentView = pageName;
                renderApp(); // Assuming a global renderApp function exists
            }
        });
    });
}

/**
 * Attaches event handlers to all checkboxes in the main content area.
 */
function attachUniversalCheckboxHandlers(mainContent) {
    mainContent.querySelectorAll('.hourly-checkbox, .gantt-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function(e) {
            const cb = e.target;
            const dataKey = cb.getAttribute('data-key');
            const dataLineIndex = cb.getAttribute('data-line-index');
            if (!dataKey || dataLineIndex === null) return;

            const fullText = getStorage(dataKey);
            const lines = fullText.split('\n');
            const idx = parseInt(dataLineIndex, 10);
            if (isNaN(idx) || !lines[idx]) return;

            lines[idx] = lines[idx].includes('[ ]') ? lines[idx].replace('[ ]', '[x]') : lines[idx].replace(/\[x\]/i, '[ ]');
            setStorage(dataKey, lines.join('\n'));
            if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
            renderDailyPlanner();
        });
    });
}