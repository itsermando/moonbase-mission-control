// The explanation matrix: a visual table that walks through what happened in a mission.
// Each row reads left to right as Choice -> Physics -> Result, with a gauge, a status chip and a one-line
// explanation. Tap a row (or press Enter) to open the scientific specification: the formula and the numbers.
// Pure HTML builder (matrixHTML, testable in Node) plus renderMatrix(container, spec) for the browser. No libraries.
//
// spec = { title, subtitle, columns?: [topic, choice, physics, result],
//   rows: [{ icon, label, choice, physics, value, unit, bar: { v, min, max, good: [lo, hi] }, status?, say, why, spec }] }

if (typeof document !== 'undefined' && !document.querySelector('link[data-matrix-css]')) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./matrix.css', import.meta.url).href; l.dataset.matrixCss = ''; document.head.appendChild(l);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const STATUS = { ok: { word: 'Nominal', mark: '✓' }, warn: { word: 'Watch', mark: '!' }, fail: { word: 'Fail', mark: '✕' } };

/** 'ok' inside the target band, 'warn' within 15% of the gauge range outside it, otherwise 'fail'. An explicit status wins. */
export function statusOf(row) {
  if (row.status && STATUS[row.status]) return row.status;
  const b = row.bar;
  if (!b || !b.good) return 'ok';
  const [lo, hi] = b.good, span = Math.max(1e-9, b.max - b.min);
  if (b.v >= lo && b.v <= hi) return 'ok';
  const off = b.v < lo ? lo - b.v : b.v - hi;
  return off / span <= 0.15 ? 'warn' : 'fail';
}

/** Inline SVG gauge: track, green target band, filled value and a marker. */
export function gaugeSVG(bar, status) {
  if (!bar) return '';
  const span = Math.max(1e-9, bar.max - bar.min), pos = (x) => Math.max(0, Math.min(100, ((x - bar.min) / span) * 100));
  const v = pos(bar.v), good = bar.good ? `<rect class="mx-good" x="${pos(bar.good[0]).toFixed(2)}" y="0" width="${Math.max(0.8, pos(bar.good[1]) - pos(bar.good[0])).toFixed(2)}" height="10" rx="2"/>` : '';
  const target = bar.good ? `, target ${bar.good[0]} to ${bar.good[1]}` : '';
  return `<svg class="mx-gauge ${status}" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="Value ${bar.v} on a scale from ${bar.min} to ${bar.max}${target}">
    <rect class="mx-track" x="0" y="0" width="100" height="10" rx="2"/>${good}<rect class="mx-fill" x="0" y="3" width="${v.toFixed(2)}" height="4" rx="1.5"/><rect class="mx-mark" x="${Math.max(0, Math.min(98.6, v - 0.7)).toFixed(2)}" y="0" width="1.4" height="10"/></svg>`;
}

export function matrixHTML(spec) {
  const cols = spec.columns || ['Topic', 'You chose', 'The physics', 'Result'];
  const rows = spec.rows || [], st = rows.map(statusOf);
  const count = (k) => st.filter((x) => x === k).length;
  const uid = `mx${Math.random().toString(36).slice(2, 7)}`;
  const head = `<div class="mx-top"><div><h2 class="mx-title">${esc(spec.title)}</h2>${spec.subtitle ? `<p class="mx-sub">${esc(spec.subtitle)}</p>` : ''}</div>
    <div class="mx-sum" aria-label="${count('ok')} nominal, ${count('warn')} to watch, ${count('fail')} failed">
      ${['ok', 'warn', 'fail'].map((k) => `<span class="mx-chip ${k}"><b>${STATUS[k].mark}</b> ${count(k)} ${STATUS[k].word.toLowerCase()}</span>`).join('')}
      <button type="button" class="mx-all" data-mx-all aria-pressed="false">Open all</button></div></div>`;
  const header = `<div class="mx-cols" aria-hidden="true"><span>${esc(cols[0])}</span><span>${esc(cols[1])}</span><i>→</i><span>${esc(cols[2])}</span><i>→</i><span>${esc(cols[3])}</span></div>`;
  const body = rows.map((r, n) => {
    const s = st[n], id = `${uid}-${n}`;
    const result = `<div class="mx-res"><div class="mx-val"><b>${esc(r.value)}</b>${r.unit ? ` <span>${esc(r.unit)}</span>` : ''}</div>${gaugeSVG(r.bar, s)}</div>`;
    return `<div class="mx-row ${s}" role="listitem">
      <button type="button" class="mx-head" aria-expanded="false" aria-controls="${id}">
        <span class="mx-topic"><span class="mx-ico" aria-hidden="true">${esc(r.icon || '•')}</span><span>${esc(r.label)}</span></span>
        <span class="mx-choice" data-l="${esc(cols[1])}">${esc(r.choice ?? '—')}</span><i class="mx-arrow" aria-hidden="true">→</i>
        <span class="mx-phys" data-l="${esc(cols[2])}">${esc(r.physics ?? '—')}</span><i class="mx-arrow" aria-hidden="true">→</i>
        <span class="mx-result" data-l="${esc(cols[3])}">${result}<span class="mx-chip ${s}"><b>${STATUS[s].mark}</b> ${STATUS[s].word}</span></span>
        <span class="mx-caret" aria-hidden="true">▾</span>
      </button>
      <div class="mx-more" id="${id}" hidden>
        ${r.say ? `<p class="mx-say"><b>What happened.</b> ${esc(r.say)}</p>` : ''}
        ${r.why ? `<p class="mx-why"><b>Why.</b> ${esc(r.why)}</p>` : ''}
        ${r.spec ? `<p class="mx-spec"><span class="mx-f" title="Scientific specification">ƒ</span><code>${esc(r.spec)}</code></p>` : ''}
      </div></div>`;
  }).join('');
  return `<section class="mx" aria-label="${esc(spec.title)}">${head}${header}<div class="mx-rows" role="list">${body}</div></section>`;
}

/** Draw the matrix into `container` and wire up the open/close behaviour. Returns the container. */
export function renderMatrix(container, spec) {
  container.innerHTML = matrixHTML(spec);
  const root = container.querySelector('.mx');
  const setOpen = (btn, open) => {
    btn.setAttribute('aria-expanded', String(open));
    root.querySelector(`#${btn.getAttribute('aria-controls')}`).hidden = !open;
    btn.closest('.mx-row').classList.toggle('open', open);
  };
  root.addEventListener('click', (e) => {
    const all = e.target.closest('[data-mx-all]');
    if (all) {
      const open = all.getAttribute('aria-pressed') !== 'true';
      all.setAttribute('aria-pressed', String(open)); all.textContent = open ? 'Close all' : 'Open all';
      root.querySelectorAll('.mx-head').forEach((b) => setOpen(b, open));
      return;
    }
    const b = e.target.closest('.mx-head');
    if (b) setOpen(b, b.getAttribute('aria-expanded') !== 'true');
  });
  return container;
}
