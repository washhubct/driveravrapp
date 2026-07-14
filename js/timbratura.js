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
  el.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">' +
    '<div style="font-size:13px;font-weight:700;color:var(--navy)">🕐 Timbratura</div>' +
    '<div style="font-size:13px;font-weight:600">' + inStr + ' · ' + outStr + '</div></div>' +
    '<div style="font-size:11px;color:var(--text3);margin-top:4px">Inquadra il QR in filiale con la fotocamera o avvicina il telefono al tag NFC</div>';
}

// Chiamata al bootstrap: se l'app è stata aperta da QR/NFC mostra la scelta IN/OUT.
export function initTimbratura() {
  const p = new URLSearchParams(location.search);
  const provincia = (p.get('timbra') || '').toUpperCase();
  if (!provincia) { loadTimbratureOggi(); return }
  pendingParams = { provincia: provincia, token: p.get('t') || null, nfcUid: p.get('nfc') || null };
  history.replaceState(null, '', location.pathname); // evita ri-trigger su reload
  loadTimbratureOggi().then(function () {
    // Preseleziona il verso più probabile: prima del turno = IN, dopo = OUT
    document.getElementById('timbraProv').textContent = cn(pendingParams.provincia) + ' (' + pendingParams.provincia + ')';
    document.getElementById('timbraView').style.display = 'flex';
  });
}

export function chiudiTimbraModal() {
  document.getElementById('timbraView').style.display = 'none';
  pendingParams = null;
}

let busy = false;

export async function eseguiTimbratura(tipo) {
  if (!auth.currentUser || !S.dp) { showToast('Sessione non pronta. Ricarica la pagina.'); return }
  if (!pendingParams) { showToast('Apri l\'app dal QR o dal tag NFC in filiale'); return }
  if (busy) return;
  busy = true;
  const btnId = tipo === 'in' ? 'btnTimbraIn' : 'btnTimbraOut';
  const btn = document.getElementById(btnId);
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

    // 3. Geofence: fuori raggio o GPS negato non bloccano la timbratura,
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

    // 4. Anti doppione: stesso tipo già timbrato → chiedi conferma
    const giaFatto = S.timbratureOggi.some(function (t) { return t.tipo === tipo });
    if (giaFatto && !confirm('Hai già timbrato "' + tipo.toUpperCase() + '" oggi. Registrare comunque?')) return;

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

    chiudiTimbraModal();
    showToast(tipo === 'in' ? '🟢 Ingresso timbrato!' : '🔴 Uscita timbrata — buon rientro!');
    if (sospetto) showToast('⚠️ Posizione non verificata: la timbratura sarà controllata');
    await loadTimbratureOggi();
  } catch (e) {
    console.error('timbratura error:', e);
    showToast('Errore timbratura — riprova: ' + (e.message || ''));
  } finally {
    busy = false;
    if (btn) { btn.disabled = false; btn.textContent = tipo === 'in' ? '🟢 Timbra INGRESSO' : '🔴 Timbra USCITA' }
  }
}
