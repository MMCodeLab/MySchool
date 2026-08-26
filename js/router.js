// Script classico (non un modulo ES): espone tutto su window.Schola.
// Le viste sono gia' tutte caricate (nessun import dinamico), perche' Chrome
// blocca il caricamento dei moduli ES quando la pagina e' aperta via file://.
(function () {

function container() {
  return document.getElementById('view');
}

// Posiziona la pillola della bottom nav misurando il vero elemento attivo
// (in pixel, non in percentuale) cosi' funziona con un numero qualsiasi di
// voci, anche quando la barra scorre orizzontalmente su schermi stretti.
function positionNavPill(nav) {
  const active = nav.querySelector('.nav-item.active');
  const pill = document.getElementById('nav-pill');
  if (!active || !pill) return;
  pill.style.width = `${active.offsetWidth}px`;
  pill.style.height = `${active.offsetHeight}px`;
  pill.style.transform = `translateX(${active.offsetLeft}px)`;
  active.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}

function updateNavActive(routeKey) {
  const nav = document.getElementById('bottom-nav');
  const items = nav.querySelectorAll('.nav-item');
  items.forEach((item) => item.classList.toggle('active', item.dataset.route === routeKey));
  positionNavPill(nav);
}

function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);
  const el = container();
  const views = window.Schola.views;

  let routeKey = 'studio';
  let renderFn;

  if (!parts.length || parts[0] === '') {
    routeKey = 'studio';
    renderFn = views.studio.render;
  } else if (parts[0] === 'italiano') {
    routeKey = 'italiano';
    renderFn = views.italiano.render;
  } else if (parts[0] === 'matematica') {
    routeKey = 'matematica';
    renderFn = views.matematica.render;
  } else if (parts[0] === 'inglese') {
    routeKey = 'inglese';
    renderFn = views.inglese.render;
  } else if (parts[0] === 'storia') {
    routeKey = 'storia';
    renderFn = views.storia.render;
  } else if (parts[0] === 'voti') {
    routeKey = 'voti';
    renderFn = views.voti.render;
  } else if (parts[0] === 'impostazioni') {
    routeKey = 'impostazioni';
    renderFn = views.settings.render;
  } else {
    renderFn = views.studio.render;
  }

  updateNavActive(routeKey);
  el.classList.remove('view');
  void el.offsetWidth; // restart entrance animation
  el.classList.add('view');
  renderFn(el);
  window.scrollTo(0, 0);
}

function navigate(hash) {
  location.hash = hash;
}

function initRouter() {
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => positionNavPill(document.getElementById('bottom-nav')));
  route();
}

window.Schola = window.Schola || {};
Object.assign(window.Schola, { navigate, initRouter });

})();
