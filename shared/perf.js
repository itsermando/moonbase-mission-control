// Graphics quality for slower laptops. One setting, shared by every 3D view and the page effects.
//   auto (default): sharp but cheap (resolution up to 1.5x, soft shadows, 60 fps). If the device stays below about 28 fps, it drops to Lite by itself.
//   high: full resolution (up to 2x), larger shadow maps, all effects.
//   low ("Lite"): 1x resolution, no shadows, no antialiasing on new views, 30 fps cap, no animated backgrounds or blur.
// The choice is stored in this browser only. Renderers call onChange() to apply a new level live.
const KEY = 'com.quality.v1', MODES = ['auto', 'high', 'low'];
let mode = 'auto', degraded = false;
try { const v = localStorage.getItem(KEY); if (MODES.includes(v)) mode = v; } catch { /* storage blocked: stay on auto */ }
const subs = new Set();

export const getMode = () => mode;
export const isDegraded = () => degraded;
/** 'high' | 'medium' | 'low': what is actually in use right now */
export const level = () => (mode === 'high' ? 'high' : mode === 'low' || degraded ? 'low' : 'medium');
export const pixelRatio = () => { const d = window.devicePixelRatio || 1, l = level(); return l === 'high' ? Math.min(2, d) : l === 'medium' ? Math.min(1.5, d) : 1; };
export const useShadows = () => level() !== 'low';
export const useAntialias = () => level() !== 'low';
export const shadowMapSize = () => (level() === 'high' ? 2048 : 1024);
export const softShadows = () => level() === 'high';

export function onChange(fn) { subs.add(fn); return () => subs.delete(fn); }

const style = document.createElement('style');
style.textContent = `html[data-quality="low"] *, html[data-quality="low"] *::before, html[data-quality="low"] *::after { animation: none !important; transition: none !important; }
html:not([data-quality="high"]) *, html:not([data-quality="high"]) *::before { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`;
document.head.appendChild(style);

function apply() {
  document.documentElement.dataset.quality = level();
  subs.forEach((f) => { try { f(); } catch { /* a view that is already gone */ } });
}
apply();

export function setMode(m) {
  if (!MODES.includes(m)) return;
  mode = m; degraded = false;
  try { localStorage.setItem(KEY, m); } catch { /* storage blocked */ }
  apply();
}

function degrade() {
  if (degraded || mode !== 'auto') return;
  degraded = true; apply();
  window.dispatchEvent(new CustomEvent('quality-degraded'));
}

/**
 * One per render loop. Call render(timestamp) at the top of every animation frame:
 * it returns false when this frame should be skipped (tab hidden, or Lite's 30 fps cap) and,
 * in Auto, watches the frame rate and switches to Lite when it stays low.
 */
export class Governor {
  constructor() { this.last = 0; this.warm = 0; this.n = 0; this.sum = 0; this.slow = 0; }
  render(now = performance.now()) {
    if (document.hidden) { this.last = 0; return false; }
    if (this.last && level() === 'low' && now - this.last < 30) return false;
    const gap = this.last ? now - this.last : 0;
    this.last = now;
    if (mode === 'auto' && !degraded && gap > 0 && gap < 400) { // longer gaps are tab switches, not slowness
      if (this.warm < 90) this.warm++; // shader compiling and texture decoding make the first frames slow
      else {
        this.sum += gap;
        if (++this.n === 90) { if (this.sum / 90 > 36) { if (++this.slow >= 2) degrade(); } else this.slow = 0; this.sum = 0; this.n = 0; }
      }
    }
    return true;
  }
}
