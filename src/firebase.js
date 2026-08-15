import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth'
import {
  getFirestore,
  enableIndexedDbPersistence,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore'

// Configuración de Firebase utilizando variables de entorno de Vite
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyACd7XCsltGTcUArgPogWKClRxZ6yiVxBA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mentactitud-caza.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mentactitud-caza",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mentactitud-caza.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "601239684423",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:601239684423:web:6a693d8930aa51c2e5b862",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-SSYSRMY58J"
}

// Inicialización de la App Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

// Servicios de Firebase Auth y Firestore
export const auth = getAuth(app)
export const dbFirestore = getFirestore(app)

// Habilitar persistencia local IndexedDB para soporte Offline-First
enableIndexedDbPersistence(dbFirestore).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Persistencia Firestore: Múltiples pestañas abiertas a la vez.')
  } else if (err.code === 'unimplemented') {
    console.warn('Persistencia Firestore: El navegador actual no soporta persistencia offline.')
  }
})

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  deleteDoc
}
