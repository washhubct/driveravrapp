// Tab "Ritorno": registrazione secondo viaggio presso il cliente.
import { auth, db, collection, addDoc, Timestamp, serverTimestamp } from '../firebase.js';
import { S } from '../state.js';
import { oggiRoma, showToast, setBtn, errMsg } from '../utils.js';
import { loadRitorni, populateFilialiSelect } from '../data.js';
import { rOggi } from './oggi.js';

export function resetRitorno() {
  document.getElementById('rtCliente').value = '';
  document.getElementById('rtIndirizzo').value = '';
  document.getElementById('rtCitta').value = '';
  document.getElementById('rtNote').value = '';
  document.getElementById('rtMotivo').value = '';
  document.getElementById('formRitorno').style.display = 'block';
  document.getElementById('rtSuccess').style.display = 'none';
  var inp = document.getElementById('rtData');
  var oggi = oggiRoma();
  inp.value = oggi; inp.max = oggi; inp.min = '2026-04-01';
  populateFilialiSelect('rtFiliale');
}

export async function salvaRitorno() {
  if (!auth.currentUser) { showToast('Sessione scaduta. Ricarica la pagina.'); return }
  if (S.submitting) return;
  var dataStr = document.getElementById('rtData').value;
  var filiale = document.getElementById('rtFiliale').value;
  var motivo = document.getElementById('rtMotivo').value;
  var cliente = document.getElementById('rtCliente').value.trim();
  var indirizzo = document.getElementById('rtIndirizzo').value.trim();
  var citta = document.getElementById('rtCitta').value;
  var note = document.getElementById('rtNote').value.trim();

  if (!dataStr) { showToast('Seleziona la data'); return }
  if (!filiale) { showToast('Seleziona la filiale'); return }
  if (!motivo) { showToast('Seleziona il motivo'); return }
  if (!cliente) { showToast('Inserisci il nome del cliente'); return }
  if (!citta) { showToast('Seleziona la città'); return }

  var selDate = new Date(dataStr + 'T12:00:00');
  var minDate = new Date('2026-04-01T00:00:00');
  var maxDate = new Date(); maxDate.setHours(23, 59, 59);
  if (selDate < minDate) { showToast('Non puoi inserire prima del 1° aprile'); return }
  if (selDate > maxDate) { showToast('Non puoi inserire date future'); return }

  var dupRit = S.ritorniList.some(function (r) {
    if (!r.data) return false;
    var rd = r.data instanceof Date ? r.data : (r.data.toDate ? r.data.toDate() : new Date(r.data));
    return rd.toDateString() === selDate.toDateString() && String(r.filiale) === filiale && r.motivo === motivo &&
      (r.cliente || '').toLowerCase().trim() === (cliente || '').toLowerCase().trim();
  });
  if (dupRit) { showToast('Hai già registrato questo ritorno per la data selezionata'); return }

  S.submitting = true;
  setBtn('btnSalvaRitorno', true, 'Salvataggio...');
  try {
    var motivoLabels = {
      merce_dimenticata: 'Merce dimenticata in filiale',
      cliente_assente: 'Cliente assente al primo tentativo',
      errore_ordine: 'Errore nell\'ordine',
      prodotto_danneggiato: 'Prodotto danneggiato da sostituire',
      altro: 'Altro'
    };

    var fd = S.fl.find(function (f) { return String(f.codice) === filiale });
    var filialeNome = fd && fd.nome ? fd.nome : '';

    var rec = {
      filiale: filiale,
      filialeNome: filialeNome,
      motivo: motivo,
      motivoLabel: motivoLabels[motivo] || motivo,
      numRitorni: 1,
      cliente: cliente,
      indirizzo: indirizzo || null,
      citta: citta,
      note: note || null,
      driver: (S.dp.cognome || '').toUpperCase(),
      driverNome: (S.dp.cognome || '') + ' ' + (S.dp.nome || ''),
      driverEmail: (auth.currentUser.email || '').toLowerCase(),
      targa: S.targaOggi,
      area: fd ? fd.area : (S.dp.citta || '??'),
      costoFattura: 6.90,
      costoDriver: S.cc,
      stato: 'da_fatturare',
      data: Timestamp.fromDate(selDate),
      mese: selDate.getFullYear() + '-' + String(selDate.getMonth() + 1).padStart(2, '0'),
      fonte: 'driver_app',
      timestamp: serverTimestamp()
    };

    await addDoc(collection(db, 'ritorni'), rec);
    var dataLabel = selDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    document.getElementById('rtSuccessDetail').textContent = 'Ritorno per ' + cliente + ' · ' + (filialeNome || 'Filiale ' + filiale) + ' · ' + dataLabel;
    document.getElementById('formRitorno').style.display = 'none';
    document.getElementById('rtSuccess').style.display = 'block';
    await loadRitorni();
    rOggi();
    showToast('Ritorno registrato');
  } catch (e) {
    console.error('salvaRitorno error:', e);
    showToast('Errore: ' + errMsg(e));
  } finally {
    S.submitting = false;
    setBtn('btnSalvaRitorno', false, '✓ Conferma ritorno');
  }
}
