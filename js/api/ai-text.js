// Generazione testo per il "tema" di italiano, l'assistente di matematica e
// la ricerca di storia. Script classico: espone tutto su window.Schola.
//
// Motore principale: Groq, chiamato attraverso un Worker Cloudflare "proxy"
// (vedi cloudflare-worker/groq-proxy.js) che tiene la chiave API nascosta
// lato server — non e' mai presente nel codice del sito, quindi ne' GitHub
// ne' un visitatore che ispeziona la pagina possono vederla. L'URL del
// Worker e' impostato in js/config.js (quello NON e' un segreto).
// Riserva: Pollinations AI (https://pollinations.ai), gratuita e senza
// chiave, usata se il Worker non e' configurato o non risponde.
(function () {

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';

const PROXY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1200;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// I modelli gratuiti, anche quando istruiti a non farlo, a volte rispondono
// con markdown (**grassetto**) o LaTeX (\[ x^2 \], \frac{a}{b}...). La chat e
// i temi mostrano testo semplice, quindi qui viene "ripulita" la formattazione
// in notazione leggibile prima di mostrarla.
function cleanFormatting(text) {
  return text
    .replace(/\\\[|\\\]|\\\(|\\\)|\$\$?/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\pi/g, 'π')
    .replace(/\\[Dd]elta/g, 'Δ')
    .replace(/\\le\b/g, '≤')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function requestChat(url, body, headers) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Errore ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Risposta AI vuota o non valida.');
  return content.trim();
}

function requestProxy(messages, seed) {
  return requestChat(window.Schola.AI_PROXY_URL, { messages, seed });
}

function requestPollinations(messages, seed) {
  return requestChat(POLLINATIONS_URL, { model: 'openai', messages, seed, private: true });
}

/**
 * Invia una conversazione (stile OpenAI chat) e restituisce il testo di
 * risposta. `messages` e' un array di { role: 'system'|'user'|'assistant', content }.
 * `onStatus(message)` viene chiamato prima di ogni nuovo tentativo o cambio
 * di servizio, cosi' l'interfaccia puo' mostrare cosa sta succedendo.
 */
async function chatComplete(messages, { seed, onStatus } = {}) {
  const fixedSeed = seed ?? Math.floor(Math.random() * 1e9);
  const hasProxy = !!window.Schola.AI_PROXY_URL;
  let lastError = null;

  if (hasProxy) {
    for (let attempt = 1; attempt <= PROXY_ATTEMPTS; attempt++) {
      try {
        return await requestProxy(messages, fixedSeed);
      } catch (err) {
        lastError = err;
        if (attempt < PROXY_ATTEMPTS) {
          if (onStatus) onStatus(`Nuovo tentativo (${attempt + 1}/${PROXY_ATTEMPTS})…`);
          await wait(RETRY_DELAY_MS);
        }
      }
    }
    if (onStatus) onStatus('Provo un servizio di riserva…');
  }

  try {
    return await requestPollinations(messages, fixedSeed);
  } catch (err) {
    lastError = lastError || err;
  }

  throw new Error('I servizi AI gratuiti non sono raggiungibili in questo momento. Riprova tra poco.');
}

/**
 * Genera un tema scolastico di italiano a partire dal solo argomento.
 */
async function generateEssay(topic, options) {
  const messages = [
    {
      role: 'system',
      content: 'Sei un insegnante di lettere italiano che scrive temi scolastici di esempio per studenti delle scuole superiori. Scrivi in italiano corretto e scorrevole, con introduzione, svolgimento in piu\' paragrafi e conclusione. Non usare MAI markdown (niente **asterischi**, #titoli o elenchi puntati): solo testo semplice in prosa, suddiviso in paragrafi separati da una riga vuota. Lunghezza indicativa: 400-600 parole.',
    },
    { role: 'user', content: `Scrivi un tema svolto sul seguente argomento: "${topic}"` },
  ];
  const raw = await chatComplete(messages, options);
  return cleanFormatting(raw);
}

/**
 * Messaggio di sistema per l'assistente di matematica: aiuta a risolvere
 * problemi passo per passo invece di dare solo il risultato finale.
 */
const MATH_SYSTEM_PROMPT = 'Sei un tutor di matematica paziente per studenti delle scuole medie e superiori. Rispondi sempre in italiano. Quando ti viene posto un problema, spiega il ragionamento passo per passo (puoi numerare i passaggi con "1.", "2." ecc.) prima di dare il risultato finale, usando un linguaggio semplice e chiaro. Non usare MAI markdown o LaTeX: niente **asterischi** per il grassetto, niente \\[ \\] o \\( \\), niente \\frac{}{}. Scrivi le formule in testo semplice: x^2 per la potenza, sqrt(x) per la radice, a/b per le frazioni, pi e Delta per le lettere greche. Se la domanda non e\' di matematica, rispondi comunque con gentilezza ma riporta la conversazione sull\'aiuto con lo studio della matematica.';

async function askMathTutor(history, options) {
  const messages = [{ role: 'system', content: MATH_SYSTEM_PROMPT }, ...history];
  const raw = await chatComplete(messages, options);
  return cleanFormatting(raw);
}

/**
 * Messaggio di sistema per la ricerca di storia: chiede all'AI di rispondere
 * con un JSON strutturato (titolo, sottotitolo, testo) invece di un unico
 * blocco di testo, cosi' la scheda risultato puo' mostrarli separatamente
 * come faceva prima con Wikipedia.
 */
const HISTORY_SYSTEM_PROMPT = 'Sei un assistente di storia e geografia per studenti delle scuole superiori. Ti viene dato il nome di una persona storica, una citta\', un luogo o un evento: rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza blocchi di codice markdown, con esattamente questa struttura: {"title": "nome completo o ufficiale", "description": "una riga brevissima, come un sottotitolo (professione, periodo o cosa rappresenta)", "extract": "3-5 frasi in italiano corretto e scorrevole con le informazioni principali, in prosa, senza elenchi puntati ne\' markdown"}. Se non riconosci l\'argomento con certezza, rispondi comunque con le informazioni piu\' plausibili che conosci, senza inventare un JSON vuoto.';

function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('Nessun JSON trovato nella risposta.');
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Cerca informazioni storiche/geografiche tramite l'AI (stesso motore usato
 * per temi e matematica), al posto di Wikipedia.
 */
async function searchHistoryWithAI(query, options) {
  const messages = [
    { role: 'system', content: HISTORY_SYSTEM_PROMPT },
    { role: 'user', content: query },
  ];
  const raw = await chatComplete(messages, options);

  let data;
  try {
    data = extractJson(raw);
  } catch (e) {
    // Il modello non ha rispettato il formato: mostriamo comunque il testo
    // grezzo come descrizione, invece di far fallire tutta la ricerca.
    data = { title: query, description: null, extract: raw };
  }

  const title = cleanFormatting(String(data.title || query).trim());
  const description = data.description ? cleanFormatting(String(data.description).trim()) : null;
  const extract = cleanFormatting(String(data.extract || '').trim()) || 'Nessuna informazione disponibile per questo argomento.';

  return { title, description, extract };
}

window.Schola = window.Schola || {};
Object.assign(window.Schola, { generateEssay, askMathTutor, searchHistoryWithAI });

})();
