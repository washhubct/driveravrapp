// Timbratura IN/OUT — QR o tag NFC + geofence.
//
// Design (rules + dashboard già predisposte):
// - tag/QR nei punti provinciali programmati con URL
//     https://appdriver.avrlogisticarl.com/?timbra=CT&t=TOKEN   (QR)
//     https://appdriver.avrlogisticarl.com/?timbra=CT&nfc=UID   (NFC)
// - il primo tap del giorno registra l'INGRESSO (e sblocca l'app),
//   dal secondo in poi l'USCITA (l'ultima OUT aggiorna l'orario)
// - anti-frode su ENTRAMBI i versi: si timbra solo fisicamente sul punto
//
// PRIVACY (decisione 15/07/2026): il dato timbratura è visibile SOLO al
// team ufficio in dashboard. I driver non hanno lettura sulla collection
// (rules); l'app tiene un flag locale sul device (localStorage) solo per
// sapere se il gate è passato e quale verso tocca. Nessun orario in UI.
import { auth, db, collection, getDoc, addDoc, doc, serverTimestamp } from './firebase.js';
import { S } from './state.js';
import { oggiRoma, meseCorrenteRoma, showToast, cn } from './utils.js';

let pendingParams = null; // {provincia, token, nfcUid} dall'URL di apertura

// ── Stato locale del device (nessuna lettura da Firestore) ──
function statoKey() {
  return 'lmTimb_' + ((auth.currentUser && auth.currentUser.email) || '').toLowerCase();
}

function statoOggi() {
  try {
    const s = JSON.parse(localStorage.getItem(statoKey()) || '{}');
    return s.giorno === oggiRoma() ? s : {};
  } catch (e) { return {} }
}

function salvaStatoLocale(tipo) {
  try {
    const s = statoOggi();
    s.giorno = oggiRoma();
    s[tipo] = true;
    localStorage.setItem(statoKey(), JSON.stringify(s));
  } catch (e) { /* private mode: il gate ricadrà sul ritimbro, gestito dalla riconciliazione */ }
}

function haInOggi() {
  return !!statoOggi().in;
}

// Verso automatico: la prima timbratura del giorno è l'ingresso, dalla
// seconda in poi è l'uscita.
function tipoAutomatico() {
  return haInOggi() ? 'out' : 'in';
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0') }).join('');
}

function distanzaMt(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

function getPosizione() {
  return new Promise(function (resolve) {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      function (p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }) },
      function () { resolve(null) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

// Il blocco "prima timbra, poi usi l'app" è attivo solo se il punto
// timbratura della provincia del driver è configurato e attivo: il rollout
// avviene provincia per provincia man mano che QR/tag vengono installati.
// In caso di dubbio (errore di rete) NON si bloccano i driver.
async function gateTimbraturaAttivo() {
  const prov = S.dp && S.dp.citta;
  if (!prov || prov === '??') return false;
  try {
    const snap = await getDoc(doc(db, 'puntiTimbratura', prov));
    if (!snap.exists()) return false;
    const p = snap.data();
    return p.attivo !== false && !!(p.qrTokenHash || p.nfcTagUID);
  } catch (e) {
    console.warn('gate timbratura:', e.message);
    return false;
  }
}

// Dopo il cancello timbratura si prosegue col flusso normale: targa o app.
function mostraProsieguo() {
  document.getElementById('timbraGateView').style.display = 'none';
  if (S.turnoConfermato && S.targaOggi) {
    document.getElementById('appView').style.display = 'flex';
  } else {
    document.getElementById('targaView').style.display = 'flex';
    document.getElementById('targaInput').focus();
  }
}

// Punto di ingresso del flusso post-login (chiamato da initApp):
// 1. app aperta da QR/tag  → modal di conferma timbratura
// 2. gate attivo e nessun IN oggi → schermata blocco "timbra per iniziare"
// 3. altrimenti → targa/app come sempre
export async function avviaFlussoIngresso() {
  const p = new URLSearchParams(location.search);
  const provincia = (p.get('timbra') || '').toUpperCase();
  if (provincia) {
    pendingParams = { provincia: provincia, token: p.get('t') || null, nfcUid: p.get('nfc') || null };
    history.replaceState(null, '', location.pathname); // evita ri-trigger su reload
  }

  if (pendingParams) {
    const tipo = tipoAutomatico();
    document.getElementById('timbraProv').textContent = cn(pendingParams.provincia) + ' (' + pendingParams.provincia + ')';
    document.getElementById('timbraTipoLabel').innerHTML = tipo === 'in'
      ? 'Registro il tuo <strong style="color:var(--success)">INGRESSO</strong> 🟢'
      : 'Registro la tua <strong style="color:var(--danger)">USCITA</strong> 🔴';
    const btn = document.getElementById('btnTimbraGo');
    btn.textContent = tipo === 'in' ? '🟢 Conferma INGRESSO' : '🔴 Conferma USCITA';
    btn.style.background = tipo === 'in' ? 'var(--success)' : 'var(--danger)';
    document.getElementById('timbraView').style.display = 'flex';
    return;
  }

  if (!haInOggi() && await gateTimbraturaAttivo()) {
    document.getElementById('gateHello').textContent = 'Ciao ' + (S.dp.nome || S.dp.cognome || '') + ', timbra per iniziare';
    document.getElementById('timbraGateView').style.display = 'flex';
    return;
  }

  mostraProsieguo();
}

// Bottone "Ho timbrato → ricontrolla" nella schermata di blocco
// (utile se il flag locale è stato appena scritto in un'altra scheda).
export function ricontrollaTimbratura() {
  if (haInOggi()) mostraProsieguo();
  else showToast('Nessun ingresso registrato oggi — avvicina il telefono al tag o inquadra il QR');
}

// Annulla dalla modal di conferma: si torna al punto giusto del flusso.
export async function chiudiTimbraModal() {
  document.getElementById('timbraView').style.display = 'none';
  pendingParams = null;
  if (!haInOggi() && await gateTimbraturaAttivo()) {
    document.getElementById('timbraGateView').style.display = 'flex';
  } else {
    mostraProsieguo();
  }
}

let busy = false;

export async function eseguiTimbratura() {
  if (!auth.currentUser || !S.dp) { showToast('Sessione non pronta. Ricarica la pagina.'); return }
  if (!pendingParams) { showToast('Apri l\'app dal QR o dal tag NFC in filiale'); return }
  if (busy) return;
  busy = true;
  const tipo = tipoAutomatico();
  const btn = document.getElementById('btnTimbraGo');
  const labelIdle = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Timbro...' }

  try {
    // 1. Punto timbratura della provincia
    const snap = await getDoc(doc(db, 'puntiTimbratura', pendingParams.provincia));
    if (!snap.exists() || snap.data().attivo === false) { showToast('Punto timbratura non attivo — contatta l\'amministrazione'); return }
    const punto = snap.data();

    // 2. Verifica QR token (hash) o UID NFC
    let metodo = null;
    if (pendingParams.token && punto.qrTokenHash) {
      const hash = await sha256hex(pendingParams.token);
      if (hash !== punto.qrTokenHash) { showToast('QR non valido o scaduto — usa quello stampato in filiale'); return }
      metodo = 'app-qr-geo';
    } else if (pendingParams.nfcUid && punto.nfcTagUID) {
      if (pendingParams.nfcUid !== punto.nfcTagUID) { showToast('Tag NFC non riconosciuto'); return }
      metodo = 'app-nfc-geo';
    } else {
      showToast('QR o tag non configurato per questa provincia');
      return;
    }

    // 3. Uscita ripetuta: aggiorna l'orario di fine (l'ultima OUT vince),
    //    ma chiedi conferma per evitare tap accidentali.
    if (tipo === 'out' && statoOggi().out && !confirm('Avevi già timbrato l\'uscita: aggiorno l\'orario a adesso?')) return;

    // 4. Geofence: fuori raggio o GPS negato non bloccano la timbratura,
    //    ma la marcano `sospetto` per la riconciliazione in dashboard.
    const pos = await getPosizione();
    let sospetto = false, note = null;
    const geo = punto.geo || {};
    if (pos && typeof geo.lat === 'number') {
      const dist = distanzaMt(pos.lat, pos.lng, geo.lat, geo.lng);
      const raggio = (geo.raggioMt || 100) + (pos.accuracy || 0);
      if (dist > raggio) { sospetto = true; note = 'Fuori raggio: ' + dist + 'm dal punto' }
    } else {
      sospetto = true;
      note = 'GPS non disponibile';
    }

    await addDoc(collection(db, 'timbrature'), {
      driverId: (auth.currentUser.email || '').toLowerCase(),
      driverNome: (S.dp.cognome || '') + ' ' + (S.dp.nome || ''),
      filialeId: pendingParams.provincia,
      citta: cn(pendingParams.provincia),
      tipo: tipo,
      timestamp: serverTimestamp(),
      giorno: oggiRoma(),
      mese: meseCorrenteRoma(),
      fonte: 'app',
      metodo: metodo,
      qrTokenLetto: pendingParams.token || null,
      lat: pos ? pos.lat : null,
      lng: pos ? pos.lng : null,
      accuracy: pos ? pos.accuracy : null,
      sospetto: sospetto,
      note: note
    });

    salvaStatoLocale(tipo);
    document.getElementById('timbraView').style.display = 'none';
    pendingParams = null;
    showToast(tipo === 'in' ? '🟢 Ingresso registrato — buon lavoro!' : '🔴 Uscita registrata — buon rientro!');
    if (sospetto) showToast('⚠️ Posizione non verificata: la timbratura sarà controllata');
    mostraProsieguo(); // dopo l'IN si prosegue con targa/app
  } catch (e) {
    console.error('timbratura error:', e);
    showToast('Errore timbratura — riprova: ' + (e.message || ''));
  } finally {
    busy = false;
    if (btn) { btn.disabled = false; btn.textContent = labelIdle }
  }
}
