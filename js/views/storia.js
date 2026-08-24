// Script classico (non un modulo ES): espone tutto su window.Schola.views.storia.
// Sezione "Storia": cerca una persona, una città o un luogo e mostra le
// informazioni da Wikipedia (API pubblica, nessuna chiave richiesta).
(function () {

const { store, icon, escapeHtml, showToast, confirmAction, openModal, searchHistoryTopic } = window.Schola;

let query = '';
let loading = false;
let errorMsg = null;
let result = null; // { query, title, description, extract, imageUrl, pageUrl }

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

// La scheda mostra solo un'anteprima: il tap apre una card a tutto schermo,
// scorrevole, con tutte le informazioni — invece di portare l'utente fuori
// dall'app direttamente su Wikipedia.
function resultCardHtml(r) {
  return `
    <div class="card glass storia-result-card" data-open-storia-detail>
      ${r.imageUrl ? `<img src="${escapeHtml(r.imageUrl)}" alt="" class="storia-image" />` : ''}
      <span class="day-card-title">${escapeHtml(r.title)}</span>
      ${r.description ? `<span class="day-card-meta storia-description">${escapeHtml(r.description)}</span>` : ''}
      <p class="storia-extract">${escapeHtml(truncate(r.extract, 200))}</p>
      <span class="storia-readmore">Leggi tutto ${icon('chevronDown')}</span>
    </div>
  `;
}

function openStoriaDetail(r) {
  openModal({
    title: r.title,
    bodyHtml: `
      ${r.imageUrl ? `<img src="${escapeHtml(r.imageUrl)}" alt="" class="storia-image" />` : ''}
      ${r.description ? `<p class="storia-description">${escapeHtml(r.description)}</p>` : ''}
      <p class="storia-extract">${escapeHtml(r.extract)}</p>
      <p class="storia-source">Fonte: Wikipedia — <a href="${escapeHtml(r.pageUrl)}" target="_blank" rel="noopener">apri la voce originale ↗</a></p>
    `,
  });
}

function historyChipHtml(item) {
  return `<span class="chip" data-history-query="${escapeHtml(item.query)}">${escapeHtml(item.title || item.query)}</span>`;
}

function renderResult(container) {
  const resultEl = container.querySelector('#storia-result');
  if (!resultEl) return;
  if (loading) {
    resultEl.innerHTML = `<p class="text-secondary">Ricerca in corso…</p>`;
  } else if (errorMsg) {
    resultEl.innerHTML = `<p class="form-error">${escapeHtml(errorMsg)}</p>`;
  } else if (result) {
    resultEl.innerHTML = resultCardHtml(result);
    resultEl.querySelector('[data-open-storia-detail]').addEventListener('click', () => openStoriaDetail(result));
  } else {
    resultEl.innerHTML = `
      <div class="empty-state glass">
        <div class="empty-emoji">🏛️</div>
        <div class="empty-title">Cerca un nome</div>
        <div class="empty-text">Prova con una persona storica, una città o un evento: es. "Napoleone Bonaparte" o "Roma".</div>
      </div>
    `;
  }
}

async function runSearch(container, term) {
  loading = true;
  errorMsg = null;
  renderResult(container);
  try {
    const found = await searchHistoryTopic(term);
    if (!found) {
      errorMsg = `Nessun risultato per "${term}".`;
      result = null;
    } else {
      result = { query: term, ...found };
      store.addStoriaSearch(result);
    }
  } catch (err) {
    errorMsg = err.message || 'Ricerca non riuscita, riprova.';
  } finally {
    loading = false;
    renderResult(container);
    renderHistory(container);
  }
}

function renderHistory(container) {
  const historyEl = container.querySelector('#storia-history');
  if (!historyEl) return;
  const { storiaSearches } = store.get();
  historyEl.innerHTML = storiaSearches.length
    ? `<div class="chip-row">${storiaSearches.map(historyChipHtml).join('')}</div>`
    : '';
  historyEl.querySelectorAll('[data-history-query]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const term = chip.dataset.historyQuery;
      const { storiaSearches: current } = store.get();
      const cached = current.find((s) => s.query.toLowerCase() === term.toLowerCase());
      if (cached) {
        result = cached;
        errorMsg = null;
        query = term;
        container.querySelector('#storia-search-input').value = term;
        renderResult(container);
      } else {
        query = term;
        container.querySelector('#storia-search-input').value = term;
        runSearch(container, term);
      }
    });
  });
}

function render(container) {
  const { storiaSearches } = store.get();

  container.innerHTML = `
    <h1 class="section-title">Storia</h1>
    <p class="section-subtitle">Cerca una persona, una città o un evento storico.</p>

    <div class="flex gap-2">
      <input type="text" class="input" id="storia-search-input" placeholder="Es. Giulio Cesare, Venezia…" value="${escapeHtml(query)}" />
      <button class="icon-btn" id="storia-search-btn" aria-label="Cerca">${icon('search')}</button>
    </div>

    <div id="storia-result" style="margin-top:16px"></div>

    ${storiaSearches.length ? `
      <h2 class="task-group-title" style="margin-top:24px">Ricerche recenti</h2>
      <div id="storia-history"></div>
      <button class="btn btn-glass btn-sm mt-2" id="clear-storia-history-btn">${icon('trash')} Svuota cronologia</button>
    ` : '<div id="storia-history"></div>'}
  `;

  renderResult(container);
  renderHistory(container);

  const input = container.querySelector('#storia-search-input');
  const doSearch = () => {
    const term = input.value.trim();
    if (!term) { input.focus(); return; }
    query = term;
    runSearch(container, term);
  };

  container.querySelector('#storia-search-btn').addEventListener('click', doSearch);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  const clearBtn = container.querySelector('#clear-storia-history-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    confirmAction({
      title: 'Svuotare la cronologia?',
      message: 'Le ricerche salvate verranno eliminate.',
      confirmLabel: 'Svuota',
      onConfirm: () => {
        store.clearStoriaSearches();
        showToast('Cronologia svuotata');
        render(container);
      },
    });
  });
}

window.Schola = window.Schola || {};
window.Schola.views = window.Schola.views || {};
window.Schola.views.storia = { render };

})();
