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
        return `<div class="goal-placeholder" data-label="${token.label}"></div>`;
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
        return `<div class="task-summary-placeholder" data-label="${token.label}"></div>`;
    }
};

const renderer = new marked.Renderer();
renderer.listitem = (text, task, checked) => {
    // Handle both string and token object
    let rawText = '';
    if (typeof text === 'string') {
        rawText = text;
    } else if (text && typeof text === 'object') {
        // Try to get the raw property, or fallback to text property
        rawText = text.raw || text.text || '';
    }
    // Now use rawText for all further processing
    const taskMatch = rawText.match(/^\s*(?:[-*]|\d+\.)\s+\[([xX ])\]\s+(.*)/);
    if (taskMatch) {
        const isChecked = taskMatch[1].trim().toLowerCase() === 'x';
        let itemText = taskMatch[2];
        let liAttributes = '';
        let inputAttributes = '';

        // Extract custom attributes from {key=... line-index=... scheduled-date=...}
        const attrMatch = itemText.match(/\{([^}]+)\}$/);
        if (attrMatch) {
            const attrString = attrMatch[1];
            itemText = itemText.replace(/\{[^}]+\}$/, '').trim();
            if (/key=/.test(attrString)) {
                // Regex to correctly parse attributes, allowing spaces in the 'key' value.
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

        // Check if this task item is a scheduled item displayed in the planner
        const scheduledFromMatch = itemText.match(/^(.*)\s+\(from\s+\[\[([^\]]+)\]\]\)$/);
        if (scheduledFromMatch) {
            const originalTaskContent = scheduledFromMatch[1].trim();
            liAttributes = `data-original-task-content="${originalTaskContent}"`;
        }

        const parsedText = marked.parseInline(itemText);
        // Always render <input type="checkbox">, only add checked if isChecked is true, no extra space before checked
        return `<li class="task-list-item" ${liAttributes}><input type="checkbox"${inputAttributes}${isChecked ? ' checked' : ''}> ${parsedText}</li>`;
    }
    const regularMatch = rawText.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (regularMatch) {
        const itemText = regularMatch[1];
        const parsedText = marked.parseInline(itemText);
        return `<li>${parsedText}</li>`;
    }
    return `<li>${marked.parseInline(rawText)}</li>`;
};

marked.use({
    extensions: [wikiLinkExtension, taskSummaryExtension, goalExtension],
    gfm: true,
    breaks: true,
    renderer: renderer
});



// --- All PROGRESS parsing logic must be inside analyzeGoalProgress ---



const parseMarkdown = (text) => {
  if (!text) return '';
  let html = marked.parse(text, { breaks: true });
  html = html.replace(/(<input[^>]*type="checkbox"[^>]*)\s*disabled[^>]*>/g, '$1>');
  if (html.includes('[object Object]')) {
    html = html.replace(/\[object Object\]/g, '');
  }
  html = html.replace(/<div class="task-summary-placeholder" data-label="([^"]*)">/g, (match, label) => {
    const taskStats = calculateTaskStats(text, label);
    const allCompleted = taskStats.total > 0 && taskStats.completed === taskStats.total;
    const taskIcon = allCompleted ? '✅' : '📋';
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
  // --- Multi-goal fix: track call count for each label ---
  const goalCallCounts = {};
  html = html.replace(/<div class="goal-placeholder" data-label="([^"]*)">/g, (match, label) => {
    goalCallCounts[label] = (goalCallCounts[label] || 0) + 1;
    const goalAnalysis = analyzeGoalProgress(text, label, goalCallCounts[label]);
    if (!goalAnalysis) {
      return `<div class="goal-tracker basic">
        <div class="goal-header">
          <span class="goal-icon">🎯</span>
          <span class="goal-title">${label}</span>
        </div>
      </div>`;
    }
    const statusClass = goalAnalysis.status === 'completed' ? 'completed' :
                       goalAnalysis.status === 'deadline-passed' ? 'overdue' : 'in-progress';
    const statusIcon = goalAnalysis.status === 'completed' ? '✅' :
                      goalAnalysis.status === 'deadline-passed' ? '⚠️' : '🎯';
    // If manual progress and completed, don't show progress bar
    if (goalAnalysis.type === 'manual' && goalAnalysis.status === 'completed') {
      return `<div class="goal-tracker ${goalAnalysis.type} ${statusClass}">
        <div class="goal-header">
          <span class="goal-icon">${statusIcon}</span>
          <span class="goal-title">${label}</span>
        </div>
        <div class="goal-progress">
          <div class="goal-stats">${goalAnalysis.details}</div>
          <span class="goal-percentage">${goalAnalysis.percentage}%</span>
        </div>
      </div>`;
    }
    // If manual progress, show stats, percentage, and a progress bar
    if (goalAnalysis.type === 'manual') {
      return `<div class="goal-tracker ${goalAnalysis.type} ${statusClass}">
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
    return `<div class="goal-tracker ${goalAnalysis.type} ${statusClass}">
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

  // Make (REPEAT: ...) clickable and normalized for recurring events, including new syntax
  // Support: (REPEAT: 03.07.1995), (REPEAT: every monday from 30.06.2025 to 30.06.2026), etc.
  const repeatRegex = /\(REPEAT: ([^)]+)\)/gi;
  html = html.replace(repeatRegex, (match, repeatRule) => {
    let tooltip = '';
    let normalized = '';
    let recurringIcon = '🔁';
    // Try to parse new syntax: every <weekday> from <start> to <end>
    const rangeMatch = repeatRule.match(/^every (monday|tuesday|wednesday|thursday|friday|saturday|sunday) from ([^ ]+) to ([^ )]+)/i);
    if (rangeMatch) {
      const weekday = rangeMatch[1];
      const from = rangeMatch[2];
      const to = rangeMatch[3];
      tooltip = `Repeats every ${weekday} from ${from} to ${to}`;
      normalized = `${weekday} from ${from} to ${to}`;
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
      normalized = norm;
      tooltip = `Repeats on ${norm}`;
    }
    // Add recurring icon, highlight, and tooltip for better visibility
    return `<span class="repeat-link" data-repeat="${normalized}" title="${tooltip}" style="background:rgba(255, 242, 59, 0.2);border-radius:4px;padding:0 3px;">${recurringIcon} ${match}</span>`;
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
  let total = 0, completed = 0;
  for (let i = startIdx + 1; i < endIdx; i++) {
    const taskMatch = lines[i].trim().match(/^[-*]\s*\[([xX ])\]/);
    if (taskMatch) {
      total++;
      if (taskMatch[1].trim().toLowerCase() === 'x') {
        completed++;
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
  const nextGoalIndex = lines.findIndex((line, index) => index > goalLineIndex && line.trim().startsWith('GOAL:'));
  const relevantLines = lines.slice(goalLineIndex + 1, nextGoalIndex !== -1 ? nextGoalIndex : undefined);
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
    // --- Automatic Progress Handling (if no manual progress line was handled) ---
  const checkboxMatches = contentForThisGoal.match(/^[-*]\s*\[([xX ])\]/gm);
  if (checkboxMatches && checkboxMatches.length > 0) {
    const completed = checkboxMatches.filter(cb => cb.match(/\[[xX]\]/i)).length;
    let target = checkboxMatches.length;
    if (targetNumber && targetNumber > target) target = targetNumber;
    analysis = {
      type: 'checklist',
      current: completed,
      target: target,
      percentage: Math.round((completed / target) * 100),
      status: completed >= target ? 'completed' : 'in-progress',
      details: `${completed}/${target} items completed` + (deadlineStatus ? ` (${deadlineStatus.details})` : '')
    };
    if (deadlineStatus) {
      analysis.status = completed >= target ? 'completed' : deadlineStatus.status;
    }
    return analysis;
  }
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
};
