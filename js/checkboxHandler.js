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

// Initialize checkbox handlers
function initializeCheckboxHandlers() {
    setupCheckboxHandlers();
    setupTableCheckboxes();
}

// Make functions globally available
window.initializeCheckboxHandlers = initializeCheckboxHandlers;
window.setupTableCheckboxes = setupTableCheckboxes;
window.handleCheckboxClick = handleCheckboxClick;
