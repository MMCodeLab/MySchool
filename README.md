# MySchool

<p align="center">
  <img src="icons/icon-512.png" width="160" alt="MySchool">
</p>

<h3 align="center">Il tuo compagno di studio.</h3>

<p align="center">
  Organizza lo studio, scrivi temi, esercitati in matematica, traduci l'inglese e scopri la storia: tutto in un'unica app.
</p>

---

## Cos'è

**MySchool** è una Progressive Web App (PWA) pensata per accompagnare lo studio quotidiano: un unico posto per organizzarsi, allenarsi in matematica, tradurre e migliorare l'inglese, ripassare storia e scrivere temi con l'aiuto di un assistente.

## Funzionalità principali

- **Studio**: panoramica e organizzazione delle attività di studio, con in cima l'**orario delle lezioni** — le materie ora per ora, aperto sul giorno di oggi e con un tocco su quello di domani (si compila dalle Impostazioni).
- **Italiano**: scrittura e correzione di temi, con assistente AI.
- **Matematica**: esercizi e formulario di riferimento.
- **Inglese**: traduzione ed esercizi di lingua.
- **Storia**: ricerca ed esplorazione di argomenti storici (via Wikipedia).
- Scansione testo tramite **OCR** per digitalizzare appunti o esercizi.
- **Impostazioni**: tema chiaro/scuro e gestione dati.
- Installabile come app, con funzionamento offline.

## Privacy e dati

- Nessuna registrazione, nessun account personale.
- I tuoi contenuti (note, esercizi, progressi) restano sul dispositivo, salvati in `localStorage`.
- Le funzioni di traduzione, ricerca storica e assistenza alla scrittura interrogano servizi esterni (Wikipedia, un motore di traduzione, un modello AI) solo per il testo che invii in quel momento: nessuna registrazione persistente lato server, nessun account richiesto.
- La chiave dell'API AI non è mai esposta nel client: le richieste passano da un proxy Cloudflare Worker dedicato.

## Tecnologie

- HTML5, CSS3, JavaScript
- `localStorage` per la persistenza dei dati
- Progressive Web App: manifest + service worker per l'installazione e l'uso offline
- Cloudflare Worker come proxy sicuro per le chiamate all'API AI (Groq)
- Wikipedia API per i contenuti di storia, motore di traduzione per l'inglese

## Come avviarla in locale

Puoi aprire `index.html` con doppio click per un utilizzo rapido. Per la PWA vera e propria (installazione, funzionamento offline via service worker) serve un server locale, anche minimo. È incluso `serve.py`, che usa solo Python:

```bash
python serve.py
```

Poi apri **http://localhost:5500**. Per fermarlo, `Ctrl+C`.

## Struttura del progetto

```
index.html                  punto di ingresso
manifest.webmanifest         manifest PWA (nome, icone, colori)
sw.js                         service worker (funzionamento offline)
serve.py                      server locale di sviluppo
css/                            design system: glassmorphism, temi, animazioni
js/
  app.js                      bootstrap dell'app
  state.js                    store dati + persistenza in localStorage
  router.js                    routing via hash
  config.js                    configurazione (endpoint proxy, ecc.)
  components.js                helper UI condivisi
  api/                          integrazioni: traduzione, Wikipedia, OCR, AI
  views/                        studio, italiano, matematica, inglese, storia, impostazioni
  formulario-data.js            dati del formulario di matematica
icons/                          icone PWA
cloudflare-worker/
  groq-proxy.js                proxy per le chiamate all'API AI (Groq), chiave lato server
```

---

Fa parte della famiglia di app **My**, insieme a MyVerse, MyMoney, MyGym e MySite.
