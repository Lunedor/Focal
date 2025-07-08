// --- TOOLBAR SYSTEM ---

// Helper function to insert markdown syntax into a textarea
function insertMarkdown(textarea, { prefix, suffix = '' }) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalValue = textarea.value;
    const selectedText = originalValue.substring(start, end);

    if (prefix === '- [ ] ') {
        const lineStart = originalValue.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = originalValue.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = originalValue.length;
        const lines = originalValue.substring(lineStart, lineEnd).split('\n');
        const toggledLines = lines.map(line => {
            if (/^[-*]\s*\[.\]\s/.test(line)) {
                return line.replace(/^[-*]\s*\[.\]\s/, '');
            } else {
                return prefix + line;
            }
        });
        const newText = toggledLines.join('\n');
        textarea.value =
            originalValue.substring(0, lineStart) +
            newText +
            originalValue.substring(lineEnd);
        textarea.focus();
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart + newText.length;
        return;
    }

    if ((prefix === '**' && suffix === '**') || (prefix === '*' && suffix === '*')) {
        if (!selectedText) {
            const newText = prefix + suffix;
            textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
            return;
        }
        const isBold = prefix === '**';
        const isItalic = prefix === '*';
        const lines = selectedText.split('\n');
        let allWrapped;
        if (isBold) {
            allWrapped = lines.every(line => /^\*\*.*\*\*$/.test(line));
        } else if (isItalic) {
            allWrapped = lines.every(line => /^\*.*\*$/.test(line));
        }
        let newText;
        if (allWrapped) {
            newText = lines.map(line => {
                if (isBold) return line.replace(/^\*\*(.*)\*\*$/, '$1');
                if (isItalic) return line.replace(/^\*(.*)\*$/, '$1');
                return line;
            }).join('\n');
        } else {
            newText = lines.map(line => {
                if (!line) return line;
                if (isBold && /^\*\*.*\*\*$/.test(line)) return line;
                if (isItalic && /^\*.*\*$/.test(line)) return line;
                return prefix + line + suffix;
            }).join('\n');
        }
        textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
        textarea.focus();
        textarea.selectionStart = start;
        textarea.selectionEnd = start + newText.length;
        return;
    }

    const newText = prefix + selectedText + suffix;
    textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
    textarea.focus();
    if (selectedText) {
        textarea.selectionStart = start + prefix.length;
        textarea.selectionEnd = start + prefix.length + selectedText.length;
    } else {
        textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
    }
}

// --- Centralized Edit Mode Manager ---
const EditModeManager = {
    currentEditWrapper: null,
    
    enter(wrapper, key, content, options = {}) {
        if (this.currentEditWrapper && this.currentEditWrapper !== wrapper) {
            this.exit(this.currentEditWrapper);
        }
        this.currentEditWrapper = wrapper;
        const toolbar = document.createElement('div');
        toolbar.className = 'markdown-toolbar';

        let buttons = options.buttons || [
            { icon: 'check-square', action: 'task', title: 'Add Checkbox', md: { prefix: '- [ ] ' } },
            { icon: 'bold', action: 'bold', title: 'Bold', md: { prefix: '**', suffix: '**' } },
            { icon: 'italic', action: 'italic', title: 'Italic', md: { prefix: '*', suffix: '*' } },
            { icon: 'link', action: 'link', title: 'Wiki Link', md: { prefix: '[[', suffix: ']]' } },
            { icon: 'minus', action: 'hr', title: 'Horizontal Rule', md: { prefix: '\n---\n' } },
            { icon: 'hash', action: 'h1', title: 'Heading 1', md: { prefix: '# ' } },
        ];
        
        if (key && key.startsWith('page-')) {
            buttons = [
                { icon: 'list', action: 'tasks', title: 'Insert TASKS:', md: { prefix: 'TASKS:\n' } },
                { icon: 'target', action: 'goal', title: 'Insert GOAL:', md: { prefix: 'GOAL: ' } },
                { icon: 'bar-chart-2', action: 'progress', title: 'Insert PROGRESS: []', md: { prefix: 'PROGRESS: []' } },
                { icon: 'dollar-sign', action: 'finance', title: 'Insert Finance Tracker', md: null },
                { icon: 'smile', action: 'mood', title: 'Insert Mood Tracker', md: null },
                { icon: 'book-open', action: 'books', title: 'Insert Book Tracker', md: null },
                { icon: 'film', action: 'movies', title: 'Insert Movie Tracker', md: null },
                { separator: true },
                { icon: 'clock', action: 'scheduled', title: 'Insert (SCHEDULED: )', md: { prefix: '(SCHEDULED: )' } },
                { icon: 'repeat', action: 'repeat', title: 'Insert (REPEAT: )', md: { prefix: '(REPEAT: )' } },
                { icon: 'bell', action: 'notify', title: 'Insert (NOTIFY: )', md: { prefix: '(NOTIFY: )' } },
                { separator: true },
                { icon: 'calendar', action: 'custom-date', title: 'Insert Date/Time', md: null },
                { separator: true },
                ...buttons
            ];
        }

        // Split buttons into two rows
        const row1 = buttons.slice(0, 10);
        const row2 = buttons.slice(10);

        function renderRow(row) {
            return `<div class="toolbar-row">` +
                row.map(btn => {
                    if (btn.separator) {
                        return '<span class="toolbar-separator" style="display:inline-block;width:1px;height:22px;background:var(--color-border,#eee);margin:0 6px;vertical-align:middle;"></span>';
                    }
                    return `<button class="toolbar-btn" data-action="${btn.action}" title="${btn.title}">
                        <i data-feather="${btn.icon}"></i>
                    </button>`;
                }).join('') +
                `</div>`;
        }

        toolbar.innerHTML = renderRow(row1) + renderRow(row2);
        toolbar.querySelectorAll('button').forEach(btn => btn.tabIndex = -1);
        
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.spellcheck = false;
        
        wrapper.innerHTML = '';
        wrapper.appendChild(toolbar);
        wrapper.appendChild(textarea);
        
        if (window.feather) feather.replace();
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        
        // Store the key both in appState and directly on the wrapper for redundancy
        appState.activeEditorKey = key;
        wrapper.dataset.key = key;
        
        // Attach toolbar event listeners
        this.attachToolbarListeners(toolbar, textarea, wrapper, buttons);
        
        // Handle keyboard shortcuts
        textarea.addEventListener('keydown', e => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                this.exit(wrapper);
            }
        });
        
        // Handle outside clicks
        setTimeout(() => {
            document.addEventListener('mousedown', this.handleOutsideClick.bind(this, wrapper), true);
        }, 0);
        
        // Set up exit function
        wrapper._exitEditMode = () => {
            const prevValue = getStorage(key);
            const newValue = textarea.value;
            // Only save and sync if content changed
            if (prevValue !== newValue) {
                setStorage(key, newValue);
                debouncedSyncWithCloud();
            }
            appState.activeEditorKey = null;
            document.removeEventListener('mousedown', this.handleOutsideClick.bind(this, wrapper), true);
            
            if (typeof renderLibraryPage === 'function' && key.startsWith('page-')) {
                renderLibraryPage(key.substring(5));
            } else if (key.match(/^\d{4}-W\d{1,2}-/)) {
                updatePlannerDay(key);
            } else {
                wrapper.innerHTML = parseMarkdown(newValue);
            }
            this.currentEditWrapper = null;
        };
    },
    
    exit(wrapper) {
        if (wrapper && wrapper._exitEditMode) {
            wrapper._exitEditMode();
            delete wrapper._exitEditMode;
        }
    },
    
    handleOutsideClick(wrapper, ev) {
        if (wrapper.contains(ev.target)) return;
        const toolbar = wrapper.querySelector('.markdown-toolbar');
        if (toolbar && toolbar.contains(ev.target)) return;
        this.exit(wrapper);
    },
    
    attachToolbarListeners(toolbar, textarea, wrapper, buttons) {
        toolbar.addEventListener('click', (evt) => {
            const button = evt.target.closest('button');
            if (!button) return;
            evt.preventDefault();
            evt.stopPropagation();
            
            const action = button.dataset.action;
            const buttonConfig = buttons.find(b => b.action === action);
            
            // Handle widget dropdowns
            if (action === 'finance') {
                this.handleFinanceDropdown(button, textarea, wrapper);
                return;
            }
            
            if (action === 'mood') {
                this.handleMoodDropdown(button, textarea, wrapper);
                return;
            }
            
            if (action === 'books') {
                this.handleBooksDropdown(button, textarea, wrapper);
                return;
            }
            
            if (action === 'movies') {
                this.handleMoviesDropdown(button, textarea, wrapper);
                return;
            }
            
            if (action === 'custom-date') {
                this.handleCustomDateDropdown(button, textarea, wrapper);
                return;
            }
            
            // Handle regular markdown buttons
            if (buttonConfig && buttonConfig.md) {
                insertMarkdown(textarea, buttonConfig.md);
            }
        });
    },
    
    handleFinanceDropdown(button, textarea, wrapper) {
        // Import from widgetDropdowns.js
        if (typeof createFinanceDropdown === 'function') {
            createFinanceDropdown(button, textarea, wrapper);
        }
    },
    
    handleMoodDropdown(button, textarea, wrapper) {
        // Import from widgetDropdowns.js
        if (typeof createMoodDropdown === 'function') {
            createMoodDropdown(button, textarea, wrapper);
        }
    },
    
    handleBooksDropdown(button, textarea, wrapper) {
        // Import from widgetDropdowns.js
        if (typeof createBooksDropdown === 'function') {
            createBooksDropdown(button, textarea, wrapper);
        }
    },
    
    handleMoviesDropdown(button, textarea, wrapper) {
        // Import from widgetDropdowns.js
        if (typeof createMoviesDropdown === 'function') {
            createMoviesDropdown(button, textarea, wrapper);
        }
    },
    
    handleCustomDateDropdown(button, textarea, wrapper) {
        // Use centralized date picker
        if (typeof CentralizedDatePicker !== 'undefined') {
            CentralizedDatePicker.showToolbarDatePicker({ 
                anchor: button, 
                withTime: false,
                onDateSelected: (result) => {
                    if (result) {
                        const { date, time, withTime } = result;
                        let dateTimeString = date;
                        if (withTime && time) {
                            dateTimeString += ' ' + time;
                        }
                        insertMarkdown(textarea, { prefix: dateTimeString });
                    }
                }
            });
        } else if (typeof createCustomDateDropdown === 'function') {
            // Fallback to old method
            createCustomDateDropdown(button, textarea, wrapper);
        }
    }
};

// Make it globally available
window.EditModeManager = EditModeManager;
window.insertMarkdown = insertMarkdown;
