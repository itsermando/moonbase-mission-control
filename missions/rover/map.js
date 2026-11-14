// Draws the rover map on a canvas: a NASA picture of the terrain plus game overlays (Moon or Mars).
import { N, cells, sunAt, WORLD_ID } from './world.js';

const SIZE = 960; // canvas pixels (drawn at 2x for sharp screens)
const CELL = SIZE / N;
const imgs = {};
for (const name of ['hillshade', 'slope', 'mars-hillshade']) {
  const im = new Image();
  im.src = new URL(`./assets/${name}.png`, import.meta.url).href;
  imgs[name] = im;
}
const SLOPE_COLORS = ['rgba(70,194,138,.35)', 'rgba(242,193,78,.35)', 'rgba(242,140,60,.45)', 'rgba(255,90,90,.55)'];

export function setupCanvas(canvas, onRedraw) {
  canvas.width = SIZE; canvas.height = SIZE;
  for (const im of Object.values(imgs)) if (!im.complete) im.addEventListener('load', onRedraw, { once: true });
}

/** Map mouse position to a cell. */
export function cellFromEvent(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  const i = Math.floor(((ev.clientX - r.left) / r.width) * N);
  const j = Math.floor(((ev.clientY - r.top) / r.height) * N);
  return i >= 0 && j >= 0 && i < N && j < N ? cells[j * N + i] : null;
}

const center = (c) => [(c.i + 0.5) * CELL, (c.j + 0.5) * CELL];

function base(ctx, view) {
  ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, SIZE, SIZE);
  const mars = WORLD_ID === 'mars';
  const im = mars ? imgs['mars-hillshade'] : view === 'slope' ? imgs.slope : imgs.hillshade;
  if (im.complete && im.naturalWidth) ctx.drawImage(im, 0, 0, SIZE, SIZE);
  else for (const c of cells) { const g = c.elev; ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(c.i * CELL, c.j * CELL, CELL, CELL); }
  if (mars) { ctx.fillStyle = 'rgba(190,95,45,.38)'; ctx.fillRect(0, 0, SIZE, SIZE); } // Mars is rust-coloured
  if (mars && view === 'slope') for (const c of cells) { ctx.fillStyle = SLOPE_COLORS[c.slope]; ctx.fillRect(c.i * CELL, c.j * CELL, CELL, CELL); }
}

function shadeCells(ctx, view, t) {
  for (const c of cells) {
    const x = c.i * CELL, y = c.j * CELL;
    if (view === 'sun') {
      const s = sunAt(c, t);
      ctx.fillStyle = s === 0 ? 'rgba(10,20,60,.75)' : `rgba(255,200,60,${0.08 + s * 0.4})`;
      ctx.fillRect(x, y, CELL, CELL);
    } else if (WORLD_ID === 'moon' && (c.kind === 'floor' || c.kind === 'wall')) {
      ctx.fillStyle = 'rgba(20,40,110,.38)'; ctx.fillRect(x, y, CELL, CELL);
    }
  }
}

function traps(ctx) {
  ctx.lineWidth = 2;
  if (WORLD_ID === 'mars') {
    for (const c of cells) {
      if (c.kind === 'delta') { ctx.strokeStyle = 'rgba(127,220,255,.85)'; ctx.strokeRect(c.i * CELL + 2, c.j * CELL + 2, CELL - 4, CELL - 4); }
      if (c.kind === 'rim' && (c.i + c.j) % 3 === 0) { ctx.fillStyle = 'rgba(255,209,102,.55)'; ctx.fillRect(c.i * CELL + CELL / 2 - 2, c.j * CELL + CELL / 2 - 2, 4, 4); }
    }
    return;
  }
  ctx.strokeStyle = 'rgba(127,220,255,.9)';
  for (const c of cells) if (c.kind === 'trap') ctx.strokeRect(c.i * CELL + 2, c.j * CELL + 2, CELL - 4, CELL - 4);
}

function marker(ctx, c, color, label) {
  const [x, y] = center(c);
  ctx.fillStyle = color; ctx.strokeStyle = '#05070c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, CELL * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (label) {
    ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 5;
    ctx.strokeText(label, x, y - CELL); ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - CELL);
  }
}

function scaleBar(ctx) {
  const px = 3 * CELL; // 3 cells is about 1 km
  ctx.fillStyle = 'rgba(5,7,12,.7)'; ctx.fillRect(16, SIZE - 52, px + 24, 36);
  ctx.fillStyle = '#fff'; ctx.fillRect(28, SIZE - 26, px, 4);
  ctx.font = '18px system-ui'; ctx.textAlign = 'left'; ctx.fillText('1 km', 28, SIZE - 32);
}

/**
 * opts: { view: 'terrain'|'slope'|'sun', mode: 'site'|'deploy', t, siteK, hover, plan, run }
 */
export function draw(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const run = opts.run;
  base(ctx, opts.view);
  shadeCells(ctx, opts.view, opts.t || 0);
  traps(ctx);

  if (opts.mode === 'site') {
    for (const c of cells) {
      if (c.slope === 0 && c.kind === 'plain') { ctx.fillStyle = 'rgba(70,194,138,.22)'; ctx.fillRect(c.i * CELL, c.j * CELL, CELL, CELL); }
    }
  }
  if (run) {
    for (const k of run.sampled || []) {
      const [x, y] = center(cells[k]);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#05070c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, CELL * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (const k of run.scanned) {
      const c = cells[k], a = Math.min(0.85, c.ice / 6);
      ctx.fillStyle = `rgba(127,220,255,${a})`; ctx.fillRect(c.i * CELL + 1, c.j * CELL + 1, CELL - 2, CELL - 2);
    }
  }
  const route = (plan, color, width, dash) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
    plan.path.forEach((c, n) => { const [x, y] = center(c); n ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
  };
  if (opts.hoverPlan && opts.hoverPlan !== opts.plan) route(opts.hoverPlan, opts.hoverPlan.tooFar ? 'rgba(255,107,107,.8)' : 'rgba(255,255,255,.55)', 3, [6, 8]);
  if (opts.plan) route(opts.plan, '#ffd166', 5, [12, 8]);
  if (opts.hover) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(opts.hover.i * CELL, opts.hover.j * CELL, CELL, CELL);
  }
  if (opts.markers !== false) {
    const onLander = run && run.k === opts.siteK;
    if (opts.siteK != null) marker(ctx, cells[opts.siteK], '#c9d1e0', onLander ? '' : 'Lander');
    if (run) marker(ctx, cells[run.k], '#ffd166', 'Rover');
  }
  if (opts.scale !== false) scaleBar(ctx);
}
