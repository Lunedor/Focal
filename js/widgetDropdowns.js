// --- WIDGET DROPDOWNS ---

// Centralized dropdown configuration system
const DropdownConfigs = {
    finance: {
        title: 'Finance Widget Settings',
        sections: [
            {
                title: 'Time Period',
                options: [
                    { label: 'All Time', value: 'all' },
                    { label: 'This Month', value: 'this-month' },
                    { label: 'This Year', value: 'this-year', default: true },
                    { label: 'Last 3 Months', value: 'last-3-months' },
                    { label: 'Last 6 Months', value: 'last-6-months' },
                    { label: 'Last 12 Months', value: 'last-12-months' }
                ]
            },
            {
                title: 'Layout',
                options: [
                    { label: 'All Widgets', value: 'summary+chart+chartpie', default: true },
                    { label: 'Summary Only', value: 'summary' },
                    { label: 'Bar Chart Only', value: 'chart' },
                    { label: 'Pie Chart Only', value: 'chartpie' },
                    { label: 'Summary + Bar Chart', value: 'summary+chart' },
                    { label: 'Summary + Pie Chart', value: 'summary+chartpie' }
                ]
            }
        ],
        buildResult: (selections) => `FINANCE: ${selections.layout || 'summary+chart+chartpie'}, USD, ${selections['time-period'] || 'this-year'}\n- `
    },
    
    mood: {
        title: 'Mood Tracker Settings',
        sections: [
            {
                title: 'Display Type',
                options: [
                    { label: 'Calendar View', value: 'calendar', default: true },
                    { label: 'Circular View', value: 'circular' },
                    { label: 'Chart View', value: 'chart' }
                ]
            },
            {
                title: 'Style',
                options: [
                    { label: 'Color Only', value: 'color', default: true },
                    { label: 'Emoji Only', value: 'emoji' },
                    { label: 'Color + Emoji', value: 'all' }
                ]
            }
        ],
        buildResult: (selections) => `MOOD: ${selections['display-type'] || 'calendar'}, ${selections.style || 'color'}\n`
    },
    
    books: {
        title: 'Books Widget Settings',
        sections: [
            {
                title: 'Widget Type',
                options: [
                    { label: 'Full Reading Tracker', value: 'full-tracker', default: true },
                    { label: 'Currently Reading', value: 'currently-reading' },
                    { label: 'To Read List', value: 'to-read' },
                    { label: 'Stats', value: 'stats' },
                    { label: 'Bookshelf View', value: 'bookshelf' }
                ]
            }
        ],
        buildResult: (selections) => `BOOKS: ${selections['widget-type'] || 'full-tracker'}\n`
    },
    
    movies: {
        title: 'Movies Widget Settings',
        sections: [
            {
                title: 'Widget Type',
                options: [
                    { label: 'Full Movie Tracker', value: 'full-tracker', default: true },
                    { label: 'Watchlist', value: 'watchlist' },
                    { label: 'Watched Movies', value: 'watched' },
                    { label: 'Favorites', value: 'favorites' },
                    { label: 'Stats', value: 'stats' }
                ]
            }
        ],
        buildResult: (selections) => `MOVIES: ${selections['widget-type'] || 'full-tracker'}\n`
    },
    
    futurelog: {
        title: 'Future Log Settings',
        sections: [
            {
                title: 'Time Period',
                options: [
                    { label: '3 Months', value: '3-months' },
                    { label: '6 Months', value: '6-months', default: true },
                    { label: '12 Months', value: '12-months' }
                ]
            }
        ],
        buildResult: (selections) => `FUTURELOG: ${selections['time-period'] || '6-months'}\n`
    }
};

// Utility function to create dropdown with safe cleanup
function createDropdownBase(button, className, content) {
    const dropdown = document.createElement('div');
    dropdown.className = className;
    
    // Position the dropdown below the button
    const buttonRect = button.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = (buttonRect.bottom + window.scrollY) + 'px';
    dropdown.style.left = (buttonRect.left + window.scrollX - 40) + 'px';
    dropdown.style.zIndex = '1000';
    
    dropdown.innerHTML = content;
    
    // Track if dropdown is already closed to avoid DOM errors
    let isDropdownClosed = false;
    
    // Function to safely close the dropdown
    const safeCloseDropdown = () => {
        if (isDropdownClosed) return;
        
        try {
            if (dropdown.parentNode) {
                dropdown.parentNode.removeChild(dropdown);
            }
            isDropdownClosed = true;
        } catch (e) {
            console.error('Error closing dropdown:', e);
        }
    };
    
    return { dropdown, safeCloseDropdown };
}

// Centralized dropdown creator
function createCentralizedDropdown(button, textarea, wrapper, widgetType) {
    const config = DropdownConfigs[widgetType];
    if (!config) {
        console.error(`Unknown widget type: ${widgetType}`);
        return;
    }
    
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    // Build content HTML
    let contentHtml = `
        <div class="dropdown-header">${config.title}</div>
    `;
    
    config.sections.forEach(section => {
        contentHtml += `
            <div class="dropdown-section-title">${section.title}</div>
        `;
        
        section.options.forEach(option => {
            const sectionKey = section.title.toLowerCase().replace(/\s+/g, '-');
            contentHtml += `
                <div class="dropdown-item ${option.default ? 'selected' : ''}" data-section="${sectionKey}" data-value="${option.value}">
                    <span>${option.label}</span>
                    ${option.default ? `<span class="check-icon">${checkIcon}</span>` : ''}
                </div>
            `;
        });
    });
    
    const { dropdown, safeCloseDropdown } = createDropdownBase(button, `${widgetType}-dropdown`, contentHtml);
    document.body.appendChild(dropdown);
    
    // Track selections
    const selections = {};
    
    // Initialize with defaults
    config.sections.forEach(section => {
        const sectionKey = section.title.toLowerCase().replace(/\s+/g, '-');
        const defaultOption = section.options.find(opt => opt.default);
        if (defaultOption) {
            selections[sectionKey] = defaultOption.value;
        }
    });
    
    // Handle item selection (single click handler)
    dropdown.addEventListener('click', (e) => {
        // Stop all event propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        const section = item.dataset.section;
        const value = item.dataset.value;
        
        if (section && value) {
            selections[section] = value;
            
            // Update check icons for this section
            const sectionItems = dropdown.querySelectorAll(`[data-section="${section}"]`);
            sectionItems.forEach(sectionItem => {
                const existingCheck = sectionItem.querySelector('.check-icon');
                if (existingCheck) existingCheck.remove();
                sectionItem.classList.remove('selected');
            });
            
            // Add check to selected item
            const checkIcon = document.createElement('span');
            checkIcon.className = 'check-icon';
            checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            item.appendChild(checkIcon);
            item.classList.add('selected');
        }
    });
    
    // Prevent event bubbling on mouse events
    dropdown.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    dropdown.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    
    // Add done button
    const doneButton = document.createElement('div');
    doneButton.className = 'dropdown-done-button';
    doneButton.textContent = 'Apply';
    dropdown.appendChild(doneButton);
    
    doneButton.addEventListener('click', (e) => {
        // Stop all event propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const result = config.buildResult(selections);
        insertDropdownResult(textarea, result);
        safeCloseDropdown();
        textarea.focus();
        exitEditModeWithRender();
    });
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            safeCloseDropdown();
            document.removeEventListener('mousedown', closeDropdown);
        }
    };
    
    // Use setTimeout to avoid immediate closing when the dropdown is first opened
    setTimeout(() => {
        document.addEventListener('mousedown', closeDropdown);
    }, 0);
}

// Individual widget dropdown functions (now using centralized system)
function createFinanceDropdown(button, textarea, wrapper) {
    createCentralizedDropdown(button, textarea, wrapper, 'finance');
}

function createMoodDropdown(button, textarea, wrapper) {
    createCentralizedDropdown(button, textarea, wrapper, 'mood');
}

function createBooksDropdown(button, textarea, wrapper) {
    createCentralizedDropdown(button, textarea, wrapper, 'books');
}

function createMoviesDropdown(button, textarea, wrapper) {
    createCentralizedDropdown(button, textarea, wrapper, 'movies');
}

function createFuturelogDropdown(button, textarea, wrapper) {
    createCentralizedDropdown(button, textarea, wrapper, 'futurelog');
}

// Custom date dropdown
function createCustomDateDropdown(button, textarea, wrapper) {
    const content = `
        <div class="dropdown-header">Insert Date/Time</div>
        <div class="dropdown-item" data-value="today">Today</div>
        <div class="dropdown-item" data-value="tomorrow">Tomorrow</div>
        <div class="dropdown-item" data-value="now">Current Date/Time</div>
        <div class="dropdown-item" data-value="custom">Custom Date...</div>
    `;
    
    const { dropdown, safeCloseDropdown } = createDropdownBase(button, 'date-dropdown', content);
    document.body.appendChild(dropdown);
    
    // Handle date selection (single click handler)
    dropdown.addEventListener('click', (e) => {
        // Stop all event propagation
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        const value = item.dataset.value;
        let dateString = '';
        
        if (value === 'today') {
            dateString = dateFns.format(new Date(), 'yyyy-MM-dd');
        } else if (value === 'tomorrow') {
            dateString = dateFns.format(dateFns.addDays(new Date(), 1), 'yyyy-MM-dd');
        } else if (value === 'now') {
            dateString = dateFns.format(new Date(), 'yyyy-MM-dd HH:mm');
        } else if (value === 'custom') {
            dateString = 'YYYY-MM-DD';
        }
        
        insertDropdownResult(textarea, dateString);
        safeCloseDropdown();
        textarea.focus();
    });
    
    // Prevent event bubbling on mouse events
    dropdown.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    dropdown.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
    });
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            safeCloseDropdown();
            document.removeEventListener('mousedown', closeDropdown);
        }
    };
    
    // Use setTimeout to avoid immediate closing when the dropdown is first opened
    setTimeout(() => {
        document.addEventListener('mousedown', closeDropdown);
    }, 0);
}

// Utility functions
function insertDropdownResult(textarea, text) {
    const originalValue = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const newContent = 
        originalValue.substring(0, start) + 
        text + 
        originalValue.substring(end);
    
    textarea.value = newContent;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    
    // Update storage
    let key = appState.activeEditorKey;
    if (!key && EditModeManager.currentEditWrapper) {
        key = EditModeManager.currentEditWrapper.dataset.key;
    }
    if (!key && appState.currentView && !['weekly', 'monthly', 'tasks', 'mood'].includes(appState.currentView)) {
        key = `page-${appState.currentView}`;
    }
    
    if (key) {
        setStorage(key, newContent);
        debouncedSyncWithCloud();
    }
}

function exitEditModeWithRender() {
    if (EditModeManager.currentEditWrapper) {
        const wrapper = EditModeManager.currentEditWrapper;
        setTimeout(() => {
            try {
                EditModeManager.exit(wrapper);
                renderApp();
            } catch (e) {
                console.error('Error rendering after widget insertion:', e);
            }
        }, 50);
    }
}

// Make functions globally available
window.createFinanceDropdown = createFinanceDropdown;
window.createMoodDropdown = createMoodDropdown;
window.createBooksDropdown = createBooksDropdown;
window.createMoviesDropdown = createMoviesDropdown;
window.createFuturelogDropdown = createFuturelogDropdown;
window.createCustomDateDropdown = createCustomDateDropdown;
window.createCentralizedDropdown = createCentralizedDropdown;
