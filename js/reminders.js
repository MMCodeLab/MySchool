// Script classico (non un modulo ES): espone window.Schola.checkDueReminders.
// Promemoria locali (Notification API) per le scadenze gia' salvate in Studio.
// Nessun backend: scattano solo quando l'app viene aperta, non mentre e'
// chiusa in background — e' il limite di una PWA senza server (vedi README).
(function () {

const NOTIFIED_KEY = 'schola.remindedToday.v1';

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayISO() {
  return toLocalISODate(new Date());
}

function loadNotifiedToday() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayISO()) return new Set(); // giorno nuovo: si riparte
    return new Set(parsed.taskIds || []);
  } catch (e) {
    return new Set();
  }
}
function saveNotifiedToday(ids) {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify({ date: todayISO(), taskIds: [...ids] }));
  } catch (e) { /* storage non disponibile */ }
}

function dueTasks() {
  const { store } = window.Schola;
  const today = todayISO();
  return store.get().tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= today);
}

function notify(due) {
  const today = todayISO();
  const overdueCount = due.filter((t) => t.dueDate < today).length;

  let title, body;
  if (due.length === 1) {
    title = due[0].title;
    body = due[0].dueDate < today ? 'In ritardo' : 'Scade oggi';
  } else {
    title = `Hai ${due.length} attività da fare`;
    const names = due.slice(0, 3).map((t) => t.title).join(', ');
    body = due.length > 3 ? `${names} e altre ${due.length - 3}` : names;
    if (overdueCount) body += ` · ${overdueCount} in ritardo`;
  }

  try {
    const n = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'schola-scadenze' });
    n.onclick = () => {
      window.focus();
      location.hash = '#/';
      n.close();
    };
  } catch (e) {
    // qualche browser puo' comunque rifiutare la notifica anche a permesso concesso
  }
}

function checkDueReminders() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const { store } = window.Schola;
  if (!store.get().remindersEnabled) return;

  const due = dueTasks();
  if (!due.length) return;

  const alreadyNotified = loadNotifiedToday();
  const toNotify = due.filter((t) => !alreadyNotified.has(t.id));
  if (!toNotify.length) return; // gia' avvisato oggi per tutto cio' che e' dovuto

  notify(toNotify);
  due.forEach((t) => alreadyNotified.add(t.id));
  saveNotifiedToday(alreadyNotified);
}

window.Schola = window.Schola || {};
window.Schola.checkDueReminders = checkDueReminders;

})();
