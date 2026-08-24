// Script classico (non un modulo ES): espone tutto su window.Schola.views.studio.
// Sezione "Organizza lo studio": materie e compiti/scadenze.
(function () {

const { store, icon, escapeHtml, openModal, closeModal, showToast, confirmAction } = window.Schola;

let activeFilter = null; // id materia, o null = tutte
let showDone = false;

// Formatta una data in YYYY-MM-DD usando i componenti locali (non UTC): usare
// toISOString() qui sposterebbe la data di un giorno per i fusi orari a est
// di Greenwich, facendo apparire le attività di "oggi" come "questa settimana".
function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayISO() {
  return toLocalISODate(new Date());
}

function dueLabel(dueDate) {
  if (!dueDate) return null;
  const today = todayISO();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toLocalISODate(tomorrow);

  if (dueDate < today) return { text: 'In ritardo', tone: 'overdue' };
  if (dueDate === today) return { text: 'Oggi', tone: 'today' };
  if (dueDate === tomorrowISO) return { text: 'Domani', tone: 'soon' };

  const d = new Date(dueDate + 'T00:00:00');
  const formatted = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  return { text: formatted, tone: 'later' };
}

function bucketOf(task) {
  if (!task.dueDate) return 4; // senza scadenza
  const today = todayISO();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toLocalISODate(tomorrow);
  const inAWeek = new Date();
  inAWeek.setDate(inAWeek.getDate() + 7);
  const inAWeekISO = toLocalISODate(inAWeek);

  if (task.dueDate < today) return 0; // in ritardo
  if (task.dueDate === today) return 1; // oggi
  if (task.dueDate === tomorrowISO) return 2; // domani
  if (task.dueDate <= inAWeekISO) return 3; // questa settimana
  return 4; // senza scadenza / piu' avanti — trattato come "piu' avanti" qui sotto
}

const BUCKET_LABELS = ['In ritardo', 'Oggi', 'Domani', 'Questa settimana', 'Più avanti'];

function taskRowHtml(task) {
  const subject = task.subjectId ? store.getSubject(task.subjectId) : null;
  const due = dueLabel(task.dueDate);
  return `
    <div class="card task-row glass ${task.done ? 'task-done' : ''}" data-task-id="${task.id}">
      <button class="task-check ${task.done ? 'checked' : ''}" data-toggle-task="${task.id}" aria-label="Segna come completato">
        ${task.done ? icon('check') : ''}
      </button>
      <div class="task-info">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <div class="task-meta">
          ${subject ? `<span class="badge" style="background:${subject.color}">${escapeHtml(subject.name)}</span>` : ''}
          ${due ? `<span class="due-tag due-${due.tone}">${escapeHtml(due.text)}</span>` : ''}
        </div>
        ${task.notes ? `<p class="task-notes">${escapeHtml(task.notes)}</p>` : ''}
      </div>
      <div class="exercise-row-actions">
        <button class="icon-btn" data-edit-task="${task.id}" aria-label="Modifica">${icon('edit')}</button>
        <button class="icon-btn danger" data-delete-task="${task.id}" aria-label="Elimina">${icon('trash')}</button>
      </div>
    </div>
  `;
}

function subjectFieldOptions(selectedId) {
  const { subjects } = store.get();
  return `<option value="">Nessuna materia</option>` + subjects.map((s) =>
    `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');
}

function openTaskModal(existing) {
  const isEdit = !!existing;
  openModal({
    title: isEdit ? 'Modifica attività' : 'Nuova attività',
    bodyHtml: `
      <div class="field">
        <label for="task-title-input">Cosa devi fare</label>
        <input type="text" class="input" id="task-title-input" placeholder="Es. Studiare capitolo 4 di storia" maxlength="120" value="${existing ? escapeHtml(existing.title) : ''}" />
      </div>
      <div class="field">
        <label for="task-subject-input">Materia</label>
        <select class="input" id="task-subject-input">${subjectFieldOptions(existing ? existing.subjectId : '')}</select>
      </div>
      <div class="field">
        <label for="task-due-input">Scadenza (opzionale)</label>
        <input type="date" class="input" id="task-due-input" value="${existing && existing.dueDate ? existing.dueDate : ''}" />
      </div>
      <div class="field">
        <label for="task-notes-input">Note (opzionale)</label>
        <textarea class="textarea" id="task-notes-input" rows="3" placeholder="Dettagli, pagine, link...">${existing ? escapeHtml(existing.notes) : ''}</textarea>
      </div>
      <button class="btn btn-primary btn-block" id="save-task-btn">${isEdit ? 'Salva modifiche' : 'Aggiungi attività'}</button>
    `,
    onMount: (body) => {
      const titleInput = body.querySelector('#task-title-input');
      titleInput.focus();
      body.querySelector('#save-task-btn').addEventListener('click', () => {
        const title = titleInput.value.trim();
        if (!title) { titleInput.focus(); return; }
        const payload = {
          title,
          subjectId: body.querySelector('#task-subject-input').value || null,
          dueDate: body.querySelector('#task-due-input').value || null,
          notes: body.querySelector('#task-notes-input').value.trim(),
        };
        if (isEdit) {
          store.updateTask(existing.id, payload);
          showToast('Attività aggiornata');
        } else {
          store.addTask(payload);
          showToast('Attività aggiunta');
        }
        closeModal();
        render(document.getElementById('view'));
      });
    },
  });
}

function openManageSubjectsModal() {
  const renderList = () => {
    const { subjects } = store.get();
    return subjects.length
      ? subjects.map((s) => `
        <div class="subject-row" data-subject-row="${s.id}">
          <span class="chip-dot" style="background:${s.color}"></span>
          <span class="subject-row-name">${escapeHtml(s.name)}</span>
          <button class="icon-btn danger" data-delete-subject="${s.id}" aria-label="Elimina materia">${icon('trash')}</button>
        </div>
      `).join('')
      : `<p class="text-secondary">Nessuna materia ancora. Aggiungine una qui sotto.</p>`;
  };

  openModal({
    title: 'Le tue materie',
    bodyHtml: `
      <div id="subjects-manage-list">${renderList()}</div>
      <div class="field mt-4">
        <label for="new-subject-input">Nuova materia</label>
        <div class="flex gap-2">
          <input type="text" class="input" id="new-subject-input" placeholder="Es. Matematica" maxlength="30" />
          <button class="btn btn-primary" id="add-subject-btn">${icon('plus')}</button>
        </div>
      </div>
    `,
    onMount: (body) => {
      const attachDeletes = () => {
        body.querySelectorAll('[data-delete-subject]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.deleteSubject;
            const subject = store.getSubject(id);
            confirmAction({
              title: 'Eliminare la materia?',
              message: `"${subject.name}" verrà rimossa. Le attività collegate restano, senza materia.`,
              confirmLabel: 'Elimina',
              onConfirm: () => {
                store.deleteSubject(id);
                if (activeFilter === id) activeFilter = null;
                body.querySelector('#subjects-manage-list').innerHTML = renderList();
                attachDeletes();
                render(document.getElementById('view'));
              },
            });
          });
        });
      };
      attachDeletes();

      const input = body.querySelector('#new-subject-input');
      const add = () => {
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        store.addSubject(name);
        input.value = '';
        body.querySelector('#subjects-manage-list').innerHTML = renderList();
        attachDeletes();
        render(document.getElementById('view'));
      };
      body.querySelector('#add-subject-btn').addEventListener('click', add);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    },
  });
}

function render(container) {
  const { subjects, tasks } = store.get();

  const filtered = tasks.filter((t) => !activeFilter || t.subjectId === activeFilter);
  const pending = filtered.filter((t) => !t.done).sort((a, b) => {
    const ba = bucketOf(a), bb = bucketOf(b);
    if (ba !== bb) return ba - bb;
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
  const done = filtered.filter((t) => t.done).sort((a, b) => b.createdAt - a.createdAt);

  const groups = new Map();
  pending.forEach((t) => {
    const b = bucketOf(t);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(t);
  });

  const pendingHtml = [...groups.keys()].sort((a, b) => a - b).map((b) => `
    <div class="task-group">
      <h3 class="task-group-title">${BUCKET_LABELS[b]}</h3>
      ${groups.get(b).map(taskRowHtml).join('')}
    </div>
  `).join('');

  const emptyHtml = `
    <div class="empty-state glass">
      <div class="empty-emoji">📚</div>
      <div class="empty-title">Nessuna attività</div>
      <div class="empty-text">${activeFilter ? 'Nessuna attività per questa materia.' : 'Aggiungi compiti, verifiche o cose da studiare e tienile organizzate per scadenza.'}</div>
      <button class="btn btn-primary" id="empty-add-task">Aggiungi attività</button>
    </div>
  `;

  const chipsHtml = `
    <div class="chip-row">
      <span class="chip ${!activeFilter ? 'selected' : ''}" data-filter="all" ${!activeFilter ? 'style="background:var(--accent-gradient);border-color:transparent"' : ''}>Tutte</span>
      ${subjects.map((s) => `
        <span class="chip ${activeFilter === s.id ? 'selected' : ''}" data-filter="${s.id}" ${activeFilter === s.id ? `style="background:${s.color};border-color:transparent"` : ''}>
          <span class="chip-dot" style="background:${s.color}"></span>${escapeHtml(s.name)}
        </span>
      `).join('')}
      <span class="chip" data-manage-subjects>${icon('edit')} Materie</span>
    </div>
  `;

  container.innerHTML = `
    <h1 class="section-title">Organizza lo studio</h1>
    <p class="section-subtitle">Materie, compiti e scadenze in un unico posto.</p>
    ${chipsHtml}
    <div id="tasks-list">${pending.length ? pendingHtml : (done.length ? '' : emptyHtml)}</div>
    ${done.length ? `
      <button class="settings-row-toggle" id="toggle-done-btn">
        <span>${showDone ? 'Nascondi' : 'Mostra'} completate (${done.length})</span>
        ${icon(showDone ? 'chevronUp' : 'chevronDown')}
      </button>
      ${showDone ? `<div class="task-group">${done.map(taskRowHtml).join('')}</div>` : ''}
    ` : ''}
    <button class="fab" id="fab-add-task" aria-label="Nuova attività">${icon('plus')}</button>
  `;

  container.querySelector('#fab-add-task').addEventListener('click', () => openTaskModal(null));
  const emptyBtn = container.querySelector('#empty-add-task');
  if (emptyBtn) emptyBtn.addEventListener('click', () => openTaskModal(null));

  container.querySelectorAll('[data-filter]').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter === 'all' ? null : chip.dataset.filter;
      render(container);
    });
  });

  const manageChip = container.querySelector('[data-manage-subjects]');
  if (manageChip) manageChip.addEventListener('click', openManageSubjectsModal);

  const toggleDoneBtn = container.querySelector('#toggle-done-btn');
  if (toggleDoneBtn) toggleDoneBtn.addEventListener('click', () => { showDone = !showDone; render(container); });

  container.querySelectorAll('[data-toggle-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.toggleTask(btn.dataset.toggleTask);
      render(container);
    });
  });

  container.querySelectorAll('[data-edit-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = tasks.find((t) => t.id === btn.dataset.editTask);
      if (task) openTaskModal(task);
    });
  });

  container.querySelectorAll('[data-delete-task]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteTask;
      confirmAction({
        title: 'Eliminare l\'attività?',
        message: 'Questa azione non può essere annullata.',
        confirmLabel: 'Elimina',
        onConfirm: () => {
          store.deleteTask(id);
          showToast('Attività eliminata');
          render(container);
        },
      });
    });
  });
}

window.Schola = window.Schola || {};
window.Schola.views = window.Schola.views || {};
window.Schola.views.studio = { render };

})();
