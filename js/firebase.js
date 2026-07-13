// Firebase init — compat SDK caricato via <script> in index.html.
// La config DEVE matchare il progetto avr-logistic-dashboard (condiviso con la dashboard).
firebase.initializeApp({
  apiKey: "AIzaSyCleejDdWN6w41TcBw4fvyAPr_6rxU8Bgs",
  authDomain: "avr-logistic-dashboard.firebaseapp.com",
  projectId: "avr-logistic-dashboard",
  storageBucket: "avr-logistic-dashboard.firebasestorage.app",
  messagingSenderId: "323721042739",
  appId: "1:323721042739:web:a9fa1710eeb8cfe3357c46"
});

export const auth = firebase.auth();
export const db = firebase.firestore();
export const FieldValue = firebase.firestore.FieldValue;
export const Timestamp = firebase.firestore.Timestamp;
