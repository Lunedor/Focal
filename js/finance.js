// js/finance.js

const financeTracker = (() => {
    // --- STATE & CONSTANTS ---
    const getStorage = window.getStorage || ((key) => localStorage.getItem(key) || '');
    const setStorage = window.setStorage || ((key, value) => localStorage.setItem(key, value));
    
    let state = {
        command: '',
        transactions: [],
        currency: '$',
        widgetType: 'summary',
        onCommandChange: null, // Will be set by the caller to update markdown
        isFirstWidget: false, // Used to determine if widget should show filter dropdown
        commandNode: null, // Reference to the node containing the command in markdown
        currencyCode: 'USD', // Used to track the actual currency code (not just symbol)
    };

    // --- DOM ELEMENTS ---
    let containerEl = null;

    // --- PARSER ---
    function parseCommand(commandStr) {
        // Fix: Make the regex less strict. It should remove "FINANCE:" and optional whitespace,
        // regardless of what comes next. The 'i' flag makes it case-insensitive.
        
        // Handle multi-line commands
        let allCommands = [];
        let currency = 'USD'; // Default currency
        let timeFilter = 'all'; // Default to show all data
        
        // Add debug logging to see what's coming in
        console.log(`[Focal Finance Debug] Parsing command: "${commandStr.substring(0, 100)}..."`);
        
        if (commandStr.includes('\n')) {
            // Extract multiple FINANCE: commands
            const lines = commandStr.split('\n').filter(line => line.trim());
            
            // Find all lines that start with FINANCE:
            allCommands = lines
                .filter(line => line.trim().toLowerCase().startsWith('finance:'))
                .map(line => line.trim());
            
            // Extract currency and time filter from the first command that has it
            if (allCommands.length > 0) {
                console.log(`[Focal Finance] Found ${allCommands.length} commands: ${allCommands.join(', ')}`);
                
                // Extract currency from commands (use the first one that has a currency specified)
                for (const cmd of allCommands) {
                    const cmdParts = cmd.replace(/^finance:\s*/i, '').split(',').map(p => p.trim()).filter(p => p);
                    if (cmdParts.length >= 2 && cmdParts[1]) {
                        currency = cmdParts[1];
                        console.log(`[Focal Finance] Found currency: ${currency}`);
                        
                        // Look for time filter (3rd parameter)
                        if (cmdParts.length >= 3 && cmdParts[2]) {
                            timeFilter = cmdParts[2];
                            console.log(`[Focal Finance] Found time filter: ${timeFilter}`);
                        }
                        break; // Use the first currency and filter we find
                    }
                }
            }
        }
        
        // Extract widget types from all commands
        let widgetTypes = [];
        
        if (allCommands.length > 0) {
            // Extract widget types from each command
            allCommands.forEach(cmd => {
                const cmdParts = cmd.replace(/^finance:\s*/i, '').split(',').map(p => p.trim()).filter(p => p);
                if (cmdParts[0]) {
                    widgetTypes.push(cmdParts[0]);
                }
            });
            
            console.log(`[Focal Finance] Extracted widget types: ${widgetTypes.join(', ')}`);
        } else {
            // Single command case
            // Process single command
            const parts = commandStr.replace(/^finance:\s*/i, '').split(',').map(p => p.trim()).filter(p => p);
            
            // Check if there are multiple widget types (separated by '+')
            if (parts[0] && parts[0].includes('+')) {
                widgetTypes = parts[0].split('+').map(type => type.trim());
            } else {
                widgetTypes = [parts[0] || 'summary'];
            }
            
            // Extract currency from single command
            if (parts.length >= 2 && parts[1]) {
                currency = parts[1];
            }
            
            // Extract time filter from single command (3rd parameter)
            if (parts.length >= 3 && parts[2]) {
                timeFilter = parts[2];
            }
        }
        
        // Make sure widgetTypes is not empty
        if (widgetTypes.length === 0) {
            widgetTypes = ['summary'];
        }
        
        const currencySymbol = getCurrencySymbol(currency);
        console.log(`[Focal Finance] Final parse result - Widget types: ${widgetTypes.join(', ')}, Currency: ${currencySymbol}, Time filter: ${timeFilter}`);
        
        return { widgetTypes, currencySymbol, timeFilter, currencyCode: currency };
    }

    function parseTransactions(transactionsStr) {
        // Add some debugging to help identify parsing issues
        console.log(`[Focal Finance] Parsing ${transactionsStr.split('\n').filter(l => l.trim()).length} transactions`);
        
        return transactionsStr.split('\n')
            .map(line => line.trim())
            .filter(line => line)
            .map((line, index) => {
                // Fix: Remove the leading markdown list marker (e.g., '- ') before splitting.
                const cleanLine = line.replace(/^[-*]\s+/, '');
                const parts = cleanLine.split(',').map(p => p.trim());
                if (parts.length < 3) {
                    console.warn(`[Focal Finance] Skipping line with insufficient parts: "${line}"`);
                    return null; // date, desc, amount are required
                }

                const date = window.parseDateString(parts[0]);
                if (!date) {
                    console.warn(`[Focal Finance] Could not parse date: "${parts[0]}" from line: "${line}"`);
                    return null;
                }

                const amount = parseFloat(parts[2]);
                if (isNaN(amount)) {
                    console.warn(`[Focal Finance] Invalid amount: "${parts[2]}" from line: "${line}"`);
                    return null;
                }

                return {
                    id: `txn-${index}`, // Add unique ID for each transaction
                    date: date,
                    description: parts[1],
                    amount: amount,
                    category: parts[3] || 'Uncategorized',
                };
            })
            .filter(Boolean) // Remove null entries
            .sort((a, b) => b.date - a.date); // Sort by date descending
    }

    function getCurrencySymbol(currencyCode) {
        // A simple map for common currencies. Can be expanded.
        const symbols = {
            'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥'
        };
        return symbols[currencyCode.toUpperCase()] || currencyCode;
    }
    
    function applyTimeFilter(transactions, timeFilter) {
        if (!timeFilter || timeFilter === 'all') {
            console.log(`[Focal Finance] No time filter applied, showing all ${transactions.length} transactions`);
            return transactions;
        }
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        let startDate;
        
        console.log(`[Focal Finance] Applying time filter: ${timeFilter}`);
        
        switch (timeFilter) {
            case 'this-month':
                // First day of current month
                startDate = new Date(currentYear, currentMonth, 1);
                break;
            
            case 'this-year':
                // First day of current year
                startDate = new Date(currentYear, 0, 1);
                break;
                
            case 'last-3-months':
                // Three months ago from today
                startDate = new Date(today);
                startDate.setMonth(currentMonth - 3);
                break;
                
            case 'last-6-months':
                // Six months ago from today
                startDate = new Date(today);
                startDate.setMonth(currentMonth - 6);
                break;
                
            case 'last-12-months':
                // Twelve months ago from today
                startDate = new Date(today);
                startDate.setFullYear(currentYear - 1);
                break;
                
            default:
                // Check if it's a specific year format: "year-YYYY"
                const yearMatch = timeFilter.match(/^year-(\d{4})$/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1], 10);
                    startDate = new Date(year, 0, 1);
                    const endDate = new Date(year, 11, 31, 23, 59, 59);
                    
                    // Filter transactions for the specific year
                    const filtered = transactions.filter(t => t.date >= startDate && t.date <= endDate);
                    console.log(`[Focal Finance] Filtered to ${filtered.length} transactions for year ${year}`);
                    return filtered;
                }
                
                // Unknown filter, return all transactions
                console.log(`[Focal Finance] Unknown time filter: ${timeFilter}, showing all transactions`);
                return transactions;
        }
        
        // Filter transactions from the start date to today
        const filtered = transactions.filter(t => t.date >= startDate);
        console.log(`[Focal Finance] Filtered to ${filtered.length} transactions from ${startDate.toDateString()} to now`);
        return filtered;
    }
    
    function getWidgetTitleWithTimePeriod(baseTitle) {
        const timeFilter = state.timeFilter;
        
        if (!timeFilter || timeFilter === 'all') {
            return baseTitle;
        }
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        switch (timeFilter) {
            case 'this-month':
                return `${baseTitle} (${monthNames[currentMonth]} ${currentYear})`;
            
            case 'this-year':
                return `${baseTitle} (${currentYear})`;
                
            case 'last-3-months':
                const threeMonthsAgo = new Date(today);
                threeMonthsAgo.setMonth(currentMonth - 3);
                return `${baseTitle} (Last 3 Months)`;
                
            case 'last-6-months':
                return `${baseTitle} (Last 6 Months)`;
                
            case 'last-12-months':
                return `${baseTitle} (Last 12 Months)`;
                
            default:
                // Check if it's a specific year format: "year-YYYY"
                const yearMatch = timeFilter.match(/^year-(\d{4})$/);
                if (yearMatch) {
                    const year = parseInt(yearMatch[1], 10);
                    return `${baseTitle} (${year})`;
                }
                
                return baseTitle;
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderFilterDropdown(timeFilter, isFirstWidget) {
        // Only render the filter dropdown and add button for the first widget
        if (!isFirstWidget) return '';

        const filters = [
            { label: 'All Time', value: 'all' },
            { label: 'This Month', value: 'this-month' },
            { label: 'This Year', value: 'this-year' },
            { label: 'Last 3 Months', value: 'last-3-months' },
            { label: 'Last 6 Months', value: 'last-6-months' },
            { label: 'Last 12 Months', value: 'last-12-months' }
        ];
        
        return `
            <div class="finance-widget-controls">
                <button class="finance-add-button">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    New Entry
                </button>
                <div class="finance-filter-dropdown">
                    <button class="finance-filter-button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        Filter
                    </button>
                    <div class="finance-filter-menu">
                        ${filters.map(filter => `
                            <div class="finance-filter-item ${filter.value === timeFilter ? 'selected' : ''}" data-value="${filter.value}">
                                ${filter.label}
                                ${filter.value === timeFilter ? '<svg class="check-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderSummaryWidget() {
        if (!containerEl) return;

        const income = state.transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
        const expenses = state.transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
        const net = income + expenses;

        const expensesByCategory = state.transactions
            .filter(t => t.amount < 0)
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                return acc;
            }, {});

        const totalExpenses = Math.abs(expenses);
        
        // Define the same colors used in the pie chart
        const pieColors = [
            '#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', 
            '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'
        ];

        const categoryBarsHtml = Object.entries(expensesByCategory)
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
                        <div class="finance-category-amount">${state.currency}${amount.toFixed(2)}</div>
                    </div>
                `;
            }).join('');

        const transactionsHtml = state.transactions.map(t => {
            const amountClass = t.amount > 0 ? 'income' : 'expense';
            return `
                <tr class="finance-transaction-row">
                    <td>${window.dateFns.format(t.date, 'MMM d')}</td>
                    <td>${t.description}</td>
                    <td>${t.category}</td>
                    <td class="${amountClass}">${state.currency}${t.amount.toFixed(2)}</td>
                    <td class="remove-column">
                        <button class="remove-item-btn" data-transaction-id="${t.id}" title="Remove this transaction">×</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Get summary title with time period
        const summaryTitle = getWidgetTitleWithTimePeriod("Financial Summary");

        containerEl.innerHTML = `
            <div class="finance-widget">
                <div class="finance-widget-header">
                    <h3 class="finance-widget-title">${summaryTitle}</h3>
                    ${renderFilterDropdown(state.timeFilter, state.isFirstWidget)}
                </div>
                <div class="finance-summary-cards">
                    <div class="finance-card income">
                        <div class="finance-card-label">Income</div>
                        <div class="finance-card-value">${state.currency}${income.toFixed(2)}</div>
                    </div>
                    <div class="finance-card expense">
                        <div class="finance-card-label">Expenses</div>
                        <div class="finance-card-value">${state.currency}${Math.abs(expenses).toFixed(2)}</div>
                    </div>
                    <div class="finance-card net">
                        <div class="finance-card-label">Net</div>
                        <div class="finance-card-value">${net >= 0 ? '+' : '-'}${state.currency}${Math.abs(net).toFixed(2)}</div>
                    </div>
                </div>

                ${categoryBarsHtml ? `
                <div class="finance-category-breakdown">
                    <h3 class="finance-widget-subtitle">Spending by Category</h3>
                    ${categoryBarsHtml}
                </div>` : ''}

                <div class="finance-transaction-list">
                    <h3 class="finance-widget-subtitle">Recent Transactions</h3>
                    <div class="finance-transaction-table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Category</th>
                                    <th>Amount</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>${transactionsHtml}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    function renderPieChartWidget() {
        if (!containerEl) return;

        console.log(`[Focal Finance] Rendering pie chart with ${state.transactions.length} transactions`);
        
        // Define pie chart colors
        const pieColors = [
            '#4CAF50', '#F44336', '#2196F3', '#FF9800', '#9C27B0', 
            '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#E91E63'
        ];

        // Group expenses by category
        const expensesByCategory = {};
        let totalExpenses = 0;
        
        state.transactions.forEach(t => {
            // Only count expenses (negative amounts)
            if (t.amount < 0) {
                const category = t.category || 'Uncategorized';
                const amount = Math.abs(t.amount);
                expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
                totalExpenses += amount;
            }
        });

        if (totalExpenses === 0) {
            containerEl.innerHTML = `<div class="finance-widget"><p class="widget-notice">No expense data to display in pie chart.</p></div>`;
            return;
        }

        // Sort categories by amount (descending)
        const sortedCategories = Object.keys(expensesByCategory).sort((a, b) => 
            expensesByCategory[b] - expensesByCategory[a]
        );
        
        console.log(`[Focal Finance] Pie chart data - Categories: ${sortedCategories.length}, Total expenses: ${totalExpenses}`);

        // Generate pie chart segments
        let startAngle = 0;
        const segments = sortedCategories.map((category, index) => {
            const amount = expensesByCategory[category];
            const percentage = (amount / totalExpenses) * 100;
            const angle = (amount / totalExpenses) * 360;
            const endAngle = startAngle + angle;
            const colorIndex = index % pieColors.length;
            const color = pieColors[colorIndex];
            
            // SVG path for the pie segment
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            // Calculate coordinates on the circle
            const startX = 100 + 70 * Math.cos((startAngle - 90) * Math.PI / 180);
            const startY = 100 + 70 * Math.sin((startAngle - 90) * Math.PI / 180);
            const endX = 100 + 70 * Math.cos((endAngle - 90) * Math.PI / 180);
            const endY = 100 + 70 * Math.sin((endAngle - 90) * Math.PI / 180);
            
            // SVG path
            const path = `M 100 100 L ${startX} ${startY} A 70 70 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
            
            // Legend item 
            const legendItem = `
                <div class="pie-legend-item">
                    <span class="pie-legend-color" style="background-color: ${color};"></span>
                    <span class="pie-legend-label">${category}</span>
                    <span class="pie-legend-amount">${state.currency}${amount.toFixed(2)}</span>
                    <span class="pie-legend-percentage">${percentage.toFixed(1)}%</span>
                </div>
            `;
            
            // Store the current end angle as the next start angle
            const result = { path, color, legendItem, category, amount, percentage };
            startAngle = endAngle;
            return result;
        });

        // Create SVG for pie chart
        const pieChartSvg = `
            <svg width="200" height="200" viewBox="0 0 200 200" class="finance-pie-chart-svg">
                ${segments.map(segment => 
                    `<path d="${segment.path}" fill="${segment.color}" stroke="var(--color-border)" stroke-width="1" />`)
                    .join('')}
                <circle cx="100" cy="100" r="45" fill="var(--color-planner-bg)" />
            </svg>
        `;

        // Create legend for categories
        const legendHtml = segments.map(segment => segment.legendItem).join('');

        // Get title with time period
        const title = getWidgetTitleWithTimePeriod("Expenses by Category");

        // Render the widget
        containerEl.innerHTML = `
            <div class="finance-widget finance-pie-chart-widget">
                <div class="finance-widget-header">
                    <h3 class="finance-pie-chart-title">${title}</h3>
                    ${renderFilterDropdown(state.timeFilter, state.isFirstWidget)}
                </div>
                
                <div class="finance-pie-chart-content">
                    <div class="finance-pie-chart-container">
                        ${pieChartSvg}
                        <div class="finance-pie-chart-total">
                            Total: ${state.currency}${totalExpenses.toFixed(2)}
                        </div>
                    </div>
                    
                    <div class="finance-pie-legend-container">
                        ${legendHtml}
                    </div>
                </div>
            </div>
        `;
    }

    function renderChartWidget() {
        if (!containerEl) return;

        console.log(`[Focal Finance] Rendering chart with ${state.transactions.length} transactions`);
        
        // Debug the first few transactions to check date formats
        if (state.transactions.length > 0) {
            console.log(`[Focal Finance] Sample transaction:`, 
                        state.transactions[0].date, 
                        `(${typeof state.transactions[0].date})`,
                        `Amount: ${state.transactions[0].amount}`);
        }

        // 1. Group transactions by month
        const transactionsByMonth = state.transactions.reduce((acc, t) => {
            try {
                const monthKey = window.dateFns.format(t.date, 'yyyy-MM');
                if (!acc[monthKey]) {
                    acc[monthKey] = { income: 0, expenses: 0, transactions: [] };
                }
                if (t.amount > 0) {
                    acc[monthKey].income += t.amount;
                } else {
                    acc[monthKey].expenses += Math.abs(t.amount);
                }
                acc[monthKey].transactions.push(t);
            } catch (error) {
                console.error(`[Focal Finance] Error processing transaction:`, t, error);
            }
            return acc;
        }, {});

        // Sort months chronologically
        const sortedMonths = Object.keys(transactionsByMonth).sort();

        if (sortedMonths.length === 0) {
            containerEl.innerHTML = `<div class="finance-widget"><p class="widget-notice">No transaction data to display in chart.</p></div>`;
            return;
        }

        // 2. Find max value for scaling the bars
        const maxIncome = Math.max(...Object.values(transactionsByMonth).map(m => m.income));
        const maxExpenses = Math.max(...Object.values(transactionsByMonth).map(m => m.expenses));
        const maxValue = Math.max(maxIncome, maxExpenses, 1); // Use 1 to avoid division by zero
        
        console.log(`[Focal Finance] Chart data - Income max: ${maxIncome}, Expenses max: ${maxExpenses}, Using max value: ${maxValue}`);
        console.log(`[Focal Finance] Months to display: ${sortedMonths.join(', ')}`);
        
        // Check transaction data for each month
        for (const monthKey of sortedMonths) {
            const data = transactionsByMonth[monthKey];
            console.log(`[Focal Finance] Month ${monthKey}: Income: ${data.income.toFixed(2)}, Expenses: ${data.expenses.toFixed(2)}`);
        }

        // 3. Render HTML for the chart
        const chartBarsHtml = sortedMonths.map(monthKey => {
            const data = transactionsByMonth[monthKey];
            
            // Convert to pixel heights based on chart area (180px usable height)
            const chartHeight = 180; // 200px minus some padding
            let incomeHeight = Math.round((data.income / maxValue) * chartHeight);
            let expenseHeight = Math.round((data.expenses / maxValue) * chartHeight);
            
            // Make sure bars have a minimum visible height if there's any value
            if (data.income > 0 && incomeHeight < 10) incomeHeight = 10;
            if (data.expenses > 0 && expenseHeight < 10) expenseHeight = 10;
            
            console.log(`[Focal Finance] Bar heights for ${monthKey}: Income: ${incomeHeight}px, Expenses: ${expenseHeight}px`);
            
            // Create date manually to avoid parseISO issues
            const [year, month] = monthKey.split('-');
            const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
            const monthLabel = window.dateFns.format(date, 'MMM yyyy');

            return `
                <div class="finance-chart-bar-group" title="Income: ${state.currency}${data.income.toFixed(2)}\nExpenses: ${state.currency}${data.expenses.toFixed(2)}">
                    <div class="finance-chart-bar-container">
                        <div class="finance-chart-bar income" style="height: ${incomeHeight}px;"></div>
                        <div class="finance-chart-bar expense" style="height: ${expenseHeight}px;"></div>
                    </div>
                    <div class="finance-chart-label">${monthLabel}</div>
                </div>
            `;
        }).join('');

        // Get title with time period
        const title = getWidgetTitleWithTimePeriod("Monthly Income vs. Expenses");

        containerEl.innerHTML = `
            <div class="finance-widget finance-chart-widget">
                <div class="finance-widget-header">
                    <h3 class="finance-chart-title">${title}</h3>
                    ${renderFilterDropdown(state.timeFilter, state.isFirstWidget)}
                </div>
                
                <div class="finance-chart-area">
                    <!-- Y-axis labels -->
                    <div class="finance-chart-y-axis-label max">${state.currency}${maxValue}</div>
                    <div class="finance-chart-y-axis-label min">${state.currency}0</div>
                    
                    <!-- Chart area with bars -->
                    <div class="finance-chart-bars-container">
                        ${chartBarsHtml}
                    </div>
                </div>
                
                <div class="finance-chart-legend">
                    <div class="finance-chart-legend-item">
                        <span class="finance-chart-legend-color income"></span>
                        <span class="finance-chart-legend-label">Income</span>
                    </div>
                    <div class="finance-chart-legend-item">
                        <span class="finance-chart-legend-color expense"></span>
                        <span class="finance-chart-legend-label">Expenses</span>
                    </div>
                </div>
            </div>
        `;
    }

    function extractTransactionsFromCommand(command) {
        // This function extracts only the transaction lines from a command with multiple FINANCE: lines
        if (!command.includes('\n')) {
            return '';
        }
        
        const lines = command.split('\n');
        const transactionLines = lines.filter(line => line.trim().startsWith('-'));
        
        if (transactionLines.length > 0) {
            // Return all transaction lines
            return transactionLines.join('\n');
        }
        
        return '';
    }

    function init(options) {
        const { placeholder, command, transactions, onCommandChange } = options;
        containerEl = placeholder;
        let transactionsStr = transactions;

        console.log(`[Focal Finance] Init called with command length: ${command.length}, transactions length: ${transactionsStr ? transactionsStr.length : 0}`);

        // The placeholder is the command node
        state.commandNode = placeholder;
        
        // Set up command change callback if provided
        if (typeof onCommandChange === 'function') {
            state.onCommandChange = onCommandChange;
        }
        
        // Set up event listener to handle clicks outside of any filter dropdown
        document.addEventListener('click', (e) => {
            const isFilterDropdown = e.target.closest('.finance-filter-dropdown');
            if (!isFilterDropdown) {
                document.querySelectorAll('.finance-filter-menu.active').forEach(menu => {
                    menu.classList.remove('active');
                });
            }
        });
        
        // If command contains transactions (multiple FINANCE: format) use that instead
        const extractedTransactions = extractTransactionsFromCommand(command);
        if (extractedTransactions) {
            console.log(`[Focal Finance] Found transactions in command, length: ${extractedTransactions.length}`);
            transactionsStr = extractedTransactions;
        } else if (command.includes('\n') && !transactionsStr) {
            // If we have a multiline command but no detected transactions in either place,
            // look for lines that don't start with FINANCE: and aren't empty
            const lines = command.split('\n');
            const nonCommandLines = lines.filter(line => {
                const trimmed = line.trim();
                return trimmed && !trimmed.toLowerCase().startsWith('finance:');
            });
            
            if (nonCommandLines.length > 0) {
                transactionsStr = nonCommandLines.join('\n');
                console.log(`[Focal Finance] Using non-command lines as transactions: ${transactionsStr}`);
            }
        }

        // Parse the command to set the currency, widget types and time filter correctly.
        const { widgetTypes, currencySymbol, timeFilter, currencyCode } = parseCommand(command);
        state.command = command;
        state.widgetTypes = widgetTypes;
        state.currency = currencySymbol;
        state.timeFilter = timeFilter;
        state.currencyCode = currencyCode;

        console.log(`[Focal Finance] Initializing widget types: ${widgetTypes.join(', ')}, currency: ${currencySymbol} (${currencyCode}), time filter: ${timeFilter}`);

        // Parse the transaction text into structured data.
        const allTransactions = parseTransactions(transactionsStr);
        
        console.log(`[Focal Finance] Parsed ${allTransactions.length} valid transactions out of ${transactionsStr.split('\n').filter(l => l.trim()).length} lines`);
        
        // Apply time filter to the transactions
        state.transactions = applyTimeFilter(allTransactions, timeFilter);

        // Create container for multiple widgets if needed
        let html = '';
        
        // If there are multiple widget types, we'll create a container for each
        const hasMultipleWidgets = widgetTypes.length > 1;
        
        // Track any unsupported widget types
        const unknownTypes = [];
        
        if (hasMultipleWidgets) {
            // Create a wrapper div with styling to contain all widgets
            // Use a responsive flexbox layout that wraps on smaller screens
            html += `<div class="finance-multi-widgets" style="display: flex; flex-wrap: wrap; gap: 30px; justify-content: space-between;">`;
        }
        
        // Render each requested widget
        for (let i = 0; i < widgetTypes.length; i++) {
            const widgetType = widgetTypes[i];
            // Store current widget type for the render functions
            state.widgetType = widgetType;
            
            // Set isFirstWidget flag - only the first widget in the list shows the filter
            state.isFirstWidget = (i === 0);
            
            // Create a temporary container for this widget
            const tempContainer = document.createElement('div');
            
            // Render the widget based on the parsed type
            // Add a wrapper div for each widget to ensure proper sizing in the flex container
            let widgetHtml = '';
            
            if (widgetType === 'summary') {
                // Use the existing render function with a temporary container
                containerEl = tempContainer;
                renderSummaryWidget();
                widgetHtml = tempContainer.innerHTML;
            } else if (widgetType === 'chart') {
                containerEl = tempContainer;
                renderChartWidget();
                widgetHtml = tempContainer.innerHTML;
            } else if (widgetType === 'chartpie') {
                containerEl = tempContainer;
                renderPieChartWidget();
                widgetHtml = tempContainer.innerHTML;
            } else {
                unknownTypes.push(widgetType);
                widgetHtml = '';
            }
            
            if (widgetHtml) {
                if (hasMultipleWidgets) {
                    // Wrap each widget in a div with responsive sizing
                    html += `<div class="finance-widget-container" style="flex: 1 1 ${widgetType === 'summary' ? '100%' : '450px'}; min-width: 300px; max-width: 100%;">${widgetHtml}</div>`;
                } else {
                    html += widgetHtml;
                }
            }
        }
        
        // Close the wrapper div if we had multiple widgets
        if (hasMultipleWidgets) {
            html += `</div>`;
        }
        
        // Restore the original container
        containerEl = placeholder;
        
        // If we have unknown widget types, show an error
        if (unknownTypes.length > 0) {
            const errorHtml = `<div class="widget-error" style="padding: 16px; margin: 16px 0; color: red;">Unknown finance widget type(s): "${unknownTypes.join(', ')}"</div>`;
            
            // If this is the only widget type requested, show just the error
            if (unknownTypes.length === widgetTypes.length) {
                containerEl.innerHTML = errorHtml;
            } else {
                // Otherwise append the error to the rendered widgets
                containerEl.innerHTML = html + errorHtml;
            }
        } else {
            // All widget types were valid
            containerEl.innerHTML = html;
            
            // Attach event listeners to the filter dropdowns
            attachFilterEventListeners();
        }
    }
    // Function to update the time filter
    function updateFilter(newFilter) {
        console.log(`[Focal Finance] Updating filter to: ${newFilter}`);
        
        if (newFilter === state.timeFilter) {
            console.log(`[Focal Finance] Filter already set to ${newFilter}, no change needed`);
            return;
        }
        
        // Update the time filter in state
        state.timeFilter = newFilter;
        
        // Update the actual command text in the document if possible
        if (state.onCommandChange && typeof state.onCommandChange === 'function') {
            // Create updated command with new filter
            const parts = state.command.replace(/^finance:\s*/i, '').split(',').map(p => p.trim());
            const widgetTypes = parts[0] || 'summary';
            const currency = parts.length >= 2 ? parts[1] : 'USD';
            
            // Create new command with updated filter
            const newCommand = `FINANCE: ${widgetTypes}, ${currency}, ${newFilter}`;
            
            // Call the callback to update the command in the document
            state.onCommandChange(newCommand);
            
            // Update the state command
            state.command = newCommand;
            
            // Trigger full page re-render if available
            if (typeof renderApp === 'function') {
                // Use setTimeout to ensure the DOM update happens first
                setTimeout(() => renderApp(), 0);
                return; // Skip the local re-render since the page will refresh
            }
        }
        
        // Get all transactions without filter first
        const allTransactions = parseTransactions(extractTransactionsFromCommand(state.command));
        
        // Apply new filter
        state.transactions = applyTimeFilter(allTransactions, newFilter);
        
        // Re-render the widget with the filtered data
        const widgetTypes = state.widgetTypes;
        
        // Create container for multiple widgets if needed
        let html = '';
        
        // If there are multiple widget types, we'll create a container for each
        const hasMultipleWidgets = widgetTypes.length > 1;
        
        if (hasMultipleWidgets) {
            // Create a wrapper div with styling to contain all widgets
            html += `<div class="finance-multi-widgets" style="display: flex; flex-wrap: wrap; gap: 30px; justify-content: space-between;">`;
        }
        
        // Render each requested widget
        for (let i = 0; i < widgetTypes.length; i++) {
            const widgetType = widgetTypes[i];
            // Store current widget type for the render functions
            state.widgetType = widgetType;
            
            // Set isFirstWidget flag - only the first widget in the list shows the filter
            state.isFirstWidget = (i === 0);
            
            // Create a temporary container for this widget
            const tempContainer = document.createElement('div');
            
            // Render the widget based on the parsed type
            let widgetHtml = '';
            
            if (widgetType === 'summary') {
                // Use the existing render function with a temporary container
                containerEl = tempContainer;
                renderSummaryWidget();
                widgetHtml = tempContainer.innerHTML;
            } else if (widgetType === 'chart') {
                containerEl = tempContainer;
                renderChartWidget();
                widgetHtml = tempContainer.innerHTML;
            } else if (widgetType === 'chartpie') {
                containerEl = tempContainer;
                renderPieChartWidget();
                widgetHtml = tempContainer.innerHTML;
            }
            
            if (widgetHtml) {
                if (hasMultipleWidgets) {
                    // Wrap each widget in a div with responsive sizing
                    html += `<div class="finance-widget-container" style="flex: 1 1 ${widgetType === 'summary' ? '100%' : '450px'}; min-width: 300px; max-width: 100%;">${widgetHtml}</div>`;
                } else {
                    html += widgetHtml;
                }
            }
        }
        
        // Close the wrapper div if we had multiple widgets
        if (hasMultipleWidgets) {
            html += `</div>`;
        }
        
        // Update the container
        containerEl.innerHTML = html;
        
        // Attach event listeners to the filter dropdowns
        attachFilterEventListeners();
    }
    
    // Show the finance entry modal
    function showFinanceEntryModal() {
        // Set today's date as the default using date-fns for consistent formatting
        const today = new Date();
        const dateValue = window.dateFns.format(today, 'yyyy-MM-dd'); // ISO format for internal use
        const displayValue = window.dateFns.format(today, 'dd/MM/yyyy'); // Formatted for display in dd/MM/yyyy format
        
        // Reset form fields
        DOM.financeEntryForm.reset();
        DOM.financeEntryDate.value = dateValue;
        DOM.financeEntryDateDisplay.value = displayValue;
        DOM.financeEntryAmount.value = '';
        DOM.financeEntryDescription.value = '';
        DOM.financeEntryCategory.value = '';
        
        // Check the income radio button by default
        document.getElementById('income-type').checked = true;
        
        // Show modal
        DOM.financeEntryModal.classList.add('active');
        
        // Setup event listeners for the modal
        setupFinanceModalListeners();
        
        // Focus on the description field for better UX
        setTimeout(() => DOM.financeEntryDescription.focus(), 100);
    }
    
    // Hide the finance entry modal
    function hideFinanceEntryModal() {
        DOM.financeEntryModal.classList.remove('active');
        
        // Remove event listeners
        DOM.financeModalConfirm.onclick = null;
        DOM.financeModalCancel.onclick = null;
        DOM.financeModalClose.onclick = null;
    }
    
    // Set up event listeners for the finance modal
    function setupFinanceModalListeners() {
        // Add event listener to date picker button only
        DOM.financeEntryDatePickerBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Use centralized date picker
            if (typeof CentralizedDatePicker !== 'undefined') {
                CentralizedDatePicker.showFinanceDatePicker(this, 'finance-entry-date', 'finance-entry-date-display');
            } else {
                // Fallback to old method if centralized picker not available
                openFinanceDatePicker(this, 'finance-entry-date', 'finance-entry-date-display');
            }
        });
        
        // Make the date input field editable and handle date validation
        DOM.financeEntryDateDisplay.addEventListener('input', function(e) {
            const inputValue = e.target.value;
            
            // Update the hidden field on valid date input
            updateDateFromInput(inputValue, 'finance-entry-date');
        });
        
        // Handle confirm button click
        DOM.financeModalConfirm.onclick = function() {
            // Validate the form
            if (!DOM.financeEntryForm.checkValidity()) {
                DOM.financeEntryForm.reportValidity();
                return;
            }
            
            // Get form values
            const date = DOM.financeEntryDate.value; // This is in YYYY-MM-DD format
            const description = DOM.financeEntryDescription.value.trim();
            const amount = parseFloat(DOM.financeEntryAmount.value);
            const category = DOM.financeEntryCategory.value.trim();
            const isIncome = document.getElementById('income-type').checked;
            
            // Format the date to dd/MM/yyyy to match the expected format for transactions
            const dateObj = new Date(date);
            const formattedDate = window.dateFns.format(dateObj, 'yyyy-MM-dd');
            
            // Create the transaction entry
            const finalAmount = isIncome ? amount : -amount;
            const transactionEntry = `- ${formattedDate}, ${description}, ${finalAmount.toFixed(2)}, ${category}`;
            
            // Add the entry to the command
            addTransactionToCommand(transactionEntry);
            
            // Hide the modal
            hideFinanceEntryModal();
        };
        
        // Handle cancel and close buttons
        DOM.financeModalCancel.onclick = hideFinanceEntryModal;
        DOM.financeModalClose.onclick = hideFinanceEntryModal;
    }
    
    // Add a new transaction to the command
    function addTransactionToCommand(transactionEntry) {
        console.log(`[Focal Finance] Adding transaction: ${transactionEntry}`);
        
        if (!state.command || !state.onCommandChange) {
            console.error('[Focal Finance] Cannot add transaction: command or onCommandChange is not set');
            return;
        }
        
        // Get the current command
        let currentCommand = state.command;
        
        // If the command is multiline, find the last FINANCE: line
        if (currentCommand.includes('\n')) {
            const lines = currentCommand.split('\n');
            const financeLines = lines.filter(line => line.trim().toLowerCase().startsWith('finance:'));
            if (financeLines.length > 0) {
                // Find the last finance line
                const lastFinanceLineIndex = lines.lastIndexOf(financeLines[financeLines.length - 1]);
                
                // Insert the transaction after the last finance line
                lines.splice(lastFinanceLineIndex + 1, 0, transactionEntry);
                currentCommand = lines.join('\n');
            } else {
                // No FINANCE: lines found, append to the end
                currentCommand += '\n' + transactionEntry;
            }
        } else {
            // Single line command, add transaction on a new line after it
            currentCommand += '\n' + transactionEntry;
        }
        
        // Update the command in the document
        state.onCommandChange(currentCommand);
        
        // Update the state command
        state.command = currentCommand;
        
        // Trigger full page re-render if available
        if (typeof renderApp === 'function') {
            setTimeout(() => renderApp(), 0);
        }
    }

    // Remove a transaction from the command
    function removeTransactionFromCommand(transactionId) {
        console.log(`[Focal Finance] Removing transaction: ${transactionId}`);
        
        // Show confirmation modal first
        showRemoveConfirmation(transactionId);
    }

    // Show confirmation modal for transaction removal
    function showRemoveConfirmation(transactionId) {
        // Find the transaction to show details in confirmation
        const transaction = state.transactions.find(t => t.id === transactionId);
        const transactionText = transaction 
            ? `${transaction.description} (${state.currency}${transaction.amount.toFixed(2)})`
            : transactionId;

        // Create confirmation modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2100'; // Higher than date picker
        
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Confirm Removal</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to remove this transaction?</p>
                    <p><strong>Transaction:</strong> ${transactionText}</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="modal-btn primary confirm-remove">Remove</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add confirm handler
        modal.querySelector('.confirm-remove').addEventListener('click', () => {
            modal.remove();
            performRemoveTransaction(transactionId);
        });
        
        // Add class for active state
        modal.classList.add('active');
    }

    // Perform the actual transaction removal
    function performRemoveTransaction(transactionId) {
        console.log(`[Focal Finance] Removing transaction: ${transactionId}`);
        
        // Get the current page content from localStorage
        const pageWrapper = DOM.pageContentWrapper || document.querySelector('[data-key]');
        if (!pageWrapper || !pageWrapper.dataset.key) {
            console.error('[Focal Finance] Cannot find page key for removal');
            return;
        }
        
        const pageKey = pageWrapper.dataset.key;
        const currentContent = getStorage(pageKey);
        
        if (!currentContent) {
            console.error('[Focal Finance] No content found for page key:', pageKey);
            return;
        }
        
        // Find the transaction to remove by matching the ID
        const transaction = state.transactions.find(t => t.id === transactionId);
        if (!transaction) {
            console.error('[Focal Finance] Transaction not found:', transactionId);
            return;
        }
        
        // Split content into lines and find the line to remove
        const lines = currentContent.split('\n');
        const updatedLines = lines.filter(line => {
            if (!line.trim().startsWith('- ')) return true; // Keep non-transaction items
            
            // Parse the line to check if it matches the transaction
            const cleanLine = line.replace(/^[-*]\s+/, '');
            const parts = cleanLine.split(',').map(p => p.trim());
            
            if (parts.length < 3) return true; // Keep malformed lines
            
            const lineDate = window.parseDateString(parts[0]);
            const lineDescription = parts[1];
            const lineAmount = parseFloat(parts[2]);
            
            // Check if this line matches the transaction we want to remove
            const matches = lineDate && 
                           lineDate.getTime() === transaction.date.getTime() &&
                           lineDescription === transaction.description &&
                           lineAmount === transaction.amount;
            
            return !matches;
        });
        
        // Update the content in localStorage
        const updatedContent = updatedLines.join('\n');
        setStorage(pageKey, updatedContent);
        
        // Re-render the entire app to reflect the changes
        if (typeof renderApp === 'function') {
            renderApp();
        }
    }

    // Attach event listeners to filter dropdowns and New Entry button
    function attachFilterEventListeners() {
        if (!containerEl) return;
        
        // Find all filter buttons
        const filterButtons = containerEl.querySelectorAll('.finance-filter-button');
        
        filterButtons.forEach(button => {
            // Add click listener to toggle dropdown
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Toggle this dropdown
                const dropdown = button.nextElementSibling;
                dropdown.classList.toggle('active');
                
                // Close all other dropdowns
                document.querySelectorAll('.finance-filter-menu.active').forEach(menu => {
                    if (menu !== dropdown) {
                        menu.classList.remove('active');
                    }
                });
            });
        });
        
        // Add click listeners to filter items
        const filterItems = containerEl.querySelectorAll('.finance-filter-item');
        
        filterItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Get the selected filter
                const selectedFilter = item.dataset.value;
                
                // Update the filter
                updateFilter(selectedFilter);
                
                // Close the dropdown
                item.closest('.finance-filter-menu').classList.remove('active');
            });
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.finance-filter-menu.active').forEach(menu => {
                menu.classList.remove('active');
            });
        });
        
        // Add click listeners to "New Entry" buttons
        const addButtons = containerEl.querySelectorAll('.finance-add-button');
        
        addButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                showFinanceEntryModal();
            });
        });

        // Add click listeners to remove transaction buttons
        const removeButtons = containerEl.querySelectorAll('.remove-item-btn');
        
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const transactionId = button.dataset.transactionId;
                if (transactionId) {
                    removeTransactionFromCommand(transactionId);
                }
            });
        });
    }

    // Parse and validate user-entered date
    function updateDateFromInput(inputValue, hiddenFieldId) {
        // Allow various formats: dd/MM/yyyy, d/M/yyyy, etc.
        const datePattern = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
        const match = inputValue.match(datePattern);
        
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1; // Month is 0-indexed in JS Date
            const year = parseInt(match[3], 10);
            
            // Basic date validation
            if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                const date = new Date(year, month, day);
                
                // Check if the date is valid (e.g., not Feb 30)
                if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                    // Format date for the hidden input
                    const isoDate = window.dateFns.format(date, 'yyyy-MM-dd');
                    document.getElementById(hiddenFieldId).value = isoDate;
                    return true;
                }
            }
        }
        return false;
    }

    // Function to create a simple date picker directly in the modal
    function openFinanceDatePicker(anchorElement, hiddenFieldId, displayFieldId) {
        // Remove any existing date picker
        const existingPicker = document.querySelector('.finance-date-picker-dropdown');
        if (existingPicker) {
            existingPicker.remove();
        }

        // Get current date from hidden input or default to today
        const currentValue = document.getElementById(hiddenFieldId).value;
        const selectedDate = currentValue ? new Date(currentValue) : new Date();
        let currentYear = selectedDate.getFullYear();
        let currentMonth = selectedDate.getMonth();
        const currentDay = selectedDate.getDate();

        // Create date picker container
        const datePickerContainer = document.createElement('div');
        datePickerContainer.className = 'finance-date-picker-dropdown';
        
        // Create a header with month/year selector
        const header = document.createElement('div');
        header.className = 'finance-date-picker-header';
        
        // Previous month button
        const prevMonthBtn = document.createElement('button');
        prevMonthBtn.innerHTML = '&laquo;';
        prevMonthBtn.type = 'button';
        prevMonthBtn.className = 'date-nav-btn';
        prevMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            updateCalendar(currentYear, currentMonth);
        });
        
        // Month/Year display
        const monthYearDisplay = document.createElement('span');
        monthYearDisplay.className = 'month-year-display';
        
        // Next month button
        const nextMonthBtn = document.createElement('button');
        nextMonthBtn.innerHTML = '&raquo;';
        nextMonthBtn.type = 'button';
        nextMonthBtn.className = 'date-nav-btn';
        nextMonthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            updateCalendar(currentYear, currentMonth);
        });
        
        header.appendChild(prevMonthBtn);
        header.appendChild(monthYearDisplay);
        header.appendChild(nextMonthBtn);
        
        // Create the calendar grid
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'finance-date-picker-grid';
        
        // Add day headers
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // Function to update the calendar display
        function updateCalendar(year, month) {
            // Update header
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                             'July', 'August', 'September', 'October', 'November', 'December'];
            monthYearDisplay.textContent = `${monthNames[month]} ${year}`;
            
            // Clear existing days
            while (calendarGrid.children.length > 7) {
                calendarGrid.removeChild(calendarGrid.lastChild);
            }
            
            // Get first day of month and number of days
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            // Add blank spaces for previous month days
            for (let i = 0; i < firstDay; i++) {
                const blankDay = document.createElement('div');
                blankDay.className = 'calendar-day empty';
                calendarGrid.appendChild(blankDay);
            }
            
            // Add days of current month
            for (let day = 1; day <= daysInMonth; day++) {
                const dayElement = document.createElement('div');
                dayElement.className = 'calendar-day';
                dayElement.textContent = day;
                
                // Highlight current selection
                if (year === currentYear && month === currentMonth && day === currentDay) {
                    dayElement.classList.add('selected');
                }
                
                // Add click handler to select date
                dayElement.addEventListener('click', () => {
                    const selectedDate = new Date(year, month, day);
                    
                    // Format date for both display and internal value
                    const isoDate = window.dateFns.format(selectedDate, 'yyyy-MM-dd');
                    const displayDate = window.dateFns.format(selectedDate, 'dd/MM/yyyy');
                    
                    // Update input fields
                    document.getElementById(hiddenFieldId).value = isoDate;
                    document.getElementById(displayFieldId).value = displayDate;
                    
                    // Remove date picker
                    datePickerContainer.remove();
                });
                
                calendarGrid.appendChild(dayElement);
            }
        }
        
        // Add all elements to container
        datePickerContainer.appendChild(header);
        datePickerContainer.appendChild(calendarGrid);
        
        // Add "Today" button at the bottom
        const todayButton = document.createElement('button');
        todayButton.type = 'button';
        todayButton.className = 'today-button';
        todayButton.textContent = 'Today';
        todayButton.addEventListener('click', () => {
            const today = new Date();
            
            // Format date for both display and internal value
            const isoDate = window.dateFns.format(today, 'yyyy-MM-dd');
            const displayDate = window.dateFns.format(today, 'dd/MM/yyyy');
            
            // Update input fields
            document.getElementById(hiddenFieldId).value = isoDate;
            document.getElementById(displayFieldId).value = displayDate;
            
            // Remove date picker
            datePickerContainer.remove();
        });
        datePickerContainer.appendChild(todayButton);
        
        // Position and show the date picker
        document.body.appendChild(datePickerContainer);
        
        // Center the date picker on screen, floating above the modal
        datePickerContainer.style.position = 'fixed';
        datePickerContainer.style.top = '50%';
        datePickerContainer.style.left = '50%';
        datePickerContainer.style.transform = 'translate(-50%, -50%)';
        datePickerContainer.style.zIndex = '2000'; // Higher z-index than the modal
        datePickerContainer.style.height = '420px';
        
        // Initialize the calendar
        updateCalendar(currentYear, currentMonth);
        
        // Close when clicking outside
        function handleOutsideClick(e) {
            if (!datePickerContainer.contains(e.target) && 
                e.target !== anchorElement) {
                datePickerContainer.remove();
                document.removeEventListener('click', handleOutsideClick);
            }
        }
        
        // Add a slight delay before adding the listener to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
    }
    
    // Export the public API
    return {
        init,
        updateFilter,
        showFinanceEntryModal
    };
})();