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
  start(src) { return src.match(/^GOAL/i)?.index; },
  tokenizer(src, tokens) {
    // A simple regex to grab everything on the line after GOAL
    const rule = /^GOAL(.*)(?:\n|$)/i;
    const match = rule.exec(src);

    if (match) {
        let remainingText = match[1].trim();
        let attributes = {};
        let label = '';

        // Now, use JavaScript to figure out which pattern we have
        if (remainingText.startsWith('(') && remainingText.includes('):')) {
            // Case 1: The standard linked goal -> GOAL(...)
            const parts = remainingText.split('):');
            const attrStr = parts.shift().substring(1); // Get content inside ()
            label = parts.join('):').trim(); // Re-join in case title has '):'
            
            attrStr.split(',').forEach(attr => {
                const [key, value] = attr.split(':').map(s => s.trim());
                if (key && value) attributes[key] = value;
            });

        } else if (remainingText.startsWith(':(') && remainingText.includes('):')) {
            // Case 2: The typo case -> GOAL:(...)
            const parts = remainingText.split('):');
            const attrStr = parts.shift().substring(2); // Get content inside (), skipping ':( '
            label = parts.join('):').trim();
            
            attrStr.split(',').forEach(attr => {
                const [key, value] = attr.split(':').map(s => s.trim());
                if (key && value) attributes[key] = value;
            });

        } else if (remainingText.startsWith(':')) {
            // Case 3: A standard manual goal -> GOAL: ...
            label = remainingText.substring(1).trim();
        } else {
            // Fallback for malformed goals
            label = remainingText;
        }

        return {
            type: 'goal',
            raw: match[0],
            label: label,
            attributes: JSON.stringify(attributes) // Pass attributes as a string
        };
    }
  },
  renderer(token) {
    // This renderer remains the same. It correctly creates the placeholder.
    return `<div class="widget-placeholder goal-placeholder" data-widget-type="goal" data-label='${token.label}' data-attributes='${token.attributes}'></div>`;
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
  start(src) { return src.match(/(^```futurelog|FUTURELOG:)/)?.index; },
  tokenizer(src, tokens) {
    // This tokenizer is now simple. It just finds the command block and extracts the raw content.
    const fenceRule = /^```futurelog\n([\s\S]+?)\n```/;
    const simpleRule = /^(FUTURELOG:[\s\S]*?)(?=\n(?:GOAL:|TASKS:|FINANCE:|MOOD:|BOOKS:|MOVIES:|HABITS:|---|\S)|$)/;

    let match = src.match(fenceRule);
    if (match) {
        // For ```futurelog ... ``` blocks
        // The command is the full text, which the widget will parse.
        return { type: 'futurelog', raw: match, command: `FUTURELOG:\n${match[1]}` };
    }
    
    match = src.match(simpleRule);
    if (match) {
        // FIX: The bug was here. `match` is an array. We must pass the matched string, `match[0]`.
        // The `command` property must be a string for the renderer to use .replace() on it.
        return { type: 'futurelog', raw: match[0], command: match[0] };
    }
  },
  renderer(token) {
    // Escape single quotes inside the command to prevent breaking the HTML attribute.
    // This now works because the tokenizer correctly passes a string.
    const safeCommand = token.command.replace(/\'/g, "'");
    return `<div class="widget-placeholder futurelog-placeholder" data-widget-type="futurelog" data-command='${safeCommand}'></div>`;
  }
};

const habitsExtension = {
  name: 'habits',
  level: 'block',
  start(src) {
    const match = src.match(/^HABITS:/i);
    return match?.index;
  },
  tokenizer(src, tokens) {
    // For HABITS: define, we need to capture the definition lines that follow
    const rule = /^HABITS:\s*(define[^\n]*)\n?((?:[\s]*-[^\n]*\n?)*)/i;
    const match = rule.exec(src);
    if (match) {
      return {
        type: 'habits',
        raw: match[0],
        config: match[1].trim(),
        definitions: match[2].trim()
      };
    }

    // For other HABITS commands (today, stats, grid, chart), just match the single line
    const simpleRule = /^HABITS:\s*(.*)(?:\n|$)/i;
    const simpleMatch = simpleRule.exec(src);
    if (simpleMatch) {
      return {
        type: 'habits',
        raw: simpleMatch[0],
        config: simpleMatch[1].trim(),
        definitions: ''
      };
    }

    return false;
  },
  renderer(token) {
    return `<div class="widget-placeholder habits-placeholder" data-widget-type="habits" data-config='${token.config}'></div>`;
  }
};

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
  extensions: [wikiLinkExtension, tableCheckboxExtension, taskSummaryExtension, goalExtension, moodTrackerExtension, financeExtension, booksExtension, moviesExtension, futurelogExtension, habitsExtension],
  gfm: true,
  breaks: true,
  renderer: renderer
});

// --- MARKDOWN PARSING LOGIC ---
// --- All PROGRESS parsing logic must be inside analyzeGoalProgress ---

/**
 * Takes raw HTML and enhances it by converting ALL date/repeat/notify text into interactive links.
 * This is the single source of truth for creating clickable date links.
 */
function renderScheduledAndRepeatLinks(html) {
    // 1. Enhance (SCHEDULED:...) and (NOTIFY:...) links
    const scheduledRegexWithParens = /(\((?:SCHEDULED|NOTIFY):[^)]+\))/gi;
    html = html.replace(scheduledRegexWithParens, (fullMatch) => {
        // Find the inner content of the tag (e.g., "2025-08-15 10:00")
        const dateContentMatch = fullMatch.match(/(?:SCHEDULED|NOTIFY):\s*([^)]+)/);
        
        // *** THE FIX IS HERE ***
        // First, check if the match and the captured group [1] exist.
        if (!dateContentMatch || !dateContentMatch[1]) {
            return fullMatch; // If not, return the original text to prevent errors.
        }

        // Now, correctly access the captured string at index [1] before trimming.
        const contentString = dateContentMatch[1].trim();
        const dateStr = contentString.split(' '); // Get just the date part
        const normalizedDate = window.normalizeDateStringToYyyyMmDd(dateStr[0]);
        
        if (!normalizedDate) {
            return fullMatch; // Return original if date is not valid
        }

        // Add a bell icon for NOTIFY tags
        let displayTag = fullMatch;
        if (fullMatch.toUpperCase().includes('(NOTIFY:')) {
            displayTag = displayTag.replace(/(\(NOTIFY:)/i, '(🔔 NOTIFY:');
        }

        return `<span class="scheduled-link" data-planner-date="${normalizedDate}">${displayTag}</span>`;
    });

    // 2. Enhance (REPEAT:...) links (this part was already correct)
    const repeatRegexWithParens = /(\(REPEAT:[^)]+\))/gi;
    html = html.replace(repeatRegexWithParens, (fullMatch) => {
        const ruleMatch = fullMatch.match(/REPEAT:\s*([^)]+)/);
        if (!ruleMatch || !ruleMatch[1]) return fullMatch;

        const item = { repeatRule: ruleMatch[1].trim() };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rangeEnd = dateFns.addYears(today, 2);
        
        const occurrences = window.expandRecurrence(item, { rangeStart: today, rangeEnd });
        
        const nextOccurrenceDate = occurrences.length > 0 ? occurrences[0] : null;
        
        if (nextOccurrenceDate) {
            const formattedDate = dateFns.format(nextOccurrenceDate, 'yyyy-MM-dd');
            const tooltip = `Repeats. Next: ${dateFns.format(nextOccurrenceDate, 'MMM d, yyyy')}`;
            const displayTag = `🔁 ${fullMatch}`;
            return `<span class="repeat-link scheduled-link" data-planner-date="${formattedDate}" title="${tooltip}">${displayTag}</span>`;
        } else {
            return `<span class="repeat-link" title="Repeats (no upcoming occurrences found)">🔁 ${fullMatch}</span>`;
        }
    });

    return html;
}

/**
 * The main markdown parsing function for the application.
 */
const parseMarkdown = (text, options = {}) => {
  if (!text) return '';

  // Step 1: Convert raw markdown to basic HTML.
  // This correctly processes wiki-links, lists, tables, etc., into their HTML counterparts.
  let html = marked.parse(text, { breaks: true });

  // Step 2: Enhance the generated HTML.
  // This finds any date/repeat text within the HTML and wraps it in our clickable spans.
  html = renderScheduledAndRepeatLinks(html);

  // Step 3: Perform final minor cleanups and widget rendering (logic is unchanged).
  html = html.replace(/(<input[^>]*type="checkbox"[^>]*)\s*disabled[^>]*>/g, '$1>');
  html = html.replace(/<td>([\s\n]*)(?:-\s+)?\[([ xX])\]([\s\n]*)<\/td>/gi, (match, before, checked, after) => {
    const isChecked = checked.toLowerCase() === 'x';
    return `<td class="checkbox-cell">${before}<input type="checkbox" class="table-checkbox" ${isChecked ? 'checked' : ''}>${after}</td>`;
  });
  html = html.replace(/<td>([\s\n]*)\[([ xX])\]([\s\n]*)<\/td>/gi, (match, before, checked, after) => {
    const isChecked = checked.toLowerCase() === 'x';
    return `<td class="checkbox-cell">${before}<input type="checkbox" class="table-checkbox" ${isChecked ? 'checked' : ''}>${after}</td>`;
  });
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

/**
 * A helper function to find and analyze a deadline within a goal's title.
 * @param {string} goalLabel - The title of the goal.
 * @returns {object|null} An object with deadline info or null.
 */
function getDeadlineStatus(goalLabel) {
    const dateRegex = new RegExp(window.DATE_REGEX_PATTERN, 'g');
    const dateMatch = dateRegex.exec(goalLabel);

    if (dateMatch) {
        const dateStr = dateMatch[0];
        const parsed = window.parseDateString(dateStr);
        if (parsed && !isNaN(parsed)) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Set deadline to the end of the day for accurate "days left" calculation
            const deadline = new Date(parsed);
            deadline.setHours(23, 59, 59, 999);

            const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

            if (daysLeft < 0) {
                return { status: 'deadline-passed', details: `(${Math.abs(daysLeft)} days overdue)` };
            } else {
                return { status: 'in-progress', details: `(${daysLeft} days remaining)` };
            }
        }
    }
    return null; // No valid deadline found
}

// Add this helper function right BEFORE analyzeGoalProgress in markdown.js
/**
 * A helper function to find and analyze a deadline within a goal's title.
 * @param {string} goalLabel - The title of the goal.
 * @returns {object|null} An object with deadline info or null.
 */
function getDeadlineStatus(goalLabel) {
    const dateRegex = new RegExp(window.DATE_REGEX_PATTERN, 'g');
    const dateMatch = dateRegex.exec(goalLabel);

    if (dateMatch) {
        const dateStr = dateMatch[0];
        const parsed = window.parseDateString(dateStr);
        if (parsed && !isNaN(parsed)) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const deadline = new Date(parsed);
            deadline.setHours(23, 59, 59, 999);

            const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

            if (daysLeft < 0) {
                return { status: 'deadline-passed', details: `(${Math.abs(daysLeft)} days overdue)` };
            } else {
                return { status: 'in-progress', details: `(${daysLeft} days remaining)` };
            }
        }
    }
    return null;
}


/**
 * Analyzes a goal's progress based on its description and sub-tasks.
 * This function now supports both manual goals (with checklists/progress lines)
 * and linked goals that automatically track data from other widgets.
 *
 * @param {string} text - The full markdown text of the page/note containing the goal.
 * @param {string} goalLabel - The text of the goal line, which may contain attributes.
 * @param {object} attributes - An object of parsed attributes from a linked goal, e.g., { source: 'books' }.
 * @param {number} callCount - The occurrence of the goal on the page (for goals with identical labels).
 * @returns {object|null} An analysis object or null if the goal cannot be found/analyzed.
 */
function analyzeGoalProgress(text, goalLabel, attributes, callCount = 1) {
    // --- PATH 1: Handle LINKED goals, e.g., GOAL(source: books, ...): ---
    if (attributes && attributes.source) {
        const source = attributes.source;

        // 1. Determine the date range for the query from attributes
        const now = new Date();
        let startDate, endDate;
        if (attributes.timeframe === 'this-year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else if (attributes.timeframe === 'this-month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            startDate = attributes.startDate ? new Date(attributes.startDate) : new Date(0);
            endDate = attributes.endDate ? new Date(attributes.endDate) : new Date(8640000000000000);
        }

        // 2. Determine the goal's target number
        let target = 0;
        if (attributes.count && !isNaN(attributes.count)) {
            target = parseInt(attributes.count, 10);
        } else {
            const toDoCount = queryWidget(source, 'getToDoCount') || 0;
            const finishedCount = queryWidget(source, 'getFinishedCount', { startDate, endDate }) || 0;
            target = toDoCount + finishedCount;
        }

        // 3. Determine the goal's current progress
        const progress = queryWidget(source, 'getFinishedCount', { startDate, endDate }) || 0;
        
        // 4. Get deadline status and build details string
        const deadlineStatus = getDeadlineStatus(goalLabel);
        let details = `${progress} / ${target} completed`;
        if (deadlineStatus) {
            details += ` ${deadlineStatus.details}`;
        }
        
        // 5. Determine overall status
        let finalStatus = (progress >= target) ? 'completed' : 'in-progress';
        if (deadlineStatus && deadlineStatus.status === 'deadline-passed' && finalStatus !== 'completed') {
            finalStatus = 'deadline-passed';
        }
        
        const percentage = target > 0 ? Math.round((progress / target) * 100) : 0;

        return { type: 'linked', current: progress, target: target, percentage: percentage, status: finalStatus, details: details };
    }

    // --- PATH 2: Handle MANUAL goals, e.g., GOAL: My manual goal ---
    if (!text) return null;
    const lines = text.split('\n');
    let analysis = { type: 'unknown', current: 0, target: 0, percentage: 0, status: 'in-progress', details: '' };

    let foundCount = 0;
    let goalLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('GOAL:') && !line.startsWith('GOAL(')) {
            const manualLabel = line.replace('GOAL:', '').trim();
            if (manualLabel === goalLabel) {
                foundCount++;
                if (foundCount === callCount) {
                    goalLineIndex = i;
                    break;
                }
            }
        }
    }

    if (goalLineIndex === -1) return null;

    let endIdx = lines.length;
    for (let i = goalLineIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('GOAL:') || line.startsWith('TASKS:') || /^#{1,6}\s/.test(line) || /^---+$/.test(line)) {
            endIdx = i;
            break;
        }
    }

    const relevantLines = lines.slice(goalLineIndex + 1, endIdx);
    const contentForThisGoal = relevantLines.join('\n');
    
    // Use the helper for deadline analysis for all manual types
    const deadlineStatus = getDeadlineStatus(goalLabel);
    
    let targetNumber = null;
    let numberMatches = [...goalLabel.matchAll(/(\d+)/g)];
    if (numberMatches.length > 0) {
        const dateMatchForNumber = new RegExp(window.DATE_REGEX_PATTERN, 'g').exec(goalLabel);
        let dateInfo = null;
        if(dateMatchForNumber) dateInfo = { index: dateMatchForNumber.index, length: dateMatchForNumber[0].length };
        
        for (const numMatch of numberMatches) {
            if (dateInfo && (numMatch.index >= dateInfo.index && numMatch.index < (dateInfo.index + dateInfo.length))) {
                continue;
            }
            targetNumber = parseInt(numMatch[0], 10);
            break;
        }
    }

    let progressLine = null;
    let progressPercent = null;
    let progressValue = null;
    let progressCompleted = false;
    for (const line of relevantLines) {
        const percentMatch = line.match(/^PROGRESS:\s*(?:.*)?\[(\d{1,3})%\]/i);
        const valueMatch = line.match(/^PROGRESS:\s*(?:.*)?\[(\d{1,5})\]/i);
        const completedMatch = line.match(/^PROGRESS:\s*COMPLETED(?:\s*|\s*\[.*\])/i);
        if (percentMatch) { progressPercent = parseInt(percentMatch[1], 10); progressLine = 'percent'; break; }
        if (valueMatch) { progressValue = parseInt(valueMatch[1], 10); progressLine = 'value'; break; }
        if (completedMatch) { progressCompleted = true; progressLine = 'completed'; break; }
    }

    if (progressLine) {
        analysis.type = 'manual';
        if (targetNumber) {
            if (progressLine === 'percent') {
                analysis.current = Math.round(targetNumber * progressPercent / 100);
                analysis.target = targetNumber;
                analysis.percentage = progressPercent;
            } else if (progressLine === 'value') {
                analysis.current = progressValue;
                analysis.target = targetNumber;
                analysis.percentage = Math.round((progressValue / targetNumber) * 100);
            } else if (progressLine === 'completed') {
                analysis.current = targetNumber;
                analysis.target = targetNumber;
                analysis.percentage = 100;
            }
            analysis.details = `${analysis.current}/${analysis.target} completed`;
        } else {
            if (progressLine === 'percent') {
                analysis.current = progressPercent;
                analysis.target = 100;
                analysis.percentage = progressPercent;
                analysis.details = 'Manual progress';
            } else if (progressLine === 'completed') {
                analysis.current = 1;
                analysis.target = 1;
                analysis.percentage = 100;
                analysis.details = 'Goal completed';
            }
        }
        if (deadlineStatus) analysis.details += ` ${deadlineStatus.details}`;
        analysis.status = analysis.percentage >= 100 ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress');
        return analysis;
    }

    const hasTable = contentForThisGoal.includes('|') && (contentForThisGoal.includes('|-') || /\|[-\s|:]+\|/.test(contentForThisGoal));
    if (hasTable) {
        const standardCheckboxLines = contentForThisGoal.split('\n').filter(line => /^[-*]\s*\[([xX ])\]/.test(line) && !line.includes('|'));
        const tableRows = contentForThisGoal.split('\n').filter(line => line.includes('|') && line.match(/\[([ xX])\]/));
        let tableCheckboxTotal = 0;
        let tableCheckboxCompleted = 0;
        tableRows.forEach(row => {
            const checkboxMatches = [...row.matchAll(/\[([ xX])\]/g)];
            tableCheckboxTotal += checkboxMatches.length;
            tableCheckboxCompleted += checkboxMatches.filter(match => match[1].toLowerCase() === 'x').length;
        });
        const standardTotal = standardCheckboxLines.length;
        const standardCompleted = standardCheckboxLines.filter(line => /\[[xX]\]/.test(line)).length;
        const total = standardTotal + tableCheckboxTotal;
        const completed = standardCompleted + tableCheckboxCompleted;

        if (total > 0) {
            let target = targetNumber || total;
            analysis = { type: 'checklist', current: completed, target: target, percentage: target > 0 ? Math.round((completed / target) * 100) : 0 };
            analysis.details = `${completed}/${target} items completed` + (deadlineStatus ? ` ${deadlineStatus.details}` : '');
            analysis.status = completed >= target ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress');
            return analysis;
        }
    }

    const checklistLines = relevantLines.filter(line => /^[-*]\s*\[([xX ])\]/.test(line) && !/\(SCHEDULED:[^)]+\)/i.test(line) && !/\(NOTIFY:[^)]+\)/i.test(line));
    if (checklistLines.length > 0) {
        const completed = checklistLines.filter(line => /\[[xX]\]/.test(line) && !/\[ \]/.test(line)).length;
        let target = targetNumber || checklistLines.length;
        analysis = { type: 'checklist', current: completed, target: target, percentage: target > 0 ? Math.round((completed / target) * 100) : 0 };
        analysis.details = `${completed}/${target} items completed` + (deadlineStatus ? ` ${deadlineStatus.details}` : '');
        analysis.status = completed >= target ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress');
        return analysis;
    }

    if (targetNumber) {
        const numberedItems = contentForThisGoal.match(/^(\d+[\.\):]\s|[-*]\s(?!\[))/gm);
        const currentCount = numberedItems ? numberedItems.length : 0;
        analysis = { type: 'counter', current: currentCount, target: targetNumber, percentage: Math.round((currentCount / targetNumber) * 100) };
        analysis.details = `${currentCount}/${targetNumber} completed` + (deadlineStatus ? ` ${deadlineStatus.details}` : '');
        analysis.status = currentCount >= targetNumber ? 'completed' : (deadlineStatus ? deadlineStatus.status : 'in-progress');
        return analysis;
    }

    if (deadlineStatus) {
        analysis = { type: 'deadline', current: deadlineStatus.status === 'deadline-passed' ? 1 : 0, target: 1, percentage: deadlineStatus.status === 'deadline-passed' ? 100 : 0, status: deadlineStatus.status, details: deadlineStatus.details.replace(/[()]/g, '') };
        return analysis;
    }

    const completionKeywords = /\b(done|completed|finished|achieved)\b/i;
    if (completionKeywords.test(contentForThisGoal)) {
        analysis = { type: 'completion', current: 1, target: 1, percentage: 100, status: 'completed', details: 'Goal completed' };
        return analysis;
    }

    return null;
}
// Expose for use in widget registry
window.analyzeGoalProgress = analyzeGoalProgress;