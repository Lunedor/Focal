// js/mainWidget.js
// Centralized Main Widget Logic for Focal Journal
// Supports: finance, calorie, workouts, sleep, and more

const MainWidget = (() => {
    // --- CONFIGURATION ---
    const widgetConfigs = {
        finance: {
            title: 'Finance',
            currency: 'USD',
            fields: ['amount', 'category', 'date', 'note'],
            summary: true,
            chart: true,
            pie: true,
        },
        calorie: {
            title: 'Calorie Tracker',
            unit: 'kcal',
            fields: ['date', 'item', 'kcal', 'note'],
            summary: true,
            chart: true,
            pie: false,
        },
        workouts: {
            title: 'Workouts',
            fields: ['date', 'exercise', 'duration', 'note'],
            summary: true,
            chart: true,
            pie: false,
        },
        sleep: {
            title: 'Sleep Tracker',
            fields: ['date', 'hours', 'quality', 'note'],
            summary: true,
            chart: true,
            pie: false,
        },
        // Add more types as needed
    };

    // --- STATE ---
    let state = {
        type: 'finance',
        command: '',
        data: [],
        config: widgetConfigs.finance,
        onCommandChange: null,
        containerEl: null,
    };

    // --- PARSER ---
    function parseCommand(commandStr, type) {
        // Remove prefix and parse config
        let config = widgetConfigs[type] || widgetConfigs.finance;
        let lines = commandStr.split('\n').map(l => l.trim()).filter(Boolean);
        // For finance: FINANCE: summary+chart, USD, this-year
        // For calorie: CALORIE: summary+chart, kcal, this-week
        // For others: WORKOUTS: ...
        let settings = {};
        if (lines.length > 0) {
            let firstLine = lines[0];
            let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
            settings.layout = parts[0] || 'summary';
            settings.unit = parts[1] || config.currency || config.unit || '';
            settings.period = parts[2] || 'all';
        }
        return { config, settings };
    }

    function parseData(dataStr, type) {
        // Parse data lines according to widget type
        let config = widgetConfigs[type] || widgetConfigs.finance;
        let lines = dataStr.split('\n').map(l => l.trim()).filter(Boolean);
        let data = lines.map(line => {
            // Remove leading dash for all widget types
            if (line.startsWith('- ')) line = line.slice(2).trim();
            let parts = line.split(',').map(p => p.trim());
            let obj = {};
            if (type === 'finance') {
                // Map: date, description, amount, category
                obj.date = parts[0] || '';
                obj.amount = parts[2] || '';
                obj.category = parts[3] || '';
                obj.note = parts[1] || '';
                obj.date = obj.date ? new Date(obj.date) : '';
            } else if (type === 'calorie') {
                // Map: date, item, kcal, note
                obj.date = parts[0] || '';
                obj.item = parts[1] || '';
                obj.kcal = parts[2] || '';
                obj.note = parts[3] || '';
                if (obj.date) obj.date = new Date(obj.date);
            } else {
                // For other widgets, map fields in order
                config.fields.forEach((field, idx) => {
                    obj[field] = parts[idx] || '';
                });
                if (obj.date) obj.date = new Date(obj.date);
            }
            return obj;
        });
        return data;
    }

    // --- RENDER ---
    // --- NEW: Renderers for independent widget features ---
function renderSummary(container, type, command, dataStr, onCommandChange, storageKey) {
        // Use the universal widget renderer but only enable summary, table, add, filter, modal (no chart, no pie)
        const widgetInstanceId = 'summary-' + Math.random().toString(36).substr(2, 9);
        // Parse config and data
        const config = widgetConfigs[type] || widgetConfigs.finance;
        const data = parseData(dataStr, type);
        const { settings } = MainWidget.parseCommand(command, type);
        let unit = settings.unit || config.currency || config.unit || '';
        // Parse filter from command string
        let filterRange = (() => {
            let lines = command.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) {
                let firstLine = lines[0];
                let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
                return parts[2] || 'all';
            }
            return 'all';
        })();
        const now = new Date();
        const filterOptions = [
            { label: 'All Time', value: 'all' },
            { label: 'This Month', value: 'this-month' },
            { label: 'This Year', value: 'this-year' },
            { label: 'Last 3 Months', value: 'last-3-months' },
            { label: 'Last 6 Months', value: 'last-6-months' },
            { label: 'Last 12 Months', value: 'last-12-months' }
        ];
        function filterEntries(range) {
            if (!range || range === 'all') return data;
            return data.filter(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return false;
                if (range === 'this-month') {
                    return e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth();
                } else if (range === 'this-year') {
                    return e.date.getFullYear() === now.getFullYear();
                } else if (range === 'last-3-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                    return e.date >= past;
                } else if (range === 'last-6-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                    return e.date >= past;
                } else if (range === 'last-12-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
                    return e.date >= past;
                }
                return true;
            });
        }
        // filteredEntries is already declared below, so just log after its declaration
        // --- SUMMARY LOGIC (per widget type) ---
        let summary = {};
        const filteredEntries = filterEntries(filterRange);
        if (type === 'finance') {
            summary.income = filteredEntries.filter(e => parseFloat(e.amount) > 0).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            summary.expenses = filteredEntries.filter(e => parseFloat(e.amount) < 0).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            summary.net = summary.income + summary.expenses;
        } else if (type === 'calorie') {
            // All values are in e.kcal, positive for intake, negative for burned
            summary.intake = filteredEntries.filter(e => parseFloat(e.kcal) > 0).reduce((sum, e) => sum + parseFloat(e.kcal), 0);
            summary.burn = filteredEntries.filter(e => parseFloat(e.kcal) < 0).reduce((sum, e) => sum + Math.abs(parseFloat(e.kcal)), 0);
            summary.net = summary.intake - summary.burn;
        } else if (type === 'workouts') {
            summary.total = filteredEntries.filter(e => parseFloat(e.duration) > 0).reduce((sum, e) => sum + parseFloat(e.duration), 0);
        } else if (type === 'sleep') {
            summary.hours = filteredEntries.filter(e => parseFloat(e.hours) > 0).reduce((sum, e) => sum + parseFloat(e.hours), 0);
            summary.avgQuality = filteredEntries.length ? (filteredEntries.reduce((sum, e) => sum + parseFloat(e.quality || 0), 0) / filteredEntries.length) : 0;
        }
        // --- SUMMARY CARDS (per widget type) ---
        // DRY summary card logic
        const summaryCardConfigs = {
            finance: [
                { key: 'income', label: 'Income', class: 'income', value: s => `${unit}${(s.income || 0).toFixed(2)}` },
                { key: 'expenses', label: 'Expenses', class: 'expense', value: s => `${unit}${Math.abs(s.expenses || 0).toFixed(2)}` },
                { key: 'net', label: 'Net', class: 'net', value: s => `${s.net >= 0 ? '+' : '-'}${unit}${Math.abs(s.net || 0).toFixed(2)}` }
            ],
            calorie: [
                { key: 'intake', label: 'Intake', class: 'income', value: s => `${unit}${(s.intake || 0).toFixed(0)}` },
                { key: 'burn', label: 'Burned', class: 'expense', value: s => `${unit}${(s.burn || 0).toFixed(0)}` },
                { key: 'net', label: 'Net', class: 'net', value: s => `${s.net >= 0 ? '+' : '-'}${unit}${Math.abs(s.net || 0).toFixed(0)}` }
            ],
            workouts: [
                { key: 'total', label: 'Total Duration', class: 'income', value: s => `${(s.total || 0).toFixed(1)} min` }
            ],
            sleep: [
                { key: 'hours', label: 'Total Hours', class: 'income', value: s => `${(s.hours || 0).toFixed(1)} h` },
                { key: 'avgQuality', label: 'Avg Quality', class: 'net', value: s => `${(s.avgQuality || 0).toFixed(1)} / 10` }
            ]
        };
        const cardConfig = summaryCardConfigs[type] || [];
        let summaryCardsHtml = '';
        if (cardConfig.length) {
            summaryCardsHtml = `
                <div class="finance-summary-cards">
                    ${cardConfig.map(card => `
                        <div class="finance-card ${card.class}">
                            <div class="finance-card-label">${card.label}</div>
                            <div class="finance-card-value">${card.value(summary)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        // --- ENTRY TABLE (DRY for all widget types) ---
        function getEntriesHtml(filtered) {
            if (filtered.length === 0) return '';
            // Add remove button to each row
            // All widget types: add remove button to each row
            return filtered.map((e, idx) => {
                let rowHtml = '';
                if (type === 'finance') {
                    const amountClass = parseFloat(e.amount) > 0 ? 'income' : 'expense';
                    rowHtml = `
                        <tr class="finance-transaction-row" data-entry-idx="${idx}">
                            <td>${e.date instanceof Date && !isNaN(e.date) ? window.dateFns.format(e.date, 'MMM d') : e.date}</td>
                            <td>${e.note || ''}</td>
                            <td>${e.category || ''}</td>
                            <td class="${amountClass}">${unit}${parseFloat(e.amount).toFixed(2)}</td>
                            <td><button class="entry-remove-btn" title="Remove Entry">✕</button></td>
                        </tr>
                    `;
                } else {
                    rowHtml = `
                        <tr data-entry-idx="${idx}">
                            ${config.fields.map((field, fidx) => {
                                if (field === 'date') {
                                    const val = e[field];
                                    if (val instanceof Date && !isNaN(val)) {
                                        return `<td>${window.dateFns.format(val, 'MMM d')}</td>`;
                                    } else {
                                        return `<td>${val}</td>`;
                                    }
                                } else {
                                    return `<td>${e[field] !== undefined ? e[field] : ''}</td>`;
                                }
                            }).join('')}
                            <td><button class="entry-remove-btn" title="Remove Entry">✕</button></td>
                        </tr>
                    `;
                }
                return rowHtml;
            }).join('');
        }
        function renderEntryTable() {
            let headers = [];
            if (type === 'finance') headers = ['Date', 'Description', 'Category', 'Amount', ''];
            else if (type === 'calorie') headers = ['Date', 'Entries', 'Kcal', 'Note', ''];
            else headers = config.fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)).concat(['']);
            return `
                <div class="finance-transaction-list">
                    <h3 class="finance-widget-subtitle">Recent Entries</h3>
                    <div class="finance-transaction-table-container">
                        <table>
                            <thead>
                                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                            </thead>
                            <tbody>${getEntriesHtml(filteredEntries)}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        // --- FILTER DROPDOWN ---
        function renderFilterDropdown() {
            const selectedOption = filterOptions.find(opt => opt.value === filterRange) || filterOptions[0];
            return `
                <div class="finance-filter-dropdown" tabindex="-1">
                    <button type="button" class="finance-filter-btn" id="summary-filter-btn-${widgetInstanceId}" tabindex="0">${selectedOption.label} <span class="dropdown-arrow">▼</span></button>
                    <div class="finance-filter-list" id="summary-filter-list-${widgetInstanceId}">
                        ${filterOptions.map(opt => `<div class="finance-filter-item${filterRange === opt.value ? ' selected' : ''}" data-range="${opt.value}" tabindex="0">${opt.label}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        // --- ADD BUTTON ---
        function renderAddButton() {
            return `<button type="button" class="finance-add-button" id="finance-add-btn" title="Add New Entry" tabindex="0">+ New Entry</button>`;
        }
        // --- HEADER ---
        function renderHeader() {
            return `
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">${config.title}</h3>
                    <div class="finance-widget-controls">
                        ${renderAddButton()}
                        ${renderFilterDropdown()}
                    </div>
                </div>
            `;
        }
        // --- MODAL (per widget type) ---
        function renderModal() {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;
            if (type === 'finance') {
                const commonCategories = [
                    'Salary', 'Groceries', 'Rent', 'Utilities', 'Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Travel', 'Education', 'Insurance', 'Gifts', 'Other'
                ];
                const userCategories = Array.from(new Set(data.map(t => t.category).filter(cat => cat && !commonCategories.includes(cat))));
                return `
                    <div class="modal-overlay" id="finance-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="finance-modal-title">Add Financial Entry</h3>
                                <button id="finance-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="finance-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label>Transaction Type</label>
                                        <div class="finance-entry-type">
                                            <input type="radio" id="income-type" name="entryType" value="income" checked>
                                            <label for="income-type" class="income">Income</label>
                                            <input type="radio" id="expense-type" name="entryType" value="expense">
                                            <label for="expense-type" class="expense">Expense</label>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="finance-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="finance-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="finance-entry-description">Description</label>
                                        <input type="text" id="finance-entry-description" placeholder="e.g., Salary, Groceries, Rent" required>
                                    </div>
                                    <div class="finance-form-row">
                                        <div class="finance-form-group">
                                            <label for="finance-entry-amount">Amount</label>
                                            <input type="number" id="finance-entry-amount" step="0.01" min="0.01" placeholder="0.00" required>
                                        </div>
                                        <div class="finance-form-group">
                                            <label for="finance-entry-category">Category</label>
                                            <select id="finance-entry-category" required>
                                                <option value="" disabled selected>Select category...</option>
                                                <optgroup label="Common Categories">
                                                    ${commonCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                                </optgroup>
                                                ${userCategories.length > 0 ? `<optgroup label="Your Categories">${userCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}</optgroup>` : ''}
                                                <option value="__custom__">Custom...</option>
                                            </select>
                                            <input type="text" id="finance-entry-category-custom" placeholder="Enter custom category..." />
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="finance-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="finance-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (type === 'calorie') {
                return `
                    <div class="modal-overlay" id="calorie-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="calorie-modal-title">Add Calorie Entry</h3>
                                <button id="calorie-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="calorie-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label for="calorie-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="calorie-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="calorie-entry-item">Entry</label>
                                        <input type="text" id="calorie-entry-item" placeholder="e.g., Apple, Pizza" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="calorie-entry-value">Calories (+ for intake, - for burned)</label>
                                        <input type="number" id="calorie-entry-value" step="1" placeholder="e.g., 250 or -100" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="calorie-entry-note">Note</label>
                                        <input type="text" id="calorie-entry-note" placeholder="e.g., Breakfast, Running">
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="calorie-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="calorie-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (type === 'workouts') {
                return `
                    <div class="modal-overlay" id="workouts-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="workouts-modal-title">Add Workout Entry</h3>
                                <button id="workouts-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="workouts-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="workouts-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-exercise">Exercise</label>
                                        <input type="text" id="workouts-entry-exercise" placeholder="e.g., Running, Yoga" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-duration">Duration (min)</label>
                                        <input type="number" id="workouts-entry-duration" step="1" min="1" placeholder="0" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-note">Note</label>
                                        <input type="text" id="workouts-entry-note" placeholder="e.g., Felt great" required>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="workouts-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="workouts-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (type === 'sleep') {
                return `
                    <div class="modal-overlay" id="sleep-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="sleep-modal-title">Add Sleep Entry</h3>
                                <button id="sleep-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="sleep-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="sleep-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-hours">Hours Slept</label>
                                        <input type="number" id="sleep-entry-hours" step="0.1" min="0" placeholder="0.0" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-quality">Quality (0-10)</label>
                                        <input type="number" id="sleep-entry-quality" step="0.1" min="0" max="10" placeholder="0.0" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-note">Note</label>
                                        <input type="text" id="sleep-entry-note" placeholder="e.g., Restless night" required>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="sleep-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="sleep-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            }
            return '';
        }
        // --- FINAL RENDER ---
        container.innerHTML = `
            <div class="finance-widget" id="main-finance-widget-root-${widgetInstanceId}">
                ${renderHeader()}
                ${summaryCardsHtml}
                ${renderEntryTable()}
                ${renderModal()}
            </div>
        `;
        // --- EVENT HANDLERS (unified for all widgets) ---
        const widgetRoot = container.querySelector(`#main-finance-widget-root-${widgetInstanceId}`);
        if (widgetRoot) {
            widgetRoot.addEventListener('mousedown', e => { e.stopPropagation(); });
            widgetRoot.addEventListener('click', e => { e.stopPropagation(); });
        }
        if (window.feather) window.feather.replace();
        // Filter dropdown
        const filterBtn = container.querySelector(`#summary-filter-btn-${widgetInstanceId}`);
        const filterList = container.querySelector(`#summary-filter-list-${widgetInstanceId}`);
        if (filterBtn && filterList) {
            filterBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
            });
            filterList.querySelectorAll('.finance-filter-item').forEach(item => {
                item.addEventListener('mousedown', e => {
                    e.stopPropagation();
                    e.preventDefault();
                    filterRange = item.dataset.range;
                    // Update command string with new filter
                    let commandLines = command.split('\n');
                    if (commandLines.length === 0) commandLines.push('FINANCE: summary, USD, all');
                    // Update the period in the first line
                    let firstLine = commandLines[0];
                    let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
                    if (parts.length < 3) {
                        while (parts.length < 3) parts.push('');
                    }
                    parts[2] = filterRange;
                    commandLines[0] = (firstLine.match(/^[A-Z]+:/i) ? firstLine.match(/^[A-Z]+:/i)[0] : 'FINANCE:') + ' ' + parts.join(', ');
                    let newCommand = commandLines.join('\n');
                    if (typeof onCommandChange === 'function') {
                        onCommandChange(newCommand);
                    }
                    // Re-render widget with new filter
                    renderSummary(container, type, newCommand, dataStr, onCommandChange);
                });
            });
            setTimeout(() => {
                document.addEventListener('mousedown', function handler(e) {
                    if (!filterBtn.contains(e.target) && !filterList.contains(e.target)) {
                        filterList.style.display = 'none';
                        document.removeEventListener('mousedown', handler);
                    }
                });
            }, 0);
        }
        // Remove entry button logic with confirm modal
        const tableBody = container.querySelector('.finance-transaction-table-container tbody');
        if (tableBody) {
            tableBody.querySelectorAll('tr').forEach((row, idx) => {
                const removeBtn = row.querySelector('.entry-remove-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        // Use the same confirm modal as habit widget
                        if (window.HabitTracker && typeof window.HabitTracker.showCustomConfirm === 'function') {
                            window.HabitTracker.showCustomConfirm('Are you sure you want to remove this entry?', () => {
                                // Find the index in filteredEntries
                                const entryIdx = idx;
                                // Combine command and dataStr to reconstruct the full block
                                let commandLines = [command, ...dataStr.split('\n').filter(Boolean)];
                                let dataLines = commandLines.slice(1);
                                let filtered = filterEntries(filterRange);
                                let entryToRemove = filtered[entryIdx];
                                // Find the string line for this entry (robust match)
                                let idxToRemove = -1;
                                for (let i = 0; i < dataLines.length; i++) {
                                    let rawLine = dataLines[i];
                                    let parsed = parseData(rawLine, type)[0];
                                    let match = false;
                                    if (type === 'finance') {
                                        let d1 = (parsed.date instanceof Date && !isNaN(parsed.date)) ? parsed.date.toISOString() : (parsed.date + '').trim();
                                        let d2 = (entryToRemove.date instanceof Date && !isNaN(entryToRemove.date)) ? entryToRemove.date.toISOString() : (entryToRemove.date + '').trim();
                                        let amt1 = (parsed.amount + '').trim();
                                        let amt2 = (entryToRemove.amount + '').trim();
                                        let cat1 = (parsed.category + '').trim();
                                        let cat2 = (entryToRemove.category + '').trim();
                                        let note1 = (parsed.note + '').trim();
                                        let note2 = (entryToRemove.note + '').trim();
                                        match = (
                                            d1 === d2 &&
                                            amt1 === amt2 &&
                                            cat1 === cat2 &&
                                            note1 === note2
                                        );
                                    } else {
                                        match = config.fields.every(f => {
                                            if (f === 'date') {
                                                let d1 = (parsed[f] instanceof Date && !isNaN(parsed[f])) ? parsed[f].toISOString() : (parsed[f] + '').trim();
                                                let d2 = (entryToRemove[f] instanceof Date && !isNaN(entryToRemove[f])) ? entryToRemove[f].toISOString() : (entryToRemove[f] + '').trim();
                                                return d1 === d2;
                                            }
                                            return (parsed[f] + '').trim() === (entryToRemove[f] + '').trim();
                                        });
                                    }
                                    if (match) {
                                        idxToRemove = i + 1; // +1 because first line is command
                                        break;
                                    }
                                }
                                if (idxToRemove > 0) {
                                    commandLines.splice(idxToRemove, 1);
                                    let newCommand = commandLines.join('\n');
                                    // Persist to storage and re-render app
                                    if (typeof window.setStorage === 'function' && storageKey) {
                                        window.setStorage(storageKey, newCommand);
                                    }
                                    if (typeof window.renderApp === 'function') {
                                        window.renderApp();
                                    }
                                    if (typeof onCommandChange === 'function') {
                                        onCommandChange(newCommand);
                                    }
                                }
                            });
                        } else {
                            // fallback: no confirm, just remove
                            const entryIdx = idx;
                            let commandLines = [command, ...dataStr.split('\n').filter(Boolean)];
                            let dataLines = commandLines.slice(1);
                            let filtered = filterEntries(filterRange);
                            let entryToRemove = filtered[entryIdx];
                            let idxToRemove = -1;
                            for (let i = 0; i < dataLines.length; i++) {
                                let rawLine = dataLines[i];
                                let parsed = parseData(rawLine, type)[0];
                                let match = false;
                                if (type === 'finance') {
                                    let d1 = (parsed.date instanceof Date && !isNaN(parsed.date)) ? parsed.date.toISOString() : (parsed.date + '').trim();
                                    let d2 = (entryToRemove.date instanceof Date && !isNaN(entryToRemove.date)) ? entryToRemove.date.toISOString() : (entryToRemove.date + '').trim();
                                    let amt1 = (parsed.amount + '').trim();
                                    let amt2 = (entryToRemove.amount + '').trim();
                                    let cat1 = (parsed.category + '').trim();
                                    let cat2 = (entryToRemove.category + '').trim();
                                    let note1 = (parsed.note + '').trim();
                                    let note2 = (entryToRemove.note + '').trim();
                                    match = (
                                        d1 === d2 &&
                                        amt1 === amt2 &&
                                        cat1 === cat2 &&
                                        note1 === note2
                                    );
                                } else {
                                    match = config.fields.every(f => {
                                        if (f === 'date') {
                                            let d1 = (parsed[f] instanceof Date && !isNaN(parsed[f])) ? parsed[f].toISOString() : (parsed[f] + '').trim();
                                            let d2 = (entryToRemove[f] instanceof Date && !isNaN(entryToRemove[f])) ? entryToRemove[f].toISOString() : (entryToRemove[f] + '').trim();
                                            return d1 === d2;
                                        }
                                        return (parsed[f] + '').trim() === (entryToRemove[f] + '').trim();
                                    });
                                }
                                if (match) {
                                    idxToRemove = i + 1;
                                    break;
                                }
                            }
                            if (idxToRemove > 0) {
                                commandLines.splice(idxToRemove, 1);
                                let newCommand = commandLines.join('\n');
                                if (typeof window.setStorage === 'function' && storageKey) {
                                    window.setStorage(storageKey, newCommand);
                                }
                                if (typeof window.renderApp === 'function') {
                                    window.renderApp();
                                }
                                if (typeof onCommandChange === 'function') {
                                    onCommandChange(newCommand);
                                }
                            }
                        }
                    });
                }
            });
        }
        // Add button/modal logic (per widget type)
        const addBtn = container.querySelector('#finance-add-btn');
        const modal = container.querySelector('.modal-overlay');
        if (addBtn && modal) {
            addBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                modal.classList.add('active');
            });
        }
        // Modal close/cancel
        const closeBtn = modal ? modal.querySelector('.modal-close') : null;
        const cancelBtn = modal ? modal.querySelector('.modal-btn.secondary') : null;
        if (closeBtn && modal) closeBtn.addEventListener('click', () => { modal.classList.remove('active'); });
        if (cancelBtn && modal) cancelBtn.addEventListener('click', () => { modal.classList.remove('active'); });
        // Modal confirm (add entry, per widget type)
        const confirmBtn = modal ? modal.querySelector('.modal-btn.primary') : null;
        if (confirmBtn && modal) {
            confirmBtn.addEventListener('click', e => {
                e.preventDefault();
                if (type === 'finance') {
                    const form = modal.querySelector('#finance-entry-form');
                    const typeVal = form.querySelector('input[name="entryType"]:checked').value;
                    const date = form.querySelector('#finance-entry-date').value;
                    const note = form.querySelector('#finance-entry-description').value;
                    const amount = form.querySelector('#finance-entry-amount').value;
                    let category = form.querySelector('#finance-entry-category').value;
                    const customCat = form.querySelector('#finance-entry-category-custom').value;
                    if (category === '__custom__') category = customCat;
                    if (!date || !note || !amount || !category) return;
                    const amt = typeVal === 'income' ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount));
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const newLine = `- ${formattedDate}, ${note}, ${amt}, ${category}`;
                    let commandLines = command.split('\n');
                    if (commandLines.length === 0) commandLines.push('FINANCE: summary, USD, all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof onCommandChange === 'function') {
                        onCommandChange(newCommand);
                    }
                    modal.classList.remove('active');
                } else if (type === 'calorie') {
                    const form = modal.querySelector('#calorie-entry-form');
                    const date = form.querySelector('#calorie-entry-date').value;
                    const item = form.querySelector('#calorie-entry-item').value;
                    const value = form.querySelector('#calorie-entry-value').value;
                    const note = form.querySelector('#calorie-entry-note').value;
                    if (!date || !item || !value) return;
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const valueNum = Number(value);
                    const noteVal = note ? note : '';
                    const newLine = `- ${formattedDate}, ${item}, ${valueNum}, ${noteVal}`;
                    let commandLines = command.split('\n');
                    if (commandLines.length === 0) commandLines.push('CALORIE: summary, kcal, all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof onCommandChange === 'function') {
                        onCommandChange(newCommand);
                    }
                    modal.classList.remove('active');
                } else if (type === 'workouts') {
                    const form = modal.querySelector('#workouts-entry-form');
                    const date = form.querySelector('#workouts-entry-date').value;
                    const exercise = form.querySelector('#workouts-entry-exercise').value;
                    const duration = form.querySelector('#workouts-entry-duration').value;
                    const note = form.querySelector('#workouts-entry-note').value;
                    if (!date || !exercise || !duration || !note) return;
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const newLine = `- ${formattedDate}, ${exercise}, ${duration}, ${note}`;
                    let commandLines = command.split('\n');
                    if (commandLines.length === 0) commandLines.push('WORKOUTS: summary, , all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof onCommandChange === 'function') {
                        onCommandChange(newCommand);
                    }
                    modal.classList.remove('active');
                } else if (type === 'sleep') {
                    const form = modal.querySelector('#sleep-entry-form');
                    const date = form.querySelector('#sleep-entry-date').value;
                    const hours = form.querySelector('#sleep-entry-hours').value;
                    const quality = form.querySelector('#sleep-entry-quality').value;
                    const note = form.querySelector('#sleep-entry-note').value;
                    if (!date || !hours || !quality || !note) return;
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const newLine = `- ${formattedDate}, ${hours}, ${quality}, ${note}`;
                    let commandLines = command.split('\n');
                    if (commandLines.length === 0) commandLines.push('SLEEP: summary, , all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof onCommandChange === 'function') {
                        onCommandChange(newCommand);
                    }
                    modal.classList.remove('active');
                }
            });
        }
    }

    function renderChart(container, type, command, dataStr, onCommandChange) {
        const widgetInstanceId = 'chart-' + Math.random().toString(36).substr(2, 9);
        const config = widgetConfigs[type] || widgetConfigs.finance;
        const data = parseData(dataStr, type);
        const { settings } = MainWidget.parseCommand(command, type);
        let unit = settings.unit || config.currency || config.unit || '';
        // Parse filter from command string
        let filterRange = (() => {
            let lines = command.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) {
                let firstLine = lines[0];
                let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
                return parts[2] || 'all';
            }
            return 'all';
        })();
        const now = new Date();
        const filterOptions = [
            { label: 'All Time', value: 'all' },
            { label: 'This Month', value: 'this-month' },
            { label: 'This Year', value: 'this-year' },
            { label: 'Last 3 Months', value: 'last-3-months' },
            { label: 'Last 6 Months', value: 'last-6-months' },
            { label: 'Last 12 Months', value: 'last-12-months' }
        ];
        function filterEntries(range) {
            if (!range || range === 'all') return data;
            return data.filter(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return false;
                if (range === 'this-month') {
                    return e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth();
                } else if (range === 'this-year') {
                    return e.date.getFullYear() === now.getFullYear();
                } else if (range === 'last-3-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                    return e.date >= past;
                } else if (range === 'last-6-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                    return e.date >= past;
                } else if (range === 'last-12-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
                    return e.date >= past;
                }
                return true;
            });
        }
        let chartData = null;
        const filteredEntries = filterEntries(filterRange);
        if (type === 'finance') {
            const byMonth = {};
            filteredEntries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const ym = e.date.getFullYear() + '-' + String(e.date.getMonth() + 1).padStart(2, '0');
                if (!byMonth[ym]) byMonth[ym] = { income: 0, expenses: 0 };
                if (parseFloat(e.amount) > 0) byMonth[ym].income += parseFloat(e.amount);
                else byMonth[ym].expenses += Math.abs(parseFloat(e.amount));
            });
            const labels = Object.keys(byMonth).sort();
            chartData = {
                labels,
                datasets: [
                    { label: 'Income', data: labels.map(l => byMonth[l].income), backgroundColor: '#4CAF50' },
                    { label: 'Expenses', data: labels.map(l => byMonth[l].expenses), backgroundColor: '#F44336' }
                ]
            };
        } else if (type === 'calorie') {
            // Aggregate by day: intake (positive), burned (negative)
            const byDay = {};
            filteredEntries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const d = e.date.toISOString().slice(0, 10);
                if (!byDay[d]) byDay[d] = { intake: 0, burn: 0 };
                const kcal = parseFloat(e.kcal) || 0;
                if (kcal >= 0) byDay[d].intake += kcal;
                else byDay[d].burn += Math.abs(kcal);
            });
            const labels = Object.keys(byDay).sort();
            chartData = {
                labels,
                datasets: [
                    { label: 'Intake', data: labels.map(l => byDay[l].intake), backgroundColor: '#4CAF50' },
                    { label: 'Burned', data: labels.map(l => byDay[l].burn), backgroundColor: '#F44336' }
                ]
            };
        } else if (type === 'workouts') {
            const byDay = {};
            filteredEntries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const d = e.date.toISOString().slice(0, 10);
                if (!byDay[d]) byDay[d] = 0;
                byDay[d] += parseFloat(e.duration) || 0;
            });
            const labels = Object.keys(byDay).sort();
            chartData = {
                labels,
                datasets: [
                    { label: 'Duration', data: labels.map(l => byDay[l]), backgroundColor: '#2196F3' }
                ]
            };
        } else if (type === 'sleep') {
            const byDay = {};
            filteredEntries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const d = e.date.toISOString().slice(0, 10);
                if (!byDay[d]) byDay[d] = { hours: 0, quality: 0, count: 0 };
                byDay[d].hours += parseFloat(e.hours) || 0;
                byDay[d].quality += parseFloat(e.quality) || 0;
                byDay[d].count += 1;
            });
            const labels = Object.keys(byDay).sort();
            chartData = {
                labels,
                datasets: [
                    { label: 'Hours', data: labels.map(l => byDay[l].hours), backgroundColor: '#4CAF50' },
                    { label: 'Avg Quality', data: labels.map(l => byDay[l].count ? byDay[l].quality / byDay[l].count : 0), backgroundColor: '#FF9800' }
                ]
            };
        }
        function renderFilterDropdown() {
            const selectedOption = filterOptions.find(opt => opt.value === filterRange) || filterOptions[0];
            return `
                <div class="finance-filter-dropdown" tabindex="-1">
                    <button type="button" class="finance-filter-btn" id="chart-filter-btn-${widgetInstanceId}" tabindex="0">${selectedOption.label} <span class="dropdown-arrow">▼</span></button>
                    <div class="finance-filter-list" id="chart-filter-list-${widgetInstanceId}">
                        ${filterOptions.map(opt => `<div class="finance-filter-item${filterRange === opt.value ? ' selected' : ''}" data-range="${opt.value}" tabindex="0">${opt.label}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        container.innerHTML = `
            <div class="finance-widget-chart" id="chart-widget-root-${widgetInstanceId}">
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">${config.title} Chart</h3>
                    <div class="finance-widget-controls">
                        ${renderFilterDropdown()}
                    </div>
                </div>
                <div class="finance-chart-container"><canvas id="chart-canvas-${widgetInstanceId}"></canvas></div>
            </div>
        `;
        // Prevent event propagation to parent (edit mode, etc)
        const chartRoot = container.querySelector(`#chart-widget-root-${widgetInstanceId}`);
        if (chartRoot) {
            ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend'].forEach(evt => {
                chartRoot.addEventListener(evt, e => { e.stopPropagation(); });
            });
        }
        // Chart.js rendering
        const ctx = container.querySelector(`#chart-canvas-${widgetInstanceId}`);
        if (ctx && window.Chart && chartData) {
            new window.Chart(ctx, {
                type: 'bar',
                data: chartData,
                options: {
                    responsive: true,
                    plugins: { legend: { display: true } },
                    scales: { x: { beginAtZero: true }, y: { beginAtZero: true } }
                }
            });
        }
        // Filter dropdown event
        const filterBtn = container.querySelector(`#chart-filter-btn-${widgetInstanceId}`);
        const filterList = container.querySelector(`#chart-filter-list-${widgetInstanceId}`);
        if (filterBtn && filterList) {
            filterBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
            });
            filterList.querySelectorAll('.finance-filter-item').forEach(item => {
                item.addEventListener('mousedown', e => {
                    e.stopPropagation();
                    e.preventDefault();
                    filterRange = item.dataset.range;
                    // Update command string with new filter
                    let commandLines = command.split('\n');
                    if (commandLines.length === 0) commandLines.push('FINANCE: summary+chart, USD, all');
                    // Update the period in the first line
                    let firstLine = commandLines[0];
                    let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
                    if (parts.length < 3) {
                        while (parts.length < 3) parts.push('');
                    }
                    parts[2] = filterRange;
                    commandLines[0] = (firstLine.match(/^[A-Z]+:/i) ? firstLine.match(/^[A-Z]+:/i)[0] : 'FINANCE:') + ' ' + parts.join(', ');
                    let newCommand = commandLines.join('\n');
                    if (typeof onCommandChange === 'function') {
                        onCommandChange(newCommand);
                    }
                    // Re-render widget with new filter
                    renderChart(container, type, newCommand, dataStr, onCommandChange);
                });
            });
            setTimeout(() => {
                document.addEventListener('mousedown', function handler(e) {
                    if (!filterBtn.contains(e.target) && !filterList.contains(e.target)) {
                        filterList.style.display = 'none';
                        document.removeEventListener('mousedown', handler);
                    }
                });
            }, 0);
        }
    }

    function renderPie(container, type, command, dataStr, onCommandChange) {
        const widgetInstanceId = 'pie-' + Math.random().toString(36).substr(2, 9);
        const config = widgetConfigs[type] || widgetConfigs.finance;
        const data = parseData(dataStr, type);
        const { settings } = MainWidget.parseCommand(command, type);
        let unit = settings.unit || config.currency || config.unit || '';
        // Parse filter from command string
        let filterRange = (() => {
            let lines = command.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 0) {
                let firstLine = lines[0];
                let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
                return parts[2] || 'all';
            }
            return 'all';
        })();
        const now = new Date();
        const filterOptions = [
            { label: 'All Time', value: 'all' },
            { label: 'This Month', value: 'this-month' },
            { label: 'This Year', value: 'this-year' },
            { label: 'Last 3 Months', value: 'last-3-months' },
            { label: 'Last 6 Months', value: 'last-6-months' },
            { label: 'Last 12 Months', value: 'last-12-months' }
        ];
        function filterEntries(range) {
            if (!range || range === 'all') return data;
            return data.filter(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return false;
                if (range === 'this-month') {
                    return e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth();
                } else if (range === 'this-year') {
                    return e.date.getFullYear() === now.getFullYear();
                } else if (range === 'last-3-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                    return e.date >= past;
                } else if (range === 'last-6-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
                    return e.date >= past;
                } else if (range === 'last-12-months') {
                    const past = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
                    return e.date >= past;
                }
                return true;
            });
        }
        let pieData = null;
        const filteredEntries = filterEntries(filterRange);
        if (type === 'finance') {
            const expensesByCategory = filteredEntries.filter(e => parseFloat(e.amount) < 0).reduce((acc, e) => {
                const cat = e.category || 'Uncategorized';
                acc[cat] = (acc[cat] || 0) + Math.abs(parseFloat(e.amount));
                return acc;
            }, {});
            const pieColors = [
                '#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0',
                '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'
            ];
            const cats = Object.keys(expensesByCategory);
            pieData = {
                labels: cats,
                datasets: [{
                    data: cats.map(c => expensesByCategory[c]),
                    backgroundColor: cats.map((c, i) => pieColors[i % pieColors.length])
                }]
            };
        }
        function renderFilterDropdown() {
            const selectedOption = filterOptions.find(opt => opt.value === filterRange) || filterOptions[0];
            return `
                <div class="finance-filter-dropdown" tabindex="-1">
                    <button type="button" class="finance-filter-btn" id="pie-filter-btn-${widgetInstanceId}" tabindex="0">${selectedOption.label} <span class="dropdown-arrow">▼</span></button>
                    <div class="finance-filter-list" id="pie-filter-list-${widgetInstanceId}">
                        ${filterOptions.map(opt => `<div class="finance-filter-item${filterRange === opt.value ? ' selected' : ''}" data-range="${opt.value}" tabindex="0">${opt.label}</div>`).join('')}
                    </div>
                </div>
            `;
        }
        container.innerHTML = `
            <div class="finance-widget-pie" id="pie-widget-root-${widgetInstanceId}">
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">${config.title} Pie Chart</h3>
                    <div class="finance-widget-controls">
                        ${renderFilterDropdown()}
                    </div>
                </div>
                <div class="finance-pie-container"><canvas id="pie-canvas-${widgetInstanceId}"></canvas></div>
            </div>
        `;
        // Prevent event propagation to parent (edit mode, etc)
        const pieRoot = container.querySelector(`#pie-widget-root-${widgetInstanceId}`);
        if (pieRoot) {
            ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend'].forEach(evt => {
                pieRoot.addEventListener(evt, e => { e.stopPropagation(); });
            });
        }
        // Chart.js rendering
        const ctx = container.querySelector(`#pie-canvas-${widgetInstanceId}`);
        if (ctx && window.Chart && pieData) {
            new window.Chart(ctx, {
                type: 'pie',
                data: pieData,
                options: {
                    responsive: true,
                    plugins: { legend: { display: true } }
                }
            });
        }
        // Filter dropdown event
        const filterBtn = container.querySelector(`#pie-filter-btn-${widgetInstanceId}`);
        const filterList = container.querySelector(`#pie-filter-list-${widgetInstanceId}`);
        if (filterBtn && filterList) {
            filterBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
            });
            filterList.querySelectorAll('.finance-filter-item').forEach(item => {
                item.addEventListener('mousedown', e => {
                    e.stopPropagation();
                    e.preventDefault();
                    filterRange = item.dataset.range;
                    // Update command string with new filter
                    let commandLines = command.split('\n');
                    if (commandLines.length === 0) commandLines.push('FINANCE: summary+chartpie, USD, all');
                    // Update the period in the first line
                    let firstLine = commandLines[0];
                    let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
                    if (parts.length < 3) {
                        while (parts.length < 3) parts.push('');
                    }
                    parts[2] = filterRange;
                    commandLines[0] = (firstLine.match(/^[A-Z]+:/i) ? firstLine.match(/^[A-Z]+:/i)[0] : 'FINANCE:') + ' ' + parts.join(', ');
                    let newCommand = commandLines.join('\n');
                    if (typeof onCommandChange === 'function') {
                        onCommandChange(newCommand);
                    }
                    // Re-render widget with new filter
                    renderPie(container, type, newCommand, dataStr, onCommandChange);
                });
            });
            setTimeout(() => {
                document.addEventListener('mousedown', function handler(e) {
                    if (!filterBtn.contains(e.target) && !filterList.contains(e.target)) {
                        filterList.style.display = 'none';
                        document.removeEventListener('mousedown', handler);
                    }
                });
            }, 0);
        }
    }

    // Legacy: keep for compatibility, but now only renders all features stacked (not recommended)
    function render(container, type, command, dataStr, onCommandChange) {
        // For backward compatibility, render all features stacked
        renderSummary(container, type, command, dataStr, onCommandChange);
        renderChart(container, type, command, dataStr, onCommandChange);
        renderPie(container, type, command, dataStr, onCommandChange);
    }


    // --- UNIVERSAL WIDGET RENDERER (modular, config-driven) ---
    function renderUniversalWidget(container, widgetInstanceId) {
        // --- STATE ---
        let entries = state.data;
        const { settings } = MainWidget.parseCommand(state.command, state.type);
        let unit = settings.unit || state.config.currency || state.config.unit || '';
        if (typeof state.filterRange === 'undefined') state.filterRange = 'all';
        let filterRange = state.filterRange;
        const now = new Date();
        const filterOptions = [
            { label: 'All Time', value: 'all' },
            { label: 'This Month', value: 'month' },
            { label: 'This Year', value: 'year' },
            { label: 'Last 3 Months', value: '3m' },
            { label: 'Last 6 Months', value: '6m' },
            { label: 'Last 12 Months', value: '12m' }
        ];
        // Parse layout features (summary, chart, chartpie, table, etc)
        const layoutFeatures = (settings.layout || '').split('+').map(s => s.trim().toLowerCase());
        function hasFeature(f) { return layoutFeatures.includes(f); }
        function filterEntries(range) {
            if (!range || range === 'all') return entries;
            return entries.filter(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return false;
                if (range === 'month') {
                    return e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth();
                } else if (range === 'year') {
                    return e.date.getFullYear() === now.getFullYear();
                } else if (range.endsWith('m')) {
                    const months = parseInt(range);
                    const past = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
                    return e.date >= past;
                }
                return true;
            });
        }

        // --- SUMMARY LOGIC (per widget type) ---
        let summary = {};
        let breakdownHtml = '';
        let chartHtml = '';
        let pieHtml = '';
        const filteredEntries = filterEntries(filterRange);
        let chartData = null;
        let pieData = null;
        if (state.type === 'finance') {
            // Finance: income, expenses, net, category breakdown
            summary.income = filteredEntries.filter(e => parseFloat(e.amount) > 0).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            summary.expenses = filteredEntries.filter(e => parseFloat(e.amount) < 0).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            summary.net = summary.income + summary.expenses;
            // Category breakdown
            const expensesByCategory = filteredEntries.filter(e => parseFloat(e.amount) < 0).reduce((acc, e) => {
                const cat = e.category || 'Uncategorized';
                acc[cat] = (acc[cat] || 0) + Math.abs(parseFloat(e.amount));
                return acc;
            }, {});
            const totalExpenses = Math.abs(summary.expenses);
            const pieColors = [
                '#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0',
                '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'
            ];
            breakdownHtml = Object.entries(expensesByCategory).length ? `
                <div class="finance-category-breakdown">
                    <h3 class="finance-widget-subtitle">Spending by Category</h3>
                    ${Object.entries(expensesByCategory)
                        .sort(([, a], [, b]) => b - a)
                        .map(([category, amount], index) => {
                            const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                            const colorIndex = index % pieColors.length;
                            const color = pieColors[colorIndex];
                            return `
                                <div class="finance-category-bar-item">
                                    <div class="finance-category-color" style="background-color: ${color};"></div>
                                    <div class="finance-category-label">${category}</div>
                                    <div class="finance-category-bar">
                                        <div class="finance-category-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div>
                                    </div>
                                    <div class="finance-category-amount">${unit}${amount.toFixed(2)}</div>
                                </div>
                            `;
                        }).join('')}
                </div>
            ` : '';
            // Chart data: income/expenses over time (by month)
            if (hasFeature('chart')) {
                const byMonth = {};
                filteredEntries.forEach(e => {
                    if (!(e.date instanceof Date) || isNaN(e.date)) return;
                    const ym = e.date.getFullYear() + '-' + String(e.date.getMonth() + 1).padStart(2, '0');
                    if (!byMonth[ym]) byMonth[ym] = { income: 0, expenses: 0 };
                    if (parseFloat(e.amount) > 0) byMonth[ym].income += parseFloat(e.amount);
                    else byMonth[ym].expenses += Math.abs(parseFloat(e.amount));
                });
                const labels = Object.keys(byMonth).sort();
                chartData = {
                    labels,
                    datasets: [
                        { label: 'Income', data: labels.map(l => byMonth[l].income), backgroundColor: '#4CAF50' },
                        { label: 'Expenses', data: labels.map(l => byMonth[l].expenses), backgroundColor: '#F44336' }
                    ]
                };
                chartHtml = `<div class="finance-chart-container"><canvas id="finance-bar-chart-${widgetInstanceId}"></canvas></div>`;
            }
            // Pie data: category breakdown
            if (hasFeature('chartpie')) {
                const cats = Object.keys(expensesByCategory);
                pieData = {
                    labels: cats,
                    datasets: [{
                        data: cats.map(c => expensesByCategory[c]),
                        backgroundColor: cats.map((c, i) => pieColors[i % pieColors.length])
                    }]
                };
                pieHtml = `<div class="finance-pie-container"><canvas id="finance-pie-chart-${widgetInstanceId}"></canvas></div>`;
            }
        } else if (state.type === 'calorie') {
            summary.intake = filteredEntries.filter(e => parseFloat(e.intake) > 0).reduce((sum, e) => sum + parseFloat(e.intake), 0);
            summary.burn = filteredEntries.filter(e => parseFloat(e.burn) > 0).reduce((sum, e) => sum + parseFloat(e.burn), 0);
            summary.net = summary.intake - summary.burn;
            if (hasFeature('chart')) {
                const byDay = {};
                filteredEntries.forEach(e => {
                    if (!(e.date instanceof Date) || isNaN(e.date)) return;
                    const d = e.date.toISOString().slice(0, 10);
                    if (!byDay[d]) byDay[d] = { intake: 0, burn: 0 };
                    byDay[d].intake += parseFloat(e.intake) || 0;
                    byDay[d].burn += parseFloat(e.burn) || 0;
                });
                const labels = Object.keys(byDay).sort();
                chartData = {
                    labels,
                    datasets: [
                        { label: 'Intake', data: labels.map(l => byDay[l].intake), backgroundColor: '#4CAF50' },
                        { label: 'Burned', data: labels.map(l => byDay[l].burn), backgroundColor: '#F44336' }
                    ]
                };
                chartHtml = `<div class="finance-chart-container"><canvas id="calorie-bar-chart-${widgetInstanceId}"></canvas></div>`;
            }
        } else if (state.type === 'workouts') {
            summary.total = filteredEntries.filter(e => parseFloat(e.duration) > 0).reduce((sum, e) => sum + parseFloat(e.duration), 0);
            if (hasFeature('chart')) {
                const byDay = {};
                filteredEntries.forEach(e => {
                    if (!(e.date instanceof Date) || isNaN(e.date)) return;
                    const d = e.date.toISOString().slice(0, 10);
                    if (!byDay[d]) byDay[d] = 0;
                    byDay[d] += parseFloat(e.duration) || 0;
                });
                const labels = Object.keys(byDay).sort();
                chartData = {
                    labels,
                    datasets: [
                        { label: 'Duration', data: labels.map(l => byDay[l]), backgroundColor: '#2196F3' }
                    ]
                };
                chartHtml = `<div class="finance-chart-container"><canvas id="workouts-bar-chart-${widgetInstanceId}"></canvas></div>`;
            }
        } else if (state.type === 'sleep') {
            summary.hours = filteredEntries.filter(e => parseFloat(e.hours) > 0).reduce((sum, e) => sum + parseFloat(e.hours), 0);
            summary.avgQuality = filteredEntries.length ? (filteredEntries.reduce((sum, e) => sum + parseFloat(e.quality || 0), 0) / filteredEntries.length) : 0;
            if (hasFeature('chart')) {
                const byDay = {};
                filteredEntries.forEach(e => {
                    if (!(e.date instanceof Date) || isNaN(e.date)) return;
                    const d = e.date.toISOString().slice(0, 10);
                    if (!byDay[d]) byDay[d] = { hours: 0, quality: 0, count: 0 };
                    byDay[d].hours += parseFloat(e.hours) || 0;
                    byDay[d].quality += parseFloat(e.quality) || 0;
                    byDay[d].count += 1;
                });
                const labels = Object.keys(byDay).sort();
                chartData = {
                    labels,
                    datasets: [
                        { label: 'Hours', data: labels.map(l => byDay[l].hours), backgroundColor: '#4CAF50' },
                        { label: 'Avg Quality', data: labels.map(l => byDay[l].count ? byDay[l].quality / byDay[l].count : 0), backgroundColor: '#FF9800' }
                    ]
                };
                chartHtml = `<div class="finance-chart-container"><canvas id="sleep-bar-chart-${widgetInstanceId}"></canvas></div>`;
            }
        }

        // DRY summary card logic for all widget types
        const summaryCardConfigs = {
            finance: [
                { key: 'income', label: 'Income', class: 'income', value: s => `${unit}${(s.income || 0).toFixed(2)}` },
                { key: 'expenses', label: 'Expenses', class: 'expense', value: s => `${unit}${Math.abs(s.expenses || 0).toFixed(2)}` },
                { key: 'net', label: 'Net', class: 'net', value: s => `${s.net >= 0 ? '+' : '-'}${unit}${Math.abs(s.net || 0).toFixed(2)}` }
            ],
            calorie: [
                { key: 'intake', label: 'Intake', class: 'income', value: s => `${unit}${(s.intake || 0).toFixed(0)}` },
                { key: 'burn', label: 'Burned', class: 'expense', value: s => `${unit}${(s.burn || 0).toFixed(0)}` },
                { key: 'net', label: 'Net', class: 'net', value: s => `${s.net >= 0 ? '+' : '-'}${unit}${Math.abs(s.net || 0).toFixed(0)}` }
            ],
            workouts: [
                { key: 'total', label: 'Total Duration', class: 'income', value: s => `${(s.total || 0).toFixed(1)} min` }
            ],
            sleep: [
                { key: 'hours', label: 'Total Hours', class: 'income', value: s => `${(s.hours || 0).toFixed(1)} h` },
                { key: 'avgQuality', label: 'Avg Quality', class: 'net', value: s => `${(s.avgQuality || 0).toFixed(1)} / 10` }
            ]
        };
        const cardConfig = summaryCardConfigs[state.type] || [];
        let summaryCardsHtml = '';
        if (cardConfig.length) {
            summaryCardsHtml = `
                <div class="finance-summary-cards">
                    ${cardConfig.map(card => `
                        <div class="finance-card ${card.class}">
                            <div class="finance-card-label">${card.label}</div>
                            <div class="finance-card-value">${card.value(summary)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // --- ENTRY TABLE ---
        function getEntriesHtml(filtered) {
            if (state.type === 'finance') {
                return filtered.map(e => {
                    const amountClass = parseFloat(e.amount) > 0 ? 'income' : 'expense';
                    return `
                        <tr class="finance-transaction-row">
                            <td>${e.date instanceof Date && !isNaN(e.date) ? window.dateFns.format(e.date, 'MMM d') : e.date}</td>
                            <td>${e.note || ''}</td>
                            <td>${e.category || ''}</td>
                            <td class="${amountClass}">${unit}${parseFloat(e.amount).toFixed(2)}</td>
                        </tr>
                    `;
                }).join('');
            } else if (state.type === 'calorie') {
                return filtered.map(e => `
                    <tr>
                        <td>${e.date instanceof Date && !isNaN(e.date) ? window.dateFns.format(e.date, 'MMM d') : e.date}</td>
                        <td>${e.intake || ''}</td>
                        <td>${e.burn || ''}</td>
                        <td>${e.note || ''}</td>
                    </tr>
                `).join('');
            } else if (state.type === 'workouts') {
                return filtered.map(e => `
                    <tr>
                        <td>${e.date instanceof Date && !isNaN(e.date) ? window.dateFns.format(e.date, 'MMM d') : e.date}</td>
                        <td>${e.exercise || ''}</td>
                        <td>${e.duration || ''}</td>
                        <td>${e.note || ''}</td>
                    </tr>
                `).join('');
            } else if (state.type === 'sleep') {
                return filtered.map(e => `
                    <tr>
                        <td>${e.date instanceof Date && !isNaN(e.date) ? window.dateFns.format(e.date, 'MMM d') : e.date}</td>
                        <td>${e.hours || ''}</td>
                        <td>${e.quality || ''}</td>
                        <td>${e.note || ''}</td>
                    </tr>
                `).join('');
            }
            return '';
        }

        function renderEntryTable() {
            let headers = [];
            if (state.type === 'finance') headers = ['Date', 'Description', 'Category', 'Amount'];
            else if (state.type === 'calorie') headers = ['Date', 'Entries', 'Kcal', 'Note'];
            else if (state.type === 'workouts') headers = ['Date', 'Exercise', 'Duration', 'Note'];
            else if (state.type === 'sleep') headers = ['Date', 'Hours', 'Quality', 'Note'];
            return `
                <div class="finance-transaction-list">
                    <h3 class="finance-widget-subtitle">Recent Entries</h3>
                    <div class="finance-transaction-table-container">
                        <table>
                            <thead>
                                <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                            </thead>
                            <tbody>${getEntriesHtml(filteredEntries)}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // --- FILTER DROPDOWN ---
        function renderFilterDropdown() {
            return `
                <div class="finance-filter-dropdown" tabindex="-1">
                    <button type="button" class="finance-filter-btn" id="finance-filter-btn" tabindex="0">${filterOptions.find(opt => opt.value === filterRange).label} <span class="dropdown-arrow">▼</span></button>
                    <div class="finance-filter-list" id="finance-filter-list">
                        ${filterOptions.map(opt => `<div class="finance-filter-item${filterRange === opt.value ? ' selected' : ''}" data-range="${opt.value}" tabindex="0">${opt.label}</div>`).join('')}
                    </div>
                </div>
            `;
        }

        // --- ADD BUTTON ---
        function renderAddButton() {
            return `<button type="button" class="finance-add-button" id="finance-add-btn" title="Add New Entry" tabindex="0">+ New Entry</button>`;
        }

        // --- HEADER ---
        function renderHeader() {
            return `
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">${state.config.title}</h3>
                    <div class="finance-widget-controls">
                        ${renderAddButton()}
                        ${renderFilterDropdown()}
                    </div>
                </div>
            `;
        }

        // --- MODAL (per widget type) ---
        function renderModal() {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const todayStr = `${yyyy}-${mm}-${dd}`;
            if (state.type === 'finance') {
                // ...existing code for finance modal...
                const commonCategories = [
                    'Salary', 'Groceries', 'Rent', 'Utilities', 'Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Travel', 'Education', 'Insurance', 'Gifts', 'Other'
                ];
                const userCategories = Array.from(new Set(state.data.map(t => t.category).filter(cat => cat && !commonCategories.includes(cat))));
                return `
                    <div class="modal-overlay" id="finance-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="finance-modal-title">Add Financial Entry</h3>
                                <button id="finance-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="finance-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label>Transaction Type</label>
                                        <div class="finance-entry-type">
                                            <input type="radio" id="income-type" name="entryType" value="income" checked>
                                            <label for="income-type" class="income">Income</label>
                                            <input type="radio" id="expense-type" name="entryType" value="expense">
                                            <label for="expense-type" class="expense">Expense</label>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="finance-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="finance-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="finance-entry-description">Description</label>
                                        <input type="text" id="finance-entry-description" placeholder="e.g., Salary, Groceries, Rent" required>
                                    </div>
                                    <div class="finance-form-row">
                                        <div class="finance-form-group">
                                            <label for="finance-entry-amount">Amount</label>
                                            <input type="number" id="finance-entry-amount" step="0.01" min="0.01" placeholder="0.00" required>
                                        </div>
                                        <div class="finance-form-group">
                                            <label for="finance-entry-category">Category</label>
                                            <select id="finance-entry-category" required>
                                                <option value="" disabled selected>Select category...</option>
                                                <optgroup label="Common Categories">
                                                    ${commonCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                                </optgroup>
                                                ${userCategories.length > 0 ? `<optgroup label="Your Categories">${userCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}</optgroup>` : ''}
                                                <option value="__custom__">Custom...</option>
                                            </select>
                                            <input type="text" id="finance-entry-category-custom" placeholder="Enter custom category..." />
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="finance-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="finance-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (state.type === 'calorie') {
                return `
                    <div class="modal-overlay" id="calorie-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="calorie-modal-title">Add Calorie Entry</h3>
                                <button id="calorie-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="calorie-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label for="calorie-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="calorie-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-row">
                                        <div class="finance-form-group">
                                            <label for="calorie-entry-intake">Burned (${unit})</label>
                                            <input type="number" id="calorie-entry-intake" step="1" min="0" placeholder="0" required>
                                        </div>
                                        <div class="finance-form-group">
                                            <label for="calorie-entry-burn">Intake (${unit})</label>
                                            <input type="number" id="calorie-entry-burn" step="1" min="0" placeholder="0" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="calorie-entry-note">Note</label>
                                        <input type="text" id="calorie-entry-note" placeholder="e.g., Breakfast, Running" required>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="calorie-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="calorie-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (state.type === 'workouts') {
                return `
                    <div class="modal-overlay" id="workouts-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="workouts-modal-title">Add Workout Entry</h3>
                                <button id="workouts-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="workouts-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="workouts-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-exercise">Exercise</label>
                                        <input type="text" id="workouts-entry-exercise" placeholder="e.g., Running, Yoga" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-duration">Duration (min)</label>
                                        <input type="number" id="workouts-entry-duration" step="1" min="1" placeholder="0" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="workouts-entry-note">Note</label>
                                        <input type="text" id="workouts-entry-note" placeholder="e.g., Felt great" required>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="workouts-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="workouts-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            } else if (state.type === 'sleep') {
                return `
                    <div class="modal-overlay" id="sleep-entry-modal">
                        <div class="modal">
                            <div class="modal-header">
                                <h3 id="sleep-modal-title">Add Sleep Entry</h3>
                                <button id="sleep-modal-close" class="modal-close">×</button>
                            </div>
                            <div class="modal-body">
                                <form id="sleep-entry-form" class="finance-entry-form">
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-date">Date</label>
                                        <div class="date-picker-container">
                                            <input type="date" id="sleep-entry-date" value="${todayStr}" required>
                                        </div>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-hours">Hours Slept</label>
                                        <input type="number" id="sleep-entry-hours" step="0.1" min="0" placeholder="0.0" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-quality">Quality (0-10)</label>
                                        <input type="number" id="sleep-entry-quality" step="0.1" min="0" max="10" placeholder="0.0" required>
                                    </div>
                                    <div class="finance-form-group">
                                        <label for="sleep-entry-note">Note</label>
                                        <input type="text" id="sleep-entry-note" placeholder="e.g., Restless night" required>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button id="sleep-modal-cancel" class="modal-btn secondary">Cancel</button>
                                <button id="sleep-modal-confirm" class="modal-btn primary">New Entry</button>
                            </div>
                        </div>
                    </div>
                `;
            }
            return '';
        }

        // --- FINAL RENDER ---
        container.innerHTML = `
            <div class="finance-widget" id="main-finance-widget-root-${widgetInstanceId}">
                ${renderHeader()}
                ${hasFeature('summary') ? summaryCardsHtml : ''}
                ${hasFeature('chart') ? chartHtml : ''}
                ${hasFeature('chartpie') ? pieHtml : ''}
                ${breakdownHtml}
                ${renderEntryTable()}
                ${renderModal()}
            </div>
        `;

        // --- CHART RENDERING (Chart.js) ---
        if (hasFeature('chart') && chartData) {
            let chartId = '';
            if (state.type === 'finance') chartId = `finance-bar-chart-${widgetInstanceId}`;
            else if (state.type === 'calorie') chartId = `calorie-bar-chart-${widgetInstanceId}`;
            else if (state.type === 'workouts') chartId = `workouts-bar-chart-${widgetInstanceId}`;
            else if (state.type === 'sleep') chartId = `sleep-bar-chart-${widgetInstanceId}`;
            const ctx = container.querySelector(`#${chartId}`);
            if (ctx && window.Chart) {
                new window.Chart(ctx, {
                    type: 'bar',
                    data: chartData,
                    options: {
                        responsive: true,
                        plugins: { legend: { display: true } },
                        scales: { x: { beginAtZero: true }, y: { beginAtZero: true } }
                    }
                });
            }
        }
        if (hasFeature('chartpie') && pieData) {
            const ctx = container.querySelector(`#finance-pie-chart-${widgetInstanceId}`);
            if (ctx && window.Chart) {
                new window.Chart(ctx, {
                    type: 'pie',
                    data: pieData,
                    options: {
                        responsive: true,
                        plugins: { legend: { display: true } }
                    }
                });
            }
        }

        // --- EVENT HANDLERS (unified for all widgets) ---
        const widgetRoot = container.querySelector(`#main-finance-widget-root-${widgetInstanceId}`);
        if (widgetRoot) {
            widgetRoot.addEventListener('mousedown', e => { e.stopPropagation(); });
            widgetRoot.addEventListener('click', e => { e.stopPropagation(); });
        }
        if (window.feather) window.feather.replace();

        // Filter dropdown
        const filterBtn = container.querySelector('#finance-filter-btn');
        const filterList = container.querySelector('#finance-filter-list');
        if (filterBtn && filterList) {
            filterBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
            });
            filterList.querySelectorAll('.finance-filter-item').forEach(item => {
                item.addEventListener('mousedown', e => {
                    e.stopPropagation();
                    e.preventDefault();
                    filterRange = item.dataset.range;
                    state.filterRange = filterRange;
                    // Persist filter selection in command string (if present)
                    let commandLines = state.command.split('\n');
                    if (commandLines.length > 0) {
                        let firstLine = commandLines[0];
                        let parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
                        if (parts.length < 3) { while (parts.length < 3) parts.push(''); }
                        let periodMap = {
                            'all': 'all',
                            'month': 'this-month',
                            'year': 'this-year',
                            '3m': 'last-3-months',
                            '6m': 'last-6-months',
                            '12m': 'last-12-months'
                        };
                        parts[2] = periodMap[filterRange] || 'all';
                        let newFirstLine = (firstLine.match(/^[A-Z]+:/i) ? firstLine.match(/^[A-Z]+:/i)[0] : (state.type.toUpperCase() + ':')) + ' ' + parts.join(', ');
                        commandLines[0] = newFirstLine;
                        let newCommand = commandLines.join('\n');
                        if (typeof state.onCommandChange === 'function') {
                            state.onCommandChange(newCommand);
                        }
                    }
                    renderUniversalWidget(container);
                });
            });
            setTimeout(() => {
                document.addEventListener('mousedown', function handler(e) {
                    if (!filterBtn.contains(e.target) && !filterList.contains(e.target)) {
                        filterList.style.display = 'none';
                        document.removeEventListener('mousedown', handler);
                    }
                });
            }, 0);
        }

        // Add button/modal logic (per widget type)
        const addBtn = container.querySelector('#finance-add-btn');
        const modal = container.querySelector('.modal-overlay');
        if (addBtn && modal) {
            addBtn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                modal.classList.add('active');
            });
        }
        // Modal close/cancel
        const closeBtn = modal ? modal.querySelector('.modal-close') : null;
        const cancelBtn = modal ? modal.querySelector('.modal-btn.secondary') : null;
        if (closeBtn && modal) closeBtn.addEventListener('click', () => { modal.classList.remove('active'); });
        if (cancelBtn && modal) cancelBtn.addEventListener('click', () => { modal.classList.remove('active'); });

        // Modal confirm (add entry, per widget type)
        const confirmBtn = modal ? modal.querySelector('.modal-btn.primary') : null;
        if (confirmBtn && modal) {
            confirmBtn.addEventListener('click', e => {
                e.preventDefault();
                if (state.type === 'finance') {
                    const form = modal.querySelector('#finance-entry-form');
                    const type = form.querySelector('input[name="entryType"]:checked').value;
                    const date = form.querySelector('#finance-entry-date').value;
                    const note = form.querySelector('#finance-entry-description').value;
                    const amount = form.querySelector('#finance-entry-amount').value;
                    let category = form.querySelector('#finance-entry-category').value;
                    const customCat = form.querySelector('#finance-entry-category-custom').value;
                    if (category === '__custom__') category = customCat;
                    if (!date || !note || !amount || !category) return;
                    const amt = type === 'income' ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount));
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const newLine = `- ${formattedDate}, ${note}, ${amt}, ${category}`;
                    let commandLines = state.command.split('\n');
                    if (commandLines.length === 0) commandLines.push('FINANCE: summary+chart, USD, all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof state.onCommandChange === 'function') {
                        state.onCommandChange(newCommand);
                    }
                    modal.style.display = 'none';
                } else if (state.type === 'calorie') {
                    const form = modal.querySelector('#calorie-entry-form');
                    const date = form.querySelector('#calorie-entry-date').value;
                    const intake = form.querySelector('#calorie-entry-intake').value;
                    const burn = form.querySelector('#calorie-entry-burn').value;
                    const note = form.querySelector('#calorie-entry-note').value;
                    if (!date || !intake || !burn || !note) return;
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const newLine = `- ${formattedDate}, ${intake}, ${burn}, ${note}`;
                    let commandLines = state.command.split('\n');
                    if (commandLines.length === 0) commandLines.push('CALORIE: summary+chart, kcal, all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof state.onCommandChange === 'function') {
                        state.onCommandChange(newCommand);
                    }
                    modal.style.display = 'none';
                } else if (state.type === 'workouts') {
                    const form = modal.querySelector('#workouts-entry-form');
                    const date = form.querySelector('#workouts-entry-date').value;
                    const exercise = form.querySelector('#workouts-entry-exercise').value;
                    const duration = form.querySelector('#workouts-entry-duration').value;
                    const note = form.querySelector('#workouts-entry-note').value;
                    if (!date || !exercise || !duration || !note) return;
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const newLine = `- ${formattedDate}, ${exercise}, ${duration}, ${note}`;
                    let commandLines = state.command.split('\n');
                    if (commandLines.length === 0) commandLines.push('WORKOUTS: summary+chart, , all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof state.onCommandChange === 'function') {
                        state.onCommandChange(newCommand);
                    }
                    modal.style.display = 'none';
                } else if (state.type === 'sleep') {
                    const form = modal.querySelector('#sleep-entry-form');
                    const date = form.querySelector('#sleep-entry-date').value;
                    const hours = form.querySelector('#sleep-entry-hours').value;
                    const quality = form.querySelector('#sleep-entry-quality').value;
                    const note = form.querySelector('#sleep-entry-note').value;
                    if (!date || !hours || !quality || !note) return;
                    const yyyy = date.slice(0, 4);
                    const mm = date.slice(5, 7);
                    const dd = date.slice(8, 10);
                    const formattedDate = `${yyyy}-${mm}-${dd}`;
                    const newLine = `- ${formattedDate}, ${hours}, ${quality}, ${note}`;
                    let commandLines = state.command.split('\n');
                    if (commandLines.length === 0) commandLines.push('SLEEP: summary+chart, , all');
                    commandLines.push(newLine);
                    let newCommand = commandLines.join('\n');
                    if (typeof state.onCommandChange === 'function') {
                        state.onCommandChange(newCommand);
                    }
                    modal.style.display = 'none';
                }
            });
        }
    }

    // --- GENERIC TABLE RENDERER (for other types) ---
    function renderGenericTable(container) {
        const tableEl = document.createElement('table');
        tableEl.className = 'main-widget-table';
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        state.config.fields.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        tableEl.appendChild(thead);
        const tbody = document.createElement('tbody');
        state.data.forEach(row => {
            const tr = document.createElement('tr');
            state.config.fields.forEach(field => {
                const td = document.createElement('td');
                td.textContent = row[field];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        tableEl.appendChild(tbody);
        container.appendChild(tableEl);
    }

    // --- API ---
    return {
        render, // legacy: renders all features stacked
        renderSummary,
        renderChart,
        renderPie,
        renderUniversalWidget,
        parseCommand,
        parseData,
        widgetConfigs,
        state
    };
})();

// Make globally available
window.MainWidget = MainWidget;
