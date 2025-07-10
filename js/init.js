// --- Unpinned Pages Order Utilities ---
function getUnpinnedPagesOrder() {
  try {
    return JSON.parse(localStorage.getItem('unpinned-pages') || '[]');
  } catch {
    return [];
  }
}

function setUnpinnedPagesOrder(arr) {
  setStorage('unpinned-pages', JSON.stringify(arr));
}

// --- DEEP LINK HANDLER ---
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const plannerKey = params.get('plannerKey');
  if (view === 'weekly' && plannerKey) {
    appState.currentView = 'weekly';
    appState.currentDate = window.parsePlannerKeyToDate(plannerKey) || new Date();
  } else if (view && !plannerKey) {
    // Assume view is a page title
    appState.currentView = view;
  } else {
    // Fallback: default view (weekly planner)
    appState.currentView = 'weekly';
    appState.currentDate = new Date();
  }
}

// --- INITIALIZATION & APP ENTRY ---
function renderApp() {
  renderSidebar();
  renderView();
}

function renderView() {
  DOM.plannerView.classList.remove('active');
  DOM.libraryView.classList.remove('active');
  DOM.monthlyCalendarView.classList.remove('active'); // Hide monthly view by default

  if (appState.currentView === 'weekly') {
    renderWeeklyPlanner(true);
    DOM.plannerView.classList.add('active');
  } else if (appState.currentView === 'monthly') { // Handle monthly view
    renderMonthlyCalendar(appState.currentDate);
    DOM.monthlyCalendarView.classList.add('active');
  } else {
    renderLibraryPage(appState.currentView);
    DOM.libraryView.classList.add('active');
  }
  updateSidebarActiveState();
}

function renderSidebar() {
  const searchTerm = DOM.librarySearch.value.toLowerCase();
  const allPages = Object.keys(localStorage)
    .filter(key => key.startsWith('page-'))
    .map(key => key.substring(5))
    .filter(page => {
      if (!searchTerm) return true;
      // Check title
      if (page.toLowerCase().includes(searchTerm)) return true;
      // Check content
      const content = (localStorage.getItem('page-' + page) || '').toLowerCase();
      return content.includes(searchTerm);
    });
  const pinned = getPinnedPages().filter(page => allPages.includes(page));
  // Use custom order for unpinned pages, fallback to alpha for new
  let unpinnedOrder = getUnpinnedPagesOrder().filter(page => allPages.includes(page) && !pinned.includes(page));
  const unpinnedNew = allPages.filter(page => !pinned.includes(page) && !unpinnedOrder.includes(page)).sort();
  const unpinned = [...unpinnedOrder, ...unpinnedNew];
  let html = '';
  const renderPinBtn = (page) =>
    `<button class="page-action-btn pin" data-action="pin-page" data-page="${page}" title="${isPagePinned(page) ? 'Unpin' : 'Pin'}"><i data-feather="${isPagePinned(page) ? 'bookmark' : 'bookmark'}" class="${isPagePinned(page) ? 'filled': ''}"></i></button>`;
  // Add draggable and data-index for pinned items
  const renderItem = (page, idx, isPinned, isUnpinned) => `
    <li class="library-page-item${isPinned ? ' pinned' : ''}${isUnpinned ? ' unpinned' : ''}"${(isPinned || isUnpinned) ? ` draggable=\"true\" data-index=\"${idx}\"` : ''} data-page="${page}">
      <a href="#" data-view="${page}">${page}</a>
      <div class="page-actions">
        ${renderPinBtn(page)}
        <button class="page-action-btn rename" data-action="rename-page" data-page="${page}" title="Rename"><i data-feather="edit-2"></i></button>
        <button class="page-action-btn delete" data-action="delete-page" data-page="${page}" title="Delete"><i data-feather="x"></i></button>
      </div>
    </li>
  `;
  if (pinned.length + unpinned.length > 0) {
    if (pinned.length > 0) {
      html += pinned.map((page, idx) => renderItem(page, idx, true, false)).join('');
    }
    if (unpinned.length > 0) {
      html += unpinned.map((page, idx) => renderItem(page, idx, false, true)).join('');
    }
  } else {
    html += '<li class="empty-library">No pages yet</li>';
  }
  DOM.libraryNavList.innerHTML = html;
  if (window.feather) feather.replace();
  updateSidebarActiveState();

  // --- Drag and drop handlers for pinned and unpinned items ---
  setupDragAndDrop('pinned', pinned, getPinnedPages, setPinnedPages);
  setupDragAndDrop('unpinned', unpinned, getUnpinnedPagesOrder, setUnpinnedPagesOrder);
}

function setupDragAndDrop(itemType, itemsArray, getData, setData) {
  // A single state object to track the drag operation
  let dragState = {
    isDragging: false,
    dragItem: null,    // The <li> element being dragged
    placeholder: null,
    dragTimer: null,
  };

  const items = DOM.libraryNavList.querySelectorAll(`.library-page-item.${itemType}`);

  // --- Attach Event Listeners ---
  items.forEach(item => {
    // Native HTML5 Drag & Drop for Mouse
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);
    item.addEventListener('dragend', onDragEnd);

    // Touch events for Mobile "Hold and Drag"
    item.addEventListener('touchstart', onTouchStart, { passive: true });
    item.addEventListener('touchend', onTouchEnd);
    item.addEventListener('touchcancel', onTouchEnd);
  });

  // --- Reordering Logic ---
  function handleReorder(draggedPage, targetPage) {
    if (draggedPage === targetPage) return; // Dropped on itself

    let currentItems = getData(); // Get the latest array from storage
    const srcIdx = currentItems.indexOf(draggedPage);
    if (srcIdx === -1) return; // Item not found

    // Remove item from its current position
    const [moved] = currentItems.splice(srcIdx, 1);

    if (targetPage) {
      const targetIdx = currentItems.indexOf(targetPage);
      if (targetIdx > -1) {
        // Insert before the target
        currentItems.splice(targetIdx, 0, moved);
      } else {
        // Target not found (edge case), append to the end
        currentItems.push(moved);
      }
    } else {
      // No target page means dropping at the end of the list
      currentItems.push(moved);
    }
    
    setData(currentItems);
    renderSidebar(); // Re-render to show new order and re-attach listeners
  }

  // --- Native HTML5 Drag Handlers (for Mouse) ---
  function onDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.page);
    // Add dragging class for visual feedback
    setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  }

  function onDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  }

  function onDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const draggedPage = e.dataTransfer.getData('text/plain');
    const targetPage = e.currentTarget.dataset.page;
    handleReorder(draggedPage, targetPage);
  }

  function onDragEnd(e) {
    cleanup();
  }

  // --- Touch Event Handlers (for Mobile) ---
    // --- Touch Event Handlers (for Mobile) ---
  function onTouchStart(e) {
    dragState.dragItem = e.currentTarget;
    // Start drag after a long press (e.g., 500ms) to allow for scrolling
    dragState.dragTimer = setTimeout(() => {
      dragState.isDragging = true;
      dragState.dragItem.classList.add('dragging');

      // Create a placeholder
      dragState.placeholder = document.createElement('li');
      dragState.placeholder.className = 'placeholder';
      dragState.placeholder.style.height = `${dragState.dragItem.offsetHeight}px`;
      
      // Set the placeholder's text to match the dragged item's page name
      dragState.placeholder.textContent = dragState.dragItem.dataset.page;

      dragState.dragItem.parentNode.insertBefore(dragState.placeholder, dragState.dragItem);

      // Add global listeners to track finger movement outside the original item
      document.addEventListener('touchmove', onTouchMove, { passive: false });
    }, 500);
  }

  function onTouchMove(e) {
    if (!dragState.isDragging) return;
    e.preventDefault(); // Prevent scrolling while dragging

    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropTarget = targetElement ? targetElement.closest(`.library-page-item.${itemType}`) : null;

    if (dropTarget && dropTarget !== dragState.dragItem) {
      const rect = dropTarget.getBoundingClientRect();
      // Determine if touch is in the top or bottom half of the target item
      const nextSibling = (touch.clientY > rect.top + rect.height / 2) ? dropTarget.nextSibling : dropTarget;
      dropTarget.parentNode.insertBefore(dragState.placeholder, nextSibling);
    }
  }

  function onTouchEnd(e) {
    // Clear the long-press timer if the touch ends before it fires
    clearTimeout(dragState.dragTimer);

    if (dragState.isDragging) {
      const draggedPage = dragState.dragItem.dataset.page;
      // The element after the placeholder is our target
      let nextEl = dragState.placeholder.nextElementSibling;
      // If the next element is the item we were dragging, get the one after it
      if (nextEl === dragState.dragItem) {
        nextEl = nextEl.nextElementSibling;
      }
      const targetPage = nextEl ? nextEl.dataset.page : null;
      handleReorder(draggedPage, targetPage);
    }
    // Always run cleanup
    cleanup();
  }

  // --- Helper & Cleanup Functions ---
  function cleanup() {
    // Clear long-press timer
    if (dragState.dragTimer) {
      clearTimeout(dragState.dragTimer);
    }
    // Remove global touch listeners
    document.removeEventListener('touchmove', onTouchMove);

    // Remove all visual styles and placeholders
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    if (dragState.placeholder) {
      dragState.placeholder.remove();
    }

    // Reset the state object for the next operation
    dragState = {
      isDragging: false,
      dragItem: null,
      placeholder: null,
      dragTimer: null
    };
  }
}

function updateSidebarActiveState() {
    document.querySelectorAll('#sidebar a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`#sidebar a[data-view="${appState.currentView}"]`);
    if (activeLink) activeLink.classList.add('active');
}

function init() {
  setTheme(getPreferredTheme());
  handleDeepLink();
  getSampleData();
  
  // Initialize Notification Manager
  if (window.NotificationManager) {
    window.NotificationManager.init();
  }
  // --- Ensure push token is registered on app load if notifications are granted and user is signed in ---
  if (window.firebase && window.subscribeUserToPush && window.firebase.auth) {
    
    window.firebase.auth().onAuthStateChanged(function(user) {
      
      if (user && Notification.permission === 'granted') {
        
        window.subscribeUserToPush();
      }
    });
  }
  renderApp();
  addMonthYearDropdownListeners();
}

init();

// --- Debounced Sidebar Search Setup ---
if (DOM.librarySearch) {
  DOM.librarySearch.removeEventListener('_debouncedInput', DOM._debouncedSidebarHandler || (()=>{}));
  DOM._debouncedSidebarHandler = debounce(renderSidebar, 200);
  DOM.librarySearch.addEventListener('input', DOM._debouncedSidebarHandler);
}
