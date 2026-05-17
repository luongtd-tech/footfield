importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyA7wuA3sLG2QL5idrX045wkqDgoSxq-m34",
  authDomain: "footfield-main.firebaseapp.com",
  projectId: "footfield-main",
  storageBucket: "footfield-main.firebasestorage.app",
  messagingSenderId: "552118678982",
  appId: "1:552118678982:web:b0c24998138feb37bdeec7"
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
