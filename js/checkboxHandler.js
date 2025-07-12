// --- CHECKBOX MANAGEMENT ---

// Handle interactive checkbox clicks globally
function setupCheckboxHandlers() {
    document.addEventListener('click', handleCheckboxClick);
}

function handleCheckboxClick(e) {
    if (e.target.type !== 'checkbox') return;
    
    const dataKey = e.target.getAttribute('data-key');
    const dataLineIndex = e.target.getAttribute('data-line-index');
    
    // Handle scheduled checkboxes (with data-key and data-line-index)
    if (dataKey && dataLineIndex !== null) {
        handleScheduledCheckbox(e.target, dataKey, dataLineIndex);
        return;
    }

    // Handle regular checkboxes (in content wrappers)
    handleRegularCheckbox(e.target);
}

function handleScheduledCheckbox(checkbox, dataKey, dataLineIndex) {
    const scheduledDate = checkbox.getAttribute('data-scheduled-date');
    const scheduledText = checkbox.closest('li,div')?.innerText?.split(' (from ')[0]?.replace(/^[-*]\s*\[[x ]\]\s*/, '').trim();
    const fullText = getStorage(dataKey);
    const lines = fullText.split('\n');
    
    const idx = findScheduledLineIndex(lines, scheduledText, scheduledDate);
    if (idx === -1) {
        console.warn('Could not find scheduled line in content');
        return;
    }
    
    lines[idx] = lines[idx].includes('[ ]')
        ? lines[idx].replace('[ ]', '[x]')
        : lines[idx].replace(/\[x\]/i, '[ ]');
    
    setStorage(dataKey, lines.join('\n'));
    debouncedSyncWithCloud();
    
    if (typeof renderLibraryPage === 'function' && dataKey.startsWith('page-')) {
        renderLibraryPage(dataKey.substring(5));
    } else if (dataKey.match(/^\d{4}-W\d{1,2}-/)) {
        updatePlannerDay(dataKey);
    } else {
        renderApp();
    }
}

function handleRegularCheckbox(checkbox) {
    const wrapper = checkbox.closest('.content-wrapper');
    let key = wrapper?.dataset.key;
    if (!key && checkbox.dataset.key) key = checkbox.dataset.key;
    if (!key) return;
    
    const allCheckboxes = Array.from(wrapper.querySelectorAll('input[type="checkbox"]'));
    const clickedIndex = allCheckboxes.indexOf(checkbox);
    if (clickedIndex === -1) return;
    
    const fullText = getStorage(key);
    const lines = fullText.split('\n');
    let checkboxCounter = -1;
    
    const newLines = lines.map(line => {
        // Check for both list checkboxes AND table checkboxes
        const listCheckboxMatch = line.trim().match(/^[-*]\s*\[[x ]\]/i);
        const tableCheckboxMatch = line.match(/\|[^|]*\[[x ]\][^|]*\|/i);
        
        if (listCheckboxMatch || tableCheckboxMatch) {
            checkboxCounter++;
            if (checkboxCounter === clickedIndex) {
                if (listCheckboxMatch) {
                    // Handle list checkbox
                    return line.includes('[ ]') ? line.replace('[ ]', '[x]') : line.replace(/\[x\]/i, '[ ]');
                } else if (tableCheckboxMatch) {
                    // Handle table checkbox
                    return line.includes('[ ]') ? line.replace('[ ]', '[x]') : line.replace(/\[x\]/i, '[ ]');
                }
            }
        }
        return line;
    });
    
    const newText = newLines.join('\n');
    setStorage(key, newText);
    debouncedSyncWithCloud();
    
    if (typeof renderLibraryPage === 'function' && key.startsWith('page-')) {
        renderLibraryPage(key.substring(5));
    } else if (key.match(/^\d{4}-W\d{1,2}-/)) {
        updatePlannerDay(key);
    } else {
        wrapper.innerHTML = parseMarkdown(newText);
    }
}

function findScheduledLineIndex(lines, text, normalizedDate) {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(text)) {
            // Check if this line has a scheduled date that matches
            const scheduledMatch = line.match(/\(SCHEDULED:\s*([^)]+)\)/);
            if (scheduledMatch) {
                const scheduledText = scheduledMatch[1].trim();
                const scheduledDateObj = window.parseDateString(scheduledText);
                if (scheduledDateObj && !isNaN(scheduledDateObj)) {
                    const scheduledDateStr = dateFns.format(scheduledDateObj, 'yyyy-MM-dd');
                    if (scheduledDateStr === normalizedDate) {
                        return i;
                    }
                }
            }
        }
    }
    return -1;
}
// Update the setupTableCheckboxes function to be independent for table vs list checkboxes
const setupTableCheckboxes = () => {
  // Process table checkboxes
  document.querySelectorAll('td.checkbox-cell input[type="checkbox"], th.checkbox-cell input[type="checkbox"], input.table-checkbox').forEach(checkbox => {
    if (!checkbox.dataset.initialized) {
      // Remove any existing event listeners first
      const oldCheckbox = checkbox.cloneNode(true);
      checkbox.parentNode.replaceChild(oldCheckbox, checkbox);
      checkbox = oldCheckbox;

      checkbox.addEventListener('change', (e) => {
        // Stop event propagation to prevent interaction with list checkboxes
        e.stopPropagation();

        // Get the current page content
        const contentWrapper = e.target.closest('.content-wrapper');
        if (!contentWrapper) return;

        const key = contentWrapper.dataset.key;
        if (!key) return;

        // Signal that content has been modified
        if (typeof window.markLocalDataAsModified === 'function') {
          window.markLocalDataAsModified();
        }

        // Optional: trigger sync to cloud
        if (typeof debouncedSyncWithCloud === 'function') {
          debouncedSyncWithCloud();
        }
      });
      checkbox.dataset.initialized = 'true';
    }
  });

  // Process list checkboxes separately
  document.querySelectorAll('li.task-list-item input[type="checkbox"], input.list-checkbox').forEach(checkbox => {
    if (!checkbox.dataset.initialized) {
      // Remove any existing event listeners first
      const oldCheckbox = checkbox.cloneNode(true);
      checkbox.parentNode.replaceChild(oldCheckbox, checkbox);
      checkbox = oldCheckbox;

      checkbox.addEventListener('change', (e) => {
        // Stop event propagation
        e.stopPropagation();

        const contentWrapper = e.target.closest('.content-wrapper');
        if (!contentWrapper) return;

        const key = contentWrapper.dataset.key;
        if (!key) return;

        if (typeof window.markLocalDataAsModified === 'function') {
          window.markLocalDataAsModified();
        }

        if (typeof debouncedSyncWithCloud === 'function') {
          debouncedSyncWithCloud();
        }
      });
      checkbox.dataset.initialized = 'true';
    }
  });
};

// Process table
function processTableCheckboxes() {
  // Find all table checkboxes
  const tableCheckboxes = document.querySelectorAll('td.checkbox-cell input[type="checkbox"], th.checkbox-cell input[type="checkbox"], input.table-checkbox');

  // Clear existing event listeners and reassign them
  tableCheckboxes.forEach(checkbox => {
    // Create a fresh clone without event listeners
    const newCheckbox = checkbox.cloneNode(false);

    // Copy all attributes and state
    newCheckbox.checked = checkbox.checked;

    // Add the event listener directly to the new checkbox
    newCheckbox.addEventListener('change', function (e) {
      e.stopPropagation();
      e.preventDefault();

      // Explicitly toggle the checkbox state
      this.checked = !this.checked;

      // Get the current page content
      const contentWrapper = this.closest('.content-wrapper');
      if (!contentWrapper) return;

      const key = contentWrapper.dataset.key;
      if (!key) return;

      // Signal content modification
      if (typeof window.markLocalDataAsModified === 'function') {
        window.markLocalDataAsModified();
      }

      if (typeof debouncedSyncWithCloud === 'function') {
        debouncedSyncWithCloud();
      }
    });

    // Replace the old checkbox
    if (checkbox.parentNode) {
      checkbox.parentNode.replaceChild(newCheckbox, checkbox);
    }

    // Mark as initialized
    newCheckbox.dataset.initialized = 'true';
  });
}

// Update your document.addEventListener('DOMContentLoaded') function
document.addEventListener('DOMContentLoaded', function () {
  // Function to process code blocks in rendered content
  const enhanceCodeBlocks = () => {
    // Find all code blocks in the rendered content
    document.querySelectorAll('.rendered-content pre code[class^="language-"]').forEach(codeBlock => {
      const pre = codeBlock.parentElement;
      if (!pre.dataset.enhanced) {
        // Extract language from class name
        const language = codeBlock.className.replace('language-', '');

        // Add language tag
        pre.dataset.language = language;

        // Add line numbers class if needed
        const lineCount = (codeBlock.textContent.match(/\n/g) || []).length;
        if (lineCount > 3) {
          pre.classList.add('line-numbers');
        }

        // Add copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.addEventListener('click', function (e) {
          // Prevent event from bubbling up and triggering content editing
          e.stopPropagation();
          e.preventDefault();

          navigator.clipboard.writeText(codeBlock.textContent.trim())
            .then(() => {
              const originalText = copyButton.textContent;
              copyButton.textContent = 'Copied!';
              setTimeout(() => {
                copyButton.textContent = originalText;
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy code: ', err);
            });
        });

        pre.appendChild(copyButton);
        pre.dataset.enhanced = 'true';
      }
    });
  };

  // Call both functions at load
  enhanceCodeBlocks();
  setupTableCheckboxes();

  // Update your MutationObserver to also call setupTableCheckboxes
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        enhanceCodeBlocks();
        setupTableCheckboxes();
      }
    });
  });

  // Start observing the document body for DOM changes
  observer.observe(document.body, { childList: true, subtree: true });
});
// Initialize checkbox handlers
function initializeCheckboxHandlers() {
    setupCheckboxHandlers();
    setupTableCheckboxes();
}

// Make functions globally available
window.initializeCheckboxHandlers = initializeCheckboxHandlers;
window.setupTableCheckboxes = setupTableCheckboxes;
window.handleCheckboxClick = handleCheckboxClick;
