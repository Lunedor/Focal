// --- MARKDOWN CONFIGURATION ---
const wikiLinkExtension = {
  name: 'wikiLink',
  level: 'inline',
  start(src) { return src.match(/\[\[/)?.index; },
  tokenizer(src, tokens) {
    const rule = /^\[\[([^\]]+)\]\]/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: 'wikiLink',
        raw: match[0],
        text: match[1].trim(),
        tokens: []
      };
    }
  },
  renderer(token) {
    return `<a href="#" data-page-link="${token.text}">${token.text}</a>`;
  }
};

// First, let's modify the tableCheckboxExtension to generate truly unique IDs
const tableCheckboxExtension = {
  name: 'tableCheckbox',
  level: 'inline',
  start(src) { return src.match(/(\[ \]|\[x\]|(?:[-*]\s+)?\[ ?\]|(?:[-*]\s+)?\[x\])/i)?.index; },
  tokenizer(src, tokens) {
    // Match both standalone checkbox syntax and your preferred syntax with dash/asterisk
    const rule = /^(?:([-*]\s+)?\[([ xX])\])/;
    const match = rule.exec(src);
    
    if (match) {
      // Check if we're inside a table cell by examining the tokens stack
      const inTableCell = tokens.some(token => 
        token.type === 'table_cell_start' || 
        token.type === 'th_open' || 
        token.type === 'td_open' ||
        token.type === 'tablecell'
      );
      
      // Only process if inside a table cell
      if (inTableCell) {
        return {
          type: 'tableCheckbox',
          raw: match[0],
          checked: match[2].toLowerCase() === 'x',
          prefix: match[1] || '' // Capture the dash/asterisk prefix if present
        };
      }
    }
    return false;
  },
  renderer(token) {
    // Generate a unique ID for the checkbox with table- prefix
    const id = 'table-checkbox-' + Math.random().toString(36).substring(2, 15);
    // Preserve the prefix in the rendered output if it exists
    return `${token.prefix || ''}<input type="checkbox" id="${id}" class="table-checkbox" ${token.checked ? 'checked' : ''}>`;
  }
};

const goalExtension = {
    name: 'goal',
    level: 'block',
    start(src) { return src.match(/^GOAL:/)?.index; },
    tokenizer(src, tokens) {
        const rule = /^GOAL:\s*(.*)(?:\n|$)/;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'goal',
                raw: match[0],
                label: match[1].trim()
            };
        }
    },
    renderer(token) {
        return `<div class="widget-placeholder goal-placeholder" data-widget-type="goal" data-label="${token.label}"></div>`;
    }
};

const financeExtension = {
    name: 'finance',
    level: 'block',
    start(src) { return src.match(/^FINANCE:/i)?.index; },
    tokenizer(src, tokens) {
        // This regex looks for FINANCE: blocks which may have multiple FINANCE: lines
        // followed by transaction lines that start with "-"
        const rule = /^(FINANCE:[^\n]*(?:\n+FINANCE:[^\n]*)*)\n?((?:[\s]*-[^\n]*\n?)*)/i;
        const match = rule.exec(src);
        if (match) {
            // Get the command part (could be multiple lines starting with FINANCE:)
            const commandPart = match[1].trim();
            // Get the transaction lines (lines starting with "-")
            const transactionPart = match[2].trim();
            
            return {
                type: 'finance',
                raw: match[0],
                command: commandPart,
                transactions: transactionPart,
            };
        }
    },
    renderer(token) {
        // For multi-widget commands, include the entire block in the command attribute
        // If there are multiple FINANCE: lines, we want to keep them all together
        let fullCommand = token.command;
        if (token.command.toLowerCase().startsWith('finance:') && 
            token.transactions && 
            token.transactions.split('\n').some(line => line.trim().toLowerCase().startsWith('finance:'))) {
            // This is a multi-widget case - put everything in the command
            fullCommand = `${token.command}\n${token.transactions}`;
            // And clear the transactions since they're now part of the command
            token.transactions = '';
        }
        
        // Use single quotes for data attributes to handle potential double quotes in content
        return `<div class="widget-placeholder finance-widget-placeholder" data-widget-type="finance" data-command='${fullCommand}' data-transactions='${token.transactions}'></div>`;
    }
};

const moodTrackerExtension = {
    name: 'moodTracker',
    level: 'block',
    start(src) { return src.match(/^MOOD:/)?.index; },
    tokenizer(src, tokens) {
        const rule = /^MOOD:.*(?:\n|$)/;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'moodTracker',
                raw: match[0],
                text: match[0].trim()
            };
        }
    },
    renderer(token) {
        return `<div class="widget-placeholder mood-tracker-placeholder" data-widget-type="mood" data-command='${token.text}'></div>`;
    }
};

// Make sure the booksExtension is working correctly by updating it:
const booksExtension = {
    name: 'books',
    level: 'block',
    start(src) { 
        const match = src.match(/^BOOKS:/i);
        return match?.index; 
    },
    tokenizer(src, tokens) {
        const rule = /^BOOKS:\s*(.*)(?:\n|$)/i;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'books',
                raw: match[0],
                config: match[1].trim()
            };
        }
        return false;
    },
    renderer(token) {
        return `<div class="widget-placeholder books-widget-placeholder" data-widget-type="books" data-config='${token.config}'></div>`;
    }
};

// Movies extension
const moviesExtension = {
    name: 'movies',
    level: 'block',
    start(src) { 
        const match = src.match(/^MOVIES:/i);
        return match?.index; 
    },
    tokenizer(src, tokens) {
        const rule = /^MOVIES:\s*(.*)(?:\n|$)/i;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'movies',
                raw: match[0],
                config: match[1].trim()
            };
        }
        return false;
    },
    renderer(token) {
        return `<div class="widget-placeholder movies-widget-placeholder" data-widget-type="movies" data-config='${token.config}'></div>`;
    }
};

const taskSummaryExtension = {
    name: 'taskSummary',
    level: 'block',
    start(src) { return src.match(/^TASKS:/)?.index; },
    tokenizer(src, tokens) {
        const rule = /^TASKS:\s*(.*)(?:\n|$)/;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'taskSummary',
                raw: match[0],
                label: match[1].trim() || 'Tasks'
            };
        }
    },
    renderer(token) {
        return `<div class="widget-placeholder task-summary-placeholder" data-widget-type="task" data-label="${token.label}"></div>`;
    }
};

const futurelogExtension = {
    name: 'futurelog',
    level: 'block',
    start(src) { return src.match(/^FUTURELOG:/)?.index; },
    tokenizer(src, tokens) {
        console.log('[FUTURELOG Extension] Tokenizing source:', src.substring(0, 200) + '...');
        
        const lines = src.split('\n');
        const firstLine = lines[0];
        const futurelogMatch = /^FUTURELOG:\s*(.*)/.exec(firstLine);
        
        if (!futurelogMatch) return false;
        
        console.log('[FUTURELOG Extension] Found FUTURELOG line:', firstLine);
        console.log('[FUTURELOG Extension] Total lines to process:', lines.length);
        
        let currentLineIndex = 1;
        const items = [];
        let hasFoundContent = false;
        
        // Collect all lines until we hit a meaningful delimiter
        while (currentLineIndex < lines.length) {
            const line = lines[currentLineIndex].trim();
            console.log(`[FUTURELOG Extension] Processing line ${currentLineIndex}: "${line}"`);
            
            // Skip initial blank lines, but stop at blank line after we've found content
            if (!line) {
                if (hasFoundContent) {
                    console.log(`[FUTURELOG Extension] Stopping at blank line ${currentLineIndex} after finding content`);
                    break;
                } else {
                    console.log(`[FUTURELOG Extension] Skipping initial blank line ${currentLineIndex}`);
                    currentLineIndex++;
                    continue;
                }
            }
            
            // Stop at new heading, horizontal rule, or another widget
            if (line.match(/^#{1,6}\s/) || 
                line.match(/^---+$/) ||
                line.match(/^(TASKS|GOAL|FINANCE|MOOD|BOOKS|MOVIES|FUTURELOG):/)) {
                console.log(`[FUTURELOG Extension] Stopping at line ${currentLineIndex}: "${line}"`);
                break;
            }
            
            hasFoundContent = true;
            
            // Look for lines with SCHEDULED dates
            const scheduledMatch = line.match(/\(SCHEDULED:\s*([^)]+)\)/i);
            const repeatMatch = line.match(/\(REPEAT:\s*([^)]+)\)/i);
            
            console.log(`[FUTURELOG Extension] SCHEDULED match for "${line}":`, scheduledMatch);
            console.log(`[FUTURELOG Extension] REPEAT match for "${line}":`, repeatMatch);
            
            if (scheduledMatch || repeatMatch) {
                // Extract the text without the SCHEDULED/REPEAT part
                const itemText = line.replace(/\(SCHEDULED:\s*[^)]+\)/i, '').replace(/\(REPEAT:\s*[^)]+\)/i, '').trim();
                // Remove leading list markers
                const cleanText = itemText.replace(/^[-*+]\s*/, '').replace(/^\[\s*[xX]?\s*\]\s*/, '');
                
                if (scheduledMatch) {
                    console.log('[FUTURELOG Extension] Adding scheduled item:', { text: cleanText, dateStr: scheduledMatch[1].trim() });
                    items.push({
                        text: cleanText,
                        dateStr: scheduledMatch[1].trim(),
                        fullLine: line,
                        type: 'scheduled'
                    });
                }
                
                if (repeatMatch) {
                    console.log('[FUTURELOG Extension] Adding repeat item:', { text: cleanText, repeatRule: repeatMatch[1].trim() });
                    items.push({
                        text: cleanText,
                        repeatRule: repeatMatch[1].trim(),
                        fullLine: line,
                        type: 'repeat'
                    });
                }
            }
            
            currentLineIndex++;
        }
        
        console.log('[FUTURELOG Extension] Final items found:', items);
        
        const consumedLines = currentLineIndex;
        const raw = lines.slice(0, consumedLines).join('\n');
        
        return {
            type: 'futurelog',
            raw: raw,
            options: futurelogMatch[1].trim(),
            items: items
        };
    },
    renderer(token) {
        console.log('[FUTURELOG Extension] Rendering token:', token);
        
        // Clean the items to only include necessary data for the widget
        const cleanItems = token.items.map(item => {
            if (item.type === 'scheduled') {
                return {
                    text: item.text,
                    dateStr: item.dateStr,
                    type: 'scheduled'
                };
            } else if (item.type === 'repeat') {
                return {
                    text: item.text,
                    repeatRule: item.repeatRule,
                    type: 'repeat'
                };
            }
            // Fallback for legacy format
            return {
                text: item.text,
                dateStr: item.dateStr,
                type: 'scheduled'
            };
        });
        
        const optionsStr = JSON.stringify(token.options).replace(/"/g, '&quot;');
        const itemsStr = JSON.stringify(cleanItems).replace(/"/g, '&quot;');
        return `<div class="widget-placeholder futurelog-placeholder" data-widget-type="futurelog" data-options="${optionsStr}" data-items="${itemsStr}"></div>`;
    }
};

// Add this function before the DOMContentLoaded event listener
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
    newCheckbox.addEventListener('change', function(e) {
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
document.addEventListener('DOMContentLoaded', function() {
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
        copyButton.addEventListener('click', function(e) {
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

const renderer = new marked.Renderer();
renderer.listitem = (text, task, checked) => {
    // 1. Get the raw markdown for this list item block.
    let rawText = '';
    if (typeof text === 'string') {
        rawText = text;
    } else if (text && typeof text === 'object') {
        rawText = text.raw || text.text || '';
    }

    // 2. Check if it's a task item using regex on the raw text.
    const taskMatch = rawText.match(/^\s*([-*]|\d+\.)\s+\[([xX ])\]\s/);

    if (taskMatch) {
        // --- IT IS A TASK ITEM ---
        const isChecked = taskMatch[2].trim().toLowerCase() === 'x';
        
        // Get the content AFTER the checkbox. This content can include sub-lists.
        let content = rawText.replace(/^\s*([-*]|\d+\.)\s+\[[xX ]\]\s/, '');
        
        // Separate the first line (for attribute parsing) from potential sub-lists.
        const lines = content.split('\n');
        let itemText = lines[0];
        let subListMarkdown = lines.slice(1).join('\n');

        let liAttributes = '';
        let inputAttributes = '';

        // --- All of your custom attribute logic is preserved exactly as it was ---
        const attrMatch = itemText.match(/\{([^}]+)\}$/);
        if (attrMatch) {
            const attrString = attrMatch[1];
            itemText = itemText.replace(/\{[^}]+\}$/, '').trim();
            if (/key=/.test(attrString)) {
                const attrRegex = /(key|line-index|scheduled-date)=(.+?)(?=\s+(?:key|line-index|scheduled-date)=|$)/g;
                let match;
                while ((match = attrRegex.exec(attrString)) !== null) {
                    const k = match[1];
                    const v = match[2].trim();
                    if (k && v) {
                        inputAttributes += ` data-${k}="${v}"`;
                    }
                }
            }
        }
        const scheduledFromMatch = itemText.match(/^(.*)\s+\(from\s+\[\[([^\]]+)\]\]\)$/);
        if (scheduledFromMatch) {
            const originalTaskContent = scheduledFromMatch[1].trim();
            liAttributes = `data-original-task-content="${originalTaskContent}"`;
        }

        // Parse the parts correctly: first line as inline, the rest as block.
        const parsedItemText = marked.parseInline(itemText);
        const parsedSubList = subListMarkdown ? marked.parse(subListMarkdown) : '';

        // Generate a unique ID for list checkboxes with list- prefix
        const checkboxId = 'list-checkbox-' + Math.random().toString(36).substring(2, 15);

        return `<li class="task-list-item" ${liAttributes}><input type="checkbox" id="${checkboxId}" class="list-checkbox"${inputAttributes}${isChecked ? ' checked' : ''}> ${parsedItemText}${parsedSubList}</li>`;

    } else {
        // --- IT IS A REGULAR LIST ITEM ---
        
        // Get the content AFTER the list marker (e.g., after "- " or "1. ").
        let content = rawText.replace(/^\s*([-*]|\d+\.)\s+/, '');

        // Now, parse the entire remaining content as block-level markdown.
        // `marked.parse()` correctly handles nested lists, blockquotes, code blocks, etc.
        let parsedContent = marked.parse(content);
        
        // Remove <p> tags for list items to prevent unwanted vertical spacing
        const pTagRegex = /^<p>([\s\S]*)<\/p>\n?$/;
        if (pTagRegex.test(parsedContent)) {
             parsedContent = parsedContent.replace(pTagRegex, '$1');
        }
        
        return `<li>${parsedContent}</li>`;
    }
};

marked.use({
    extensions: [wikiLinkExtension, tableCheckboxExtension, taskSummaryExtension, goalExtension, moodTrackerExtension, financeExtension, booksExtension, moviesExtension, futurelogExtension],
    gfm: true,
    breaks: true,
    renderer: renderer
});



// --- All PROGRESS parsing logic must be inside analyzeGoalProgress ---



const parseMarkdown = (text, options = {}) => {
  if (!text) return '';
  
  // Track line indices if provided
  const lines = text.split('\n');
  const lineMap = new Map(); // Maps content to line indices
  
  if (options.trackLineIndices) {
    lines.forEach((line, index) => {
      if (line.trim()) {
        lineMap.set(line.trim(), index);
      }
    });
  }
  
  let html = marked.parse(text, { breaks: true });
  
  // Remove disabled attribute from all checkboxes
  html = html.replace(/(<input[^>]*type="checkbox"[^>]*)\s*disabled[^>]*>/g, '$1>');
  
  // Handle checkbox text in tables that didn't get properly converted
  html = html.replace(/<td>([\s\n]*)(?:-\s+)?\[([ xX])\]([\s\n]*)<\/td>/gi, (match, before, checked, after) => {
    const isChecked = checked.toLowerCase() === 'x';
    const id = 'table-checkbox-' + Math.random().toString(36).substring(2, 15);
    
    // Add line index if tracking is enabled
    let lineIndexAttr = '';
    if (options.trackLineIndices && options.currentLineIndex !== undefined) {
      lineIndexAttr = ` data-line-index="${options.currentLineIndex}"`;
    }
    
    return `<td class="checkbox-cell">${before}<input type="checkbox" id="${id}" class="table-checkbox"${lineIndexAttr} ${isChecked ? 'checked' : ''}>${after}</td>`;
  });
  
  // Also look for basic [] or [x] without dash
  html = html.replace(/<td>([\s\n]*)\[([ xX])\]([\s\n]*)<\/td>/gi, (match, before, checked, after) => {
    const isChecked = checked.toLowerCase() === 'x';
    const id = 'table-checkbox-' + Math.random().toString(36).substring(2, 15);
    
    // Add line index if tracking is enabled
    let lineIndexAttr = '';
    if (options.trackLineIndices && options.currentLineIndex !== undefined) {
      lineIndexAttr = ` data-line-index="${options.currentLineIndex}"`;
    }
    
    return `<td class="checkbox-cell">${before}<input type="checkbox" id="${id}" class="table-checkbox"${lineIndexAttr} ${isChecked ? 'checked' : ''}>${after}</td>`;
  });
  
  // Additional table-specific enhancements for checkboxes in tables (keep these)
  html = html.replace(/<td>(\s*)<input type="checkbox"/g, '<td class="checkbox-cell">$1<input type="checkbox"');
  html = html.replace(/<th>(\s*)<input type="checkbox"/g, '<th class="checkbox-cell">$1<input type="checkbox"');
  
  if (html.includes('[object Object]')) {
    html = html.replace(/\[object Object\]/g, '');
  }
  html = html.replace(/<div class="widget-placeholder task-summary-placeholder" data-widget-type="task" data-label="([^"]*)">/g, (match, label) => {
    const taskStats = calculateTaskStats(text, label);
    const allCompleted = taskStats.total > 0 && taskStats.completed === taskStats.total;
    const taskIcon = allCompleted ? '✅' : '📝';
    return `<div class="task-summary">
      <div class="task-summary-header">
        <span class="task-summary-icon">${taskIcon}</span>
        <span class="task-summary-label">${label}</span>
      </div>
      <span class="task-summary-stats">${taskStats.completed}/${taskStats.total} completed</span>
      <div class="task-progress-bar">
        <div style="width: ${taskStats.percentage}%;"></div>
      </div>
    </div>`;
  });
  // Make (SCHEDULED: ...) clickable using centralized logic
  const scheduledRegex = new RegExp(`\\(SCHEDULED: \\s*${window.DATE_REGEX_PATTERN}\\)`, 'gi');
  html = html.replace(/\((SCHEDULED|NOTIFY): ([^)]+)\)/gi, (match, type, content) => {
    const dateStr = content.trim().split(' ')[0];
    const normalizedDate = window.normalizeDateStringToYyyyMmDd(dateStr);
    let displayMatch = match;
    if (type === 'NOTIFY') {
      // Add a bell icon for visual distinction
      displayMatch = `(🔔 NOTIFY: ${content})`;
    }
    return `<span class="scheduled-link" data-planner-date="${normalizedDate || dateStr}">${displayMatch}</span>`;
  });

  // Helper function to calculate next occurrence of REPEAT items
  function calculateNextRepeatOccurrence(repeatRule) {
    if (!repeatRule || typeof repeatRule !== 'string') return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Handle "every <weekday> from <start> to <end>" syntax
    const rangeMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)/i);
    if (rangeMatch) {
      const weekdayName = rangeMatch[1].toLowerCase();
      const startDateStr = rangeMatch[2];
      const endDateStr = rangeMatch[3];
      
      // Parse start and end dates
      let startDate = parseDate(startDateStr);
      let endDate = parseDate(endDateStr);
      
      if (!startDate || !endDate) return null;
      
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetWeekday = weekdays.indexOf(weekdayName);
      if (targetWeekday === -1) return null;
      
      // Find the first occurrence of the target weekday on or after the start date
      let nextOccurrence = new Date(startDate);
      while (nextOccurrence.getDay() !== targetWeekday) {
        nextOccurrence.setDate(nextOccurrence.getDate() + 1);
      }
      
      // If we're past today, find the next occurrence within the range
      if (nextOccurrence <= today) {
        while (nextOccurrence <= today && nextOccurrence <= endDate) {
          nextOccurrence.setDate(nextOccurrence.getDate() + 7);
        }
      }
      
      // Return the next occurrence if it's within the range
      return (nextOccurrence <= endDate) ? nextOccurrence : null;
    }
    
    // Handle "every <weekday>" syntax (weekly recurring)
    const weekdayMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
    if (weekdayMatch) {
      const weekdayName = weekdayMatch[1].toLowerCase();
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetWeekday = weekdays.indexOf(weekdayName);
      if (targetWeekday === -1) return null;
      
      // Find the next occurrence of this weekday
      let nextOccurrence = new Date(today);
      let daysUntilTarget = (targetWeekday - today.getDay() + 7) % 7;
      if (daysUntilTarget === 0) {
        daysUntilTarget = 7; // If today is the target day, show next week
      }
      nextOccurrence.setDate(today.getDate() + daysUntilTarget);
      
      return nextOccurrence;
    }
    
    // Handle "everyday" syntax (daily recurring)
    if (repeatRule.toLowerCase() === 'everyday') {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return tomorrow;
    }
    
    // Handle annual repeats (birthdays, anniversaries)
    let dateStr = repeatRule.trim();
    let parsedDate = parseDate(dateStr);
    
    // Also handle DD-MM format specifically
    if (!parsedDate) {
      const ddmmMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})$/);
      if (ddmmMatch) {
        const day = parseInt(ddmmMatch[1]);
        const month = parseInt(ddmmMatch[2]) - 1; // JavaScript months are 0-based
        parsedDate = new Date(2000, month, day); // Use any year for reference
      }
    }
    
    if (parsedDate) {
      // Calculate next occurrence of this date
      const thisYear = today.getFullYear();
      const nextYear = thisYear + 1;
      
      // Try this year first
      let thisYearDate = new Date(thisYear, parsedDate.getMonth(), parsedDate.getDate());
      if (thisYearDate > today) {
        return thisYearDate;
      }
      
      // Otherwise next year
      return new Date(nextYear, parsedDate.getMonth(), parsedDate.getDate());
    }
    
    return null;
  }
  
  // Helper function to parse various date formats
  function parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Try DD.MM.YYYY or DD.MM.YY
    let match = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (match) {
      let day = parseInt(match[1]);
      let month = parseInt(match[2]) - 1; // JavaScript months are 0-based
      let year = parseInt(match[3]);
      if (year < 100) year += (year < 50 ? 2000 : 1900);
      return new Date(year, month, day);
    }
    
    // Try DD/MM/YYYY or DD/MM/YY
    match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      let day = parseInt(match[1]);
      let month = parseInt(match[2]) - 1;
      let year = parseInt(match[3]);
      if (year < 100) year += (year < 50 ? 2000 : 1900);
      return new Date(year, month, day);
    }
    
    // Try DD-MM-YYYY or DD-MM-YY
    match = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (match) {
      let day = parseInt(match[1]);
      let month = parseInt(match[2]) - 1;
      let year = parseInt(match[3]);
      if (year < 100) year += (year < 50 ? 2000 : 1900);
      return new Date(year, month, day);
    }
    
    return null;
  }

  // Make (REPEAT: ...) clickable and normalized for recurring events, including new syntax
  // Support: (REPEAT: 03.07.1995), (REPEAT: every monday from 30.06.2025 to 30.06.2026), etc.
  const repeatRegex = /\(REPEAT: ([^)]+)\)/gi;
  html = html.replace(repeatRegex, (match, repeatRule) => {
    let tooltip = '';
    let nextOccurrenceDate = calculateNextRepeatOccurrence(repeatRule);
    let recurringIcon = '🔁';
    
    // Try to parse new syntax: every <weekday> from <start> to <end>
    const rangeMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)/i);
    if (rangeMatch) {
      const weekday = rangeMatch[1];
      const from = rangeMatch[2];
      const to = rangeMatch[3];
      tooltip = `Repeats every ${weekday} from ${from} to ${to}`;
    } else {
      // Check for simple weekday format (e.g., "every monday")
      const weekdayMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
      if (weekdayMatch) {
        const weekday = weekdayMatch[1];
        tooltip = `Repeats every ${weekday}`;
      } else if (repeatRule.toLowerCase() === 'everyday') {
        tooltip = `Repeats every day`;
      } else {
        // Fallback: try to normalize as a date or MM-DD
        let dateStr = repeatRule.trim();
        let norm = window.normalizeDateStringToYyyyMmDd(dateStr);
        if (!norm) {
          const dm = dateStr.match(/^(\d{2})[./-](\d{2})$/);
          if (dm) {
            norm = `${dm[2]}-${dm[1]}`;
          } else {
            norm = dateStr;
          }
        }
        tooltip = `Repeats on ${norm}`;
      }
    }
    
    // Make REPEAT items clickable like SCHEDULED items
    if (nextOccurrenceDate) {
      const formattedDate = dateFns.format(nextOccurrenceDate, 'yyyy-MM-dd');
      return `<span class="repeat-link scheduled-link" data-planner-date="${formattedDate}" title="${tooltip} (next: ${dateFns.format(nextOccurrenceDate, 'MMM d, yyyy')})" style="background:rgba(255, 242, 59, 0.2);border-radius:4px;padding:0 3px;">${recurringIcon} ${match}</span>`;
    } else {
      // Fallback for items without a calculable next occurrence
      return `<span class="repeat-link" title="${tooltip}" style="background:rgba(255, 242, 59, 0.2);border-radius:4px;padding:0 3px;">${recurringIcon} ${match}</span>`;
    }
  });
  return html;
};

const calculateTaskStats = (text, taskLabel) => {
  if (!text) return { completed: 0, total: 0, percentage: 0 };
  const lines = text.split('\n');
  // Find the TASKS: block with the matching label
  let startIdx = -1;
  let endIdx = lines.length;
  const label = (taskLabel || '').trim();
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^TASKS:\s*(.*)/);
    if (match && (match[1].trim() === label || (!label && !match[1].trim()))) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) {
    // If not found, fallback to all checkboxes (legacy behavior)
    let total = 0, completed = 0;
    lines.forEach(line => {
      const taskMatch = line.trim().match(/^[-*]\s*\[([xX ])\]/);
      if (taskMatch) {
        total++;
        if (taskMatch[1].trim().toLowerCase() === 'x') {
          completed++;
        }
      }
    });
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }
  // Find the next TASKS:, GOAL:, heading, horizontal rule, or end of document
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      /^TASKS:/i.test(line) ||
      /^GOAL:/i.test(line) ||
      /^#{1,6}\s/.test(line) || // Markdown heading
      /^---+$/.test(line) // Horizontal rule
    ) {
      endIdx = i;
      break;
    }
  }
  
  // Get the content for this TASKS block
  const relevantLines = lines.slice(startIdx + 1, endIdx);
  const contentForThisTask = relevantLines.join('\n');
  
  // Check if there's a table in the task content
  const hasTable = contentForThisTask.includes('|') && 
                  (contentForThisTask.includes('|-') || 
                   /\|[-\s|:]+\|/.test(contentForThisTask));
  
  let total = 0, completed = 0;
  
  if (hasTable) {
    // Count standard checkboxes and table checkboxes
    const standardCheckboxLines = relevantLines.filter(line => {
      // Must be a markdown checkbox and not in a table
      return /^[-*]\s*\[([xX ])\]/.test(line) && !line.includes('|');
    });
    
    // Extract checkbox states from table cells
    const tableRows = relevantLines.filter(line => 
      line.includes('|') && line.match(/\[([ xX])\]/));
    
    // Count table checkboxes
    let tableCheckboxTotal = 0;
    let tableCheckboxCompleted = 0;
    
    tableRows.forEach(row => {
      const checkboxMatches = [...row.matchAll(/\[([ xX])\]/g)];
      tableCheckboxTotal += checkboxMatches.length;
      tableCheckboxCompleted += checkboxMatches.filter(match => 
        match[1].toLowerCase() === 'x').length;
    });
    
    // Count regular checkboxes
    let standardTotal = standardCheckboxLines.length;
    let standardCompleted = standardCheckboxLines.filter(line => 
      /\[[xX]\]/.test(line)).length;
    
    // Combine counts
    total = standardTotal + tableCheckboxTotal;
    completed = standardCompleted + tableCheckboxCompleted;
  } else {
    // Original logic for non-table checkboxes
    for (let i = startIdx + 1; i < endIdx; i++) {
      const taskMatch = lines[i].trim().match(/^[-*]\s*\[([xX ])\]/);
      if (taskMatch) {
        total++;
        if (taskMatch[1].trim().toLowerCase() === 'x') {
          completed++;
        }
      }
    }
  }
  
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
};

function analyzeGoalProgress(text, goalLabel) {
  if (!text) return null;
  const lines = text.split('\n');
  let analysis = {
    type: 'unknown',
    current: 0,
    target: 0,
    percentage: 0,
    status: 'in-progress',
    details: ''
  };
  
  // Multi-goal fix: use callCount to find the Nth occurrence
  let callCount = 1;
  if (arguments.length > 2 && typeof arguments[2] === 'number') callCount = arguments[2];
  
  let foundCount = 0;
  let goalLineIndex = -1;
  
  // Find the correct goal section
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === `GOAL: ${goalLabel}`) {
      foundCount++;
      if (foundCount === callCount) {
        goalLineIndex = i;
        break;
      }
    }
  }
  
  if (goalLineIndex === -1) return null;
  
  // Find the next GOAL, TASKS, heading, or horizontal rule after this GOAL
  let endIdx = lines.length;
  for (let i = goalLineIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line.startsWith('GOAL:') ||
      line.startsWith('TASKS:') ||
      /^#{1,6}\s/.test(line) || // Markdown heading
      /^---+$/.test(line) // Horizontal rule
    ) {
      endIdx = i;
      break;
    }
  }
  
  const relevantLines = lines.slice(goalLineIndex + 1, endIdx);
  const contentForThisGoal = relevantLines.join('\n');
  
  // --- Fix: Do not extract target number from date in goal label ---
  const dateRegex = new RegExp(window.DATE_REGEX_PATTERN, 'g');
  let dateMatch = dateRegex.exec(goalLabel); // Find the first date match with its index

  let deadline = null;
  let daysLeft = null;
  let deadlineStatus = null;
  let dateInfo = null; // Will store { str, index, length } of the date string

  if (dateMatch) {
    const dateStr = dateMatch[0];
    const parsed = window.parseDateString(dateStr);
    if (parsed && !isNaN(parsed)) {
      deadline = parsed;
      dateInfo = { str: dateStr, index: dateMatch.index, length: dateStr.length };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const totalDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      daysLeft = totalDays;
      if (totalDays < 0) {
        deadlineStatus = { status: 'deadline-passed', details: `${Math.abs(totalDays)} days overdue` };
      } else {
        deadlineStatus = { status: 'in-progress', details: `${totalDays} days remaining` };
      }
    }
  }

  // Find all numbers and their indices to correctly identify the target number
  let numberMatches = [...goalLabel.matchAll(/(\d+)/g)];
  let targetNumber = null;
  if (numberMatches.length > 0) {
    // If there is a date, skip numbers that are part of the date string
    for (const numMatch of numberMatches) {
      if (dateInfo && (numMatch.index >= dateInfo.index && numMatch.index < (dateInfo.index + dateInfo.length))) {
        continue; // It's part of the date, so skip it
      }
      // The first number not part of the date is our target
      targetNumber = parseInt(numMatch[0], 10);
      break;
    }
  }
  
  // --- PROGRESS line integration ---
  // Look for a PROGRESS: ... line in relevantLines
  let progressLine = null;
  let progressPercent = null;
  let progressValue = null;
  let progressCompleted = false;
  for (const line of relevantLines) {
    const percentMatch = line.match(/^PROGRESS:\s*(?:.*)?\[(\d{1,3})%\]/i);
    const valueMatch = line.match(/^PROGRESS:\s*(?:.*)?\[(\d{1,5})\]/i);
    const completedMatch = line.match(/^PROGRESS:\s*COMPLETED(?:\s*|\s*\[.*\])/i);
    if (percentMatch) {
      progressPercent = parseInt(percentMatch[1], 10);
      progressLine = 'percent';
      break;
    } else if (valueMatch) {
      progressValue = parseInt(valueMatch[1], 10);
      progressLine = 'value';
      break;
    } else if (completedMatch) {
      progressCompleted = true;
      progressLine = 'completed';
      break;
    }
  }
  
  // --- Manual Progress Handling ---
  if (progressLine) {
    // Case 1: Manual progress WITH a target number
    if (targetNumber) {
      if (progressLine === 'percent') {
        const current = Math.round(targetNumber * progressPercent / 100);
        analysis = { type: 'manual', current, target: targetNumber, percentage: progressPercent, status: progressPercent >= 100 ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress'), details: `${current}/${targetNumber} completed` + (deadlineStatus ? ` (${deadlineStatus.details})` : '') };
        if (progressPercent >= 100) analysis.status = 'completed';
        return analysis;
      } else if (progressLine === 'value') {
        const percent = Math.round((progressValue / targetNumber) * 100);
        analysis = { type: 'manual', current: progressValue, target: targetNumber, percentage: percent, status: percent >= 100 ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress'), details: `${progressValue}/${targetNumber} completed` + (deadlineStatus ? ` (${deadlineStatus.details})` : '') };
        if (percent >= 100) analysis.status = 'completed';
        return analysis;
      } else if (progressLine === 'completed') {
        analysis = { type: 'manual', current: targetNumber, target: targetNumber, percentage: 100, status: 'completed', details: `${targetNumber}/${targetNumber} completed` + (deadlineStatus ? ` (${deadlineStatus.details})` : '') };
        return analysis;
      }
    } else { // Case 2: Manual progress WITHOUT a target number
      if (progressLine === 'percent') {
        analysis = { type: 'manual', current: progressPercent, target: 100, percentage: progressPercent, status: progressPercent >= 100 ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress'), details: 'Manual progress' + (deadlineStatus ? ` (${deadlineStatus.details})` : '') };
        if (progressPercent >= 100) analysis.status = 'completed';
        return analysis;
      } else if (progressLine === 'completed') {
        analysis = { type: 'manual', current: 1, target: 1, percentage: 100, status: 'completed', details: 'Goal completed' + (deadlineStatus ? ` (${deadlineStatus.details})` : '') };
        return analysis;
      }
    }
  }
  
  // --- NEW: Detect checkboxes in tables ---
  // Check if there's a table in the goal content
  const hasTable = contentForThisGoal.includes('|') && 
                  (contentForThisGoal.includes('|-') || 
                   /\|[-\s|:]+\|/.test(contentForThisGoal));
                   
  if (hasTable) {
    // Count standard checkboxes and table checkboxes
    const standardCheckboxLines = contentForThisGoal.split('\n').filter(line => {
      // Must be a markdown checkbox and not in a table
      return /^[-*]\s*\[([xX ])\]/.test(line) && !line.includes('|');
    });
    
    // Extract checkbox states from table cells
    const tableRows = contentForThisGoal.split('\n').filter(line => 
      line.includes('|') && line.match(/\[([ xX])\]/));
    
    // Count table checkboxes
    let tableCheckboxTotal = 0;
    let tableCheckboxCompleted = 0;
    
    tableRows.forEach(row => {
      const checkboxMatches = [...row.matchAll(/\[([ xX])\]/g)];
      tableCheckboxTotal += checkboxMatches.length;
      tableCheckboxCompleted += checkboxMatches.filter(match => 
        match[1].toLowerCase() === 'x').length;
    });
    
    // Count regular checkboxes
    let standardTotal = standardCheckboxLines.length;
    let standardCompleted = standardCheckboxLines.filter(line => 
      /\[[xX]\]/.test(line)).length;
    
    // Combine counts
    const total = standardTotal + tableCheckboxTotal;
    const completed = standardCompleted + tableCheckboxCompleted;
    
    if (total > 0) {
      let target = total;
      if (targetNumber && targetNumber > target) target = targetNumber;
      
      const percentage = target > 0 ? Math.round((completed / target) * 100) : 0;
      analysis = {
        type: 'checklist',
        current: completed,
        target: target,
        percentage: percentage,
        status: completed >= target ? 'completed' : 'in-progress',
        details: `${completed}/${target} items completed` + (deadlineStatus ? ` (${deadlineStatus.details})` : '')
      };
      
      if (deadlineStatus) {
        analysis.status = completed >= target ? 'completed' : deadlineStatus.status;
      }
      
      return analysis;
    }
  }
  
  // --- Automatic Progress Handling (for regular checkboxes) ---
  const goalLines = contentForThisGoal.split('\n');
  const checklistLines = goalLines.filter(line => {
    // Must be a markdown checkbox
    if (!/^[-*]\s*\[([xX ])\]/.test(line)) return false;
    // Exclude if line contains (SCHEDULED: ...) or (NOTIFY: ...)
    if (/\(SCHEDULED:[^)]+\)/i.test(line) || /\(NOTIFY:[^)]+\)/i.test(line)) return false;
    // Exclude if line is part of a TASKS: block (handled separately)
    return true;
  });
  
  if (checklistLines.length > 0) {
    // Only count lines with [x] or [X] as completed, not [ ]
    const completed = checklistLines.filter(line => /\[[xX]\]/.test(line) && !/\[ \]/.test(line)).length;
    let target = checklistLines.length;
    if (targetNumber && targetNumber > target) target = targetNumber;
    analysis = {
      type: 'checklist',
      current: completed,
      target: target,
      percentage: target > 0 ? Math.round((completed / target) * 100) : 0,
      status: completed >= target ? 'completed' : 'in-progress',
      details: `${completed}/${target} items completed` + (deadlineStatus ? ` (${deadlineStatus.details})` : '')
    };
    if (deadlineStatus) {
      analysis.status = completed >= target ? 'completed' : deadlineStatus.status;
    }
    return analysis;
  }
  
  // Rest of the function for other goal types...
  if (targetNumber) {
    const numberedItems = contentForThisGoal.match(/^(\d+[\.\):]\s|[-*]\s(?!\[))/gm);
    const currentCount = numberedItems ? numberedItems.length : 0;
    analysis = {
      type: 'counter',
      current: currentCount,
      target: targetNumber,
      percentage: Math.round((currentCount / targetNumber) * 100),
      status: currentCount >= targetNumber ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress'),
      details: `${currentCount}/${targetNumber} completed` + (deadlineStatus ? ` (${deadlineStatus.details})` : '')
    };
    return analysis;
  }
  
  if (deadlineStatus) {
    analysis = {
      type: 'deadline',
      current: daysLeft < 0 ? Math.abs(daysLeft) : 0,
      target: 0,
      percentage: daysLeft < 0 ? 100 : 0,
      status: deadlineStatus.status,
      details: deadlineStatus.details
    };
    return analysis;
  }
  
  const completionKeywords = /\b(done|completed|finished|achieved)\b/i;
  if (completionKeywords.test(contentForThisGoal)) {
    analysis = {
      type: 'completion',
      current: 1,
      target: 1,
      percentage: 100,
      status: 'completed',
      details: 'Goal completed'
    };
    return analysis;
  }
  
  return null;
}

// Expose for use in widget registry
window.analyzeGoalProgress = analyzeGoalProgress;