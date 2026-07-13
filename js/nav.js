// Navigazione tra le tab.
import { rOggi } from './views/oggi.js';
import { rComp } from './views/compensi.js';
import { rProf } from './views/profilo.js';
import { loadLeaderboard } from './views/classifica.js';
import { resetNuova } from './views/nuova.js';
import { resetRitorno } from './views/ritorno.js';
import { initSegFiliali, resetSegnala, loadSegnalazioni } from './views/segnala.js';

export function showTab(n) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active') });
  document.getElementById('tab' + n.charAt(0).toUpperCase() + n.slice(1)).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === n) });
  if (n === 'oggi') rOggi();
  if (n === 'compensi') rComp();
  if (n === 'profilo') rProf();
  if (n === 'classifica') loadLeaderboard();
  if (n === 'nuova') resetNuova();
  if (n === 'segnala') {
    initSegFiliali();
    resetSegnala();
    document.getElementById('listaSegnalazioni').innerHTML = '<div class="empty" style="padding:20px"><p style="font-size:12px;color:var(--text3)">Caricamento...</p></div>';
    loadSegnalazioni();
  }
  if (n === 'ritorno') resetRitorno();
}
