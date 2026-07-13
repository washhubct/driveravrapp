// Tab "Nuova": registrazione consegne per fascia.
import { auth, db, Timestamp, FieldValue } from '../firebase.js';
import { S } from '../state.js';
import { oggiRoma, showToast, setBtn, errMsg, minutiTra } from '../utils.js';
import { loadReports } from '../data.js';
import { rOggi } from './oggi.js';
import { rComp } from './compensi.js';

// Imposta data di oggi nel campo data
export function setOggi() {
  document.getElementById('ncData').value = oggiRoma();
}

// Inizializza limiti data (dal 1 aprile a oggi)
export function initDateLimits() {
  var inp = document.getElementById('ncData');
  var oggi = oggiRoma();
  inp.value = oggi;
  inp.max = oggi;
  inp.min = '2026-04-01';
}

// Precompila l'ora di inizio giro con l'inizio della fascia selezionata
export function prefillOraInizio() {
  var inp = document.getElementById('ncOraInizio');
  if (!inp.value) inp.value = document.getElementById('ncFascia').value;
}

export function resetNuova() {
  document.getElementById('ncNumero').value = '';
  document.getElementById('ncNote').value = '';
  document.getElementById('ncOraInizio').value = '';
  document.getElementById('ncOraFine').value = '';
  document.getElementById('successMsg').style.display = 'none';
  document.getElementById('formNuova').style.display = 'block';
  initDateLimits();
  prefillOraInizio();
}

export async function salvaReport() {
  if (!auth.currentUser) { showToast('Sessione scaduta. Ricarica la pagina.'); return }
  if (S.submitting) return;
  var dataStr = document.getElementById('ncData').value;
  var fil = document.getElementById('ncFiliale').value;
  var fas = document.getElementById('ncFascia').value;
  var num = parseInt(document.getElementById('ncNumero').value) || 0;
  var note = document.getElementById('ncNote').value.trim();
  var oraInizio = document.getElementById('ncOraInizio').value;
  var oraFine = document.getElementById('ncOraFine').value;

  if (!dataStr) { showToast('Seleziona la data'); return }
  if (!fil) { showToast('Seleziona la filiale'); return }
  if (!num || num < 1) { showToast('Inserisci almeno 1 consegna'); return }
  if (num > 10) { showToast('Massimo 10 consegne per fascia'); return }
  if (!oraInizio || !oraFine) { showToast('Inserisci ora di inizio e fine giro'); return }
  var durataMin = minutiTra(oraInizio, oraFine);
  if (durataMin <= 0) { showToast('L\'ora di fine deve essere dopo l\'inizio'); return }
  if (durataMin > 720) { showToast('Durata giro superiore a 12 ore — controlla gli orari'); return }
  if (durataMin < num * 2) { showToast('Durata troppo breve per ' + num + ' consegne — controlla gli orari'); return }
  // Check soft: orario coerente con la fascia selezionata (fascia 2h, tolleranza 1h prima/dopo)
  var fasciaStart = minutiTra('00:00', fas);
  var inizioMin = minutiTra('00:00', oraInizio);
  if (inizioMin < fasciaStart - 60 || inizioMin > fasciaStart + 180) {
    if (!confirm('Hai selezionato la fascia ' + fas + ' ma il giro inizia alle ' + oraInizio + '.\nConfermi che gli orari sono corretti?')) return;
  }

  // Validazione data: non prima del 1 aprile, non dopo oggi
  var selDate = new Date(dataStr + 'T12:00:00');
  var minDate = new Date('2026-04-01T00:00:00');
  var maxDate = new Date(); maxDate.setHours(23, 59, 59);
  if (selDate < minDate) { showToast('Non puoi inserire prima del 1° aprile'); return }
  if (selDate > maxDate) { showToast('Non puoi inserire date future'); return }

  var dup = S.reports.some(function (r) {
    if (!r.data) return false;
    var rd = r.data instanceof Date ? r.data : (r.data.toDate ? r.data.toDate() : new Date(r.data));
    return rd.toDateString() === selDate.toDateString() && String(r.filiale) === fil && r.fascia === fas;
  });
  if (dup) { showToast('Hai già inserito questa fascia per la data selezionata'); return }

  S.submitting = true;
  setBtn('btnSalvaReport', true, 'Salvataggio...');
  var fd = S.fl.find(function (f) { return String(f.codice) === fil });
  var filialeNome = fd && fd.nome ? fd.nome : '';

  var rec = {
    filiale: fil,
    filialeNome: filialeNome,
    fascia: fas,
    numConsegne: num,
    note: note,
    driver: (S.dp.cognome || '').toUpperCase(),
    driverEmail: (auth.currentUser.email || '').toLowerCase(),
    targa: S.targaOggi,
    data: Timestamp.fromDate(selDate),
    mese: selDate.getFullYear() + '-' + String(selDate.getMonth() + 1).padStart(2, '0'),
    area: fd ? fd.area : (S.dp.citta || '??'),
    oraInizio: oraInizio,
    oraFine: oraFine,
    durataMin: durataMin,
    tempoMedioMin: Math.round(durataMin / num * 10) / 10,
    fonte: 'driver_app',
    createdAt: FieldValue.serverTimestamp()
  };

  try {
    await db.collection('reportDriver').add(rec);
    var dataLabel = selDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    document.getElementById('successDetail').textContent = num + ' consegne · ' + (filialeNome || 'Filiale ' + fil) + ' · ' + fas + ' · ' + dataLabel;
    document.getElementById('formNuova').style.display = 'none';
    document.getElementById('successMsg').style.display = 'block';
    await loadReports();
    rOggi(); rComp();
  } catch (e) {
    console.error('salvaReport error:', e);
    showToast('Errore: ' + errMsg(e));
  } finally {
    S.submitting = false;
    setBtn('btnSalvaReport', false, '✓ Conferma consegne');
  }
}
