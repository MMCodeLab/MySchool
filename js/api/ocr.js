// Riconoscimento testo da foto (OCR) tramite Tesseract.js, eseguito
// interamente nel browser via WebAssembly — nessuna chiave richiesta, nessun
// upload dell'immagine a server esterni (solo i dati del modello linguistico
// vengono scaricati da CDN al primo utilizzo). Script classico: espone tutto
// su window.Schola.
(function () {

const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

let loadPromise = null;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossibile caricare il motore di riconoscimento testo.'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

/**
 * Riconosce il testo presente in un File/Blob immagine. `lang` accetta i
 * codici Tesseract (es. 'eng', 'ita', o 'eng+ita' per riconoscere entrambe).
 * `onProgress(ratio)` riceve un valore 0..1 per mostrare l'avanzamento.
 */
async function recognizeImageText(file, lang, onProgress) {
  await loadTesseract();
  const result = await window.Tesseract.recognize(file, lang, {
    logger: (m) => {
      if (onProgress && m.status === 'recognizing text') onProgress(m.progress);
    },
  });
  return (result?.data?.text || '').trim();
}

window.Schola = window.Schola || {};
Object.assign(window.Schola, { recognizeImageText });

})();
