// Script classico (non un modulo ES): espone tutto su window.Schola.views.voti.
// Sezione "Voti": registra i voti per materia e calcola la media ponderata,
// per materia e generale, con la possibilita' di condividerla.
(function () {

const { store, icon, escapeHtml, openModal, closeModal, showToast, confirmAction, navigate } = window.Schola;

function fmtAvg(n) {
  return (n === null || n === undefined) ? '—' : n.toFixed(2);
}

function avgTone(n) {
  if (n === null || n === undefined) return '';
  if (n < 5) return 'grade-fail';
  if (n < 6) return 'grade-warn';
  return 'grade-pass';
}

// data di un voto per ordinare l'andamento nel tempo: se manca, si usa il
// momento in cui e' stato salvato, cosi' un voto senza data non sparisce dal grafico
function gradeSortKey(grade) {
  return grade.date ? new Date(grade.date + 'T00:00:00').getTime() : grade.createdAt;
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function subjectFieldOptions(selectedId) {
  const { subjects } = store.get();
  return subjects.map((s) =>
    `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');
}

// ---------- Andamento (grafico) ----------

// Disegna un grafico a linea 1-10, con tre fasce colorate di sfondo (rosso
// sotto il 5, giallo tra 5 e 6, verde dal 6 in su) cosi' la posizione della
// linea rispetto alle fasce si legge a colpo d'occhio, oltre ai puntini.
function buildTrendSvg(points) {
  if (points.length < 2) return null;

  const W = 280, H = 96, padX = 10, padY = 12;
  const minV = 1, maxV = 10;
  const scaleY = (v) => padY + (1 - (v - minV) / (maxV - minV)) * (H - padY * 2);
  const stepX = (W - padX * 2) / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: padX + i * stepX,
    y: scaleY(Math.max(minV, Math.min(maxV, p.value))),
    tone: p.tone,
  }));

  const yTop = scaleY(maxV), y6 = scaleY(6), y5 = scaleY(5), yBottom = scaleY(minV);
  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const dotsHtml = coords.map((c) =>
    `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" class="trend-dot ${c.tone}"></circle>`
  ).join('');

  return `
    <svg class="trend-chart-svg" viewBox="0 0 ${W} ${H}">
      <rect x="0" y="${yTop.toFixed(1)}" width="${W}" height="${(y6 - yTop).toFixed(1)}" class="trend-zone trend-zone-pass"></rect>
      <rect x="0" y="${y6.toFixed(1)}" width="${W}" height="${(y5 - y6).toFixed(1)}" class="trend-zone trend-zone-warn"></rect>
      <rect x="0" y="${y5.toFixed(1)}" width="${W}" height="${(yBottom - y5).toFixed(1)}" class="trend-zone trend-zone-fail"></rect>
      <path d="${pathD}" class="trend-line-path"></path>
      ${dotsHtml}
    </svg>
  `;
}

// andamento di una materia: ogni voto cosi' com'e', in ordine cronologico
function computeSubjectTrend(subjectId) {
  const grades = store.getGradesBySubject(subjectId).slice().sort((a, b) => gradeSortKey(a) - gradeSortKey(b));
  return grades.map((g) => ({ value: g.value, tone: avgTone(g.value) }));
}

// andamento generale: la media generale ricalcolata "man mano" ad ogni nuovo
// voto inserito in qualsiasi materia, cosi' si vede come e' cambiata nel tempo
function computeOverallTrend() {
  const { grades } = store.get();
  const sorted = grades.slice().sort((a, b) => gradeSortKey(a) - gradeSortKey(b));
  const points = [];
  const seenBySubject = {};

  sorted.forEach((g) => {
    if (!seenBySubject[g.subjectId]) seenBySubject[g.subjectId] = [];
    seenBySubject[g.subjectId].push(g);

    const subjectAverages = Object.keys(seenBySubject).map((sid) => {
      const list = seenBySubject[sid];
      const totalWeight = list.reduce((sum, x) => sum + x.weight, 0);
      const weightedSum = list.reduce((sum, x) => sum + x.value * x.weight, 0);
      return totalWeight ? weightedSum / totalWeight : null;
    }).filter((v) => v !== null);

    if (subjectAverages.length) {
      const overall = subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length;
      points.push({ value: overall, tone: avgTone(overall) });
    }
  });

  return points;
}

function trendChartHtml(points) {
  const svg = buildTrendSvg(points);
  return svg ? svg : `<p class="text-secondary trend-empty-hint">Aggiungi qualche voto per vedere l'andamento.</p>`;
}

// ---------- Modale voto ----------

function openGradeModal(existing, defaultSubjectId) {
  const { subjects } = store.get();
  if (!subjects.length) {
    showToast('Aggiungi prima una materia, dalla sezione Studio');
    return;
  }
  const isEdit = !!existing;
  openModal({
    title: isEdit ? 'Modifica voto' : 'Nuovo voto',
    bodyHtml: `
      <div class="field">
        <label for="grade-subject-input">Materia</label>
        <select class="input" id="grade-subject-input">${subjectFieldOptions(existing ? existing.subjectId : defaultSubjectId)}</select>
      </div>
      <div class="field">
        <label for="grade-value-input">Voto</label>
        <input type="number" class="input" id="grade-value-input" step="0.25" inputmode="decimal" placeholder="Es. 7.5" value="${existing ? existing.value : ''}" />
      </div>
      <div class="field">
        <label for="grade-weight-input">Peso (opzionale)</label>
        <input type="number" class="input" id="grade-weight-input" step="0.5" min="0.5" inputmode="decimal" placeholder="1" value="${existing && existing.weight !== 1 ? existing.weight : ''}" />
      </div>
      <div class="field">
        <label for="grade-label-input">Descrizione (opzionale)</label>
        <input type="text" class="input" id="grade-label-input" maxlength="60" placeholder="Es. Verifica capitolo 3" value="${existing ? escapeHtml(existing.label) : ''}" />
      </div>
      <div class="field">
        <label for="grade-date-input">Data (opzionale)</label>
        <input type="date" class="input" id="grade-date-input" value="${existing && existing.date ? existing.date : ''}" />
      </div>
      <button class="btn btn-primary btn-block" id="save-grade-btn">${isEdit ? 'Salva modifiche' : 'Aggiungi voto'}</button>
    `,
    onMount: (body) => {
      const valueInput = body.querySelector('#grade-value-input');
      valueInput.focus();
      body.querySelector('#save-grade-btn').addEventListener('click', () => {
        const value = parseFloat(valueInput.value.replace(',', '.'));
        if (Number.isNaN(value)) { valueInput.focus(); return; }
        const weightRaw = body.querySelector('#grade-weight-input').value.replace(',', '.');
        const payload = {
          subjectId: body.querySelector('#grade-subject-input').value,
          value,
          weight: weightRaw ? parseFloat(weightRaw) : 1,
          label: body.querySelector('#grade-label-input').value.trim(),
          date: body.querySelector('#grade-date-input').value || null,
        };
        if (isEdit) {
          store.updateGrade(existing.id, payload);
          showToast('Voto aggiornato');
        } else {
          store.addGrade(payload);
          showToast('Voto aggiunto');
        }
        closeModal();
        render(document.getElementById('view'));
      });
    },
  });
}

// ---------- Condividi le medie ----------

function buildShareText() {
  const { subjects } = store.get();
  const overall = store.getOverallAverage();
  const lines = subjects
    .map((s) => ({ s, avg: store.getSubjectAverage(s.id) }))
    .filter((x) => x.avg !== null)
    .map((x) => `${x.s.name}: ${fmtAvg(x.avg)}`);
  const header = overall !== null ? `Media generale: ${fmtAvg(overall)}` : 'Le mie medie';
  return [header, ...lines, '', 'via MySchool'].join('\n');
}

function drawShareCard() {
  const { subjects } = store.get();
  const rows = subjects
    .map((s) => ({ s, avg: store.getSubjectAverage(s.id) }))
    .filter((x) => x.avg !== null);
  const overall = store.getOverallAverage();

  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0b0e14');
  bgGrad.addColorStop(1, '#122019');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7d8598';
  ctx.font = '700 32px Sora, sans-serif';
  ctx.fillText('LE MIE MEDIE', W / 2, 140);

  const heroColor = overall !== null && overall >= 6 ? '#14b8a6' : '#f43f5e';
  ctx.fillStyle = heroColor;
  ctx.font = '800 220px Sora, sans-serif';
  ctx.fillText(fmtAvg(overall), W / 2, 400);

  ctx.fillStyle = '#e7e9ee';
  ctx.font = '600 30px Inter, sans-serif';
  ctx.fillText('media generale', W / 2, 460);

  let y = 600;
  rows.forEach((row) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = row.s.color;
    ctx.beginPath();
    ctx.arc(110, y - 12, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e7e9ee';
    ctx.font = '600 38px Inter, sans-serif';
    ctx.fillText(row.s.name, 145, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = row.avg >= 6 ? '#14b8a6' : '#f43f5e';
    ctx.font = '700 38px Sora, sans-serif';
    ctx.fillText(fmtAvg(row.avg), W - 110, y);

    y += 74;
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4b5165';
  ctx.font = '700 26px Sora, sans-serif';
  ctx.fillText('MySchool', W / 2, H - 70);

  return canvas;
}

function fallbackShare(text) {
  if (navigator.share) {
    navigator.share({ title: 'Le mie medie', text }).catch(() => {});
    return;
  }
  navigator.clipboard.writeText(text)
    .then(() => showToast('Medie copiate: incollale dove vuoi'))
    .catch(() => showToast('Non riesco a copiare il testo'));
}

async function shareAverages() {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) { /* si procede comunque */ }
  }

  const text = buildShareText();
  const canvas = drawShareCard();

  canvas.toBlob(async (blob) => {
    if (!blob) { fallbackShare(text); return; }
    const file = new File([blob], 'medie.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Le mie medie', text });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // l'utente ha annullato la condivisione
      }
    }
    fallbackShare(text);
  }, 'image/png');
}

// ---------- Render ----------

function gradeRowHtml(grade) {
  const weightTag = grade.weight !== 1 ? `<span class="badge grade-weight-badge">peso ${grade.weight}</span>` : '';
  const metaParts = [];
  if (grade.label) metaParts.push(escapeHtml(grade.label));
  if (grade.date) metaParts.push(fmtDate(grade.date));
  return `
    <div class="card grade-row glass" data-grade-id="${grade.id}">
      <div class="grade-row-value ${avgTone(grade.value)}">${fmtAvg(grade.value)}</div>
      <div class="grade-row-mid">
        ${metaParts.length ? `<span class="grade-row-meta">${metaParts.join(' · ')}</span>` : '<span class="grade-row-meta text-secondary">Senza descrizione</span>'}
        ${weightTag}
      </div>
      <div class="exercise-row-actions">
        <button class="icon-btn" data-edit-grade="${grade.id}" aria-label="Modifica voto">${icon('edit')}</button>
        <button class="icon-btn danger" data-delete-grade="${grade.id}" aria-label="Elimina voto">${icon('trash')}</button>
      </div>
    </div>
  `;
}

function subjectCardHtml(subject) {
  const grades = store.getGradesBySubject(subject.id).sort((a, b) => b.createdAt - a.createdAt);
  const avg = store.getSubjectAverage(subject.id);
  return `
    <div class="subject-grades-card">
      <div class="subject-grades-head">
        <span class="chip-dot" style="background:${subject.color}"></span>
        <span class="subject-grades-name">${escapeHtml(subject.name)}</span>
        <span class="subject-grades-avg ${avgTone(avg)}">${fmtAvg(avg)}</span>
      </div>
      ${grades.length ? `<div class="trend-chart-wrap">${trendChartHtml(computeSubjectTrend(subject.id))}</div>` : ''}
      ${grades.length
        ? `<div class="grade-rows">${grades.map(gradeRowHtml).join('')}</div>`
        : `<p class="text-secondary grade-empty-hint">Nessun voto ancora per questa materia.</p>`}
    </div>
  `;
}

function render(container) {
  const { subjects } = store.get();

  if (!subjects.length) {
    container.innerHTML = `
      <h1 class="section-title">Voti</h1>
      <p class="section-subtitle">Registra i voti e tieni d'occhio la media, materia per materia.</p>
      <div class="empty-state glass mt-4">
        <div class="empty-emoji">📊</div>
        <div class="empty-title">Nessuna materia ancora</div>
        <div class="empty-text">Aggiungi le tue materie dalla sezione Studio, poi torna qui per registrare i voti.</div>
        <button class="btn btn-primary" id="go-to-studio-btn">Vai a Studio</button>
      </div>
    `;
    container.querySelector('#go-to-studio-btn').addEventListener('click', () => navigate('#/'));
    return;
  }

  const overall = store.getOverallAverage();

  container.innerHTML = `
    <h1 class="section-title">Voti</h1>
    <p class="section-subtitle">La tua media, materia per materia.</p>

    <div class="overall-average-card glass">
      <div class="overall-average-label">Media generale</div>
      <div class="overall-average-value ${avgTone(overall)}">${fmtAvg(overall)}</div>
      <div class="trend-chart-wrap">${trendChartHtml(computeOverallTrend())}</div>
      <button class="btn btn-glass btn-sm" id="share-averages-btn">${icon('share')} Condividi</button>
    </div>

    <div id="subject-grades-list">${subjects.map(subjectCardHtml).join('')}</div>

    <button class="fab" id="fab-add-grade" aria-label="Nuovo voto">${icon('plus')}</button>
  `;

  container.querySelector('#fab-add-grade').addEventListener('click', () => openGradeModal(null, subjects[0].id));
  container.querySelector('#share-averages-btn').addEventListener('click', shareAverages);

  container.querySelectorAll('[data-edit-grade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const grade = store.get().grades.find((g) => g.id === btn.dataset.editGrade);
      if (grade) openGradeModal(grade);
    });
  });

  container.querySelectorAll('[data-delete-grade]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteGrade;
      confirmAction({
        title: 'Eliminare il voto?',
        message: 'Questa azione non può essere annullata.',
        confirmLabel: 'Elimina',
        onConfirm: () => {
          store.deleteGrade(id);
          showToast('Voto eliminato');
          render(container);
        },
      });
    });
  });
}

window.Schola = window.Schola || {};
window.Schola.views = window.Schola.views || {};
window.Schola.views.voti = { render };

})();
