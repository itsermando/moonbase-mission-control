// Landing page behaviour: the live Moon globe with a relay orbit, lazy planet textures, cat crew, "Continue" button.
import { catSVG } from './cat.js';
import { WORLDS } from './worlds.js';

const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cat crew
document.querySelectorAll('[data-cat]').forEach((el) => { el.innerHTML = catSVG(Number(el.dataset.cat), 130); });

// Returning players: say "Continue" instead of "Play"
try {
  const camp = JSON.parse(localStorage.getItem('com.campaign.v1') || 'null');
  const flown = camp && Object.values(camp.results || {}).some((w) => w && Object.keys(w).length);
  if (flown) document.querySelectorAll('[data-play]').forEach((a) => { if (a.textContent.trim() === 'Play now') a.textContent = 'Continue'; else if (a.textContent.trim() === 'Play the game') a.textContent = 'Continue your campaign'; });
} catch { /* storage blocked: keep the default labels */ }

// Planet textures load only when scrolled into view (they are large NASA mosaics)
const planets = document.querySelectorAll('.planet[data-tex]');
// a url() inside a CSS variable resolves against the stylesheet (in shared/), so make it absolute from the page first
const loadTex = (el) => { el.style.setProperty('--tex', `url(${new URL(el.dataset.tex, document.baseURI).href})`); };
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { loadTex(e.target); io.unobserve(e.target); } }), { rootMargin: '200px' });
  planets.forEach((p) => io.observe(p));
} else planets.forEach(loadTex);

// Hero: the game's own globe and orbit maths
const moon = WORLDS.moon;
function showFallback() {
  const f = $('#hero-fallback'); if (!f) return;
  f.style.backgroundImage = `url(${moon.texture})`; f.hidden = false;
}
Promise.all([import('./globe.js'), import('../missions/orbit/orbit.js')]).then(([{ Globe }, O]) => {
  const g = new Globe($('#hero-globe'), { world: moon, base: '', autoRotate: reduce ? 0 : 0.12, controls: false });
  const el = O.elements({ periAltKm: 400, apoAltKm: 1500, incDeg: 65, argpDeg: 90 }, moon);
  const toGlobe = (p) => [p[0] / moon.radiusKm, p[2] / moon.radiusKm, -p[1] / moon.radiusKm];
  g.setSite(moon.site.latDeg);
  g.setPlannerOrbit(O.orbitPath(el).map(toGlobe), toGlobe(O.periapsisPos(el)), toGlobe(O.apoapsisPos(el)));
  g.frame((el.ra / moon.radiusKm) * 3.3); // far enough that the whole ring fits in the 40° field of view
  let t = 0;
  g.onFrame = (dt) => { if (!reduce) t += (dt * el.T) / 14; g.setSat(toGlobe(O.positionAt(el, t))); };
  g.setSat(toGlobe(O.positionAt(el, 0)));
}).catch(showFallback);

// "Real hardware" showcase: the NASA 3D models load only when the section scrolls into view
const hangar = $('#hangar-mv');
if (hangar) {
  new IntersectionObserver((e, io) => {
    if (!e[0].isIntersecting) return;
    io.disconnect();
    import('./models.js').then(({ mountViewer }) => mountViewer(hangar, ['saturn-v', 'lro', 'perseverance', 'rassor', 'apollo-lm', 'dsn-70m'], { height: 320 }))
      .catch(() => { hangar.innerHTML = '<p class="small muted">The 3D models need an internet connection.</p>'; });
  }, { rootMargin: '200px' }).observe(hangar);
}

// Ask CAPCOM works on the landing page too, so a first-time visitor can ask what the game is about
import('./campaign.js').then(({ getWorld }) => import('./ask.js').then(({ mountAsk }) => mountAsk({ mission: 'all', getWorld, plain: true }))).catch(() => {});
