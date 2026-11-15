// Explanations everywhere: hover / focus / tap tooltips, an automatic glossary, and a Why-How-What tree diagram.
// - Any element with data-tip="..." shows a tooltip (mouse hover, keyboard focus, or a tap on touch screens).
// - Labels that name a known space word (Periapsis, Δv, Swath ...) get a tooltip automatically, on every page.
// - treeHTML-style diagrams: whyTree() draws WHAT -> HOW -> WHY as a real branching diagram.
// Pure string builders plus one small DOM layer; no libraries.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Plain-language glossary: key = words to look for in a label (lower case), value = explanation.
export const WORDS = [
  [['periapsis', ' pe '], 'Periapsis: the lowest point of an orbit. The satellite moves fastest here.'],
  [['apoapsis', ' ap '], 'Apoapsis: the highest point of an orbit. The satellite moves slowest here and lingers over what is below.'],
  [['inclination'], 'Inclination: how tilted the orbit is. 90° passes over both poles; 0° follows the equator.'],
  [['argument of periapsis', 'ω'], 'Argument of periapsis ω: where along the orbit the lowest point sits. It decides which pole gets the slow, high part.'],
  [['semi-major axis'], 'Semi-major axis: half the long width of the ellipse. It alone sets how long one lap takes.'],
  [['eccentricity'], 'Eccentricity: 0 is a circle; near 1 is a long, thin ellipse.'],
  [['period'], 'Period: the time for one full lap of the orbit.'],
  [['δv', 'delta-v', 'brake burn', 'brake δv'], 'Δv (delta-v): the change in speed the engine must make. Fuel grows exponentially with Δv (the rocket equation).'],
  [['fuel'], 'Fuel is sized by the rocket equation: the bigger the Δv and the heavier the satellite, the more fuel.'],
  [['dry mass'], 'Dry mass: the satellite without fuel. Every extra kilogram needs extra fuel too.'],
  [['launch mass', 'rocket capacity'], 'Launch mass (satellite + fuel) must fit the rocket’s capacity.'],
  [['budget', 'cost'], 'Cost of the rocket and every part. The mission budget is fixed.'],
  [['power'], 'Electrical power in watts (W): what the solar wings make vs. what the computer, radio and instruments use.'],
  [['contact with base', 'contact goal', 'coverage', 'contacts in'], 'Contact: the share of time the base can see the relay satellite high enough above its horizon to talk to Earth.'],
  [['longest gap', 'gap'], 'Gap: the longest wait between two contact windows. The rover is on its own during gaps.'],
  [['mean contact', 'contact length'], 'Mean contact: how long one pass of the satellite lasts on average.'],
  [['escape speed'], 'Escape speed: above it, gravity can’t hold you and you fly away for good.'],
  [['gravity parameter', 'gm'], 'GM: the world’s mass times the gravitational constant. Bigger GM = stronger pull = faster orbits.'],
  [['arrival speed', 'v∞'], 'v∞ (v-infinity): how fast the spacecraft approaches the world before its gravity speeds it up.'],
  [['sidereal'], 'Sidereal: one turn measured against the distant stars.'],
  [['ground sample', 'gsd', 'pixel size'], 'Ground sample distance: the size one camera pixel covers on the ground. Smaller is sharper.'],
  [['swath'], 'Swath: the width of the strip of ground the instrument sees on each pass.'],
  [['eclipse', 'in shadow'], 'Eclipse: time the satellite spends in the world’s shadow, with no sunlight for the solar wings.'],
  [['data rate'], 'Data rate: how many bits per second the radio link can carry.'],
  [['go / no-go', 'go/no-go'], 'Go / no-go: the checklist flight controllers run before a burn. Every item must be GO.'],
  [['shield'], 'Radiation shielding protects the computer from solar storms that can flip bits and force a reset.'],
  [['battery'], 'Battery: stored energy. It runs the rover when the Sun is down or the panels are shaded.'],
  [['slope'], 'Slope: how steep the ground is. Wheels slip above about 15–20°.'],
  [['regolith'], 'Regolith: the loose, dusty soil that covers the Moon.'],
  [['cold trap'], 'Cold trap: a crater floor that never sees sunlight, cold enough to keep water ice for billions of years.'],
  [['parity'], 'Parity bit: one extra bit that makes the count of 1s even, so a single flipped bit can be detected.'],
  [['compression'], 'Compression: sending fewer bits for the same data. Faster, but more fragile and sometimes less detailed.'],
  [['light delay', 'signal delay', 'light time'], 'Light delay: radio travels at the speed of light, so a message to the Moon takes about 1.3 s, to Mars 3–22 min.'],
  [['dsn', 'deep space network'], 'NASA Deep Space Network: giant antennas in Goldstone (USA), Madrid (Spain) and Canberra (Australia) that talk to spacecraft.'],
  [['noise'], 'Noise: random radio interference that flips some bits from 0 to 1 or back. Farther worlds mean weaker signals and more noise.'],
  [['bits to type', 'bits'], 'Bits: the 0s and 1s every message is made of. More bits take more time to send.'],
  [['contact window'], 'Contact window: the time the relay satellite is in view, so data can flow. Set by your Mission 1 orbit.'],
  [['data from the rover', 'packets'], 'Data packets: the rover’s photos, logs and measurements, split into chunks to send home.'],
  [['science if all arrives'], 'The science points you earn if every packet reaches Earth undamaged.'],
  [['mass on the lander'], 'The lander can only carry so much: every part of the rover counts against this limit.'],
  [['money'], 'Cost of the rover parts and tests, against the mission budget.'],
  [['water'], 'Water ice extracted from the soil: drinking water, air and rocket fuel for astronauts.'],
  [['samples'], 'Rock samples sealed in tubes, like the ones Perseverance collects for return to Earth.'],
  [[' xp '], 'XP: experience points for your crew profile. Earn them by flying missions.'],
];

/** The tooltip text for a label, or null. */
export function tipFor(text) {
  const t = ` ${String(text || '').toLowerCase().trim()} `;
  if (t.length > 60) return null; // only short labels, not paragraphs
  for (const [keys, tip] of WORDS) if (keys.some((k) => t.includes(k))) return tip;
  return null;
}

/** A small ⓘ badge with a tooltip, for use inside templates. */
export const info = (tip) => `<span class="ix" tabindex="0" role="note" data-tip="${esc(tip)}" aria-label="${esc(tip)}">i</span>`;

/**
 * Why-How-What diagram. root: { what, tone? , detail? }, branches: [{ how, detail?, tone?, why: [{ text, tone? }] }].
 * Draws WHAT at the top, one column per HOW, and the WHY leaves under each.
 */
export function whyTree({ title = '', what, whatDetail = '', tone = '', branches = [], labels = ['WHAT', 'HOW', 'WHY'] }) {
  const node = (k, t, d, tn) => `<div class="wt-node ${tn || ''}"><span class="wt-k">${esc(k)}</span><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ''}</div>`;
  return `<figure class="wt" aria-label="${esc(title || 'Why, how and what diagram')}">
    ${title ? `<figcaption>${esc(title)}</figcaption>` : ''}
    <ul class="wt-tree"><li>${node(labels[0], what, whatDetail, `root ${tone}`)}
      <ul>${branches.map((b) => `<li>${node(labels[1], b.how, b.detail, b.tone)}
        ${b.why?.length ? `<ul>${b.why.map((w) => `<li>${node(labels[2], w.text, w.detail, w.tone)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul></li></ul></figure>`;
}

/**
 * Consequence chain: a row of boxes joined by arrows, e.g. choice -> mass -> fuel -> rocket.
 * steps: [{ k: 'label', v: 'value', tone?, tip? }]
 */
export function chainHTML(steps, aria = 'Consequence chain') {
  return `<div class="cchain" role="list" aria-label="${esc(aria)}">${steps.map((s, n) => `${n ? '<i class="cc-arrow" aria-hidden="true">→</i>' : ''}<div class="cc-box ${s.tone || ''}" role="listitem" ${s.tip ? `data-tip="${esc(s.tip)}" tabindex="0"` : ''}><small>${esc(s.k)}</small><b>${esc(s.v)}</b></div>`).join('')}</div>`;
}

/* ------------------------------------------------------------------ browser layer */

let box = null, cur = null;
const AUTO = '.gauge > span, .meter .lbl > span, .lbl, .readout td:first-child, .gng b, .el-row > span, .stat .lbl, th, .mx-topic span:last-child, .chips span, dt';

function place(el) {
  const r = el.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
  let left = Math.min(innerWidth - bw - 8, Math.max(8, r.left + r.width / 2 - bw / 2));
  let top = r.top - bh - 10;
  if (top < 8) top = r.bottom + 10;
  box.style.left = `${left}px`; box.style.top = `${top}px`;
}
function show(el) {
  const t = el.getAttribute('data-tip'); if (!t) return;
  cur = el; box.textContent = t; box.hidden = false; place(el);
}
function hide() { if (box) box.hidden = true; cur = null; }

function autoTip(root = document) {
  root.querySelectorAll(AUTO).forEach((el) => {
    if (el.hasAttribute('data-tip') || el.dataset.noTip != null || el.closest('[data-tip]')) return;
    const tip = tipFor(el.textContent); if (!tip) return;
    el.setAttribute('data-tip', tip); el.classList.add('has-tip');
    if (!el.matches('button, a, input')) el.tabIndex = 0;
  });
}

export function initExplain() {
  if (typeof document === 'undefined' || box) return;
  if (!document.querySelector('link[data-explain-css]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./explain.css', import.meta.url).href; l.dataset.explainCss = ''; document.head.appendChild(l);
  }
  box = document.createElement('div'); box.className = 'xtip'; box.setAttribute('role', 'tooltip'); box.hidden = true; document.body.appendChild(box);
  document.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const el = e.target.closest?.('[data-tip]'); if (el) show(el); else if (cur) hide(); });
  document.addEventListener('focusin', (e) => { const el = e.target.closest?.('[data-tip]'); if (el) show(el); });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', (e) => { // tap on touch screens toggles
    if (e.pointerType !== 'touch') return;
    const el = e.target.closest?.('[data-tip]');
    if (el && el !== cur) show(el); else hide();
  });
  addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => autoTip(), 120); }).observe(document.body, { childList: true, subtree: true });
  autoTip();
}
