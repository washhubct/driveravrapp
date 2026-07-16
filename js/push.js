// Push notification (Web Push con coppia VAPID propria).
// ATTIVAZIONE: incollare in VAPID_PUBLIC_KEY la chiave pubblica generata con
// `npx web-push generate-vapid-keys` (la privata va nei secret delle Cloud
// Functions di avr-delivery-hub). Finché è vuota, il modulo è un no-op
// silenzioso. Invio server-side: avr-delivery-hub, docs/push-notifications-driver-app.md.
import { auth, db, collection, addDoc, serverTimestamp } from './firebase.js';
import { S } from './state.js';

const VAPID_PUBLIC_KEY = ''; // ← chiave pubblica Web Push del progetto Firebase

function base64ToUint8(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, function (c) { return c.charCodeAt(0) });
}

// Chiede il permesso e registra la subscription su Firestore.
// Chiamata dopo la conferma turno: momento in cui il driver è più disponibile.
export async function initPush() {
  if (!VAPID_PUBLIC_KEY) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission === 'denied') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64ToUint8(VAPID_PUBLIC_KEY)
      });
    }
    // Una subscription per endpoint: evita duplicati per lo stesso device.
    const key = sub.endpoint.slice(-32);
    const saved = localStorage.getItem('avrPushEndpoint');
    if (saved === key) return;
    await addDoc(collection(db, 'pushSubscriptions'), {
      email: (auth.currentUser.email || '').toLowerCase(),
      driver: (S.dp && S.dp.cognome || '').toUpperCase(),
      subscription: JSON.parse(JSON.stringify(sub)),
      userAgent: (navigator.userAgent || '').slice(0, 120),
      timestamp: serverTimestamp()
    });
    try { localStorage.setItem('avrPushEndpoint', key) } catch (e) { /* private mode */ }
  } catch (e) {
    console.warn('push init:', e.message);
  }
}
