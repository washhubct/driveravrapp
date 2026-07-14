// Turno: modal targa, avvio/cambio mezzo, chiusura turno, auto-logout notturno.
import { auth, db, collection, addDoc, doc, updateDoc, serverTimestamp, signOut } from './firebase.js';
import { S } from './state.js';
import { oggiRoma, recordYMD, showToast, setBtn, errMsg, minutiTra } from './utils.js';
import { maybeShowLbIntro } from './views/classifica.js';
import { checkProfiloAlert } from './views/profilo.js';
import { initPush } from './push.js';

let busy = false;

export function showTargaModal() {
  document.getElementById('targaView').style.display = 'flex';
  document.getElementById('targaInput').value = S.targaOggi;
  document.getElementById('btnAnnullaTarga').style.display = S.turnoConfermato ? 'block' : 'none';
  document.getElementById('targaInput').focus();
}

// Auto-logout alla prossima 01:00 (schedulato una sola volta per sessione)
function scheduleAutoLogout() {
  if (S.autoLogoutTimer) return;
  const now = new Date();
  const logout1am = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1, 0, 0);
  if (logout1am <= now) logout1am.setDate(logout1am.getDate() + 1);
  S.autoLogoutTimer = setTimeout(function () { signOut(auth); location.reload() }, logout1am - now);
}

export async function confermaTarga() {
  if (!auth.currentUser) { showToast('Sessione scaduta. Ricarica la pagina.'); return }
  if (busy) return;
  const t = document.getElementById('targaInput').value.trim().toUpperCase();
  if (!t || t.length < 5) { showToast('Inserisci una targa valida'); return }
  if (!S.dp) { showToast('Profilo non caricato. Ricarica la pagina.'); return }
  const cambio = S.turnoConfermato;
  if (cambio && t === S.targaOggi) { chiudiTargaModal(); return }
  busy = true;
  setBtn('btnTarga', true, cambio ? 'Aggiorno...' : 'Avvio turno...');
  S.targaOggi = t;
  document.getElementById('targaView').style.display = 'none';
  document.getElementById('appView').style.display = 'flex';
  document.getElementById('profTarga').textContent = S.targaOggi;
  if (!cambio) maybeShowLbIntro();
  try {
    const oraInizio = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const ref = await addDoc(collection(db, 'turniDriver'), {
      driver: (S.dp.cognome || '').toUpperCase(),
      driverNome: (S.dp.cognome || '') + ' ' + (S.dp.nome || ''),
      email: (auth.currentUser.email || '').toLowerCase(),
      targa: t,
      citta: S.dp.citta || '??',
      data: oggiRoma(),
      oraInizio: oraInizio,
      timestamp: serverTimestamp()
    });
    S.turnoConfermato = true;
    S.turnoDocId = ref.id;
    if (!cambio) S.turnoOraInizio = oraInizio;
    showToast(cambio ? 'Mezzo aggiornato: ' + S.targaOggi : 'Turno iniziato con ' + S.targaOggi);
  } catch (e) {
    console.warn('Errore salvataggio turno:', errMsg(e));
    showToast('⚠️ Turno non registrato — verifica la connessione e riprova da Profilo → "cambia"');
  } finally {
    busy = false;
    setBtn('btnTarga', false, 'Inizia il turno →');
    document.getElementById('btnAnnullaTarga').style.display = 'none';
  }
  if (!cambio) checkProfiloAlert();
  if (!cambio) initPush(); // momento giusto per chiedere il permesso notifiche
  scheduleAutoLogout();
}

// Chiusura turno: scrive oraFine e durata sul doc turniDriver aperto.
// Richiede la rule update-own su turniDriver (vedi proposta in avr-delivery-hub).
export async function chiudiTurno() {
  if (!auth.currentUser) { showToast('Sessione scaduta. Ricarica la pagina.'); return }
  if (busy) return;
  if (!S.turnoDocId) { showToast('Nessun turno aperto da chiudere'); return }

  const oggi = oggiRoma();
  const consOggi = S.reports.reduce(function (tot, r) {
    return recordYMD(r) === oggi ? tot + (r.numConsegne || 0) : tot;
  }, 0);
  const avviso = consOggi === 0 ? '\n\n⚠️ Oggi non hai registrato nessuna consegna.' : '';
  if (!confirm('Vuoi chiudere il turno adesso?' + avviso)) return;

  busy = true;
  try {
    const oraFine = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    let durataTurnoMin = null;
    if (S.turnoOraInizio) {
      durataTurnoMin = minutiTra(S.turnoOraInizio, oraFine);
      if (durataTurnoMin < 0) durataTurnoMin += 1440; // turno oltre la mezzanotte
    }
    await updateDoc(doc(db, 'turniDriver', S.turnoDocId), {
      oraFine: oraFine,
      durataTurnoMin: durataTurnoMin,
      chiusoIl: serverTimestamp()
    });
    S.turnoDocId = null;
    S.turnoOraInizio = null;
    S.turnoConfermato = false;
    showToast('Turno chiuso alle ' + oraFine + ' 👋');
  } catch (e) {
    console.warn('chiudiTurno error:', e.message);
    showToast('⚠️ Chiusura non registrata — riprova tra poco');
  } finally {
    busy = false;
  }
}

export function chiudiTargaModal() {
  document.getElementById('targaView').style.display = 'none';
  if (S.targaOggi) {
    document.getElementById('appView').style.display = 'flex';
    maybeShowLbIntro();
  }
  document.getElementById('btnAnnullaTarga').style.display = 'none';
}
