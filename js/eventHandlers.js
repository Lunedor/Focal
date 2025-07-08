// --- MOBILE & GESTURE HANDLERS ---

let swipeListenersAttached = false;

// Mobile Sidebar Toggle
function setupMobileSidebar() {
    const hamburger = document.getElementById('hamburger-menu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const settingsModalOverlay = document.getElementById('settings-modal-overlay');
    
    function openSidebar() {
        document.body.classList.add('sidebar-open');
        if (window.feather) feather.replace();
    }
    
    function closeSidebar() {
        document.body.classList.remove('sidebar-open');
        // Hide settings modal if open
        if (settingsModalOverlay) settingsModalOverlay.classList.add('hidden');
    }
    
    if (hamburger) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            openSidebar();
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }
    
    // Close sidebar if clicking outside sidebar (on mobile)
    document.addEventListener('click', (e) => {
        if (
            document.body.classList.contains('sidebar-open') &&
            window.innerWidth <= 768 &&
            sidebar &&
            !sidebar.contains(e.target) &&
            !hamburger.contains(e.target)
        ) {
            closeSidebar();
        }
    });
    
    // Close sidebar on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSidebar();
    });
    
    // Close sidebar if a nav link is clicked (on mobile)
    if (sidebar) {
        sidebar.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && e.target.closest('a,button')) {
                closeSidebar();
            }
        });
    }
}

// Swipe Gesture Helper
function addSwipeListeners(element, onSwipeLeft, onSwipeRight) {
    let touchstartX = 0;
    let touchendX = 0;
    const swipeThreshold = 50; // minimum distance for a swipe in pixels

    element.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, { passive: true });

    element.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        const deltaX = touchendX - touchstartX;
        if (Math.abs(deltaX) < swipeThreshold) return; // not a swipe
        if (touchendX < touchstartX) onSwipeLeft();   // Swiped left
        if (touchendX > touchstartX) onSwipeRight();  // Swiped right
    }, { passive: true });
}

// Setup Gesture Listeners
function setupGestureListeners() {
    if (swipeListenersAttached) return;
    
    // Calendar Swipe Gestures
    const calendarView = document.getElementById('monthly-calendar-view');
    if (calendarView) {
        addSwipeListeners(calendarView,
            () => goToNextMonth(),    // Swipe Left
            () => goToPreviousMonth() // Swipe Right
        );
    }

    // Planner Swipe Gestures
    const plannerGrid = document.getElementById('plan-grid-container');
    if (plannerGrid) {
        addSwipeListeners(plannerGrid,
            () => goToNextDay(),    // Swipe Left
            () => goToPreviousDay() // Swipe Right
        );
    }

    swipeListenersAttached = true;
}

// General Event Handlers
function setupGeneralEventHandlers() {
    // Library search
    if (DOM.librarySearch) {
        DOM.librarySearch.addEventListener('input', renderSidebar);
    }
    
    // Centralized click handler for all editable content
    DOM.contentArea.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') return;
        if (e.target.closest('a, [data-planner-date]')) return;
        const wrapper = e.target.closest('.content-wrapper');
        if (!wrapper || wrapper.querySelector('textarea')) return;
        const key = wrapper.dataset.key;
        if (!key) return;
        const content = getStorage(key);
        EditModeManager.enter(wrapper, key, content);
    });
}

// Initialize all event handlers
function initializeEventHandlers() {
    setupMobileSidebar();
    setupGestureListeners();
    setupGeneralEventHandlers();
}

// Make functions globally available
window.initializeEventHandlers = initializeEventHandlers;
window.setupMobileSidebar = setupMobileSidebar;
window.setupGestureListeners = setupGestureListeners;
window.addSwipeListeners = addSwipeListeners;
