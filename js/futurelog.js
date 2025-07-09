// js/futurelog.js

const futurelogWidget = (() => {
    // --- STATE & CONSTANTS ---
    const getStorage = window.getStorage || ((key) => localStorage.getItem(key) || '');
    const setStorage = window.setStorage || ((key, value) => localStorage.setItem(key, value));
    
    let state = {
        options: '',
        items: [],
        monthsToShow: 6,
        startDate: new Date(),
        onCommandChange: null,
        showAllItems: false,
    };

    // --- STORAGE KEYS ---
    const STORAGE_KEYS = {
        SHOW_ALL_ITEMS: 'futurelog-show-all-items'
    };

    // --- INITIALIZATION ---
    function initializeState() {
        // Restore user's "Show All" preference from localStorage
        const savedShowAll = localStorage.getItem(STORAGE_KEYS.SHOW_ALL_ITEMS);
        if (savedShowAll !== null) {
            state.showAllItems = savedShowAll === 'true';
        }
    }

    function saveShowAllPreference() {
        localStorage.setItem(STORAGE_KEYS.SHOW_ALL_ITEMS, state.showAllItems.toString());
    }

    // --- DOM ELEMENTS ---
    let containerEl = null;

    // --- PARSER ---
    function parseOptions(optionsStr) {
        const result = { monthsToShow: 6 };
        
        if (!optionsStr) return result;
        
        // Parse formats like "6-months", "3-months", "12-months"
        const monthsMatch = optionsStr.match(/(\d+)-months?/i);
        if (monthsMatch) {
            const months = parseInt(monthsMatch[1], 10);
            if (months > 0 && months <= 24) { // Reasonable limits
                result.monthsToShow = months;
            }
        }
        
        return result;
    }

    function generateItemId(lineOrType, fullLine) {
        // Handle two different call patterns:
        // 1. generateItemId(type, fullLine) - from parseItems
        // 2. generateItemId(line) - from performRemoveItem
        
        let type, content;
        
        if (fullLine) {
            // Called with two parameters: generateItemId(type, fullLine)
            type = lineOrType;
            content = fullLine;
        } else {
            // Called with one parameter: generateItemId(line)
            const line = lineOrType;
            if (!line || typeof line !== 'string') {
                console.warn('[FUTURELOG] generateItemId called with invalid line:', line);
                return `unknown-${Date.now()}`; // Fallback to timestamp-based ID
            }
            
            // Extract type and content from markdown line format
            // Expected format: "- Task name (SCHEDULED: 2025-07-08)" or "- [ ] Task name (SCHEDULED: 2025-07-08)" or "- Task name (REPEAT: every monday)"
            if (line.includes('(SCHEDULED:')) {
                type = 'scheduled';
                // Extract the task text and date from "- Task name (SCHEDULED: 2025-07-08)" or "- [ ] Task name (SCHEDULED: 2025-07-08)"
                const match = line.match(/^-\s*(?:\[[ x]\]\s*)?(.+?)\s*\(SCHEDULED:\s*(.+?)\)$/);
                if (match) {
                    const taskText = match[1].trim();
                    const dateStr = match[2].trim();
                    content = `SCHEDULED: ${dateStr} ${taskText}`;
                } else {
                    content = line;
                }
            } else if (line.includes('(REPEAT:')) {
                type = 'repeat';
                // Extract the task text and repeat rule from "- Task name (REPEAT: every monday)" or "- [ ] Task name (REPEAT: every monday)"
                const match = line.match(/^-\s*(?:\[[ x]\]\s*)?(.+?)\s*\(REPEAT:\s*(.+?)\)$/);
                if (match) {
                    let taskText = match[1].trim();
                    const repeatRule = match[2].trim();
                    
                    // Remove the 🔁 prefix if it exists in the task text (for consistency)
                    if (taskText.startsWith('🔁 ')) {
                        taskText = taskText.substring(2).trim();
                    }
                    
                    content = `REPEAT: ${repeatRule} ${taskText}`;
                } else {
                    content = line;
                }
            } else {
                type = 'unknown';
                content = line;
            }
        }
        
        // Generate clean ID from content
        const cleanContent = content.replace(/^(SCHEDULED:|REPEAT:)\s*/, '').trim();
        const finalId = `${type}-${cleanContent}`;
        return finalId;
    }

    function generateFallbackId(item, linkDate) {
        let fallbackId;
        if (item.type === 'repeat') {
            // For repeat items, remove the 🔁 prefix and checkbox symbols from the text and use the repeatRule
            let cleanText = item.text;
            if (cleanText.startsWith('🔁 ')) {
                cleanText = cleanText.substring(2).trim();
            }
            // Remove checkbox symbols
            cleanText = cleanText.replace(/^[☐☑]\s*/, '');
            // Generate ID consistent with how generateItemId works for repeat items
            fallbackId = `repeat-${item.repeatRule} ${cleanText}`;
        } else {
            // For scheduled items, remove checkbox symbols from the text
            let cleanText = item.text.replace(/^[☐☑]\s*/, '');
            // Generate ID consistent with generateItemId
            fallbackId = `scheduled-${dateFns.format(new Date(linkDate), 'yyyy-MM-dd')} ${cleanText}`;
        }
        return fallbackId;
    }

    function parseItems(items) {
        const result = [];
        
        items.forEach(item => {
            if (item.type === 'scheduled') {
                // Handle scheduled items (single date)
                const date = window.parseDateString(item.dateStr);

                if (date) {
                    // Format the text with checkbox if it's a checkbox item
                    let displayText = item.text;
                    if (item.hasCheckbox) {
                        const checkboxSymbol = item.isChecked ? '☑' : '☐';
                        displayText = `${checkboxSymbol} ${item.text}`;
                    }
                    
                    result.push({
                        text: displayText,
                        dateStr: item.dateStr,
                        date: date,
                        fullLine: item.fullLine,
                        valid: true,
                        type: 'scheduled',
                        hasCheckbox: item.hasCheckbox || false,
                        isChecked: item.isChecked || false,
                        id: generateItemId('scheduled', item.fullLine || `SCHEDULED: ${item.dateStr} ${item.text}`)
                    });
                }
            } else if (item.type === 'repeat') {
                // Handle repeat items (recurring events)
                const expandedDates = expandRepeatItem(item);

                // Store the first occurrence for linking
                const firstOccurrenceDate = expandedDates.firstOccurrence;
                
                expandedDates.forEach(expandedItem => {
                    // Format the text with checkbox if it's a checkbox item
                    let displayText = `🔁 ${item.text}`;
                    if (item.hasCheckbox) {
                        const checkboxSymbol = item.isChecked ? '☑' : '☐';
                        displayText = `🔁 ${checkboxSymbol} ${item.text}`;
                    }
                    
                    result.push({
                        text: displayText,
                        dateStr: dateFns.format(expandedItem.date, 'yyyy-MM-dd'),
                        date: expandedItem.date,
                        fullLine: item.fullLine,
                        valid: true,
                        type: 'repeat',
                        repeatRule: item.repeatRule,
                        hasCheckbox: item.hasCheckbox || false,
                        isChecked: item.isChecked || false,
                        firstOccurrenceDate: firstOccurrenceDate, // Store for linking
                        id: generateItemId('repeat', item.fullLine || `REPEAT: ${item.repeatRule} ${item.text}`)
                    });
                });
            } else {
                // Legacy format fallback
                const date = window.parseDateString(item.dateStr);

                if (date) {
                    result.push({
                        text: item.text,
                        dateStr: item.dateStr,
                        date: date,
                        fullLine: item.fullLine,
                        valid: true,
                        type: 'scheduled',
                        hasCheckbox: false,
                        isChecked: false,
                        id: generateItemId('scheduled', item.fullLine || `SCHEDULED: ${item.dateStr} ${item.text}`)
                    });
                }
            }
        });
        
        return result.filter(item => item.valid);
    }

    function expandRepeatItem(item) {
        const result = [];
        const repeatRule = item.repeatRule;
        const today = new Date();
        const endDate = dateFns.addMonths(today, state.monthsToShow);
        let firstOccurrenceAfterToday = null;
        
        // Handle "everyday" format
        if (repeatRule.toLowerCase() === 'everyday') {
            let currentDate = dateFns.startOfDay(today);
            
            // Set first occurrence for linking
            firstOccurrenceAfterToday = new Date(currentDate);
            
            // Generate daily occurrences within the display period
            while (!dateFns.isAfter(currentDate, endDate)) {
                result.push({ date: new Date(currentDate) });
                currentDate = dateFns.addDays(currentDate, 1);
            }
            
            result.firstOccurrence = firstOccurrenceAfterToday;
            return result;
        }
        
        // Handle "everyday from <date> to <date>" format
        const everydayRangeMatch = repeatRule.match(/^everyday from ([^ ]+) to ([^ )]+)/i);
        if (everydayRangeMatch) {
            const startDate = window.parseDateString(everydayRangeMatch[1]);
            const ruleEndDate = window.parseDateString(everydayRangeMatch[2]);
            
            if (startDate && ruleEndDate) {
                const actualEndDate = dateFns.min([ruleEndDate, endDate]);
                
                let currentDate = dateFns.startOfDay(startDate);
                
                // Generate daily occurrences within the specified range
                while (!dateFns.isAfter(currentDate, actualEndDate)) {
                    if (!dateFns.isBefore(currentDate, today) || dateFns.isSameDay(currentDate, today)) {
                        const occurrence = { date: new Date(currentDate) };
                        result.push(occurrence);
                        
                        // Track first occurrence after today for linking
                        if (!firstOccurrenceAfterToday && (dateFns.isAfter(currentDate, today) || dateFns.isSameDay(currentDate, today))) {
                            firstOccurrenceAfterToday = new Date(currentDate);
                        }
                    }
                    currentDate = dateFns.addDays(currentDate, 1);
                }
            }
            
            // Store the first occurrence for linking
            if (firstOccurrenceAfterToday) {
                result.firstOccurrence = firstOccurrenceAfterToday;
            }
            return result;
        }
        
        // Handle "every <weekday> from <date> to <date>" format
        const rangeMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)/i);
        if (rangeMatch) {
            const weekday = rangeMatch[1].toLowerCase();
            const startDate = window.parseDateString(rangeMatch[2]);
            const ruleEndDate = window.parseDateString(rangeMatch[3]);
            
            if (startDate && ruleEndDate) {
                const actualEndDate = dateFns.min([ruleEndDate, endDate]);
                const weekdayIndex = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(weekday);
                
                let currentDate = dateFns.startOfDay(startDate);
                // Find first occurrence of the weekday
                while (dateFns.getDay(currentDate) !== ((weekdayIndex + 1) % 7)) {
                    currentDate = dateFns.addDays(currentDate, 1);
                }
                
                // Generate weekly occurrences
                while (!dateFns.isAfter(currentDate, actualEndDate)) {
                    if (!dateFns.isBefore(currentDate, today) || dateFns.isSameDay(currentDate, today)) {
                        const occurrence = { date: new Date(currentDate) };
                        result.push(occurrence);
                        
                        // Track first occurrence after today for linking
                        if (!firstOccurrenceAfterToday && (dateFns.isAfter(currentDate, today) || dateFns.isSameDay(currentDate, today))) {
                            firstOccurrenceAfterToday = new Date(currentDate);
                        }
                    }
                    currentDate = dateFns.addWeeks(currentDate, 1);
                }
            }
            
            // Store the first occurrence for linking
            if (firstOccurrenceAfterToday) {
                result.firstOccurrence = firstOccurrenceAfterToday;
            }
            return result;
        }
        
        // Handle "every <weekday>" format (no end date specified)
        const everyMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
        if (everyMatch) {
            const weekday = everyMatch[1].toLowerCase();
            const weekdayIndex = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].indexOf(weekday);
            
            let currentDate = dateFns.startOfDay(today);
            // Find first occurrence of the weekday from today
            while (dateFns.getDay(currentDate) !== ((weekdayIndex + 1) % 7)) {
                currentDate = dateFns.addDays(currentDate, 1);
            }
            
            // Set first occurrence for linking
            firstOccurrenceAfterToday = new Date(currentDate);
            
            // Generate weekly occurrences within the display period
            while (!dateFns.isAfter(currentDate, endDate)) {
                result.push({ date: new Date(currentDate) });
                currentDate = dateFns.addWeeks(currentDate, 1);
            }
            
            result.firstOccurrence = firstOccurrenceAfterToday;
            return result;
        }
        
        // Handle annual recurring events (REPEAT: DD.MM.YYYY or REPEAT: DD.MM)
        let dateStr = repeatRule.trim();
        let parsedDate = window.parseDateString(dateStr);
        
        if (parsedDate) {
            // Annual repetition based on month/day
            const month = dateFns.getMonth(parsedDate);
            const day = dateFns.getDate(parsedDate);
            
            for (let year = dateFns.getYear(today); year <= dateFns.getYear(endDate) + 1; year++) {
                try {
                    const annualDate = new Date(year, month, day);
                    if (!dateFns.isBefore(annualDate, today) && !dateFns.isAfter(annualDate, endDate)) {
                        result.push({ date: annualDate });
                        
                        // Track first occurrence after today for linking
                        if (!firstOccurrenceAfterToday && (dateFns.isAfter(annualDate, today) || dateFns.isSameDay(annualDate, today))) {
                            firstOccurrenceAfterToday = new Date(annualDate);
                        }
                    }
                } catch (e) {
                    // Skip invalid dates (like Feb 29 on non-leap years)
                }
            }
        } else {
            // Try to match DD.MM format
            const dayMonthMatch = dateStr.match(/^(\d{2})[./-](\d{2})$/);
            if (dayMonthMatch) {
                const day = parseInt(dayMonthMatch[1], 10);
                const month = parseInt(dayMonthMatch[2], 10) - 1; // JS months are 0-indexed
                
                for (let year = dateFns.getYear(today); year <= dateFns.getYear(endDate) + 1; year++) {
                    try {
                        const annualDate = new Date(year, month, day);
                        if (!dateFns.isBefore(annualDate, today) && !dateFns.isAfter(annualDate, endDate)) {
                            result.push({ date: annualDate });
                            
                            // Track first occurrence after today for linking
                            if (!firstOccurrenceAfterToday && (dateFns.isAfter(annualDate, today) || dateFns.isSameDay(annualDate, today))) {
                                firstOccurrenceAfterToday = new Date(annualDate);
                            }
                        }
                    } catch (e) {
                        // Skip invalid dates
                    }
                }
            }
        }
        
        // Store the first occurrence for linking
        if (firstOccurrenceAfterToday) {
            result.firstOccurrence = firstOccurrenceAfterToday;
        }
        
        return result;
    }

    // --- RENDER FUNCTIONS ---
    function renderFutureLog() {
        if (!containerEl) return;

        const today = new Date();
        const months = [];
        
        // Generate the months to display
        for (let i = 0; i < state.monthsToShow; i++) {
            const monthDate = dateFns.addMonths(today, i);
            months.push(monthDate);
        }

        // Get items to display - either just futurelog items or all items
        let itemsToDisplay = [...state.items];
        
        if (state.showAllItems) {
            // Add items from other journal pages
            if (window.getAllScheduledItems) {
                const allScheduled = window.getAllScheduledItems();
                const additionalItems = [];
                
                allScheduled.forEach((items, dateStr) => {
                    const itemDate = dateFns.parseISO(dateStr);
                    if (dateFns.isAfter(itemDate, today) || dateFns.isSameDay(itemDate, today)) {
                        items.forEach(item => {
                            // Format the text properly for display
                            let displayText = item.text;
                            
                            // Handle checkbox items from journal
                            if (item.isCheckbox) {
                                // Remove the markdown checkbox syntax from the text
                                displayText = displayText.replace(/^[-*]\s*\[[x ]\]\s*/, '');
                                // Add the proper checkbox symbol
                                const checkboxSymbol = item.checkboxState ? '☑' : '☐';
                                displayText = `${checkboxSymbol} ${displayText}`;
                            }
                            
                            additionalItems.push({
                                text: displayText,
                                date: itemDate,
                                dateStr: dateStr,
                                type: item.recurring ? 'repeat' : 'scheduled',
                                source: 'journal',
                                displayName: item.displayName,
                                hasCheckbox: item.isCheckbox || false,
                                isChecked: item.checkboxState || false,
                                fullLine: item.text,
                                valid: true,
                                id: `journal-${dateStr}-${item.text}`
                            });
                        });
                    }
                });
                
                // Remove duplicates between futurelog and journal items
                const seenItems = new Set();
                
                // First, mark futurelog items as seen
                state.items.forEach(item => {
                    if (item.date) {
                        const cleanText = item.text.replace(/^[🔁☐☑\s\[\]x-]+/, '').trim();
                        const itemKey = `${dateFns.format(item.date, 'yyyy-MM-dd')}-${cleanText}`;
                        seenItems.add(itemKey);
                    }
                });
                
                // Then, add journal items that aren't duplicates
                additionalItems.forEach(item => {
                    const cleanText = item.text.replace(/^[🔁☐☑\s\[\]x-]+/, '').trim();
                    const itemKey = `${dateFns.format(item.date, 'yyyy-MM-dd')}-${cleanText}`;
                    
                    if (!seenItems.has(itemKey)) {
                        seenItems.add(itemKey);
                        itemsToDisplay.push(item);
                    }
                });
            }
        }

        // Group items by month
        const itemsByMonth = {};
        itemsToDisplay.forEach(item => {
            if (!item.date) return;
            
            const monthKey = dateFns.format(item.date, 'yyyy-MM');
            if (!itemsByMonth[monthKey]) {
                itemsByMonth[monthKey] = [];
            }
            itemsByMonth[monthKey].push(item);
        });

        // Generate calendar HTML
        const calendarsHtml = months.map(monthDate => {
            const monthKey = dateFns.format(monthDate, 'yyyy-MM');
            const monthItems = itemsByMonth[monthKey] || [];
            
            return renderMiniCalendar(monthDate, monthItems);
        }).join('');

        // Update the button text based on current state
        const showAllButtonText = state.showAllItems ? 'Hide All' : 'Show All';
        const showAllButtonClass = state.showAllItems ? 'showing-all' : '';

        containerEl.innerHTML = `
            <div class="futurelog-widget" onclick="event.stopPropagation()">
                <div class="futurelog-header">
                    <h3 class="futurelog-title">Future Log (${state.monthsToShow} months)</h3>
                    <div class="futurelog-widget-controls">
                        <button class="finance-add-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            New Entry
                        </button>
                        <button class="futurelog-toggle-all-btn ${showAllButtonClass}" title="Show all upcoming items from across your journal">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            ${showAllButtonText}
                        </button>
                    </div>
                </div>
                <div class="futurelog-calendars">
                    ${calendarsHtml}
                </div>
            </div>
        `;

        // Attach event listeners
        attachEventListeners();
    }

    function renderMiniCalendar(monthDate, items) {
        const monthStart = dateFns.startOfMonth(monthDate);
        const monthEnd = dateFns.endOfMonth(monthDate);
        const calendarStart = dateFns.startOfWeek(monthStart);
        const calendarEnd = dateFns.endOfWeek(monthEnd);
        const days = dateFns.eachDayOfInterval({ start: calendarStart, end: calendarEnd });

        const monthTitle = dateFns.format(monthDate, 'MMMM yyyy');
        const today = new Date();

        // Group items by day
        const itemsByDay = {};
        items.forEach(item => {
            const dayKey = dateFns.format(item.date, 'yyyy-MM-dd');
            if (!itemsByDay[dayKey]) {
                itemsByDay[dayKey] = [];
            }
            itemsByDay[dayKey].push(item);
        });

        // Sort items chronologically for the month list and group repeat items
        const itemsForList = [];
        const repeatItemsSeen = new Set();
        
        // First pass: collect unique repeat items and their first occurrence dates
        const repeatGroups = new Map();
        
        items.forEach(item => {
            if (item.type === 'repeat' && item.source !== 'journal') {
                // Only group repeat items from futurelog, not from journal
                const repeatKey = `${item.text}-${item.repeatRule}`;
                if (!repeatGroups.has(repeatKey)) {
                    repeatGroups.set(repeatKey, {
                        text: item.text,
                        type: 'repeat',
                        firstOccurrenceDate: item.firstOccurrenceDate,
                        repeatRule: item.repeatRule,
                        count: 1,
                        source: item.source
                    });
                } else {
                    repeatGroups.get(repeatKey).count++;
                }
            } else {
                // Add scheduled items and journal items directly
                itemsForList.push(item);
            }
        });
        
        // Add grouped repeat items with their first occurrence date for linking
        repeatGroups.forEach(repeatGroup => {
            if (repeatGroup.firstOccurrenceDate) {
                itemsForList.push({
                    text: `${repeatGroup.text}`,
                    date: repeatGroup.firstOccurrenceDate,
                    type: 'repeat',
                    repeatRule: repeatGroup.repeatRule,
                    count: repeatGroup.count,
                    linkToFirstOccurrence: true,
                    source: repeatGroup.source
                });
            }
        });
        
        // Sort all items chronologically
        const sortedItems = itemsForList.sort((a, b) => a.date - b.date);

        // Generate day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            .map(day => `<div class="mini-calendar-day-header">${day}</div>`)
            .join('');

        // Generate day cells
        const dayCells = days.map(day => {
            const dayKey = dateFns.format(day, 'yyyy-MM-dd');
            const dayItems = itemsByDay[dayKey] || [];
            const dayNumber = dateFns.getDate(day);
            const isToday = dateFns.isSameDay(day, today);
            const isCurrentMonth = dateFns.isSameMonth(day, monthDate);
            const isPast = dateFns.isBefore(day, today) && !isToday;

            let cssClasses = 'mini-calendar-day';
            if (!isCurrentMonth) cssClasses += ' other-month';
            if (isToday) cssClasses += ' today';
            if (isPast) cssClasses += ' past';
            
            // Determine event type for styling
            const hasScheduled = dayItems.some(item => item.type === 'scheduled');
            const hasRepeat = dayItems.some(item => item.type === 'repeat');
            
            if (dayItems.length > 0) {
                if (hasScheduled && hasRepeat) {
                    cssClasses += ' has-mixed-events';
                } else if (hasRepeat) {
                    cssClasses += ' has-repeat-events';
                } else {
                    cssClasses += ' has-events';
                }
            }

            // Create event indicators with appropriate colors
            const eventIndicators = dayItems.length > 0 ? 
                `<div class="event-indicators">
                    ${dayItems.slice(0, 3).map((item, index) => 
                        `<div class="event-dot" style="background-color: ${getEventColor(index, item.type)};"></div>`
                    ).join('')}
                    ${dayItems.length > 3 ? '<div class="event-more">+</div>' : ''}
                </div>` : '';

            // Create tooltip content for items
            const tooltipContent = dayItems.length > 0 ? 
                dayItems.map(item => `<div class="tooltip-item${item.type === 'repeat' ? ' repeat-item' : ''}">${item.text}</div>`).join('') : '';

            return `
                <div class="${cssClasses}" data-date="${dayKey}" data-planner-date="${dayKey}" data-tooltip="${tooltipContent.replace(/"/g, '&quot;')}">
                    <div class="day-number">${dayNumber}</div>
                    ${eventIndicators}
                </div>
            `;
        }).join('');

        // Create items list for the month
        const itemsList = sortedItems.length > 0 ? `
            <div class="month-items">
                <div class="month-items-header">
                    <span class="items-count">${sortedItems.length} item${sortedItems.length === 1 ? '' : 's'}</span>
                </div>
                <div class="month-items-list">
                    ${sortedItems.map(item => {
                        const formattedDate = dateFns.format(item.date, 'MMM d');
                        const isToday = dateFns.isSameDay(item.date, today);
                        const isPast = dateFns.isBefore(item.date, today) && !isToday;
                        
                        let itemClass = 'month-item';
                        if (isToday) itemClass += ' today';
                        if (isPast) itemClass += ' past';
                        if (item.type === 'repeat') itemClass += ' repeat';
                        if (item.source === 'journal') itemClass += ' journal-item';
                        
                        // For repeat items, use the first occurrence date for linking
                        const linkDate = item.linkToFirstOccurrence 
                            ? dateFns.format(item.date, 'yyyy-MM-dd')
                            : dateFns.format(item.date, 'yyyy-MM-dd');
                        
                        // Show count for repeat items in month list
                        let displayText = item.count && item.count > 1 
                            ? `${item.text} (${item.count}x this month)`
                            : item.text;
                        
                        // Add source label when in "Show All" mode
                        if (state.showAllItems && item.source === 'journal') {
                            displayText += ` (from [[${item.displayName}]])`;
                        }
                        
                        // Only show remove button for futurelog items, not journal items
                        const removeButton = item.source !== 'journal' 
                            ? `<button class="remove-item-btn" data-item-id="${item.id || generateFallbackId(item, linkDate)}" title="Remove this item">×</button>` 
                            : '';
                        
                        return `
                            <div class="${itemClass}" data-date="${linkDate}" data-planner-date="${linkDate}" data-item-id="${item.id || generateFallbackId(item, linkDate)}">
                                <div class="month-item-content">
                                    <span class="item-date">${formattedDate}</span>
                                    <span class="item-text">${displayText}</span>
                                </div>
                                ${removeButton}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="mini-calendar">
                <div class="mini-calendar-header" data-month-date="${dateFns.format(monthDate, 'yyyy-MM-dd')}">
                    <h4>${monthTitle}</h4>
                </div>
                <div class="mini-calendar-grid">
                    ${dayHeaders}
                    ${dayCells}
                </div>
                ${itemsList}
            </div>
        `;
    }

    function getEventColor(index, eventType = 'scheduled') {
        if (eventType === 'repeat') {
            // Orange/yellow colors for repeat events
            const repeatColors = [
                '#ff9800',                // Orange
                '#ffc107',                // Amber
                '#ff8f00',                // Dark Orange
                '#ffb300',                // Light Orange
                '#f57c00',                // Deep Orange
            ];
            return repeatColors[index % repeatColors.length];
        } else {
            // Blue/cool colors for scheduled events
            const scheduledColors = [
                '#007aff',                // Blue (default link color)
                '#4CAF50',                // Green
                '#9C27B0',                // Purple
                '#2196F3',                // Light Blue
                '#00BCD4',                // Cyan
            ];
            return scheduledColors[index % scheduledColors.length];
        }
    }

    // --- EVENT HANDLERS ---
    function attachEventListeners() {
        if (!containerEl) return;

        // Make ALL calendar days clickable (not just those with events)
        const dayElements = containerEl.querySelectorAll('.mini-calendar-day');
        
        dayElements.forEach(dayEl => {
            let tooltipEl = null;

            // Add click handler for all days
            dayEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const dateStr = dayEl.dataset.date;
                if (dateStr) {
                    // Use the same navigation pattern as scheduled links
                    const scheduledEvent = new Event('click', { bubbles: true });
                    const tempLink = document.createElement('span');
                    tempLink.className = 'scheduled-link';
                    tempLink.setAttribute('data-planner-date', dateStr);
                    tempLink.style.display = 'none';
                    document.body.appendChild(tempLink);
                    tempLink.dispatchEvent(scheduledEvent);
                    document.body.removeChild(tempLink);
                }
            });

            // Only add hover listeners for days with events
            if (dayEl.classList.contains('has-events') || dayEl.classList.contains('has-repeat-events') || dayEl.classList.contains('has-mixed-events')) {
                dayEl.addEventListener('mouseenter', (e) => {
                    // Prevent edit mode on hover
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const tooltipContent = dayEl.dataset.tooltip;
                    if (!tooltipContent) return;

                    // Create tooltip
                    tooltipEl = document.createElement('div');
                    tooltipEl.className = 'futurelog-tooltip';
                    tooltipEl.innerHTML = tooltipContent;
                    document.body.appendChild(tooltipEl);

                    // Position tooltip
                    const rect = dayEl.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                    
                    tooltipEl.style.position = 'absolute';
                    tooltipEl.style.left = `${rect.left + scrollLeft + rect.width / 2}px`;
                    tooltipEl.style.top = `${rect.top + scrollTop - 10}px`;
                    tooltipEl.style.transform = 'translate(-50%, -100%)';
                    tooltipEl.style.zIndex = '1000';

                    // Ensure tooltip stays within viewport
                    const tooltipRect = tooltipEl.getBoundingClientRect();
                    if (tooltipRect.left < 10) {
                        tooltipEl.style.left = `${rect.left + scrollLeft}px`;
                        tooltipEl.style.transform = 'translateY(-100%)';
                    } else if (tooltipRect.right > window.innerWidth - 10) {
                        tooltipEl.style.left = `${rect.right + scrollLeft}px`;
                        tooltipEl.style.transform = 'translate(-100%, -100%)';
                    }
                });

                dayEl.addEventListener('mouseleave', () => {
                    if (tooltipEl) {
                        tooltipEl.remove();
                        tooltipEl = null;
                    }
                });
            }
        });

        // Add click handlers for month headers to navigate to monthly view
        const monthHeaders = containerEl.querySelectorAll('.mini-calendar-header');
        monthHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const monthDate = header.dataset.monthDate;
                if (monthDate) {
                    // Navigate to monthly calendar view for this month
                    navigateToMonthView(monthDate);
                }
            });
        });

        // Add click handlers for month items to navigate to daily view
        const monthItems = containerEl.querySelectorAll('.month-item');
        monthItems.forEach(item => {
            // Add click handler to the content area (not the remove button)
            const contentArea = item.querySelector('.month-item-content');
            if (contentArea) {
                contentArea.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const dateStr = item.dataset.date;
                    if (dateStr) {
                        // Use the same navigation pattern as scheduled links
                        const scheduledEvent = new Event('click', { bubbles: true });
                        const tempLink = document.createElement('span');
                        tempLink.className = 'scheduled-link';
                        tempLink.setAttribute('data-planner-date', dateStr);
                        tempLink.style.display = 'none';
                        document.body.appendChild(tempLink);
                        tempLink.dispatchEvent(scheduledEvent);
                        document.body.removeChild(tempLink);
                    }
                });
            }
        });

        // Add click handlers for remove buttons
        const removeButtons = containerEl.querySelectorAll('.remove-item-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const itemId = button.dataset.itemId;
                if (itemId) {
                    removeItemFromCommand(itemId);
                }
            });
        });

        // Add click handlers for New Entry button
        const addButtons = containerEl.querySelectorAll('.finance-add-button');
        addButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showFuturelogEntryModal();
            });
        });

        // Add click handler for the new "Show All" toggle
        const toggleBtn = containerEl.querySelector('.futurelog-toggle-all-btn');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Toggle the state
                const isShowingAll = toggleBtn.classList.contains('showing-all');
                
                if (!isShowingAll) {
                    // Enable "Show All" mode - re-render with all items
                    state.showAllItems = true;
                    toggleBtn.classList.add('showing-all');
                    toggleBtn.innerHTML = toggleBtn.innerHTML.replace('Show All', 'Hide All');
                    saveShowAllPreference(); // Save preference
                    renderFutureLog(); // Re-render with all items
                } else {
                    // Disable "Show All" mode - re-render with only futurelog items
                    state.showAllItems = false;
                    toggleBtn.classList.remove('showing-all');
                    toggleBtn.innerHTML = toggleBtn.innerHTML.replace('Hide All', 'Show All');
                    saveShowAllPreference(); // Save preference
                    renderFutureLog(); // Re-render with only futurelog items
                }
            });
        }
    }

    // --- MODAL FUNCTIONS ---
    function showFuturelogEntryModal() {
        // Set today's date as the default using date-fns for consistent formatting
        const today = new Date();
        const dateValue = dateFns.format(today, 'yyyy-MM-dd'); // ISO format for internal use
        const displayValue = dateFns.format(today, 'dd/MM/yyyy'); // Formatted for display in dd/MM/yyyy format
        
        // Reset form fields
        DOM.futurelogEntryForm.reset();
        DOM.futurelogEntryDate.value = dateValue;
        DOM.futurelogEntryDateDisplay.value = displayValue;
        DOM.futurelogEntryText.value = '';
        DOM.futurelogEntryCheckbox.checked = false;
        
        // Check the scheduled radio button by default
        document.getElementById('scheduled-type').checked = true;
        
        // Show/hide appropriate form sections
        updateFormSections();
        
        // Show modal
        DOM.futurelogEntryModal.classList.add('active');
        
        // Setup event listeners for the modal
        setupFuturelogModalListeners();
        
        // Focus on the text field for better UX
        setTimeout(() => DOM.futurelogEntryText.focus(), 100);
    }
    
    function hideFuturelogEntryModal() {
        DOM.futurelogEntryModal.classList.remove('active');
        
        // Remove event listeners
        if (DOM.futurelogModalConfirm.onclick) {
            DOM.futurelogModalConfirm.onclick = null;
        }
        if (DOM.futurelogModalCancel.onclick) {
            DOM.futurelogModalCancel.onclick = null;
        }
        if (DOM.futurelogModalClose.onclick) {
            DOM.futurelogModalClose.onclick = null;
        }
    }
    
    function updateFormSections() {
        const scheduledChecked = document.getElementById('scheduled-type').checked;
        const repeatChecked = document.getElementById('repeat-type').checked;
        
        // Show/hide form sections based on entry type
        const scheduledDateGroup = document.getElementById('scheduled-date-group');
        const repeatRuleGroup = document.getElementById('repeat-rule-group');
        
        if (scheduledChecked) {
            scheduledDateGroup.style.display = 'flex';
            repeatRuleGroup.style.display = 'none';
        } else if (repeatChecked) {
            scheduledDateGroup.style.display = 'none';
            repeatRuleGroup.style.display = 'flex';
            updateRepeatOptions();
        }
    }
    
    function updateRepeatOptions() {
        const repeatType = DOM.futurelogEntryRepeatType.value;
        
        // Hide all repeat options first
        document.getElementById('daily-options').style.display = 'none';
        document.getElementById('daily-range-options').style.display = 'none';
        document.getElementById('weekly-options').style.display = 'none';
        document.getElementById('weekly-range-options').style.display = 'none';
        document.getElementById('annual-options').style.display = 'none';
        
        // Show the appropriate option
        if (repeatType === 'daily') {
            document.getElementById('daily-options').style.display = 'block';
        } else if (repeatType === 'daily-range') {
            document.getElementById('daily-range-options').style.display = 'block';
        } else if (repeatType === 'weekly') {
            document.getElementById('weekly-options').style.display = 'flex';
        } else if (repeatType === 'weekly-range') {
            document.getElementById('weekly-range-options').style.display = 'flex';
        } else if (repeatType === 'annual') {
            document.getElementById('annual-options').style.display = 'flex';
        }
    }
    
    function setupFuturelogModalListeners() {
        // Add event listeners for radio buttons
        document.getElementById('scheduled-type').addEventListener('change', updateFormSections);
        document.getElementById('repeat-type').addEventListener('change', updateFormSections);
        
        // Add event listener for repeat type selector
        DOM.futurelogEntryRepeatType.addEventListener('change', updateRepeatOptions);
        
        // Add event listeners for date picker buttons
        DOM.futurelogEntryDatePickerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof CentralizedDatePicker !== 'undefined') {
                CentralizedDatePicker.showFuturelogDatePicker(this, 'futurelog-entry-date', 'futurelog-entry-date-display');
            } else {
                openFuturelogDatePicker(this, 'futurelog-entry-date', 'futurelog-entry-date-display');
            }
        });
        
        DOM.futurelogEntryFromDatePickerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof CentralizedDatePicker !== 'undefined') {
                CentralizedDatePicker.showFuturelogDatePicker(this, 'futurelog-entry-from-date', 'futurelog-entry-from-date-display');
            } else {
                openFuturelogDatePicker(this, 'futurelog-entry-from-date', 'futurelog-entry-from-date-display');
            }
        });
        
        DOM.futurelogEntryToDatePickerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof CentralizedDatePicker !== 'undefined') {
                CentralizedDatePicker.showFuturelogDatePicker(this, 'futurelog-entry-to-date', 'futurelog-entry-to-date-display');
            } else {
                openFuturelogDatePicker(this, 'futurelog-entry-to-date', 'futurelog-entry-to-date-display');
            }
        });
        
        DOM.futurelogEntryAnnualDatePickerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof CentralizedDatePicker !== 'undefined') {
                CentralizedDatePicker.showFuturelogDatePicker(this, 'futurelog-entry-annual-date', 'futurelog-entry-annual-date-display', true);
            } else {
                openFuturelogDatePicker(this, 'futurelog-entry-annual-date', 'futurelog-entry-annual-date-display', true);
            }
        });
        
        DOM.futurelogEntryDailyFromDatePickerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof CentralizedDatePicker !== 'undefined') {
                CentralizedDatePicker.showFuturelogDatePicker(this, 'futurelog-entry-daily-from-date', 'futurelog-entry-daily-from-date-display');
            } else {
                openFuturelogDatePicker(this, 'futurelog-entry-daily-from-date', 'futurelog-entry-daily-from-date-display');
            }
        });
        
        DOM.futurelogEntryDailyToDatePickerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof CentralizedDatePicker !== 'undefined') {
                CentralizedDatePicker.showFuturelogDatePicker(this, 'futurelog-entry-daily-to-date', 'futurelog-entry-daily-to-date-display');
            } else {
                openFuturelogDatePicker(this, 'futurelog-entry-daily-to-date', 'futurelog-entry-daily-to-date-display');
            }
        });
        
        // Handle date input validation
        DOM.futurelogEntryDateDisplay.addEventListener('input', function(e) {
            updateDateFromInput(e.target.value, 'futurelog-entry-date');
        });
        
        DOM.futurelogEntryFromDateDisplay.addEventListener('input', function(e) {
            updateDateFromInput(e.target.value, 'futurelog-entry-from-date');
        });
        
        DOM.futurelogEntryToDateDisplay.addEventListener('input', function(e) {
            updateDateFromInput(e.target.value, 'futurelog-entry-to-date');
        });
        
        DOM.futurelogEntryAnnualDateDisplay.addEventListener('input', function(e) {
            updateAnnualDateFromInput(e.target.value);
        });
        
        DOM.futurelogEntryDailyFromDateDisplay.addEventListener('input', function(e) {
            updateDateFromInput(e.target.value, 'futurelog-entry-daily-from-date');
        });
        
        DOM.futurelogEntryDailyToDateDisplay.addEventListener('input', function(e) {
            updateDateFromInput(e.target.value, 'futurelog-entry-daily-to-date');
        });
        
        // Handle confirm button click
        DOM.futurelogModalConfirm.onclick = function() {
            // Validate the form
            if (!DOM.futurelogEntryForm.checkValidity()) {
                DOM.futurelogEntryForm.reportValidity();
                return;
            }
            
            // Get form values
            const text = DOM.futurelogEntryText.value.trim();
            const isScheduled = document.getElementById('scheduled-type').checked;
            const isCheckbox = DOM.futurelogEntryCheckbox.checked;
            
            if (isScheduled) {
                // Handle scheduled entry
                const date = DOM.futurelogEntryDate.value; // This is in YYYY-MM-DD format
                const entry = `SCHEDULED: ${date} ${text}`;
                addEntryToCommand(entry, isCheckbox);
            } else {
                // Handle repeat entry
                const repeatRule = buildRepeatRule();
                if (repeatRule) {
                    const entry = `REPEAT: ${repeatRule} ${text}`;
                    addEntryToCommand(entry, isCheckbox);
                }
            }
            
            // Hide the modal
            hideFuturelogEntryModal();
        };
        
        // Handle cancel and close buttons
        DOM.futurelogModalCancel.onclick = hideFuturelogEntryModal;
        DOM.futurelogModalClose.onclick = hideFuturelogEntryModal;
    }
    
    function buildRepeatRule() {
        const repeatType = DOM.futurelogEntryRepeatType.value;
        
        if (repeatType === 'daily') {
            return 'everyday';
        } else if (repeatType === 'daily-range') {
            const fromDate = DOM.futurelogEntryDailyFromDate.value;
            const toDate = DOM.futurelogEntryDailyToDate.value;
            
            if (!fromDate || !toDate) {
                alert('Please select both from and to dates for the daily date range.');
                return null;
            }
            
            return `everyday from ${fromDate} to ${toDate}`;
        } else if (repeatType === 'weekly') {
            const weekday = DOM.futurelogEntryWeekday.value;
            return `every ${weekday}`;
        } else if (repeatType === 'weekly-range') {
            const weekday = DOM.futurelogEntryWeekdayRange.value;
            const fromDate = DOM.futurelogEntryFromDate.value;
            const toDate = DOM.futurelogEntryToDate.value;
            
            if (!fromDate || !toDate) {
                alert('Please select both from and to dates for the date range.');
                return null;
            }
            
            return `every ${weekday} from ${fromDate} to ${toDate}`;
        } else if (repeatType === 'annual') {
            const annualDate = DOM.futurelogEntryAnnualDate.value;
            if (!annualDate) {
                alert('Please select an annual date.');
                return null;
            }
            
            // Format as DD.MM for annual events
            const date = new Date(annualDate);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return `${day}.${month}`;
        }
        
        return null;
    }
    
    function updateDateFromInput(inputValue, hiddenFieldId) {
        // Allow various formats: dd/MM/yyyy, d/M/yyyy, etc.
        const datePattern = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
        const match = inputValue.match(datePattern);
        
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // Month is 0-indexed in JS Date
            const year = parseInt(match[3], 10);
            
            // Basic date validation
            if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                const date = new Date(year, month, day);
                
                // Check if the date is valid (e.g., not Feb 30)
                if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                    // Format date for the hidden input
                    const isoDate = dateFns.format(date, 'yyyy-MM-dd');
                    document.getElementById(hiddenFieldId).value = isoDate;
                    return true;
                }
            }
        }
        return false;
    }
    
    function updateAnnualDateFromInput(inputValue) {
        // For annual dates, allow DD/MM format or DD/MM/YYYY
        const ddMmPattern = /^(\d{1,2})[/.-](\d{1,2})$/;
        const ddMmYyyyPattern = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
        
        let day, month, year;
        
        const ddMmMatch = inputValue.match(ddMmPattern);
        const ddMmYyyyMatch = inputValue.match(ddMmYyyyPattern);
        
        if (ddMmYyyyMatch) {
            day = parseInt(ddMmYyyyMatch[1], 10);
            month = parseInt(ddMmYyyyMatch[2], 10) - 1;
            year = parseInt(ddMmYyyyMatch[3], 10);
        } else if (ddMmMatch) {
            day = parseInt(ddMmMatch[1], 10);
            month = parseInt(ddMmMatch[2], 10) - 1;
            year = new Date().getFullYear(); // Use current year as default
        } else {
            return false;
        }
        
        // Basic date validation
        if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            
            // Check if the date is valid
            if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                // Format date for the hidden input
                const isoDate = dateFns.format(date, 'yyyy-MM-dd');
                DOM.futurelogEntryAnnualDate.value = isoDate;
                return true;
            }
        }
        return false;
    }
    
    function openFuturelogDatePicker(anchorElement, hiddenFieldId, displayFieldId, isAnnual = false) {
        // Remove any existing date picker
        const existingPicker = document.querySelector('.futurelog-date-picker-dropdown');
        if (existingPicker) {
            existingPicker.remove();
        }

        // Get current date from hidden input or default to today
        const currentValue = document.getElementById(hiddenFieldId).value;
        const selectedDate = currentValue ? new Date(currentValue) : new Date();
        let currentYear = selectedDate.getFullYear();
        let currentMonth = selectedDate.getMonth();
        const currentDay = selectedDate.getDate();

        // Create date picker container
        const datePickerContainer = document.createElement('div');
        datePickerContainer.className = 'futurelog-date-picker-dropdown';
        
        // Create a header with month/year selector
        const header = document.createElement('div');
        header.className = 'futurelog-date-picker-header';
        
        // Previous month button
        const prevMonthBtn = document.createElement('button');
        prevMonthBtn.innerHTML = '&laquo;';
        prevMonthBtn.type = 'button';
        prevMonthBtn.className = 'date-nav-btn';
        prevMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            updateCalendar(currentYear, currentMonth);
        });
        
        // Month/Year display
        const monthYearDisplay = document.createElement('span');
        monthYearDisplay.className = 'month-year-display';
        
        // Next month button
        const nextMonthBtn = document.createElement('button');
        nextMonthBtn.innerHTML = '&raquo;';
        nextMonthBtn.type = 'button';
        nextMonthBtn.className = 'date-nav-btn';
        nextMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            updateCalendar(currentYear, currentMonth);
        });
        
        header.appendChild(prevMonthBtn);
        header.appendChild(monthYearDisplay);
        header.appendChild(nextMonthBtn);
        
        // Create the calendar grid
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'futurelog-date-picker-grid';
        
        // Add day headers
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // Function to update the calendar display
        function updateCalendar(year, month) {
            // Update header
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                             'July', 'August', 'September', 'October', 'November', 'December'];
            monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
            
            // Clear existing days
            while (calendarGrid.children.length > 7) {
                calendarGrid.removeChild(calendarGrid.lastChild);
            }
            
            // Get first day of month and number of days
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            // Add blank spaces for previous month days
            for (let i = 0; i < firstDay; i++) {
                const blankDay = document.createElement('div');
                blankDay.className = 'calendar-day empty';
                calendarGrid.appendChild(blankDay);
            }
            
            // Add days of current month
            for (let day = 1; day <= daysInMonth; day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day';
                dayElement.textContent = day;
                
                // Highlight current selection
                if (year === selectedDate.getFullYear() && month === selectedDate.getMonth() && day === currentDay) {
                    dayElement.classList.add('selected');
                }
                
                // Add click handler to select date
                dayElement.addEventListener('click', () => {
                    const pickedDate = new Date(year, month, day);
                    
                    // Format date for both display and internal value
                    const isoDate = dateFns.format(pickedDate, 'yyyy-MM-dd');
                    
                    let displayDate;
                    if (isAnnual) {
                        displayDate = dateFns.format(pickedDate, 'dd/MM');
                    } else {
                        displayDate = dateFns.format(pickedDate, 'dd/MM/yyyy');
                    }
                    
                    // Update input fields
                    document.getElementById(hiddenFieldId).value = isoDate;
                    document.getElementById(displayFieldId).value = displayDate;
                    
                    // Remove date picker
                    datePickerContainer.remove();
                });
                
                calendarGrid.appendChild(dayElement);
            }
        }
        
        // Add all elements to container
        datePickerContainer.appendChild(header);
        datePickerContainer.appendChild(calendarGrid);
        
        // Add "Today" button at the bottom (unless it's annual date)
        if (!isAnnual) {
            const todayButton = document.createElement('button');
            todayButton.type = 'button';
            todayButton.className = 'today-button';
            todayButton.textContent = 'Today';
            todayButton.addEventListener('click', () => {
                const today = new Date();
                
                // Format date for both display and internal value
                const isoDate = dateFns.format(today, 'yyyy-MM-dd');
                const displayDate = dateFns.format(today, 'dd/MM/yyyy');
                
                // Update input fields
                document.getElementById(hiddenFieldId).value = isoDate;
                document.getElementById(displayFieldId).value = displayDate;
                
                // Remove date picker
                datePickerContainer.remove();
            });
            datePickerContainer.appendChild(todayButton);
        }
        
        // Position and show the date picker
        document.body.appendChild(datePickerContainer);
        
        // Center the date picker on screen, floating above the modal
        datePickerContainer.style.position = 'fixed';
        datePickerContainer.style.top = '50%';
        datePickerContainer.style.left = '50%';
        datePickerContainer.style.transform = 'translate(-50%, -50%)';
        datePickerContainer.style.zIndex = '2000'; // Higher z-index than the modal
        datePickerContainer.style.height = '420px';
        
        
        // Initialize the calendar
        updateCalendar(currentYear, currentMonth);
        
        // Close when clicking outside
        function handleOutsideClick(e) {
            if (!datePickerContainer.contains(e.target) && 
                e.target !== anchorElement) {
                datePickerContainer.remove();
                document.removeEventListener('click', handleOutsideClick);
            }
        }
        
        // Add a slight delay before adding the listener to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }
    
    function addEntryToCommand(entry, isCheckbox = false) {
        if (!state.onCommandChange) {
            console.error('[FUTURELOG] Cannot add entry: onCommandChange callback is not set');
            return;
        }

        // Convert the entry format to match the markdown list format
        let markdownEntry;
        const checkboxPrefix = isCheckbox ? '[ ] ' : '';
        
        if (entry.startsWith('SCHEDULED:')) {
            // Convert "SCHEDULED: 2025-08-15 Meeting" to "- Meeting (SCHEDULED: 2025-08-15)" or "- [ ] Meeting (SCHEDULED: 2025-08-15)"
            const parts = entry.replace('SCHEDULED:', '').trim().split(' ');
            const date = parts[0];
            const text = parts.slice(1).join(' ');
            markdownEntry = `- ${checkboxPrefix}${text} (SCHEDULED: ${date})`;
        } else if (entry.startsWith('REPEAT:')) {
            // Convert "REPEAT: every monday Meeting" to "- Meeting (REPEAT: every monday)" or "- [ ] Meeting (REPEAT: every monday)"
            const parts = entry.replace('REPEAT:', '').trim();
            // Find the last word(s) as the text (everything after the repeat rule)
            const ruleParts = parts.split(' ');
            let text, repeatRule;
            
            if (parts.toLowerCase().startsWith('everyday')) {
                // Handle "everyday Meeting text" or "everyday from date to date Meeting text"
                if (parts.includes('from') && parts.includes('to')) {
                    // "everyday from 2025-01-01 to 2025-12-31 Meeting text"
                    const toIndex = ruleParts.indexOf('to');
                    const repeatRuleParts = ruleParts.slice(0, toIndex + 2); // Include "to" and the date after it
                    repeatRule = repeatRuleParts.join(' ');
                    text = ruleParts.slice(toIndex + 2).join(' ');
                } else {
                    // "everyday Meeting text"
                    repeatRule = 'everyday';
                    text = ruleParts.slice(1).join(' ');
                }
            } else if (parts.includes('every')) {
                // Handle "every monday" or "every monday from date to date" patterns
                if (parts.includes('from') && parts.includes('to')) {
                    // "every monday from 2025-01-01 to 2025-12-31 Meeting text"
                    const toIndex = ruleParts.indexOf('to');
                    const repeatRuleParts = ruleParts.slice(0, toIndex + 2); // Include "to" and the date after it
                    repeatRule = repeatRuleParts.join(' ');
                    text = ruleParts.slice(toIndex + 2).join(' ');
                } else {
                    // "every monday Meeting text"
                    repeatRule = ruleParts.slice(0, 2).join(' '); // "every monday"
                    text = ruleParts.slice(2).join(' ');
                }
            } else {
                // Handle DD.MM format "15.07 Birthday"
                repeatRule = ruleParts[0]; // "15.07"
                text = ruleParts.slice(1).join(' ');
            }
            
            markdownEntry = `- ${checkboxPrefix}${text} (REPEAT: ${repeatRule})`;
        } else {
            console.error('[FUTURELOG] Unknown entry format:', entry);
            return;
        }
        
        // Get the current page content from localStorage
        const pageWrapper = DOM.pageContentWrapper || document.querySelector('[data-key]');
        if (!pageWrapper || !pageWrapper.dataset.key) {
            console.error('[FUTURELOG] Cannot find page key for adding entry');
            return;
        }
        
        const pageKey = pageWrapper.dataset.key;
        const currentContent = getStorage(pageKey);
        
        if (!currentContent) {
            console.error('[FUTURELOG] No content found for page key:', pageKey);
            return;
        }
        
        // Find the futurelog widget command in the content and add the new entry
        const lines = currentContent.split('\n');
        let inFuturelogCommand = false;
        let futurelogStartIndex = -1;
        let futurelogEndIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for futurelog command blocks - could be ```futurelog or just contain FUTURELOG:
            if (line.startsWith('```futurelog') || line.startsWith('FUTURELOG:')) {
                inFuturelogCommand = true;
                futurelogStartIndex = i;
            } else if (inFuturelogCommand && line === '```') {
                futurelogEndIndex = i;
                break;
            }
        }
        
        if (futurelogStartIndex !== -1) {
            // Get the existing futurelog content
            let existingFuturelogContent;
            
            if (futurelogEndIndex !== -1) {
                // Standard markdown code block format
                existingFuturelogContent = lines.slice(futurelogStartIndex + 1, futurelogEndIndex);
            } else {
                // No end marker found, treat everything after start as futurelog content
                existingFuturelogContent = lines.slice(futurelogStartIndex + 1);
            }
            
            // Add the new entry to the futurelog content
            existingFuturelogContent.push(markdownEntry);
            
            // Replace the futurelog command content
            let newLines;
            if (futurelogEndIndex !== -1) {
                newLines = [
                    ...lines.slice(0, futurelogStartIndex + 1),
                    ...existingFuturelogContent,
                    ...lines.slice(futurelogEndIndex)
                ];
            } else {
                newLines = [
                    ...lines.slice(0, futurelogStartIndex + 1),
                    ...existingFuturelogContent
                ];
            }
            
            const updatedContent = newLines.join('\n');
            
            // Save the updated content to localStorage
            setStorage(pageKey, updatedContent);
            // Update the state command for consistency
            const updatedCommand = existingFuturelogContent.join('\n');
            state.command = updatedCommand;
            containerEl.dataset.command = updatedCommand;
            
            // Update the command through the callback
            try {
                state.onCommandChange(updatedCommand);
            } catch (error) {
                console.error('[FUTURELOG] Error calling onCommandChange:', error);
            }
            
            // Re-render the entire app to reflect the changes
            setTimeout(() => {
                if (typeof renderApp === 'function') {
                    renderApp();
                }
            }, 100);
        } else {
            console.error('[FUTURELOG] Could not find futurelog command block in content');
            console.error('[FUTURELOG] Content structure:', currentContent);
        }
    }
    
    function removeItemFromCommand(itemId) {
        // Show confirmation modal first
        showRemoveConfirmation(itemId);
    }
    
    function showRemoveConfirmation(itemId) {
        // Create confirmation modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2100'; // Higher than date picker
        
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Confirm Removal</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to remove this item?</p>
                    <p><strong>Item:</strong> ${itemId.replace(/^(scheduled|repeat)-/, '')}</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="modal-btn primary confirm-remove">Remove</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add confirm handler
        modal.querySelector('.confirm-remove').addEventListener('click', () => {
            modal.remove();
            performRemoveItem(itemId);
        });
        
        // Add class for active state
        modal.classList.add('active');
    }
    
    function performRemoveItem(itemId) {
        // Get the current page content from localStorage
        const pageWrapper = DOM.pageContentWrapper || document.querySelector('[data-key]');
        if (!pageWrapper || !pageWrapper.dataset.key) {
            console.error('[FUTURELOG] Cannot find page key for removal');
            return;
        }
        
        const pageKey = pageWrapper.dataset.key;
        const currentContent = getStorage(pageKey);
        
        if (!currentContent) {
            console.error('[FUTURELOG] No content found for page key:', pageKey);
            return;
        }
        // Find the futurelog widget command in the content and remove the item
        const lines = currentContent.split('\n');
        let inFuturelogCommand = false;
        let futurelogStartIndex = -1;
        let futurelogEndIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Look for futurelog command blocks - could be ```futurelog or just contain FUTURELOG:
            if (line.startsWith('```futurelog') || line.startsWith('FUTURELOG:')) {
                inFuturelogCommand = true;
                futurelogStartIndex = i;
            } else if (inFuturelogCommand && line === '```') {
                futurelogEndIndex = i;
                break;
            }
        }
        
        if (futurelogStartIndex !== -1) {
            // Get the existing futurelog content
            let existingFuturelogContent;
            
            if (futurelogEndIndex !== -1) {
                // Standard markdown code block format
                existingFuturelogContent = lines.slice(futurelogStartIndex + 1, futurelogEndIndex);
            } else {
                // No end marker found, treat everything after start as futurelog content
                existingFuturelogContent = lines.slice(futurelogStartIndex + 1);
            }
            
            // Filter out the item to remove
            const filteredFuturelogContent = existingFuturelogContent.filter(line => {
                if (!line.trim().startsWith('- ')) return true; // Keep non-list items
                
                // Generate ID for this line to check if it matches
                const lineId = generateItemId(line.trim());
                return lineId !== itemId;
            });
            
            // Replace the futurelog command content
            let newLines;
            if (futurelogEndIndex !== -1) {
                newLines = [
                    ...lines.slice(0, futurelogStartIndex + 1),
                    ...filteredFuturelogContent,
                    ...lines.slice(futurelogEndIndex)
                ];
            } else {
                newLines = [
                    ...lines.slice(0, futurelogStartIndex + 1),
                    ...filteredFuturelogContent
                ];
            }
            
            const updatedContent = newLines.join('\n');
            
            // Save the updated content to localStorage
            setStorage(pageKey, updatedContent);
            
            // Update the state command for consistency
            const updatedCommand = filteredFuturelogContent.join('\n');
            state.command = updatedCommand;
            containerEl.dataset.command = updatedCommand;
            
            // Re-render the entire app to reflect the changes
            setTimeout(() => {
                if (typeof renderApp === 'function') {
                    renderApp();
                }
            }, 100);
        } else {
            console.error('[FUTURELOG] Could not find futurelog command block in content');
            console.error('[FUTURELOG] Content structure:', currentContent);
        }
    }

    function navigateToMonthView(monthDateStr) {
        // Parse the date
        const date = new Date(monthDateStr);
        
        // Switch to monthly calendar view
        if (window.appState) {
            window.appState.currentView = 'monthly';
            window.appState.currentDate = date;
            
            if (typeof renderApp === 'function') {
                renderApp();
            }
        }
    }

    // --- MAIN APP LOGIC ---
    function init(initOptions) {
        const { placeholder, options: optionsStr, items, command, onCommandChange } = initOptions;
        
        // Initialize state and restore user preferences
        initializeState();
        
        containerEl = placeholder;
        state.onCommandChange = onCommandChange;
        
        // If command is undefined, try to get it from the placeholder dataset
        let actualCommand = command;
        if (!actualCommand && placeholder.dataset.command) {
            actualCommand = placeholder.dataset.command;
        }
        
        // If still no command, construct it from the widget command and items
        if (!actualCommand) {
            const widgetCommand = `FUTURELOG: ${optionsStr || '6-months'}`;
            if (items && items !== '[]') {
                // Parse items to reconstruct the command
                let parsedItems = [];
                try {
                    if (typeof items === 'string') {
                        parsedItems = JSON.parse(items.replace(/&quot;/g, '"'));
                    } else {
                        parsedItems = items || [];
                    }
                } catch (e) {
                    console.error('Error parsing futurelog items:', e);
                    parsedItems = [];
                }
                
                // Convert items back to markdown format
                const markdownItems = parsedItems.map(item => {
                    if (item.type === 'scheduled') {
                        return `- ${item.text} (SCHEDULED: ${item.dateStr})`;
                    } else if (item.type === 'repeat') {
                        return `- ${item.text} (REPEAT: ${item.repeatRule})`;
                    }
                    return null;
                }).filter(Boolean);
                
                actualCommand = widgetCommand + '\n\n' + markdownItems.join('\n');
            } else {
                actualCommand = widgetCommand;
            }
        }
        
        state.command = actualCommand;
        
        // Store the command in the placeholder dataset for future reference
        placeholder.dataset.command = actualCommand;

        // Parse options
        const parsedOptions = parseOptions(optionsStr);
        state.monthsToShow = parsedOptions.monthsToShow;
        state.options = optionsStr;

        // Parse items (they come as JSON from the markdown extension)
        let parsedItems = [];
        try {
            if (typeof items === 'string') {
                parsedItems = JSON.parse(items.replace(/&quot;/g, '"'));
            } else {
                parsedItems = items || [];
            }
        } catch (e) {
            console.error('Error parsing futurelog items:', e);
            parsedItems = [];
        }

        state.items = parseItems(parsedItems);
        // Render the widget
        renderFutureLog();
    }

    return {
        init,
    };
})();
