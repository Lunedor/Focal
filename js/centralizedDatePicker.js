// js/centralizedDatePicker.js
// Centralized Date Picker System for Focal Journal
// Combines functionality from finance, futurelog, and toolbar date pickers

const CentralizedDatePicker = (() => {
    // Configuration constants
    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    
    // Current picker instance tracking
    let currentPicker = null;
    
    /**
     * Shows a modal-style date picker (for finance/futurelog modals)
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.anchorElement - Element that triggered the picker
     * @param {string} options.hiddenFieldId - ID of hidden input field to update
     * @param {string} options.displayFieldId - ID of display input field to update
     * @param {boolean} options.isAnnual - Whether to show annual format (DD/MM instead of DD/MM/YYYY)
     * @param {Date} options.initialDate - Initial date to select
     * @param {string} options.theme - Theme prefix for CSS classes ('finance', 'futurelog', etc.)
     * @param {function} options.onDateSelected - Callback when date is selected
     */
    function showModalDatePicker(options = {}) {
        const {
            anchorElement,
            hiddenFieldId,
            displayFieldId,
            isAnnual = false,
            initialDate = new Date(),
            theme = 'unified',
            onDateSelected
        } = options;
        
        // Remove any existing picker
        if (currentPicker) {
            currentPicker.remove();
            currentPicker = null;
        }
        
        // Get current date from hidden input or use initialDate
        let selectedDate = initialDate;
        if (hiddenFieldId) {
            const currentValue = document.getElementById(hiddenFieldId)?.value;
            if (currentValue) {
                selectedDate = new Date(currentValue);
            }
        }
        
        let currentYear = selectedDate.getFullYear();
        let currentMonth = selectedDate.getMonth();
        const currentDay = selectedDate.getDate();
        
        // Create date picker container
        const datePickerContainer = document.createElement('div');
        datePickerContainer.className = `${theme}-date-picker-dropdown unified-date-picker`;
        
        // Create header with navigation
        const header = document.createElement('div');
        header.className = `${theme}-date-picker-header unified-date-picker-header`;
        
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
        
        // Create calendar grid
        const calendarGrid = document.createElement('div');
        calendarGrid.className = `${theme}-date-picker-grid unified-date-picker-grid`;
        
        // Add day headers
        DAY_NAMES.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });
        
        // Function to update calendar display
        function updateCalendar(year, month) {
            // Update header
            monthYearDisplay.textContent = `${MONTH_NAMES[month]} ${year}`;
            
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
                if (year === selectedDate.getFullYear() && month === selectedDate.getMonth() && day === currentDay) {
                    dayElement.classList.add('selected');
                }
                
                // Add click handler to select date
                dayElement.addEventListener('click', () => {
                    const pickedDate = new Date(year, month, day);
                    handleDateSelection(pickedDate);
                });
                
                calendarGrid.appendChild(dayElement);
            }
        }
        
        // Handle date selection
        function handleDateSelection(pickedDate) {
            // Format date for both display and internal value
            const isoDate = window.dateFns ? 
                window.dateFns.format(pickedDate, 'yyyy-MM-dd') : 
                pickedDate.toISOString().split('T')[0];
            
            let displayDate;
            if (isAnnual) {
                displayDate = window.dateFns ? 
                    window.dateFns.format(pickedDate, 'dd/MM') : 
                    `${pickedDate.getDate().toString().padStart(2, '0')}/${(pickedDate.getMonth() + 1).toString().padStart(2, '0')}`;
            } else {
                displayDate = window.dateFns ? 
                    window.dateFns.format(pickedDate, 'dd/MM/yyyy') : 
                    `${pickedDate.getDate().toString().padStart(2, '0')}/${(pickedDate.getMonth() + 1).toString().padStart(2, '0')}/${pickedDate.getFullYear()}`;
            }
            
            // Update input fields if provided
            if (hiddenFieldId) {
                const hiddenField = document.getElementById(hiddenFieldId);
                if (hiddenField) hiddenField.value = isoDate;
            }
            
            if (displayFieldId) {
                const displayField = document.getElementById(displayFieldId);
                if (displayField) displayField.value = displayDate;
            }
            
            // Call custom callback if provided
            if (onDateSelected) {
                onDateSelected({ isoDate, displayDate, pickedDate });
            }
            
            // Remove date picker
            datePickerContainer.remove();
            currentPicker = null;
        }
        
        // Add all elements to container
        datePickerContainer.appendChild(header);
        datePickerContainer.appendChild(calendarGrid);
        
        // Add "Today" button at the bottom (unless it's annual date)
        if (!isAnnual) {
            const todayButton = document.createElement('button');
            todayButton.type = 'button';
            todayButton.className = 'today-button';
            todayButton.textContent = 'Today';
            todayButton.addEventListener('click', () => {
                handleDateSelection(new Date());
            });
            datePickerContainer.appendChild(todayButton);
        }
        
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
        
        // Store current picker reference
        currentPicker = datePickerContainer;
        
        // Close when clicking outside
        function handleOutsideClick(e) {
            if (!datePickerContainer.contains(e.target) && 
                e.target !== anchorElement) {
                datePickerContainer.remove();
                currentPicker = null;
                document.removeEventListener('click', handleOutsideClick);
            }
        }
        
        // Add a slight delay before adding the listener to prevent immediate closing
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
        }, 10);
        
        return datePickerContainer;
    }
    
    /**
     * Shows a toolbar-style date picker (for toolbar integration)
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.anchor - Anchor element for positioning
     * @param {boolean} options.withTime - Whether to include time selection
     * @param {function} options.onDateSelected - Callback when date is selected
     */
    function showToolbarDatePicker(options = {}) {
        const { anchor, withTime = false, onDateSelected } = options;
        
        return new Promise((resolve) => {
            // Remove any existing picker
            if (currentPicker) {
                currentPicker.remove();
                currentPicker = null;
            }
            
            // Find toolbar
            let toolbar = anchor ? anchor.closest('.markdown-toolbar') : null;
            if (!toolbar) toolbar = document.querySelector('.markdown-toolbar');
            if (!toolbar) return resolve(null);
            
            // Remove any existing picker in the toolbar
            toolbar.querySelectorAll('.fj-date-picker-popup').forEach(e => e.remove());
            
            // Create dropdown popup
            const popup = document.createElement('div');
            popup.className = 'fj-date-picker-popup unified-date-picker-toolbar';
            
            // Date and time container
            const mainCol = document.createElement('div');
            mainCol.style.display = 'flex';
            mainCol.style.flexDirection = 'column';
            mainCol.style.alignItems = 'center';
            mainCol.style.gap = '0.2em';
            
            // Date row
            const dateRow = document.createElement('div');
            dateRow.className = 'fj-date-picker-date-row';
            const now = new Date();
            
            // Initialize date/time values
            let year = now.getFullYear();
            let month = now.getMonth() + 1;
            let day = now.getDate();
            let hour = now.getHours();
            let minute = Math.floor(now.getMinutes() / 5) * 5;
            
            // Create dropdowns using the existing createCustomDropdown function
            const yearOptions = [];
            for (let y = now.getFullYear() - 50; y <= now.getFullYear() + 10; y++) {
                yearOptions.push({ value: y, label: y.toString() });
            }
            const yearDropdown = createCustomDropdown({
                options: yearOptions,
                value: year,
                id: 'fj-date-picker-year',
                width: 70,
                onChange: v => { year = v; }
            });
            
            // Month dropdown
            const monthOptions = [];
            for (let m = 1; m <= 12; m++) {
                monthOptions.push({ value: m, label: m.toString().padStart(2, '0') });
            }
            const monthDropdown = createCustomDropdown({
                options: monthOptions,
                value: month,
                id: 'fj-date-picker-month',
                width: 50,
                onChange: v => { month = v; }
            });
            
            // Day dropdown
            const dayOptions = [];
            for (let d = 1; d <= 31; d++) {
                dayOptions.push({ value: d, label: d.toString().padStart(2, '0') });
            }
            const dayDropdown = createCustomDropdown({
                options: dayOptions,
                value: day,
                id: 'fj-date-picker-day',
                width: 50,
                onChange: v => { day = v; }
            });
            
            dateRow.appendChild(yearDropdown);
            dateRow.appendChild(monthDropdown);
            dateRow.appendChild(dayDropdown);
            mainCol.appendChild(dateRow);
            
            // Time toggle row
            const timeToggleLabel = document.createElement('label');
            timeToggleLabel.className = 'fj-date-picker-time-toggle';
            const timeToggle = document.createElement('input');
            timeToggle.type = 'checkbox';
            timeToggle.checked = withTime;
            timeToggleLabel.appendChild(timeToggle);
            
            // Add clock SVG icon
            const clockIcon = document.createElement('span');
            clockIcon.className = 'fj-date-picker-time-icon';
            clockIcon.innerHTML = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em"><circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 5.5V10l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
            timeToggleLabel.appendChild(clockIcon);
            mainCol.appendChild(timeToggleLabel);
            
            // Time row (initially created but only shown if checked)
            const timeRow = document.createElement('div');
            timeRow.className = 'fj-date-picker-time-row';
            let hourDropdown, minuteDropdown, colonNode;
            
            function addTimeInputs() {
                if (hourDropdown) return; // already added
                
                // Hour dropdown
                const hourOptions = [];
                for (let h = 0; h < 24; h++) {
                    hourOptions.push({ value: h, label: h.toString().padStart(2, '0') });
                }
                hourDropdown = createCustomDropdown({
                    options: hourOptions,
                    value: hour,
                    id: 'fj-date-picker-hour',
                    width: 50,
                    onChange: v => { hour = v; }
                });
                
                // Minute dropdown
                const minuteOptions = [];
                for (let m = 0; m < 60; m += 5) {
                    minuteOptions.push({ value: m, label: m.toString().padStart(2, '0') });
                }
                minuteDropdown = createCustomDropdown({
                    options: minuteOptions,
                    value: minute,
                    id: 'fj-date-picker-minute',
                    width: 50,
                    onChange: v => { minute = v; }
                });
                
                colonNode = document.createElement('span');
                colonNode.textContent = ':';
                colonNode.style.margin = '0 2px';
                
                timeRow.appendChild(hourDropdown);
                timeRow.appendChild(colonNode);
                timeRow.appendChild(minuteDropdown);
                
                if (!mainCol.contains(timeRow)) mainCol.appendChild(timeRow);
            }
            
            function removeTimeInputs() {
                if (hourDropdown && hourDropdown.parentNode === timeRow) timeRow.removeChild(hourDropdown);
                if (colonNode && colonNode.parentNode === timeRow) timeRow.removeChild(colonNode);
                if (minuteDropdown && minuteDropdown.parentNode === timeRow) timeRow.removeChild(minuteDropdown);
                hourDropdown = minuteDropdown = colonNode = null;
                if (mainCol.contains(timeRow)) mainCol.removeChild(timeRow);
            }
            
            if (withTime) addTimeInputs();
            
            timeToggle.addEventListener('change', () => {
                if (timeToggle.checked) {
                    addTimeInputs();
                } else {
                    removeTimeInputs();
                }
            });
            
            // Add mainCol to popup before OK button
            popup.appendChild(mainCol);
            
            // OK button
            const okBtn = document.createElement('button');
            okBtn.textContent = 'OK';
            okBtn.className = 'fj-date-picker-ok';
            popup.appendChild(okBtn);
            
            okBtn.onclick = (e) => {
                e.stopPropagation();
                let dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                let timeStr = '';
                if (timeToggle.checked && hourDropdown && minuteDropdown) {
                    timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                }
                
                const result = { date: dateStr, time: timeStr, withTime: timeToggle.checked };
                
                // Call custom callback if provided
                if (onDateSelected) {
                    onDateSelected(result);
                }
                
                popup.remove();
                currentPicker = null;
                resolve(result);
            };
            
            // Prevent click from propagating to outside click handlers
            popup.addEventListener('mousedown', e => e.stopPropagation());
            popup.addEventListener('click', e => e.stopPropagation());
            
            // Add to toolbar and position below the anchor button
            toolbar.appendChild(popup);
            currentPicker = popup;
            
            if (anchor) {
                const rect = anchor.getBoundingClientRect();
                const toolbarRect = toolbar.getBoundingClientRect();
                popup.style.top = `${rect.bottom - toolbarRect.top + 4}px`;
                popup.style.left = `${rect.left - toolbarRect.left + 80}px`;
                popup.style.transform = '';
            } else {
                popup.style.top = '32px';
                popup.style.left = '80px';
                popup.style.transform = '';
            }
            
            // Focus first dropdown
            const firstDropdown = popup.querySelector('.fj-custom-dropdown');
            if (firstDropdown) firstDropdown.focus();
            
            // Remove popup if clicking outside
            function handleDocPointerDown(e) {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    currentPicker = null;
                    document.removeEventListener('pointerdown', handleDocPointerDown, true);
                    resolve(null);
                }
            }
            
            setTimeout(() => {
                document.addEventListener('pointerdown', handleDocPointerDown, true);
            }, 0);
        });
    }
    
    /**
     * Utility function to create a custom dropdown (from existing datePicker.js)
     */
    function createCustomDropdown({options, value, onChange, id, width = 60, maxHeight = 200, align = 'center'}) {
        const wrapper = document.createElement('div');
        wrapper.className = 'fj-custom-dropdown';
        wrapper.tabIndex = 0;
        if (id) wrapper.id = id;
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.width = width + 'px';

        const selected = document.createElement('div');
        selected.className = 'fj-custom-dropdown-selected';
        selected.textContent = options.find(o => o.value === value)?.label || '';
        selected.style.cursor = 'pointer';
        selected.style.userSelect = 'none';
        selected.style.padding = '5px 10px';
        selected.style.border = '1px solid var(--color-border, #ccc)';
        selected.style.borderRadius = '6px';
        selected.style.background = 'var(--color-select-bg, var(--color-background, #f7f7f7))';
        selected.style.color = 'var(--color-select-text, var(--color-text, #222))';
        selected.style.textAlign = align;
        selected.style.fontSize = '0.95em';
        selected.style.minWidth = '48px';
        selected.style.position = 'relative';
        selected.style.zIndex = 1;

        // Dropdown arrow
        const arrow = document.createElement('span');
        arrow.innerHTML = '&#9662;';
        arrow.style.marginLeft = '0.5em';
        arrow.style.fontSize = '0.8em';
        selected.appendChild(arrow);

        // Dropdown list
        const list = document.createElement('div');
        list.className = 'fj-custom-dropdown-list';
        list.style.position = 'absolute';
        list.style.left = 0;
        list.style.right = 0;
        list.style.top = '110%';
        list.style.background = 'var(--color-background, #fff)';
        list.style.border = '1px solid var(--color-border, #ccc)';
        list.style.borderRadius = '6px';
        list.style.boxShadow = '0 2px 12px rgba(0,0,0,0.10)';
        list.style.maxHeight = maxHeight + 'px';
        list.style.overflowY = 'auto';
        list.style.display = 'none';
        list.style.zIndex = 10001;

        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'fj-custom-dropdown-item';
            item.textContent = opt.label;
            item.style.padding = '5px 10px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '0.95em';
            if (opt.value === value) {
                item.style.background = 'var(--color-background, #e6f0ff)';
            }
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                selected.textContent = opt.label;
                selected.appendChild(arrow);
                list.style.display = 'none';
                onChange(opt.value);
            });
            list.appendChild(item);
        });

        selected.addEventListener('click', (e) => {
            e.stopPropagation();
            list.style.display = list.style.display === 'block' ? 'none' : 'block';
        });
        
        wrapper.addEventListener('blur', () => {
            setTimeout(() => { list.style.display = 'none'; }, 100);
        });
        
        wrapper.appendChild(selected);
        wrapper.appendChild(list);
        return wrapper;
    }
    
    // Public API
    return {
        showModalDatePicker,
        showToolbarDatePicker,
        
        // Convenience methods for backward compatibility
        showFinanceDatePicker: (anchorElement, hiddenFieldId, displayFieldId) => {
            return showModalDatePicker({
                anchorElement,
                hiddenFieldId,
                displayFieldId,
                theme: 'finance'
            });
        },
        
        showFuturelogDatePicker: (anchorElement, hiddenFieldId, displayFieldId, isAnnual = false) => {
            return showModalDatePicker({
                anchorElement,
                hiddenFieldId,
                displayFieldId,
                isAnnual,
                theme: 'futurelog'
            });
        },
        
        // For toolbar integration
        showDateTimePicker: showToolbarDatePicker
    };
})();

// Make it globally available
window.CentralizedDatePicker = CentralizedDatePicker;

// Maintain backward compatibility by replacing the existing toolbar function
window.showDateTimePicker = CentralizedDatePicker.showToolbarDatePicker;
