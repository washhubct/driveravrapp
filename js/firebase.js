// Firebase modular SDK v10 via CDN (nessun build step).
// Unico punto che conosce versione e URL del CDN: gli altri moduli
// importano tutto da qui.
// La config DEVE matchare il progetto avr-logistic-dashboard (condiviso con la dashboard).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp({
  apiKey: "AIzaSyCleejDdWN6w41TcBw4fvyAPr_6rxU8Bgs",
  authDomain: "avr-logistic-dashboard.firebaseapp.com",
  projectId: "avr-logistic-dashboard",
  storageBucket: "avr-logistic-dashboard.firebasestorage.app",
  messagingSenderId: "323721042739",
  appId: "1:323721042739:web:a9fa1710eeb8cfe3357c46"
});

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export {
  collection, query, where, orderBy, limit,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
