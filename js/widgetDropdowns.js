// --- WIDGET DROPDOWNS ---

// Utility function to create dropdown with safe cleanup
function createDropdownBase(button, className, content, onApply) {
    const dropdown = document.createElement('div');
    dropdown.className = className;
    dropdown.style.cssText = 'position:absolute;z-index:1000;background:var(--color-background);border:1px solid var(--color-border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);padding:0;overflow:hidden;max-width:300px;min-width:240px;';
    
    // Position the dropdown below the button
    const buttonRect = button.getBoundingClientRect();
    dropdown.style.top = (buttonRect.bottom + window.scrollY) + 'px';
    dropdown.style.left = (buttonRect.left + window.scrollX - 40) + 'px';
    
    // Add hover effect with CSS
    const style = document.createElement('style');
    style.textContent = `
        .dropdown-item:hover {
            background-color: var(--color-border);
        }
        .dropdown-item.selected {
            background-color: var(--color-bg-highlight, rgba(0,0,0,0.05));
        }
    `;
    document.head.appendChild(style);
    
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
            if (style.parentNode) {
                document.head.removeChild(style);
            }
            isDropdownClosed = true;
        } catch (e) {
            console.error('Error closing dropdown:', e);
        }
    };
    
    return { dropdown, safeCloseDropdown, style };
}

// Finance dropdown
function createFinanceDropdown(button, textarea, wrapper) {
    const filters = [
        { label: 'All Time', value: 'all' },
        { label: 'This Month', value: 'this-month' },
        { label: 'This Year', value: 'this-year', default: true },
        { label: 'Last 3 Months', value: 'last-3-months' },
        { label: 'Last 6 Months', value: 'last-6-months' },
        { label: 'Last 12 Months', value: 'last-12-months' }
    ];
    
    const layouts = [
        { label: 'All Widgets', value: 'summary+chart+chartpie', default: true },
        { label: 'Summary Only', value: 'summary' },
        { label: 'Bar Chart Only', value: 'chart' },
        { label: 'Pie Chart Only', value: 'chartpie' },
        { label: 'Summary + Bar Chart', value: 'summary+chart' },
        { label: 'Summary + Pie Chart', value: 'summary+chartpie' }
    ];
    
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    const content = `
        <div style="padding:10px 15px;font-weight:600;color:var(--color-text);font-size:1.0em;border-bottom:1px solid var(--color-border);background:var(--color-planner-header-bg, rgba(0,0,0,0.03));">Finance Widget Settings</div>
        <div style="padding:10px 15px;font-weight:600;color:var(--color-sidebar-text);font-size:0.9em;border-bottom:1px solid var(--color-border);">Time Period</div>
        ${filters.map(filter => `
            <div class="dropdown-item ${filter.default ? 'selected' : ''}" data-value="${filter.value}" style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span>${filter.label}</span>
                ${filter.default ? `<span class="check-icon">${checkIcon}</span>` : ''}
            </div>
        `).join('')}
        <div style="padding:10px 15px;font-weight:600;color:var(--color-sidebar-text);font-size:0.9em;border-bottom:1px solid var(--color-border);margin-top:5px;">Layout</div>
        ${layouts.map(layout => `
            <div class="dropdown-item layout-item ${layout.default ? 'selected' : ''}" data-layout="${layout.value}" style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span>${layout.label}</span>
                ${layout.default ? `<span class="check-icon">${checkIcon}</span>` : ''}
            </div>
        `).join('')}
    `;
    
    const { dropdown, safeCloseDropdown } = createDropdownBase(button, 'finance-filter-dropdown', content);
    document.body.appendChild(dropdown);
    
    // Handle item selection
    let selectedFilter = 'this-year';
    let selectedLayout = 'summary+chart+chartpie';
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        e.stopPropagation();
        
        if (item.classList.contains('layout-item')) {
            selectedLayout = item.dataset.layout;
            // Update check icons for layouts
            dropdown.querySelectorAll('.layout-item .check-icon').forEach(el => el.remove());
            const checkIcon = document.createElement('span');
            checkIcon.className = 'check-icon';
            checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            item.appendChild(checkIcon);
            
            dropdown.querySelectorAll('.layout-item').forEach(el => 
                el.classList.toggle('selected', el === item));
        } else if (item.dataset.value) {
            selectedFilter = item.dataset.value;
            // Update check icons for filters
            dropdown.querySelectorAll('.dropdown-item:not(.layout-item) .check-icon').forEach(el => el.remove());
            const checkIcon = document.createElement('span');
            checkIcon.className = 'check-icon';
            checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            item.appendChild(checkIcon);
            
            dropdown.querySelectorAll('.dropdown-item:not(.layout-item)').forEach(el => 
                el.classList.toggle('selected', el === item));
        }
    });
    
    // Add done button at the bottom
    const doneButton = document.createElement('div');
    doneButton.className = 'dropdown-done-button';
    doneButton.textContent = 'Apply';
    doneButton.style.cssText = 'text-align:center;padding:8px;margin-top:8px;font-weight:500;background:var(--income-color,#4CAF50);color:white;cursor:pointer;border-radius:0 0 4px 4px;';
    dropdown.appendChild(doneButton);
    
    doneButton.addEventListener('click', () => {
        const financeString = `FINANCE: ${selectedLayout}, USD, ${selectedFilter}\n- `;
        insertDropdownResult(textarea, financeString);
        safeCloseDropdown();
        textarea.focus();
        exitEditModeWithRender();
    });
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            safeCloseDropdown();
        }
    };
    
    wrapper.addEventListener('mousedown', closeDropdown);
}

// Mood dropdown
function createMoodDropdown(button, textarea, wrapper) {
    const types = [
        { label: 'Calendar View', value: 'calendar', default: true },
        { label: 'Circular View', value: 'circular' },
        { label: 'Chart View', value: 'chart' }
    ];
    
    const styles = [
        { label: 'Color Only', value: 'color', default: true },
        { label: 'Emoji Only', value: 'emoji' },
        { label: 'Color + Emoji', value: 'all' }
    ];
    
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    const content = `
        <div style="padding:10px 15px;font-weight:600;color:var(--color-text);font-size:1.0em;border-bottom:1px solid var(--color-border);background:var(--color-planner-header-bg, rgba(0,0,0,0.03));">Mood Tracker Settings</div>
        <div style="padding:10px 15px;font-weight:600;color:var(--color-sidebar-text);font-size:0.9em;border-bottom:1px solid var(--color-border);">Display Type</div>
        ${types.map(type => `
            <div class="dropdown-item ${type.default ? 'selected' : ''}" data-value="${type.value}" style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span>${type.label}</span>
                ${type.default ? `<span class="check-icon">${checkIcon}</span>` : ''}
            </div>
        `).join('')}
        <div style="padding:10px 15px;font-weight:600;color:var(--color-sidebar-text);font-size:0.9em;border-bottom:1px solid var(--color-border);margin-top:5px;">Style</div>
        ${styles.map(style => `
            <div class="dropdown-item style-item ${style.default ? 'selected' : ''}" data-style="${style.value}" style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span>${style.label}</span>
                ${style.default ? `<span class="check-icon">${checkIcon}</span>` : ''}
            </div>
        `).join('')}
    `;
    
    const { dropdown, safeCloseDropdown } = createDropdownBase(button, 'mood-tracker-dropdown', content);
    wrapper.appendChild(dropdown);
    
    // Handle item selection
    let selectedType = 'calendar';
    let selectedStyle = 'color';
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        e.preventDefault();
        
        if (item.classList.contains('style-item')) {
            selectedStyle = item.dataset.style;
            // Update check icons for styles
            dropdown.querySelectorAll('.style-item .check-icon').forEach(el => el.remove());
            const checkIcon = document.createElement('span');
            checkIcon.className = 'check-icon';
            checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            item.appendChild(checkIcon);
            
            dropdown.querySelectorAll('.style-item').forEach(el => 
                el.classList.toggle('selected', el === item));
        } else if (item.dataset.value) {
            selectedType = item.dataset.value;
            // Update check icons for types
            dropdown.querySelectorAll('.dropdown-item:not(.style-item) .check-icon').forEach(el => el.remove());
            const checkIcon = document.createElement('span');
            checkIcon.className = 'check-icon';
            checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            item.appendChild(checkIcon);
            
            dropdown.querySelectorAll('.dropdown-item:not(.style-item)').forEach(el => 
                el.classList.toggle('selected', el === item));
        }
    });
    
    // Add done button at the bottom
    const doneButton = document.createElement('div');
    doneButton.className = 'dropdown-done-button';
    doneButton.textContent = 'Apply';
    doneButton.style.cssText = 'text-align:center;padding:8px;margin-top:8px;font-weight:500;background:var(--mood-happy,#4CAF50);color:white;cursor:pointer;border-radius:0 0 4px 4px;';
    dropdown.appendChild(doneButton);
    
    doneButton.addEventListener('click', () => {
        const moodString = `MOOD: ${selectedType}, ${selectedStyle}\n`;
        insertDropdownResult(textarea, moodString);
        safeCloseDropdown();
        textarea.focus();
        exitEditModeWithRender();
    });
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            safeCloseDropdown();
        }
    };
    
    wrapper.addEventListener('mousedown', closeDropdown);
}

// Books dropdown
function createBooksDropdown(button, textarea, wrapper) {
    const widgetTypes = [
        { label: 'Full Reading Tracker', value: 'full-tracker', default: true },
        { label: 'Currently Reading', value: 'currently-reading' },
        { label: 'To Read List', value: 'to-read' },
        { label: 'Stats', value: 'stats' },
        { label: 'Bookshelf View', value: 'bookshelf' }
    ];
    
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    const content = `
        <div style="padding:10px 15px;font-weight:600;color:var(--color-text);font-size:1.0em;border-bottom:1px solid var(--color-border);background:var(--color-planner-header-bg, rgba(0,0,0,0.03));">Books Widget Settings</div>
        <div style="padding:10px 15px;font-weight:600;color:var(--color-sidebar-text);font-size:0.9em;border-bottom:1px solid var(--color-border);">Widget Type</div>
        ${widgetTypes.map(type => `
            <div class="dropdown-item ${type.default ? 'selected' : ''}" data-value="${type.value}" style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span>${type.label}</span>
                ${type.default ? `<span class="check-icon">${checkIcon}</span>` : ''}
            </div>
        `).join('')}
    `;
    
    const { dropdown, safeCloseDropdown } = createDropdownBase(button, 'books-dropdown', content);
    wrapper.appendChild(dropdown);
    
    // Handle item selection
    let selectedType = 'full-tracker';
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        e.preventDefault();
        
        if (item.dataset.value) {
            selectedType = item.dataset.value;
            // Update check icons
            dropdown.querySelectorAll('.dropdown-item .check-icon').forEach(el => el.remove());
            const checkIcon = document.createElement('span');
            checkIcon.className = 'check-icon';
            checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            item.appendChild(checkIcon);
            
            dropdown.querySelectorAll('.dropdown-item').forEach(el => 
                el.classList.toggle('selected', el === item));
        }
    });
    
    // Add done button at the bottom
    const doneButton = document.createElement('div');
    doneButton.className = 'dropdown-done-button';
    doneButton.textContent = 'Apply';
    doneButton.style.cssText = 'text-align:center;padding:8px;margin-top:8px;font-weight:500;background:var(--color-success,#4CAF50);color:white;cursor:pointer;border-radius:0 0 4px 4px;';
    dropdown.appendChild(doneButton);
    
    doneButton.addEventListener('click', () => {
        const booksString = `BOOKS: ${selectedType}\n`;
        insertDropdownResult(textarea, booksString);
        safeCloseDropdown();
        textarea.focus();
        exitEditModeWithRender();
    });
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            safeCloseDropdown();
        }
    };
    
    wrapper.addEventListener('mousedown', closeDropdown);
}

// Movies dropdown
function createMoviesDropdown(button, textarea, wrapper) {
    const widgetTypes = [
        { label: 'Full Movie Tracker', value: 'full-tracker', default: true },
        { label: 'Watchlist', value: 'watchlist' },
        { label: 'Watched Movies', value: 'watched' },
        { label: 'Favorites', value: 'favorites' },
        { label: 'Stats', value: 'stats' }
    ];
    
    const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    const content = `
        <div style="padding:10px 15px;font-weight:600;color:var(--color-text);font-size:1.0em;border-bottom:1px solid var(--color-border);background:var(--color-planner-header-bg, rgba(0,0,0,0.03));">Movies Widget Settings</div>
        <div style="padding:10px 15px;font-weight:600;color:var(--color-sidebar-text);font-size:0.9em;border-bottom:1px solid var(--color-border);">Widget Type</div>
        ${widgetTypes.map(type => `
            <div class="dropdown-item ${type.default ? 'selected' : ''}" data-value="${type.value}" style="padding:8px 15px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;">
                <span>${type.label}</span>
                ${type.default ? `<span class="check-icon">${checkIcon}</span>` : ''}
            </div>
        `).join('')}
    `;
    
    const { dropdown, safeCloseDropdown } = createDropdownBase(button, 'movies-dropdown', content);
    wrapper.appendChild(dropdown);
    
    // Handle item selection
    let selectedType = 'full-tracker';
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        e.preventDefault();
        
        if (item.dataset.value) {
            selectedType = item.dataset.value;
            // Update check icons
            dropdown.querySelectorAll('.dropdown-item .check-icon').forEach(el => el.remove());
            const checkIcon = document.createElement('span');
            checkIcon.className = 'check-icon';
            checkIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="float:right;"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            item.appendChild(checkIcon);
            
            dropdown.querySelectorAll('.dropdown-item').forEach(el => 
                el.classList.toggle('selected', el === item));
        }
    });
    
    // Add done button at the bottom
    const doneButton = document.createElement('div');
    doneButton.className = 'dropdown-done-button';
    doneButton.textContent = 'Apply';
    doneButton.style.cssText = 'text-align:center;padding:8px;margin-top:8px;font-weight:500;background:var(--color-success,#4CAF50);color:white;cursor:pointer;border-radius:0 0 4px 4px;';
    dropdown.appendChild(doneButton);
    
    doneButton.addEventListener('click', () => {
        const moviesString = `MOVIES: ${selectedType}\n`;
        insertDropdownResult(textarea, moviesString);
        safeCloseDropdown();
        textarea.focus();
        exitEditModeWithRender();
    });
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            safeCloseDropdown();
        }
    };
    
    wrapper.addEventListener('mousedown', closeDropdown);
}

// Custom date dropdown
function createCustomDateDropdown(button, textarea, wrapper) {
    const content = `
        <div style="padding:10px 15px;font-weight:600;color:var(--color-text);font-size:1.0em;border-bottom:1px solid var(--color-border);background:var(--color-planner-header-bg, rgba(0,0,0,0.03));">Insert Date/Time</div>
        <div class="dropdown-item" data-value="today" style="padding:8px 15px;cursor:pointer;">Today</div>
        <div class="dropdown-item" data-value="tomorrow" style="padding:8px 15px;cursor:pointer;">Tomorrow</div>
        <div class="dropdown-item" data-value="now" style="padding:8px 15px;cursor:pointer;">Current Date/Time</div>
        <div class="dropdown-item" data-value="custom" style="padding:8px 15px;cursor:pointer;">Custom Date...</div>
    `;
    
    const { dropdown, safeCloseDropdown } = createDropdownBase(button, 'date-dropdown', content);
    wrapper.appendChild(dropdown);
    
    dropdown.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        
        e.preventDefault();
        
        const value = item.dataset.value;
        let dateString = '';
        
        if (value === 'today') {
            dateString = dateFns.format(new Date(), 'yyyy-MM-dd');
        } else if (value === 'tomorrow') {
            dateString = dateFns.format(dateFns.addDays(new Date(), 1), 'yyyy-MM-dd');
        } else if (value === 'now') {
            dateString = dateFns.format(new Date(), 'yyyy-MM-dd HH:mm');
        } else if (value === 'custom') {
            // Could add a custom date picker here
            dateString = 'YYYY-MM-DD';
        }
        
        insertDropdownResult(textarea, dateString);
        safeCloseDropdown();
        textarea.focus();
    });
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== button && !button.contains(e.target)) {
            safeCloseDropdown();
        }
    };
    
    wrapper.addEventListener('mousedown', closeDropdown);
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
window.createCustomDateDropdown = createCustomDateDropdown;
