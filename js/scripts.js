// List of script files to load
const scripts = [
  "js/firebase.js",
  "js/state.js",
  "js/dom.js",
  "js/utils.js",
  "js/notifications.js",
  "js/markdown.js",
  "js/planner.js",
  "js/library.js",
  "js/calendar.js",
  "js/cloud.js",
  "js/datePicker.js",
  "js/init.js",
  "js/events.js",
  "js/settings.js"
];

// Dynamically load each script
scripts.forEach((src) => {
  const script = document.createElement("script");
  script.src = src;
  script.defer = false; // Ensures scripts are executed in order
  document.body.appendChild(script);
});