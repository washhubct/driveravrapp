// Autenticazione: login, reset password, logout, bootstrap post-login.
import { auth, db, collection, query, where, getDocs, addDoc, serverTimestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase.js';
import { S, resetSessionState } from './state.js';
import { cn, showToast } from './utils.js';
import { loadFl, loadReports, loadRitorni } from './data.js';
import { flushOutbox, updateOutboxBanner } from './offline.js';
import { avviaFlussoIngresso } from './timbratura.js';
import { rOggi } from './views/oggi.js';
import { rComp } from './views/compensi.js';
import { rProf, caricaDatiProfilo } from './views/profilo.js';
import { initDateLimits } from './views/nuova.js';

export function doLogin() {
  const e = document.getElementById('loginEmail').value.trim(), p = document.getElementById('loginPw').value;
  document.getElementById('loginErr').textContent = '';
  if (!e || !p) { document.getElementById('loginErr').textContent = 'Inserisci email e password'; return }
  signInWithEmailAndPassword(auth, e, p).catch(function (r) {
    let m = 'Errore di accesso';
    if (r.code === 'auth/user-not-found' || r.code === 'auth/wrong-password' || r.code === 'auth/invalid-credential') m = 'Email o password non validi';
    if (r.code === 'auth/too-many-requests') m = 'Troppi tentativi';
    document.getElementById('loginErr').textContent = m;
  });
}

export function showReset() {
  document.getElementById('loginMain').classList.add('hidden');
  document.getElementById('resetWrap').classList.add('active');
  document.getElementById('resetEmail').value = document.getElementById('loginEmail').value;
}

export function hideReset() {
  document.getElementById('loginMain').classList.remove('hidden');
  document.getElementById('resetWrap').classList.remove('active');
}

export async function doReset() {
  const e = document.getElementById('resetEmail').value.trim(), m = document.getElementById('resetMsg'), btn = document.querySelector('#resetWrap .btn-blue');
  if (!e) { m.style.color = '#dc2626'; m.textContent = 'Inserisci la tua email'; return }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { m.style.color = '#dc2626'; m.textContent = 'Email non valida'; return }
  btn.disabled = true; btn.textContent = 'Invio in corso...'; m.textContent = '';
  try {
    await fetch('https://europe-west1-avr-logistic-dashboard.cloudfunctions.net/requestPasswordReset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e })
    });
    m.style.color = '#16a34a';
    m.textContent = 'Se l\'email è registrata, riceverai il link a breve.';
  } catch (err) {
    m.style.color = '#dc2626';
    m.textContent = 'Errore di rete — riprova più tardi';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Invia link di reset';
  }
}

export function doLogout() {
  signOut(auth); // lo stato di sessione viene azzerato da onAuthStateChanged
}

// Log accesso driver su Firestore (visibile in Dashboard > Log Accessi).
// Una sola write per sessione di login; su errore si ritenta al prossimo evento.
async function logAccessoDriver(user) {
  if (S.accessoLoggato) return;
  S.accessoLoggato = true;
  try {
    const ua = navigator.userAgent || '';
    await addDoc(collection(db, 'driverAccessLog'), {
      email: user.email,
      uid: user.uid,
      ruolo: 'driver',
      piattaforma: 'app-driver',
      dispositivo: /Mobile|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop',
      browser: ua.length > 120 ? ua.substring(0, 120) : ua,
      timestamp: serverTimestamp(),
      data: new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
    });
  } catch (e) {
    console.warn('Errore log accesso:', e.message);
    S.accessoLoggato = false;
  }
}

async function initApp(email) {
  let s;
  try {
    s = await getDocs(query(collection(db, 'driverAnagrafica'), where('email', '==', email.toLowerCase())));
  } catch (e) {
    console.error('init error:', e);
    showToast('Errore di connessione — ricarica la pagina per riprovare');
    return;
  }
  if (!s.empty) {
    S.dp = s.docs[0].data();
    S.dp.id = s.docs[0].id;
    S.cc = S.dp.costoConsegna || 3.50;
  } else {
    // Email non trovata in anagrafica — blocca accesso
    document.getElementById('appView').style.display = 'none';
    document.getElementById('targaView').style.display = 'none';
    const box = document.createElement('div');
    box.id = 'noProfileOverlay';
    box.style.cssText = 'position:fixed;inset:0;background:rgba(15,29,61,0.95);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px';
    box.innerHTML = '<div style="background:#fff;border-radius:20px;padding:36px 28px;max-width:360px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)"><div style="font-size:48px;margin-bottom:12px">🔒</div><div style="font-size:18px;font-weight:800;color:#0f1d3d;margin-bottom:8px">Account non abilitato</div><div style="font-size:14px;color:#64748b;line-height:1.7;margin-bottom:8px">L\'email <strong style="color:#0f1d3d">' + email + '</strong> non è ancora abilitata all\'app driver.</div><div style="font-size:13px;color:#64748b;line-height:1.7;margin-bottom:20px">Contatta l\'amministrazione Last Mile per essere attivato:<br><a href="mailto:amministrazione@avrlogisticarl.com" style="color:#2563eb;font-weight:600;text-decoration:none">amministrazione@avrlogisticarl.com</a></div><button id="btnNoProfileBack" style="width:100%;padding:14px;background:#0f1d3d;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:var(--font)">← Torna al login</button></div>';
    document.body.appendChild(box);
    document.getElementById('btnNoProfileBack').addEventListener('click', function () {
      box.remove();
      doLogout();
    });
    return;
  }
  document.getElementById('driverName').textContent = S.dp.cognome + ' ' + (S.dp.nome || '');
  document.getElementById('driverCity').textContent = 'Driver — ' + cn(S.dp.citta);
  document.getElementById('targaHello').textContent = 'Ciao ' + (S.dp.nome || S.dp.cognome) + '!';
  document.getElementById('profNome').textContent = S.dp.cognome + ' ' + (S.dp.nome || '');
  document.getElementById('profEmail').textContent = email;
  document.getElementById('profCitta').textContent = cn(S.dp.citta);
  document.getElementById('profContratto').textContent = S.dp.contratto || '—';
  initDateLimits();
  // Le tre query sono indipendenti (collection diverse): in parallelo si
  // risparmiano 1-2s di attesa su rete mobile prima del modal targa.
  await Promise.all([loadFl(), loadReports(), loadRitorni()]);
  caricaDatiProfilo();
  rOggi(); rComp(); rProf();
  // Inserimenti rimasti in coda da una sessione offline precedente
  updateOutboxBanner();
  flushOutbox().then(function (n) {
    if (n > 0) { loadReports().then(rOggi); loadRitorni() }
  });
  // Flusso di ingresso: timbratura (QR/NFC o gate) → targa → app
  await avviaFlussoIngresso();
}

export function initAuthListener() {
  onAuthStateChanged(auth, function (u) {
    if (u) {
      document.getElementById('loginView').style.display = 'none';
      logAccessoDriver(u);
      initApp(u.email);
    } else {
      document.getElementById('loginView').style.display = 'flex';
      document.getElementById('appView').style.display = 'none';
      document.getElementById('targaView').style.display = 'none';
      resetSessionState();
    }
  });
}
