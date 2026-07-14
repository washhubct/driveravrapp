# Last Mile Driver App

Web app mobile (PWA) per i ~30 driver di **Last Mile** (ex AVR Logistic): registrazione consegne per fascia oraria, ritorni, segnalazioni con foto, classifica mensile anonima con premi, dati personali.

- **Produzione:** https://appdriver.avrlogisticarl.com (GitHub Pages, custom domain)
- **Backend:** Firebase `avr-logistic-dashboard` (Firestore + Auth), **condiviso** con la dashboard [`avr-delivery-hub`](https://github.com/washhubct/avr-delivery-hub)

## Struttura

```
├── index.html            Entry point: solo markup + <script type="module">
├── manifest.webmanifest  PWA manifest (installabile da home screen)
├── sw.js                 Service worker: network-first, precache shell atomico
├── CNAME                 Custom domain GitHub Pages
├── eslint.config.mjs     Lint: prefer-const, no-var
├── assets/               Logo, favicon, icone PWA
├── css/app.css           Tutti gli stili
└── js/
    ├── main.js           Entry: binding eventi UI (helper on() con null-guard)
    ├── firebase.js       SDK modular v10 firestore-lite via CDN — unico punto
    │                     che conosce gli URL, gli altri moduli importano da qui
    ├── state.js          Stato condiviso S + resetSessionState()
    ├── utils.js          Date TZ Europe/Rome, validazioni, toast, escape (pure)
    ├── data.js           Query Firestore + helper filiali
    ├── auth.js           Login/reset/logout + bootstrap post-login
    ├── turno.js          Modal targa, cambio mezzo, auto-logout 01:00
    ├── nav.js            showTab: orchestrazione render per tab
    └── views/            Un modulo per tab:
        oggi.js nuova.js ritorno.js segnala.js classifica.js compensi.js profilo.js
```

Niente framework, niente build step: ES6 modules serviti così come sono.

## Sviluppo

```bash
npx http-server -p 8080     # test locale su http://localhost:8080
npx eslint js/ sw.js        # lint (config nel repo)
```

## Deploy

```bash
git push origin main        # GitHub Pages builda in 2-5 minuti
```

**Checklist prima di ogni deploy:**

1. Bump `CACHE_VERSION` in `sw.js` (es. `lastmile-v3` → `lastmile-v4`)
2. Bump `?v=` sull'entry `js/main.js` in `index.html`
3. Se hai aggiunto moduli o asset, aggiungili alla lista `SHELL` in `sw.js`

## Convenzioni

- `const` di default, `let` solo se riassegnata, mai `var`
- Date "oggi"/"mese corrente": sempre `oggiRoma()` / `meseCorrenteRoma()` (mai `toISOString()` diretto: è UTC e sbaglia giorno tra mezzanotte e le 2). Campi data dei record: `recordYMD()` / `dataRecord()`
- Lock anti doppio-submit: `let busy` locale al modulo, mai lock globali
- firestore-lite non ha coda offline: ogni write ha catch + toast con esito onesto
- Email sempre `.toLowerCase()` (le Firestore rules confrontano case-sensitive)
- Italiano per il dominio business, inglese per il tecnico

## Rapporto con avr-delivery-hub

Stesso progetto Firebase, stesse collection (`reportDriver`, `ritorni`, `segnalazioni`, `turniDriver`, `driverAnagrafica`, `leaderboard`), stesse rules (deployate da quel repo). **Ogni modifica allo schema condiviso va verificata su entrambe le app.** La classifica legge solo il doc aggregato `leaderboard/{YYYY-MM}` scritto da Cloud Function: mai query cross-driver dal client.
