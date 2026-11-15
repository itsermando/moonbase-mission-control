// CAPCOM tutorials: an interactive guide-through that points at the real interface, waits for the player to do each thing, and survives screen changes.
// Two parts: a pure step machine (condMet, Tour: testable without a browser) and a small DOM runner (bubble, spotlight ring, offer card).
// A mission registers its steps with registerTutorial(); steps only talk to the page through CSS selectors, so they never touch game state.
import { whiskersSVG } from './cat.js';

/* ------------------------------------------------------------------ pure logic */

/**
 * Is a condition true? `env` supplies q(sel) (element or null), text(sel), value(sel), seen(kind, what), screen().
 * Forms: undefined/true; 'css selector' (exists); function(env); [all]; { all|any|not|has|text|value|click|input|change|key|screen }.
 */
export function condMet(cond, env) {
  if (cond === undefined || cond === null || cond === true) return true;
  if (cond === false) return false;
  if (typeof cond === 'function') return !!cond(env);
  if (typeof cond === 'string') return !!env.q(cond);
  if (Array.isArray(cond)) return cond.every((c) => condMet(c, env));
  if (cond.all) return cond.all.every((c) => condMet(c, env));
  if (cond.any) return cond.any.some((c) => condMet(c, env));
  if ('not' in cond) return !condMet(cond.not, env);
  if (cond.has) return !!env.q(cond.has);
  if (cond.text) { const [sel, re] = cond.text; const t = env.text(sel); return t != null && new RegExp(re, 'i').test(t); }
  if (cond.value) { const [sel, test] = cond.value; const v = env.value(sel); return v != null && (typeof test === 'function' ? !!test(v) : String(v) === String(test)); }
  if (cond.click) return env.seen('click', cond.click);
  if (cond.input) return env.seen('input', cond.input);
  if (cond.change) return env.seen('change', cond.change);
  if (cond.key) return env.seen('key', cond.key);
  if ('screen' in cond) return Array.isArray(cond.screen) ? cond.screen.includes(env.screen?.()) : env.screen?.() === cond.screen;
  return false;
}

/**
 * The tour state machine. A step: { id, screen?, at?, show?, until?, skip?, say, sci?, hint?, min? }.
 * - screen: the mission screen it belongs to. If the player moves to another screen the tour jumps to that screen's first unfinished step, or parks.
 * - at: selector, function(env) -> element, or array of those: what to highlight.   show: condition to wait for before showing (default: `at` exists).
 * - until: condition that completes the step (a click, a typed value, a state). Without it the step has a Next button.   skip: condition that hides the step.
 */
export class Tour {
  constructor(steps, { minMs = 700, missingMs = 2500 } = {}) {
    this.steps = steps; this.idx = 0; this.done = new Set(); this.state = 'running'; this.minMs = minMs; this.missingMs = missingMs;
    this.readyAt = null; this.waitFrom = null; this.parked = false;
  }
  get step() { return this.steps[this.idx] || null; }
  get total() { return this.steps.length; }
  _enter(i, env) { this.idx = i; this.readyAt = null; this.waitFrom = null; env.resetSeen?.(); }
  _advance(env) { this.done.add(this.idx); this._enter(this.idx + 1, env); if (this.idx >= this.steps.length) this.state = 'finished'; }
  _on(step, cur) { if (step.screen == null || cur == null) return true; return Array.isArray(step.screen) ? step.screen.includes(cur) : step.screen === cur; }

  /** Re-evaluate against the page. Call about 5 times a second. Returns view(). */
  sync(env) {
    let guard = 0;
    this.parked = false;
    while (this.state === 'running' && guard++ < this.steps.length * 2 + 4) {
      const st = this.step;
      if (!st) { this.state = 'finished'; break; }
      const cur = env.screen?.();
      if (!this._on(st, cur)) {
        const j = this.steps.findIndex((s, i) => i !== this.idx && !this.done.has(i) && this._on(s, cur));
        if (j >= 0) { this._enter(j, env); continue; }
        this.parked = true; break;
      }
      if (st.skip !== undefined && condMet(st.skip, env)) { this._advance(env); continue; }
      if (!this._ready(st, env)) break;
      if (this.readyAt == null) this.readyAt = env.now();
      if (st.until !== undefined && env.now() - this.readyAt >= (st.min ?? this.minMs) && condMet(st.until, env)) { this._advance(env); continue; }
      break;
    }
    return this.view(env);
  }
  /** Ready to show: the `show` condition holds; or, with no `show`, the target exists (or it has been missing so long that we show the bubble without a ring). */
  _ready(st, env) {
    if (st.show !== undefined) return condMet(st.show, env);
    if (st.at === undefined || env.target(st.at)) { this.waitFrom = null; return true; }
    if (this.waitFrom == null) this.waitFrom = env.now();
    return env.now() - this.waitFrom >= this.missingMs;
  }
  view(env) {
    const st = this.step, ready = !!st && !this.parked && this.state === 'running' && this._ready(st, env);
    return { state: this.state, visible: ready, idx: this.idx, total: this.steps.length, step: st,
      canBack: this.idx > 0, manual: !!st && st.until === undefined, waiting: !!st && st.until !== undefined,
      ring: ready && st.at !== undefined && !!env.target(st.at) };
  }
  next(env) { if (this.state === 'running') this._advance(env); }
  back(env) {
    if (this.state !== 'running' || this.idx === 0) return;
    const i = this.idx - 1; for (let k = i; k < this.steps.length; k++) this.done.delete(k);
    this._enter(i, env);
  }
  exit() { this.state = 'exited'; }
}

/* ------------------------------------------------------------------ remembered state */

const KEY = 'com.tutorial.';
const read = (k) => { try { return localStorage.getItem(KEY + k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(KEY + k, v); } catch { /* storage blocked */ } };
const seenThisSession = (k) => { try { return sessionStorage.getItem(KEY + k) === '1'; } catch { return false; } };
const markSession = (k) => { try { sessionStorage.setItem(KEY + k, '1'); } catch { /* ignore */ } };
/** 'done' (finished), 'skipped' (declined or exited), or null (never offered). */
export const tutorialStatus = (mission) => read(mission);
export const resetTutorial = (mission) => { try { localStorage.removeItem(KEY + mission); } catch { /* ignore */ } };

/* ------------------------------------------------------------------ registry and runner */

let cfg = null, runner = null;
const $ = (s) => document.querySelector(s);
const lite = () => document.documentElement.dataset.quality === 'low';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * cfg: { mission, title, screen(): string, ctx?(): object, steps: [...], finale?: { say, chips: [kb ids] } }
 * say may be a function (ctx, env) -> string. Steps may use <b>, <i> and <span class="kbd"> in `say`.
 */
export function registerTutorial(c) {
  cfg = c;
  const go = () => { if (!offerWanted()) return; setTimeout(() => { if (!runner) showOffer(); }, 1400); };
  const p = new URLSearchParams(location.search).get('tutorial');
  if (p === '1') setTimeout(() => startTutorial(), 900);
  else if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
}
export const hasTutorial = () => !!cfg;
export const tutorialTitle = () => cfg?.title || 'tutorial';
export const tutorialRunning = () => !!runner;

function offerWanted() {
  if (!cfg || runner) return false;
  if (new URLSearchParams(location.search).get('tutorial') === 'offer') return true;
  if (navigator.webdriver) return false; // automated browsers never see the pop-up, so test scripts are not interrupted
  return read(cfg.mission) == null && !seenThisSession(`offer.${cfg.mission}`);
}

function showOffer() {
  if (document.getElementById('tut-offer') || !cfg) return;
  ensureCss();
  const d = document.createElement('div');
  d.id = 'tut-offer'; d.className = 'tut-offer'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Tutorial offer');
  d.innerHTML = `${whiskersSVG(40)}<div><b>CAPCOM can guide you through this mission.</b><p class="small">I will point at each control and explain the science as you play. About ${cfg.minutes || 4} minutes.</p>
    <div class="tut-row"><button type="button" class="primary" data-offer="start">Start tutorial</button><button type="button" data-offer="later">Not now</button><button type="button" class="tut-link" data-offer="never">Don’t ask again</button></div></div>`;
  d.onclick = (e) => {
    const b = e.target.closest('[data-offer]'); if (!b) return;
    d.remove();
    if (b.dataset.offer === 'start') startTutorial();
    else if (b.dataset.offer === 'never') write(cfg.mission, 'skipped');
    else markSession(`offer.${cfg.mission}`);
  };
  document.body.appendChild(d);
}

function ensureCss() {
  if (document.querySelector('link[data-tut-css]')) return;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./tutorial.css', import.meta.url).href; l.dataset.tutCss = ''; document.head.appendChild(l);
}

export function startTutorial() {
  if (!cfg) return false;
  document.getElementById('tut-offer')?.remove();
  stopTutorial(false);
  ensureCss();
  runner = new Runner(cfg);
  return true;
}
export function stopTutorial(remember = true) {
  if (!runner) return;
  const r = runner; runner = null; r.destroy();
  if (remember && read(cfg.mission) == null) write(cfg.mission, 'skipped');
}

class Runner {
  constructor(c) {
    this.cfg = c; this.events = []; this.sig = ''; this.lastIdx = -1;
    this.tour = new Tour(c.steps.map((s, i) => ({ id: s.id || `s${i}`, ...s })));
    this.env = {
      q: (sel) => this.q(sel), text: (sel) => this.q(sel)?.textContent ?? null, value: (sel) => this.q(sel)?.value ?? null, now: () => performance.now(),
      screen: () => c.screen?.() ?? null, target: (at) => this.target(at), resetSeen: () => { this.events = []; },
      seen: (kind, what) => this.events.some((e) => e.kind === kind && (kind === 'key' ? e.key === String(what).toLowerCase() : !!e.el?.closest?.(what))),
    };
    this.ring = document.createElement('div'); this.ring.className = 'tut-ring'; this.ring.hidden = true; this.ring.setAttribute('aria-hidden', 'true');
    this.box = document.createElement('section'); this.box.id = 'tut'; this.box.className = 'tut'; this.box.setAttribute('role', 'dialog'); this.box.setAttribute('aria-label', 'CAPCOM tutorial'); this.box.hidden = true;
    document.body.append(this.ring, this.box);
    this.onEvt = (e) => {
      if (e.target?.closest?.('#tut')) return;
      if (e.type === 'keydown') {
        if (e.key === 'Escape' && !document.getElementById('help-overlay') && document.getElementById('ask-panel')?.hidden !== false) { e.stopPropagation(); this.exit(); return; }
        this.events.push({ kind: 'key', key: String(e.key).toLowerCase() });
      } else this.events.push({ kind: e.type, el: e.target });
    };
    for (const t of ['click', 'input', 'change', 'keydown']) document.addEventListener(t, this.onEvt, true);
    this.box.onclick = (e) => {
      const b = e.target.closest('[data-tut]'); if (!b) return;
      const a = b.dataset.tut;
      if (a === 'exit') this.exit(); else if (a === 'next' || a === 'skip') { this.tour.next(this.env); this.tick(); }
      else if (a === 'back') { this.tour.back(this.env); this.tick(); }
      else if (a === 'ask') document.dispatchEvent(new CustomEvent('capcom:ask', { detail: { open: true, chips: this.cfg.chips } }));
      else if (a === 'close') this.finish(true);
    };
    this.onLayout = () => this.place();
    addEventListener('resize', this.onLayout); addEventListener('scroll', this.onLayout, true);
    this.timer = setInterval(() => this.tick(), 200);
    this.tick();
  }
  q(sel) { try { const el = document.querySelector(sel); return el && (el.getClientRects().length || el.closest('details')) ? el : null; } catch { return null; } }
  target(at) {
    const list = Array.isArray(at) ? at : [at];
    for (const a of list) {
      let el = null;
      try { el = typeof a === 'function' ? a(this.env) : this.q(a); } catch { el = null; }
      if (el && el.isConnected && el.getClientRects().length) return el;
    }
    return null;
  }
  say(st) { try { return typeof st.say === 'function' ? st.say(this.cfg.ctx?.() ?? {}, this.env) : st.say; } catch { return ''; } }

  tick() {
    if (!runner || runner !== this) return;
    const v = this.tour.sync(this.env);
    if (v.state === 'finished') { this.finish(false); return; }
    if (v.state === 'exited') { this.exit(); return; }
    const askOpen = document.getElementById('ask-panel')?.hidden === false;
    if (!v.visible || askOpen) { this.box.hidden = true; this.ring.hidden = true; this.sig = ''; return; }
    const st = v.step, text = this.say(st);
    const sig = `${v.idx}|${text}|${v.waiting}|${v.ring}`;
    if (sig !== this.sig) {
      this.sig = sig; this.box.hidden = false;
      const pct = Math.round((v.idx / v.total) * 100), last = v.idx === v.total - 1;
      this.box.innerHTML = `<div class="tut-head">${whiskersSVG(40)}<div><b>CAPCOM Whiskers</b><small>${esc(this.cfg.title)} · step ${v.idx + 1} of ${v.total}</small></div>
        <button type="button" class="tut-x" data-tut="exit" aria-label="Exit tutorial" title="Exit (Esc)">×</button></div>
        <div class="tut-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <p class="tut-say">${text}</p>
        ${st.sci ? `<p class="tut-sci"><b>The science:</b> ${typeof st.sci === 'function' ? st.sci(this.cfg.ctx?.() ?? {}, this.env) : st.sci}</p>` : ''}
        ${v.waiting ? `<p class="tut-wait"><span class="tut-dot" aria-hidden="true"></span>${st.hint || 'Try it on the screen, then I will move on.'}</p>` : ''}
        <div class="tut-row"><button type="button" data-tut="back" ${v.canBack ? '' : 'disabled'}>Back</button><button type="button" data-tut="ask">Ask a question</button><span class="tut-grow"></span>
        ${v.waiting ? '<button type="button" data-tut="skip">Skip step</button>' : `<button type="button" class="primary" data-tut="next">${last ? 'Finish' : 'Next'}</button>`}</div>`;
      if (v.idx !== this.lastIdx) { this.lastIdx = v.idx; this.reveal(v, st); }
    }
    this.place();
  }
  reveal(v, st) {
    const el = v.ring ? this.target(st.at) : null; if (!el) return;
    const r = el.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < 70 || r.top > vh - 70) el.scrollIntoView({ block: 'center', behavior: lite() ? 'auto' : 'smooth' });
  }
  place() {
    if (this.box.hidden) { this.ring.hidden = true; return; }
    const st = this.tour.step, el = st && st.at !== undefined ? this.target(st.at) : null, vw = innerWidth, vh = innerHeight;
    this.box.classList.toggle('sheet', vw < 720);
    if (!el) { this.ring.hidden = true; this.box.style.cssText = ''; return; }
    const r = el.getBoundingClientRect();
    this.ring.hidden = false;
    Object.assign(this.ring.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    if (vw < 720) { this.box.style.cssText = ''; return; }
    const bw = this.box.offsetWidth, bh = this.box.offsetHeight, gap = 16;
    let left = Math.max(8, Math.min(vw - bw - 8, r.left)), top;
    if (r.height > vh * 0.55 || r.width > vw * 0.9 && r.height > vh * 0.4) { this.box.style.cssText = ''; return; } // huge target: keep the default corner
    if (r.bottom + gap + bh <= vh - 8) top = r.bottom + gap;
    else if (r.top - gap - bh >= 8) top = r.top - gap - bh;
    else if (r.right + gap + bw <= vw - 8) { left = r.right + gap; top = Math.max(8, Math.min(vh - bh - 8, r.top)); }
    else if (r.left - gap - bw >= 8) { left = r.left - gap - bw; top = Math.max(8, Math.min(vh - bh - 8, r.top)); }
    else { this.box.style.cssText = ''; return; }
    Object.assign(this.box.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
  }
  exit() { stopTutorial(true); }
  finish(fromButton) {
    if (!runner) return;
    const c = this.cfg; runner = null; this.destroy();
    if (!fromButton) {
      write(c.mission, 'done');
      const d = document.createElement('div'); d.className = 'tut-offer tut-done'; d.id = 'tut-offer';
      d.innerHTML = `${whiskersSVG(40)}<div><b>Tutorial complete.</b><p class="small">${c.finale?.say || 'Ask me anything about this mission.'}</p>
        <div class="tut-row"><button type="button" class="primary" data-offer="ask">Ask CAPCOM</button><button type="button" data-offer="close">Close</button></div></div>`;
      d.onclick = (e) => {
        const b = e.target.closest('[data-offer]'); if (!b) return;
        d.remove(); if (b.dataset.offer === 'ask') document.dispatchEvent(new CustomEvent('capcom:ask', { detail: { open: true, say: c.finale?.say, chips: c.chips } }));
      };
      ensureCss(); document.body.appendChild(d);
      document.dispatchEvent(new CustomEvent('capcom:ask', { detail: { open: false, say: c.finale?.say, chips: c.chips, quiet: true } }));
    }
  }
  destroy() {
    clearInterval(this.timer);
    for (const t of ['click', 'input', 'change', 'keydown']) document.removeEventListener(t, this.onEvt, true);
    removeEventListener('resize', this.onLayout); removeEventListener('scroll', this.onLayout, true);
    this.ring.remove(); this.box.remove();
  }
}
