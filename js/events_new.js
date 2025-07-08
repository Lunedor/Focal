// --- EVENTS MODULE - REFACTORED ---
// This file now serves as the main coordinator for all event handling

// Initialize all event systems when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all event handling systems
    initializeEventHandlers();      // Mobile sidebar, gestures, general events
    initializeNavigation();         // All navigation handlers
    initializeCheckboxHandlers();   // Checkbox management
    
    console.log('All event systems initialized');
});
