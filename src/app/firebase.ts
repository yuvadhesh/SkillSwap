// import { initializeApp } from "firebase/app";
// import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Dummy config to be replaced by the user with their Firebase Project Config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy_api_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy_auth_domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy_project_id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy_storage_bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "dummy_sender_id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "dummy_app_id"
};

// Initialize Firebase
// const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging: any = null;

try {
  // getMessaging() is only supported in browser contexts that support the Push API
  // if (typeof window !== "undefined" && "Notification" in window) {
  //   messaging = getMessaging(app);
  // }
} catch (e) {
  console.warn("Firebase Messaging initialization failed:", e);
}

export const requestFirebaseToken = async () => {
  if (!messaging) return null;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // The user needs to provide their VAPID key in .env to get tokens successfully
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      
      if (!vapidKey) {
        console.warn('FCM VAPID key missing. Push notifications won\'t generate tokens properly.');
        return null;
      }
      
      // const token = await getToken(messaging, { vapidKey });
      // return token;
      return null;
    }
  } catch (error) {
    console.error('An error occurred while retrieving token:', error);
  }
  return null;
};

export const onMessageListener = () => {
  if (!messaging) return new Promise((resolve) => resolve(null));
  
  return new Promise((resolve) => {
    // onMessage(messaging, (payload) => {
    //   resolve(payload);
    // });
  });
};
