// Entry point: binding degli eventi UI e avvio dell'app.
import { oggiRoma } from './utils.js';
import { initAuthListener, doLogin, showReset, hideReset, doReset, doLogout } from './auth.js';
import { showTargaModal, confermaTarga, chiudiTargaModal } from './turno.js';
import { showTab } from './nav.js';
import { eliminaReport, eliminaRitorno } from './views/oggi.js';
import { setOggi, prefillOraInizio, salvaReport, resetNuova } from './views/nuova.js';
import { salvaRitorno, resetRitorno } from './views/ritorno.js';
import { previewFoto, inviaSegnalazione, resetSegnala } from './views/segnala.js';
import { chiudiLbIntro } from './views/classifica.js';
import { salvaProfilo, chiudiAlertProfilo, rimandaAlertProfilo } from './views/profilo.js';

function on(id, fn) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
  else console.warn('bind mancante:', id);
}

// Login / reset password
on('btnLogin', doLogin);
on('btnShowReset', showReset);
on('btnDoReset', doReset);
on('btnHideReset', hideReset);
on('btnLogout', doLogout);
document.getElementById('loginPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin() });

// Turno / targa
on('btnTarga', confermaTarga);
on('btnAnnullaTarga', chiudiTargaModal);
on('btnCambiaTarga', showTargaModal);
document.getElementById('targaInput').addEventListener('input', function () { this.value = this.value.toUpperCase() });

// Classifica: popup intro
on('btnLbIntroOk', chiudiLbIntro);

// Nuova consegna
on('btnNcOggi', setOggi);
on('btnSalvaReport', salvaReport);
on('btnNuovaAltra', resetNuova);
document.getElementById('ncFascia').addEventListener('change', prefillOraInizio);

// Ritorno
on('btnRtOggi', function () { document.getElementById('rtData').value = oggiRoma() });
on('btnSalvaRitorno', salvaRitorno);
on('btnRitornoAltro', resetRitorno);

// Segnalazioni
on('fotoUploadZone', function () { document.getElementById('segFoto').click() });
document.getElementById('segFoto').addEventListener('change', function () { previewFoto(this) });
on('btnInviaSeg', inviaSegnalazione);
on('btnSegAltra', resetSegnala);

// Profilo
on('btnSalvaProfilo', salvaProfilo);
on('btnAlertCompleta', chiudiAlertProfilo);
on('btnAlertRimanda', rimandaAlertProfilo);

// Navigazione: bottom nav + bottoni "vai a tab" (data-goto)
document.querySelectorAll('.nav-tab').forEach(function (t) {
  t.addEventListener('click', function () { showTab(t.dataset.tab) });
});
document.querySelectorAll('[data-goto]').forEach(function (b) {
  b.addEventListener('click', function () { showTab(b.dataset.goto) });
});

// Delegation per i bottoni elimina nelle card generate dinamicamente
document.addEventListener('click', function (e) {
  var r = e.target.closest('[data-del-report]');
  if (r) { eliminaReport(r.dataset.delReport); return }
  var t = e.target.closest('[data-del-ritorno]');
  if (t) eliminaRitorno(t.dataset.delRitorno);
});

window.addEventListener('offline', function () { document.getElementById('offlineBanner').style.display = 'block' });
window.addEventListener('online', function () { document.getElementById('offlineBanner').style.display = 'none' });

initAuthListener();

// PWA: service worker con strategia network-first (gli aggiornamenti
// arrivano subito ai driver, la cache serve solo da fallback offline).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(function (e) {
    console.warn('SW non registrato:', e.message);
  });
}
