importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDzfWF3Bt_JRSz1a_PIieo8troLfkglzDE",
  authDomain: "footfield-db573.firebaseapp.com",
  projectId: "footfield-db573",
  storageBucket: "footfield-db573.firebasestorage.app",
  messagingSenderId: "843846666103",
  appId: "1:843846666103:web:9446c24d839f2b1be78372"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Required for PWA Installability (PWABuilder checks for a fetch listener)
self.addEventListener('fetch', function(event) {
  // Trình duyệt sẽ tự động xử lý request (Bypass)
  // Nhưng bắt buộc phải có listener này để đạt chuẩn PWA
});
