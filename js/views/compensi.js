// Tab "Consegne" (storico mensile).
import { S } from '../state.js';

export function rComp() {
  var mesi = {};
  S.reports.forEach(function (r) {
    var d = r.data instanceof Date ? r.data : new Date(r.data);
    var m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!mesi[m]) mesi[m] = { count: 0, giorni: {} };
    mesi[m].count += (r.numConsegne || 0);
    if ((r.numConsegne || 0) > 0) mesi[m].giorni[d.toISOString().slice(0, 10)] = true;
  });
  var now = new Date();
  var mcur = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  if (!mesi[mcur]) mesi[mcur] = { count: 0, giorni: {} };
  var sorted = Object.entries(mesi).sort(function (a, b) { return b[0].localeCompare(a[0]) });
  var ccur = mesi[mcur].count || 0, gcur = Object.keys(mesi[mcur].giorni).length;
  document.getElementById('kCompenso').textContent = ccur;
  document.getElementById('kCompDetail').textContent = gcur > 0 ? gcur + ' giorni attivi · ~' + Math.round(ccur / gcur) + '/giorno' : '—';
  var el = document.getElementById('listaCompensi');
  var mn = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  if (!sorted.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>Nessuna consegna</p></div>';
    return;
  }
  el.innerHTML = sorted.map(function (e) {
    var p = e[0].split('-'), l = mn[parseInt(p[1]) - 1] + ' ' + p[0], g = Object.keys(e[1].giorni).length;
    return '<div class="comp-row"><div><div class="comp-mese">' + l + '</div><div class="comp-cnt">' + g + ' giorni attivi</div></div><div class="comp-val">' + e[1].count + ' consegne</div></div>';
  }).join('');
}
