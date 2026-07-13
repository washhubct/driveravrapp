// Fetch dati Firestore + helper condivisi sulle filiali.
import { auth, db, collection, query, where, orderBy, limit, getDocs } from './firebase.js';
import { S } from './state.js';
import { showToast, errMsg } from './utils.js';

export async function loadFl() {
  try {
    var s = await getDocs(collection(db, 'filiali'));
    S.fl = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()) });
    populateFilialiSelect('ncFiliale');
  } catch (e) {
    console.error('loadFl error:', e);
    showToast('Impossibile caricare le filiali — verifica la connessione e ricarica la pagina');
  }
}

// Popola una <select> con le filiali dell'area del driver (tutte se area ignota).
export function populateFilialiSelect(selectId) {
  var sel = document.getElementById(selectId);
  sel.innerHTML = '<option value="">Seleziona filiale...</option>';
  var my = S.fl;
  if (S.dp && S.dp.citta && S.dp.citta !== '??') {
    var f = S.fl.filter(function (x) { return x.area === S.dp.citta });
    if (f.length > 0) my = f;
  }
  my.sort(function (a, b) {
    var na = (a.nome || '').toLowerCase(), nb = (b.nome || '').toLowerCase();
    return na.localeCompare(nb);
  });
  my.forEach(function (f) {
    var o = document.createElement('option');
    o.value = f.codice;
    o.textContent = f.nome ? f.nome + ' (' + f.codice + ')' : 'Filiale ' + f.codice;
    sel.appendChild(o);
  });
}

export function getFilialeNome(codice) {
  if (!codice) return 'Filiale ?';
  var f = S.fl.find(function (x) { return String(x.codice) === String(codice) });
  return f && f.nome ? f.nome + ' (' + codice + ')' : 'Filiale ' + codice;
}

export async function loadReports() {
  var em = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
  if (!em) return;
  try {
    var s = await getDocs(query(collection(db, 'reportDriver'), where('driverEmail', '==', em), orderBy('data', 'desc'), limit(2000)));
    S.reports = s.docs.map(function (d) {
      var x = d.data();
      x.id = d.id;
      if (x.data && x.data.toDate) x.data = x.data.toDate();
      return x;
    });
  } catch (e) {
    console.error('loadReports error:', e);
    S.reports = [];
    showToast('Impossibile caricare le consegne — verifica la connessione: ' + errMsg(e));
  }
}

export async function loadRitorni() {
  var em = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
  if (!em) return;
  try {
    var s = await getDocs(query(collection(db, 'ritorni'), where('driverEmail', '==', em), limit(100)));
    S.ritorniList = s.docs.map(function (d) {
      var x = d.data();
      x.id = d.id;
      if (x.data && x.data.toDate) x.data = x.data.toDate();
      return x;
    }).filter(function (x) { return !!x.data });
    S.ritorniList.sort(function (a, b) { return new Date(b.data) - new Date(a.data) });
  } catch (e) {
    console.error('loadRitorni error:', e);
    S.ritorniList = [];
    showToast('Errore caricamento ritorni');
  }
}
