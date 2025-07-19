// --- TOOLBAR SYSTEM ---

// Helper function to insert markdown syntax into a textarea
function insertMarkdown(textarea, { prefix, suffix = '' }) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalValue = textarea.value;
    const selectedText = originalValue.substring(start, end);

    // Special handling for (SCHEDULED: ), (REPEAT: ), (NOTIFY: ), PROGRESS: []
    const cursorInMiddleCases = [
        { prefix: '(SCHEDULED: ', suffix: ')' },
        { prefix: '(REPEAT: ', suffix: ')' },
        { prefix: '(NOTIFY: ', suffix: ')' },
        { prefix: 'PROGRESS: [', suffix: ']' }
    ];
    const matchCase = cursorInMiddleCases.find(
        c => prefix === c.prefix && suffix === c.suffix
    );
    if (matchCase && !selectedText) {
        const newText = prefix + suffix;
        textarea.value = originalValue.substring(0, start) + newText + originalValue.substring(end);
        textarea.focus();
        // Place cursor between the parentheses/brackets
        textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
        return;
    }
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
            { icon: 'smile', action: 'emoji', title: 'Insert Emoji', md: null },
        ];

        if (key && key.startsWith('page-')) {
            buttons = [
                ...buttons,
                { separator: true },
                { icon: 'send', action: 'ai-syntax', title: 'AI Syntax Assistant', md: null },
                { separator: true },
                { icon: 'list', action: 'tasks', title: 'Insert TASKS:', md: { prefix: 'TASKS:\n' } },
                { icon: 'target', action: 'goal', title: 'Insert GOAL:', md: { prefix: 'GOAL: ' } },
                { icon: 'percent', action: 'progress', title: 'Insert PROGRESS: []', md: { prefix: 'PROGRESS: [', suffix: ']' } },
                { icon: 'message-square', action: 'prompt', title: 'Insert Prompt', md: { prefix: 'PROMPT: ' } },
                { separator: true },
                { icon: 'clock', action: 'scheduled', title: 'Insert (SCHEDULED: )', md: { prefix: '(SCHEDULED: ', suffix: ')' } },
                { icon: 'repeat', action: 'repeat', title: 'Insert (REPEAT: )', md: { prefix: '(REPEAT: ', suffix: ')' } },
                { icon: 'bell', action: 'notify', title: 'Insert (NOTIFY: )', md: { prefix: '(NOTIFY: ', suffix: ')' } },
                { icon: 'calendar', action: 'custom-date', title: 'Insert Date/Time', md: null },
                { separator: true },
                { icon: 'bookmark', action: 'futurelog', title: 'Insert Future Log', md: null },
                { icon: 'rotate-cw', action: 'habit', title: 'Insert Habit Tracker', md: null },
                { icon: 'dollar-sign', action: 'finance', title: 'Insert Finance Tracker', md: null },
                { icon: 'pie-chart', action: 'calorie', title: 'Insert Calorie Tracker', md: null },
                { icon: 'moon', action: 'sleep', title: 'Insert Sleep Tracker', md: null },
                { icon: 'activity', action: 'workouts', title: 'Insert Workouts Tracker', md: null },
                { icon: 'bar-chart-2', action: 'mood', title: 'Insert Mood Tracker', md: null },
                { icon: 'grid', action: 'mindmap', title: 'Insert (MINDMAP: )', md: { prefix: 'MINDMAP: ' } },
                { icon: 'book-open', action: 'books', title: 'Insert Book Tracker', md: null },
                { icon: 'film', action: 'movies', title: 'Insert Movie Tracker', md: null },
                { separator: true },
            ];
        }

        // Split buttons into two rows
        const row1 = buttons.slice(0, 15);
        const row2 = buttons.slice(15);

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

        // Emoji Picker setup
        let emojiPicker;
        if (!document.getElementById('emoji-picker-element')) {
            emojiPicker = document.createElement('emoji-picker');
            emojiPicker.id = 'emoji-picker-element';
            emojiPicker.style.position = 'absolute';
            emojiPicker.style.zIndex = '1001';
            emojiPicker.style.display = 'none';
            emojiPicker.setAttribute('class', 'focal-emoji-picker');
            document.body.appendChild(emojiPicker);
        } else {
            emojiPicker = document.getElementById('emoji-picker-element');
        }

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
            // Prevent switching to render view after AI action
            // Only switch to render view if not in AI action
            if (!textarea.classList.contains('ai-active')) {
                if (typeof renderLibraryPage === 'function' && key.startsWith('page-')) {
                    renderLibraryPage(key.substring(5));
                } else if (key.match(/^\d{4}-W\d{1,2}-/)) {
                    updatePlannerDay(key);
                } else {
                    wrapper.innerHTML = parseMarkdown(newValue);
                }
                this.currentEditWrapper = null;
            }
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
        // Don't close edit mode if clicking on a dropdown or emoji picker
        if (ev.target.closest('.finance-dropdown, .mood-dropdown, .books-dropdown, .movies-dropdown, .futurelog-dropdown, .habit-dropdown, .date-dropdown, .fj-date-picker-popup, emoji-picker, .calorie-dropdown, .sleep-dropdown, .workouts-dropdown')) {
            return;
        }
        // Also check for shadow DOM of emoji-picker
        const emojiPicker = document.getElementById('emoji-picker-element');
        if (emojiPicker && (emojiPicker === ev.target || (emojiPicker.shadowRoot && emojiPicker.shadowRoot.contains(ev.target)))) {
            return;
        }
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

            // Centralized widget dropdown handler (identical for all)
            const centralizedWidgets = [
                'finance', 'calorie', 'sleep', 'workouts', 'mood', 'books', 'movies', 'futurelog', 'habit'
            ];
            if (centralizedWidgets.includes(action)) {
                if (typeof createCentralizedDropdown === 'function') {
                    createCentralizedDropdown(button, textarea, wrapper, action);
                }
                return;
            }


            if (action === 'custom-date') {
                this.handleCustomDateDropdown(button, textarea, wrapper);
                return;
            }

            // Add habit dropdown
            if (action === 'habit') {
                this.handleHabitDropdown(button, textarea, wrapper);
                return;
            }

            // AI Syntax Assistant
            if (action === 'ai-syntax') {
                if (window.showModal && window.promptGeminiSyntax) {
                    // Show modal, but do NOT exit edit mode when modal closes (AI only)
                    window.showModal('AI Syntax Assistant', 'Describe what you want to create...', '', { onlyCloseOverlay: true }).then((userPrompt) => {
                        if (userPrompt && userPrompt.trim()) {
                            // Show loading indicator (optional)
                            let infoMsg = wrapper.querySelector('.ai-info-msg');
                            if (!infoMsg) {
                                infoMsg = document.createElement('div');
                                infoMsg.className = 'ai-info-msg';
                                infoMsg.style = 'color: var(--color-accent, #007bff); margin-top: 6px; font-size: 0.95em;';
                                infoMsg.textContent = 'AI is generating syntax...';
                                wrapper.appendChild(infoMsg);
                            } else {
                                infoMsg.textContent = 'AI is generating syntax...';
                                infoMsg.style.display = '';
                            }
                            window.promptGeminiSyntax(userPrompt, (chunk, full) => {
                                // Append Gemini response to existing page data
                                if (wrapper && wrapper.dataset && wrapper.dataset.key) {
                                    const prevValue = getStorage(wrapper.dataset.key) || '';
                                    const newValue = prevValue.trim() + (prevValue.trim() ? '\n\n' : '') + full.trim();
                                    setStorage(wrapper.dataset.key, newValue);
                                    if (typeof renderApp === 'function') {
                                        renderApp();
                                    }
                                }
                                if (infoMsg) {
                                    infoMsg.textContent = 'AI syntax saved.';
                                    setTimeout(() => { infoMsg.style.display = 'none'; }, 2000);
                                }
                            }, (err) => {
                                if (infoMsg) {
                                    infoMsg.textContent = 'AI error.';
                                    setTimeout(() => { infoMsg.style.display = 'none'; }, 2000);
                                }
                            });
                        } else {
                            let infoMsg = wrapper.querySelector('.ai-info-msg');
                            if (infoMsg) infoMsg.style.display = 'none';
                        }
                    });
                } else {
                    alert('AI assistant not available.');
                }
                return;
            }
            // Emoji button logic
            if (action === 'emoji') {
                const emojiPicker = document.getElementById('emoji-picker-element');
                if (emojiPicker) {
                    emojiPicker.style.display = 'block';
                    // Use DropdownPositioning for smart placement
                    if (window.DropdownPositioning) {
                        window.DropdownPositioning.applySmartPosition(button, emojiPicker, { zIndex: 1001 });
                    } else {
                        // fallback: position below button
                        const rect = button.getBoundingClientRect();
                        emojiPicker.style.top = (rect.bottom + window.scrollY) + 'px';
                        emojiPicker.style.left = (rect.left + window.scrollX) + 'px';
                    }
                    emojiPicker.focus();
                    // Store reference to current textarea for emoji insertion
                    emojiPicker._activeTextarea = textarea;
                    // Prevent edit mode from closing when interacting with emoji picker
                    const stopEditModeClose = (ev) => {
                        if (emojiPicker.contains(ev.target)) {
                            ev.stopPropagation();
                        }
                    };
                    document.addEventListener('mousedown', stopEditModeClose, true);
                    // Hide picker on outside click (not on emoji picker)
                    const hidePicker = (ev) => {
                        if (!emojiPicker.contains(ev.target) && ev.target !== button) {
                            emojiPicker.style.display = 'none';
                            document.removeEventListener('mousedown', hidePicker, true);
                            document.removeEventListener('mousedown', stopEditModeClose, true);
                        }
                    };
                    document.addEventListener('mousedown', hidePicker, true);
                    // Only set handler once
                    if (!emojiPicker._emojiHandlerSet) {
                        emojiPicker.addEventListener('emoji-click', function (event) {
                            const emoji = event.detail.unicode;
                            const textarea = emojiPicker._activeTextarea;
                            if (textarea) {
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const value = textarea.value;
                                textarea.value = value.slice(0, start) + emoji + value.slice(end);
                                textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
                                textarea.focus();
                            }
                            emojiPicker.style.display = 'none';
                            document.removeEventListener('mousedown', hidePicker, true);
                            document.removeEventListener('mousedown', stopEditModeClose, true);
                        });
                        emojiPicker._emojiHandlerSet = true;
                    }
                }
                return;
            }
            // Handle regular markdown buttons
            if (buttonConfig && buttonConfig.md) {
                insertMarkdown(textarea, buttonConfig.md);
            }
        });
    },

    handleHabitDropdown(button, textarea, wrapper) {
        // Use centralized dropdown system for habits
        if (typeof createCentralizedDropdown === 'function') {
            createCentralizedDropdown(button, textarea, wrapper, 'habit');
        } else {
            // fallback: insert default markdown
            insertMarkdown(textarea, { prefix: 'HABITS: day' });
        }
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

    handleFuturelogDropdown(button, textarea, wrapper) {
        // Import from widgetDropdowns.js
        if (typeof createFuturelogDropdown === 'function') {
            createFuturelogDropdown(button, textarea, wrapper);
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
