// Script classico (non un modulo ES): espone tutto su window.Schola.views.storia.
// Sezione "Storia": cerca una persona, una citta' o un evento storico usando
// la stessa AI gia' usata per i temi di italiano e l'assistente di
// matematica (vedi js/api/ai-text.js), invece di Wikipedia. La ricerca e'
// mostrata come una rotta su una mappa antica: le linee tratteggiate "corrono"
// verso una X finche' non arriva la risposta, poi la X si accende e si puo'
// toccare per aprire la scheda con i risultati.
(function () {

const { store, icon, escapeHtml, showToast, confirmAction, openModal, searchHistoryWithAI } = window.Schola;

let query = '';
let mapState = 'idle'; // 'idle' | 'loading' | 'found' | 'error'
let statusText = 'Scrivi un nome e premi cerca per tracciare la rotta.';
let result = null; // { query, title, description, extract }

const COMPASS_SVG = `
  <svg viewBox="0 0 60 60" class="map-compass" aria-hidden="true">
    <circle cx="30" cy="30" r="26" />
    <path d="M30 6v10M30 44v10M6 30h10M44 30h10" />
    <path d="M30 12 34 30 30 48 26 30Z" />
  </svg>
`;

function mapRouteHtml() {
  return `
    <div class="map-route map-route-${mapState}" id="map-route">
      ${COMPASS_SVG}
      <svg viewBox="0 0 320 70" class="map-route-svg" preserveAspectRatio="none">
        <path class="map-route-path" d="M14,35 C 80,8 110,62 160,35 S 250,8 300,35" />
        <circle class="map-route-start" cx="14" cy="35" r="6"></circle>
        <g class="map-route-x-pos" transform="translate(300,35)">
          <g class="map-route-x-scale" id="map-route-x">
            <circle class="map-route-x-ring" r="15"></circle>
            <path class="map-route-x-mark" d="M-8,-8 9,9M9,-8 -8,9"></path>
          </g>
        </g>
      </svg>
      <p class="map-route-caption" id="map-route-caption">${escapeHtml(statusText)}</p>
    </div>
  `;
}

function setMapState(container, state, caption) {
  mapState = state;
  statusText = caption;
  const routeEl = container.querySelector('#map-route');
  if (!routeEl) return;
  routeEl.className = `map-route map-route-${mapState}`;
  container.querySelector('#map-route-caption').textContent = statusText;
}

function openResultDetail(r) {
  openModal({
    title: r.title,
    bodyHtml: `
      ${r.description ? `<p class="storia-description">${escapeHtml(r.description)}</p>` : ''}
      <p class="storia-extract">${escapeHtml(r.extract)}</p>
      <p class="storia-source">Generato con intelligenza artificiale: le informazioni possono contenere imprecisioni, verifica sempre quello che leggi.</p>
    `,
  });
}

function historyChipHtml(item) {
  return `<span class="chip" data-history-query="${escapeHtml(item.query)}">${escapeHtml(item.title || item.query)}</span>`;
}

async function runSearch(container, term) {
  result = null;
  setMapState(container, 'loading', 'Sto tracciando la rotta…');

  try {
    const found = await searchHistoryWithAI(term);
    result = { query: term, ...found };
    store.addStoriaSearch(result);
    setMapState(container, 'found', 'Trovato! Tocca la X per leggere.');
    renderHistory(container);
  } catch (err) {
    setMapState(container, 'error', err.message || 'Ricerca non riuscita, riprova.');
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
      query = term;
      container.querySelector('#storia-search-input').value = term;
      if (cached) {
        result = cached;
        setMapState(container, 'found', 'Trovato! Tocca la X per leggere.');
      } else {
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

    <div class="card glass map-search-card">
      <div class="flex gap-2">
        <input type="text" class="input map-search-input" id="storia-search-input" inputmode="search" enterkeyhint="search" placeholder="Es. Giulio Cesare, Venezia…" value="${escapeHtml(query)}" />
        <button class="icon-btn map-search-btn" id="storia-search-btn" aria-label="Cerca">${icon('search')}</button>
      </div>
      ${mapRouteHtml()}
    </div>

    ${storiaSearches.length ? `
      <h2 class="task-group-title" style="margin-top:24px">Ricerche recenti</h2>
      <div id="storia-history"></div>
      <button class="btn btn-glass btn-sm mt-2" id="clear-storia-history-btn">${icon('trash')} Svuota cronologia</button>
    ` : '<div id="storia-history"></div>'}
  `;

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

  container.querySelector('#map-route-x').addEventListener('click', () => {
    if (mapState === 'found' && result) openResultDetail(result);
  });

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
