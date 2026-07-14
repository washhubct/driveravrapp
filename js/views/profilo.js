// Tab "Profilo": dati personali, statistiche, alert profilo incompleto.
// Il render della classifica nella tab è orchestrato da nav.js (loadLeaderboard).
import { auth, db, doc, updateDoc, serverTimestamp } from '../firebase.js';
import { S } from '../state.js';
import { showToast, setBtn, errMsg, recordYMD, escapeHtml } from '../utils.js';
import { loadDanni } from '../data.js';
import { showTab } from '../nav.js';

let busy = false;

export function rProf() {
  let tot = 0;
  const giorni = {};
  S.reports.forEach(function (r) {
    tot += (r.numConsegne || 0);
    if ((r.numConsegne || 0) > 0) giorni[recordYMD(r)] = true;
  });
  document.getElementById('profTotC').textContent = tot;
  document.getElementById('profTotG').textContent = Object.keys(giorni).length;
  document.getElementById('profTarga').textContent = S.targaOggi || '—';
  if (S.danniLoaded) renderDanni();
  else loadDanni().then(renderDanni);
}

function renderDanni() {
  const el = document.getElementById('listaDanni');
  if (!el) return;
  if (!S.danniList.length) {
    el.innerHTML = '<div class="empty" style="padding:16px"><p style="font-size:12px;color:var(--text3)">Nessuna multa o trattenuta 🎉</p></div>';
    return;
  }
  el.innerHTML = S.danniList.map(function (d) {
    const dataLabel = d.data ? new Date(d.data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const chiuso = d.stato === 'chiuso' || d.stato === 'saldato' || (d.numRate > 1 && (d.ratePagate || 0) >= d.numRate);
    const statoHtml = chiuso
      ? '<span class="seg-stato risolta">Saldato</span>'
      : '<span class="seg-stato aperta">' + escapeHtml(d.stato || 'aperto') + '</span>';
    const rateHtml = d.numRate > 1
      ? '<div class="seg-meta">Rate: ' + (d.ratePagate || 0) + '/' + d.numRate + ' pagate · €' + (d.importoRata || 0).toFixed(2) + '/mese</div>'
      : '';
    return '<div class="seg-card">' +
      '<div class="seg-card-top">' +
      '<div class="seg-tipo">' + escapeHtml(d.tipoSinistro || 'Danno') + ' · €' + (d.importo || 0).toFixed(2) + '</div>' +
      statoHtml +
      '</div>' +
      (d.descrizione ? '<div class="seg-desc">' + escapeHtml(d.descrizione) + '</div>' : '') +
      '<div class="seg-meta">' + dataLabel + (d.targa ? ' · 🚐 ' + escapeHtml(d.targa) : '') + '</div>' +
      rateHtml +
      '</div>';
  }).join('');
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
  if (busy) return;

  const cf = document.getElementById('profCF').value.trim().toUpperCase();
  const pat = document.getElementById('profPatente').value.trim().toUpperCase();
  const patScad = document.getElementById('profPatenteScad').value;
  const tel = document.getElementById('profTelefono').value.trim();
  const nascita = document.getElementById('profDataNascita').value;
  const indirizzo = document.getElementById('profIndirizzo').value.trim();

  // Validazioni PRIMA del lock: gli early-return non devono rilasciare nulla.
  if (!cf || cf.length !== 16) { showToast('Codice fiscale non valido (16 caratteri)'); return }
  if (!pat) { showToast('Inserisci il numero della patente'); return }
  if (!tel) { showToast('Inserisci il numero di telefono'); return }

  busy = true;
  setBtn('btnSalvaProfilo', true, 'Salvataggio...');
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
    busy = false;
    setBtn('btnSalvaProfilo', false, '💾 Salva dati personali');
  }
}
