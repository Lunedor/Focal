// Daily Planner View Logic
function renderDailyPlanner(scrollToToday = false) {
    // Get DOM elements
    const dailyView = document.getElementById('daily-view');
    const dailyTitle = document.getElementById('daily-title');
    const dailyContent = document.getElementById('daily-content-wrapper');
    // The main renderView function in init.js handles showing/hiding the dailyView container.
    // This function is only responsible for populating its content.
    if (!dailyTitle || !dailyContent) return;

    // Get persisted user preferences
    const today = appState.currentDate || new Date();
    let mode = localStorage.getItem('dailyPlannerMode') || 'hourly';
    let startHour = parseInt(localStorage.getItem('dailyPlannerStartHour') || '0', 10);
    let endHour = parseInt(localStorage.getItem('dailyPlannerEndHour') || '24', 10);

    // Set title
    dailyTitle.textContent = `Daily Planner – ${dateFns.format(today, 'yyyy-MM-dd')}`;

    // Render controls including mode and time range dropdowns
    dailyContent.innerHTML = `
    <div class="planner-dropdown-group" style="max-width:900px;margin:auto;margin-bottom:1em; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:1.5em;">
      <div style="display:flex; align-items:center; gap:1em;">
        <select id="daily-mode-select" class="planner-dropdown" style="min-width:120px;">
          <option value="hourly"${mode === 'hourly' ? ' selected' : ''}>Hourly Table</option>
          <option value="gantt"${mode === 'gantt' ? ' selected' : ''}>Gantt Timeline</option>
        </select>
      </div>
      <div style="display:flex; align-items:center; gap:1em;">
        <label for="start-hour-select" style="margin-right:0.5em;">From:</label>
        <select id="start-hour-select" class="planner-dropdown" style="min-width:80px;"></select>
        <label for="end-hour-select" style="margin-left:1em; margin-right:0.5em;">To:</label>
        <select id="end-hour-select" class="planner-dropdown" style="min-width:80px;"></select>
      </div>
    </div>
    <div id="daily-main-content"></div>
  `;

    // Function to set up and manage time picker dropdowns
    function setupTimePickers() {
        const startSelect = document.getElementById('start-hour-select');
        const endSelect = document.getElementById('end-hour-select');
        if (!startSelect || !endSelect) return;

        // Populate start hour dropdown (0-23)
        let startOptions = '';
        for (let i = 0; i <= 23; i++) {
            startOptions += `<option value="${i}"${i === startHour ? ' selected' : ''}>${i.toString().padStart(2, '0')}:00</option>`;
        }
        startSelect.innerHTML = startOptions;

        // Populate end hour dropdown (startHour+1 to 24)
        let endOptions = '';
        for (let i = startHour + 1; i <= 24; i++) {
            endOptions += `<option value="${i}"${i === endHour ? ' selected' : ''}>${i.toString().padStart(2, '0')}:00</option>`;
        }
        endSelect.innerHTML = endOptions;

        // Add event listeners
        startSelect.addEventListener('change', function() {
            const newStart = parseInt(this.value, 10);
            localStorage.setItem('dailyPlannerStartHour', newStart);
            // If new start is invalidating the end time, adjust end time automatically
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

    // Initialize the time pickers
    setupTimePickers();

    // Get today's date string
    const todayDateStr = dateFns.format(today, 'yyyy-MM-dd');
    // Get all scheduled/repeated/checkbox items for today
    const allScheduled = typeof getAllScheduledItems === 'function' ? getAllScheduledItems() : new Map();
    let itemsForToday = allScheduled.get(todayDateStr) || [];

    // --- Enhance items with checkbox metadata (like week view) ---
    itemsForToday = itemsForToday.map(item => {
        let isCheckboxTask = false;
        let foundIndex = -1;
        let checked = false;
        if (item.pageKey) {
            const pageContent = getStorage(item.pageKey);
            const lines = pageContent.split('\n');
            for (let idx = 0; idx < lines.length; idx++) {
                if (!lines[idx].includes(item.text)) continue;
                // For scheduled items, match date
                if (item.originalDate) {
                    const dateMatch = lines[idx].match(new RegExp(window.DATE_REGEX_PATTERN));
                    const lineNormDate = dateMatch ? window.normalizeDateStringToYyyyMmDd(dateMatch[0]) : null;
                    if (lineNormDate !== todayDateStr) continue;
                }
                isCheckboxTask = /^[-*]\s*\[[ x]\]/.test(lines[idx]);
                foundIndex = idx;
                checked = /\[x\]/i.test(lines[idx]);
                break;
            }
        }
        return {
            ...item,
            isCheckboxTask,
            foundIndex,
            checked
        };
    });

    // Sort items: all-day events first, then by start time.
    itemsForToday.sort((a, b) => {
        const aIsAllDay = !a.time;
        const bIsAllDay = !b.time;
        if (aIsAllDay && !bIsAllDay) return -1;
        if (!aIsAllDay && bIsAllDay) return 1;
        if (aIsAllDay && bIsAllDay) return (a.text || a.source || '').localeCompare(b.text || b.source || '');
        return a.time.localeCompare(b.time);
    });

    // Render main content based on mode
    const mainContent = document.getElementById('daily-main-content');
    if (mode === 'hourly') {
        let html = `<table class="hourly-table app-table" style="max-width:900px;margin:auto;border-collapse:collapse;">
      <thead><tr><th class="hour-col">Time</th><th class="task-col">Task</th><th class="status-col">Status</th></tr></thead><tbody>`;

        const allDayTasks = itemsForToday.filter(item => !item.time);
        if (allDayTasks.length > 0) {
            html += `<tr class="hour-row all-day-row"><td class="hour-label">All Day</td><td class="task-cell">`;
            html += allDayTasks.map((item, idx) => {
                const content = item.displayName
                    ? `<a href='#' class='wiki-link simple-task-link' data-page-link='${item.displayName}'>${item.text || ''}</a>`
                    : (item.text || '');
                return `<div class="task-block" style="background:var(--color-bg-highlight);color:var(--color-primary-text);border-radius:6px;padding:0.3em 0.7em; border-left: 3px solid #F5B041; border-right: 3px solid #F5B041;">
                    <span>${content}</span>
                </div>`;
            }).join('');
            html += `</td><td class="status-cell" style="vertical-align: top;">`;
            
            html += allDayTasks.map((item, idx) => {
                let statusIndicator;
                if (item.isCheckboxTask && item.pageKey && typeof item.foundIndex === 'number') {
                    statusIndicator = `<input type="checkbox" class="hourly-checkbox" data-key="${item.pageKey}" data-line-index="${item.foundIndex}" ${item.checked ? 'checked' : ''} />`;
                } else {
                    statusIndicator = item.checked ? '✔' : '🔁';
                }
                return `<div style="padding: 0.3em 0.7em; text-align: center;">${statusIndicator}</div>`;
            }).join('');
    
            html += `</td></tr>`;
        }

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
        // Loop from the selected start to end hour
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
            
            // --- START OF FIX ---
            // Declare showDetails here, so it's available for both task and status cells in this row.
            let showDetails = false;
            // --- END OF FIX ---

            html += `<tr class="hour-row ${hour % 2 === 0 ? 'even-row' : 'odd-row'}"> <td class="hour-label">${hour.toString().padStart(2, '0')}:00</td> <td class="task-cell" style="position:relative;">`;
            if (foundTask) {
                let showBar = false;
                // Note: 'showDetails' is NOT declared here anymore.
                let barLeft = 0,
                    barWidth = 0;
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
                         if (hour === firstEventHour) {
                             showDetails = true; // We now set the showDetails variable that was declared outside this `if` block.
                         }
                    }
                } else if(foundTask.time) {
                    if(hour === new Date(`1970-01-01T${foundTask.time}`).getHours()) {
                       showDetails = true; // Same here.
                    }
                }
                if (showBar) {
                    html += `<div class="gantt-bar" style="position:absolute; left:${barLeft}%; top:8px; height:32px; width:${barWidth}%; background:${getColor(foundTaskIdx)}; border-radius:8px; opacity:0.5; z-index:0;"></div>`;
                }
            if (showDetails && !renderedTaskRows.has(foundTaskIdx)) {
                let taskBlockStyle = "position:relative; z-index:1;";
                if (foundTask.time && !foundTask.endTime) {
                    taskBlockStyle += "border-left: 3px solid #5DADE2; padding: 0.2em 0.5em; border-radius: 4px;";
                }
                html += `<div class="task-block" style="${taskBlockStyle}"> <span style="font-weight:bold;">${foundTask.time}${foundTask.endTime ? ' - ' + foundTask.endTime : ''}</span> `;
                if (foundTask.displayName) {
                    html += `<a href='#' class='wiki-link simple-task-link' data-page-link='${foundTask.displayName}'>${foundTask.text || ''}</a>`;
                } else {
                    html += `<span>${foundTask.text || ''}</span>`;
                }
                html += `</div>`;
                renderedTaskRows.add(foundTaskIdx);
            }
            } else {
                html += '<span class="no-task" style="color:var(--color-muted);"></span>';
            }
            html += `</td> <td class="status-cell">`;

            // This check now works correctly because showDetails is in scope.
            if (foundTask && showDetails) {
                if (foundTask.isCheckboxTask && foundTask.pageKey && typeof foundTask.foundIndex === 'number') {
                    html += `<input type="checkbox" class="hourly-checkbox" data-key="${foundTask.pageKey}" data-line-index="${foundTask.foundIndex}" ${foundTask.checked ? 'checked' : ''} />`;
                } else {
                    html += foundTask.checked ? '✔' : '🔁';
                }
            }
            html += `</td></tr>`;
        }
        html += '</tbody></table>';
        mainContent.innerHTML = html;
        mainContent.querySelectorAll('.wiki-link').forEach(link => { link.addEventListener('click', function(e) { e.preventDefault(); const source = this.getAttribute('data-source'); if (source && typeof navigateToWiki === 'function') { navigateToWiki(source); } }); });

        // --- Attach checkbox event handlers for hourly view ---
        mainContent.querySelectorAll('.hourly-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function(e) {
                const cb = e.target;
                const dataKey = cb.getAttribute('data-key');
                const dataLineIndex = cb.getAttribute('data-line-index');
                if (!dataKey || dataLineIndex === null) return;
                // Get source content
                const fullText = getStorage(dataKey);
                const lines = fullText.split('\n');
                const idx = parseInt(dataLineIndex, 10);
                if (isNaN(idx) || !lines[idx]) return;
                // Toggle checkbox state in source
                lines[idx] = lines[idx].includes('[ ]')
                    ? lines[idx].replace('[ ]', '[x]')
                    : lines[idx].replace(/\[x\]/i, '[ ]');
                setStorage(dataKey, lines.join('\n'));
                debouncedSyncWithCloud && debouncedSyncWithCloud();
                // Re-render daily planner to reflect change
                renderDailyPlanner();
            });
        });
    } else if (mode === 'gantt') {
        // (The Gantt mode logic remains unchanged)
        const timelineStart = startHour * 60;
        const timelineEnd = endHour * 60;
        const timelineDuration = timelineEnd - timelineStart;

        const itemsInView = itemsForToday.filter(item => {
            if (!item.time) return true;
            const [itemStartH] = item.time.split(':').map(Number);
            if (!item.endTime) {
                return itemStartH >= startHour && itemStartH < endHour;
            }
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
                hourLabels += `<span style="position: absolute; left: ${hourLeftPercent}%; top: 0; transform: ${transformStyle};">${h.toString().padStart(2, '0')}:00</span>`;
            }
        }

        html = `<div style="width:100%; padding:1em 0; display:flex;">
            <div style="flex:0 0 220px; display:flex; flex-direction:column;"><div style="height:32px;"></div>`;
        if (itemsInView.length === 0) {
            html += `<div style="color:#bbb;text-align:center;padding:2em;">No tasks in this time range</div>`;
        } else {
            itemsInView.forEach(item => {
                let labelStyle = "font-size:0.95em; color:var(--color-primary); padding-left: 1em; padding-right: 1em; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; height:32px; display:flex; align-items:center;";
                if (!item.time) { labelStyle += "border-left: 3px solid #F5B041;"; }
                else if (item.time && !item.endTime) { labelStyle += "border-left: 3px solid #5DADE2;"; }
                html += `<div class="task-label-col" style="${labelStyle}">`;
                // --- Add checkbox before task name if applicable ---
                if (item.isCheckboxTask && item.pageKey && typeof item.foundIndex === 'number') {
                    html += `<input type="checkbox" class="gantt-checkbox" data-key="${item.pageKey}" data-line-index="${item.foundIndex}" ${item.checked ? 'checked' : ''} style="margin-right:0.7em; vertical-align:middle;" />`;
                }
                if (item.displayName) {
                    html += `<a href='#' class='wiki-link simple-task-link' data-page-link='${item.displayName}'>${item.text || ''}</a>`;
                } else {
                    html += `<span>${item.text || ''}</span>`;
                }
                html += `</div>`;
            });
        }
        html += `</div><div style="flex:1 1 auto; overflow-x:auto;padding-bottom:1em;"><div style="width:1920px; min-width:1920px;">
                    <div style="position: relative; height: 1.5em; font-size: 0.8em; color: var(--color-muted); margin-bottom: 1.5em;">${hourLabels}</div>`;

        if (itemsInView.length > 0 && timelineDuration > 0) {
            itemsInView.forEach((item, idx) => {
                let color = getColor(idx);
                let rowHtml = `<div class="timeline-row" style="position:relative; height:32px; margin-bottom:0; border:1px solid var(--color-bg-muted, #e5e5e5);padding:0; display:flex; align-items:center;">`;
                
                for (let h = startHour + 1; h < endHour; h++) {
                    let hourLeft = ((h * 60 - timelineStart) / timelineDuration) * 100;
                    rowHtml += `<div style="position:absolute; left:${hourLeft}%; top:0; bottom:0; width:1px; background:var(--color-bg-muted, #e5e5e5); z-index:0;"></div>`;
                }

                if (!item.time) {
                    rowHtml += `<div style="position:absolute; left:0; width:100%; height:70%; background:${color}; border-radius:8px; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 5px rgba(0,0,0,0.15); border: 1px solid #F5B041;"><span style="color:white; font-weight:500;">All Day</span></div>`;
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
                      rowHtml += `<span style='font-size:0.9em; color:var(--color-muted); font-weight:500; position:absolute; left:calc(${leftPercent}% - 40px); width:35px; text-align:right; top:50%; transform:translateY(-50%);'>${item.time}</span>
                                  <div style="position:absolute; left:${leftPercent}%; width:${widthPercent}%; height:70%; background:${color}; border-radius:8px; box-shadow: 0 2px 5px rgba(0,0,0,0.15);"></div>
                                  <span style='font-size:0.9em; color:var(--color-muted); font-weight:500; position:absolute; left:calc(${leftPercent + widthPercent}% + 8px); top:50%; transform:translateY(-50%);'>${item.endTime}</span>`;
                    }
                } else if (item.time) {
                    const [startH, startM] = item.time.split(':').map(Number);
                    const startTotal = startH * 60 + (startM || 0);
                    const leftPercent = ((startTotal - timelineStart) / timelineDuration) * 100;
                    rowHtml += `<div style="position:absolute; left:calc(${leftPercent}% - 8px); top:50%; transform:translateY(-50%); display:flex; align-items:center;">
                                <div style="width:16px; height:16px; background:${color}; border-radius:50%; border: 2px solid #fff; box-shadow: 0 0 0 2px ${color};"></div>
                                <span style='font-size:0.9em; color:var(--color-muted); font-weight:500; margin-left:10px;'>${item.time}</span></div>`;
                }
                rowHtml += `</div>`;
                html += rowHtml;
            });
        }
        html += `</div></div></div>`;
        mainContent.innerHTML = html;
        mainContent.querySelectorAll('.wiki-link').forEach(link => { link.addEventListener('click', function(e) { e.preventDefault(); const source = this.getAttribute('data-source'); if (source && typeof navigateToWiki === 'function') { navigateToWiki(source); } }); });

        // --- Attach checkbox event handlers for gantt view ---
        mainContent.querySelectorAll('.gantt-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', function(e) {
                const cb = e.target;
                const dataKey = cb.getAttribute('data-key');
                const dataLineIndex = cb.getAttribute('data-line-index');
                if (!dataKey || dataLineIndex === null) return;
                // Get source content
                const fullText = getStorage(dataKey);
                const lines = fullText.split('\n');
                const idx = parseInt(dataLineIndex, 10);
                if (isNaN(idx) || !lines[idx]) return;
                // Toggle checkbox state in source
                lines[idx] = lines[idx].includes('[ ]')
                    ? lines[idx].replace('[ ]', '[x]')
                    : lines[idx].replace(/\[x\]/i, '[ ]');
                setStorage(dataKey, lines.join('\n'));
                debouncedSyncWithCloud && debouncedSyncWithCloud();
                // Re-render daily planner to reflect change
                renderDailyPlanner();
            });
        });
    }
}