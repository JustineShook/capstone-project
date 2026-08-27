// services/firebase.ts
// services/firebase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  // @ts-ignore — getReactNativePersistence exists at runtime in firebase/auth
  // but is missing from this SDK version's TS declarations (firebase-js-sdk #9316)
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { initializeFirestore, type Firestore } from "firebase/firestore";

// Replace with the config from Firebase Console
// (Project settings > General > Your apps > Web app > SDK setup and configuration)
const firebaseConfig = {
  apiKey: "AIzaSyCl5L_j2k4y-QXBczhtSgJpAxnQqx9PC_A",
  authDomain: "veresc-16c53.firebaseapp.com",
  projectId: "veresc-16c53",
  storageBucket: "veresc-16c53.firebasestorage.app",
  messagingSenderId: "1041007351650",
  appId: "1:1041007351650:web:e71aaaf620df5d18b13e3b",
  measurementId: "G-N20VP4Q5BL"
};

// Prevent re-initialization on fast refresh / repeated imports
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth with AsyncStorage persistence so sessions survive app restarts.
// initializeAuth throws if called twice on the same app, so guard it.
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

// initializeFirestore (not getFirestore) with long-polling forced on.
// React Native's JS runtime can't reliably do the SDK's default streaming
// fetch transport, which otherwise causes spurious
// "Failed to get document because the client is offline" errors even with
// a healthy connection.
const db: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export { app, auth, db };

