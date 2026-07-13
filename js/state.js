// Stato condiviso dell'app. Unico punto di mutazione: i moduli leggono/scrivono S.*
export const S = {
  dp: null,              // profilo driver (doc driverAnagrafica + id)
  reports: [],           // reportDriver del driver loggato
  ritorniList: [],
  segnalazioniList: [],
  fl: [],                // filiali
  cc: 3.50,              // costoConsegna del driver
  targaOggi: '',
  submitting: false,     // lock anti doppio-submit condiviso
  turnoConfermato: false,
  loggingAccesso: false,
  fotoBase64: null,      // foto segnalazione in corso
  myLbHash: null,        // hash email per match classifica
  autoLogoutTimer: null
};
