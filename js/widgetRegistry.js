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
    if (window.MainWidget) {
      let command = placeholder.dataset.command || '';
      let transactions = placeholder.dataset.transactions || '';
      // Split into config line and transaction lines
      let lines = (command + (transactions ? '\n' + transactions : '')).split('\n');
      let configLine = lines[0] || '';
      let dataStr = lines.slice(1).join('\n');
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;
        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
        if (currentPageKey.startsWith('page-')) {
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              const html = parseMarkdown(currentContent);
              renderedContent.innerHTML = html;
              const futurelogPlaceholders = renderedContent.querySelectorAll('.futurelog-placeholder');
              futurelogPlaceholders.forEach(el => {
                let itemsAttr = el.getAttribute('data-items');
                if (itemsAttr && itemsAttr.includes('&quot;')) {
                  itemsAttr = itemsAttr.replace(/&quot;/g, '"');
                  el.setAttribute('data-items', itemsAttr);
                }
                console.log('[FUTURELOG PATCH] Restored data-items:', el.getAttribute('data-items'));
              });
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      // Multi-widget rendering logic
      const layout = (() => {
        const lines = command.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const firstLine = lines[0];
          const parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
          return (parts[0] || 'summary').toLowerCase();
        }
        return 'summary';
      })();
      // Clear container
      placeholder.innerHTML = '';
      // Render requested widgets
      if (layout.includes('summary')) {
        const summaryDiv = document.createElement('div');
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        window.MainWidget.renderSummary(summaryDiv, 'finance', configLine, dataStr, onCommandChange, currentPageKey);
        placeholder.appendChild(summaryDiv);
      }
      if (layout.includes('chart')) {
        const chartDiv = document.createElement('div');
        window.MainWidget.renderChart(chartDiv, 'finance', configLine, dataStr, onCommandChange);
        placeholder.appendChild(chartDiv);
      }
      if (layout.includes('chartpie')) {
        const pieDiv = document.createElement('div');
        window.MainWidget.renderPie(pieDiv, 'finance', configLine, dataStr, onCommandChange);
        placeholder.appendChild(pieDiv);
      }
    }
  },

  'calorie': (placeholder) => {
    if (window.MainWidget) {
      let command = placeholder.dataset.command || '';
      let transactions = placeholder.dataset.transactions || '';
      let lines = (command + (transactions ? '\n' + transactions : '')).split('\n');
      let configLine = lines[0] || '';
      let dataStr = lines.slice(1).join('\n');
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;
        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
        if (currentPageKey.startsWith('page-')) {
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              const html = parseMarkdown(currentContent);
              renderedContent.innerHTML = html;
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      const layout = (() => {
        const lines = command.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const firstLine = lines[0];
          const parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
          return (parts[0] || 'summary').toLowerCase();
        }
        return 'summary';
      })();
      placeholder.innerHTML = '';
      if (layout.includes('summary')) {
        const summaryDiv = document.createElement('div');
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        window.MainWidget.renderSummary(summaryDiv, 'calorie', configLine, dataStr, onCommandChange, currentPageKey);
        placeholder.appendChild(summaryDiv);
      }
      if (layout.includes('chart')) {
        const chartDiv = document.createElement('div');
        window.MainWidget.renderChart(chartDiv, 'calorie', configLine, dataStr, onCommandChange);
        placeholder.appendChild(chartDiv);
      }
      if (layout.includes('chartpie')) {
        const pieDiv = document.createElement('div');
        window.MainWidget.renderPie(pieDiv, 'calorie', configLine, dataStr, onCommandChange);
        placeholder.appendChild(pieDiv);
      }
    }
  },

  'workouts': (placeholder) => {
    if (window.MainWidget) {
      let command = placeholder.dataset.command || '';
      let transactions = placeholder.dataset.transactions || '';
      let lines = (command + (transactions ? '\n' + transactions : '')).split('\n');
      let configLine = lines[0] || '';
      let dataStr = lines.slice(1).join('\n');
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;
        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
        if (currentPageKey.startsWith('page-')) {
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              const html = parseMarkdown(currentContent);
              renderedContent.innerHTML = html;
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      const layout = (() => {
        const lines = command.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const firstLine = lines[0];
          const parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
          return (parts[0] || 'summary').toLowerCase();
        }
        return 'summary';
      })();
      placeholder.innerHTML = '';
      if (layout.includes('summary')) {
        const summaryDiv = document.createElement('div');
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        window.MainWidget.renderSummary(summaryDiv, 'workouts', configLine, dataStr, onCommandChange, currentPageKey);
        placeholder.appendChild(summaryDiv);
      }
      if (layout.includes('chart')) {
        const chartDiv = document.createElement('div');
        window.MainWidget.renderChart(chartDiv, 'workouts', configLine, dataStr, onCommandChange);
        placeholder.appendChild(chartDiv);
      }
      if (layout.includes('chartpie')) {
        const pieDiv = document.createElement('div');
        window.MainWidget.renderPie(pieDiv, 'workouts', configLine, dataStr, onCommandChange);
        placeholder.appendChild(pieDiv);
      }
    }
  },

  'sleep': (placeholder) => {
    if (window.MainWidget) {
      let command = placeholder.dataset.command || '';
      let transactions = placeholder.dataset.transactions || '';
      let lines = (command + (transactions ? '\n' + transactions : '')).split('\n');
      let configLine = lines[0] || '';
      let dataStr = lines.slice(1).join('\n');
      const onCommandChange = (newCommand) => {
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        if (!currentPageKey) return;
        const currentContent = getStorage(currentPageKey);
        if (!currentContent) return;
        const oldCommand = placeholder.dataset.command;
        const updatedContent = currentContent.replace(oldCommand, newCommand);
        setStorage(currentPageKey, updatedContent);
        placeholder.dataset.command = newCommand;
        if (typeof debouncedSyncWithCloud === 'function') debouncedSyncWithCloud();
        if (currentPageKey.startsWith('page-')) {
          const contentWrapper = document.querySelector(`[data-key="${currentPageKey}"]`);
          if (contentWrapper) {
            const currentContent = getStorage(currentPageKey);
            const renderedContent = contentWrapper.querySelector('.rendered-content');
            if (renderedContent) {
              const html = parseMarkdown(currentContent);
              renderedContent.innerHTML = html;
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      const layout = (() => {
        const lines = command.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          const firstLine = lines[0];
          const parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
          return (parts[0] || 'summary').toLowerCase();
        }
        return 'summary';
      })();
      placeholder.innerHTML = '';
      if (layout.includes('summary')) {
        const summaryDiv = document.createElement('div');
        const pageWrapper = placeholder.closest('[data-key]');
        const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
        window.MainWidget.renderSummary(summaryDiv, 'sleep', configLine, dataStr, onCommandChange, currentPageKey);
        placeholder.appendChild(summaryDiv);
      }
      if (layout.includes('chart')) {
        const chartDiv = document.createElement('div');
        window.MainWidget.renderChart(chartDiv, 'sleep', configLine, dataStr, onCommandChange);
        placeholder.appendChild(chartDiv);
      }
      if (layout.includes('chartpie')) {
        const pieDiv = document.createElement('div');
        window.MainWidget.renderPie(pieDiv, 'sleep', configLine, dataStr, onCommandChange);
        placeholder.appendChild(pieDiv);
      }
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

   'prompt': (placeholder) => {
        // 1. PREVENT RENDERING IN UNWANTED CONTEXTS
        const inFutureLog = placeholder.closest('.futurelog-widget-container');
        const inMonthlyView = placeholder.closest('.monthly-calendar-day');
        console.log('[PROMPT WIDGET] In FutureLog:', !!inFutureLog, 'In MonthlyView:', !!inMonthlyView);
        if (inFutureLog || inMonthlyView) {
          placeholder.remove();
          return;
        }

        // 2. PARSE DATA FROM PLACEHOLDER
        const text = unescape(placeholder.dataset.text);
        const configStr = placeholder.dataset.config;
        console.log('[PROMPT WIDGET] Config string:', configStr);

        // Parse attributes from the config string (e.g., "prompt, frequent: everyday, start: 2024-01-01")
    const attributes = {};
    if (configStr && configStr.includes(',')) {
      configStr.split(',').slice(1).forEach(part => {
        const [key, value] = part.trim().split(':').map(s => s.trim());
        if (key && value) {
          attributes[key] = value;
        }
      });
    }
    console.log('[PROMPT WIDGET] Parsed attributes:', attributes);

    // 3. GET THE DATE CONTEXT OF THE VIEW
    const dayWrapper = placeholder.closest('[data-date]');
    console.log('[PROMPT WIDGET] dayWrapper:', dayWrapper);
    if (!dayWrapper) {
      // On a regular page, render all prompts as widgets, regardless of attributes
      renderPrompt(placeholder, text);
      return;
    }
    const viewDate = new Date(dayWrapper.dataset.date + 'T00:00:00');
    console.log('[PROMPT WIDGET] viewDate:', viewDate);

    // 4. DECIDE VISIBILITY AND RENDER
    if (checkPromptVisibility(attributes, viewDate)) {
      console.log('[PROMPT WIDGET] Visibility check passed. Rendering prompt.');
      const contentToShow = getPromptContent(attributes, text, viewDate);
      renderPrompt(placeholder, contentToShow);
    } else {
      console.log('[PROMPT WIDGET] Visibility check failed. Removing prompt.');
      placeholder.remove();
    }
  },
};

/** Renders the final HTML for the prompt widget. */
function renderPrompt(placeholder, content) {
  if (!content) {
    placeholder.remove();
    return;
  }
  const finalHtml = parseMarkdown(content);
  const promptWidget = document.createElement('div');
  promptWidget.className = 'prompt-widget';
  promptWidget.innerHTML = `<span class="prompt-icon">❝</span><div class="prompt-content">${finalHtml}</div>`;
  placeholder.replaceWith(promptWidget);
}



/** Checks if a prompt should be visible on a specific date. */
function checkPromptVisibility(attributes, viewDate) {
  if (Object.keys(attributes).length === 0) return true;

  if (attributes['show-on']) {
    const showOnDate = new Date(attributes['show-on'] + 'T00:00:00');
    return dateFns.isSameDay(viewDate, showOnDate);
  }
  console.log('[PROMPT WIDGET] Checking frequent attribute');
  if (attributes['frequent']) {
    const occurrences = window.expandRecurrence({ repeatRule: attributes['frequent'] }, { rangeStart: viewDate, rangeEnd: viewDate });
    console.log('[PROMPT WIDGET] Frequent occurrences:', occurrences);
    return occurrences.length > 0;
  }
  console.log('[PROMPT WIDGET] Checking mode attribute');
  if (attributes['mode']) return true;
  console.log('[PROMPT WIDGET] No attributes matching specific rules');

  return false;
}

/** Gets the correct content for the prompt, especially for list-based modes. */
function getPromptContent(attributes, rawText, viewDate) {
  if (!attributes.mode || !rawText.startsWith('-')) return rawText;
  const items = rawText.split('\n').map(line => line.replace(/^-\s*/, '').trim()).filter(Boolean);
  if (items.length === 0) return '';

  if (attributes.mode === 'daily-sequential') {
    const startDate = new Date((attributes.start || new Date().toISOString().split('T')[0]) + 'T00:00:00');
    const daysDiff = dateFns.differenceInCalendarDays(viewDate, startDate);
    return daysDiff >= 0 ? items[daysDiff % items.length] : '';
  }
  if (attributes.mode === 'daily-random') {
    const dateSeed = viewDate.toISOString().split('T')[0];
    let hash = Array.from(dateSeed).reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
    return items[Math.abs(hash) % items.length];
  }
  return rawText;
}


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
      console.warn(`No widget registered for type: ${widgetType}`);
      placeholder.outerHTML = `<div class="widget-error">Widget type "${widgetType}" not supported.</div>`;
    }
  });
}