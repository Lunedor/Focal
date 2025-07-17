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

  return `<li class="task-list-item${isChecked ? ' checked-item' : ''}" ${liAttributes}><input type="checkbox" id="${checkboxId}" class="list-checkbox"${inputAttributes}${isChecked ? ' checked' : ''}> ${parsedItemText}${parsedSubList}</li>`;

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
  extensions: [
    futurelogExtension,
    wikiLinkExtension,
    tableCheckboxExtension,
    taskSummaryExtension,
    goalExtension,
    moodTrackerExtension,
    financeExtension,
    calorieExtension,
    workoutsExtension,
    sleepExtension,
    booksExtension,
    moviesExtension,
    habitsExtension,
    promptExtension
  ],
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
/**
 * Takes raw HTML and enhances it by converting ALL date/repeat/notify text into interactive links.
 * This is the single source of truth for creating clickable date links.
 */
function renderScheduledAndRepeatLinks(html) {

  // Only replace in text nodes, not inside HTML tags or attributes
  // Split by tags, process only text parts
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) return tag;
    // Replace SCHEDULED/NOTIFY
    text = text.replace(/(\((SCHEDULED|NOTIFY):\s*([^)]+)\))|(&#40;(SCHEDULED|NOTIFY):\s*([^&#]+)&#41;)/gi, (match, p1, type1, content1, p2, type2, content2, offset, string) => {
      let type = type1 || type2;
      let content = content1 || content2;
      let displayTag = match;
      let normalizedDate = null;
      if (type && type.toUpperCase() === 'NOTIFY') {
        displayTag = match.replace(/(\(NOTIFY:|&#40;NOTIFY:)/i, '(🔔 NOTIFY:');
        // If NOTIFY only has time, try to get SCHEDULED date from same line
        const timeMatch = content.match(/^(\d{1,2}:\d{2})$/);
        if (timeMatch) {
          // Find SCHEDULED date in the same line
          const lineStart = string.lastIndexOf('\n', offset) + 1;
          const lineEnd = string.indexOf('\n', offset);
          const line = string.substring(lineStart, lineEnd === -1 ? string.length : lineEnd);
          const schedMatch = line.match(/\(SCHEDULED:\s*([^)]+)\)/);
          let schedDate = null;
          if (schedMatch) {
            schedDate = window.normalizeDateStringToYyyyMmDd(schedMatch[1]);
          }
          if (schedDate) {
            normalizedDate = `${schedDate} ${content.trim()}`;
          }
        }
      }
      if (!normalizedDate) {
        // Use the same parsing logic as planner
        normalizedDate = window.normalizeDateStringToYyyyMmDd(content.trim());
      }
      if (normalizedDate) {
        return `<span class="scheduled-link" data-planner-date="${normalizedDate}">${displayTag}</span>`;
      } else {
        return match;
      }
    });
    // Replace REPEAT
    text = text.replace(/(\(REPEAT:[^)]+\))/gi, (repeatPart) => {
      const ruleMatch = repeatPart.match(/REPEAT:\s*([^)]+)/);
      if (!ruleMatch || !ruleMatch[1]) return repeatPart;
      let rule = ruleMatch[1].trim();
      let nextOccurrence = null;
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rangeEnd = window.dateFns.addYears(today, 2);
        const item = { repeatRule: rule };
        const occurrences = window.expandRecurrence(item, { rangeStart: today, rangeEnd });
        if (occurrences && occurrences.length > 0) {
          let found = null;
          for (let i = 0; i < occurrences.length; i++) {
            if (occurrences[i] >= today) {
              found = occurrences[i];
              break;
            }
          }
          if (!found) found = occurrences[0];
          nextOccurrence = window.dateFns.format(found, 'yyyy-MM-dd');
        } else {
          const year = today.getFullYear();
          const fallbackDate = window.normalizeDateStringToYyyyMmDd(rule + '.' + year);
          if (fallbackDate) nextOccurrence = fallbackDate;
        }
      } catch (e) { nextOccurrence = null; }
      const displayTag = `🔁 ${repeatPart}`;
      if (nextOccurrence) {
        return `<span class="repeat-link scheduled-link" data-planner-date="${nextOccurrence}">${displayTag}</span>`;
      } else {
        return `<span class="repeat-link">${displayTag}</span>`;
      }
    });
    return text;
  });


    // Match both normal and HTML-encoded parentheses for SCHEDULED, NOTIFY, REPEAT
    // Normal: (SCHEDULED: ...), Encoded: &#40;SCHEDULED: ...&#41;
    html = html.replace(/(\((SCHEDULED|NOTIFY):\s*([^)]+)\))|(&#40;(SCHEDULED|NOTIFY):\s*([^&#]+)&#41;)/gi, (match, p1, type1, content1, p2, type2, content2) => {
        let type = type1 || type2;
        let content = content1 || content2;
        // Try to find a date in the content using a robust regex
        const dateMatch = content.match(/\d{4}[.\/-]\d{2}[.\/-]\d{2}|\d{2}[.\/-]\d{2}[.\/-]\d{4}|\d{2}[.\/-]\d{2}/);
        let normalizedDate = null;
        if (dateMatch) {
            normalizedDate = window.normalizeDateStringToYyyyMmDd(dateMatch[0]);
        }
        let displayTag = match;
        if (type && type.toUpperCase() === 'NOTIFY') {
            displayTag = match.replace(/(\(NOTIFY:|&#40;NOTIFY:)/i, '(🔔 NOTIFY:');
        }
        if (normalizedDate) {
            return `<span class="scheduled-link" data-planner-date="${normalizedDate}">${displayTag}</span>`;
        } else {
            return match;
        }
    });

    html = html.replace(/(\(REPEAT:\s*([^)]+)\))|(&#40;REPEAT:\s*([^&#]+)&#41;)/gi, (match, p1, rule1, p2, rule2) => {
        let rule = rule1 || rule2;
        const item = { repeatRule: rule.trim() };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const rangeEnd = dateFns.addYears(today, 2);
        const occurrences = window.expandRecurrence(item, { rangeStart: today, rangeEnd });
        const nextOccurrenceDate = occurrences.length > 0 ? occurrences[0] : null;
        if (nextOccurrenceDate) {
            const formattedDate = dateFns.format(nextOccurrenceDate, 'yyyy-MM-dd');
            const tooltip = `Repeats. Next: ${dateFns.format(nextOccurrenceDate, 'MMM d, yyyy')}`;
            const displayTag = `🔁 ${match}`;
            return `<span class="repeat-link scheduled-link" data-planner-date="${formattedDate}" title="${tooltip}">${displayTag}</span>`;
        } else {
            return `<span class="repeat-link" title="Repeats (no upcoming occurrences found)">🔁 ${match}</span>`;
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