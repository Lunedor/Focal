// --- NAVIGATION HANDLERS ---

// Calendar Navigation (Monthly)
function setupCalendarNavigation() {
    document.addEventListener('click', handleCalendarNavigation);
}

function handleCalendarNavigation(e) {
    const navTarget = e.target.closest('.calendar-nav a');
    if (!navTarget) return;
    
    e.preventDefault();
    const action = navTarget.dataset.action;
    
    if (action === 'prev-month') goToPreviousMonth();
    if (action === 'next-month') goToNextMonth();
    if (action === 'today-month') goToCurrentMonth();
}

// Planner Navigation (Weekly)
function setupPlannerNavigation() {
    document.addEventListener('click', handlePlannerNavigation);
}

function handlePlannerNavigation(e) {
    const plannerNavTarget = e.target.closest('.planner-nav a[data-action], .planner-nav button[data-action]');
    if (!plannerNavTarget) return;
    
    e.preventDefault();
    const action = plannerNavTarget.dataset.action;
    
    if (action === 'prev-week') {
        goToPreviousWeek();
    } else if (action === 'next-week') {
        goToNextWeek();
    } else if (action === 'today') {
        appState.currentDate = new Date();
        renderWeeklyPlanner(true);
    }
}

// Wiki-links and Scheduled Date Links
function setupLinkNavigation() {
    document.addEventListener('click', handleLinkNavigation);
}

function handleLinkNavigation(e) {
    // Scheduled date links (from (SCHEDULED: ...) or (NOTIFY: ...))
    let scheduledLink = e.target.closest('.scheduled-link') || e.target.closest('[data-planner-date]');
    if (scheduledLink) {
        e.preventDefault();
        let dateStr = scheduledLink.dataset.plannerDate;
        if (!dateStr && scheduledLink.getAttribute('data-planner-date')) {
            dateStr = scheduledLink.getAttribute('data-planner-date');
        }
        if (dateStr) {
            const dateObj = window.parseDateString(dateStr);
            if (dateObj && !isNaN(dateObj)) {
                appState.currentView = 'weekly';
                appState.currentDate = dateObj;
                renderApp();
            }
        }
        return;
    }

    // Wiki-links (from [[Page]])
    let pageLink = e.target.closest('[data-page-link]');
    if (pageLink) {
        e.preventDefault();
        let pageTitle = pageLink.dataset.pageLink;
        if (!pageTitle && pageLink.getAttribute('data-page-link')) {
            pageTitle = pageLink.getAttribute('data-page-link');
        }
        if (pageTitle) {
            appState.currentView = pageTitle;
            renderApp();
        }
        return;
    }

    // Link to a specific planner day (from backlinks)
    const plannerLinkTarget = e.target.closest('[data-planner-key]');
    if (plannerLinkTarget) {
        e.preventDefault();
        const plannerKey = plannerLinkTarget.dataset.plannerKey;
        const match = plannerKey.match(/(\d{4})-W(\d{1,2})-([a-z]+)/i);
        if (match) {
            const [, year, week, day] = match;
            const weekStart = dateFns.startOfWeek(new Date(year, 0, 1 + (week - 1) * 7), { weekStartsOn: 1 });
            const dayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].indexOf(day.toLowerCase());
            if (dayIndex !== -1) {
                const targetDate = dateFns.addDays(weekStart, dayIndex);
                appState.currentView = 'weekly';
                appState.currentDate = targetDate;
                renderApp();
            }
        }
        return;
    }
}

// Sidebar Navigation
function setupSidebarNavigation() {
    DOM.sidebar.addEventListener('click', handleSidebarNavigation);
}

function handleSidebarNavigation(e) {
    const target = e.target.closest('a,button');
    if (!target) return;
    e.preventDefault();
    
    const view = target.dataset.view;
    const action = target.dataset.action;
    const page = target.dataset.page;
    
    if (view) {
        appState.currentView = view;
        renderView();
    } else if (action === 'pin-page' && page) {
        togglePinPage(page);
        renderSidebar();
    } else if (action === 'new-page') {
        handleNewPage();
    } else if (action === 'rename-page' && page) {
        handleRenamePage(page);
    } else if (action === 'delete-page' && page) {
        handleDeletePage(page);
    }
}

// Page management functions
async function handleNewPage() {
    const title = await showModal('Create New Page', 'Enter page title...');
    if (title && title.trim()) {
        const key = `page-${title.trim()}`;
        if (!getStorage(key)) {
            setStorage(key, `\n`);
        }
        appState.currentView = title.trim();
        renderApp();
    }
}

async function handleRenamePage(page) {
    const newTitle = await showModal(`Rename "${page}"`, 'Enter new page title...', page);
    if (newTitle && newTitle.trim() && newTitle.trim() !== page) {
        const oldKey = `page-${page}`;
        const newKey = `page-${newTitle.trim()}`;
        if (!getStorage(newKey)) {
            const content = getStorage(oldKey);
            setStorage(newKey, content);
            deleteStorage(oldKey);
            
            let pins = getPinnedPages();
            const pinIndex = pins.indexOf(page);
            if (pinIndex !== -1) {
                pins[pinIndex] = newTitle.trim();
                setPinnedPages(pins);
            }
            
            if (appState.currentView === page) {
                appState.currentView = newTitle.trim();
            }
            renderApp();
            debouncedSyncWithCloud();
        } else {
            alert("A page with that name already exists.");
        }
    }
}

async function handleDeletePage(page) {
    const confirmed = await showConfirm(`Delete page <strong>"${page}"</strong>? This cannot be undone.`);
    if (confirmed) {
        const key = `page-${page}`;
        deleteStorage(key);
        
        let pins = getPinnedPages();
        if (pins.includes(page)) {
            pins = pins.filter(t => t !== page);
            setPinnedPages(pins);
        }
        
        if (appState.currentView === page) {
            appState.currentView = 'weekly';
        }
        renderApp();
        debouncedSyncWithCloud();
    }
}

// Keyboard navigation
function setupKeyboardNavigation() {
    document.addEventListener('keydown', handleKeyboardNavigation);
}

function handleKeyboardNavigation(e) {
    if (e.target.matches('input, textarea') || DOM.modalOverlay.classList.contains('active')) {
        return;
    }

    const isAlt = e.altKey && !e.ctrlKey && !e.metaKey;

    if (isAlt) {
        switch (e.key.toLowerCase()) {
            case 'w':
                e.preventDefault();
                appState.currentView = 'weekly';
                renderApp();
                break;
            case 'm':
                e.preventDefault();
                appState.currentView = 'monthly';
                renderApp();
                break;
            case 'f':
                e.preventDefault();
                if (DOM.librarySearch) {
                    DOM.librarySearch.focus();
                }
                break;
            case 's':
                e.preventDefault();
                if (DOM.librarySearch) {
                    DOM.librarySearch.focus();
                }
                break;
        }
    }
}

// Initialize all navigation handlers
function initializeNavigation() {
    setupCalendarNavigation();
    setupPlannerNavigation();
    setupLinkNavigation();
    setupSidebarNavigation();
    setupKeyboardNavigation();
}

// Make functions globally available
window.initializeNavigation = initializeNavigation;
window.handleSidebarNavigation = handleSidebarNavigation;
window.handleLinkNavigation = handleLinkNavigation;
