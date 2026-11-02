# Graph Report - driveravrapp  (2026-11-02)

## Corpus Check
- Corpus is ~6,676 words - fits in a single context window. You may not need a graph.

## Summary
- 193 nodes · 423 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.82)
- Token cost: 185,033 input · 0 output

## Community Hubs (Navigation)
- Oggi, Nuova e Segnalazioni UI
- Progetto, deploy e infrastruttura
- Foto patente e verifica AI
- Classifica per provincia
- Report, ritorni e write Firestore
- Login, init e regole accesso
- Turno, targa e auto-logout
- Web Push
- Gate patente
- Alert profilo incompleto

## God Nodes (most connected - your core abstractions)
1. `verificaPatenteFoto()` - 21 edges
2. `init()` - 19 edges
3. `loadLeaderboard()` - 19 edges
4. `confermaTarga()` - 18 edges
5. `dp (driver profile global)` - 18 edges
6. `showToast()` - 17 edges
7. `salvaReport()` - 16 edges
8. `salvaRitorno()` - 16 edges
9. `inviaSegnalazione()` - 15 edges
10. `rOggi()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Email sempre toLowerCase lato client` --rationale_for--> `loadReports()`  [INFERRED]
  BRAIN.md → index.html
- `Date in TZ Europe/Rome` --rationale_for--> `oggiRoma()`  [EXTRACTED]
  BRAIN.md → index.html
- `attivaPush()` --shares_data_with--> `Collection pushSubscriptions`  [EXTRACTED]
  index.html → BRAIN.md
- `attivaPush()` --references--> `sw.js (service worker Web Push)`  [INFERRED]
  index.html → BRAIN.md
- `salvaProfilo()` --shares_data_with--> `Collection driverAnagrafica`  [INFERRED]
  index.html → BRAIN.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Login and shift-start (turno) flow** — index_dologin, index_onauthstatechanged, index_logaccessodriver, index_init, index_avviaingresso, index_confermatarga, index_scheduleautologout, index_checkprofiloalert, index_maybeshowlbintro, index_maybeshowpushinvito, index_col_turnidriver [EXTRACTED 1.00]
- **Licence (patente) photo verification flow** — index_statopatente, index_patentebloccata, index_mostrabloccopatente, index_sceglifotopatente, index_ridimensionafoto, index_caricafotopatente, index_ripristinafotopatente, index_verificapatentefoto, index_aggiornabannerpatente, index_storage_patenti, index_cf_verificapatente, index_patente_verifica_dal [EXTRACTED 1.00]
- **Web Push subscription and invite flow** — index_initpush, index_statopush, index_maybeshowpushinvito, index_apriinvitopush, index_mostrainvitopush, index_attivapush, index_aggiornabannerpush, index_vapid_public_key, index_col_pushsubscriptions, index_swregister [EXTRACTED 1.00]
- **Flusso classifica per provincia** — brain_classifica_per_provincia, brain_regole_premi, index_leaderboard, index_loadleaderboard, index_getmylbhash, index_renderpremibanner, index_maybeshowlbintro [EXTRACTED 1.00]
- **Flusso verifica patente AI** — brain_verifica_patente_ai, index_sceglifotopatente, index_caricafotopatente, index_verificapatentefoto, brain_cf_verificapatente, brain_storage_patenti [EXTRACTED 1.00]
- **Flusso Web Push VAPID** — brain_web_push_vapid, index_initpush, index_attivapush, index_pushsubscriptions, sw_js, brain_cf_push [EXTRACTED 1.00]

## Communities (11 total, 1 thin omitted)

### Community 0 - "Oggi, Nuova e Segnalazioni UI"
Cohesion: 0.14
Nodes (29): Firestore collection filiali, Firestore collection segnalazioni, dp (driver profile global), escapeHtml(), fl (global cache of filiali), fotoBase64 (segnalazione photo), getFilialeNome(), initDateLimits() (+21 more)

### Community 1 - "Progetto, deploy e infrastruttura"
Cohesion: 0.12
Nodes (19): avr-delivery-hub (gestionale), Branch refactor/fase1-moduli-pwa, Cloud Functions push*, Cloud Function requestPasswordReset, Firebase project avr-logistic-dashboard, Deploy GitHub Pages (git push origin main), HR email risorse.umane@last-mile.it, Last Mile Driver App (+11 more)

### Community 2 - "Foto patente e verifica AI"
Cohesion: 0.17
Nodes (22): Cloud Function verificaPatente, Storage patenti/{uid}/{fronte|retro}.jpg, aggiornaBtnPatente(), caricaFotoPatente(), Cloud Function requestPasswordReset (HTTP europe-west1), Cloud Function verificaPatente (HTTP europe-west1), Collection driverAnagrafica, Host trailing-dot redirect (inline) (+14 more)

### Community 3 - "Classifica per provincia"
Cohesion: 0.13
Nodes (15): Guido Consoli, cn(), Firestore collection leaderboard ({mese}_{prov}), DRIVER_ANIMALS nickname list, getMyLbHash(), getNickname(), LB_MOTIVI (non-premiabile reasons), LB_PROVINCE ['CT','ME','PA','SR'] (+7 more)

### Community 4 - "Report, ritorni e write Firestore"
Cohesion: 0.21
Nodes (19): Firestore collection reportDriver, Firestore collection ritorni, eliminaReport(), eliminaRitorno(), errMsg(), loadReports(), loadRitorni(), rComp() (+11 more)

### Community 5 - "Login, init e regole accesso"
Cohesion: 0.11
Nodes (14): Firestore/Storage rules in avr-delivery-hub, caricaDatiProfilo(), cc (costoConsegna), Firestore collection driverAccessLog, Firestore collection driverAnagrafica, doLogin(), Collection driverAccessLog, firebase.initializeApp (project avr-logistic-dashboard) (+6 more)

### Community 6 - "Turno, targa e auto-logout"
Cohesion: 0.19
Nodes (16): autoLogoutTimer, chiudiLbIntro(), chiudiTargaModal(), Firestore collection turniDriver, confermaTarga(), doLogout(), maybeShowLbIntro(), maybeShowPushInvito() (+8 more)

### Community 7 - "Web Push"
Cohesion: 0.19
Nodes (13): aggiornaBannerPush(), apriInvitoPush(), attivaPush(), chiudiInvitoPush(), Firestore collection pushSubscriptions, initPush(), IS_IOS, IS_STANDALONE (+5 more)

### Community 8 - "Gate patente"
Cohesion: 0.23
Nodes (12): aggiornaBannerPatente(), avviaIngresso(), chiudiPatenteView(), fmtDataIt(), mostraBloccoPatente(), patBloccante, PATENTE_PREAVVISO_GG = 30, PATENTE_VERIFICA_DAL = '2026-10-06' (+4 more)

### Community 9 - "Alert profilo incompleto"
Cohesion: 0.40
Nodes (4): checkProfiloAlert(), chiudiAlertProfilo(), profiloCompleto(), Profile completion alert (#profileAlert)

## Knowledge Gaps
- **26 isolated node(s):** `firebase.initializeApp (project avr-logistic-dashboard)`, `autoLogoutTimer`, `DRIVER_ANIMALS nickname list`, `myLbHash`, `LB_PROVINCE ['CT','ME','PA','SR']` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 38 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dp (driver profile global)` connect `Oggi, Nuova e Segnalazioni UI` to `Foto patente e verifica AI`, `Classifica per provincia`, `Report, ritorni e write Firestore`, `Login, init e regole accesso`, `Turno, targa e auto-logout`, `Web Push`, `Gate patente`, `Alert profilo incompleto`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `loadLeaderboard()` (e.g. with `Anonymous per-province leaderboard` and `maybeShowLbIntro()`) actually correct?**
  _`loadLeaderboard()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `firebase.initializeApp (project avr-logistic-dashboard)`, `autoLogoutTimer`, `DRIVER_ANIMALS nickname list` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Oggi, Nuova e Segnalazioni UI` be split into smaller, more focused modules?**
  _Cohesion score 0.1425287356321839 - nodes in this community are weakly interconnected._
- **Why does `verificaPatenteFoto()` connect `Foto patente e verifica AI` to `Gate patente`, `Oggi, Nuova e Segnalazioni UI`, `Report, ritorni e write Firestore`, `Login, init e regole accesso`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `confermaTarga()` (e.g. with `Auto-logout alle 01:00` and `Shift start (turno) flow`) actually correct?**
  _`confermaTarga()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `Progetto, deploy e infrastruttura` be split into smaller, more focused modules?**
  _Cohesion score 0.11594202898550725 - nodes in this community are weakly interconnected._