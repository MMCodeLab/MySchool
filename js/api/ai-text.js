// Generazione testo per il "tema" di italiano e per l'assistente di
// matematica. Script classico: espone tutto su window.Schola.
//
// Motore principale: Groq (https://console.groq.com), con la chiave gratuita
// impostata in js/config.js — veloce e affidabile, livello gratuito generoso.
// Riserva: Pollinations AI (https://pollinations.ai), gratuita e senza
// chiave, usata solo se Groq non risponde (es. chiave non configurata,
// esaurita o servizio momentaneamente giu').
(function () {

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';

const GROQ_ATTEMPTS = 2;
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
  return cleanFormatting(content.trim());
}

function requestGroq(messages, seed) {
  const apiKey = window.Schola.GROQ_API_KEY;
  return requestChat(
    GROQ_URL,
    { model: GROQ_MODEL, messages, seed },
    { Authorization: `Bearer ${apiKey}` }
  );
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
  const hasGroqKey = !!window.Schola.GROQ_API_KEY;
  let lastError = null;

  if (hasGroqKey) {
    for (let attempt = 1; attempt <= GROQ_ATTEMPTS; attempt++) {
      try {
        return await requestGroq(messages, fixedSeed);
      } catch (err) {
        lastError = err;
        if (err.status === 401) break; // chiave non valida: inutile riprovare
        if (attempt < GROQ_ATTEMPTS) {
          if (onStatus) onStatus(`Nuovo tentativo (${attempt + 1}/${GROQ_ATTEMPTS})…`);
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

  if (lastError?.status === 401) {
    throw new Error('La chiave AI configurata non è valida: controllala in js/config.js.');
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
  return chatComplete(messages, options);
}

/**
 * Messaggio di sistema per l'assistente di matematica: aiuta a risolvere
 * problemi passo per passo invece di dare solo il risultato finale.
 */
const MATH_SYSTEM_PROMPT = 'Sei un tutor di matematica paziente per studenti delle scuole medie e superiori. Rispondi sempre in italiano. Quando ti viene posto un problema, spiega il ragionamento passo per passo (puoi numerare i passaggi con "1.", "2." ecc.) prima di dare il risultato finale, usando un linguaggio semplice e chiaro. Non usare MAI markdown o LaTeX: niente **asterischi** per il grassetto, niente \\[ \\] o \\( \\), niente \\frac{}{}. Scrivi le formule in testo semplice: x^2 per la potenza, sqrt(x) per la radice, a/b per le frazioni, pi e Delta per le lettere greche. Se la domanda non e\' di matematica, rispondi comunque con gentilezza ma riporta la conversazione sull\'aiuto con lo studio della matematica.';

async function askMathTutor(history, options) {
  const messages = [{ role: 'system', content: MATH_SYSTEM_PROMPT }, ...history];
  return chatComplete(messages, options);
}

window.Schola = window.Schola || {};
Object.assign(window.Schola, { generateEssay, askMathTutor });

})();
