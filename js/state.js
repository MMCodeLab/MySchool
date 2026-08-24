// Central state store, persisted to localStorage. No build step, no framework.
// Script classico (non un modulo ES): espone tutto su window.Schola, cosi'
// funziona anche aperto come file locale (file://), dove Chrome blocca
// il caricamento dei moduli ES per motivi di CORS.
(function () {

const STORAGE_KEY = 'schola.data.v1';

const SUBJECT_COLORS = [
  '#f97316', '#22c55e', '#3b82f6', '#eab308', '#ec4899',
  '#a855f7', '#06b6d4', '#f43f5e', '#14b8a6', '#84cc16',
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return {
    theme: 'dark',
    subjects: [],
    tasks: [],
    essays: [],
    mathChat: [],
    translations: [],
    storiaSearches: [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    console.warn('Impossibile leggere i dati salvati, riparto da zero.', e);
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Impossibile salvare i dati (storage pieno?).', e);
  }
  listeners.forEach((fn) => fn(state));
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#0b0e14' : '#f3f1ec');
}

function nextSubjectColor() {
  const used = new Set(state.subjects.map((s) => s.color));
  const free = SUBJECT_COLORS.find((c) => !used.has(c));
  return free || SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length];
}

const store = {
  get() {
    return state;
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // ---- Theme ----
  setTheme(theme) {
    state.theme = theme;
    save();
    applyTheme();
  },

  // ---- Materie (subjects) ----
  addSubject(name) {
    const subject = {
      id: uid(),
      name: name.trim(),
      color: nextSubjectColor(),
      createdAt: Date.now(),
    };
    state.subjects.push(subject);
    save();
    return subject;
  },
  updateSubject(id, patch) {
    const s = state.subjects.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch);
    save();
  },
  deleteSubject(id) {
    state.subjects = state.subjects.filter((s) => s.id !== id);
    state.tasks.forEach((t) => { if (t.subjectId === id) t.subjectId = null; });
    save();
  },
  getSubject(id) {
    return state.subjects.find((s) => s.id === id) || null;
  },

  // ---- Compiti / attivita' di studio ----
  addTask({ title, subjectId, dueDate, notes }) {
    const task = {
      id: uid(),
      title: title.trim(),
      subjectId: subjectId || null,
      dueDate: dueDate || null,
      notes: notes || '',
      done: false,
      createdAt: Date.now(),
    };
    state.tasks.push(task);
    save();
    return task;
  },
  updateTask(id, patch) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    save();
  },
  toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    save();
  },
  deleteTask(id) {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    save();
  },

  // ---- Temi di italiano ----
  addEssay({ topic, text, wordCount }) {
    const essay = { id: uid(), topic: topic.trim(), text, wordCount: wordCount || 0, createdAt: Date.now() };
    state.essays.unshift(essay);
    state.essays = state.essays.slice(0, 30);
    save();
    return essay;
  },
  deleteEssay(id) {
    state.essays = state.essays.filter((e) => e.id !== id);
    save();
  },
  clearEssays() {
    state.essays = [];
    save();
  },

  // ---- Assistente di matematica (chat) ----
  getMathChat() {
    return state.mathChat;
  },
  addMathMessage(role, content) {
    const msg = { id: uid(), role, content, ts: Date.now() };
    state.mathChat.push(msg);
    save();
    return msg;
  },
  clearMathChat() {
    state.mathChat = [];
    save();
  },

  // ---- Traduzioni (inglese) ----
  addTranslation({ sourceLang, targetLang, sourceText, translatedText }) {
    const item = { id: uid(), sourceLang, targetLang, sourceText, translatedText, createdAt: Date.now() };
    state.translations.unshift(item);
    state.translations = state.translations.slice(0, 20);
    save();
    return item;
  },
  deleteTranslation(id) {
    state.translations = state.translations.filter((t) => t.id !== id);
    save();
  },
  clearTranslations() {
    state.translations = [];
    save();
  },

  // ---- Ricerche di storia ----
  addStoriaSearch(entry) {
    const item = { id: uid(), ...entry, createdAt: Date.now() };
    state.storiaSearches = state.storiaSearches.filter((s) => s.query.toLowerCase() !== entry.query.toLowerCase());
    state.storiaSearches.unshift(item);
    state.storiaSearches = state.storiaSearches.slice(0, 15);
    save();
    return item;
  },
  clearStoriaSearches() {
    state.storiaSearches = [];
    save();
  },

  // ---- Backup ----
  exportData() {
    return JSON.stringify(state, null, 2);
  },
  importData(json) {
    const parsed = JSON.parse(json);
    state = { ...defaultState(), ...parsed };
    save();
    applyTheme();
  },
  clearAll() {
    state = defaultState();
    save();
  },
};

window.Schola = window.Schola || {};
Object.assign(window.Schola, { store, SUBJECT_COLORS, uid, applyTheme });

})();
