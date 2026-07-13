// Tab "Profilo": dati personali, statistiche, alert profilo incompleto.
import { auth, db, doc, updateDoc, serverTimestamp } from '../firebase.js';
import { S } from '../state.js';
import { showToast, setBtn, errMsg } from '../utils.js';
import { loadLeaderboard } from './classifica.js';
import { showTab } from '../nav.js';

export function rProf() {
  var tot = 0, giorni = {};
  S.reports.forEach(function (r) {
    tot += (r.numConsegne || 0);
    if ((r.numConsegne || 0) > 0) {
      var d = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : (r.data || '').substring(0, 10);
      giorni[d] = true;
    }
  });
  document.getElementById('profTotC').textContent = tot;
  document.getElementById('profTotG').textContent = Object.keys(giorni).length;
  document.getElementById('profTarga').textContent = S.targaOggi || '—';
  loadLeaderboard();
}

export function profiloCompleto() {
  if (!S.dp) return true;
  return S.dp.codiceFiscale && S.dp.numeroPatente && S.dp.telefono;
}

export function checkProfiloAlert() {
  if (!profiloCompleto()) {
    document.getElementById('profileAlert').style.display = 'flex';
  }
}

export function chiudiAlertProfilo() {
  document.getElementById('profileAlert').style.display = 'none';
  showTab('profilo');
}

export function rimandaAlertProfilo() {
  document.getElementById('profileAlert').style.display = 'none';
}

export function caricaDatiProfilo() {
  if (!S.dp) return;
  document.getElementById('profCF').value = S.dp.codiceFiscale || '';
  document.getElementById('profPatente').value = S.dp.numeroPatente || '';
  document.getElementById('profPatenteScad').value = S.dp.scadenzaPatente || '';
  document.getElementById('profTelefono').value = S.dp.telefono || '';
  document.getElementById('profDataNascita').value = S.dp.dataNascita || '';
  document.getElementById('profIndirizzo').value = S.dp.indirizzo || '';
}

export async function salvaProfilo() {
  if (!auth.currentUser) { showToast('Sessione scaduta. Ricarica la pagina.'); return }
  if (!S.dp || !S.dp.id) { showToast('Errore: profilo non trovato'); return }
  if (S.submitting) return;
  S.submitting = true;
  setBtn('btnSalvaProfilo', true, 'Salvataggio...');
  var cf = document.getElementById('profCF').value.trim().toUpperCase();
  var pat = document.getElementById('profPatente').value.trim().toUpperCase();
  var patScad = document.getElementById('profPatenteScad').value;
  var tel = document.getElementById('profTelefono').value.trim();
  var nascita = document.getElementById('profDataNascita').value;
  var indirizzo = document.getElementById('profIndirizzo').value.trim();

  if (!cf || cf.length !== 16) { showToast('Codice fiscale non valido (16 caratteri)'); S.submitting = false; setBtn('btnSalvaProfilo', false, '💾 Salva dati personali'); return }
  if (!pat) { showToast('Inserisci il numero della patente'); S.submitting = false; setBtn('btnSalvaProfilo', false, '💾 Salva dati personali'); return }
  if (!tel) { showToast('Inserisci il numero di telefono'); S.submitting = false; setBtn('btnSalvaProfilo', false, '💾 Salva dati personali'); return }

  try {
    await updateDoc(doc(db, 'driverAnagrafica', S.dp.id), {
      codiceFiscale: cf,
      numeroPatente: pat,
      scadenzaPatente: patScad || null,
      telefono: tel,
      dataNascita: nascita || null,
      indirizzo: indirizzo || null,
      profiloCompletatoIl: serverTimestamp()
    });
    S.dp.codiceFiscale = cf; S.dp.numeroPatente = pat; S.dp.scadenzaPatente = patScad;
    S.dp.telefono = tel; S.dp.dataNascita = nascita; S.dp.indirizzo = indirizzo;
    showToast('Dati salvati con successo!');
  } catch (e) {
    showToast('Errore: ' + errMsg(e));
  } finally {
    S.submitting = false;
    setBtn('btnSalvaProfilo', false, '💾 Salva dati personali');
  }
}
