// js/widgetRegistry.js

const widgetRegistry = {
  'mood': (placeholder) => {
    if (typeof moodTracker !== 'undefined' && moodTracker.init) {
      const command = placeholder.dataset.command;
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;

        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;

        // Use the placeholder's current command attribute as the "old" command,
        // as it gets updated with each in-place change.
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
      };
      // Call with a single, standardized options object
      moodTracker.init({ placeholder, command, onCommandChange });
    }
  },
  'finance': (placeholder) => {
    if (typeof financeTracker !== 'undefined' && financeTracker.init) {
      const command = placeholder.dataset.command;
      const transactions = placeholder.dataset.transactions;
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;

        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;

        // Use the placeholder's current command attribute as the "old" command.
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();

        // The finance widget requires a full page re-render when its command
        // (e.g., the filter) changes.
        if (currentPageKey.startsWith('page-')) {
          renderLibraryPage(currentPageKey.substring(5));
        }
      };
      // Call with a single, standardized options object
      financeTracker.init({
        placeholder, command, transactions, onCommandChange
      });
    }
  },
  'goal': (placeholder, options) => {
    const label = placeholder.dataset.label;
    const callCount = options.goalCount;

    const pageWrapper = placeholder.closest('[data-key]');
    if (!pageWrapper) return;
    const key = pageWrapper.dataset.key;
    const content = getStorage(key);

    if (typeof window.analyzeGoalProgress !== 'function') {
      console.error("analyzeGoalProgress function not found. Make sure it's exposed from markdown.js");
      placeholder.outerHTML = `<div class="widget-error">Could not render Goal: analysis function missing.</div>`;
      return;
    }

    const goalAnalysis = window.analyzeGoalProgress(content, label, callCount);

    let goalHtml = '';
    if (!goalAnalysis) {
      goalHtml = `<div class="goal-tracker basic">
        <div class="goal-header">
          <span class="goal-icon">🎯</span>
          <span class="goal-title">${label}</span>
        </div>
      </div>`;
    } else {
      const statusClass = goalAnalysis.status === 'completed' ? 'completed' :
        goalAnalysis.status === 'deadline-passed' ? 'overdue' : 'in-progress';
      const statusIcon = goalAnalysis.status === 'completed' ? '✅' :
        goalAnalysis.status === 'deadline-passed' ? '⚠️' : '🎯';

      if (goalAnalysis.type === 'manual' && goalAnalysis.status === 'completed') {
        goalHtml = `<div class="goal-tracker ${goalAnalysis.type} ${statusClass}">
          <div class="goal-header">
            <span class="goal-icon">${statusIcon}</span>
            <span class="goal-title">${label}</span>
          </div>
          <div class="goal-progress">
            <div class="goal-stats">${goalAnalysis.details}</div>
            <span class="goal-percentage">${goalAnalysis.percentage}%</span>
          </div>
        </div>`;
      } else if (goalAnalysis.type === 'manual') {
        goalHtml = `<div class="goal-tracker ${goalAnalysis.type} ${statusClass}">
          <div class="goal-header">
            <span class="goal-icon">${statusIcon}</span>
            <span class="goal-title">${label}</span>
          </div>
          <div class="goal-progress">
            <div class="goal-stats">${goalAnalysis.details}</div>
            <div class="goal-progress-bar">
              <div style="width: ${Math.min(100, goalAnalysis.percentage)}%;"></div>
            </div>
            <span class="goal-percentage">${goalAnalysis.percentage}%</span>
          </div>
        </div>`;
      } else {
        goalHtml = `<div class="goal-tracker ${goalAnalysis.type} ${statusClass}">
          <div class="goal-header">
            <span class="goal-icon">${statusIcon}</span>
            <span class="goal-title">${label}</span>
          </div>
          <div class="goal-progress">
            <div class="goal-stats">${goalAnalysis.details}</div>
            <div class="goal-progress-bar">
              <div style="width: ${Math.min(100, goalAnalysis.percentage)}%;"></div>
            </div>
            <span class="goal-percentage">${goalAnalysis.percentage}%</span>
          </div>
        </div>`;
      }
    }
    // Replace the placeholder with the fully rendered widget HTML
    placeholder.outerHTML = goalHtml;
  },
   // Register the books widget
  'books': (placeholder) => {
    if (typeof BookTracker !== 'undefined' && BookTracker.init) {
      const config = placeholder.dataset.config;
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;

        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;

        // Use the placeholder's current command attribute as the "old" command
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
        
        // Re-render the page to show updated widget
        if (currentPageKey.startsWith('page-')) {
          renderLibraryPage(currentPageKey.substring(5));
        }
      };
      
      // Call with standardized options object
      BookTracker.init({ 
        placeholder, 
        config, 
        onCommandChange 
      });
    } else {
      placeholder.innerHTML = '<div class="widget-error">BookTracker not loaded</div>';
    }
  },
  // Register the movies widget
  'movies': (placeholder) => {
    if (typeof MovieTracker !== 'undefined' && MovieTracker.init) {
      const config = placeholder.dataset.config;
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;

        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;

        // Use the placeholder's current command attribute as the "old" command
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
        
        // Re-render the page to show updated widget
        if (currentPageKey.startsWith('page-')) {
          renderLibraryPage(currentPageKey.substring(5));
        }
      };
      
      // Call with standardized options object
      MovieTracker.init({ 
        placeholder, 
        config, 
        onCommandChange 
      });
    } else {
      placeholder.innerHTML = '<div class="widget-error">MovieTracker not loaded</div>';
    }
  },
};

function initializeWidgetsInContainer(container) {
  const goalCallCounts = {}; // Counter for goals with the same label on one page
  container.querySelectorAll('.widget-placeholder').forEach(placeholder => {
    const widgetType = placeholder.dataset.widgetType;
    const options = {};

    // Special handling for goals to count occurrences
    if (widgetType === 'goal') {
      const label = placeholder.dataset.label;
      goalCallCounts[label] = (goalCallCounts[label] || 0) + 1;
      options.goalCount = goalCallCounts[label];
    }

    if (widgetRegistry[widgetType]) {
      // A more generic way to pass data from the placeholder to the init function
      const initFn = widgetRegistry[widgetType];
      initFn(placeholder, options);
    }
  });
}