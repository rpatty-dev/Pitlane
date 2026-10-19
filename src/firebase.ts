import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Config from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBLJr95U4oJ_pqMgc1W19rzpl8akI2QOZk",
  authDomain: "gen-lang-client-0451468884.firebaseapp.com",
  projectId: "gen-lang-client-0451468884",
  storageBucket: "gen-lang-client-0451468884.firebasestorage.app",
  messagingSenderId: "777010349476",
  appId: "1:777010349476:web:fc997b07f338ca11c0ed31"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
