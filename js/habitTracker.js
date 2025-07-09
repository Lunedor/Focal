// js/habitTracker.js
const HabitTracker = (function() {
    'use strict';
    
    let placeholder = null;
    let onCommandChange = null;
    let habitDefinitions = [];
    let currentDate = new Date();
    
    // --- HABIT DEFINITIONS MANAGEMENT ---
    
    function getHabitDefinitions() {
        const definitions = getStorage('habit-definitions');
        if (!definitions) return [];
        try {
            return JSON.parse(definitions);
        } catch (e) {
            return [];
        }
    }
    
    function saveHabitDefinitions(definitions) {
        setStorage('habit-definitions', JSON.stringify(definitions));
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function parseHabitDefinitions(content) {
        const lines = content.split('\n');
        const definitions = [];
        let inDefineBlock = false;
        
        for (let line of lines) {
            line = line.trim();
            if (line.match(/^HABITS:\s*define$/i)) {
                inDefineBlock = true;
                continue;
            }
            if (inDefineBlock) {
                if (line.startsWith('- ')) {
                    const habitLine = line.substring(2).trim();
                    if (habitLine) { // Only process non-empty lines
                        const targetMatch = habitLine.match(/^(.*?)\s*\(TARGET:\s*(.+)\)$/i);
                        if (targetMatch) {
                            const name = targetMatch[1].trim();
                            const target = targetMatch[2].trim();
                            if (name) { // Only add if name is not empty
                                definitions.push({
                                    name,
                                    type: 'quantified',
                                    target,
                                    id: generateHabitId(name)
                                });
                            }
                        } else {
                            // Simple binary habit
                            definitions.push({
                                name: habitLine,
                                type: 'binary',
                                id: generateHabitId(habitLine)
                            });
                        }
                    }
                } else if (line && !line.startsWith('-') && !line.startsWith('#') && !line.startsWith('---')) {
                    // End of definition block if we hit a non-list item (but not horizontal rule)
                    break;
                }
            }
        }
        
        return definitions;
    }
    
    function generateHabitId(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Remove special characters except spaces
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Collapse multiple hyphens
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }
    
    // --- HABIT DATA MANAGEMENT ---
    
    function getAllHabitData() {
        const data = getStorage('habit-data-all');
        if (!data) return {};
        try {
            return JSON.parse(data);
        } catch (e) {
            return {};
        }
    }
    
    function saveAllHabitData(allData) {
        setStorage('habit-data-all', JSON.stringify(allData));
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function getHabitData(date) {
        const dateKey = formatDate(date);
        const allData = getAllHabitData();
        return allData[dateKey] || {};
    }
    
    function saveHabitData(date, data) {
        const dateKey = formatDate(date);
        const allData = getAllHabitData();
        allData[dateKey] = data;
        saveAllHabitData(allData);
    }
    
    function updateHabitValue(habitId, value, date = new Date()) {
        const data = getHabitData(date);
        data[habitId] = value;
        saveHabitData(date, data);
    }
    
    function removeHabitDataCompletely(habitId) {
        const allData = getAllHabitData();
        let removedCount = 0;
        
        // Remove habit data from all dates
        for (const dateKey in allData) {
            if (allData[dateKey] && allData[dateKey][habitId] !== undefined) {
                delete allData[dateKey][habitId];
                removedCount++;
                
                // If the date has no more habit data, remove the date entry entirely
                if (Object.keys(allData[dateKey]).length === 0) {
                    delete allData[dateKey];
                }
            }
        }
        
        saveAllHabitData(allData);
    }
    
    // --- PARSING AND COMMAND HANDLING ---
    
    function parseCommand(command) {
        // Handle both old format (HABITS: config) and new format (just config)
        let configPart = command;
        if (command.startsWith('HABITS:')) {
            configPart = command.replace('HABITS:', '').trim();
        }
        
        const parts = configPart.split(',').map(p => p.trim());
        const widgetType = parts[0] || 'today';
        
        let config = {
            type: widgetType,
            period: 'last-30-days',  // Default period changed to 30 days
            habit: null
        };
        
        // Handle define command
        if (widgetType === 'define') {
            return config;
        }
        
        // Parse additional parameters
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            // Check for time periods - comprehensive list of valid periods
            const validPeriods = [
                'last-7-days', 'last-30-days', 'last-90-days', 'last-180-days', 'last-365-days',
                'this-week', 'this-month', 'this-year',
                'last-three-months', 'last-six-months'
            ];
            
            if (validPeriods.includes(part)) {
                config.period = part;
            } else if (part.match(/^[a-zA-Z]/)) {
                // Habit name for specific habit widgets
                config.habit = part;
            }
        }
        
        return config;
    }
    
    // --- RENDER FUNCTIONS ---
    
    function renderTodayWidget() {
        const today = new Date();
        const todayData = getHabitData(today);
        const definitions = getHabitDefinitions();
        
        if (definitions.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <h3>📋 Today's Habits</h3>
                    <div class="habit-help">
                        <span>Create habit definitions with <code>HABITS: define</code> to track them here.</span>
                        <br><br>
                        <strong>Example:</strong><br>
                        <code>HABITS: define</code><br>
                        <code>- Meditate</code><br>
                        <code>- Exercise</code><br>
                        <code>- Drink Water (TARGET: 8 glasses)</code>
                    </div>
                </div>
            </div>`;
        }
        
        let html = `<div class="habit-widget today">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📋 Today's Habits</h3>
                    <div class="habit-date">${formatDateDisplay(today)}</div>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-add-button habit-add-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        New Habit
                    </button>
                </div>
            </div>
            <div class="habit-list">`;
        
        for (const habit of definitions) {
            const currentValue = todayData[habit.id] || (habit.type === 'binary' ? false : 0);
            
            if (habit.type === 'binary') {
                html += `<div class="habit-item binary">
                    <div class="habit-checkbox-container">
                        <input type="checkbox" 
                               id="habit-${habit.id}" 
                               class="habit-checkbox" 
                               data-habit-id="${habit.id}"
                               ${currentValue ? 'checked' : ''}>
                        <label for="habit-${habit.id}" class="habit-label">${habit.name}</label>
                    </div>
                    <div class="habit-actions">
                        <div class="habit-status">
                            ${currentValue ? '✅' : '⏳'}
                        </div>
                        <button class="habit-remove-btn" data-habit-id="${habit.id}" title="Remove habit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>`;
            } else {
                const target = parseFloat(habit.target) || 1;
                const percentage = Math.min(100, (currentValue / target) * 100);
                
                html += `<div class="habit-item quantified">
                    <div class="habit-info">
                        <div class="habit-name">${habit.name}</div>
                        <div class="habit-target">Target: ${habit.target}</div>
                    </div>
                    <div class="habit-controls">
                        <button class="habit-btn decrease" data-habit-id="${habit.id}">-</button>
                        <input type="number" 
                               class="habit-input" 
                               data-habit-id="${habit.id}"
                               value="${currentValue}" 
                               min="0" 
                               step="0.1">
                        <button class="habit-btn increase" data-habit-id="${habit.id}">+</button>
                    </div>
                    <div class="habit-progress">
                        <div class="habit-progress-bar">
                            <div class="habit-progress-fill" style="width: ${percentage}%"></div>
                        </div>
                        <div class="habit-progress-text">${currentValue} / ${habit.target}</div>
                    </div>
                    <button class="habit-remove-btn" data-habit-id="${habit.id}" title="Remove habit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>`;
            }
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function renderGridWidget(period) {
        const definitions = getHabitDefinitions();
        if (definitions.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <h3>📊 Habit Grid</h3>
                    <div class="habit-help">
                        <span>Create habit definitions with <code>HABITS: define</code> to see your progress grid.</span>
                        <br><br>
                        <strong>Example:</strong><br>
                        <code>HABITS: define</code><br>
                        <code>- Meditate</code><br>
                        <code>- Exercise</code><br>
                        <code>- Drink Water (TARGET: 8 glasses)</code>
                    </div>
                </div>
            </div>`;
        }
        
        const dates = getDateRange(period);
        const totalCols = dates.length + 1; // +1 for habit name column
        
        let html = `<div class="habit-widget grid">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📊 Habit Grid - ${period}</h3>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-filter-button habit-filter-button" data-current-period="${period}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        Filter
                    </button>
                </div>
            </div>
            <div class="habit-grid" style="grid-template-columns: minmax(120px, 1fr) repeat(${dates.length}, 1fr);">
                <div class="habit-grid-header">
                    <div class="habit-name-col">Habit</div>`;
        
        // Date headers
        for (const date of dates) {
            const dateStr = formatDate(date);
            const displayStr = formatDateDisplay(date);
            html += `<div class="habit-date-col" title="${displayStr} (${dateStr})">
                ${date.getDate()}
            </div>`;
        }
        
        html += `</div>`;
        
        // Habit rows
        for (const habit of definitions) {
            html += `<div class="habit-grid-row">
                <div class="habit-name-col">${habit.name}</div>`;
            
            for (const date of dates) {
                const data = getHabitData(date);
                const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
                
                let cellClass = 'habit-cell';
                let cellContent = '';
                
                if (habit.type === 'binary') {
                    cellClass += value ? ' completed' : ' incomplete';
                    cellContent = value ? '✓' : '';
                } else {
                    const target = parseFloat(habit.target) || 1;
                    const percentage = Math.min(100, (value / target) * 100);
                    cellClass += percentage >= 100 ? ' completed' : percentage > 0 ? ' partial' : ' incomplete';
                    cellContent = percentage >= 100 ? '✓' : percentage > 0 ? Math.round(percentage) + '%' : '';
                }
                
                html += `<div class="${cellClass}">${cellContent}</div>`;
            }
            
            html += `</div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function renderStatsWidget(period = 'last-30-days') {
        const definitions = getHabitDefinitions();
        if (definitions.length === 0) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <h3>📈 Habit Statistics</h3>
                    <div class="habit-help">
                        <span>Create habit definitions with <code>HABITS: define</code> to see your statistics.</span>
                        <br><br>
                        <strong>Example:</strong><br>
                        <code>HABITS: define</code><br>
                        <code>- Meditate</code><br>
                        <code>- Exercise</code><br>
                        <code>- Drink Water (TARGET: 8 glasses)</code>
                    </div>
                </div>
            </div>`;
        }
        
        let html = `<div class="habit-widget stats">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📈 Habit Statistics - ${period}</h3>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-filter-button habit-filter-button" data-current-period="${period}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        Filter
                    </button>
                </div>
            </div>
            <div class="habit-stats-grid">`;
        
        for (const habit of definitions) {
            const stats = calculateHabitStats(habit, period);
            html += `<div class="habit-stat-card">
                <div class="habit-stat-name">${habit.name}</div>
                <div class="habit-stat-completion">${stats.completionRate}%</div>
                <div class="habit-stat-details">
                    <div>Current Streak: ${stats.currentStreak} days</div>
                    <div>Best Streak: ${stats.bestStreak} days</div>
                    <div>Total Days: ${stats.totalDays}</div>
                </div>
            </div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    function renderChartWidget(habitName, period) {
        const definitions = getHabitDefinitions();
        const habit = definitions.find(h => h.name === habitName);
        
        if (!habit) {
            return `<div class="habit-widget">
                <div class="habit-header">
                    <h3>📊 Habit Chart</h3>
                    <div class="habit-help">
                        <span>Habit "${habitName}" not found. Check your habit definitions.</span>
                        <br><br>
                        <strong>Usage:</strong> <code>HABITS: chart, [HabitName], [period]</code><br>
                        <strong>Example:</strong> <code>HABITS: chart, Meditate, last-30-days</code>
                    </div>
                </div>
            </div>`;
        }
        
        const dates = getDateRange(period);
        const chartData = dates.map(date => {
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            return {
                date,
                value: habit.type === 'binary' ? (value ? 1 : 0) : parseFloat(value) || 0
            };
        });
        
        const maxValue = habit.type === 'binary' ? 1 : Math.max(...chartData.map(d => d.value), parseFloat(habit.target) || 1);
        
        let html = `<div class="habit-widget chart">
            <div class="habit-header">
                <div class="habit-header-content">
                    <h3>📊 ${habit.name} - ${period}</h3>
                </div>
                <div class="finance-widget-controls">
                    <button class="finance-filter-button habit-filter-button" data-current-period="${period}" data-habit-name="${habitName}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        Filter
                    </button>
                </div>
            </div>
            <div class="habit-chart">`;
        
        for (const point of chartData) {
            const height = (point.value / maxValue) * 100;
            html += `<div class="habit-chart-bar" style="height: ${height}%" title="${formatDateDisplay(point.date)}: ${point.value}"></div>`;
        }
        
        html += `</div></div>`;
        return html;
    }
    
    // --- UTILITY FUNCTIONS ---
    
    function formatDate(date) {
        // Use local timezone to avoid date shifting issues
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    function formatDateDisplay(date) {
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    function getDateRange(period) {
        const today = new Date();
        const dates = [];
        
        switch (period) {
            case 'this-week':
                // Get current week (Monday to Sunday)
                const currentWeekStart = new Date(today);
                const day = currentWeekStart.getDay();
                const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
                currentWeekStart.setDate(diff);
                
                for (let i = 0; i < 7; i++) {
                    const date = new Date(currentWeekStart);
                    date.setDate(currentWeekStart.getDate() + i);
                    dates.push(date);
                }
                break;
                
            case 'this-month':
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                for (let d = new Date(firstDay); d <= lastDay && d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            case 'this-year':
                const yearStart = new Date(today.getFullYear(), 0, 1);
                for (let d = new Date(yearStart); d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            case 'last-7-days':
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-30-days':
                for (let i = 29; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-90-days':
                for (let i = 89; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-180-days':
                for (let i = 179; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-365-days':
                for (let i = 364; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(date.getDate() - i);
                    dates.push(date);
                }
                break;
                
            case 'last-three-months':
                const threeMonthsAgo = new Date(today);
                threeMonthsAgo.setMonth(today.getMonth() - 3);
                for (let d = new Date(threeMonthsAgo); d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            case 'last-six-months':
                const sixMonthsAgo = new Date(today);
                sixMonthsAgo.setMonth(today.getMonth() - 6);
                for (let d = new Date(sixMonthsAgo); d <= today; d.setDate(d.getDate() + 1)) {
                    dates.push(new Date(d));
                }
                break;
                
            default:
                dates.push(today);
                break;
        }
        
        return dates;
    }
    
    function calculateHabitStats(habit, period = 'last-30-days') {
        const dates = getDateRange(period);
        let completedDays = 0;
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;
        
        for (const date of dates.reverse()) {
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            
            let isCompleted = false;
            if (habit.type === 'binary') {
                isCompleted = value;
            } else {
                const target = parseFloat(habit.target) || 1;
                isCompleted = value >= target;
            }
            
            if (isCompleted) {
                completedDays++;
                tempStreak++;
                bestStreak = Math.max(bestStreak, tempStreak);
            } else {
                tempStreak = 0;
            }
        }
        
        // Calculate current streak from today backwards
        const reversedDates = [...dates].reverse();
        for (const date of reversedDates) {
            const data = getHabitData(date);
            const value = data[habit.id] || (habit.type === 'binary' ? false : 0);
            
            let isCompleted = false;
            if (habit.type === 'binary') {
                isCompleted = value;
            } else {
                const target = parseFloat(habit.target) || 1;
                isCompleted = value >= target;
            }
            
            if (isCompleted) {
                currentStreak++;
            } else {
                break;
            }
        }
        
        return {
            completionRate: Math.round((completedDays / dates.length) * 100),
            currentStreak,
            bestStreak,
            totalDays: dates.length
        };
    }
    
    // --- EVENT HANDLERS ---
    
    function attachEventListeners() {
        if (!placeholder) return;
        
        // Stop propagation on the entire widget to prevent edit mode
        placeholder.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Handle checkbox changes
        placeholder.addEventListener('change', (e) => {
            if (e.target.classList.contains('habit-checkbox')) {
                e.stopPropagation();
                const habitId = e.target.dataset.habitId;
                const value = e.target.checked;
                updateHabitValue(habitId, value);
                
                // Update status icon
                const statusIcon = e.target.closest('.habit-item').querySelector('.habit-status');
                if (statusIcon) {
                    statusIcon.textContent = value ? '✅' : '⏳';
                }
                
                // Refresh the entire UI to update all widgets
                if (typeof renderApp === 'function') {
                    setTimeout(() => renderApp(), 0);
                }
            }
        });
        
        // Handle number input changes
        placeholder.addEventListener('input', (e) => {
            if (e.target.classList.contains('habit-input')) {
                e.stopPropagation();
                const habitId = e.target.dataset.habitId;
                const value = parseFloat(e.target.value) || 0;
                updateHabitValue(habitId, value);
                
                // Update progress bar
                const progressBar = e.target.closest('.habit-item').querySelector('.habit-progress-fill');
                const progressText = e.target.closest('.habit-item').querySelector('.habit-progress-text');
                if (progressBar && progressText) {
                    const definitions = getHabitDefinitions();
                    const habit = definitions.find(h => h.id === habitId);
                    if (habit) {
                        const target = parseFloat(habit.target) || 1;
                        const percentage = Math.min(100, (value / target) * 100);
                        progressBar.style.width = percentage + '%';
                        progressText.textContent = `${value} / ${habit.target}`;
                    }
                }
                
                // Refresh the entire UI to update all widgets
                if (typeof renderApp === 'function') {
                    setTimeout(() => renderApp(), 0);
                }
            }
        });
        
        // Handle increment/decrement buttons and other click events
        placeholder.addEventListener('click', (e) => {
            // Always stop propagation for clicks inside the widget
            e.stopPropagation();
            
            if (e.target.classList.contains('habit-btn')) {
                const habitId = e.target.dataset.habitId;
                
                // Find the input relative to the clicked button instead of searching the whole placeholder
                const input = e.target.closest('.habit-controls').querySelector(`input[data-habit-id="${habitId}"]`);
                if (input) {
                    const currentValue = parseFloat(input.value) || 0;
                    const step = 1; // Use 1 as default step
                    const newValue = e.target.classList.contains('increase') ? 
                        currentValue + step : Math.max(0, currentValue - step);
                    input.value = newValue;
                    updateHabitValue(habitId, newValue);
                    
                    // Update progress bar
                    const progressBar = input.closest('.habit-item').querySelector('.habit-progress-fill');
                    const progressText = input.closest('.habit-item').querySelector('.habit-progress-text');
                    if (progressBar && progressText) {
                        const definitions = getHabitDefinitions();
                        const habit = definitions.find(h => h.id === habitId);
                        if (habit) {
                            const target = parseFloat(habit.target) || 1;
                            const percentage = Math.min(100, (newValue / target) * 100);
                            progressBar.style.width = percentage + '%';
                            progressText.textContent = `${newValue} / ${habit.target}`;
                        }
                    }
                    
                    // Refresh the entire UI to update all widgets
                    if (typeof renderApp === 'function') {
                        setTimeout(() => renderApp(), 0);
                    }
                }
            }
            
            // Handle add habit button
            else if (e.target.closest('.habit-add-button')) {
                showHabitModal();
            }
            
            // Handle filter button
            else if (e.target.closest('.habit-filter-button')) {
                const button = e.target.closest('.habit-filter-button');
                const currentPeriod = button.getAttribute('data-current-period');
                const habitName = button.getAttribute('data-habit-name');
                console.log('Filter button clicked:');
                console.log('- Button element:', button);
                console.log('- Current period:', currentPeriod);
                console.log('- Habit name:', habitName);
                console.log('- Button classes:', button.className);
                
                // Find the specific widget that contains this button
                const widgetElement = button.closest('.habit-widget');
                console.log('- Widget element from button:', widgetElement);
                console.log('- Widget classes:', widgetElement ? widgetElement.className : 'null');
                
                showFilterModal(currentPeriod, habitName, widgetElement);
            }
            
            // Handle toggle visibility button for define widget
            else if (e.target.closest('.habit-toggle-visibility-button')) {
                const defineWidget = placeholder.querySelector('.define-widget');
                if (defineWidget) {
                    const isHidden = defineWidget.style.display === 'none';
                    defineWidget.style.display = isHidden ? 'block' : 'none';
                }
            }
            
            // Handle remove habit button
            else if (e.target.closest('.habit-remove-btn')) {
                const button = e.target.closest('.habit-remove-btn');
                const habitId = button.dataset.habitId;
                if (habitId) {
                    showCustomConfirm('Are you sure you want to remove this habit?', () => {
                        removeHabit(habitId);
                    });
                }
            }
        });
    }
    
    // --- HABIT MANAGEMENT FUNCTIONS ---
    
    function showCustomConfirm(message, onConfirm) {
        // Create confirm modal HTML
        const modalHTML = `
            <div class="modal-overlay active" id="habit-confirm-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Confirm Action</h3>
                        <button class="modal-close" id="habit-confirm-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="modal-message">${message}</div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" id="habit-confirm-cancel-btn">Cancel</button>
                            <button type="button" class="btn-primary" id="habit-confirm-ok-btn">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habit-confirm-modal-overlay');
        const closeBtn = document.getElementById('habit-confirm-modal-close');
        const cancelBtn = document.getElementById('habit-confirm-cancel-btn');
        const okBtn = document.getElementById('habit-confirm-ok-btn');
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // OK button handler
        okBtn.addEventListener('click', () => {
            closeModal();
            if (onConfirm) onConfirm();
        });
        
        // Focus on OK button
        okBtn.focus();
    }
    
    function showHabitModal() {
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay active" id="habit-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Add New Habit</h3>
                        <button class="modal-close" id="habit-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="habit-form" class="habit-form">
                            <label for="habit-name">Habit Name:</label>
                            <input type="text" id="habit-name" name="habitName" required style="margin-bottom: 1rem;">
                            
                            <label>Habit Type:</label>
                            <div class="habit-type-selection" style="margin-bottom: 1rem;">
                                <label style="display: inline; margin-right: 1rem;">
                                    <input type="radio" id="habit-type-binary" name="habitType" value="binary" checked style="width: auto; margin-right: 0.5rem;">
                                    Binary (Yes/No)
                                </label>
                                <label style="display: inline;">
                                    <input type="radio" id="habit-type-quantified" name="habitType" value="quantified" style="width: auto; margin-right: 0.5rem;">
                                    Quantified (With Target)
                                </label>
                            </div>
                            
                            <div id="target-group" style="display: none; margin-bottom: 1rem;">
                                <label for="habit-target">Target:</label>
                                <input type="text" id="habit-target" name="habitTarget" placeholder="e.g. 8 glasses, 30 minutes">
                            </div>
                            
                            <div class="modal-footer">
                                <button type="button" class="btn-secondary" id="habit-cancel-btn">Cancel</button>
                                <button type="submit" class="btn-primary">Add Habit</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habit-modal-overlay');
        const form = document.getElementById('habit-form');
        const closeBtn = document.getElementById('habit-modal-close');
        const cancelBtn = document.getElementById('habit-cancel-btn');
        const typeRadios = document.querySelectorAll('input[name="habitType"]');
        const targetGroup = document.getElementById('target-group');
        
        // Show/hide target input based on type selection
        typeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                targetGroup.style.display = radio.value === 'quantified' ? 'block' : 'none';
            });
        });
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const habitName = formData.get('habitName').trim();
            const habitType = formData.get('habitType');
            const habitTarget = formData.get('habitTarget').trim();
            
            if (!habitName) {
                alert('Please enter a habit name');
                return;
            }
            
            if (habitType === 'quantified' && !habitTarget) {
                alert('Please enter a target for quantified habits');
                return;
            }
            
            // Add the new habit
            addNewHabit(habitName, habitType, habitTarget);
            closeModal();
        });
        
        // Focus on the name input
        document.getElementById('habit-name').focus();
    }
    
    function showFilterModal(currentPeriod, habitName, widgetElement) {
        const periodOptions = [
            { value: 'last-7-days', label: 'Last 7 Days' },
            { value: 'last-30-days', label: 'Last 30 Days' },
            { value: 'last-90-days', label: 'Last 90 Days' },
            { value: 'last-180-days', label: 'Last 180 Days' },
            { value: 'last-365-days', label: 'Last 365 Days' },
            { value: 'this-week', label: 'This Week' },
            { value: 'this-month', label: 'This Month' },
            { value: 'last-three-months', label: 'Last 3 Months' },
            { value: 'last-six-months', label: 'Last 6 Months' },
            { value: 'this-year', label: 'This Year' }
        ];
        
        const optionsHTML = periodOptions.map(option => 
            `<div class="filter-option ${option.value === currentPeriod ? 'selected' : ''}" data-value="${option.value}">
                ${option.label}
            </div>`
        ).join('');
        
        const modalHTML = `
            <div class="modal-overlay active" id="habit-filter-modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Change Time Period</h3>
                        <button class="modal-close" id="habit-filter-modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="filter-options">
                            ${optionsHTML}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-secondary" id="habit-filter-cancel-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        const modal = document.getElementById('habit-filter-modal-overlay');
        const closeBtn = document.getElementById('habit-filter-modal-close');
        const cancelBtn = document.getElementById('habit-filter-cancel-btn');
        const filterOptions = modal.querySelectorAll('.filter-option');
        
        // Close modal handlers
        const closeModal = () => {
            modal.remove();
        };
        
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Filter option selection
        filterOptions.forEach(option => {
            option.addEventListener('click', () => {
                const newPeriod = option.dataset.value;
                console.log('Filter option selected:');
                console.log('- Current period:', currentPeriod);
                console.log('- New period:', newPeriod);
                console.log('- Habit name:', habitName);
                console.log('- Widget element:', widgetElement);
                updateWidgetPeriod(currentPeriod, newPeriod, habitName, widgetElement);
                closeModal();
            });
        });
    }
    
    function updateWidgetPeriod(oldPeriod, newPeriod, habitName, widgetElement) {
        console.log('=== updateWidgetPeriod DEBUG ===');
        console.log('oldPeriod:', oldPeriod);
        console.log('newPeriod:', newPeriod);
        console.log('habitName:', habitName);
        console.log('widgetElement passed:', widgetElement);
        
        if (!placeholder || !onCommandChange) {
            console.log('Missing placeholder or onCommandChange');
            return;
        }
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) {
            console.log('No pageWrapper found');
            return;
        }
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        console.log('Storage key:', key);
        console.log('Original content:', content);
        
        if (!content) {
            console.log('No content found');
            return;
        }
        
        // Determine widget type from the passed widget element
        const widgetType = widgetElement && widgetElement.classList.contains('grid') ? 'grid' :
                          widgetElement && widgetElement.classList.contains('stats') ? 'stats' :
                          widgetElement && widgetElement.classList.contains('chart') ? 'chart' : null;
        
        console.log('Widget element classes:', widgetElement ? widgetElement.className : 'null');
        console.log('Widget type detected:', widgetType);
        
        if (!widgetType) {
            console.log('No widget type detected');
            return;
        }
        
        let updatedContent = content;
        
        // Update the specific widget instance using global replace like chart widgets
        if (habitName && widgetType === 'chart') {
            // For chart widgets (with habit name)
            const chartRegex = new RegExp(`HABITS:\\s*chart,\\s*${habitName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${oldPeriod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
            console.log('Chart regex:', chartRegex);
            const matches = content.match(chartRegex);
            console.log('Chart matches found:', matches);
            updatedContent = updatedContent.replace(chartRegex, `HABITS: chart, ${habitName}, ${newPeriod}`);
        } else {
            // For grid and stats widgets, handle both with and without explicit periods
            let widgetRegex, replacement;
            
            // First try to match widget with explicit period
            widgetRegex = new RegExp(`HABITS:\\s*${widgetType},\\s*${oldPeriod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
            console.log(`${widgetType} regex (with period):`, widgetRegex);
            let matches = content.match(widgetRegex);
            console.log(`${widgetType} matches found (with period):`, matches);
            
            if (matches && matches.length > 0) {
                // Found widget with explicit period, replace it
                replacement = `HABITS: ${widgetType}, ${newPeriod}`;
                updatedContent = updatedContent.replace(widgetRegex, replacement);
            } else {
                // Try to match widget without explicit period
                widgetRegex = new RegExp(`HABITS:\\s*${widgetType}(?!,)`, 'gi');
                console.log(`${widgetType} regex (without period):`, widgetRegex);
                matches = content.match(widgetRegex);
                console.log(`${widgetType} matches found (without period):`, matches);
                
                if (matches && matches.length > 0) {
                    // Found widget without explicit period, add the period
                    replacement = `HABITS: ${widgetType}, ${newPeriod}`;
                    updatedContent = updatedContent.replace(widgetRegex, replacement);
                }
            }
        }
        
        console.log('Updated content:', updatedContent);
        console.log('Content changed:', content !== updatedContent);
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
        
        // Trigger full page re-render
        if (typeof renderApp === 'function') {
            setTimeout(() => renderApp(), 0);
        }
        
        console.log('=== END DEBUG ===');
    }
    
    function addNewHabit(name, type, target = null) {
        const currentDefinitions = getHabitDefinitions();
        
        // Check for duplicate names
        if (currentDefinitions.some(h => h.name === name)) {
            alert('A habit with this name already exists');
            return;
        }
        
        const newHabit = {
            name,
            type,
            id: generateHabitId(name)
        };
        
        if (type === 'quantified') {
            newHabit.target = target;
        }
        
        // Add to current definitions
        currentDefinitions.push(newHabit);
        saveHabitDefinitions(currentDefinitions);
        
        // Update the page content to include the new habit
        updatePageContentWithNewHabit(newHabit);
        
        // Force a complete page re-render to show the changes
        if (typeof renderApp === 'function') {
            setTimeout(() => {
                renderApp();
            }, 100);
        }
    }
    
    function removeHabit(habitId) {
        const currentDefinitions = getHabitDefinitions();
        const habitToRemove = currentDefinitions.find(h => h.id === habitId);
        
        if (!habitToRemove) {
            return;
        }
        
        // First, update the page content to remove the habit line (before removing from storage)
        updatePageContentRemoveHabitByName(habitToRemove.name);
        
        // Remove all historical data for this habit
        removeHabitDataCompletely(habitId);
        
        // Then update the definitions
        const updatedDefinitions = currentDefinitions.filter(h => h.id !== habitId);
        
        // Save updated definitions
        saveHabitDefinitions(updatedDefinitions);
        
        // Force a complete page re-render to show the changes
        if (typeof renderApp === 'function') {
            setTimeout(() => {
                renderApp();
            }, 100);
        }
    }
    
    function updatePageContentWithNewHabit(newHabit) {
        if (!placeholder) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        // Find HABITS: define block and add the new habit
        const lines = content.split('\n');
        let updatedContent = content;
        
        // Look for existing HABITS: define block
        let defineBlockIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().match(/^HABITS:\s*define$/i)) {
                defineBlockIndex = i;
                break;
            }
        }
        
        if (defineBlockIndex !== -1) {
            // Find the end of the definition block
            let insertIndex = defineBlockIndex + 1;
            while (insertIndex < lines.length && lines[insertIndex].trim().startsWith('- ')) {
                insertIndex++;
            }
            
            // Insert the new habit
            const habitLine = newHabit.type === 'quantified' 
                ? `- ${newHabit.name} (TARGET: ${newHabit.target})`
                : `- ${newHabit.name}`;
            
            lines.splice(insertIndex, 0, habitLine);
            updatedContent = lines.join('\n');
        } else {
            // Create a new HABITS: define block at the end
            const habitLine = newHabit.type === 'quantified' 
                ? `- ${newHabit.name} (TARGET: ${newHabit.target})`
                : `- ${newHabit.name}`;
            
            updatedContent += `\n\nHABITS: define\n${habitLine}`;
        }
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function updatePageContentRemoveHabitByName(habitName) {
        if (!placeholder) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        const lines = content.split('\n');
        let updatedLines = [];
        let foundAndRemoved = false;
        
        for (const line of lines) {
            // Skip lines that match this habit
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('- ')) {
                const habitText = trimmedLine.substring(2).trim();
                const targetMatch = habitText.match(/^(.*?)\s*\(TARGET:\s*(.+)\)$/i);
                const habitName_clean = targetMatch ? targetMatch[1].trim() : habitText;
                
                if (habitName_clean === habitName) {
                    foundAndRemoved = true;
                    continue; // Skip this line (don't add it to updatedLines)
                }
            }
            updatedLines.push(line);
        }
        
        const updatedContent = updatedLines.join('\n');
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    function updatePageContentRemoveHabit(habitId) {
        if (!placeholder) return;
        
        const pageWrapper = placeholder.closest('[data-key]');
        if (!pageWrapper) return;
        
        const key = pageWrapper.dataset.key;
        const content = getStorage(key);
        if (!content) return;
        
        // Find and remove the habit line from the content
        const currentDefinitions = getHabitDefinitions();
        const habitToRemove = currentDefinitions.find(h => h.id === habitId);
        if (!habitToRemove) {
            return;
        }
        
        const lines = content.split('\n');
        let updatedLines = [];
        let foundAndRemoved = false;
        
        for (const line of lines) {
            // Skip lines that match this habit
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('- ')) {
                const habitText = trimmedLine.substring(2).trim();
                const targetMatch = habitText.match(/^(.*?)\s*\(TARGET:\s*(.+)\)$/i);
                const habitName = targetMatch ? targetMatch[1].trim() : habitText;
                
                if (habitName === habitToRemove.name) {
                    foundAndRemoved = true;
                    continue; // Skip this line (don't add it to updatedLines)
                }
            }
            updatedLines.push(line);
        }
        
        const updatedContent = updatedLines.join('\n');
        
        // Save updated content
        setStorage(key, updatedContent);
        
        // Sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
            debouncedSyncWithCloud();
        }
    }
    
    // --- MAIN INITIALIZATION ---
    
    function init(options) {
        const currentPlaceholder = options.placeholder;
        
        // Allow re-initialization if this is a re-render after data changes
        const isReInitialization = currentPlaceholder.classList.contains('habit-initialized');
        if (isReInitialization) {
            
            // Remove the old class and content to allow fresh rendering
            currentPlaceholder.classList.remove('habit-initialized');
            currentPlaceholder.innerHTML = '';
        }
        
        currentPlaceholder.classList.add('habit-initialized');
        
        // Now assign to global variables after validation
        placeholder = currentPlaceholder;
        onCommandChange = options.onCommandChange;
        
        const command = options.command || 'HABITS: today';
        
        const config = parseCommand(command);
        
        // Only parse and save habit definitions if we encounter a define command
        if (config.type === 'define') {
            const pageWrapper = placeholder.closest('[data-key]');
            if (pageWrapper) {
                const key = pageWrapper.dataset.key;
                const content = getStorage(key);
                if (content) {
                    const definitions = parseHabitDefinitions(content);
                    if (definitions.length > 0) {
                        habitDefinitions = definitions;
                        saveHabitDefinitions(definitions);
                    }
                }
            }
            // For define commands, render a hidden widget by default
            placeholder.innerHTML = `<div class="habit-widget define-widget" style="display: none;">
                <div class="habit-header">
                    <div class="habit-header-content">
                        <h3>📋 Habit Definitions</h3>
                        <div class="habit-help">
                            <span>✅ ${habitDefinitions.length} habit(s) defined successfully!</span>
                            <br><br>
                            <strong>Defined habits:</strong><br>
                            ${habitDefinitions.map(h => `• ${h.name}${h.type === 'quantified' ? ` (Target: ${h.target})` : ''}`).join('<br>')}
                            <br><br>
                            <small style="color: #666;">💡 This widget is hidden by default. You can add habits using the "New Habit" button in other habit widgets.</small>
                        </div>
                    </div>
                    <div class="finance-widget-controls">
                        <button class="finance-add-button habit-add-button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            New Habit
                        </button>
                        <button class="finance-add-button habit-toggle-visibility-button" style="margin-left: 0.5rem;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            Show/Hide
                        </button>
                    </div>
                </div>
            </div>`;
            attachEventListeners();
            return;
        }
        
        // For other commands, load existing definitions
        const pageWrapper = placeholder.closest('[data-key]');
        if (pageWrapper) {
            const key = pageWrapper.dataset.key;
            const content = getStorage(key);
            if (content) {
                const definitions = parseHabitDefinitions(content);
                if (definitions.length > 0) {
                    habitDefinitions = definitions;
                    saveHabitDefinitions(definitions);
                }
            }
        }
        
        // Render appropriate widget
        let html = '';
        switch (config.type) {
            case 'today':
                html = renderTodayWidget();
                break;
            case 'grid':
                html = renderGridWidget(config.period);
                break;
            case 'stats':
                html = renderStatsWidget(config.period);
                break;
            case 'chart':
                html = renderChartWidget(config.habit, config.period);
                break;
            default:
                html = renderTodayWidget();
        }
        
        placeholder.innerHTML = html;
        attachEventListeners();
    }
    
    // --- PUBLIC API ---
    
    return {
        init,
        parseHabitDefinitions,
        getHabitDefinitions,
        saveHabitDefinitions,
        getHabitData,
        updateHabitValue,
        getAllHabitData
    };
})();

// Make it globally available
window.HabitTracker = HabitTracker;
