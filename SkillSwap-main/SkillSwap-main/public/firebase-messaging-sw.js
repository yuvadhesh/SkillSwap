// Scripts for firebase and firebase-messaging
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Default dummy configuration, must be replaced by the user's actual config
// In a real production build, these values can be injected during the build process
const firebaseConfig = {
  apiKey: "dummy_api_key",
  authDomain: "dummy_auth_domain",
  projectId: "dummy_project_id",
  storageBucket: "dummy_storage_bucket",
  messagingSenderId: "dummy_sender_id",
  appId: "dummy_app_id"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title || 'SkillSwap Notification';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
