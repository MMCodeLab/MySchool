// Script classico (non un modulo ES): espone tutto su window.Schola.views.matematica.
// Sezione "Matematica": formulario di consultazione rapida + assistente AI
// per farsi aiutare a risolvere i problemi passo per passo.
(function () {

const { store, icon, escapeHtml, showToast, confirmAction, askMathTutor, FORMULARIO } = window.Schola;

let activeTab = 'formulario'; // 'formulario' | 'assistente'
let activeCategory = FORMULARIO[0].key;
let formulaQuery = '';
let chatLoading = false;
let chatTypingStatus = 'Sto pensando…';
let chatError = null;
let chatDraft = '';

// ---------- Formulario ----------

function formulaListHtml() {
  const category = FORMULARIO.find((c) => c.key === activeCategory) || FORMULARIO[0];
  const q = formulaQuery.trim().toLowerCase();
  const items = category.formulas.filter((f) =>
    !q || f.name.toLowerCase().includes(q) || f.expr.toLowerCase().includes(q)
  );

  if (!items.length) {
    return `
      <div class="empty-state glass">
        <div class="empty-emoji">🔍</div>
        <div class="empty-title">Nessun risultato</div>
        <div class="empty-text">Prova a cercare un altro termine.</div>
      </div>
    `;
  }

  return items.map((f) => `
    <div class="card formula-card glass" style="border-left:3px solid ${category.color}">
      <span class="formula-name">${escapeHtml(f.name)}</span>
      <span class="formula-expr">${escapeHtml(f.expr)}</span>
    </div>
  `).join('');
}

function renderFormulario(container) {
  const chips = FORMULARIO.map((c) => `
    <span class="chip ${activeCategory === c.key ? 'selected' : ''}" data-category="${c.key}" ${activeCategory === c.key ? `style="background:${c.color};border-color:transparent"` : ''}>${escapeHtml(c.label)}</span>
  `).join('');

  container.innerHTML = `
    <div class="chip-row">${chips}</div>
    <div class="field">
      <input type="text" class="input" id="formula-search-input" placeholder="Cerca una formula…" value="${escapeHtml(formulaQuery)}" />
    </div>
    <div id="formula-list">${formulaListHtml()}</div>
  `;

  container.querySelectorAll('[data-category]').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeCategory = chip.dataset.category;
      formulaQuery = '';
      renderFormulario(container);
    });
  });

  const searchInput = container.querySelector('#formula-search-input');
  searchInput.addEventListener('input', () => {
    formulaQuery = searchInput.value;
    container.querySelector('#formula-list').innerHTML = formulaListHtml();
  });
}

// ---------- Assistente AI ----------

function chatBubbleHtml(msg) {
  const isUser = msg.role === 'user';
  return `
    <div class="chat-bubble-row ${isUser ? 'chat-user' : 'chat-assistant'}">
      ${!isUser ? `<span class="chat-avatar">${icon('bot')}</span>` : ''}
      <div class="chat-bubble">${escapeHtml(msg.content)}</div>
    </div>
  `;
}

function scrollChatToBottom(container) {
  const list = container.querySelector('#chat-messages');
  if (list) list.scrollTop = list.scrollHeight;
}

async function askAndRender(container) {
  chatLoading = true;
  chatTypingStatus = 'Sto pensando…';
  chatError = null;
  renderAssistente(container);

  try {
    const history = store.getMathChat().map((m) => ({ role: m.role, content: m.content }));
    const reply = await askMathTutor(history, {
      onStatus: (msg) => {
        chatTypingStatus = msg;
        renderAssistente(container);
      },
    });
    store.addMathMessage('assistant', reply);
  } catch (err) {
    chatError = err.message || 'Errore, riprova tra poco.';
  } finally {
    chatLoading = false;
    renderAssistente(container);
  }
}

function handleSendMessage(container, text) {
  store.addMathMessage('user', text);
  chatDraft = '';
  askAndRender(container);
}

function renderAssistente(container) {
  const messages = store.getMathChat();

  container.innerHTML = `
    <div class="chat-panel">
      <div class="chat-messages" id="chat-messages">
        ${messages.length ? messages.map(chatBubbleHtml).join('') : `
          <div class="empty-state glass">
            <div class="empty-emoji">🧮</div>
            <div class="empty-title">Chiedi pure!</div>
            <div class="empty-text">Scrivi un problema o un esercizio di matematica: ti aiuto a risolverlo passo per passo.</div>
          </div>
        `}
        ${chatLoading ? `<div class="chat-bubble-row chat-assistant"><span class="chat-avatar">${icon('bot')}</span><div class="chat-bubble chat-typing">${escapeHtml(chatTypingStatus)}</div></div>` : ''}
      </div>
      ${chatError ? `
        <p class="form-error">${escapeHtml(chatError)}</p>
        <button class="btn btn-glass btn-sm mt-2" id="retry-chat-btn">${icon('refresh')} Riprova</button>
      ` : ''}
      <div class="chat-input-row">
        <textarea class="textarea chat-input" id="chat-input" rows="1" placeholder="Es. Risolvi 2x + 5 = 13" ${chatLoading ? 'disabled' : ''}>${escapeHtml(chatDraft)}</textarea>
        <button class="icon-btn chat-send-btn" id="chat-send-btn" aria-label="Invia" ${chatLoading ? 'disabled' : ''}>${icon('send')}</button>
      </div>
      ${messages.length ? `<button class="btn btn-glass btn-sm mt-2" id="clear-chat-btn">${icon('trash')} Svuota conversazione</button>` : ''}
    </div>
  `;

  scrollChatToBottom(container);

  const input = container.querySelector('#chat-input');
  input.addEventListener('input', () => { chatDraft = input.value; });

  const send = () => {
    const text = input.value.trim();
    if (!text || chatLoading) return;
    handleSendMessage(container, text);
  };

  container.querySelector('#chat-send-btn').addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  const retryBtn = container.querySelector('#retry-chat-btn');
  if (retryBtn) retryBtn.addEventListener('click', () => askAndRender(container));

  const clearBtn = container.querySelector('#clear-chat-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      confirmAction({
        title: 'Svuotare la conversazione?',
        message: 'La cronologia della chat verrà eliminata.',
        confirmLabel: 'Svuota',
        onConfirm: () => {
          store.clearMathChat();
          showToast('Conversazione svuotata');
          renderAssistente(container);
        },
      });
    });
  }
}

// ---------- Vista principale ----------

function render(container) {
  container.innerHTML = `
    <h1 class="section-title">Matematica</h1>
    <p class="section-subtitle">Formule sempre a portata di mano e un assistente per i problemi.</p>
    <div class="segmented" id="math-tabs" data-active="${activeTab === 'formulario' ? 0 : 1}">
      <span class="segmented-thumb"></span>
      <span class="segmented-opt ${activeTab === 'formulario' ? 'active' : ''}" data-tab="formulario">${icon('book')} Formulario</span>
      <span class="segmented-opt ${activeTab === 'assistente' ? 'active' : ''}" data-tab="assistente">${icon('bot')} Assistente AI</span>
    </div>
    <div id="math-tab-content"></div>
  `;

  const content = container.querySelector('#math-tab-content');
  if (activeTab === 'formulario') renderFormulario(content);
  else renderAssistente(content);

  container.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      render(container);
    });
  });
}

window.Schola = window.Schola || {};
window.Schola.views = window.Schola.views || {};
window.Schola.views.matematica = { render };

})();
