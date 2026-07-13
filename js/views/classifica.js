// Tab "Classifica": leaderboard anonima mensile (doc aggregato scritto da Cloud Function).
import { auth, db } from '../firebase.js';
import { S } from '../state.js';
import { meseCorrenteRoma } from '../utils.js';
import { showTab } from '../nav.js';

// Nicknames per classifica anonima — lista ampia per evitare duplicati
var DRIVER_ANIMALS = ['🦅 Aquila', '🐆 Ghepardo', '🚀 Razzo', '⚡ Fulmine', '🦁 Leone', '🐺 Lupo', '🏎️ Turbo', '🔥 Fiamma', '🦊 Volpe', '💎 Diamante', '🐻 Orso', '🦈 Squalo', '🎯 Freccia', '🌊 Onda', '⭐ Stella', '🐉 Drago', '🦅 Falco', '🏔️ Everest', '🌪️ Tornado', '🐎 Mustang', '🦬 Bisonte', '🐗 Cinghiale', '🦏 Rinoceronte', '🐊 Coccodrillo', '🐯 Tigre', '🦚 Pavone', '🐘 Elefante', '🦩 Fenicottero', '🦉 Gufo', '🐧 Pinguino', '🦀 Granchio', '🐬 Delfino', '🐝 Calabrone', '🦎 Iguana', '🐾 Pantera', '🌟 Cometa', '🏹 Arciere', '🛡️ Gladiatore', '🗡️ Samurai', '⚔️ Spartano', '🎸 Rockstar', '🔱 Poseidone', '👑 Imperatore', '🏰 Cavaliere'];

export function getNickname(driverName) {
  var hash = 0;
  for (var i = 0; i < driverName.length; i++) { hash = ((hash << 5) - hash) + driverName.charCodeAt(i) * 31; hash |= 0 }
  var idx = Math.abs(hash) % DRIVER_ANIMALS.length;
  return DRIVER_ANIMALS[idx];
}

export function renderTrendMobile(posPrec, posCorrente) {
  if (posPrec == null) return '<span class="lb-trend new">NEW</span>';
  var delta = posPrec - posCorrente;
  if (delta > 0) return '<span class="lb-trend up">↑ ' + delta + '</span>';
  if (delta < 0) return '<span class="lb-trend down">↓ ' + Math.abs(delta) + '</span>';
  return '<span class="lb-trend flat">=</span>';
}

// Popup primo accesso classifica — mostrato una sola volta per dispositivo
export function maybeShowLbIntro() {
  try { if (localStorage.getItem('avrLbIntro_v1')) return } catch (e) { return }
  document.getElementById('lbIntroView').style.display = 'flex';
}

export function chiudiLbIntro() {
  document.getElementById('lbIntroView').style.display = 'none';
  try { localStorage.setItem('avrLbIntro_v1', '1') } catch (e) { }
  showTab('classifica');
}

function setLeaderboardHtml(html) {
  var el = document.getElementById('leaderboard'); if (el) el.innerHTML = html;
  var el2 = document.getElementById('leaderboardTab'); if (el2) el2.innerHTML = html;
}

// Hash anonimo della propria email — stesso algoritmo della Cloud Function
// (sha256 primi 16 hex): serve a riconoscere la propria riga in classifica
// senza che il documento contenga nomi reali.
async function getMyLbHash() {
  if (S.myLbHash) return S.myLbHash;
  try {
    var email = (auth.currentUser && auth.currentUser.email || '').toLowerCase().trim();
    if (!email || !window.crypto || !crypto.subtle) return null;
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
    S.myLbHash = Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0') }).join('').slice(0, 16);
  } catch (e) { console.warn('hash:', e.message) }
  return S.myLbHash;
}

export async function loadLeaderboard() {
  var meseCorrente = meseCorrenteRoma();
  var myHash = await getMyLbHash();
  var myName = (S.dp.cognome || '').toUpperCase().trim();

  try {
    var doc = await db.collection('leaderboard').doc(meseCorrente).get();
    if (!doc.exists || ((doc.data().drivers || []).length === 0)) {
      // Empty state motivante: distinguiamo "primo del mese / nessun report ancora"
      // dal "tu non hai ancora consegne" (basato su reports caricati)
      var hasMyReports = S.reports.some(function (r) {
        var d = r.data instanceof Date ? r.data.toISOString().slice(0, 7) : (r.data || '').substring(0, 7);
        return d === meseCorrente;
      });
      var msg = hasMyReports
        ? 'Classifica in costruzione… si aggiorna in automatico ogni ora.'
        : 'Inizia il tuo turno per entrare in classifica!';
      setLeaderboardHtml('<div class="empty" style="padding:20px"><div class="empty-icon">🏆</div><p>' + msg + '</p></div>');
      return;
    }
    var data = doc.data();
    var sorted = data.drivers || [];
    var totalDrivers = data.totalDrivers || sorted.length;

    // Match "SEI TU": nuovo formato anonimo via hash, legacy via cognome
    function isMyEntry(entry) { return entry.h ? (myHash && entry.h === myHash) : entry.driver === myName }

    var myPos = -1;
    sorted.forEach(function (entry, i) { if (isMyEntry(entry)) myPos = i });

    var top10 = sorted.slice(0, 10);
    var html = '';
    top10.forEach(function (entry, i) {
      var pos = i + 1;
      var isMe = isMyEntry(entry);
      var posClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(pos);
      var nick = getNickname(entry.h || entry.driver || '');
      var youTag = isMe ? '<span class="lb-you">SEI TU!</span>' : '';
      var bonusTag = (entry.bonusVelocita > 0 ? '<span class="lb-bonus" title="Bonus velocità">⚡</span>' : '') + (entry.bonusZeroDanni ? '<span class="lb-bonus">🛡️</span>' : '');
      var trend = renderTrendMobile(entry.posPrec, pos);

      html += '<div class="lb-row' + (isMe ? ' me' : '') + '">' +
        '<div class="lb-pos ' + posClass + '">' + medal + '</div>' +
        '<div class="lb-nick">' + nick + bonusTag + youTag + '<div class="lb-trend-wrap">' + trend + '</div></div>' +
        '<div class="lb-score">' + entry.score + ' <span>punti</span></div>' +
        '</div>';
    });

    if (myPos >= 10) {
      var myData = sorted[myPos];
      var myBonus = (myData.bonusVelocita > 0 ? '<span class="lb-bonus">⚡</span>' : '') + (myData.bonusZeroDanni ? '<span class="lb-bonus">🛡️</span>' : '');
      var myTrend = renderTrendMobile(myData.posPrec, myPos + 1);
      // Percentile: 1° = 100%, ultimo = ~ (1/total)*100
      var percentile = Math.max(1, Math.round((1 - myPos / totalDrivers) * 100));
      html += '<div class="lb-row me" style="border-top:2px dashed var(--border)">' +
        '<div class="lb-pos normal">' + (myPos + 1) + '°</div>' +
        '<div class="lb-nick">' + getNickname(myData.h || myName) + myBonus + '<span class="lb-you">SEI TU!</span>' +
        '<div class="lb-trend-wrap">' + myTrend + ' · top ' + percentile + '%</div>' +
        '</div>' +
        '<div class="lb-score">' + myData.score + ' <span>punti</span></div>' +
        '</div>';
    } else if (myPos === -1) {
      // Sono autenticato ma non in classifica → driver senza consegne nel mese
      html += '<div class="lb-row" style="border-top:2px dashed var(--border);opacity:.7">' +
        '<div class="lb-pos normal">—</div>' +
        '<div class="lb-nick">' + getNickname(myHash || myName) + '<span class="lb-you">SEI TU!</span>' +
        '<div class="lb-trend-wrap" style="font-size:10px;color:var(--text3)">Registra consegne per entrare</div>' +
        '</div>' +
        '<div class="lb-score">0 <span>punti</span></div>' +
        '</div>';
    }

    html += '<div style="padding:10px 16px;font-size:10px;color:var(--text3);border-top:1px solid var(--border)">' +
      '1 consegna = 1 pt · ⚡ Velocità = +30/+15 pt · 🛡️ Zero danni = +50 pt · Danno = -30 pt<br>' +
      '🏆 Premi mensili in buoni pasto: 🥇 €100 · 🥈 €70 · 🥉 €40</div>';

    setLeaderboardHtml(html);
  } catch (e) {
    console.warn('Leaderboard load:', e.message);
    setLeaderboardHtml('<div class="empty" style="padding:20px"><p style="font-size:12px">Classifica non disponibile</p></div>');
  }
}
