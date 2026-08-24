// Cloudflare Worker "proxy" per Groq AI.
//
// Perche' serve: MySchool e' un sito statico senza backend. Una chiave API
// messa direttamente nel codice del sito e' visibile a chiunque (sia su
// GitHub, che viene scansionato automaticamente e fa revocare la chiave, sia
// nel sito pubblicato, dove basta "Ispeziona" per leggerla). Questo Worker
// gira sui server di Cloudflare, non nel browser: tiene la chiave Groq come
// "secret" lato server, mai visibile a nessuno, e fa lui le richieste a
// Groq per conto del sito.
//
// ────────────────────────────────────────────────────────────────────────
// COME PUBBLICARLO (una tantum, ~10 minuti, gratis, nessuna carta richiesta)
// ────────────────────────────────────────────────────────────────────────
// 1. Vai su https://dash.cloudflare.com e registrati (o accedi).
// 2. Nel menu a sinistra: "Workers e Pages" → "Crea" → "Crea Worker".
// 3. Dai un nome al Worker (es. "myschool-groq-proxy") → "Esegui il deploy".
// 4. Clicca "Modifica codice" e SOSTITUISCI tutto il contenuto con questo
//    file (cloudflare-worker/groq-proxy.js), poi "Esegui il deploy" di nuovo.
// 5. Vai su "Impostazioni" del Worker → "Variabili e Secret" → "Aggiungi":
//      - Nome: GROQ_API_KEY
//      - Valore: la tua chiave Groq (creane una nuova su console.groq.com,
//        la vecchia e' stata revocata perche' pubblicata su GitHub)
//      - Tipo: Secret (cripta il valore, non piu' leggibile da nessuno)
//    Salva.
// 6. Copia l'URL del Worker (in alto, tipo
//    https://myschool-groq-proxy.<tuo-nome>.workers.dev) e comunicalo a
//    Claude: verra' messo in js/config.js al posto della vecchia chiave.
//
// Questo file NON contiene nessun segreto: puo' stare tranquillamente su
// GitHub, anche in un repository pubblico.

const ALLOWED_MODEL = 'openai/gpt-oss-120b';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Metodo non consentito, usa POST.' }, 405);
    }
    if (!env.GROQ_API_KEY) {
      return jsonResponse({ error: 'GROQ_API_KEY non configurata nei secret del Worker.' }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: 'JSON non valido.' }, 400);
    }

    if (!Array.isArray(body.messages)) {
      return jsonResponse({ error: 'Campo "messages" mancante o non valido.' }, 400);
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: ALLOWED_MODEL,
        messages: body.messages,
        seed: body.seed,
      }),
    });

    const data = await groqRes.text();
    return new Response(data, {
      status: groqRes.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  },
};
