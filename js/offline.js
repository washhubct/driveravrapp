// Coda offline (outbox) per report e ritorni: se la write Firestore fallisce
// per mancanza di rete, il record viene accodato in IndexedDB e sincronizzato
// in automatico quando torna la connessione. firestore-lite è REST puro e non
// ha una coda propria: questa è la nostra.
import { db, collection, addDoc, Timestamp, serverTimestamp } from './firebase.js';
import { showToast } from './utils.js';

const DB_NAME = 'lastmile-outbox';
const STORE = 'outbox';

function reqProm(req) {
  return new Promise(function (resolve, reject) {
    req.onsuccess = function () { resolve(req.result) };
    req.onerror = function () { reject(req.error) };
  });
}

function openDb() {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = function () {
    req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
  };
  return reqProm(req);
}

async function store(mode) {
  const idb = await openDb();
  return idb.transaction(STORE, mode).objectStore(STORE);
}

// Riconosce gli errori di rete (da accodare) distinguendoli da quelli
// definitivi come permission-denied (da NON riaccodare).
export function isNetworkError(e) {
  if (!navigator.onLine) return true;
  const msg = ((e && e.message) || '').toLowerCase();
  return (e && e.code === 'unavailable') || /network|failed to fetch|timeout|connection/.test(msg);
}

// item: { collezione: 'reportDriver'|'ritorni', payload: {...campi serializzabili},
//         dataISO: 'YYYY-MM-DD', campoData: 'data', campoCreato: 'createdAt'|'timestamp' }
export async function enqueue(item) {
  item.queuedAt = new Date().toISOString();
  await reqProm((await store('readwrite')).add(item));
}

export async function getPending() {
  return reqProm((await store('readonly')).getAll());
}

async function removeItem(id) {
  await reqProm((await store('readwrite')).delete(id));
}

// Ricostruisce i campi non serializzabili (Timestamp, serverTimestamp) e invia.
function buildRecord(item) {
  const rec = Object.assign({}, item.payload);
  rec[item.campoData] = Timestamp.fromDate(new Date(item.dataISO + 'T12:00:00'));
  rec[item.campoCreato] = serverTimestamp();
  return rec;
}

let flushing = false;

// Svuota la coda in ordine. Ritorna il numero di record sincronizzati.
// Su errore di rete si ferma (riproverà al prossimo trigger); su errore
// definitivo scarta il record per non bloccare la coda.
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return 0;
  flushing = true;
  let synced = 0;
  try {
    const items = await getPending();
    for (const item of items) {
      try {
        await addDoc(collection(db, item.collezione), buildRecord(item));
        await removeItem(item.id);
        synced++;
      } catch (e) {
        if (isNetworkError(e)) break;
        console.error('outbox: record scartato (errore definitivo):', e.message);
        await removeItem(item.id);
        showToast('⚠️ Un inserimento in coda è stato rifiutato dal server');
      }
    }
  } catch (e) {
    console.warn('outbox flush:', e.message);
  } finally {
    flushing = false;
  }
  await updateOutboxBanner();
  return synced;
}

// Banner "N inserimenti in attesa" nel tab Oggi.
export async function updateOutboxBanner() {
  const el = document.getElementById('outboxBanner');
  if (!el) return;
  try {
    const n = (await getPending()).length;
    if (n > 0) {
      el.style.display = 'block';
      el.textContent = '⏳ ' + n + (n === 1 ? ' inserimento in attesa' : ' inserimenti in attesa') + ' di connessione — invio automatico';
    } else {
      el.style.display = 'none';
    }
  } catch (e) {
    el.style.display = 'none';
  }
}
