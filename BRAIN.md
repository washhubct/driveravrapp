# BRAIN.md — Last Mile Driver App

> Unica fonte di memoria del progetto. Solo fatti durevoli, una riga ciascuno. Aggiornare la riga che cambia, mai riscrivere tutto, mai log di sessione.

## 1. Guido e come lavora con Claude

- Guido Consoli, imprenditore siciliano; Claude è il CTO di fatto: propone architettura, segnala bug e codice fragile, non esegue soltanto.
- Comunicazione: italiano informale, diretto, niente preamboli né spiegazioni enciclopediche; per fix piccoli procedere subito, per cose complesse proporre prima l'architettura.
- Lavora spesso di notte, sessioni lunghe su Mac Mini M4 (utente macOS `macia`, tmux `driver`), spesso da remoto via claude.ai/code.
- Testare prima di dire "fatto"; commit atomici conventional (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- Chiedere conferma prima di operazioni distruttive (delete, drop, force push, rm -rf, rules/indexes Firestore, cambio CNAME).
- Push su `main` solo con ok esplicito di Guido, ogni volta: main = produzione per ~30 driver.
- Email canoniche: guido@last-mile.it (admin), risorse.umane@last-mile.it (HR, contatto mostrato ai driver nell'app); account personale guidoconsoli@live.it.
- Le altre aziende di Guido (Wash Hub Lungomare, FidelAI, domotica) hanno repo e sessioni propri: qui solo Last Mile.

## 2. Progetto

- Last Mile Driver App: web app mobile (PWA) per i ~27-30 driver di Last Mile S.r.l. (ex AVR Logistic, consegne a domicilio Decò / Gruppo Arena in Sicilia).
- Il driver la usa ogni giorno per: login, targa/turno, rapporto giornaliero consegne, ritorni, segnalazioni, classifica di provincia, profilo e patente.
- Produzione: https://appdriver.last-mile.it (GitHub Pages, repo `washhubct/driveravrapp`, branch `main`, CNAME nel repo); vecchio dominio appdriver.avrlogisticarl.com dismesso.
- Deploy = `git push origin main` (Pages compila in 2-5 min); nessun build step, nessuna dipendenza npm.
- Firebase project `avr-logistic-dashboard` condiviso con il gestionale `avr-delivery-hub` (dashboard.last-mile.it): stessi Firestore, Auth, Storage, Cloud Functions europe-west1.
- Firestore rules e Storage rules NON vivono qui: stanno in `~/Progetti/avr-delivery-hub/firestore.rules` e `storage.rules`; ogni cambio di schema o query va verificato su entrambe le app.
- Le Cloud Functions usate dall'app (requestPasswordReset, verificaPatente, push*) stanno in `avr-delivery-hub/functions/index.js`.
- Config Firebase nel client è la chiave web pubblica (non è un secret); i secret veri (VAPID_PRIVATE_KEY, ANTHROPIC_API_KEY…) sono in Secret Manager lato hub.
- Accesso backend da Claude: service account gcloud `claude-cli@avr-logistic-dashboard.iam.gserviceaccount.com` (`gcloud auth print-access-token`, REST Firestore con `updateMask`); le ADC utente sono scadute dal 28/09/2026.
- Test locale: `npx http-server -p 8080` dalla root.

## 3. Architettura e file chiave (branch `main`, quello live)

- `index.html` — TUTTA l'app in un file (~1350 righe): markup, CSS inline e JS inline; Firebase compat SDK 10.12.2 (app, auth, firestore, storage) via CDN gstatic.
- `index.html:5` — script di normalizzazione host: se l'host ha il punto finale (`appdriver.last-mile.it.`) fa redirect, altrimenti il CORS delle Functions fallisce.
- `index.html` sezione auth — `doLogin/doReset/doLogout`, `logAccessoDriver` (scrive `driverAccessLog`), `init` carica `driverAnagrafica` per email e blocca se `attivo===false` o profilo assente.
- `index.html` sezione turno — modal targa `confermaTarga` scrive `turniDriver`; `scheduleAutoLogout` forza signOut+reload alla prossima 01:00.
- `index.html` sezione report — `salvaReport/loadReports/eliminaReport` su `reportDriver` (orario inizio/fine giro obbligatorio, filtrato per email+mese).
- `index.html` sezione ritorni/segnalazioni — `salvaRitorno`, `inviaSegnalazione` (foto su Storage) su `ritorni` e `segnalazioni`.
- `index.html` sezione classifica — `loadLeaderboard` legge il solo doc `leaderboard/{YYYY-MM}_{PROV}`; `getMyLbHash` = sha256(email) primi 16 hex per riconoscere la propria riga; `renderPremiBanner`, popup intro `maybeShowLbIntro`.
- `index.html` sezione push — `initPush/attivaPush` con `VAPID_PUBLIC_KEY` hardcoded, iscrizione salvata in `pushSubscriptions`; invito a ogni ingresso + banner in Oggi finché non attive.
- `index.html` sezione patente — `scegliFotoPatente/caricaFotoPatente` su Storage `patenti/{uid}/{fronte|retro}.jpg`, `verificaPatenteFoto` chiama la CF `verificaPatente`; `PATENTE_VERIFICA_DAL='2026-10-06'`; blocco app se patente scaduta/mancante, alert a 30 gg.
- `index.html` sezione profilo — `salvaProfilo` aggiorna solo codiceFiscale/telefono/dataNascita/indirizzo (le rules ammettono solo quei campi).
- `index.html` utils — `oggiRoma()`, `meseCorrenteRoma()` (Intl con TZ Europe/Rome), `escapeHtml`, `showToast`, `setBtn`, `errMsg`.
- `sw.js` — service worker minimo SOLO per Web Push (push + notificationclick); nessuna cache, app network-first.
- `manifest.webmanifest` — PWA "Last Mile Driver", standalone, colore #0f1d3d; icone in `assets/icons/`.
- `CNAME` — `appdriver.last-mile.it`.
- Branch `refactor/fase1-moduli-pwa` (fermo al 27/07/2026, NON live, 19 commit indietro rispetto a main) — split in moduli ES6 `js/*.js`, `js/views/*`, `css/app.css`, `js/timbratura.js`, `js/push.js`, `js/offline.js`, ESLint; riferimento per la Fase 1, da riallineare prima di qualsiasi riuso.
- Collection Firestore toccate dall'app: `driverAnagrafica`, `filiali`, `reportDriver`, `ritorni`, `segnalazioni`, `turniDriver`, `pushSubscriptions`, `driverAccessLog`, `leaderboard` (sola lettura).
- Storage usato: `patenti/{uid}/*.jpg` e foto segnalazioni.
- `.claude/` è in .gitignore (settings locali); `README.md` è un placeholder.

## 4. Decisioni prese e perché

- Policy "niente soldi nell'app" (14/07/2026): mai importi di compensi né multe/trattenute (rischio contenzioso sindacale); solo conteggi operativi. Gli unici € visibili sono i premi della classifica, voluti da Guido.
- Classifica per provincia dal 2026-11 (CT, ME, PA, SR; Enna esclusa): doc aggregato `leaderboard/{mese}_{PROV}` scritto da CF, anonimato via hash email + nickname deterministico; mai query cross-driver dal client, mai allargare le rules in lettura.
- Regole premi (lato CF, l'app li mostra solo): montepremi fisso CT 200 / ME 70 / PA 60 / SR 40 €, 50/30/20 con ≥5 driver, 60/40 con 3-4, nulla sotto 3; tetto 1.000 €/anno per driver; senza requisito giorni minimi.
- Patente verificata dall'AI (dal 06/10/2026): numero e scadenza li scrive SOLO la CF `verificaPatente` dalle foto fronte/retro; mai dati autodichiarati dal driver.
- Timbratura (14-15/07/2026, oggi solo sul branch refactor, non in main): gate IN obbligatorio prima dell'app; IN e OUT SOLO da tag NFC/QR fisico in filiale (`?timbra=PROV&t=TOKEN` o `&nfc=UID`), mai bottoni in app nemmeno con geofence; i driver NON leggono `timbrature`, l'app tiene solo un flag locale.
- Web Push (ott 2026): Web Push standard con VAPID v2, nessun FCM; su iPhone funziona solo con app aggiunta alla Home.
- Firestore rules: mai `.lower()` o trasformazioni su `resource.data` se la collection ha query `where()` (incidente 20/04/2026, 30 driver bloccati); email sempre `.toLowerCase()` lato client prima di ogni write e query.
- Date "oggi"/"mese": sempre in TZ Europe/Rome via Intl, mai `toISOString()` locale (bug di cambio giorno dopo le 22-23 UTC).
- Auto-logout alle 01:00: impedisce turni fantasma e targa stantia il giorno dopo.
- Roadmap approvata il 13/07/2026: Fase 1 moduli ES6 + PWA senza build step, Fase 2 Capacitor (Apple Developer come azienda, distribuzione unlisted; Android via APK diretto). In pratica main continua a ricevere feature nel monolite: il refactor non è stato merge-ato.
- Brand: la legal entity è Last Mile S.r.l.; in UI e testi solo "Last Mile", mai AVR; nomi tecnici (progetto Firebase, repo, SA) restano quelli vecchi.
- Nessun framework né build: scelta di controllo e semplicità, compatibile con GitHub Pages.

## 5. Regole non negoziabili

- Niente push su `main` senza ok esplicito di Guido; niente force push.
- Niente importi di compensi o trattenute nell'app, mai; qualunque richiesta in tal senso va riportata a Guido citando la policy.
- Mai query cross-driver dal client; il driver vede SOLO i propri dati (enforced dalle rules).
- Mai bottoni o scorciatoie di timbratura in app.
- Non modificare schema condiviso, rules, ruolo `driver`, CNAME o config Firebase senza conferma: impatta anche il gestionale.
- Ogni write Firestore ha try/catch e toast con esito onesto; mai toast di successo fuori dal try.
- Lock anti doppio-submit locale per flusso (`submitting`), mai lock globale.
- Nuovo codice: `const` di default, no `var` (il monolite ne è pieno, non peggiorare); escape sempre l'HTML dai dati (`escapeHtml`).
- Mai committare secrets; la chiave web Firebase è pubblica per design, la VAPID privata non deve mai entrare qui.
- Prima di toccare una collection, leggere le rules in avr-delivery-hub e testare l'accesso driver.

## 6. Stato attuale e prossimi passi

- App live su main con: classifica per provincia (dal 02/11/2026), Web Push, verifica patente AI, blocco driver disattivati, rebrand Last Mile.
- Adozione push bassa (02/11/2026: 10 iscritti su 27 attivi): invito a ogni ingresso già in app, monitoraggio dalla colonna Push del gestionale.
- Fase 1 (moduli ES6) ferma: il branch refactor va riallineato a main o rifatto dal monolite attuale prima di riprendere; decidere con Guido se e quando.
- Timbratura NFC/QR: design pronto e rules deployate lato hub, ma l'app in main non la implementa; si attiva quando arrivano i tag fisici.
- Fase 2 Capacitor: non iniziata; sul Mac Mini mancano Xcode e Android Studio.
- Aperto: il CLAUDE.md del repo descriveva la struttura a moduli del branch refactor, non main; ora rimanda a questo file.
