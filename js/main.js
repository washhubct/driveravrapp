// Entry point: espone gli handler agli onclick inline e avvia l'app.
// (La rimozione degli onclick inline in favore di addEventListener è
// prevista come step successivo del refactor.)
import './firebase.js';
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

Object.assign(window, {
  oggiRoma,
  doLogin, showReset, hideReset, doReset, doLogout,
  showTargaModal, confermaTarga, chiudiTargaModal,
  showTab,
  eliminaReport, eliminaRitorno,
  setOggi, prefillOraInizio, salvaReport, resetNuova,
  salvaRitorno, resetRitorno,
  previewFoto, inviaSegnalazione, resetSegnala,
  chiudiLbIntro,
  salvaProfilo, chiudiAlertProfilo, rimandaAlertProfilo
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
