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
          // Instead of re-rendering the entire page, just update the content
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              const html = parseMarkdown(currentContent);
              renderedContent.innerHTML = html;
              // Restore data-items attribute for futurelog widgets
              const futurelogPlaceholders = renderedContent.querySelectorAll('.futurelog-placeholder');
              futurelogPlaceholders.forEach(el => {
                // Try to extract the original JSON from the attribute value
                let itemsAttr = el.getAttribute('data-items');
                if (itemsAttr && itemsAttr.includes('&quot;')) {
                  // Unescape HTML quotes
                  itemsAttr = itemsAttr.replace(/&quot;/g, '"');
                  el.setAttribute('data-items', itemsAttr);
                }
                // Debug log to confirm attribute value
                console.log('[FUTURELOG PATCH] Restored data-items:', el.getAttribute('data-items'));
              });
              // Only initialize widgets in the new content
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      // Call with a single, standardized options object
      financeTracker.init({
        placeholder, command, transactions, onCommandChange
      });
    }
  },
  // In js/widgetRegistry.js

'goal': (placeholder, options) => {
    const label = placeholder.dataset.label;
    const callCount = options.goalCount;

    // THE FIX: Get the new attributes string from the placeholder
    const attributesStr = placeholder.dataset.attributes;
    let attributes = {};
    try {
        // Safely parse the JSON string back into an object
        if (attributesStr) {
            attributes = JSON.parse(attributesStr);
        }
    } catch (e) {
        console.error("Failed to parse goal attributes:", e);
    }

    const pageWrapper = placeholder.closest('[data-key]');
    if (!pageWrapper) return;
    const key = pageWrapper.dataset.key;
    const content = getStorage(key);

    if (typeof window.analyzeGoalProgress !== 'function') {
      console.error("analyzeGoalProgress function not found.");
      placeholder.outerHTML = `<div class="widget-error">Could not render Goal: analysis function missing.</div>`;
      return;
    }

    // THE FIX: Pass the parsed attributes object to the analysis function
    const goalAnalysis = window.analyzeGoalProgress(content, label, attributes, callCount);

    let goalHtml = '';
    if (!goalAnalysis) {
        // This part now correctly displays the clean title
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
        
        // This part now correctly displays the clean title for all goal types
        // Your existing rendering logic for different goal types remains the same
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
          // Instead of re-rendering the entire page, just update the content
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              renderedContent.innerHTML = parseMarkdown(currentContent);
              // Only initialize widgets in the new content
              initializeWidgetsInContainer(renderedContent);
            }
          }
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
          // Instead of re-rendering the entire page, just update the content
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              renderedContent.innerHTML = parseMarkdown(currentContent);
              // Only initialize widgets in the new content
              initializeWidgetsInContainer(renderedContent);
            }
          }
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
  // Register the futurelog widget

  'futurelog': (placeholder) => {
    if (typeof futurelogWidget !== 'undefined' && futurelogWidget.init) {
      const options = placeholder.dataset.options;
      // Always get items from attribute, not dataset, to preserve quotes
      let items = placeholder.getAttribute('data-items');
      const command = placeholder.dataset.command;
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
          // Instead of re-rendering the entire page, just update the content
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              renderedContent.innerHTML = parseMarkdown(currentContent);
              // Only initialize widgets in the new content
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      
      // Call with standardized options object
      futurelogWidget.init({ 
        placeholder, 
        options, 
        items, 
        command,
        onCommandChange 
      });
    } else {
      placeholder.innerHTML = '<div class="widget-error">FutureLog widget not loaded</div>';
    }
  },
  // Register the habits widget
  'habits': (placeholder) => {
    if (typeof HabitTracker !== 'undefined' && HabitTracker.init) {
      const config = placeholder.dataset.config || 'today';
      
      
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;

        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;

        // Use the placeholder's current config attribute as the "old" command
        const oldCommand = `HABITS: ${placeholder.dataset.config}`;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.config = newCommand.replace('HABITS:', '').trim();
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
        
        // Re-render the page to show updated widget
        if (currentPageKey.startsWith('page-')) {
          // Instead of re-rendering the entire page, just update the content
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              renderedContent.innerHTML = parseMarkdown(currentContent);
              // Only initialize widgets in the new content
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      
      // Always call the habit tracker init - let it handle re-initialization logic
      HabitTracker.init({ 
        placeholder, 
        command: `HABITS: ${config}`,
        onCommandChange 
      });
    } else {
      
      placeholder.innerHTML = '<div class="widget-error">HabitTracker not loaded</div>';
    }
  },
};

function initializeWidgetsInContainer(container) {
  
  
  const goalCallCounts = {}; // Counter for goals with the same label on one page
  const placeholders = container.querySelectorAll('.widget-placeholder:not(.widget-initialized)');
  
  
  
  // Track processed placeholders by their unique combination of type and command
  const processedPlaceholders = new Set();
  
  placeholders.forEach((placeholder, index) => {
    
    
    
    const widgetType = placeholder.dataset.widgetType;
    let command = '';
    
    // Different widgets store their command data differently
    if (widgetType === 'habits') {
      command = placeholder.dataset.config || 'today';
      
    } else {
      command = placeholder.dataset.command || '';
      
    }
    
    // Create a unique key for this placeholder
    const placeholderKey = `${widgetType}-${command}-${placeholder.outerHTML}`;
    
    // Skip if we've already processed an identical placeholder
    if (processedPlaceholders.has(placeholderKey)) {
      
      placeholder.remove(); // Remove the duplicate
      return;
    }
    
    processedPlaceholders.add(placeholderKey);
    
    const options = {};

    // Special handling for goals to count occurrences
    if (widgetType === 'goal') {
      const label = placeholder.dataset.label;
      goalCallCounts[label] = (goalCallCounts[label] || 0) + 1;
      options.goalCount = goalCallCounts[label];
    }

    if (widgetRegistry[widgetType]) {
      
      
      // For habits widgets, don't mark as initialized here - let the widget handle it
      if (widgetType !== 'habits') {
        // Mark this placeholder as initialized before calling the widget
        placeholder.classList.add('widget-initialized');
      }
      
      // A more generic way to pass data from the placeholder to the init function
      const initFn = widgetRegistry[widgetType];
      initFn(placeholder, options);
    } else {
      
    }
  });
}