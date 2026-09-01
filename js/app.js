// Script classico (non un modulo ES) caricato per ultimo: a questo punto
// window.Schola contiene gia' store, componenti, router e tutte le viste.
(function () {

const { applyTheme, icon, initRouter, store, navigate } = window.Schola;

// Tema applicato subito, prima del primo paint utile.
applyTheme();

// Corregge l'altezza reale della shell (vedi --app-vh in css/styles.css):
// iOS e alcuni Android, all'apertura della PWA o al ritorno in foreground,
// a volte riportano un'altezza di viewport non ancora aggiornata, lasciando
// uno spazio vuoto sotto la bottom nav finche' l'utente non scorre. Misuriamo
// l'altezza vera piu' volte, nei momenti in cui puo' cambiare.
function setAppHeight() {
  const h = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${h}px`);
}
// Su alcuni WebKit (iOS, soprattutto da PWA installata) leggere l'altezza
// giusta non basta: il motore di rendering ricalcola davvero il layout solo
// quando arriva un vero evento di scroll. Lo simuliamo noi (spostamento di 1px
// e subito indietro, impercettibile) cosi' l'utente non deve farlo a mano.
function nudgeViewport() {
  const de = document.documentElement;
  // Se la pagina e' piu' corta del viewport (es. una sezione con poco
  // contenuto) non c'e' nulla da scorrere: scrollTo sotto sarebbe un no-op e
  // non forzerebbe alcun ricalcolo. Garantiamo sempre un filo di overflow
  // finto solo per la durata del nudge. Usiamo innerHeight (mai 0) e non
  // clientHeight, che a script appena partito - prima che il layout esista -
  // puo' leggere 0.
  de.style.minHeight = `${window.innerHeight + 40}px`;
  window.scrollTo(0, 1);
  // setTimeout invece di requestAnimationFrame: rAF puo' non scattare mai se
  // la scheda non e' visibile/in primo piano nel momento in cui l'app si
  // apre (es. tornando da un'altra app), lasciando lo scroll bloccato a 1px.
  // Nessun altro codice imposta un min-height inline su <html>: pulire
  // sempre a stringa vuota (invece di salvare/ripristinare un valore
  // "precedente") evita che chiamate ravvicinate si accavallino e lascino un
  // valore intermedio incastrato.
  setTimeout(() => {
    window.scrollTo(0, 0);
    de.style.minHeight = '';
  }, 16);
}
function refreshViewport() {
  setAppHeight();
  nudgeViewport();
}
refreshViewport();
requestAnimationFrame(() => requestAnimationFrame(refreshViewport));
setTimeout(refreshViewport, 50);
setTimeout(refreshViewport, 300);
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(refreshViewport, 200));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(refreshViewport, 100);
});
if (window.visualViewport) window.visualViewport.addEventListener('resize', setAppHeight);

// Icone della bottom nav.
document.querySelectorAll('.nav-icon').forEach((el) => {
  el.innerHTML = icon(el.dataset.icon);
});

initRouter();

if (window.Schola.checkDueReminders) window.Schola.checkDueReminders();

// Il guscio comune (js/pwa-shell.js) si occupa da solo del service worker,
// dell'avviso di nuova versione e della barretta "sei offline". Qui gli si
// dice soltanto come sono fatti i dati di questa app.
if (window.PwaShell) {
  window.PwaShell.configure({
    // Senza dati non c'e' ancora niente da salvare, quindi il promemoria del
    // backup non ha motivo di comparire.
    hasData: () => {
      const { subjects, tasks, grades, essays } = store.get();
      return subjects.length > 0 || tasks.length > 0 || grades.length > 0 || essays.length > 0;
    },
    onBackupRequest: () => navigate('#/impostazioni'),
  });
}

})();
