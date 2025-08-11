// Mindmap widget
// Hide any raw JSON block after rendering the widget
function removeMindMapRawTextAfterWidget() {
  // Remove any <pre> or <code> blocks that follow the mindmap widget
  const widget = document.getElementById('persistent-mindmap-widget');
  if (widget && widget.nextSibling && widget.nextSibling.nodeType === 1) {
    const next = widget.nextSibling;
    if (next.tagName === 'PRE' || next.tagName === 'CODE' || next.classList.contains('mindmap-raw-json')) {
      next.remove();
    }
  }
}

const widgetRegistry = {
  'mindmap': (placeholder) => {
    // Helper to prevent event propagation for the widget
    function preventPropagation(el) {
      ['mousedown','mouseup','click','dblclick','keydown'].forEach(evt => {
        el.addEventListener(evt, e => e.stopPropagation());
      });
    }
    // Load jsMind and CSS if not already loaded
    function loadJsMind(callback) {
      if (window.jsMind) { callback(); return; }
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/npm/jsmind@0.8.7/js-legacy/jsmind.min.js';
      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/jsmind@0.8.7/js-legacy/jsmind.draggable-node.js';
        script2.onload = () => {
          const script3 = document.createElement('script');
          script3.src = 'https://cdn.jsdelivr.net/npm/jsmind@0.8.7/js-legacy/jsmind.screenshot.js';
          script3.onload = callback;
          document.head.appendChild(script3);
        };
        document.head.appendChild(script2);
      };
      document.head.appendChild(script1);
      if (!document.getElementById('jsmind-css')) {
        const link = document.createElement('link');
        link.id = 'jsmind-css';
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'https://cdn.jsdelivr.net/npm/jsmind@0.8.7/style/jsmind.min.css';
        document.head.appendChild(link);
      }
    }

    // Use a persistent container and jsMind instance, and delay jsMind init until visible
    let persistentContainer = document.getElementById('persistent-mindmap-widget');
    let persistentMapArea = document.getElementById('persistent-jsmind-container');
    if (!persistentContainer) {
  persistentContainer = document.createElement('div');
  persistentContainer.id = 'persistent-mindmap-widget';
  // Styles moved to layout.css
      // Controls (styled with theme)
  const controls = document.createElement('div');
  controls.id = 'controls';
  // Styles moved to layout.css
      controls.innerHTML = `
        <button id="add_node" class="mindmap-btn" title="Add Node">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button id="remove_node" class="mindmap-btn" title="Remove Node">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button id="zoom_in" class="mindmap-btn" title="Zoom In">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <button id="zoom_out" class="mindmap-btn" title="Zoom Out">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
        </button>
        <select id="theme_select" class="mindmap-select" title="Theme">
          <option value="primary">Primary</option>
          <option value="warning">Warning</option>
          <option value="danger">Danger</option>
          <option value="success">Success</option>
          <option value="info">Info</option>
          <option value="greensea">Greensea</option>
          <option value="nephrite">Nephrite</option>
          <option value="belizehole">Belize Hole</option>
          <option value="wisteria">Wisteria</option>
          <option value="asphalt">Asphalt</option>
          <option value="orange">Orange</option>
          <option value="pumpkin">Pumpkin</option>
          <option value="pomegranate">Pomegranate</option>
          <option value="clouds">Clouds</option>
          <option value="asbestos">Asbestos</option>
        </select>
      `;
      persistentContainer.appendChild(controls);
      // Mind map area
  persistentMapArea = document.createElement('div');
  persistentMapArea.id = 'persistent-jsmind-container';
  // Styles moved to layout.css
  persistentContainer.appendChild(persistentMapArea);
      // Prevent event propagation for the whole widget
      preventPropagation(persistentContainer);
  placeholder.innerHTML = '';
  placeholder.replaceWith(persistentContainer);
    } else {
  placeholder.innerHTML = '';
  placeholder.replaceWith(persistentContainer);
    }

    // Delay jsMind initialization until container is visible and sized
    function initJsMindWhenReady() {
      if (persistentMapArea.offsetWidth === 0 || persistentMapArea.offsetHeight === 0) {
        requestAnimationFrame(initJsMindWhenReady);
  // Remove any raw JSON block after rendering
  setTimeout(removeMindMapRawTextAfterWidget, 0);
        return;
      }
      if (!persistentMapArea._jm) {
        loadJsMind(() => {
          // Load mind map data as before
          const pageWrapper = persistentContainer.closest('[data-key]');
          const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
          let mind = null;
          let mindmapData = '';
          if (currentPageKey && typeof getStorage === 'function') {
            const currentContent = getStorage(currentPageKey);
            const mindmapMatch = currentContent && currentContent.match(/MINDMAP:\s*([\s\S]*?)(?:\n\n|$)/);
            if (mindmapMatch) {
              mindmapData = mindmapMatch[1].trim();
            }
          }
          try {
            mind = JSON.parse(mindmapData);
          } catch { mind = null; }
          if (!mind || !mind.data || !Array.isArray(mind.data.children) || mind.data.children.length === 0) {
            mind = {
              meta: { name: 'jsMind remote', author: 'hizzgdev@163.com', version: '0.2', theme: 'primary' },
              format: 'node_tree',
              data: {
                id: 'root',
                topic: 'Central Topic',
                children: [
                  { id: 'easy', topic: 'Easy to use', direction: 'right', children: [
                    { id: 'easy1', topic: 'Easy to create' },
                    { id: 'easy2', topic: 'Easy to edit' }
                  ] },
                  { id: 'open', topic: 'Open Source', direction: 'right', children: [
                    { id: 'open1', topic: 'on GitHub' }
                  ] },
                  { id: 'powerful', topic: 'Powerful', direction: 'left', children: [
                    { id: 'powerful1', topic: 'Many features' },
                    { id: 'powerful2', topic: 'Customizable' }
                  ] }
                ]
              }
            };
          }
          // Use theme from mind.meta.theme if present, else default to 'primary'
          const themeValue = (mind && mind.meta && mind.meta.theme) ? mind.meta.theme : 'primary';
          const options = {
            container: persistentMapArea.id,
            editable: true,
            theme: themeValue,
            view: 'canvas'
          };
          const jm = new window.jsMind(options);
          jm.show(mind);
          persistentMapArea._jm = jm;
          // Controls logic
          let rootDirectionToggle = true;
          // Theme dropdown
          const themeSelect = persistentContainer.querySelector('#theme_select');
          themeSelect.value = options.theme;
          themeSelect.addEventListener('change', function() {
            jm.set_theme(this.value);
            // Save theme in mind.meta.theme and persist
            if (mind && mind.meta) {
              mind.meta.theme = this.value;
            }
            saveMindMap();
          });

          function saveMindMap() {
            if (!currentPageKey || typeof getStorage !== 'function' || typeof setStorage !== 'function') {
              console.warn('[MindMap] saveMindMap: Missing currentPageKey or storage functions');
              return;
            }
            let currentContent = getStorage(currentPageKey) || '';
            // Always persist the current theme in meta.theme
            let mindData = jm.get_data();
            if (mind && mind.meta && mindData.meta) {
              mindData.meta.theme = mind.meta.theme || options.theme || 'primary';
            }
            const newJson = JSON.stringify(mindData, null, 2);
            const mindmapRegex = /MINDMAP:\s*[\s\S]*?(?:\n\n|$)/;
            const hasBlock = mindmapRegex.test(currentContent);
             if (hasBlock) {
              currentContent = currentContent.replace(mindmapRegex, 'MINDMAP:\n' + newJson + '\n\n');
            } else {
              currentContent += '\n\nMINDMAP:\n' + newJson + '\n\n';
            }
            setStorage(currentPageKey, currentContent);
          }
          persistentContainer.querySelector('#add_node').addEventListener('click', function(){
            var selected_node = jm.get_selected_node();
            if(!selected_node){
                alert('Please select a node first.');
                return;
            }
            var nodeid = jsMind.util.uuid.newid();
            var topic = 'New Node';
            if(selected_node.isroot){
              var direction = rootDirectionToggle ? 'left' : 'right';
              rootDirectionToggle = !rootDirectionToggle;
              jm.add_node(selected_node, nodeid, topic, { direction });
            } else {
              jm.add_node(selected_node, nodeid, topic);
            }
            saveMindMap();
          });
          // Save on all relevant jsMind events and log them for debugging
          jm.add_event_listener(function(type, data) {
            // jsMind event codes: 1=update_node, 2=add_node, 3=remove_node
            if (type === 1 || type === 2 || type === 3) {
              saveMindMap();
            }
          });
          persistentContainer.querySelector('#remove_node').addEventListener('click', function(){
            var selected_node = jm.get_selected_node();
            if(!selected_node){
                alert('Please select a node first.');
                return;
            }
            if(selected_node.isroot){
                 alert('Cannot remove the root node.');
                 return;
            }
            jm.remove_node(selected_node);
            saveMindMap();
          });
          persistentContainer.querySelector('#zoom_in').addEventListener('click', function(){
            jm.view.zoomIn();
          });
          persistentContainer.querySelector('#zoom_out').addEventListener('click', function(){
            jm.view.zoomOut();
          });
      // Update background and color for dark theme support
  // Styles moved to layout.css

      // Add/replace theme style for dark mode
      const styleId = 'mindmap-theme-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
        });
      }
    }
    requestAnimationFrame(initJsMindWhenReady);
  },
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
              });
              initializeWidgetsInContainer(renderedContent);
            }
          }
        }
      };
      
      // Clear container
      placeholder.innerHTML = '';
      // Create a single container div for the widget
      const widgetDiv = document.createElement('div');
      
      // Get the page wrapper for storage key
      const pageWrapper = placeholder.closest('[data-key]');
      const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
      
      // Call the main render method once with the full command
      window.MainWidget.render(widgetDiv, 'finance', configLine, dataStr, onCommandChange, currentPageKey);
      placeholder.appendChild(widgetDiv);
    }
  },

  'calorie': (placeholder) => {
    if (window.MainWidget) {
      let command = placeholder.dataset.command || '';
      let transactions = placeholder.dataset.transactions || '';
      let lines = (command + (transactions ? '\n' + transactions : '')).split('\n');
      let configLine = lines[0] || '';
      let dataStr = lines.slice(1).join('\n');
      const pageWrapper = placeholder.closest('[data-key]');
      const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
      const onCommandChange = (newCommand) => {
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
      
      // Clear container
      placeholder.innerHTML = '';
      // Create a single container div for the widget
      const widgetDiv = document.createElement('div');
      
      // Call the main render method once with the full command
      window.MainWidget.render(widgetDiv, 'calorie', configLine, dataStr, onCommandChange, currentPageKey);
      placeholder.appendChild(widgetDiv);
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
      
      // Clear container
      placeholder.innerHTML = '';
      // Create a single container div for the widget
      const widgetDiv = document.createElement('div');
      
      // Get the page wrapper for storage key
      const pageWrapper = placeholder.closest('[data-key]');
      const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
      
      // Call the main render method once with the full command
      window.MainWidget.render(widgetDiv, 'workouts', configLine, dataStr, onCommandChange, currentPageKey);
      placeholder.appendChild(widgetDiv);
    }
  },

  'sleep': (placeholder) => {
    if (window.MainWidget) {
      let command = placeholder.dataset.command || '';
      let transactions = placeholder.dataset.transactions || '';
      let lines = (command + (transactions ? '\n' + transactions : '')).split('\n');
      let configLine = lines[0] || '';
      let dataStr = lines.slice(1).join('\n');
      const pageWrapper = placeholder.closest('[data-key]');
      const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;
      const onCommandChange = (newCommand) => {
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
      
      // Clear container
      placeholder.innerHTML = '';
      // Create a single container div for the widget
      const widgetDiv = document.createElement('div');
      
      // Call the main render method once with the full command
      window.MainWidget.render(widgetDiv, 'sleep', configLine, dataStr, onCommandChange, currentPageKey);
      placeholder.appendChild(widgetDiv);
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
        if (inFutureLog || inMonthlyView) {
          placeholder.remove();
          return;
        }

        // 2. PARSE DATA FROM PLACEHOLDER
        const text = unescape(placeholder.dataset.text);
        const configStr = placeholder.dataset.config;
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
    // 3. GET THE DATE CONTEXT OF THE VIEW
    const dayWrapper = placeholder.closest('[data-date]');
     if (!dayWrapper) {
      // On a regular page, render all prompts as widgets, regardless of attributes
      renderPrompt(placeholder, text);
      return;
    }
    const viewDate = new Date(dayWrapper.dataset.date + 'T00:00:00');
    // 4. DECIDE VISIBILITY AND RENDER
    if (checkPromptVisibility(attributes, viewDate)) {
      const contentToShow = getPromptContent(attributes, text, viewDate);
      renderPrompt(placeholder, contentToShow);
    } else {
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
  promptWidget.innerHTML = `<span class="prompt-icon">❝</span><div class="prompt-content">${finalHtml}</div><span class=\"prompt-icon\">❞</span>`;
  placeholder.replaceWith(promptWidget);
}



/** Checks if a prompt should be visible on a specific date. */
function checkPromptVisibility(attributes, viewDate) {
  if (Object.keys(attributes).length === 0) return true;

  if (attributes['show-on']) {
    const showOnDate = new Date(attributes['show-on'] + 'T00:00:00');
    return dateFns.isSameDay(viewDate, showOnDate);
  }
  if (attributes['frequent']) {
    const occurrences = window.expandRecurrence({ repeatRule: attributes['frequent'] }, { rangeStart: viewDate, rangeEnd: viewDate });
    return occurrences.length > 0;
  }
  if (attributes['mode']) return true;

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