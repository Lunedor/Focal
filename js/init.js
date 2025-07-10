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
    dragType: null,    // 'pinned' or 'unpinned'
    placeholder: null,
  };

  const items = DOM.libraryNavList.querySelectorAll(`.library-page-item.${itemType}`);

  // --- Attach Event Listeners ---
  items.forEach(item => {
    // Both mouse and touch start here
    item.addEventListener('pointerdown', onPointerDown);

    // Only for native mouse drag-and-drop
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);
    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragend', onDragEnd);
  });

  // --- Event Handler Functions ---

  function onPointerDown(e) {
    // Ignore right-clicks or non-primary pointers
    if (e.button !== 0 || !e.isPrimary) return;

    // For touch, we need to manually start the drag after a delay
    if (e.pointerType === 'touch') {
      dragState.dragItem = e.currentTarget;

      // Listen on the window to track movement anywhere on the screen
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);

      // Start a timer to differentiate a tap/click from a drag
      dragState.dragTimer = setTimeout(() => {
        // If the timer completes, we are officially dragging
        startTouchDrag();
      }, 200);
    } else {
      // For mouse, we just enable the native draggable attribute.
      // The browser will then fire the 'dragstart' event.
      e.currentTarget.draggable = true;
    }
  }

  function onPointerMove(e) {
    // This function is ONLY for touch dragging
    if (!dragState.isDragging) {
      // If the user moves their finger too much, cancel the drag timer
      if (dragState.dragTimer) {
        clearTimeout(dragState.dragTimer);
        dragState.dragTimer = null;
      }
      return;
    }

    // Prevent page scrolling while dragging
    e.preventDefault();

    // Find what element is under the finger
    const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
    const dropTarget = elementBelow?.closest(`.library-page-item.${itemType}`);

    // Update the visual "drag-over" indicator
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    if (dropTarget && dropTarget !== dragState.dragItem) {
      dropTarget.classList.add('drag-over');
    }
  }
  
  // --- Also, replace the onPointerUp function ---

  function onPointerUp(e) {
    // This function is ONLY for touch dragging
    if (dragState.dragTimer) {
      clearTimeout(dragState.dragTimer);
      dragState.dragTimer = null;
    }

    if (dragState.isDragging) {
      // This was a touch drag, so we handle the drop logic here
      const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
      const dropTarget = elementBelow?.closest(`.library-page-item.${itemType}`);
      
      if (dropTarget) {
        // reorderItems will now handle its own cleanup
        reorderItems(dragState.dragItem, dropTarget);
      } else {
        // If we didn't drop on a valid target, we still need to clean up.
        cleanup();
      }
    } else {
      // If we weren't even dragging (i.e., it was a tap), we still might have
      // active window listeners that need to be removed.
      cleanup();
    }
  }

  // --- Native HTML5 Drag Handlers (for Mouse) ---

  function onDragStart(e) {
    // Set the data to be transferred
    e.dataTransfer.effectAllowed = 'move';
    const pageName = e.currentTarget.dataset.page;
    e.dataTransfer.setData('text/plain', pageName);

    // Add a class for visual feedback
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
    const draggedPage = e.dataTransfer.getData('text/plain');
    const sourceItem = DOM.libraryNavList.querySelector(`[data-page="${draggedPage}"]`);
    const targetItem = e.currentTarget;
    
    if (sourceItem && targetItem && sourceItem !== targetItem) {
        reorderItems(sourceItem, targetItem);
    }
  }

  function onDragEnd(e) {
    // This is the native equivalent of cleanup for mouse
    e.currentTarget.draggable = false;
    cleanup();
  }

  // --- Helper Functions ---

  function startTouchDrag() {
    if (!dragState.dragItem) return;
    dragState.isDragging = true;

    // Create placeholder and apply styles
    dragState.dragItem.classList.add('dragging');
    const placeholder = dragState.dragItem.cloneNode(true);
    placeholder.classList.add('drag-placeholder');
    dragState.dragItem.parentNode.insertBefore(placeholder, dragState.dragItem);
    dragState.placeholder = placeholder;
    dragState.dragItem.style.opacity = '0.5';
    document.body.style.userSelect = 'none'; // Prevent text selection
  }

  function reorderItems(sourceItem, targetItem) {
    const draggedPage = sourceItem.dataset.page;
    const targetPage = targetItem.dataset.page;

    // Create a mutable copy of the array for this item type
    let currentItems = itemsArray.slice();

    const srcIdx = currentItems.indexOf(draggedPage);
    const targetIdx = currentItems.indexOf(targetPage);

    if (srcIdx > -1 && targetIdx > -1) {
      cleanup();
      
      // Perform the reorder
      const [moved] = currentItems.splice(srcIdx, 1);
      currentItems.splice(targetIdx, 0, moved);

      // Save the new order and re-render the sidebar onto a clean DOM
      setData(currentItems);
      renderSidebar();
    }
  }

 

  function cleanup() {
    // Remove all visual styles and placeholders
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    
    if (dragState.placeholder) {
      dragState.placeholder.remove();
    }
    if (dragState.dragItem) {
      dragState.dragItem.style.opacity = '';
    }
    document.body.style.userSelect = '';

    // Remove temporary window listeners for touch
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);

    // Reset the state object for the next operation
    dragState = {
      isDragging: false,
      dragItem: null,
      dragType: null,
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
