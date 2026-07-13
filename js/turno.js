// Turno: modal targa, avvio/cambio mezzo, auto-logout notturno.
import { auth, db, collection, addDoc, serverTimestamp, signOut } from './firebase.js';
import { S } from './state.js';
import { oggiRoma, showToast, setBtn, errMsg } from './utils.js';
import { maybeShowLbIntro } from './views/classifica.js';
import { checkProfiloAlert } from './views/profilo.js';

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
    await addDoc(collection(db, 'turniDriver'), {
      driver: (S.dp.cognome || '').toUpperCase(),
      driverNome: (S.dp.cognome || '') + ' ' + (S.dp.nome || ''),
      email: (auth.currentUser.email || '').toLowerCase(),
      targa: t,
      citta: S.dp.citta || '??',
      data: oggiRoma(),
      oraInizio: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      timestamp: serverTimestamp()
    });
    S.turnoConfermato = true;
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
  scheduleAutoLogout();
}

export function chiudiTargaModal() {
  document.getElementById('targaView').style.display = 'none';
  if (S.targaOggi) {
    document.getElementById('appView').style.display = 'flex';
    maybeShowLbIntro();
  }
  document.getElementById('btnAnnullaTarga').style.display = 'none';
}
