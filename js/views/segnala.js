// Tab "Segnala": segnalazioni problemi con foto opzionale.
import { auth, db, FieldValue } from '../firebase.js';
import { S } from '../state.js';
import { oggiRoma, escapeHtml, showToast, setBtn, errMsg } from '../utils.js';
import { populateFilialiSelect } from '../data.js';

export function previewFoto(input) {
  var file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Carica solo immagini'); input.value = ''; return }
  if (file.size > 512 * 1024) { showToast('Foto troppo grande (max 500KB)'); input.value = ''; return }
  var reader = new FileReader();
  reader.onload = function (e) {
    S.fotoBase64 = e.target.result;
    document.getElementById('fotoPreview').innerHTML = '<img src="' + S.fotoBase64 + '" alt="Foto"><span style="font-size:11px;color:var(--text3);margin-top:4px">Tocca per cambiare foto</span>';
  };
  reader.readAsDataURL(file);
}

export function initSegFiliali() {
  populateFilialiSelect('segFiliale');
}

export async function inviaSegnalazione() {
  if (!auth.currentUser) { showToast('Sessione scaduta. Ricarica la pagina.'); return }
  if (S.submitting) return;
  var tipo = document.getElementById('segTipo').value;
  var filiale = document.getElementById('segFiliale').value;
  var cliente = document.getElementById('segCliente').value.trim();
  var indirizzo = document.getElementById('segIndirizzo').value.trim();
  var descrizione = document.getElementById('segDescrizione').value.trim();

  if (!tipo) { showToast('Seleziona il tipo di problema'); return }
  if (!descrizione) { showToast('Descrivi il problema'); return }

  var oggi = oggiRoma();
  var dupSeg = S.segnalazioniList.some(function (s) {
    return s.data === oggi && s.tipo === tipo && (s.filiale || null) === (filiale || null) &&
      (s.cliente || '').toLowerCase().trim() === (cliente || '').toLowerCase().trim();
  });
  if (dupSeg) { showToast('Hai già inviato questa segnalazione oggi'); return }

  S.submitting = true;
  setBtn('btnInviaSeg', true, 'Invio...');

  try {
    var tipoLabels = {
      cliente_assente: 'Cliente assente',
      indirizzo_errato: 'Indirizzo errato',
      pacco_danneggiato: 'Pacco danneggiato',
      accesso_difficile: 'Accesso difficile',
      ritardo_filiale: 'Ritardo filiale',
      problema_furgone: 'Problema furgone',
      altro: 'Altro'
    };

    var fd = S.fl.find(function (f) { return String(f.codice) === filiale });

    var rec = {
      tipo: tipo,
      tipoLabel: tipoLabels[tipo] || tipo,
      filiale: filiale || null,
      filialeNome: fd && fd.nome ? fd.nome : null,
      cliente: cliente || null,
      indirizzo: indirizzo || null,
      descrizione: descrizione,
      foto: S.fotoBase64 || null,
      driver: (S.dp.cognome || '').toUpperCase(),
      driverNome: (S.dp.cognome || '') + ' ' + (S.dp.nome || ''),
      driverEmail: (auth.currentUser.email || '').toLowerCase(),
      targa: S.targaOggi,
      area: S.dp.citta || '??',
      stato: 'aperta',
      data: oggiRoma(),
      timestamp: FieldValue.serverTimestamp()
    };

    await db.collection('segnalazioni').add(rec);
    document.getElementById('formSegnala').style.display = 'none';
    document.getElementById('segSuccess').style.display = 'block';
    await loadSegnalazioni();
    showToast('Segnalazione inviata');
  } catch (e) {
    console.error('inviaSegnalazione error:', e);
    showToast('Errore: ' + errMsg(e));
  } finally {
    S.submitting = false;
    setBtn('btnInviaSeg', false, '📨 Invia segnalazione');
  }
}

export function resetSegnala() {
  document.getElementById('segTipo').value = '';
  document.getElementById('segFiliale').value = '';
  document.getElementById('segCliente').value = '';
  document.getElementById('segIndirizzo').value = '';
  document.getElementById('segDescrizione').value = '';
  document.getElementById('segFoto').value = '';
  S.fotoBase64 = null;
  document.getElementById('fotoPreview').innerHTML = '<span style="font-size:32px">📷</span><span style="font-size:13px;color:var(--text3)">Tocca per scattare o caricare foto</span>';
  document.getElementById('formSegnala').style.display = 'block';
  document.getElementById('segSuccess').style.display = 'none';
}

export async function loadSegnalazioni() {
  var el = document.getElementById('listaSegnalazioni');
  var em = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
  try {
    var snap = await db.collection('segnalazioni').where('driverEmail', '==', em).limit(100).get();
    S.segnalazioniList = snap.docs.map(function (doc) { var x = doc.data(); x.id = doc.id; return x });
    S.segnalazioniList.sort(function (a, b) {
      var d = (b.data || '').localeCompare(a.data || '');
      if (d) return d;
      var ta = a.timestamp && a.timestamp.toMillis ? a.timestamp.toMillis() : 0;
      var tb = b.timestamp && b.timestamp.toMillis ? b.timestamp.toMillis() : 0;
      return tb - ta;
    });
    if (!S.segnalazioniList.length) {
      el.innerHTML = '<div class="empty" style="padding:20px"><div class="empty-icon">✅</div><p>Nessuna segnalazione</p></div>';
      return;
    }
    var html = '';
    S.segnalazioniList.slice(0, 20).forEach(function (d) {
      var statoClass = d.stato === 'risolta' ? 'risolta' : 'aperta';
      var statoLabel = d.stato === 'risolta' ? 'Risolta' : 'In attesa';
      html += '<div class="seg-card">' +
        '<div class="seg-card-top">' +
        '<div class="seg-tipo">' + escapeHtml(d.tipoLabel || d.tipo) + '</div>' +
        '<span class="seg-stato ' + statoClass + '">' + statoLabel + '</span>' +
        '</div>' +
        '<div class="seg-desc">' + escapeHtml(d.descrizione) + '</div>' +
        '<div class="seg-meta">' + escapeHtml(d.filialeNome ? d.filialeNome + ' · ' : '') + escapeHtml(d.data) + '</div>' +
        (d.foto && /^data:image\//.test(d.foto) ? '<img src="' + d.foto + '" class="seg-foto-thumb">' : '') +
        '</div>';
    });
    el.innerHTML = html;
  } catch (e) {
    S.segnalazioniList = [];
    el.innerHTML = '<div class="empty" style="padding:20px"><p style="font-size:12px">Errore caricamento segnalazioni</p></div>';
    showToast('Errore caricamento segnalazioni');
  }
}
