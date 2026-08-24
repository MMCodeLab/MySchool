// URL del Worker Cloudflare che fa da "proxy" verso Groq AI (vedi
// cloudflare-worker/groq-proxy.js per il codice del Worker e le istruzioni
// di pubblicazione). Usato da js/api/ai-text.js per i temi di Italiano e
// l'assistente di Matematica.
//
// A differenza di una chiave API, questo URL NON e' un segreto: puo' stare
// tranquillamente nel codice pubblico su GitHub. La chiave Groq vera resta
// nascosta lato server, dentro al Worker.
//
// Finche' il Worker non e' pubblicato, lascia questo valore vuoto ('') o
// null: la app userà comunque Pollinations AI come riserva gratuita.
window.Schola = window.Schola || {};
window.Schola.AI_PROXY_URL = 'https://myschool-groq-proxy.minnitijunior.workers.dev/';
