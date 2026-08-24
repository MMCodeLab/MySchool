// Traduzione istantanea via MyMemory Translation API — gratuita, senza chiave.
// Script classico: espone tutto su window.Schola.
(function () {

const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';

/**
 * Traduce `text` da `sourceLang` a `targetLang` (codici ISO tipo 'it', 'en').
 * Il servizio limita ~500 caratteri a richiesta: testi piu' lunghi vengono
 * spezzati in frasi e tradotti in sequenza, poi riuniti.
 */
async function translateText(text, sourceLang, targetLang) {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  const chunks = splitIntoChunks(trimmed, 480);
  const results = [];
  for (const chunk of chunks) {
    const url = `${TRANSLATE_URL}?q=${encodeURIComponent(chunk)}&langpair=${sourceLang}|${targetLang}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Servizio di traduzione non raggiungibile.');
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (!translated) throw new Error('Traduzione non disponibile per questo testo.');
    results.push(translated);
  }
  return results.join(' ');
}

function splitIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = s.length > maxLen ? s.slice(0, maxLen) : s;
    } else {
      current = (current + ' ' + s).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

window.Schola = window.Schola || {};
Object.assign(window.Schola, { translateText });

})();
