// Tab "Oggi": KPI, report di oggi/recenti, ritorni recenti, banner motivazionale.
import { auth, db, doc, deleteDoc } from '../firebase.js';
import { S } from '../state.js';
import { oggiRoma, escapeHtml, showToast, errMsg, fmtDurata, recordYMD } from '../utils.js';
import { getFilialeNome, loadReports, loadRitorni } from '../data.js';
import { rComp } from './compensi.js';

let busy = false;

export function rOggi() {
  const oggi = oggiRoma();
  const ms = oggi.substring(0, 7);
  let consOggi = 0, consMese = 0, ritorniMese = 0;
  const giorniMese = {};
  S.reports.forEach(function (r) {
    const d = recordYMD(r);
    if (d === oggi) consOggi += (r.numConsegne || 0);
    if (d.substring(0, 7) === ms) {
      consMese += (r.numConsegne || 0);
      if ((r.numConsegne || 0) > 0) giorniMese[d] = true;
    }
  });
  S.ritorniList.forEach(function (r) {
    if (recordYMD(r).substring(0, 7) === ms) ritorniMese += (r.numRitorni || 0);
  });
  const nGiorni = Object.keys(giorniMese).length;
  document.getElementById('kOggi').textContent = consOggi;
  document.getElementById('kMese').textContent = consMese;
  document.getElementById('kMeseMedia').textContent = nGiorni > 0 ? '~' + Math.round(consMese / nGiorni) + '/giorno' : 'consegne';
  document.getElementById('kRitorni').textContent = ritorniMese;

  const todayReports = S.reports.filter(function (r) { return recordYMD(r) === oggi });
  const el = document.getElementById('listaOggi');
  if (!todayReports.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p>Nessun report per oggi</p><p style="font-size:12px;margin-top:4px">Premi "+ Registra consegne" per iniziare</p></div>';
  } else {
    el.innerHTML = todayReports.map(function (r) { return reportCard(r) }).join('');
  }

  const recenti = S.reports.filter(function (r) { return recordYMD(r) !== oggi }).slice(0, 20);
  const el2 = document.getElementById('listaRecenti');
  if (!recenti.length) {
    el2.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>Nessun report precedente</p></div>';
  } else {
    let lastDate = '', h = '';
    recenti.forEach(function (r) {
      const ds = r.data.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      if (ds !== lastDate) { h += '<div class="date-label">' + ds + '</div>'; lastDate = ds }
      h += reportCard(r);
    });
    el2.innerHTML = h;
  }
  showMotivational(consOggi, consMese);

  // Ritorni recenti
  const el3 = document.getElementById('listaRitorni');
  if (!S.ritorniList.length) {
    el3.innerHTML = '<div class="empty" style="padding:16px"><p style="font-size:12px;color:var(--text3)">Nessun ritorno registrato</p></div>';
  } else {
    el3.innerHTML = S.ritorniList.map(function (r) {
      const ds = r.data.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      const fNome = getFilialeNome(r.filiale);
      const statoHtml = r.stato === 'accettato' ? '<span class="report-badge" style="background:#f0fdf4;color:#16a34a">✓ Accettato</span>'
        : r.stato === 'rifiutato' ? '<span class="report-badge" style="background:#fef2f2;color:#dc2626">✕ Rifiutato</span>'
        : '<span class="report-badge" style="background:#fef3c7;color:#d97706">⏳ In attesa</span>';
      return '<div class="report-card">' +
        (r.stato !== 'accettato' && r.stato !== 'rifiutato' ? '<button class="btn-delete" data-del-ritorno="' + r.id + '" title="Elimina">✕</button>' : '') +
        '<div class="report-top"><div class="report-filiale">🔄 ' + fNome + '</div></div>' +
        '<div class="report-bottom"><span class="report-badge">📅 ' + ds + '</span>' + statoHtml +
        '<span class="report-badge">' + escapeHtml(r.motivoLabel || r.motivo || '') + '</span>' +
        '<span class="report-badge">👤 ' + escapeHtml(r.cliente || '—') + '</span></div></div>';
    }).join('');
  }
}

export function reportCard(r) {
  const filialeNome = getFilialeNome(r.filiale);
  let h = '<div class="report-card">';
  h += '<button class="btn-delete" data-del-report="' + r.id + '" title="Elimina">✕</button>';
  h += '<div class="report-top"><div class="report-filiale">' + filialeNome + '</div><div class="report-count">' + (r.numConsegne || 0) + ' <span>consegne</span></div></div>' +
    '<div class="report-bottom"><span class="report-badge">' + (r.fascia || '') + '</span><span class="report-badge">🚐 ' + (r.targa || '—') + '</span>' +
    (r.durataMin ? '<span class="report-badge">⏱ ' + fmtDurata(r.durataMin) + ' · ~' + fmtDurata(r.tempoMedioMin || r.durataMin / (r.numConsegne || 1)) + '/consegna</span>' : '') + '</div>';
  if (r.note) { h += '<div class="report-note">' + escapeHtml(r.note) + '</div>' }
  h += '</div>';
  return h;
}

export async function eliminaReport(id) {
  if (!auth.currentUser) return;
  if (busy) return;
  if (!confirm('Vuoi eliminare questo report?')) return;
  busy = true;
  try {
    await deleteDoc(doc(db, 'reportDriver', id));
    showToast('Report eliminato');
    await loadReports();
    rOggi(); rComp();
  } catch (e) {
    showToast('Impossibile eliminare — riprova: ' + errMsg(e));
  } finally {
    busy = false;
  }
}

export async function eliminaRitorno(id) {
  if (!auth.currentUser) return;
  if (busy) return;
  if (!confirm('Vuoi eliminare questo ritorno?')) return;
  busy = true;
  try {
    await deleteDoc(doc(db, 'ritorni', id));
    showToast('Ritorno eliminato');
    await loadRitorni();
    rOggi();
  } catch (e) {
    showToast('Impossibile eliminare — riprova: ' + errMsg(e));
  } finally {
    busy = false;
  }
}

// Banner motivazionale: riceve i conteggi già calcolati da rOggi per non
// duplicare la logica dei KPI.
export function showMotivational(consOggi, consMese) {
  const el = document.getElementById('motivationalBanner');
  const hour = new Date().getHours();
  let emoji, text, sub;

  if (hour < 10) {
    emoji = '☀️';
    text = 'Buona giornata ' + (S.dp.nome || S.dp.cognome || '') + '!';
    sub = 'Ogni consegna fa la differenza. Parti alla grande!';
  } else if (consOggi === 0) {
    emoji = '🎯';
    text = 'Nessuna consegna registrata oggi';
    sub = 'Il primo passo è sempre il più importante. Inizia ora!';
  } else if (consOggi >= 20) {
    emoji = '🔥';
    text = 'Sei una macchina! ' + consOggi + ' consegne oggi!';
    sub = 'Performance eccezionale. Continua così!';
  } else if (consOggi >= 10) {
    emoji = '💪';
    text = 'Ottimo lavoro! ' + consOggi + ' consegne e ancora in pista';
    sub = 'Stai andando forte, non mollare!';
  } else if (consOggi >= 5) {
    emoji = '👏';
    text = 'Bel ritmo! ' + consOggi + ' consegne fatte';
    sub = 'Ogni consegna ti avvicina alla vetta della classifica';
  } else {
    emoji = '🚀';
    text = consOggi + ' consegne registrate oggi';
    sub = 'Hai iniziato bene, continua su questa strada!';
  }

  if (consMese >= 200) {
    emoji = '🏆'; text = 'Mese da campione! ' + consMese + ' consegne totali';
    sub = 'Sei tra i migliori del team. Fenomenale!';
  }

  el.innerHTML = '<div class="motiv-emoji">' + emoji + '</div><div class="motiv-text">' + escapeHtml(text) + '</div><div class="motiv-sub">' + escapeHtml(sub) + '</div>';
}
