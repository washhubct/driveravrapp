// Tab "Consegne" (storico mensile).
import { S } from '../state.js';
import { meseYM, meseCorrenteRoma, recordYMD } from '../utils.js';

export function rComp() {
  const mesi = {};
  S.reports.forEach(function (r) {
    const m = meseYM(r.data);
    if (!mesi[m]) mesi[m] = { count: 0, giorni: {} };
    mesi[m].count += (r.numConsegne || 0);
    if ((r.numConsegne || 0) > 0) mesi[m].giorni[recordYMD(r)] = true;
  });
  const mcur = meseCorrenteRoma();
  if (!mesi[mcur]) mesi[mcur] = { count: 0, giorni: {} };
  const sorted = Object.entries(mesi).sort(function (a, b) { return b[0].localeCompare(a[0]) });
  const ccur = mesi[mcur].count || 0, gcur = Object.keys(mesi[mcur].giorni).length;
  document.getElementById('kCompenso').textContent = ccur;
  document.getElementById('kCompDetail').textContent = gcur > 0 ? gcur + ' giorni attivi · ~' + Math.round(ccur / gcur) + '/giorno' : '—';
  const el = document.getElementById('listaCompensi');
  const mn = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  if (!sorted.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><p>Nessuna consegna</p></div>';
    return;
  }
  el.innerHTML = sorted.map(function (e) {
    const p = e[0].split('-'), l = mn[parseInt(p[1]) - 1] + ' ' + p[0], g = Object.keys(e[1].giorni).length;
    return '<div class="comp-row"><div><div class="comp-mese">' + l + '</div><div class="comp-cnt">' + g + ' giorni attivi</div></div><div class="comp-val">' + e[1].count + ' consegne</div></div>';
  }).join('');
}
