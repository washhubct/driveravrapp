// Tab "Ritorno": registrazione secondo viaggio presso il cliente.
import { auth, db, collection, addDoc, Timestamp, serverTimestamp } from '../firebase.js';
import { S } from '../state.js';
import { showToast, setBtn, errMsg, meseYM, dataRecord, initDateInput, validaDataInserimento } from '../utils.js';
import { loadRitorni, populateFilialiSelect, getFiliale } from '../data.js';
import { enqueue, isNetworkError, flushOutbox, updateOutboxBanner } from '../offline.js';
import { rOggi } from './oggi.js';

let busy = false;

export function resetRitorno() {
  document.getElementById('rtCliente').value = '';
  document.getElementById('rtIndirizzo').value = '';
  document.getElementById('rtCitta').value = '';
  document.getElementById('rtNote').value = '';
  document.getElementById('rtMotivo').value = '';
  document.getElementById('formRitorno').style.display = 'block';
  document.getElementById('rtSuccess').style.display = 'none';
  initDateInput('rtData');
  populateFilialiSelect('rtFiliale');
}

export async function salvaRitorno() {
  if (!auth.currentUser) { showToast('Sessione scaduta. Ricarica la pagina.'); return }
  if (busy) return;
  const dataStr = document.getElementById('rtData').value;
  const filiale = document.getElementById('rtFiliale').value;
  const motivo = document.getElementById('rtMotivo').value;
  const cliente = document.getElementById('rtCliente').value.trim();
  const indirizzo = document.getElementById('rtIndirizzo').value.trim();
  const citta = document.getElementById('rtCitta').value;
  const note = document.getElementById('rtNote').value.trim();

  const vd = validaDataInserimento(dataStr);
  if (!vd.ok) { showToast(vd.msg); return }
  if (!filiale) { showToast('Seleziona la filiale'); return }
  if (!motivo) { showToast('Seleziona il motivo'); return }
  if (!cliente) { showToast('Inserisci il nome del cliente'); return }
  if (!citta) { showToast('Seleziona la città'); return }

  const selDate = vd.date;
  const dupRit = S.ritorniList.some(function (r) {
    const rd = dataRecord(r);
    return rd && rd.toDateString() === selDate.toDateString() && String(r.filiale) === filiale && r.motivo === motivo &&
      (r.cliente || '').toLowerCase().trim() === (cliente || '').toLowerCase().trim();
  });
  if (dupRit) { showToast('Hai già registrato questo ritorno per la data selezionata'); return }

  busy = true;
  setBtn('btnSalvaRitorno', true, 'Salvataggio...');
  try {
    const motivoLabels = {
      merce_dimenticata: 'Merce dimenticata in filiale',
      cliente_assente: 'Cliente assente al primo tentativo',
      errore_ordine: 'Errore nell\'ordine',
      prodotto_danneggiato: 'Prodotto danneggiato da sostituire',
      altro: 'Altro'
    };

    const fd = getFiliale(filiale);
    const filialeNome = fd && fd.nome ? fd.nome : '';

    const base = {
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
      mese: meseYM(selDate),
      fonte: 'driver_app'
    };

    const dataLabel = selDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    const dettaglio = 'Ritorno per ' + cliente + ' · ' + (filialeNome || 'Filiale ' + filiale) + ' · ' + dataLabel;

    try {
      const rec = Object.assign({}, base, { data: Timestamp.fromDate(selDate), timestamp: serverTimestamp() });
      await addDoc(collection(db, 'ritorni'), rec);
      document.getElementById('rtSuccessDetail').textContent = dettaglio;
      document.getElementById('formRitorno').style.display = 'none';
      document.getElementById('rtSuccess').style.display = 'block';
      await loadRitorni();
      rOggi();
      showToast('Ritorno registrato');
      flushOutbox();
    } catch (e) {
      if (isNetworkError(e)) {
        await enqueue({ collezione: 'ritorni', payload: base, dataISO: dataStr, campoData: 'data', campoCreato: 'timestamp' });
        document.getElementById('rtSuccessDetail').textContent = dettaglio + ' — 📵 sei offline: verrà inviato in automatico appena torna la connessione';
        document.getElementById('formRitorno').style.display = 'none';
        document.getElementById('rtSuccess').style.display = 'block';
        updateOutboxBanner();
      } else {
        throw e;
      }
    }
  } catch (e) {
    console.error('salvaRitorno error:', e);
    showToast('Errore: ' + errMsg(e));
  } finally {
    busy = false;
    setBtn('btnSalvaRitorno', false, '✓ Conferma ritorno');
  }
}
