// js/mainWidget.js
// Centralized Main Widget Logic for Focal Journal (Refactored for DRY principles)
// Supports: finance, calorie, workouts, sleep, and more

const MainWidget = (() => {
    // --- CONFIGURATION ---
    const widgetConfigs = {
        finance: {
            title: 'Finance',
            currency: 'USD',
            fields: ['date', 'note', 'amount', 'category'],
            summary: true, chart: true, pie: true,
            summaryCards: [
                { key: 'income', label: 'Income', class: 'income', value: (s, u) => `${u}${(s.income || 0).toFixed(2)}` },
                { key: 'expenses', label: 'Expenses', class: 'expense', value: (s, u) => `${u}${Math.abs(s.expenses || 0).toFixed(2)}` },
                { key: 'net', label: 'Net', class: 'net', value: (s, u) => `${s.net >= 0 ? '+' : '-'}${u}${Math.abs(s.net || 0).toFixed(2)}` }
            ],
            modalFields: [
                { name: 'entryType', label: 'Transaction Type', type: 'radio', options: [{label: 'Income', value: 'income'}, {label: 'Expense', value: 'expense'}], default: 'income' },
                { name: 'date', label: 'Date', type: 'date', required: true },
                { name: 'note', label: 'Description', type: 'text', placeholder: 'e.g., Salary, Groceries', required: true },
                { name: 'amount', label: 'Amount', type: 'number', step: '0.01', min: '0.01', placeholder: '0.00', required: true },
                { name: 'category', label: 'Category', type: 'select', options: ['Salary', 'Groceries', 'Rent', 'Utilities', 'Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Travel', 'Education', 'Insurance', 'Gifts', 'Other'], required: true }
            ]
        },
        calorie: {
            title: 'Calorie Tracker',
            unit: 'kcal',
            fields: ['date', 'item', 'kcal', 'note'],
            summary: true, chart: true, pie: false,
            summaryCards: [
                { key: 'intake', label: 'Intake', class: 'income', value: (s) => `${(s.intake || 0).toFixed(0)} kcal` },
                { key: 'target', label: 'Target', class: 'expense', value: (s) => `${(s.target || 2000).toFixed(0)} kcal` },
                { key: 'remaining', label: 'Remaining', class: 'net', value: (s) => `${Math.max((s.target || 2000) - (s.intake || 0), 0).toFixed(0)} kcal` }
            ],
            modalFields: [
                { name: 'date', label: 'Date', type: 'date', required: true },
                { name: 'item', label: 'Entry', type: 'text', placeholder: 'e.g., Apple, Pizza', required: true },
                { name: 'kcal', label: 'Calories (intake)', type: 'number', placeholder: 'e.g., 250', required: true },
                { name: 'note', label: 'Note', type: 'text', placeholder: 'e.g., Breakfast' }
            ]
        },
        workouts: {
            title: 'Workouts',
            fields: ['date', 'exercise', 'duration', 'note'],
            summary: true, chart: true, pie: false,
            summaryCards: [
                { key: 'total', label: 'Total Duration', class: 'income', value: s => `${(s.total || 0).toFixed(1)} min` }
            ],
            modalFields: [
                { name: 'date', label: 'Date', type: 'date', required: true },
                { name: 'exercise', label: 'Exercise', type: 'text', placeholder: 'e.g., Running, Yoga', required: true },
                { name: 'duration', label: 'Duration (min)', type: 'number', min: '1', placeholder: '0', required: true },
                { name: 'note', label: 'Note', type: 'text', placeholder: 'e.g., Felt great', required: true }
            ]
        },
        sleep: {
            title: 'Sleep Tracker',
            fields: ['date', 'hours', 'quality', 'note'],
            summary: true, chart: true, pie: false,
            summaryCards: [
                { key: 'hours', label: 'Total Hours', class: 'income', value: s => `${(s.hours || 0).toFixed(1)} h` },
                { key: 'avgQuality', label: 'Avg Quality', class: 'net', value: s => `${(s.avgQuality || 0).toFixed(1)} / 10` }
            ],
            modalFields: [
                { name: 'date', label: 'Date', type: 'date', required: true },
                { name: 'hours', label: 'Hours Slept', type: 'number', step: '0.1', min: '0', placeholder: '0.0', required: true },
                { name: 'quality', label: 'Quality (0-10)', type: 'number', step: '0.1', min: '0', max: '10', placeholder: '0.0', required: true },
                { name: 'note', label: 'Note', type: 'text', placeholder: 'e.g., Restless night', required: true }
            ]
        }
    };

    const filterOptions = [
        { label: 'All Time', value: 'all' }, { label: 'This Month', value: 'this-month' },
        { label: 'This Year', value: 'this-year' }, { label: 'Last 3 Months', value: 'last-3-months' },
        { label: 'Last 6 Months', value: 'last-6-months' }, { label: 'Last 12 Months', value: 'last-12-months' }
    ];

    const pieColors = ['#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'];

    // --- HELPERS ---
    // Helper: Parse target from command for calorie widget
    function getCalorieTargetFromCommand(commandStr) {
        const firstLine = (commandStr.split('\n')[0] || '').trim();
        const parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
        const target = parseInt(parts[1], 10);
        return isNaN(target) ? 2000 : target;
    }

    // --- PARSERS ---
    function parseCommand(commandStr, type) {
        const config = widgetConfigs[type] || widgetConfigs.finance;
        const firstLine = (commandStr.split('\n')[0] || '').trim();
        const parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
        const settings = {
            layout: (parts[0] || 'summary').split('+').map(s => s.trim().toLowerCase()),
            unit: parts[1] || config.currency || config.unit || '',
            period: parts[2] || 'all'
        };
        return { config, settings };
    }

    function parseData(dataStr, type) {
        const config = widgetConfigs[type] || widgetConfigs.finance;
        return dataStr.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
            if (line.startsWith('- ')) line = line.slice(2).trim();
            const parts = line.split(',').map(p => p.trim());
            const obj = {};
            config.fields.forEach((field, idx) => {
                obj[field] = parts[idx] || '';
            });
            if (obj.date) obj.date = new Date(obj.date);
            return obj;
        });
    }

    // --- DATA HELPERS ---
    function filterEntriesByPeriod(entries, period) {
        if (!period || period === 'all') return entries;
        const now = new Date();
        return entries.filter(e => {
            if (!(e.date instanceof Date) || isNaN(e.date)) return false;
            const monthsAgo = (m) => new Date(now.getFullYear(), now.getMonth() - m, now.getDate());
            switch (period) {
                case 'this-month': return e.date.getFullYear() === now.getFullYear() && e.date.getMonth() === now.getMonth();
                case 'this-year': return e.date.getFullYear() === now.getFullYear();
                case 'last-3-months': return e.date >= monthsAgo(3);
                case 'last-6-months': return e.date >= monthsAgo(6);
                case 'last-12-months': return e.date >= monthsAgo(12);
                default: return true;
            }
        });
    }

    function getSummaryData(entries, type) {
        const summary = {};
        if (type === 'finance') {
            summary.income = entries.filter(e => parseFloat(e.amount) > 0).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            summary.expenses = entries.filter(e => parseFloat(e.amount) < 0).reduce((sum, e) => sum + parseFloat(e.amount), 0);
            summary.net = summary.income + summary.expenses;
        } else if (type === 'calorie') {
            summary.intake = entries.filter(e => parseFloat(e.kcal) > 0).reduce((sum, e) => sum + parseFloat(e.kcal), 0);
            // Get target from config/settings if available, fallback to 2000
            let target = 2000;
            if (window.MainWidget && window.MainWidget._currentCalorieTarget) {
                target = window.MainWidget._currentCalorieTarget;
            }
            summary.target = target;
            summary.remaining = Math.max(target - summary.intake, 0);
        } else if (type === 'workouts') {
            summary.total = entries.reduce((sum, e) => sum + parseFloat(e.duration || 0), 0);
        } else if (type === 'sleep') {
            summary.hours = entries.reduce((sum, e) => sum + parseFloat(e.hours || 0), 0);
            summary.avgQuality = entries.length ? (entries.reduce((sum, e) => sum + parseFloat(e.quality || 0), 0) / entries.length) : 0;
        }
        return summary;
    }

    function getChartData(entries, type) {
        const byKey = {};
        let datasets = [];

        if (type === 'finance') {
            entries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const ym = e.date.getFullYear() + '-' + String(e.date.getMonth() + 1).padStart(2, '0');
                if (!byKey[ym]) byKey[ym] = { income: 0, expenses: 0 };
                if (parseFloat(e.amount) > 0) byKey[ym].income += parseFloat(e.amount);
                else byKey[ym].expenses += Math.abs(parseFloat(e.amount));
            });
            const labels = Object.keys(byKey).sort();
            return {
                labels,
                datasets: [
                    { label: 'Income', data: labels.map(l => byKey[l].income), backgroundColor: '#4CAF50' },
                    { label: 'Expenses', data: labels.map(l => byKey[l].expenses), backgroundColor: '#F44336' }
                ]
            };
        } else if (type === 'calorie') {
            let target = 2000;
            if (window.MainWidget && window.MainWidget._currentCalorieTarget) {
                target = window.MainWidget._currentCalorieTarget;
            }
            entries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const d = e.date.toISOString().slice(0, 10);
                if (!byKey[d]) byKey[d] = { intake: 0 };
                const kcal = parseFloat(e.kcal) || 0;
                if (kcal >= 0) byKey[d].intake += kcal;
            });
            const labels = Object.keys(byKey).sort();
            return {
                labels,
                datasets: [
                    { label: 'Intake', data: labels.map(l => byKey[l].intake), backgroundColor: '#4CAF50' },
                    { label: 'Target', data: labels.map(() => target), backgroundColor: '#F44336' }
                ]
            };
    // Helper: Parse target from command for calorie widget
    function getCalorieTargetFromCommand(commandStr) {
        const firstLine = (commandStr.split('\n')[0] || '').trim();
        const parts = firstLine.replace(/^[A-Z]+:/i, '').split(',').map(p => p.trim());
        const target = parseInt(parts[1], 10);
        return isNaN(target) ? 2000 : target;
    }
        } else if (type === 'workouts') {
            entries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const d = e.date.toISOString().slice(0, 10);
                if (!byKey[d]) byKey[d] = 0;
                byKey[d] += parseFloat(e.duration) || 0;
            });
             const labels = Object.keys(byKey).sort();
            return {
                labels,
                datasets: [{ label: 'Duration', data: labels.map(l => byKey[l]), backgroundColor: '#2196F3' }]
            };
        } else if (type === 'sleep') {
            entries.forEach(e => {
                if (!(e.date instanceof Date) || isNaN(e.date)) return;
                const d = e.date.toISOString().slice(0, 10);
                if (!byKey[d]) byKey[d] = { hours: 0, quality: 0, count: 0 };
                byKey[d].hours += parseFloat(e.hours) || 0;
                byKey[d].quality += parseFloat(e.quality) || 0;
                byKey[d].count += 1;
            });
            const labels = Object.keys(byKey).sort();
            return {
                labels,
                datasets: [
                    { label: 'Hours', data: labels.map(l => byKey[l].hours), backgroundColor: '#4CAF50' },
                    { label: 'Avg Quality', data: labels.map(l => byKey[l].count ? byKey[l].quality / byKey[l].count : 0), backgroundColor: '#FF9800' }
                ]
            };
        }
        return null;
    }

    function getPieData(entries, type) {
        if (type !== 'finance') return null;
        const expensesByCategory = entries.filter(e => parseFloat(e.amount) < 0).reduce((acc, e) => {
            const cat = e.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + Math.abs(parseFloat(e.amount));
            return acc;
        }, {});

        const cats = Object.keys(expensesByCategory);
        return {
            labels: cats,
            datasets: [{
                data: cats.map(c => expensesByCategory[c]),
                backgroundColor: cats.map((_, i) => pieColors[i % pieColors.length])
            }]
        };
    }


    // --- GENERIC RENDERERS ---
    function renderHeader(title, filterPeriod, onFilterChange) {
        const selectedOption = filterOptions.find(opt => opt.value === filterPeriod) || filterOptions[0];
        const filterDropdownHtml = `
            <div class="finance-filter-dropdown">
                <button type="button" class="finance-filter-btn">${selectedOption.label} <span class="dropdown-arrow">▼</span></button>
                <div class="finance-filter-list" style="display:none;">
                    ${filterOptions.map(opt => `<div class="finance-filter-item${filterPeriod === opt.value ? ' selected' : ''}" data-range="${opt.value}">${opt.label}</div>`).join('')}
                </div>
            </div>`;

        return `
            <div class="finance-widget-header">
                <h3 class="finance-widget-title">${title}</h3>
                <div class="finance-widget-controls">
                    <button type="button" class="finance-add-button" title="Add New Entry">+ New Entry</button>
                    ${filterDropdownHtml}
                </div>
            </div>`;
    }
    
    function renderSummaryCards(summary, config, unit) {
        if (!config.summaryCards || config.summaryCards.length === 0) return '';
        return `
            <div class="finance-summary-cards">
                ${config.summaryCards.map(card => `
                    <div class="finance-card ${card.class}">
                        <div class="finance-card-label">${card.label}</div>
                        <div class="finance-card-value">${card.value(summary, unit)}</div>
                    </div>
                `).join('')}
            </div>`;
    }

    function renderEntryTable(entries, config) {
        const headers = config.fields.map(f => f.charAt(0).toUpperCase() + f.slice(1)).concat(['']);
        const getRowHtml = (e, idx) => {
            const rowData = config.fields.map(field => {
                let val = e[field];
                if (field === 'date' && val instanceof Date && !isNaN(val)) {
                    return `<td>${window.dateFns ? window.dateFns.format(val, 'MMM d') : val.toLocaleDateString()}</td>`;
                }
                if (config.type === 'finance' && field === 'amount') {
                    const amountClass = parseFloat(val) > 0 ? 'income' : 'expense';
                    return `<td class="${amountClass}">${config.currency}${parseFloat(val).toFixed(2)}</td>`;
                }
                return `<td>${val !== undefined ? val : ''}</td>`;
            }).join('');
            // Only show remove button if this is a real data row (not empty)
            const isEmpty = config.fields.every(field => !e[field]);
            return `<tr data-entry-index="${idx}">${rowData}<td>${!isEmpty ? '<button class="entry-remove-btn" title="Remove Entry">✕</button>' : ''}</td></tr>`;
        };

        return `
            <div class="finance-transaction-list">
                <h3 class="finance-widget-subtitle">Recent Entries</h3>
                <div class="finance-transaction-table-container">
                    <table>
                        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                        <tbody>${entries.map(getRowHtml).join('')}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function renderModal(type, config, allEntries) {
        const todayStr = new Date().toISOString().slice(0, 10);
        let fieldsHtml = (config.modalFields || []).map(field => {
            const required = field.required ? 'required' : '';
            switch (field.type) {
                case 'radio':
                    return `
                        <div class="finance-form-group">
                            <label>${field.label}</label>
                            <div class="finance-entry-type">
                                ${field.options.map((opt, i) => `
                                    <input type="radio" id="${field.name}-${opt.value}" name="${field.name}" value="${opt.value}" ${ (field.default === opt.value || i === 0) ? 'checked' : ''}>
                                    <label for="${field.name}-${opt.value}" class="${opt.value}">${opt.label}</label>
                                `).join('')}
                            </div>
                        </div>`;
                case 'select':
                     const userCategories = type === 'finance' ? Array.from(new Set(allEntries.map(t => t.category).filter(cat => cat && !field.options.includes(cat)))) : [];
                    return `
                        <div class="finance-form-group">
                            <label for="entry-${field.name}">${field.label}</label>
                            <select id="entry-${field.name}" name="${field.name}" ${required}>
                                <option value="" disabled selected>Select...</option>
                                <optgroup label="Common">
                                    ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                                </optgroup>
                                ${userCategories.length > 0 ? `<optgroup label="Yours">${userCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}</optgroup>` : ''}
                                <option value="__custom__">Custom...</option>
                            </select>
                            <input type="text" id="entry-${field.name}-custom" name="${field.name}-custom" style="display:none;" placeholder="New Category" />
                        </div>`;
                default:
                    return `
                        <div class="finance-form-group">
                            <label for="entry-${field.name}">${field.label}</label>
                            <input type="${field.type}" id="entry-${field.name}" name="${field.name}" value="${field.type === 'date' ? todayStr : ''}"
                                   placeholder="${field.placeholder || ''}" step="${field.step || ''}" min="${field.min || ''}" max="${field.max || ''}" ${required}>
                        </div>`;
            }
        }).join('');

        return `
            <div class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Add ${config.title} Entry</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <form class="app-entry-form">${fieldsHtml}</form>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn secondary">Cancel</button>
                        <button class="modal-btn primary">Add Entry</button>
                    </div>
                </div>
            </div>`;
    }

    function renderChartContainer(id, title) {
        return `<div class="finance-widget-chart"><h3>${title}</h3><div class="finance-chart-container"><canvas id="${id}"></canvas></div></div>`;
    }
    
    // --- MAIN RENDER FUNCTION ---
    function render(container, type, command, dataStr, onCommandChange, storageKey) {
        const instanceId = type + '-' + Math.random().toString(36).substr(2, 9);
        const { config, settings } = parseCommand(command, type);
        config.type = type; // inject type into config for convenience
        console.log(`DEBUG: Rendering ${type} widget with command:`, command);
        // For calorie widget, parse and store target globally for use in summary/chart
        if (type === 'calorie') {
            const target = getCalorieTargetFromCommand(command);
            window.MainWidget._currentCalorieTarget = target;
        }

        const allEntries = parseData(dataStr, type);
        const filteredEntries = filterEntriesByPeriod(allEntries, settings.period);

        // --- Prepare HTML sections ---
        let summaryHtml = '', tableHtml = '', chartHtml = '', pieHtml = '';
        if (settings.layout.includes('summary')) {
            const summaryData = getSummaryData(filteredEntries, type);
            summaryHtml = renderSummaryCards(summaryData, config, settings.unit);
        }
        tableHtml = renderEntryTable(filteredEntries, config);

        if (settings.layout.includes('chart') && config.chart) {
            chartHtml = renderChartContainer(`chart-${instanceId}`, `${config.title} Chart`);
        }
        if (settings.layout.includes('pie') && config.pie) {
            pieHtml = renderChartContainer(`pie-${instanceId}`, `Expense Breakdown`);
        }

        // --- Final Assembly ---
        container.innerHTML = `
            <div class="finance-widget" id="widget-root-${instanceId}">
                ${renderHeader(config.title, settings.period)}
                ${summaryHtml}
                ${chartHtml}
                ${pieHtml}
                ${tableHtml}
                ${renderModal(type, config, allEntries)}
            </div>`;
        
        // --- Render Charts ---
        if (chartHtml) {
            const chartData = getChartData(filteredEntries, type);
            const ctx = container.querySelector(`#chart-${instanceId}`);
            if (ctx && window.Chart && chartData) {
                new window.Chart(ctx, { type: 'bar', data: chartData, options: { responsive: true, plugins: { legend: { display: true } }, scales: { x: {}, y: { beginAtZero: true } } }});
            }
        }
        if (pieHtml) {
            const pieData = getPieData(filteredEntries, type);
            const ctx = container.querySelector(`#pie-${instanceId}`);
            if (ctx && window.Chart && pieData) {
                new window.Chart(ctx, { type: 'pie', data: pieData, options: { responsive: true, plugins: { legend: { display: true } } } });
            }
        }
        
        // --- UNIFIED EVENT HANDLERS ---
        const widgetRoot = container.querySelector(`#widget-root-${instanceId}`);
        
        // Prevent parent interactions
        ['mousedown', 'click', 'dblclick'].forEach(evt => {
            widgetRoot.addEventListener(evt, e => e.stopPropagation());
        });

        // Filter Dropdown
        const filterBtn = widgetRoot.querySelector('.finance-filter-btn');
        const filterList = widgetRoot.querySelector('.finance-filter-list');
        filterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            filterList.style.display = filterList.style.display === 'none' ? 'block' : 'none';
        });
        document.addEventListener('click', function closeFilter(e) {
            if (!filterBtn.contains(e.target)) {
                filterList.style.display = 'none';
            }
        }, { once: true, capture: true });

        filterList.querySelectorAll('.finance-filter-item').forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                const newPeriod = e.target.dataset.range;
                let cmdLines = command.split('\n');
                console.log(`DEBUG: Command Raw: ${command}`);
                let firstLine = cmdLines[0] || `${type.toUpperCase()}: summary, ${settings.unit}, all`;
                // Split only the first two commas, so layout/unit are preserved even if they contain commas
                let rest = firstLine.replace(/^[A-Z]+:/i, '').trim();
                let layout = '', unit = '', period = '';
                const firstComma = rest.indexOf(',');
                const secondComma = rest.indexOf(',', firstComma + 1);
                if (firstComma === -1) {
                    layout = rest;
                } else if (secondComma === -1) {
                    layout = rest.slice(0, firstComma);
                    unit = rest.slice(firstComma + 1).trim();
                } else {
                    layout = rest.slice(0, firstComma);
                    unit = rest.slice(firstComma + 1, secondComma).trim();
                    period = rest.slice(secondComma + 1).trim();
                }
                // Preserve the original layout structure
                cmdLines[0] = (firstLine.match(/^[A-Z]+:/i) || `${type.toUpperCase()}:`)[0] +
                    ' ' + [layout.trim(), unit, newPeriod].join(', ');
                console.log(`DEBUG: Changing filter period to ${newPeriod} for command: ${cmdLines[0]}`);
                if (onCommandChange) onCommandChange(cmdLines.join('\n'));
            });
        });
        
        // Modal Handling
        const modal = widgetRoot.querySelector('.modal-overlay');
        widgetRoot.querySelector('.finance-add-button').addEventListener('click', () => modal.classList.add('active'));
        modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
        modal.querySelector('.modal-btn.secondary').addEventListener('click', () => modal.classList.remove('active'));
        
        const categorySelect = modal.querySelector('select[name="category"]');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                const customInput = modal.querySelector('input[name="category-custom"]');
                customInput.style.display = categorySelect.value === '__custom__' ? 'block' : 'none';
            });
        }
        
        // Add Entry
        modal.querySelector('.modal-btn.primary').addEventListener('click', () => {
            const form = modal.querySelector('.app-entry-form');
            const formData = new FormData(form);
            const values = Object.fromEntries(formData.entries());
            
            if (form.checkValidity() === false) {
                alert('Please fill out all required fields.');
                return;
            }

            let newLine = '- ';
            if (type === 'finance') {
                let category = values.category === '__custom__' ? values['category-custom'] : values.category;
                const amount = values.entryType === 'expense' ? -Math.abs(parseFloat(values.amount)) : Math.abs(parseFloat(values.amount));
                newLine += `${values.date}, ${values.note}, ${amount.toFixed(2)}, ${category}`;
            } else {
                 newLine += config.fields.map(field => values[field] || '').join(', ');
            }
            
            if (onCommandChange) onCommandChange(command + '\n' + newLine);
            modal.classList.remove('active');
        });

        // Remove Entry
        widgetRoot.querySelectorAll('.entry-remove-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const row = e.target.closest('tr');
            const entryIndex = parseInt(row.dataset.entryIndex, 10);
            // Defensive: Only proceed if entryIndex is valid and filteredEntries has that index
            if (isNaN(entryIndex) || !filteredEntries[entryIndex]) {
                console.warn('Delete operation aborted: Invalid entry index or no entry at index.', {entryIndex, filteredEntries});
                return;
            }
            const entryToRemove = filteredEntries[entryIndex];

            // Dynamically get the storage key from the DOM at click time
            const pageWrapper = widgetRoot.closest('[data-key]');
            const currentPageKey = pageWrapper ? pageWrapper.dataset.key : null;

            const confirmRemoval = () => {
                // Combine the command header and data string to get all lines
                const fullText = command + '\n' + dataStr;
                let allLines = fullText.split('\n');

                // --- START OF NEW FIX ---

                // Re-create the string representation of the entry to be removed.
                // This must perfectly match the line format in your data string.
                const entryToRemoveString = '- ' + config.fields.map(field => {
                    let val = entryToRemove[field];
                    if (field === 'date' && val instanceof Date && !isNaN(val)) {
                        // Format the date back to YYYY-MM-DD to match the source
                        const y = val.getFullYear();
                        const m = String(val.getMonth() + 1).padStart(2, '0');
                        const d = String(val.getDate()).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                    }
                    if (type === 'finance' && field === 'amount') {
                        return parseFloat(val).toFixed(2);
                    }
                    return val;
                }).join(', ');
                
                // Find the index of this exact line in the combined text array.
                // We search from index 1 to skip the header.
                const lineIndexToRemove = allLines.indexOf(entryToRemoveString, 1);

                console.log('DEBUG: Attempting to remove line:', entryToRemoveString);
                console.log('DEBUG: Found at index:', lineIndexToRemove);

                if (lineIndexToRemove > 0) { // Index must be > 0 (not the header)
                    allLines.splice(lineIndexToRemove, 1);
                    const newCommandStr = allLines.join('\n');

                    console.log(`Removing entry: ${entryToRemove.date} - ${entryToRemove.note || entryToRemove.kcal || ''}`);
                    console.log(`Saving updated command to storage key: ${currentPageKey}`);

                    if (typeof window.setStorage === 'function' && currentPageKey) {
                        window.setStorage(currentPageKey, newCommandStr);
                    }
                    if (typeof window.renderApp === 'function') {
                        window.renderApp();
                    }
                    if (onCommandChange) {
                        onCommandChange(newCommandStr);
                    }
                } else {
                    console.warn('Delete operation aborted: Could not find the exact line to remove.', { lineToRemove: entryToRemoveString, allLines });
                    // As a fallback, you could alert the user.
                    alert("Error: Could not find the entry to remove. Please refresh and try again.");
                }
                // --- END OF NEW FIX ---
            };

            if (window.HabitTracker && typeof window.HabitTracker.showCustomConfirm === 'function') {
                window.HabitTracker.showCustomConfirm('Are you sure you want to remove this entry?', confirmRemoval);
            } else if (confirm('Are you sure you want to remove this entry?')) {
                confirmRemoval();
            }
        });
    });
}
    // --- PUBLIC API ---
    return {
        render,
        // Expose individual renderers that directly use the render method with the original command
        // This prevents modifying the command in ways that lead to duplication or overwriting
        renderSummary: (container, type, command, dataStr, onCommandChange) => {
            // Use the original command without modification
            return render(container, type, command, dataStr, onCommandChange);
        },
        renderChart: (container, type, command, dataStr, onCommandChange) => {
            // Use the original command without modification
            return render(container, type, command, dataStr, onCommandChange);
        },
        renderPie: (container, type, command, dataStr, onCommandChange) => {
            // Use the original command without modification
            return render(container, type, command, dataStr, onCommandChange);
        },
        parseCommand,
        parseData,
        widgetConfigs
    };
})();

// Make globally available if needed
if (window) {
    window.MainWidget = MainWidget;
}