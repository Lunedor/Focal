// js/moodTracker.js

const moodTracker = (() => {
    // --- STATE & CONSTANTS ---
    const MOODS = {
        happy: { label: 'Happy', color: 'mood-happy', emoji: '😊' },
        excited: { label: 'Excited', color: 'mood-excited', emoji: '🤩' },
        neutral: { label: 'Neutral', color: 'mood-neutral', emoji: '😐' },
        sad: { label: 'Sad', color: 'mood-sad', emoji: '😢' },
        angry: { label: 'Angry', color: 'mood-angry', emoji: '😠' },
        calm: { label: 'Calm', color: 'mood-calm', emoji: '😌' },
        anxious: { label: 'Anxious', color: 'mood-anxious', emoji: '😟' },
        proud: { label: 'Proud', color: 'mood-proud', emoji: '😎' }
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
                    <span class="mood-emoji">${config.emoji}</span>
                    <div class="mood-color-splotch ${config.color}"></div>
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
                cellStyle = 'chart-cell-default';
            }

            const content = (state.widgetStyle === 'emoji' && moodInfo) || (state.widgetStyle === 'all' && moodInfo) ? `<span class="chart-cell-emoji">${moodInfo.emoji}</span>` : ``;
            const textColorClass = moodInfo && (state.widgetStyle === 'color' || state.widgetStyle === 'all') ? 'text-contrast' : '';

            return `
                <div class="chart-cell-group" data-date="${day.toISOString()}">
                    <div class="chart-cell ${isCurrentMonth ? 'cursor-pointer' : 'disabled'} ${cellStyle} ${isToday ? 'is-today' : ''}">
                        <span class="chart-cell-content ${textColorClass}">${content}</span>
                    </div>
                    <div class="chart-cell-tooltip">${dateFns.format(day, 'MMM d, yyyy')}${moodInfo ? `: ${moodInfo.label}` : ''}</div>
                </div>
            `;
        }).join('');

        widgetContainer.innerHTML = `
            <div class="chart-widget">
              ${renderWidgetHeader()}
              <div class="calendar-grid-header">
                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div>${d}</div>`).join('')}
              </div>
              <div class="chart-grid">${dayCellsHTML}</div>
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
        widgetContainer.querySelectorAll('.chart-cell.cursor-pointer').forEach(cell => {
             const date = new Date(cell.closest('.chart-cell-group').dataset.date);
             cell.addEventListener('click', () => handleDayClick(date));
             cell.addEventListener('mouseenter', () => handleDayHover(date));
             cell.addEventListener('mouseleave', () => handleDayHover(null));
        });
    }

    // --- UTILITY FUNCTIONS ---
    function rebuildCommandString(newMoodData) {
        const configMatch = state.command.match(/^mood:[^,]+,[^,]+/i);
        if (!configMatch) return;

        const configPart = configMatch[0];
        const dataString = Object.entries(newMoodData)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .map(([date, mood]) => `${date}:${mood}`)
            .join(', ');

        state.command = dataString ? `${configPart}, ${dataString}` : configPart;
        state.moodData = newMoodData;
        state.onCommandChange(state.command);
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

    function init(container, initialCommand, commandChangeCallback) {
        containerEl = container;
        state.command = initialCommand;
        state.onCommandChange = commandChangeCallback;

        // Create the DOM structure for the widget inside the container
        containerEl.innerHTML = `
            <div class="mood-tracker-wrapper">
                <div id="mood-widget-container"></div>
                <div id="mood-palette-container"></div>
                <div class="mood-interaction-bar">
                    <p id="mood-interaction-text">Select a mood and click on a date to log it.</p>
                </div>
            </div>
        `;

        widgetContainer = containerEl.querySelector('#mood-widget-container');
        moodPaletteContainer = containerEl.querySelector('#mood-palette-container');
        interactionTextEl = containerEl.querySelector('#mood-interaction-text');

        renderMoodPalette();
        main();
    }

    return {
        init,
    };
})();
