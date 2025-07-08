// js/moodTracker.js

const moodTracker = (() => {
    // --- STATE & CONSTANTS ---
    // Reference to global DOM object if available
    const DOM = window.DOM || {};
    // Reference to storage functions
    const getStorage = window.getStorage || ((key) => localStorage.getItem(key) || '');
    const setStorage = window.setStorage || ((key, value) => localStorage.setItem(key, value));
    const MOODS = {
        happy:       { label: 'Happy', color: 'mood-happy', emoji: '😊' },
        excited:     { label: 'Excited', color: 'mood-excited', emoji: '🤩' },
        motivated:   { label: 'Motivated', color: 'mood-motivated', emoji: '💪' },
        inspired:    { label: 'Inspired', color: 'mood-inspired', emoji: '✨' },
        proud:       { label: 'Proud', color: 'mood-proud', emoji: '😎' },
        hopeful:     { label: 'Hopeful', color: 'mood-hopeful', emoji: '🌈' },
        grateful:    { label: 'Grateful', color: 'mood-grateful', emoji: '🙏' },
        peaceful:    { label: 'Peaceful', color: 'mood-peaceful', emoji: '🕊️' },
        loved:       { label: 'Loved', color: 'mood-loved', emoji: '❤️' },
        content:     { label: 'Content', color: 'mood-content', emoji: '🙂' },
        calm:        { label: 'Calm', color: 'mood-calm', emoji: '😌' },
        neutral:     { label: 'Neutral', color: 'mood-neutral', emoji: '😐' },
        nostalgic:   { label: 'Nostalgic', color: 'mood-nostalgic', emoji: '🕰️' },
        tired:       { label: 'Tired', color: 'mood-tired', emoji: '😴' },
        bored:       { label: 'Bored', color: 'mood-bored', emoji: '🥱' },
        shy:         { label: 'Shy', color: 'mood-shy', emoji: '😳' },
        confused:    { label: 'Confused', color: 'mood-confused', emoji: '😵' },
        anxious:     { label: 'Anxious', color: 'mood-anxious', emoji: '😟' },
        stressed:    { label: 'Stressed', color: 'mood-stressed', emoji: '😣' },
        overwhelmed: { label: 'Overwhelmed', color: 'mood-overwhelmed', emoji: '😩' },
        sad:         { label: 'Sad', color: 'mood-sad', emoji: '😢' },
        lonely:      { label: 'Lonely', color: 'mood-lonely', emoji: '🥺' },
        angry:       { label: 'Angry', color: 'mood-angry', emoji: '😠' },
        determined:  { label: 'Determined', color: 'mood-determined', emoji: '🔥' }
    };


    const MOOD_KEYS = Object.keys(MOODS);
    const WIDGET_TYPES = ['calendar', 'circular', 'chart'];
    const WIDGET_STYLES = ['color', 'emoji', 'all'];

    let state = {
        command: '',
        selectedMood: 'happy',
        widgetType: 'calendar',
        widgetStyle: 'color',
        moodData: {},
        currentMonthDate: new Date(),
        onCommandChange: () => {}, // Callback to notify main app of changes
    };

    // --- DOM ELEMENTS ---
    let containerEl = null;
    let widgetContainer = null;
    let moodPaletteContainer = null;
    let controlsContainer = null;
    let interactionTextEl = null;

    // --- PARSER ---
    function parseCommand(command) {
        const result = { widgetType: null, widgetStyle: null, moodData: {}, error: null };
        const lowerCommand = command.toLowerCase().trim();

        if (!lowerCommand.startsWith('mood:')) {
            result.error = 'Command must start with "MOOD:".';
            return result;
        }

        const parts = lowerCommand.replace(/^mood:[\s,]+/, '').split(',').map(p => p.trim()).filter(p => p);
        if (parts.length < 2) {
            result.error = 'Invalid format. Use "MOOD: <type>, <style>, [data...]".';
            return result;
        }

        const [typeStr, styleStr, ...dataParts] = parts;

        if (WIDGET_TYPES.includes(typeStr)) result.widgetType = typeStr;
        if (WIDGET_STYLES.includes(styleStr)) result.widgetStyle = styleStr;

        const errors = [];
        if (!result.widgetType) errors.push(`Invalid type. Try: ${WIDGET_TYPES.join(', ')}.`);
        if (!result.widgetStyle) errors.push(`Invalid style. Try: ${WIDGET_STYLES.join(', ')}.`);

        const dateRegex = /^(\d{4}-\d{2}-\d{2})$/;
        dataParts.forEach(dataPart => {
            const [date, mood] = dataPart.split(':');
            if (date && mood && dateRegex.test(date) && MOOD_KEYS.includes(mood)) {
                result.moodData[date] = mood;
            }
        });

        if (errors.length > 0) result.error = errors.join(' ');
        return result;
    }

    // --- EVENT HANDLERS ---
    function handleDayClick(date) {
        const dateKey = dateFns.format(date, 'yyyy-MM-dd');
        const newMoodData = { ...state.moodData };
        const moodLabel = MOODS[state.selectedMood].label;

        if (newMoodData[dateKey] === state.selectedMood) {
            delete newMoodData[dateKey];
            updateInteractionText(`Removed ${moodLabel} from ${dateFns.format(date, 'MMMM d, yyyy')}.`);
        } else {
            newMoodData[dateKey] = state.selectedMood;
            updateInteractionText(`Set ${dateFns.format(date, 'MMMM d, yyyy')} to ${moodLabel}.`);
        }

        rebuildCommandString(newMoodData);
        main(); // Re-render
    }

    function handleDayHover(date) {
        if (date) {
            const dateKey = dateFns.format(date, 'yyyy-MM-dd');
            const mood = state.moodData[dateKey];
            const moodLabel = mood ? MOODS[mood].label : 'not set';
            updateInteractionText(`Hovering ${dateFns.format(date, 'MMMM d, yyyy')}. Mood: ${moodLabel}.`);
        } else {
            updateInteractionText('Select a mood and click on a date to log it.');
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderControls() {
        // Create options for widget type dropdown
        const typeOptions = WIDGET_TYPES.map(type => {
            const isSelected = state.widgetType === type;
            return `<option value="${type}" ${isSelected ? 'selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`;
        }).join('');

        // Create options for widget style dropdown
        const styleOptions = WIDGET_STYLES.map(style => {
            const isSelected = state.widgetStyle === style;
            return `<option value="${style}" ${isSelected ? 'selected' : ''}>${style.charAt(0).toUpperCase() + style.slice(1)}</option>`;
        }).join('');

        controlsContainer.innerHTML = `
            <div class="mood-controls">
                <div class="mood-control-group" onclick="event.stopPropagation()">
                    <label for="widget-type-select">Widget Type:</label>
                    <div class="mood-select-wrapper">
                        <select id="widget-type-select" class="mood-select" tabindex="0">
                            ${typeOptions}
                        </select>
                    </div>
                </div>
                <div class="mood-control-group" onclick="event.stopPropagation()">
                    <label for="widget-style-select">Display Style:</label>
                    <div class="mood-select-wrapper">
                        <select id="widget-style-select" class="mood-select" tabindex="0">
                            ${styleOptions}
                        </select>
                    </div>
                </div>
            </div>
        `;

        // Get references to the dropdown elements
        const typeSelect = controlsContainer.querySelector('#widget-type-select');
        const styleSelect = controlsContainer.querySelector('#widget-style-select');

        // Remove any existing listeners to avoid duplicates
        const newTypeSelect = typeSelect.cloneNode(true);
        const newStyleSelect = styleSelect.cloneNode(true);
        
        typeSelect.parentNode.replaceChild(newTypeSelect, typeSelect);
        styleSelect.parentNode.replaceChild(newStyleSelect, styleSelect);

        // Add event listeners
        newTypeSelect.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
        });
        
        newStyleSelect.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling
        });
        
        newTypeSelect.addEventListener('change', (e) => {
            e.preventDefault(); // Prevent default action that might trigger edit mode
            e.stopPropagation(); // Stop event from bubbling up
            const newType = e.target.value;
            updateWidgetConfig(newType, state.widgetStyle);
        });

        newStyleSelect.addEventListener('change', (e) => {
            e.preventDefault(); // Prevent default action that might trigger edit mode
            e.stopPropagation(); // Stop event from bubbling up
            const newStyle = e.target.value;
            updateWidgetConfig(state.widgetType, newStyle);
        });
        
        // Prevent edit mode when clicking labels
        controlsContainer.querySelectorAll('label').forEach(label => {
            label.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }
    
    function renderMoodPalette() {
        const buttonsHTML = MOOD_KEYS.map(mood => {
            const config = MOODS[mood];
            const isSelected = state.selectedMood === mood;
            const ringClass = isSelected ? 'ring-2' : '';
            return `
                <button
                    data-mood="${mood}"
                    class="mood-button ${ringClass}"
                    title="${config.label}"
                >
                    <div class="mood-color-splotch ${config.color}"></div>
                    <span class="mood-emoji">${config.emoji}</span>
                </button>
            `;
        }).join('');

        moodPaletteContainer.innerHTML = `
            <div class="mood-palette">
              <h3 class="mood-palette-title">SELECT A MOOD</h3>
              <div class="mood-palette-buttons">
                ${buttonsHTML}
              </div>
            </div>
        `;

        moodPaletteContainer.querySelectorAll('.mood-button').forEach(button => {
            button.addEventListener('click', () => {
                state.selectedMood = button.dataset.mood;
                renderMoodPalette(); // Re-render to show selection
            });
        });
    }

    function renderWidgetHeader() {
        return `
            <div class="widget-header">
              <button id="prev-month" class="widget-nav-btn">&lt; Prev</button>
              <h2 class="widget-title">${dateFns.format(state.currentMonthDate, 'MMMM yyyy')}</h2>
              <button id="next-month" class="widget-nav-btn">Next &gt;</button>
            </div>
        `;
    }

    function renderCalendarWidget() {
        const monthStart = dateFns.startOfMonth(state.currentMonthDate);
        const monthEnd = dateFns.endOfMonth(state.currentMonthDate);
        const calendarStart = dateFns.startOfWeek(monthStart);
        const calendarEnd = dateFns.endOfWeek(monthEnd);
        const days = dateFns.eachDayOfInterval({ start: calendarStart, end: calendarEnd });

        const dayCellsHTML = days.map(day => {
            const dateKey = dateFns.format(day, 'yyyy-MM-dd');
            const mood = state.moodData[dateKey];
            const moodInfo = mood ? MOODS[mood] : null;
            const isCurrentMonth = dateFns.isSameMonth(day, state.currentMonthDate);
            const isToday = dateFns.isToday(day);

            let cellStyle = '';
            if (moodInfo && (state.widgetStyle === 'color' || state.widgetStyle === 'all')) {
                cellStyle = moodInfo.color;
            } else if (isCurrentMonth) {
                cellStyle = 'day-cell-default';
            }

            const dayNumber = dateFns.format(day, 'd');
            let content = `<span class="day-cell-number">${dayNumber}</span>`;
            if ((state.widgetStyle === 'emoji' && moodInfo) || (state.widgetStyle === 'all' && moodInfo)) {
                content = `<span class="day-cell-emoji">${moodInfo.emoji}</span>`;
            }

            return `
                <div class="day-cell ${isCurrentMonth ? 'cursor-pointer' : 'disabled'} ${cellStyle} ${isToday ? 'is-today' : ''}" data-date="${day.toISOString()}">
                    <div class="day-cell-content">
                        ${content}
                    </div>
                </div>
            `;
        }).join('');

        widgetContainer.innerHTML = `
            <div class="calendar-widget">
              ${renderWidgetHeader()}
              <div class="calendar-grid-header">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div>${d}</div>`).join('')}
              </div>
              <div class="calendar-grid">${dayCellsHTML}</div>
            </div>
        `;

        // Attach Listeners
        widgetContainer.querySelector('#prev-month').addEventListener('click', () => {
            state.currentMonthDate = dateFns.subMonths(state.currentMonthDate, 1);
            main();
        });
        widgetContainer.querySelector('#next-month').addEventListener('click', () => {
            state.currentMonthDate = dateFns.addMonths(state.currentMonthDate, 1);
            main();
        });
        widgetContainer.querySelectorAll('.day-cell.cursor-pointer').forEach(cell => {
             const date = new Date(cell.dataset.date);
             cell.addEventListener('click', () => handleDayClick(date));
             cell.addEventListener('mouseenter', () => handleDayHover(date));
             cell.addEventListener('mouseleave', () => handleDayHover(null));
        });
    }

    function renderCircularWidget() {
        const monthStart = dateFns.startOfMonth(state.currentMonthDate);
        const daysInMonth = dateFns.getDaysInMonth(state.currentMonthDate);
        const days = Array.from({ length: daysInMonth }, (_, i) => dateFns.addDays(monthStart, i));

        const cells = days.map((day, i) => {
            const dateKey = dateFns.format(day, 'yyyy-MM-dd');
            const mood = state.moodData[dateKey];
            const moodInfo = mood ? MOODS[mood] : null;
            const isToday = dateFns.isToday(day);

            let cellStyle = '';
            let hasMoodClass = '';
            if (moodInfo && (state.widgetStyle === 'color' || state.widgetStyle === 'all')) {
                cellStyle = moodInfo.color;
                hasMoodClass = 'has-mood';
            } else {
                cellStyle = 'circular-cell-default';
            }

            const dayNumber = dateFns.format(day, 'd');
            let content = `<span class="day-cell-number">${dayNumber}</span>`;
            if ((state.widgetStyle === 'emoji' && moodInfo) || (state.widgetStyle === 'all' && moodInfo)) {
                content = `<span class="day-cell-emoji">${moodInfo.emoji}</span>`;
            }
            
            const angle = (i / daysInMonth) * 360;
            const radius = 150;
            const x = radius * Math.cos(angle * Math.PI / 180);
            const y = radius * Math.sin(angle * Math.PI / 180);

            return `
                <div class="circular-cell ${cellStyle} ${isToday ? 'is-today' : ''} ${hasMoodClass}" 
                     style="transform: translate(${x}px, ${y}px);" 
                     data-date="${day.toISOString()}">
                    <div class="circular-cell-content">${content}</div>
                </div>
            `;
        }).join('');

        widgetContainer.innerHTML = `
            <div class="circular-widget-container">
                ${renderWidgetHeader()}
                <div class="circular-widget">
                    <span class="circular-month-label">${dateFns.format(state.currentMonthDate, 'MMM')}</span>
                    ${cells}
                </div>
            </div>
        `;

        // Attach Listeners
        widgetContainer.querySelector('#prev-month').addEventListener('click', () => {
            state.currentMonthDate = dateFns.subMonths(state.currentMonthDate, 1);
            main();
        });
        widgetContainer.querySelector('#next-month').addEventListener('click', () => {
            state.currentMonthDate = dateFns.addMonths(state.currentMonthDate, 1);
            main();
        });

        widgetContainer.querySelectorAll('.circular-cell').forEach(cell => {
            const date = new Date(cell.dataset.date);
            cell.addEventListener('click', () => handleDayClick(date));
            cell.addEventListener('mouseenter', () => handleDayHover(date));
            cell.addEventListener('mouseleave', () => handleDayHover(null));
        });
    }

    function renderChartWidget() {
        // Get the current year from the selected date
        const year = dateFns.getYear(state.currentMonthDate);
        const yearStart = new Date(year, 0, 1); // January 1st
        
        // Create month headers (12 columns)
        const monthHeaders = `<div class="month-header-spacer"></div>` + 
            Array.from({ length: 12 }, (_, monthIndex) => {
                const month = new Date(year, monthIndex, 1);
                return `<div class="month-label">${dateFns.format(month, 'MMM')}</div>`;
            }).join('');
        
        // Create day rows (31 rows)
        let pixelGrid = '';
        
        for (let day = 1; day <= 31; day++) {
            // Create a row for this day number
            let dayRow = `<div class="day-row">
                <div class="day-number">${day}</div>
                <div class="month-cells">`;
                
            // Add cells for each month (12 cells per row)
            for (let month = 0; month < 12; month++) {
                // Check if this day exists in this month
                const daysInMonth = dateFns.getDaysInMonth(new Date(year, month, 1));
                
                if (day <= daysInMonth) {
                    // This is a valid day for this month
                    const currentDate = new Date(year, month, day);
                    const dateKey = dateFns.format(currentDate, 'yyyy-MM-dd');
                    const mood = state.moodData[dateKey];
                    const moodInfo = mood ? MOODS[mood] : null;
                    const isToday = dateFns.isToday(currentDate);
                    
                    // Determine cell styling
                    let cellStyle = 'pixel-cell-default';
                    let cellContent = '';
                    
                    if (moodInfo && (state.widgetStyle === 'color' || state.widgetStyle === 'all')) {
                        cellStyle = moodInfo.color;
                    }
                    
                    if (moodInfo && (state.widgetStyle === 'emoji' || state.widgetStyle === 'all')) {
                        cellContent = `<span class="pixel-cell-emoji">${moodInfo.emoji}</span>`;
                    }
                    
                    dayRow += `
                        <div class="pixel-cell-wrapper" data-date="${currentDate.toISOString()}">
                            <div class="pixel-cell ${cellStyle} ${isToday ? 'is-today' : ''}" title="${dateFns.format(currentDate, 'MMMM d, yyyy')}">
                                ${cellContent}
                            </div>
                            <div class="pixel-cell-tooltip">
                                <div class="tooltip-date">${dateFns.format(currentDate, 'MMM d')}</div>
                                ${moodInfo ? `<div class="tooltip-mood">${moodInfo.label} ${moodInfo.emoji}</div>` : '<div class="tooltip-mood">No mood set</div>'}
                            </div>
                        </div>`;
                } else {
                    // This day doesn't exist in this month (e.g., February 30)
                    dayRow += `<div class="pixel-cell-wrapper empty"></div>`;
                }
            }
            
            dayRow += `</div></div>`;
            pixelGrid += dayRow;
        }

        widgetContainer.innerHTML = `
            <div class="chart-widget">
              <div class="widget-header year-header">
                <button id="prev-year" class="widget-nav-btn">&lt; Prev</button>
                <h2 class="widget-title">${year}</h2>
                <button id="next-year" class="widget-nav-btn">Next &gt;</button>
              </div>
              <div class="year-grid-container">
                <div class="month-headers">
                  ${monthHeaders}
                </div>
                <div class="year-grid">
                  ${pixelGrid}
                </div>
              </div>
            </div>
        `;

        // Attach Listeners
        widgetContainer.querySelector('#prev-year').addEventListener('click', () => {
            state.currentMonthDate = dateFns.subYears(state.currentMonthDate, 1);
            main();
        });
        
        widgetContainer.querySelector('#next-year').addEventListener('click', () => {
            state.currentMonthDate = dateFns.addYears(state.currentMonthDate, 1);
            main();
        });
        
        widgetContainer.querySelectorAll('.pixel-cell').forEach(cell => {
            const wrapper = cell.closest('.pixel-cell-wrapper');
            if (wrapper && wrapper.dataset.date) {
                const date = new Date(wrapper.dataset.date);
                
                cell.addEventListener('click', () => handleDayClick(date));
                cell.addEventListener('mouseenter', () => handleDayHover(date));
                cell.addEventListener('mouseleave', () => handleDayHover(null));
            }
        });
    }

    // --- UTILITY FUNCTIONS ---
    function updateWidgetConfig(newWidgetType, newWidgetStyle) {
        state.widgetType = newWidgetType;
        state.widgetStyle = newWidgetStyle;
        
        // Update the command string with new widget type and style
        let commandPrefix = `MOOD: ${newWidgetType}, ${newWidgetStyle}`;
        
        const dataString = Object.entries(state.moodData)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, mood]) => `${date}:${mood}`)
            .join(', ');
            
        const newCommand = dataString ? `${commandPrefix}, ${dataString}` : commandPrefix;
        
        // Update state
        const oldCommand = state.command;
        state.command = newCommand;
        
        // Get the placeholder element
        const placeholderEl = containerEl.closest('.mood-tracker-placeholder');
        if (placeholderEl) {
            // Update the command attribute on the placeholder element
            placeholderEl.dataset.command = newCommand;
            
            // Get the current page key from the closest wrapper with a data-key
            const pageWrapper = DOM.pageContentWrapper || document.querySelector('[data-key]');
            if (pageWrapper && pageWrapper.dataset.key) {
                const pageKey = pageWrapper.dataset.key;
                const currentContent = getStorage(pageKey);
                
                if (currentContent) {
                    // Replace the old command with the new one in the content
                    const updatedContent = currentContent.replace(oldCommand, newCommand);
                    setStorage(pageKey, updatedContent);
                }
            }
        }
        
        // Then notify the parent app about the command change
        state.onCommandChange(newCommand);
        
        main(); // Re-render the widget with new settings
    }
    
    function rebuildCommandString(newMoodData) {
        // Extract widget type and style from current command
        const widgetType = state.widgetType;
        const widgetStyle = state.widgetStyle;
        
        // Create new command string with existing widget type and style
        let commandPrefix = `MOOD: ${widgetType}, ${widgetStyle}`;
        
        const dataString = Object.entries(newMoodData)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, mood]) => `${date}:${mood}`)
            .join(', ');

        // Create the new command
        const newCommand = dataString ? `${commandPrefix}, ${dataString}` : commandPrefix;
        const oldCommand = state.command;
        
        // Update state
        state.command = newCommand;
        state.moodData = newMoodData;
        
        // Get the placeholder element
        const placeholderEl = containerEl.closest('.mood-tracker-placeholder');
        if (placeholderEl) {
            // Update the command attribute on the placeholder element
            placeholderEl.dataset.command = newCommand;
            
            // Get the current page key from the closest wrapper with a data-key
            const pageWrapper = DOM.pageContentWrapper || document.querySelector('[data-key]');
            if (pageWrapper && pageWrapper.dataset.key) {
                const pageKey = pageWrapper.dataset.key;
                const currentContent = getStorage(pageKey);
                
                if (currentContent) {
                    // Replace the old command with the new one in the content
                    const updatedContent = currentContent.replace(oldCommand, newCommand);
                    setStorage(pageKey, updatedContent);
                }
            }
        }
        
        // Then notify the parent app about the command change
        state.onCommandChange(newCommand);
    }

    function updateInteractionText(text) {
        interactionTextEl.textContent = text;
    }

    // --- MAIN APP LOGIC ---
    function main() {
        const parsed = parseCommand(state.command);

        state.widgetType = parsed.widgetType;
        state.widgetStyle = parsed.widgetStyle;
        state.moodData = parsed.moodData;

        // Refresh controls to match current state
        renderControls();
        
        // Clear previous widget
        widgetContainer.innerHTML = '';

        if (parsed.error) {
            widgetContainer.innerHTML = `<div class="widget-error">${parsed.error}</div>`;
            return;
        }

        if (parsed.widgetType && parsed.widgetStyle) {
            switch(parsed.widgetType) {
                case 'calendar': renderCalendarWidget(); break;
                case 'circular': renderCircularWidget(); break;
                case 'chart': renderChartWidget(); break;
            }
        }
    }

    function init(options) {
        const { placeholder, command, onCommandChange } = options;
        containerEl = placeholder;
        state.command = command;
        state.onCommandChange = onCommandChange;

        // Create the DOM structure for the widget inside the container
        containerEl.innerHTML = `
            <div class="mood-tracker-wrapper">
                <div id="mood-controls-container"></div>
                <div id="mood-widget-container"></div>
                <div id="mood-palette-container"></div>
                <div class="mood-interaction-bar">
                    <p id="mood-interaction-text">Select a mood and click on a date to log it.</p>
                </div>
            </div>
        `;

        widgetContainer = containerEl.querySelector('#mood-widget-container');
        moodPaletteContainer = containerEl.querySelector('#mood-palette-container');
        controlsContainer = containerEl.querySelector('#mood-controls-container');
        interactionTextEl = containerEl.querySelector('#mood-interaction-text');

        renderControls();
        renderMoodPalette();
        main();
    }

    return {
        init,
    };
})();
