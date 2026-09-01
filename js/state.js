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

// L'orario e' organizzato per giorno della settimana. La domenica c'e' perche'
// il sabato bisogna comunque poter guardare "cosa ho domani", anche solo per
// vedere che non c'e' niente.
const WEEK_DAYS = [
  { key: 'lun', label: 'Lunedì',    short: 'Lun' },
  { key: 'mar', label: 'Martedì',   short: 'Mar' },
  { key: 'mer', label: 'Mercoledì', short: 'Mer' },
  { key: 'gio', label: 'Giovedì',   short: 'Gio' },
  { key: 'ven', label: 'Venerdì',   short: 'Ven' },
  { key: 'sab', label: 'Sabato',    short: 'Sab' },
  { key: 'dom', label: 'Domenica',  short: 'Dom' },
];

// getDay() conta da domenica: qui la settimana comincia di lunedi', come a scuola.
function weekDayKey(date) {
  return WEEK_DAYS[(date.getDay() + 6) % 7].key;
}

function weekDay(key) {
  return WEEK_DAYS.find((d) => d.key === key) || WEEK_DAYS[0];
}

function emptyTimetable() {
  const out = {};
  WEEK_DAYS.forEach((d) => { out[d.key] = []; });
  return out;
}

// Ogni giorno e' un elenco di ore, e ogni ora e' l'id di una materia (oppure
// null per un'ora buca). L'ordine e' l'ora: la prima casella e' la prima ora.
function normalizeTimetable(raw) {
  const out = emptyTimetable();
  if (!raw || typeof raw !== 'object') return out;
  WEEK_DAYS.forEach((d) => {
    const hours = raw[d.key];
    if (Array.isArray(hours)) out[d.key] = hours.map((id) => id || null);
  });
  return out;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return {
    theme: 'dark',
    remindersEnabled: false,
    subjects: [],
    timetable: emptyTimetable(),
    tasks: [],
    grades: [],
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
    const merged = { ...defaultState(), ...parsed };
    // I dati salvati prima dell'orario non hanno il campo, e uno salvato a meta'
    // potrebbe avere solo alcuni giorni: normalizeTimetable riempie i buchi.
    merged.timetable = normalizeTimetable(merged.timetable);
    return merged;
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

  // ---- Promemoria scadenze ----
  setRemindersEnabled(enabled) {
    state.remindersEnabled = !!enabled;
    save();
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

  // ---- Orario delle lezioni ----
  getTimetable() {
    return state.timetable;
  },
  // Le ore di un giorno, gia' risolte in materie: le materie cancellate nel
  // frattempo tornano come ore vuote invece che come id orfani.
  getDaySchedule(dayKey) {
    const hours = state.timetable[dayKey] || [];
    return hours.map((subjectId, i) => ({
      hour: i + 1,
      subject: subjectId ? (state.subjects.find((s) => s.id === subjectId) || null) : null,
    }));
  },
  setTimetableHour(dayKey, index, subjectId) {
    const hours = state.timetable[dayKey];
    if (!hours || index < 0 || index >= hours.length) return;
    hours[index] = subjectId || null;
    save();
  },
  addTimetableHour(dayKey) {
    if (!state.timetable[dayKey]) return;
    state.timetable[dayKey].push(null);
    save();
  },
  removeTimetableHour(dayKey, index) {
    const hours = state.timetable[dayKey];
    if (!hours || index < 0 || index >= hours.length) return;
    hours.splice(index, 1);
    save();
  },
  // Vero solo se almeno un giorno ha almeno un'ora con una materia: serve a
  // decidere se in Studio mostrare l'orario o l'invito a compilarlo.
  hasTimetable() {
    return WEEK_DAYS.some((d) => (state.timetable[d.key] || []).some((id) => id));
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

  // ---- Voti ----
  addGrade({ subjectId, value, weight, label, date }) {
    const grade = {
      id: uid(),
      subjectId,
      value: Number(value),
      weight: weight && weight > 0 ? Number(weight) : 1,
      label: (label || '').trim(),
      date: date || null,
      createdAt: Date.now(),
    };
    state.grades.push(grade);
    save();
    return grade;
  },
  updateGrade(id, patch) {
    const g = state.grades.find((x) => x.id === id);
    if (!g) return;
    Object.assign(g, patch);
    save();
  },
  deleteGrade(id) {
    state.grades = state.grades.filter((g) => g.id !== id);
    save();
  },
  getGradesBySubject(subjectId) {
    return state.grades.filter((g) => g.subjectId === subjectId);
  },
  // media ponderata dei voti di una materia (pesati per l'importanza della verifica)
  getSubjectAverage(subjectId) {
    const grades = store.getGradesBySubject(subjectId);
    if (!grades.length) return null;
    const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);
    const weightedSum = grades.reduce((sum, g) => sum + g.value * g.weight, 0);
    return totalWeight ? weightedSum / totalWeight : null;
  },
  // media generale: media delle medie di materia (ogni materia pesa uguale,
  // cosi' una materia con tanti voti non "schiaccia" le altre)
  getOverallAverage() {
    const withGrades = state.subjects.filter((s) => store.getGradesBySubject(s.id).length);
    if (!withGrades.length) return null;
    const sum = withGrades.reduce((acc, s) => acc + store.getSubjectAverage(s.id), 0);
    return sum / withGrades.length;
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
Object.assign(window.Schola, { store, WEEK_DAYS, weekDayKey, weekDay, SUBJECT_COLORS, uid, applyTheme });

})();
