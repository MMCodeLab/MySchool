// Ricerca informazioni su persone, citta' e luoghi via API pubblica di
// Wikipedia (nessuna chiave richiesta). Script classico: espone tutto su
// window.Schola.
(function () {

const SEARCH_URL = 'https://it.wikipedia.org/w/api.php';
const SUMMARY_URL = 'https://it.wikipedia.org/api/rest_v1/page/summary/';

/**
 * Cerca su Wikipedia in italiano il termine indicato e restituisce il
 * riassunto della voce piu' pertinente: titolo, estratto, immagine ed URL.
 */
async function searchHistoryTopic(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return null;

  const searchParams = new URLSearchParams({
    action: 'query', list: 'search', srsearch: trimmed, format: 'json', origin: '*', srlimit: '1',
  });
  const searchRes = await fetch(`${SEARCH_URL}?${searchParams.toString()}`);
  if (!searchRes.ok) throw new Error('Impossibile contattare Wikipedia.');
  const searchData = await searchRes.json();
  const hit = searchData?.query?.search?.[0];
  if (!hit) return null;

  const summaryRes = await fetch(SUMMARY_URL + encodeURIComponent(hit.title));
  if (!summaryRes.ok) throw new Error('Impossibile recuperare la voce trovata.');
  const summary = await summaryRes.json();

  return {
    title: summary.title,
    description: summary.description || null,
    extract: summary.extract || 'Nessuna descrizione disponibile.',
    imageUrl: summary.thumbnail?.source || summary.originalimage?.source || null,
    pageUrl: summary.content_urls?.desktop?.page || `https://it.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`,
  };
}

window.Schola = window.Schola || {};
Object.assign(window.Schola, { searchHistoryTopic });

})();
