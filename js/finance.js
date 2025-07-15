// js/finance.js
// Simple Finance widget wrapper using MainWidget

const financeTracker = {
    init(options) {
        const container = options.placeholder;
        const command = options.command || '';
        const dataStr = options.transactions || '';
        const onCommandChange = options.onCommandChange || null;
        console.log('[FinanceWidget] financeTracker.init called. window.MainWidget:', typeof window.MainWidget);
        if (window.MainWidget) {
            const layout = (window.MainWidget.parseCommand(command, 'finance').settings.layout || '').toLowerCase();
            const requested = layout.split('+').map(s => s.trim());
            container.innerHTML = '';
            requested.forEach(type => {
                const widgetDiv = document.createElement('div');
                if (type === 'summary' && typeof window.MainWidget.renderSummary === 'function') {
                    window.MainWidget.renderSummary(widgetDiv, 'finance', command, dataStr, onCommandChange);
                } else if (type === 'chart' && typeof window.MainWidget.renderChart === 'function') {
                    window.MainWidget.renderChart(widgetDiv, 'finance', command, dataStr, onCommandChange);
                } else if (type === 'chartpie' && typeof window.MainWidget.renderPie === 'function') {
                    window.MainWidget.renderPie(widgetDiv, 'finance', command, dataStr, onCommandChange);
                }
                container.appendChild(widgetDiv);
            });
        } else {
            console.error('[FinanceWidget] MainWidget not loaded', window.MainWidget);
            container.innerHTML = '<div class="widget-error">MainWidget not loaded</div>';
        }
    }
};