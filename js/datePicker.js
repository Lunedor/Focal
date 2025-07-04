// Custom 24h Date/Time Picker for Focal Journal
// Usage: showDateTimePicker({ withTime: true/false }).then(({date, time}) => ...)


// --- Custom Dropdown Component ---
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
      item.style.background = 'var(--color-accent, #e6f0ff)';
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

window.showDateTimePicker = function({ withTime = false, anchor = null } = {}) {
  return new Promise((resolve) => {
    // Remove any existing picker in the toolbar
    let toolbar = anchor ? anchor.closest('.markdown-toolbar') : null;
    if (!toolbar) toolbar = document.querySelector('.markdown-toolbar');
    if (!toolbar) return resolve(null);
    toolbar.querySelectorAll('.fj-date-picker-popup').forEach(e => e.remove());

    // Create dropdown popup
    const popup = document.createElement('div');
    popup.className = 'fj-date-picker-popup';

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
    // Year dropdown
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let hour = now.getHours();
    let minute = Math.floor(now.getMinutes() / 5) * 5;

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
      popup.remove();
      resolve({ date: dateStr, time: timeStr, withTime: timeToggle.checked });
    };

    // Prevent click from propagating to outside click handlers
    popup.addEventListener('mousedown', e => e.stopPropagation());
    popup.addEventListener('click', e => e.stopPropagation());

    // Add to toolbar and position below the anchor button
    toolbar.appendChild(popup);
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      popup.style.top = `${rect.bottom - toolbarRect.top + 4}px`;
      popup.style.left = `${rect.left - toolbarRect.left}px`;
      popup.style.transform = '';
    } else {
      popup.style.top = '32px';
      popup.style.left = '0px';
      popup.style.transform = '';
    }
    // Focus first dropdown
    const firstDropdown = popup.querySelector('.fj-custom-dropdown');
    if (firstDropdown) firstDropdown.focus();

    // Remove popup if clicking outside (toolbar logic)
    function handleDocPointerDown(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('pointerdown', handleDocPointerDown, true);
        resolve(null);
      }
    }
    setTimeout(() => {
      document.addEventListener('pointerdown', handleDocPointerDown, true);
    }, 0);
  });
};
