// Script classico (non un modulo ES): espone tutto su window.Schola.views.inglese.
// Sezione "Inglese": traduzione istantanea di testo digitato o di una foto
// (OCR + traduzione), usando API pubbliche gratuite.
(function () {

const { store, icon, escapeHtml, showToast, confirmAction, translateText, recognizeImageText } = window.Schola;

const LANGS = { it: 'Italiano', en: 'Inglese' };

let sourceLang = 'it';
let targetLang = 'en';
let sourceDraft = '';
let translated = '';
let translating = false;
let ocrProgress = null; // 0..1 while scanning a photo, null altrimenti
let errorMsg = null;
let debounceTimer = null;

function langPickerHtml() {
  return `
    <div class="lang-bar">
      <span class="lang-pill">${LANGS[sourceLang]}</span>
      <button class="icon-btn" id="swap-lang-btn" aria-label="Inverti lingue">${icon('swap')}</button>
      <span class="lang-pill">${LANGS[targetLang]}</span>
    </div>
  `;
}

async function runTranslation(container) {
  const text = sourceDraft.trim();
  if (!text) { translated = ''; renderResult(container); return; }
  translating = true;
  errorMsg = null;
  renderResult(container);
  try {
    translated = await translateText(text, sourceLang, targetLang);
    store.addTranslation({ sourceLang, targetLang, sourceText: text, translatedText: translated });
  } catch (err) {
    errorMsg = err.message || 'Traduzione non disponibile, riprova.';
    translated = '';
  } finally {
    translating = false;
    renderResult(container);
  }
}

function scheduleTranslation(container) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runTranslation(container), 600);
}

function historyItemHtml(item) {
  return `
    <div class="card translation-history-card glass" data-history-id="${item.id}">
      <div class="translation-history-text">
        <span class="translation-history-source">${escapeHtml(item.sourceText)}</span>
        <span class="translation-history-target">${escapeHtml(item.translatedText)}</span>
      </div>
      <button class="icon-btn danger" data-delete-history="${item.id}" aria-label="Elimina">${icon('trash')}</button>
    </div>
  `;
}

function renderResult(container) {
  const resultEl = container.querySelector('#translation-result');
  const btnEl = container.querySelector('#translate-now-btn');
  if (!resultEl) return;

  if (ocrProgress !== null) {
    resultEl.innerHTML = `<div class="ocr-progress"><div class="ocr-progress-bar" style="width:${Math.round(ocrProgress * 100)}%"></div></div><p class="text-secondary">Lettura del testo dalla foto… ${Math.round(ocrProgress * 100)}%</p>`;
  } else if (translating) {
    resultEl.innerHTML = `<p class="text-secondary">Traduzione in corso…</p>`;
  } else if (errorMsg) {
    resultEl.innerHTML = `<p class="form-error">${escapeHtml(errorMsg)}</p>`;
  } else if (translated) {
    resultEl.innerHTML = `
      <p class="translation-output">${escapeHtml(translated)}</p>
      <button class="btn btn-glass btn-sm" id="copy-translation-btn">${icon('copy')} Copia</button>
    `;
    const copyBtn = resultEl.querySelector('#copy-translation-btn');
    if (copyBtn) copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(translated); showToast('Testo copiato'); }
      catch (e) { showToast('Impossibile copiare'); }
    });
  } else {
    resultEl.innerHTML = `<p class="text-secondary">La traduzione apparirà qui mentre scrivi.</p>`;
  }
}

async function handlePhoto(container, file) {
  ocrProgress = 0;
  errorMsg = null;
  renderResult(container);
  try {
    const lang = sourceLang === 'it' ? 'ita' : 'eng';
    const text = await recognizeImageText(file, lang, (ratio) => {
      ocrProgress = ratio;
      renderResult(container);
    });
    ocrProgress = null;
    if (!text) {
      errorMsg = 'Non sono riuscito a leggere del testo in questa foto.';
      renderResult(container);
      return;
    }
    sourceDraft = text;
    const sourceInput = container.querySelector('#source-text-input');
    if (sourceInput) sourceInput.value = text;
    runTranslation(container);
  } catch (err) {
    ocrProgress = null;
    errorMsg = err.message || 'Lettura della foto non riuscita.';
    renderResult(container);
  }
}

function render(container) {
  const { translations } = store.get();

  container.innerHTML = `
    <h1 class="section-title">Inglese</h1>
    <p class="section-subtitle">Scrivi o allega una foto: la traduzione è immediata.</p>

    <div class="card glass translator-card">
      ${langPickerHtml()}
      <div class="field" style="margin:12px 0 8px">
        <textarea class="textarea" id="source-text-input" rows="3" placeholder="Scrivi qui il testo da tradurre…" maxlength="2000">${escapeHtml(sourceDraft)}</textarea>
      </div>
      <div class="flex gap-2">
        <label class="btn btn-glass" for="photo-input">${icon('camera')} Allega foto</label>
        <input type="file" accept="image/*" capture="environment" id="photo-input" hidden />
        <button class="btn btn-primary w-full" id="translate-now-btn">${icon('sparkles')} Traduci</button>
      </div>
      <div id="translation-result" class="translation-result"></div>
    </div>

    <h2 class="task-group-title" style="margin-top:24px">Cronologia</h2>
    <div id="history-list">
      ${translations.length ? translations.map(historyItemHtml).join('') : `<p class="text-secondary">Le traduzioni recenti appariranno qui.</p>`}
    </div>
    ${translations.length ? `<button class="btn btn-glass btn-sm mt-2" id="clear-history-btn">${icon('trash')} Svuota cronologia</button>` : ''}
  `;

  renderResult(container);

  const sourceInput = container.querySelector('#source-text-input');
  sourceInput.addEventListener('input', () => {
    sourceDraft = sourceInput.value;
    scheduleTranslation(container);
  });

  container.querySelector('#swap-lang-btn').addEventListener('click', () => {
    [sourceLang, targetLang] = [targetLang, sourceLang];
    translated = '';
    render(container);
  });

  container.querySelector('#translate-now-btn').addEventListener('click', () => {
    clearTimeout(debounceTimer);
    runTranslation(container);
  });

  container.querySelector('#photo-input').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) handlePhoto(container, file);
    e.target.value = '';
  });

  container.querySelectorAll('[data-history-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-history]')) return;
      const item = translations.find((t) => t.id === card.dataset.historyId);
      if (!item) return;
      sourceLang = item.sourceLang;
      targetLang = item.targetLang;
      sourceDraft = item.sourceText;
      translated = item.translatedText;
      render(container);
    });
  });

  container.querySelectorAll('[data-delete-history]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      store.deleteTranslation(btn.dataset.deleteHistory);
      render(container);
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
        render(container);
      },
    });
  });
}

window.Schola = window.Schola || {};
window.Schola.views = window.Schola.views || {};
window.Schola.views.inglese = { render };

})();
