// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('service-worker.js').then(function (registration) {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, function (err) {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

// Firebase configuration and initialization
var firebaseConfig = {
  apiKey: "AIzaSyAW8rAegPAaeNltFOSBOii8GISykx3S7eU",
  authDomain: "focal-journal-app.firebaseapp.com",
  projectId: "focal-journal-app",
  storageBucket: "focal-journal-app.firebasestorage.app",
  messagingSenderId: "454247718929",
  appId: "1:454247718929:web:513ba2cbe7dc1f9e0fd1b0"
};
firebase.initializeApp(firebaseConfig);

// Feather Icons replacement
if (window.feather) feather.replace();