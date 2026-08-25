// Script classico (non un modulo ES): espone tutto su window.Schola.views.italiano.
// Sezione "Italiano": genera un tema svolto a partire dal solo argomento,
// usando un'AI di testo gratuita (Pollinations, vedi js/api/ai-text.js).
(function () {

const { store, icon, escapeHtml, showToast, confirmAction, generateEssay } = window.Schola;

let loading = false;
let loadingStatus = '';
let lastError = null;
let lastTopic = '';
let topicDraft = '';

function paragraphsHtml(text) {
  return text.split(/\n+/).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
}

function essayCardHtml(essay) {
  const date = new Date(essay.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `
    <div class="card essay-card glass" data-essay-id="${essay.id}">
      <div class="day-card-head">
        <span class="day-card-title">${escapeHtml(essay.topic)}</span>
        <button class="icon-btn danger" data-delete-essay="${essay.id}" aria-label="Elimina">${icon('trash')}</button>
      </div>
      <span class="day-card-meta">${date} · ${essay.wordCount} parole</span>
    </div>
  `;
}

async function handleGenerate(container, topic) {
  loading = true;
  loadingStatus = 'Generazione in corso…';
  lastError = null;
  lastTopic = topic;
  render(container);

  try {
    const text = await generateEssay(topic, {
      onStatus: (msg) => {
        loadingStatus = msg;
        render(container);
      },
    });
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    store.addEssay({ topic, text, wordCount });
    topicDraft = '';
    showToast('Tema generato');
  } catch (err) {
    lastError = err.message || 'Errore durante la generazione del tema.';
  } finally {
    loading = false;
    render(container);
  }
}

function openEssayDetail(essay) {
  const { openModal, closeModal } = window.Schola;
  openModal({
    title: essay.topic,
    bodyHtml: `
      <div class="essay-text">${paragraphsHtml(essay.text)}</div>
      <div class="flex gap-3 mt-4">
        <button class="btn btn-glass w-full" id="copy-essay-btn">${icon('copy')} Copia testo</button>
      </div>
    `,
    onMount: (body) => {
      body.querySelector('#copy-essay-btn').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(essay.text);
          showToast('Testo copiato negli appunti');
        } catch (e) {
          showToast('Impossibile copiare automaticamente');
        }
      });
    },
  });
}

function render(container) {
  const { essays } = store.get();

  container.innerHTML = `
    <h1 class="section-title">Italiano</h1>
    <p class="section-subtitle">Scrivi solo l'argomento: l'AI genera un tema svolto completo.</p>

    <div class="card glass essay-form">
      <div class="field" style="margin-bottom:12px">
        <label for="essay-topic-input">Argomento del tema</label>
        <textarea class="textarea" id="essay-topic-input" rows="2" placeholder="Es. L'importanza della lettura nella crescita personale" maxlength="300" ${loading ? 'disabled' : ''}>${escapeHtml(topicDraft)}</textarea>
      </div>
      <button class="btn btn-primary btn-block" id="generate-essay-btn" ${loading ? 'disabled' : ''}>
        ${loading ? loadingStatus : `${icon('sparkles')} Genera tema`}
      </button>
      ${lastError ? `
        <p class="form-error">${escapeHtml(lastError)}</p>
        <button class="btn btn-glass btn-sm mt-2" id="retry-essay-btn">${icon('refresh')} Riprova</button>
      ` : ''}
    </div>

    <h2 class="task-group-title" style="margin-top:24px">Temi generati</h2>
    <div id="essays-list">
      ${essays.length ? essays.map(essayCardHtml).join('') : `
        <div class="empty-state empty-state-sm glass">
          <div class="empty-emoji">✍️</div>
          <div class="empty-title">Nessun tema ancora</div>
          <div class="empty-text">I temi che generi appariranno qui, così puoi rileggerli quando vuoi.</div>
        </div>
      `}
    </div>
  `;

  const input = container.querySelector('#essay-topic-input');
  input.addEventListener('input', () => { topicDraft = input.value; });
  const genBtn = container.querySelector('#generate-essay-btn');
  genBtn.addEventListener('click', () => {
    const topic = input.value.trim();
    if (!topic) { input.focus(); return; }
    handleGenerate(container, topic);
  });

  const retryBtn = container.querySelector('#retry-essay-btn');
  if (retryBtn) retryBtn.addEventListener('click', () => handleGenerate(container, lastTopic));

  container.querySelectorAll('[data-essay-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-delete-essay]')) return;
      const essay = essays.find((x) => x.id === card.dataset.essayId);
      if (essay) openEssayDetail(essay);
    });
  });

  container.querySelectorAll('[data-delete-essay]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmAction({
        title: 'Eliminare il tema?',
        message: 'Questa azione non può essere annullata.',
        confirmLabel: 'Elimina',
        onConfirm: () => {
          store.deleteEssay(btn.dataset.deleteEssay);
          showToast('Tema eliminato');
          render(container);
        },
      });
    });
  });
}

window.Schola = window.Schola || {};
window.Schola.views = window.Schola.views || {};
window.Schola.views.italiano = { render };

})();
