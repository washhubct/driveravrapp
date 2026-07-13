// Tab "Oggi": KPI, report di oggi/recenti, ritorni recenti, banner motivazionale.
import { auth, db } from '../firebase.js';
import { S } from '../state.js';
import { oggiRoma, escapeHtml, showToast, errMsg, fmtDurata } from '../utils.js';
import { getFilialeNome, loadReports, loadRitorni } from '../data.js';
import { rComp } from './compensi.js';

export function rOggi() {
  var oggi = oggiRoma();
  var ms = oggi.substring(0, 7);
  var consOggi = 0, consMese = 0, ritorniMese = 0;
  S.reports.forEach(function (r) {
    var d = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : (r.data || '').substring(0, 10);
    var m = d.substring(0, 7);
    if (d === oggi) consOggi += (r.numConsegne || 0);
    if (m === ms) consMese += (r.numConsegne || 0);
  });
  S.ritorniList.forEach(function (r) {
    var d = r.data instanceof Date ? r.data : new Date(r.data);
    var m = d.toISOString().slice(0, 7);
    if (m === ms) ritorniMese += (r.numRitorni || 0);
  });
  var giorniMese = {};
  S.reports.forEach(function (r) {
    var d = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : (r.data || '').substring(0, 10);
    if (d.substring(0, 7) === ms && (r.numConsegne || 0) > 0) giorniMese[d] = true;
  });
  var nGiorni = Object.keys(giorniMese).length;
  document.getElementById('kOggi').textContent = consOggi;
  document.getElementById('kMese').textContent = consMese;
  document.getElementById('kMeseMedia').textContent = nGiorni > 0 ? '~' + Math.round(consMese / nGiorni) + '/giorno' : 'consegne';
  document.getElementById('kRitorni').textContent = ritorniMese;

  var todayReports = S.reports.filter(function (r) {
    var d = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : (r.data || '').substring(0, 10);
    return d === oggi;
  });
  var el = document.getElementById('listaOggi');
  if (!todayReports.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p>Nessun report per oggi</p><p style="font-size:12px;margin-top:4px">Premi "+ Registra consegne" per iniziare</p></div>';
  } else {
    el.innerHTML = todayReports.map(function (r) { return reportCard(r) }).join('');
  }

  var recenti = S.reports.filter(function (r) {
    var d = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : (r.data || '').substring(0, 10);
    return d !== oggi;
  }).slice(0, 20);
  var el2 = document.getElementById('listaRecenti');
  if (!recenti.length) {
    el2.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><p>Nessun report precedente</p></div>';
  } else {
    var lastDate = '', h = '';
    recenti.forEach(function (r) {
      var d = r.data instanceof Date ? r.data : new Date(r.data);
      var ds = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      if (ds !== lastDate) { h += '<div class="date-label">' + ds + '</div>'; lastDate = ds }
      h += reportCard(r);
    });
    el2.innerHTML = h;
  }
  showMotivational();

  // Ritorni recenti
  var el3 = document.getElementById('listaRitorni');
  if (!S.ritorniList.length) {
    el3.innerHTML = '<div class="empty" style="padding:16px"><p style="font-size:12px;color:var(--text3)">Nessun ritorno registrato</p></div>';
  } else {
    el3.innerHTML = S.ritorniList.map(function (r) {
      var d = r.data instanceof Date ? r.data : new Date(r.data);
      var ds = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
      var fNome = getFilialeNome(r.filiale);
      var statoHtml = r.stato === 'accettato' ? '<span class="report-badge" style="background:#f0fdf4;color:#16a34a">✓ Accettato</span>'
        : r.stato === 'rifiutato' ? '<span class="report-badge" style="background:#fef2f2;color:#dc2626">✕ Rifiutato</span>'
        : '<span class="report-badge" style="background:#fef3c7;color:#d97706">⏳ In attesa</span>';
      return '<div class="report-card">' +
        (r.stato !== 'accettato' && r.stato !== 'rifiutato' ? '<button class="btn-delete" onclick="eliminaRitorno(\'' + r.id + '\')" title="Elimina">✕</button>' : '') +
        '<div class="report-top"><div class="report-filiale">🔄 ' + fNome + '</div></div>' +
        '<div class="report-bottom"><span class="report-badge">📅 ' + ds + '</span>' + statoHtml +
        '<span class="report-badge">' + escapeHtml(r.motivoLabel || r.motivo || '') + '</span>' +
        '<span class="report-badge">👤 ' + escapeHtml(r.cliente || '—') + '</span></div></div>';
    }).join('');
  }
}

export function reportCard(r) {
  var filialeNome = getFilialeNome(r.filiale);
  var h = '<div class="report-card">';
  h += '<button class="btn-delete" onclick="eliminaReport(\'' + r.id + '\')" title="Elimina">✕</button>';
  h += '<div class="report-top"><div class="report-filiale">' + filialeNome + '</div><div class="report-count">' + (r.numConsegne || 0) + ' <span>consegne</span></div></div>' +
    '<div class="report-bottom"><span class="report-badge">' + (r.fascia || '') + '</span><span class="report-badge">🚐 ' + (r.targa || '—') + '</span>' +
    (r.durataMin ? '<span class="report-badge">⏱ ' + fmtDurata(r.durataMin) + ' · ~' + fmtDurata(r.tempoMedioMin || r.durataMin / (r.numConsegne || 1)) + '/consegna</span>' : '') + '</div>';
  if (r.note) { h += '<div class="report-note">' + escapeHtml(r.note) + '</div>' }
  h += '</div>';
  return h;
}

export async function eliminaReport(id) {
  if (!auth.currentUser) return;
  if (S.submitting) return;
  if (!confirm('Vuoi eliminare questo report?')) return;
  S.submitting = true;
  try {
    await db.collection('reportDriver').doc(id).delete();
    showToast('Report eliminato');
    await loadReports();
    rOggi(); rComp();
  } catch (e) {
    showToast('Impossibile eliminare — riprova: ' + errMsg(e));
  } finally {
    S.submitting = false;
  }
}

export async function eliminaRitorno(id) {
  if (!auth.currentUser) return;
  if (S.submitting) return;
  if (!confirm('Vuoi eliminare questo ritorno?')) return;
  S.submitting = true;
  try {
    await db.collection('ritorni').doc(id).delete();
    showToast('Ritorno eliminato');
    await loadRitorni();
    rOggi();
  } catch (e) {
    showToast('Impossibile eliminare — riprova: ' + errMsg(e));
  } finally {
    S.submitting = false;
  }
}

export function showMotivational() {
  var el = document.getElementById('motivationalBanner');
  var oggi = oggiRoma();
  var consOggi = 0, consMese = 0;
  S.reports.forEach(function (r) {
    var d = r.data instanceof Date ? r.data.toISOString().slice(0, 10) : (r.data || '').substring(0, 10);
    if (d === oggi) consOggi += (r.numConsegne || 0);
    var m = d.substring(0, 7);
    var ms = oggi.substring(0, 7);
    if (m === ms) consMese += (r.numConsegne || 0);
  });

  var hour = new Date().getHours();
  var emoji, text, sub;

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
