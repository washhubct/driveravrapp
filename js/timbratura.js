// Timbratura IN/OUT — QR o tag NFC + geofence.
//
// Design (già previsto dalle rules e dalla dashboard): in ogni punto
// provinciale c'è un QR stampato e/o un tag NFC programmati con l'URL
//   https://appdriver.avrlogisticarl.com/?timbra=CT&t=TOKEN     (QR)
//   https://appdriver.avrlogisticarl.com/?timbra=CT&nfc=UID     (NFC)
// La fotocamera nativa (iOS/Android) o il lettore NFC di sistema aprono
// l'app con i parametri; qui verifichiamo token/UID contro il doc
// puntiTimbratura/{provincia} (hash SHA-256, mai token in chiaro nel DB),
// il geofence, e scriviamo il doc `timbrature` (schema unificato ZKTeco/app).
import { auth, db, collection, query, where, getDocs, getDoc, addDoc, doc, serverTimestamp } from './firebase.js';
import { S } from './state.js';
import { oggiRoma, meseCorrenteRoma, showToast, cn } from './utils.js';

let pendingParams = null; // {provincia, token, nfcUid} dall'URL di apertura

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

// Timbrature di oggi del driver (per stato card e alternanza in/out).
export async function loadTimbratureOggi() {
  const em = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
  if (!em) return;
  try {
    const s = await getDocs(query(collection(db, 'timbrature'), where('driverId', '==', em), where('giorno', '==', oggiRoma())));
    S.timbratureOggi = s.docs.map(function (d) { return d.data() });
    S.timbratureOggi.sort(function (a, b) {
      const ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : 0;
      const tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : 0;
      return ta - tb;
    });
  } catch (e) {
    console.warn('loadTimbratureOggi:', e.message);
    S.timbratureOggi = [];
  }
  renderTimbraturaCard();
}

export function renderTimbraturaCard() {
  const el = document.getElementById('timbraCard');
  if (!el) return;
  const fmt = function (t) {
    return t.timestamp && t.timestamp.toDate
      ? t.timestamp.toDate().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      : '—';
  };
  const ins = S.timbratureOggi.filter(function (t) { return t.tipo === 'in' });
  const outs = S.timbratureOggi.filter(function (t) { return t.tipo === 'out' });
  const inStr = ins.length ? '🟢 IN ' + fmt(ins[0]) : '⚪ IN —';
  const outStr = outs.length ? '🔴 OUT ' + fmt(outs[outs.length - 1]) : '⚪ OUT —';
  // L'ingresso richiede QR/NFC (anti-frode); l'uscita si può fare da qui,
  // col geofence che marca `sospetto` chi è lontano dal punto.
  const footer = ins.length
    ? '<button class="btn" data-action="timbra-out" style="width:100%;margin-top:10px;background:var(--danger);font-size:14px;padding:12px">🔴 ' + (outs.length ? 'Aggiorna uscita' : 'Timbra uscita') + '</button>'
    : '<div style="font-size:11px;color:var(--text3);margin-top:4px">Inquadra il QR in filiale con la fotocamera o avvicina il telefono al tag NFC</div>';
  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<div style="font-size:13px;font-weight:700;color:var(--navy)">🕐 Timbratura</div>' +
    '<div style="font-size:13px;font-weight:600">' + inStr + ' · ' + outStr + '</div></div>' +
    footer;
}

// Verso automatico: la prima timbratura del giorno è l'ingresso, dalla
// seconda in poi è l'uscita (l'ultima OUT vince nella riconciliazione).
function tipoAutomatico() {
  return haInOggi() ? 'out' : 'in';
}

function haInOggi() {
  return S.timbratureOggi.some(function (t) { return t.tipo === 'in' });
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
  await loadTimbratureOggi();

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

// Bottone "Ho timbrato → ricontrolla" nella schermata di blocco.
export async function ricontrollaTimbratura() {
  const btn = document.getElementById('btnGateRicontrolla');
  if (btn) { btn.disabled = true; btn.textContent = 'Controllo...' }
  await loadTimbratureOggi();
  if (btn) { btn.disabled = false; btn.textContent = 'Ho timbrato → ricontrolla' }
  if (haInOggi()) mostraProsieguo();
  else showToast('Nessun ingresso registrato oggi — avvicina il telefono al tag o inquadra il QR');
}

// Annulla dalla modal di conferma: si torna al punto giusto del flusso
// (gate se manca l'IN e il blocco è attivo, altrimenti targa/app).
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
    const outGiaFatta = tipo === 'out' && S.timbratureOggi.some(function (t) { return t.tipo === 'out' });
    if (outGiaFatta && !confirm('Avevi già timbrato l\'uscita: aggiorno l\'orario a adesso?')) return;

    await scriviTimbratura(tipo, metodo, pendingParams.provincia, punto, pendingParams.token);

    document.getElementById('timbraView').style.display = 'none';
    pendingParams = null;
    mostraProsieguo(); // dopo l'IN si prosegue con targa/app
  } catch (e) {
    console.error('timbratura error:', e);
    showToast('Errore timbratura — riprova: ' + (e.message || ''));
  } finally {
    busy = false;
    if (btn) { btn.disabled = false; btn.textContent = labelIdle }
  }
}

// Geofence + scrittura del doc timbrature (schema unificato ZKTeco/app).
// Fuori raggio o GPS negato non bloccano: marcano `sospetto` per la
// riconciliazione anti-frode in dashboard.
async function scriviTimbratura(tipo, metodo, provincia, punto, tokenLetto) {
  const pos = await getPosizione();
  let sospetto = false, note = null;
  const geo = (punto && punto.geo) || {};
  if (pos && typeof geo.lat === 'number') {
    const dist = distanzaMt(pos.lat, pos.lng, geo.lat, geo.lng);
    const raggio = (geo.raggioMt || 100) + (pos.accuracy || 0);
    if (dist > raggio) { sospetto = true; note = 'Fuori raggio: ' + dist + 'm dal punto' }
  } else {
    sospetto = true;
    note = pos ? 'Punto senza coordinate' : 'GPS non disponibile';
  }

  await addDoc(collection(db, 'timbrature'), {
    driverId: (auth.currentUser.email || '').toLowerCase(),
    driverNome: (S.dp.cognome || '') + ' ' + (S.dp.nome || ''),
    filialeId: provincia,
    citta: cn(provincia),
    tipo: tipo,
    timestamp: serverTimestamp(),
    giorno: oggiRoma(),
    mese: meseCorrenteRoma(),
    fonte: 'app',
    metodo: metodo,
    qrTokenLetto: tokenLetto || null,
    lat: pos ? pos.lat : null,
    lng: pos ? pos.lng : null,
    accuracy: pos ? pos.accuracy : null,
    sospetto: sospetto,
    note: note
  });

  showToast(tipo === 'in' ? '🟢 Ingresso timbrato!' : '🔴 Uscita timbrata — buon rientro!');
  if (sospetto) showToast('⚠️ Posizione non verificata: la timbratura sarà controllata');
  await loadTimbratureOggi();
}

// Uscita dalla card nel tab Oggi: niente scansione (l'anti-frode forte è
// sull'ingresso), ma geofence sempre verificato → metodo 'app-geo'.
let busyOut = false;
export async function timbraturaOutDaApp() {
  if (!auth.currentUser || !S.dp) { showToast('Sessione non pronta. Ricarica la pagina.'); return }
  if (busyOut) return;
  if (!haInOggi()) { showToast('Prima timbra l\'ingresso con QR o tag NFC'); return }
  const outGiaFatta = S.timbratureOggi.some(function (t) { return t.tipo === 'out' });
  const msg = outGiaFatta ? 'Avevi già timbrato l\'uscita: aggiorno l\'orario a adesso?' : 'Timbrare l\'uscita adesso?';
  if (!confirm(msg)) return;
  busyOut = true;
  try {
    const prov = S.dp.citta;
    let punto = null;
    try {
      const s = await getDoc(doc(db, 'puntiTimbratura', prov));
      if (s.exists()) punto = s.data();
    } catch (e) { /* geofence non disponibile → sospetto */ }
    await scriviTimbratura('out', 'app-geo', prov, punto, null);
  } catch (e) {
    console.error('timbratura out error:', e);
    showToast('Errore timbratura — riprova: ' + (e.message || ''));
  } finally {
    busyOut = false;
  }
}
