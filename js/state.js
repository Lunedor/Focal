// --- STATE & CONSTANTS ---
const appState = {
  currentDate: new Date(),
  currentView: 'weekly', // 'weekly' or a page title
  activeEditorKey: null,
  activeEditorWrapper: null, // The DOM element of the current editor's wrapper
};

const PLANNER_BOXES = [
    { id: 'monday', title: 'Monday', class: 'day' },
    { id: 'tuesday', title: 'Tuesday', class: 'day' },
    { id: 'wednesday', title: 'Wednesday', class: 'day' },
    { id: 'thursday', title: 'Thursday', class: 'day' },
    { id: 'friday', title: 'Friday', class: 'day' },
    { id: 'saturday', title: 'Saturday', class: 'saturday' },
    { id: 'sunday', title: 'Sunday', class: 'sunday' }
];
