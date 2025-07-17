// --- /js/dailyPlanner.js (Refactored for CSS file) ---

// ====================================================================================
//  DAILY PLANNER VIEW LOGIC
//  This file is responsible for rendering the Daily Planner (Hourly & Gantt views).
//  It is a pure UI component that consumes data from the centralized `window.getAllScheduledItems()`.
// ====================================================================================

function renderDailyPlanner(scrollToToday = false) {
    // --- Get DOM elements ---
    const dailyView = document.getElementById('daily-view');
    const dailyTitle = document.getElementById('daily-title');
    const dailyContent = document.getElementById('daily-content-wrapper');
    if (!dailyTitle || !dailyContent) return;

    // --- Get state and user preferences ---
    const today = appState.currentDate || new Date();
    let mode = localStorage.getItem('dailyPlannerMode') || 'hourly';
    let startHour = parseInt(localStorage.getItem('dailyPlannerStartHour') || '0', 10);
    let endHour = parseInt(localStorage.getItem('dailyPlannerEndHour') || '24', 10);

    // Set title
    dailyTitle.textContent = `Daily Planner`;

    // --- Render Controls ---
    dailyContent.innerHTML = `
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
      <button class="daily-nav-btn" id="planner-prev-day-btn" title="Previous day">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"></polyline></svg>
      </button>
      <div class="daily-date-display">
        <div class="daily-date-main" id="planner-date-main">${dateFns.format(today, 'yyyy-MM-dd')}</div>
        <div class="daily-date-info" id="planner-date-info">${dateFns.isToday(today) ? 'Today' : dateFns.isFuture(today) ? 'Future' : 'Past'}</div>
      </div>
      <button class="daily-nav-btn" id="planner-next-day-btn" title="Next day">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"></polyline></svg>
      </button>
      </div>
      <div class="daily-date-nav-actions">
      <button class="planner-today-btn" id="planner-today-btn" title="Go to today" style="display:${dateFns.isToday(today) ? 'none' : 'inline-flex'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12,6 12,12 16,14"></polyline></svg>
        Today
      </button>
      <button class="planner-date-picker-button" id="planner-date-picker-btn" title="Pick a date">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
        Date
      </button>
      </div>
    </div>
    <div id="daily-main-content"></div>
    `;
    // --- Date Navigation Handlers ---
    const prevDayBtn = document.getElementById('planner-prev-day-btn');
    const nextDayBtn = document.getElementById('planner-next-day-btn');
    const todayBtn = document.getElementById('planner-today-btn');
    const datePickerBtn = document.getElementById('planner-date-picker-btn');

    function setPlannerDate(newDate) {
      appState.currentDate = newDate;
      renderDailyPlanner();
    }

    prevDayBtn.addEventListener('click', function() {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      setPlannerDate(d);
    });
    nextDayBtn.addEventListener('click', function() {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      setPlannerDate(d);
    });
    todayBtn.addEventListener('click', function() {
      setPlannerDate(new Date());
    });
    datePickerBtn.addEventListener('click', function() {
      window.CentralizedDatePicker.showModalDatePicker({
        anchorElement: datePickerBtn,
        initialDate: today,
        theme: 'unified',
        onDateSelected: function(pickedDateObj) {
          // CentralizedDatePicker returns { isoDate, displayDate, pickedDate }
          if (pickedDateObj && pickedDateObj.pickedDate) {
            setPlannerDate(pickedDateObj.pickedDate);
          }
        }
      });
    });

    // --- Setup Time Pickers ---
    function setupTimePickers() {
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

    const modeSelect = document.getElementById('daily-mode-select');
    if (modeSelect) {
        modeSelect.addEventListener('change', function() {
            localStorage.setItem('dailyPlannerMode', this.value);
            renderDailyPlanner();
        });
    }

    setupTimePickers();

    // --- Get all data from the centralized function ---
    const todayDateStr = dateFns.format(today, 'yyyy-MM-dd');
    const allScheduled = window.getAllScheduledItems();
    let itemsForToday = allScheduled.get(todayDateStr) || [];

    // --- Sort items ---
    itemsForToday.sort((a, b) => {
        const aIsAllDay = !a.time;
        const bIsAllDay = !b.time;
        if (aIsAllDay && !bIsAllDay) return -1;
        if (!aIsAllDay && bIsAllDay) return 1;
        if (aIsAllDay && bIsAllDay) return (a.text || '').localeCompare(b.text || '');
        if (a.time === b.time) {
            if (a.endTime && b.endTime) return a.endTime.localeCompare(b.endTime);
            if (a.endTime) return -1;
            if (b.endTime) return 1;
            return 0;
        }
        return a.time.localeCompare(b.time);
    });

    // --- Render main content based on mode ---
    const mainContent = document.getElementById('daily-main-content');
    if (mode === 'hourly') {
        // Render PROMPTs above the table, formatted as blockquote, using block-based parsing
        let html = '';
        let allPrompts = [];
        // Get full page content for today
        let pageKey = itemsForToday.length > 0 ? itemsForToday[0].pageKey : null;
        let pageContent = pageKey ? getStorage(pageKey) : '';
        if (pageContent) {
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
        if (allPrompts.length > 0) {
            html += `<div id="daily-prompts-section">`;
            allPrompts.forEach(item => {
                let promptText = item.text;
                let showBlock = true;
                // Handle daily-sequential mode
                if (item.attributes && item.attributes.mode === 'daily-sequential') {
                    let items = promptText.split(/\r?\n/).map(line => line.replace(/^[-*]\s*/, '').trim()).filter(line => line.length > 0);
                    let startDateStr = item.attributes.start || dateFns.format(today, 'yyyy-MM-dd');
                    let startDate = new Date(startDateStr + 'T00:00:00');
                    let diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays < items.length) {
                        promptText = items[diffDays];
                    } else {
                        showBlock = false;
                    }
                }
                // Handle daily-random mode
                if (item.attributes && item.attributes.mode === 'daily-random') {
                    let items = promptText.split(/\r?\n/).map(line => line.replace(/^[-*]\s*/, '').trim()).filter(line => line.length > 0);
                    if (items.length > 0) {
                        // Seeded shuffle function (Fisher-Yates)
                        function mulberry32(a) {
                            return function() {
                                var t = a += 0x6D2B79F5;
                                t = Math.imul(t ^ t >>> 15, t | 1);
                                t ^= t + Math.imul(t ^ t >>> 7, t | 61);
                                return ((t ^ t >>> 14) >>> 0) / 4294967296;
                            }
                        }
                        function seededShuffle(array, seed) {
                            let m = array.length, t, i;
                            let random = mulberry32(seed);
                            while (m) {
                                i = Math.floor(random() * m--);
                                t = array[m];
                                array[m] = array[i];
                                array[i] = t;
                            }
                            return array;
                        }
                        // Use todayDateStr as seed (convert to number)
                        let seed = 0;
                        for (let i = 0; i < todayDateStr.length; i++) seed += todayDateStr.charCodeAt(i);
                        const shuffled = seededShuffle([...items], seed);
                        promptText = shuffled[0];
                    } else {
                        showBlock = false;
                    }
                }
                // Only render blockquote if promptText is non-empty and showBlock is true
                if (showBlock && promptText) {
                    html += `<blockquote class="prompt-blockquote"><span class="prompt-icon">❝</span> ${promptText} <span class="prompt-icon">❞</span></blockquote>`;
                }
            });
            html += `</div>`;
        }
        html += `<table class="hourly-table app-table">
      <thead><tr><th class="hour-col">Time</th><th class="task-col">Task</th><th class="status-col">Status</th></tr></thead><tbody>`;

        allDayTasks = itemsForToday.filter(item => !item.time && !/^PROMPT:?/i.test(item.text)); if (allDayTasks.length > 0) 
        if (allDayTasks.length > 0) {
            html += `<tr class="hour-row all-day-row"><td class="hour-label">All Day</td><td class="task-cell">`;
            html += allDayTasks.map((item) => {
                const content = item.displayName ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${item.displayName}'>${item.text || ''}</a>` : (item.text || '');
                return `<div class="task-block all-day-task-block">
                    <span>${content}</span>
                </div>`;
            }).join('');
            html += `</td><td class="status-cell">`;
            
            html += allDayTasks.map((item) => {
                let statusIndicator;
                if (item.isCheckbox) {
                    statusIndicator = `<input type="checkbox" class="hourly-checkbox" data-key="${item.pageKey}" data-line-index="${item.lineIndex}" ${item.checkboxState ? 'checked' : ''} />`;
                } else {
                    statusIndicator = item.checkboxState ? '✔' : '📅';
                }
                return `<div class="all-day-status">${statusIndicator}</div>`;
            }).join('');
    
            html += `</td></tr>`;
        }

        // --- The rest of the hourly rendering logic ---
        const occupied = {};
        itemsForToday.forEach((item, idx) => {
            if (item.time) {
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
            }
        });

        function getColor(idx) {
            const palette = ['#5DADE2', '#58D68D', '#F5B041', '#AF7AC5', '#EC7063', '#48C9B0', '#F7DC6F', '#AAB7B8'];
            return palette[idx % palette.length];
        }

        const renderedTaskRows = new Set();
        for (let hour = startHour; hour < endHour; hour++) {
            const hourStart = hour * 60;
            const hourEnd = (hour + 1) * 60;
            let foundTask = null;
            let foundTaskIdx = null;
            for (let m = hourStart; m < hourEnd; m++) {
                if (occupied[m] !== undefined) {
                    foundTaskIdx = occupied[m];
                    foundTask = itemsForToday[foundTaskIdx];
                    break;
                }
            }
            
            let showDetails = false;

            html += `<tr class="hour-row ${hour % 2 === 0 ? 'even-row' : 'odd-row'}"> <td class="hour-label">${hour.toString().padStart(2, '0')}:00</td> <td class="task-cell">`;
            if (foundTask) {
                let showBar = false;
                let barLeft = 0, barWidth = 0;
                if (foundTask.time && foundTask.endTime) {
                    const [startH, startM] = foundTask.time.split(':').map(Number);
                    const [endH, endM] = foundTask.endTime.split(':').map(Number);
                    const startMin = startH * 60 + (startM || 0);
                    const endMin = endH * 60 + (endM || 0);
                    const firstEventHour = Math.floor(startMin / 60);

                    if (hour >= firstEventHour && hour < Math.floor(endMin / 60) + (endMin % 60 === 0 ? 0 : 1)) {
                         showBar = true;
                         const currentBarStart = Math.max(startMin, hourStart);
                         const currentBarEnd = Math.min(endMin, hourEnd);
                         barLeft = ((currentBarStart - hourStart) / 60) * 100;
                         barWidth = ((currentBarEnd - currentBarStart) / 60) * 100;
                         if (hour === firstEventHour) showDetails = true;
                    }
                } else if(foundTask.time) {
                    if(hour === new Date(`1970-01-01T${foundTask.time}`).getHours()) showDetails = true;
                }
                if (showBar) {
                    html += `<div class="hourly-gantt-bar" style="left:${barLeft}%; width:${barWidth}%; background:${getColor(foundTaskIdx)};"></div>`;
                }
                if (showDetails && !renderedTaskRows.has(foundTaskIdx)) {
                    let timeDisplay = foundTask.time ? (foundTask.endTime ? `${foundTask.time}-${foundTask.endTime}`: foundTask.time) : 'All Day';
                    // If event has only start time, wrap the whole block with a left border like all-day events
                    if (!foundTask.endTime && foundTask.time) {
                        html += `<div class="task-block hourly-task-block" style="border-left: 3px solid #5DADE2; border-radius:6px; padding: 0.3em 0.7em;"> <span class="hourly-task-time">${timeDisplay}</span> `;
                        html += foundTask.displayName ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${foundTask.displayName}'>${foundTask.text || ''}</a>` : `<span>${foundTask.text || ''}</span>`;
                        html += `</div>`;
                    } else {
                        html += `<div class="task-block hourly-task-block"> <span class="hourly-task-time">${timeDisplay}</span> `;
                        html += foundTask.displayName ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${foundTask.displayName}'>${foundTask.text || ''}</a>` : `<span>${foundTask.text || ''}</span>`;
                        html += `</div>`;
                    }
                    renderedTaskRows.add(foundTaskIdx);
                }
            }
            html += `</td> <td class="status-cell">`;

            if (foundTask && showDetails) {
                if (foundTask.isCheckbox) {
                    html += `<input type="checkbox" class="hourly-checkbox" data-key="${foundTask.pageKey}" data-line-index="${foundTask.lineIndex}" ${foundTask.checkboxState ? 'checked' : ''} />`;
                } else {
                    html += foundTask.checkboxState ? '✔' : '📅';
                }
            }
            html += `</td></tr>`;
        }
        html += '</tbody></table>';
        mainContent.innerHTML = html;

        // Attach event handlers
        mainContent.querySelectorAll('.hourly-checkbox').forEach(checkbox => {
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
                if(typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
                renderDailyPlanner();
            });
        });

    } else if (mode === 'gantt') {
        // --- Gantt rendering logic ---
        const timelineStart = startHour * 60;
        const timelineEnd = endHour * 60;
        const timelineDuration = timelineEnd - timelineStart;

        const itemsInView = itemsForToday.filter(item => {
            if (!item.time) return true;
            const [itemStartH] = item.time.split(':').map(Number);
            if (!item.endTime) return itemStartH >= startHour && itemStartH < endHour;
            const [itemEndH, itemEndM] = item.endTime.split(':').map(Number);
            const effectiveEndH = (itemEndH === 0 && itemEndM === 0) ? 24 : itemEndH;
            return itemStartH < endHour && effectiveEndH > startHour;
        });

        function getColor(idx) {
            const palette = ['#5DADE2', '#58D68D', '#F5B041', '#AF7AC5', '#EC7063', '#48C9B0', '#F7DC6F', '#AAB7B8'];
            return palette[itemsForToday.indexOf(itemsInView[idx]) % palette.length];
        }
        
        let hourLabels = '';
        if (timelineDuration > 0) {
            for (let h = startHour; h <= endHour; h++) {
                const hourLeftPercent = ((h * 60 - timelineStart) / timelineDuration) * 100;
                let transformStyle = 'translateX(-50%)';
                if (h === startHour) transformStyle = 'translateX(0)';
                else if (h === endHour) transformStyle = 'translateX(-100%)';
                hourLabels += `<span class="gantt-hour-label" style="left: ${hourLeftPercent}%; transform: ${transformStyle};">${h.toString().padStart(2, '0')}:00</span>`;
            }
        }
        
        html = `<div class="gantt-container"><div class="gantt-labels-column"><div class="gantt-header-spacer"></div>`;
        if (itemsInView.length > 0) {
            itemsInView.forEach(item => {
                let labelClass = "gantt-task-label";
                if (!item.time) { labelClass += " type-allday"; }
                else if (item.time && !item.endTime) { labelClass += " type-point"; }

                html += `<div class="${labelClass}">`;
                if (item.isCheckbox) {
                    html += `<input type="checkbox" class="gantt-checkbox" data-key="${item.pageKey}" data-line-index="${item.lineIndex}" ${item.checkboxState ? 'checked' : ''} />`;
                }
                html += item.displayName ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${item.displayName}'>${item.text || ''}</a>` : `<span>${item.text || ''}</span>`;
                html += `</div>`;
            });
        }
        html += `</div><div class="gantt-timeline-column"><div class="gantt-timeline-inner"><div class="gantt-hour-labels">${hourLabels}</div>`;
        
        if (itemsInView.length > 0 && timelineDuration > 0) {
            itemsInView.forEach((item, idx) => {
                let color = getColor(idx);
                let rowHtml = `<div class="gantt-timeline-row">`;
                
                // Draw vertical hour lines
                for (let h = startHour + 1; h < endHour; h++) {
                    let hourLeft = ((h * 60 - timelineStart) / timelineDuration) * 100;
                    rowHtml += `<div class="gantt-hour-line" style="left:${hourLeft}%;"></div>`;
                }

                // Draw the bar for the event
                if (!item.time) {
                    rowHtml += `<div class="gantt-bar-allday" style="background:${color};"><span class="gantt-bar-allday-text">All Day</span></div>`;
                } else if (item.time && item.endTime) {
                    const [startH, startM] = item.time.split(':').map(Number);
                    const startTotal = startH * 60 + (startM || 0);
                    const [endH, endM] = item.endTime.split(':').map(Number);
                    const endTotal = endH * 60 + (endM || 0);
                    
                    const clampedStart = Math.max(startTotal, timelineStart);
                    const clampedEnd = Math.min(endTotal, timelineEnd);
                    
                    const leftPercent = ((clampedStart - timelineStart) / timelineDuration) * 100;
                    const widthPercent = ((clampedEnd - clampedStart) / timelineDuration) * 100;
                    
                    if(widthPercent > 0){
                      // Start time label before the bar
                      rowHtml += `<span class="gantt-bar-time-label gantt-bar-time-label-start" style='left:calc(${leftPercent}% - 75px);'>${item.time}</span>`;
                      // The bar itself
                      rowHtml += `<div class="gantt-bar-timed" style="left:${leftPercent}%; width:${widthPercent}%; background:${color};"></div>`;
                      // End time label after the bar
                      const endLabelLeft = leftPercent + widthPercent;
                      rowHtml += `<span class="gantt-bar-time-label gantt-bar-time-label-end" style='left:calc(${endLabelLeft}% - 35px);'>${item.endTime}</span>`;
                    }
                } else if (item.time) {
                    const [startH, startM] = item.time.split(':').map(Number);
                    const startTotal = startH * 60 + (startM || 0);
                    const leftPercent = ((startTotal - timelineStart) / timelineDuration) * 100;
                    rowHtml += `<div class="gantt-point-container" style="left:calc(${leftPercent}% - 8px);">
                                <div class="gantt-point-marker" style="background:${color}; box-shadow: 0 0 0 2px ${color};"></div>
                                <span class="gantt-point-label">${item.time}</span></div>`;
                }
                rowHtml += `</div>`;
                html += rowHtml;
            });
        }
        html += `</div></div></div>`;
        mainContent.innerHTML = html;

        // Attach event handlers
        mainContent.querySelectorAll('.gantt-checkbox').forEach(checkbox => {
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
                if(typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
                renderDailyPlanner();
            });
        });
    }

    // Add click handlers for wiki links
    mainContent.querySelectorAll('.wiki-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageName = this.getAttribute('data-page-link');
            if (pageName && window.appState) {
                appState.currentView = pageName;
                renderApp();
            }
        });
    });
}