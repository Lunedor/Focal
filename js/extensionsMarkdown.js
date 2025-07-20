// --- MARKDOWN CONFIGURATION ---
// --- MINDMAP WIDGET EXTENSION ---
const mindmapExtension = {
  name: 'mindmap',
  level: 'block',
  start(src) {
    const match = src.match(/^MINDMAP:/i);
    return match ? match.index : undefined;
  },
  tokenizer(src, tokens) {
    // Greedily match everything after MINDMAP: up to two or more newlines or end of input
    const rule = /^MINDMAP:\s*([\s\S]*?)(?:\n{2,}|$)/i;
    const match = rule.exec(src);
    if (match) {
      let raw = match[0];
      return {
        type: 'mindmap',
        raw,
        text: match[1].replace(/^\s+|\s+$/g, ''),
      };
    }
    return false;
  },
  renderer(token) {
    let json = '';
    let rootTopic = token.text.trim() || 'Central Topic';
    if (!rootTopic || /^\s*$/.test(rootTopic)) rootTopic = 'Central Topic';
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(token.text);
      // If parsed is a valid jsMind format with a root node, ensure root node has a visible topic
      if (parsed && ((parsed.data && Array.isArray(parsed.data) && parsed.data.some(n => n.isroot)) || (parsed.node && parsed.node.isroot) || (parsed.id && parsed.topic))) {
        // Patch the root node's topic if empty (node_array or node_tree)
        if (parsed.data && Array.isArray(parsed.data)) {
          parsed.data = parsed.data.map(n => n.isroot ? { ...n, topic: n.topic && n.topic.trim() ? n.topic : rootTopic } : n);
        } else if (parsed.node && parsed.node.isroot) {
          parsed.node.topic = parsed.node.topic && parsed.node.topic.trim() ? parsed.node.topic : rootTopic;
        } else if (parsed.id && parsed.topic) {
          parsed.topic = parsed.topic && parsed.topic.trim() ? parsed.topic : rootTopic;
        }
        json = JSON.stringify(parsed);
      } else {
        // If not, wrap in a root node (node_tree format)
        json = JSON.stringify({
          meta: { name: 'MindMap', author: '', version: '1.0' },
          format: 'node_tree',
          data: {
            id: 'root',
            topic: rootTopic,
            children: []
          }
        });
      }
    } catch {
      // Fallback: wrap as a simple jsMind node tree with a single root
      json = JSON.stringify({
        meta: { name: 'MindMap', author: '', version: '1.0' },
        format: 'node_tree',
        data: {
          id: 'root',
          topic: rootTopic,
          children: []
        }
      });
    }
    if (typeof window !== 'undefined') {
    }
    return `<div class="widget-placeholder mindmap-widget-placeholder" data-widget-type="mindmap" data-mindmap='${encodeURIComponent(json)}'></div>`;
  }
};

// Add mindmap extension to the list
// (You must also register this in marked.use in markdown.js)
const mindmapExtensionExport = mindmapExtension;
/**
 * Centralized function to get the correct prompt text for a given date and attributes.
 * Supports 'daily-sequential' and 'daily-random' modes.
 * @param {string} promptText - The raw prompt text (may be multiline).
 * @param {object} attributes - Attributes object parsed from PROMPT block.
 * @param {Date} date - The date for which to get the prompt.
 * @returns {string} The prompt text for the given date, or empty string if none.
 */
function getPromptForDate(promptText, attributes, date) {
  const todayDateStr = (typeof dateFns !== 'undefined' && dateFns.format) ? dateFns.format(date, 'yyyy-MM-dd') : date.toISOString().slice(0,10);
  let text = promptText;
  if (attributes && attributes.mode === 'daily-sequential') {
    let items = text.split(/\r?\n/).map(line => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
    let startDateStr = attributes.start || todayDateStr;
    let startDate = new Date(startDateStr + 'T00:00:00');
    let diffDays = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));
    return (diffDays >= 0 && diffDays < items.length) ? items[diffDays] : '';
  } else if (attributes && attributes.mode === 'daily-random') {
    let items = text.split(/\r?\n/).map(line => line.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
    if (items.length > 0) {
      let seed = todayDateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      let selectedIdx = seed % items.length;
      return items[selectedIdx];
    }
    return '';
  }
  return text;
}

// Expose for use in other modules
if (typeof window !== 'undefined') {
  window.getPromptForDate = getPromptForDate;
}
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

const promptExtension = {
  name: 'prompt',
  level: 'block',
  start(src) {
    // Match PROMPT: or PROMPT(attr: val,...): at start of line
    return src.match(/^PROMPT(:|\([^)]*\):)/i)?.index;
  },
  tokenizer(src, tokens) {
    // Match PROMPT with optional attributes and block content
    const rule = /^PROMPT(?:\(([^)]*)\))?:\s*([\s\S]*?)(?=\n{2,}|$)/i;
    const match = rule.exec(src);
    if (match) {
      const raw = match[0];
      const attributesStr = match[1] || '';
      const text = match[2].trim();
      let config = 'prompt';
      if (attributesStr) {
        config += ',' + attributesStr;
      }
      return {
        type: 'prompt',
        raw,
        config,
        text,
      };
    }
    return false;
  },
  renderer(token) {
    // Parse attributes from config for planner filtering
    let attributesObj = {};
    if (token.config && token.config.includes(',')) {
      token.config.split(',').slice(1).forEach(part => {
        const [key, value] = part.trim().split(':').map(s => s.trim());
        if (key && value) attributesObj[key] = value;
      });
    }
    const attributesStr = JSON.stringify(attributesObj);
    return `<div class="widget-placeholder prompt-placeholder" data-widget-type="prompt" data-config='${token.config}' data-text='${escape(token.text)}' data-attributes='${attributesStr}' data-show-on='${attributesObj.showon || ''}'></div>`;
  },
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


function makeWidgetExtension(type, prefix) {
  return {
    name: type,
    level: 'block',
    start(src) { return src.match(new RegExp(`^${prefix}:`, 'i'))?.index; },
    tokenizer(src, tokens) {
      // This regex looks for blocks which may have multiple lines starting with the prefix
      // followed by transaction lines that start with "-"
      const rule = new RegExp(`^(${prefix}:[^\n]*(?:\n+${prefix}:[^\n]*)*)\n?((?:[\s]*-[^\n]*\n?)*)`, 'i');
      const match = rule.exec(src);
      if (match) {
        const commandPart = match[1].trim();
        const transactionPart = match[2].trim();
        return {
          type,
          raw: match[0],
          command: commandPart,
          transactions: transactionPart,
        };
      }
    },
    renderer(token) {
      let fullCommand = token.command;
      if (token.command.toLowerCase().startsWith(`${prefix.toLowerCase()}:`) &&
        token.transactions &&
        token.transactions.split('\n').some(line => line.trim().toLowerCase().startsWith(`${prefix.toLowerCase()}:`))) {
        fullCommand = `${token.command}\n${token.transactions}`;
        token.transactions = '';
      }
      return `<div class="widget-placeholder ${type}-widget-placeholder" data-widget-type="${type}" data-command='${fullCommand}' data-transactions='${token.transactions}'></div>`;
    }
  };
}

const financeExtension = makeWidgetExtension('finance', 'FINANCE');
const calorieExtension = makeWidgetExtension('calorie', 'CALORIE');
const workoutsExtension = makeWidgetExtension('workouts', 'WORKOUTS');
const sleepExtension = makeWidgetExtension('sleep', 'SLEEP');

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
  start(src) {
    // Match only the first line starting with FUTURELOG:
    return src.match(/^FUTURELOG:/m)?.index;
  },
  tokenizer(src, tokens) {
    // Find the first line
    const firstLineMatch = /^FUTURELOG:(.*)(?:\n|$)/.exec(src);
    if (!firstLineMatch) return;
    const rawBlockStr = firstLineMatch[0];
    // Get all lines after FUTURELOG:
    const after = src.slice(rawBlockStr.length);
    // Collect lines until next widget keyword or end of file
    const blockLines = [];
    const lines = after.split('\n');
    for (const line of lines) {
      if (/^\s*(GOAL:|TASKS:|FINANCE:|MOOD:|BOOKS:|MOVIES:|HABITS:|---)/.test(line)) break;
      blockLines.push(line);
    }
    const allLines = [firstLineMatch[1].trim(), ...blockLines];
    let items = [];
    let options = '';
    // Find the first non-empty, non-list line as options/config
    for (const line of allLines) {
      const trimmedLine = line.trim();
      if (
        trimmedLine &&
        !trimmedLine.startsWith('-') &&
        /^(\d+\s*-\s*months?)$/i.test(trimmedLine)
      ) {
        options = trimmedLine;
        break;
      }
    }
    // Now process all lines for items
    for (const line of allLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('-')) continue;
      const scheduledRegex = /^-\s*(?:\[([xX ])\]\s*)?(.*?)\s*\(SCHEDULED:\s*([^\)]+)\)\s*$/;
      const scheduledMatch = trimmedLine.match(scheduledRegex);
      if (scheduledMatch) {
        items.push({
          type: 'scheduled',
          text: scheduledMatch[2].trim(),
          dateStr: scheduledMatch[3].trim(),
          fullLine: line,
          hasCheckbox: scheduledMatch[1] !== undefined,
          isChecked: scheduledMatch[1] ? scheduledMatch[1].toLowerCase() === 'x' : false,
        });
        continue;
      }
      const repeatRegex = /^-\s*(?:\[([xX ])\]\s*)?(.*?)\s*\(REPEAT:\s*([^\)]+)\)\s*$/;
      const repeatMatch = trimmedLine.match(repeatRegex);
      if (repeatMatch) {
        items.push({
          type: 'repeat',
          text: repeatMatch[2].trim(),
          repeatRule: repeatMatch[3].trim(),
          fullLine: line,
          hasCheckbox: repeatMatch[1] !== undefined,
          isChecked: repeatMatch[1] ? repeatMatch[1].toLowerCase() === 'x' : false,
        });
      }
    }
    const itemsJson = items.length > 0 ? JSON.stringify(items) : 'null';
    // Use the original raw block as the command (raw markdown, not HTML)
    const fullRawBlock = rawBlockStr + (blockLines.length ? '\n' + blockLines.join('\n') : '');
    return {
      type: 'futurelog',
      raw: fullRawBlock,
      command: fullRawBlock,
      options: options,
      items: itemsJson,
    };
  },
   renderer(token) {
     // This function correctly escapes data for safe HTML embedding. It does not need changing.
     const escapeAttr = (str) => {
       if (!str) return '';
       return str
         .replace(/&/g, '&amp;')
         .replace(/"/g, '&quot;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;');
     };

     const commandAttr = escapeAttr(token.command);
     // Always set data-items, default to [] if missing or null
     let itemsAttr = token.items;
     if (!itemsAttr || itemsAttr === 'null' || itemsAttr === null) {
       itemsAttr = '[]';
     }
     itemsAttr = escapeAttr(itemsAttr);
     const optionsAttr = escapeAttr(token.options);

     const htmlString = `<div class="widget-placeholder futurelog-placeholder" data-widget-type="futurelog" data-command="${commandAttr}" data-options="${optionsAttr}" data-items="${itemsAttr}"></div>`;
     return htmlString;
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
// --- MINDMAP INDENTED TEXT PARSER ---
/**
 * Parses indented text into a jsMind node array (tree structure).
 * Example input:
 *   Root
 *     Child 1
 *       Subchild 1
 *     Child 2
 * Returns: { nodes: [...], rootId: ... }
 */
function parseMindmapIndentedText(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) throw new Error('Mind map is empty.');
  // Determine indentation (spaces or tabs)
  const getIndent = line => line.match(/^\s*/)[0].length;
  // Build tree
  let nodeId = 1;
  const stack = [];
  const nodes = [];
  let rootId = null;
  for (const line of lines) {
    const indent = getIndent(line);
    const topic = line.trim();
    const id = 'node_' + (nodeId++);
    let parent = null;
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    if (stack.length > 0) {
      parent = stack[stack.length - 1].id;
    }
    if (!parent) rootId = id;
    nodes.push({ id, topic, parentid: parent });
    stack.push({ id, indent });
  }
  if (!rootId) throw new Error('Could not determine root node.');
  return { nodes, rootId };
}

// Export mindmapExtension and parser for use in markdown.js and widgetRegistry.js
if (typeof window !== 'undefined') {
  window.mindmapExtension = mindmapExtensionExport;
  window.parseMindmapIndentedText = parseMindmapIndentedText;
}