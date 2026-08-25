// Script classico (non un modulo ES): espone tutto su window.Schola.views.inglese.
// Sezione "Inglese": traduzione istantanea di testo digitato o di una foto
// (OCR + traduzione), usando API pubbliche gratuite. Interfaccia a due
// pannelli (sorgente/destinazione) con pulsante di scambio al centro, come
// un vero traduttore.
(function () {

const { store, icon, escapeHtml, showToast, confirmAction, openModal, closeModal, translateText, recognizeImageText } = window.Schola;

const LANGS = { it: 'Italiano', en: 'Inglese' };

let sourceLang = 'it';
let targetLang = 'en';
let sourceDraft = '';
let translated = '';
let translating = false;
let ocrProgress = null; // 0..1 mentre legge una foto, null altrimenti
let errorMsg = null;
let debounceTimer = null;
let activeStream = null; // MediaStream della fotocamera live, se aperta

function stopActiveStream() {
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }
}

async function runTranslation(container) {
  const text = sourceDraft.trim();
  if (!text) { translated = ''; errorMsg = null; renderOutput(container); return; }
  translating = true;
  errorMsg = null;
  renderOutput(container);
  try {
    translated = await translateText(text, sourceLang, targetLang);
    store.addTranslation({ sourceLang, targetLang, sourceText: text, translatedText: translated });
    renderHistory(container);
  } catch (err) {
    errorMsg = err.message || 'Traduzione non disponibile, riprova.';
    translated = '';
  } finally {
    translating = false;
    renderOutput(container);
  }
}

function scheduleTranslation(container) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runTranslation(container), 600);
}

function renderStatus(container) {
  const statusEl = container.querySelector('#translator-status');
  if (!statusEl) return;
  if (ocrProgress !== null) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `
      <div class="ocr-progress"><div class="ocr-progress-bar" style="width:${Math.round(ocrProgress * 100)}%"></div></div>
      <p class="text-secondary" style="margin:6px 0 0">Lettura del testo dalla foto… ${Math.round(ocrProgress * 100)}%</p>
    `;
  } else {
    statusEl.style.display = 'none';
    statusEl.innerHTML = '';
  }
}

function renderOutput(container) {
  const outputEl = container.querySelector('#translation-output');
  const copyBtn = container.querySelector('#copy-translation-btn');
  if (!outputEl) return;

  if (translating) {
    outputEl.className = 'translator-output is-empty';
    outputEl.textContent = 'Traduzione in corso…';
  } else if (errorMsg) {
    outputEl.className = 'translator-output is-error';
    outputEl.textContent = errorMsg;
  } else if (translated) {
    outputEl.className = 'translator-output';
    outputEl.textContent = translated;
  } else {
    outputEl.className = 'translator-output is-empty';
    outputEl.textContent = 'La traduzione apparirà qui mentre scrivi.';
  }

  if (copyBtn) copyBtn.disabled = !translated;
}

function historyCardHtml(item) {
  return `
    <div class="history-card glass" data-history-id="${item.id}">
      <button class="history-card-delete" data-delete-history="${item.id}" aria-label="Elimina">${icon('close')}</button>
      <span class="history-card-source">${escapeHtml(item.sourceText)}</span>
      <span class="history-card-target">${escapeHtml(item.translatedText)}</span>
    </div>
  `;
}

function renderHistory(container) {
  const historySection = container.querySelector('#history-section');
  if (!historySection) return;
  const { translations } = store.get();

  historySection.innerHTML = translations.length ? `
    <div class="flex items-center justify-between">
      <h2 class="task-group-title" style="margin:0">Cronologia</h2>
      <button class="icon-btn" id="clear-history-btn" aria-label="Svuota cronologia">${icon('trash')}</button>
    </div>
    <div class="history-scroll">${translations.map(historyCardHtml).join('')}</div>
  ` : '';

  container.querySelectorAll('[data-history-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-history]')) return;
      const item = translations.find((t) => t.id === card.dataset.historyId);
      if (!item) return;
      sourceLang = item.sourceLang;
      targetLang = item.targetLang;
      sourceDraft = item.sourceText;
      translated = item.translatedText;
      errorMsg = null;
      render(container);
    });
  });

  container.querySelectorAll('[data-delete-history]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.deleteTranslation(btn.dataset.deleteHistory);
      renderHistory(container);
    });
  });

  const clearBtn = container.querySelector('#clear-history-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    confirmAction({
      title: 'Svuotare la cronologia?',
      message: 'Le traduzioni salvate verranno eliminate.',
      confirmLabel: 'Svuota',
      onConfirm: () => {
        store.clearTranslations();
        showToast('Cronologia svuotata');
        renderHistory(container);
      },
    });
  });
}

async function handlePhoto(container, file) {
  ocrProgress = 0;
  errorMsg = null;
  renderStatus(container);
  try {
    const lang = sourceLang === 'it' ? 'ita' : 'eng';
    const text = await recognizeImageText(file, lang, (ratio) => {
      ocrProgress = ratio;
      renderStatus(container);
    });
    ocrProgress = null;
    renderStatus(container);
    if (!text) {
      errorMsg = 'Non sono riuscito a leggere del testo in questa foto.';
      renderOutput(container);
      return;
    }
    sourceDraft = text;
    const sourceInput = container.querySelector('#source-text-input');
    if (sourceInput) sourceInput.value = text;
    runTranslation(container);
  } catch (err) {
    ocrProgress = null;
    renderStatus(container);
    errorMsg = err.message || 'Lettura della foto non riuscita.';
    renderOutput(container);
  }
}

// Apre un mirino live con la vera API della fotocamera (getUserMedia),
// che a differenza dell'attributo "capture" su <input type=file> chiede
// davvero il permesso al sistema e non viene ignorata dal browser/PWA.
async function openCameraCapture(container) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('Fotocamera non supportata su questo browser: scegli una foto dalla libreria.');
    return;
  }

  openModal({
    title: 'Scatta una foto',
    bodyHtml: `
      <div class="camera-capture">
        <video id="camera-video" class="camera-video" autoplay playsinline muted></video>
        <p class="form-error" id="camera-error" style="display:none"></p>
        <button class="camera-shutter-btn" id="camera-shutter" aria-label="Scatta foto" disabled></button>
      </div>
    `,
    onMount: async (body) => {
      const video = body.querySelector('#camera-video');
      const shutterBtn = body.querySelector('#camera-shutter');
      const errorEl = body.querySelector('#camera-error');

      // Qualunque sia il modo in cui la scheda si chiude (X, sfondo, Esc),
      // appena il video sparisce dal DOM spegniamo la fotocamera: altrimenti
      // la spia della fotocamera resterebbe accesa anche a scheda chiusa.
      const modalRoot = document.getElementById('modal-root');
      const observer = new MutationObserver(() => {
        if (!document.getElementById('camera-video')) {
          stopActiveStream();
          observer.disconnect();
        }
      });
      observer.observe(modalRoot, { childList: true, subtree: true });

      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        video.srcObject = activeStream;
        shutterBtn.disabled = false;
      } catch (err) {
        video.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = err.name === 'NotAllowedError'
          ? 'Permesso alla fotocamera negato. Puoi comunque scegliere una foto dalla libreria.'
          : 'Impossibile accedere alla fotocamera su questo dispositivo.';
        return;
      }

      shutterBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          stopActiveStream();
          closeModal();
          if (blob) handlePhoto(container, blob);
        }, 'image/jpeg', 0.92);
      });
    },
  });
}

// Menu con le tre sorgenti possibili per la foto. "Libreria foto" e "File"
// aprono entrambe il selettore senza fotocamera forzata: e' il telefono a
// decidere quali app mostrare (di solito sia le foto che i file), il web non
// permette di distinguere le due scelte in modo piu' preciso di cosi'.
function openPhotoSourceModal(container) {
  openModal({
    title: 'Allega foto',
    bodyHtml: `
      <div class="flex-col gap-2">
        <button class="action-sheet-option" id="source-camera">
          <span class="action-sheet-icon">${icon('camera')}</span>
          <span class="action-sheet-label">Scatta una foto</span>
        </button>
        <button class="action-sheet-option" id="source-gallery">
          <span class="action-sheet-icon">${icon('image')}</span>
          <span class="action-sheet-label">Scegli dalla libreria foto</span>
        </button>
        <button class="action-sheet-option" id="source-file">
          <span class="action-sheet-icon">${icon('folder')}</span>
          <span class="action-sheet-label">Scegli un file</span>
        </button>
      </div>
    `,
    onMount: (body) => {
      body.querySelector('#source-camera').addEventListener('click', () => {
        closeModal();
        openCameraCapture(container);
      });
      body.querySelector('#source-gallery').addEventListener('click', () => {
        closeModal();
        container.querySelector('#photo-input-gallery').click();
      });
      body.querySelector('#source-file').addEventListener('click', () => {
        closeModal();
        container.querySelector('#photo-input-gallery').click();
      });
    },
  });
}

function render(container) {
  container.innerHTML = `
    <h1 class="section-title">Inglese</h1>
    <p class="section-subtitle">Scrivi o allega una foto: la traduzione è immediata.</p>

    <div id="translator-status" style="display:none"></div>

    <div class="translator-stack">
      <div class="translator-panel glass">
        <div class="translator-panel-head">
          <span class="lang-pill-sm">${LANGS[sourceLang]}</span>
          <button class="icon-btn" id="attach-photo-btn" aria-label="Allega foto">${icon('camera')}</button>
        </div>
        <textarea class="translator-textarea" id="source-text-input" rows="3" placeholder="Scrivi qui il testo da tradurre…" maxlength="2000">${escapeHtml(sourceDraft)}</textarea>
        <input type="file" accept="image/*" id="photo-input-gallery" hidden />
      </div>

      <button class="translator-swap-btn" id="swap-lang-btn" aria-label="Inverti lingue">${icon('swap')}</button>

      <div class="translator-panel glass">
        <div class="translator-panel-head">
          <span class="lang-pill-sm lang-pill-sm-target">${LANGS[targetLang]}</span>
          <button class="icon-btn" id="copy-translation-btn" aria-label="Copia traduzione">${icon('copy')}</button>
        </div>
        <div class="translator-output is-empty" id="translation-output">La traduzione apparirà qui mentre scrivi.</div>
      </div>
    </div>

    <div id="history-section"></div>
  `;

  renderStatus(container);
  renderOutput(container);
  renderHistory(container);

  const sourceInput = container.querySelector('#source-text-input');
  sourceInput.addEventListener('input', () => {
    sourceDraft = sourceInput.value;
    scheduleTranslation(container);
  });

  container.querySelector('#swap-lang-btn').addEventListener('click', () => {
    [sourceLang, targetLang] = [targetLang, sourceLang];
    translated = '';
    errorMsg = null;
    render(container);
  });

  container.querySelector('#copy-translation-btn').addEventListener('click', async () => {
    if (!translated) return;
    try { await navigator.clipboard.writeText(translated); showToast('Testo copiato'); }
    catch (e) { showToast('Impossibile copiare'); }
  });

  container.querySelector('#attach-photo-btn').addEventListener('click', () => openPhotoSourceModal(container));

  container.querySelector('#photo-input-gallery').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handlePhoto(container, file);
    e.target.value = '';
  });
}

window.Schola = window.Schola || {};
window.Schola.views = window.Schola.views || {};
window.Schola.views.inglese = { render };

})();
