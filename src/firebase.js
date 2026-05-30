// src/firebase.js
// Inisialisasi Firebase App dan Firestore

import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAnalytics } from "firebase/analytics";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyAJdb3F4upg8BdQl-7zkfvm3jJoaFLP4Js",
  authDomain: "tallyfypos.firebaseapp.com",
  projectId: "tallyfypos",
  storageBucket: "tallyfypos.firebasestorage.app",
  messagingSenderId: "587947906211",
  appId: "1:587947906211:web:553a1f408f960b772edb16",
  measurementId: "G-E20Z1FHHJH"
};

// Mencegah error "FirebaseError: Firebase: Firebase App named '[DEFAULT]' already exists" saat HMR (Hot Module Replacement) Vite
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
const analytics = getAnalytics(app);

// Mencegah error "FirebaseError: initializeFirestore() has already been called"
export const db = !getApps().length 
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    })
  : getFirestore(app)

export const auth = getAuth(app)

export default app
