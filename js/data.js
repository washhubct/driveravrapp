// Fetch dati Firestore + helper condivisi sulle filiali.
import { auth, db, collection, query, where, orderBy, limit, getDocs } from './firebase.js';
import { S } from './state.js';
import { showToast, errMsg, dataRecord } from './utils.js';

export async function loadFl() {
  try {
    const s = await getDocs(collection(db, 'filiali'));
    S.fl = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()) });
    populateFilialiSelect('ncFiliale');
  } catch (e) {
    console.error('loadFl error:', e);
    showToast('Impossibile caricare le filiali — verifica la connessione e ricarica la pagina');
  }
}

// Popola una <select> con le filiali dell'area del driver (tutte se area ignota).
export function populateFilialiSelect(selectId) {
  const sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">Seleziona filiale...</option>';
  let my = S.fl;
  if (S.dp && S.dp.citta && S.dp.citta !== '??') {
    const f = S.fl.filter(function (x) { return x.area === S.dp.citta });
    if (f.length > 0) my = f;
  }
  my.sort(function (a, b) {
    const na = (a.nome || '').toLowerCase(), nb = (b.nome || '').toLowerCase();
    return na.localeCompare(nb);
  });
  my.forEach(function (f) {
    const o = document.createElement('option');
    o.value = f.codice;
    o.textContent = f.nome ? f.nome + ' (' + f.codice + ')' : 'Filiale ' + f.codice;
    sel.appendChild(o);
  });
}

// Lookup filiale per codice, robusto al mismatch numero/stringa.
export function getFiliale(codice) {
  return S.fl.find(function (x) { return String(x.codice) === String(codice) });
}

export function getFilialeNome(codice) {
  if (!codice) return 'Filiale ?';
  const f = getFiliale(codice);
  return f && f.nome ? f.nome + ' (' + codice + ')' : 'Filiale ' + codice;
}

export async function loadReports() {
  const em = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
  if (!em) return;
  try {
    const s = await getDocs(query(collection(db, 'reportDriver'), where('driverEmail', '==', em), orderBy('data', 'desc'), limit(2000)));
    S.reports = s.docs.map(function (d) {
      const x = d.data();
      x.id = d.id;
      x.data = dataRecord(x);
      return x;
    }).filter(function (x) { return x.data instanceof Date });
  } catch (e) {
    console.error('loadReports error:', e);
    S.reports = [];
    showToast('Impossibile caricare le consegne — verifica la connessione: ' + errMsg(e));
  }
}

// Multe/danni del driver. NOTA: i doc danni creati dalla dashboard prima di
// luglio 2026 non hanno driverEmail e non vengono restituiti (le rules
// permettono la read-own solo su quel campo); la sezione si popola man mano
// che la dashboard salva i nuovi danni col campo email.
export async function loadDanni() {
  const em = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
  if (!em) return;
  try {
    const s = await getDocs(query(collection(db, 'danni'), where('driverEmail', '==', em), limit(50)));
    S.danniList = s.docs.map(function (d) { const x = d.data(); x.id = d.id; return x });
    S.danniList.sort(function (a, b) { return (b.data || '').localeCompare(a.data || '') });
    S.danniLoaded = true;
  } catch (e) {
    console.warn('loadDanni error:', e.message);
    S.danniList = [];
  }
}

export async function loadRitorni() {
  const em = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
  if (!em) return;
  try {
    const s = await getDocs(query(collection(db, 'ritorni'), where('driverEmail', '==', em), limit(100)));
    S.ritorniList = s.docs.map(function (d) {
      const x = d.data();
      x.id = d.id;
      x.data = dataRecord(x);
      return x;
    }).filter(function (x) { return x.data instanceof Date });
    S.ritorniList.sort(function (a, b) { return b.data - a.data });
  } catch (e) {
    console.error('loadRitorni error:', e);
    S.ritorniList = [];
    showToast('Errore caricamento ritorni');
  }
}
