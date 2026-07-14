// Stato condiviso dell'app. Unico punto di mutazione: i moduli leggono/scrivono S.*
// I lock anti doppio-submit NON stanno qui: sono per-flusso, locali a ogni modulo.
export const S = {
  dp: null,              // profilo driver (doc driverAnagrafica + id)
  reports: [],           // reportDriver del driver loggato
  ritorniList: [],
  segnalazioniList: [],
  segnalazioniLoaded: false,
  fl: [],                // filiali
  cc: 3.50,              // costoConsegna del driver
  targaOggi: '',
  turnoConfermato: false,
  accessoLoggato: false, // log accesso già scritto per questa sessione di login
  fotoBase64: null,      // foto segnalazione in corso
  myLbHash: null,        // hash email per match classifica
  lbCache: null,         // {mese, ts, data} — cache TTL del doc leaderboard
  autoLogoutTimer: null,
  turnoDocId: null,      // doc turniDriver del turno aperto (per la chiusura)
  turnoOraInizio: null,  // HH:MM di inizio turno (per durataTurnoMin)
  danniList: [],
  danniLoaded: false,
  timbratureOggi: []
};

// Azzera lo stato legato al driver loggato. Chiamata al signed-out di
// onAuthStateChanged: su telefono condiviso il driver successivo non deve
// ereditare hash classifica, stato turno o liste del precedente.
export function resetSessionState() {
  S.dp = null;
  S.reports = [];
  S.ritorniList = [];
  S.segnalazioniList = [];
  S.segnalazioniLoaded = false;
  S.targaOggi = '';
  S.turnoConfermato = false;
  S.accessoLoggato = false;
  S.fotoBase64 = null;
  S.myLbHash = null;
  S.lbCache = null;
  S.turnoDocId = null;
  S.turnoOraInizio = null;
  S.danniList = [];
  S.danniLoaded = false;
  S.timbratureOggi = [];
}
