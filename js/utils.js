// Utility pure, senza stato né dipendenze.

// Finestra di inserimento dati: nessun report/ritorno prima di questa data.
export const DATA_MIN = '2026-04-01';

// Data di oggi YYYY-MM-DD in TZ Europe/Rome (toISOString è UTC: tra
// mezzanotte e le 2 slitterebbe al giorno precedente).
export function oggiRoma() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Mese corrente YYYY-MM in TZ Europe/Rome (indipendente dal TZ del device).
export function meseCorrenteRoma() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const y = parts.find(function (p) { return p.type === 'year' }).value;
  const m = parts.find(function (p) { return p.type === 'month' }).value;
  return y + '-' + m;
}

// Mese YYYY-MM di una Date (calendario locale del device).
export function meseYM(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

// Campo data di un record Firestore (Timestamp | Date | stringa) → Date, o
// null se assente/non parsabile. Protegge da doc corretti a mano in formati
// non ISO che manderebbero in RangeError i render.
export function dataRecord(r) {
  if (!r || !r.data) return null;
  const d = r.data instanceof Date ? r.data : (r.data.toDate ? r.data.toDate() : new Date(r.data));
  return isNaN(d) ? null : d;
}

// YYYY-MM-DD del campo data di un record. I report/ritorni sono salvati a
// mezzogiorno ora italiana, quindi la data UTC di toISOString coincide sempre
// con il giorno di calendario italiano.
export function recordYMD(r) {
  return r.data instanceof Date ? r.data.toISOString().slice(0, 10) : (r.data || '').substring(0, 10);
}

// Imposta value/max/min di un input date sulla finestra di inserimento valida.
export function initDateInput(id) {
  const inp = document.getElementById(id);
  const oggi = oggiRoma();
  inp.value = oggi;
  inp.max = oggi;
  inp.min = DATA_MIN;
}

// Valida una data di inserimento (YYYY-MM-DD). Ritorna {ok, msg?, date?}.
export function validaDataInserimento(dataStr) {
  if (!dataStr) return { ok: false, msg: 'Seleziona la data' };
  const date = new Date(dataStr + 'T12:00:00');
  const min = new Date(DATA_MIN + 'T00:00:00');
  const max = new Date();
  max.setHours(23, 59, 59);
  if (date < min) {
    const label = min.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    return { ok: false, msg: 'Non puoi inserire date prima del ' + label };
  }
  if (date > max) return { ok: false, msg: 'Non puoi inserire date future' };
  return { ok: true, date: date };
}

export function escapeHtml(t) {
  if (!t) return '';
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function showToast(m) {
  const e = document.createElement('div');
  e.className = 'toast';
  e.textContent = m;
  document.body.appendChild(e);
  setTimeout(function () { e.style.opacity = '0'; setTimeout(function () { e.remove() }, 300) }, 3000);
}

export function setBtn(id, busy, idleLabel) {
  const b = document.getElementById(id);
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
  const pi = inizio.split(':'), pf = fine.split(':');
  return (parseInt(pf[0]) * 60 + parseInt(pf[1])) - (parseInt(pi[0]) * 60 + parseInt(pi[1]));
}

// Formatta minuti in "1h 25m" / "45m"
export function fmtDurata(min) {
  if (min == null || isNaN(min)) return '—';
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}
