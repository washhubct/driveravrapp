// Utility pure, senza stato né dipendenze.

// Data di oggi YYYY-MM-DD in TZ Europe/Rome (toISOString è UTC: tra
// mezzanotte e le 2 slitterebbe al giorno precedente).
export function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Mese corrente YYYY-MM in TZ Europe/Rome (indipendente dal TZ del device).
export function meseCorrenteRoma() {
  var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  var y = parts.find(function (p) { return p.type === 'year' }).value;
  var m = parts.find(function (p) { return p.type === 'month' }).value;
  return y + '-' + m;
}

export function escapeHtml(t) {
  if (!t) return '';
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function showToast(m) {
  var e = document.createElement('div');
  e.className = 'toast';
  e.textContent = m;
  document.body.appendChild(e);
  setTimeout(function () { e.style.opacity = '0'; setTimeout(function () { e.remove() }, 300) }, 3000);
}

export function setBtn(id, busy, idleLabel) {
  var b = document.getElementById(id);
  if (!b) return;
  b.disabled = busy;
  if (!busy && idleLabel) b.textContent = idleLabel;
}

export function errMsg(e) {
  return (e && e.message) ? e.message : 'Riprova';
}

export function cn(c) {
  return { CT: 'Catania', ME: 'Messina', EN: 'Enna', SR: 'Siracusa', PA: 'Palermo' }[c] || c || '—';
}

// Minuti tra due orari HH:MM (stesso giorno)
export function minutiTra(inizio, fine) {
  var pi = inizio.split(':'), pf = fine.split(':');
  return (parseInt(pf[0]) * 60 + parseInt(pf[1])) - (parseInt(pi[0]) * 60 + parseInt(pi[1]));
}

// Formatta minuti in "1h 25m" / "45m"
export function fmtDurata(min) {
  if (min == null || isNaN(min)) return '—';
  min = Math.round(min);
  var h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}
