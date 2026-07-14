// Tab "Nuova": registrazione consegne per fascia.
import { auth, db, collection, addDoc, Timestamp, serverTimestamp } from '../firebase.js';
import { S } from '../state.js';
import { oggiRoma, showToast, setBtn, errMsg, minutiTra, meseYM, dataRecord, initDateInput, validaDataInserimento } from '../utils.js';
import { loadReports, getFiliale } from '../data.js';
import { enqueue, isNetworkError, flushOutbox, updateOutboxBanner } from '../offline.js';
import { rOggi } from './oggi.js';
import { rComp } from './compensi.js';

let busy = false;

// Imposta data di oggi nel campo data
export function setOggi() {
  document.getElementById('ncData').value = oggiRoma();
}

// Inizializza limiti data (dalla finestra valida a oggi)
export function initDateLimits() {
  initDateInput('ncData');
}

// Precompila l'ora di inizio giro con l'inizio della fascia selezionata
export function prefillOraInizio() {
  const inp = document.getElementById('ncOraInizio');
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
  if (busy) return;
  const dataStr = document.getElementById('ncData').value;
  const fil = document.getElementById('ncFiliale').value;
  const fas = document.getElementById('ncFascia').value;
  const num = parseInt(document.getElementById('ncNumero').value) || 0;
  const note = document.getElementById('ncNote').value.trim();
  const oraInizio = document.getElementById('ncOraInizio').value;
  const oraFine = document.getElementById('ncOraFine').value;

  const vd = validaDataInserimento(dataStr);
  if (!vd.ok) { showToast(vd.msg); return }
  if (!fil) { showToast('Seleziona la filiale'); return }
  if (!num || num < 1) { showToast('Inserisci almeno 1 consegna'); return }
  if (num > 10) { showToast('Massimo 10 consegne per fascia'); return }
  if (!oraInizio || !oraFine) { showToast('Inserisci ora di inizio e fine giro'); return }
  const durataMin = minutiTra(oraInizio, oraFine);
  if (durataMin <= 0) { showToast('L\'ora di fine deve essere dopo l\'inizio'); return }
  if (durataMin > 720) { showToast('Durata giro superiore a 12 ore — controlla gli orari'); return }
  if (durataMin < num * 2) { showToast('Durata troppo breve per ' + num + ' consegne — controlla gli orari'); return }
  // Check soft: orario coerente con la fascia selezionata (fascia 2h, tolleranza 1h prima/dopo)
  const fasciaStart = minutiTra('00:00', fas);
  const inizioMin = minutiTra('00:00', oraInizio);
  if (inizioMin < fasciaStart - 60 || inizioMin > fasciaStart + 180) {
    if (!confirm('Hai selezionato la fascia ' + fas + ' ma il giro inizia alle ' + oraInizio + '.\nConfermi che gli orari sono corretti?')) return;
  }

  const selDate = vd.date;
  const dup = S.reports.some(function (r) {
    const rd = dataRecord(r);
    return rd && rd.toDateString() === selDate.toDateString() && String(r.filiale) === fil && r.fascia === fas;
  });
  if (dup) { showToast('Hai già inserito questa fascia per la data selezionata'); return }

  busy = true;
  setBtn('btnSalvaReport', true, 'Salvataggio...');
  const fd = getFiliale(fil);
  const filialeNome = fd && fd.nome ? fd.nome : '';

  // Campi serializzabili: la coda offline li salva così come sono e
  // ricostruisce data (Timestamp) e createdAt (serverTimestamp) all'invio.
  const base = {
    filiale: fil,
    filialeNome: filialeNome,
    fascia: fas,
    numConsegne: num,
    note: note,
    driver: (S.dp.cognome || '').toUpperCase(),
    driverEmail: (auth.currentUser.email || '').toLowerCase(),
    targa: S.targaOggi,
    mese: meseYM(selDate),
    area: fd ? fd.area : (S.dp.citta || '??'),
    oraInizio: oraInizio,
    oraFine: oraFine,
    durataMin: durataMin,
    tempoMedioMin: Math.round(durataMin / num * 10) / 10,
    fonte: 'driver_app'
  };

  const dataLabel = selDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
  const dettaglio = num + ' consegne · ' + (filialeNome || 'Filiale ' + fil) + ' · ' + fas + ' · ' + dataLabel;

  try {
    const rec = Object.assign({}, base, { data: Timestamp.fromDate(selDate), createdAt: serverTimestamp() });
    await addDoc(collection(db, 'reportDriver'), rec);
    document.getElementById('successDetail').textContent = dettaglio;
    document.getElementById('formNuova').style.display = 'none';
    document.getElementById('successMsg').style.display = 'block';
    await loadReports();
    rOggi(); rComp();
    flushOutbox();
  } catch (e) {
    if (isNetworkError(e)) {
      // Niente rete: accoda e mostra comunque l'esito, con la verità.
      await enqueue({ collezione: 'reportDriver', payload: base, dataISO: dataStr, campoData: 'data', campoCreato: 'createdAt' });
      document.getElementById('successDetail').textContent = dettaglio + ' — 📵 sei offline: verrà inviato in automatico appena torna la connessione';
      document.getElementById('formNuova').style.display = 'none';
      document.getElementById('successMsg').style.display = 'block';
      updateOutboxBanner();
    } else {
      console.error('salvaReport error:', e);
      showToast('Errore: ' + errMsg(e));
    }
  } finally {
    busy = false;
    setBtn('btnSalvaReport', false, '✓ Conferma consegne');
  }
}
