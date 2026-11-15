// The game shell: one top HUD on every page (logo, campaign track, crew, XP, world, sound, help),
// a level-up celebration and a keyboard-shortcut overlay.
import { catSVG } from './cat.js';
import { getCrew, levelOf } from './profile.js';
import { getWorld, getMission, isClassMode, campaignScore } from './campaign.js';
import { MISSIONS } from './worlds.js';
import { isMuted, setMuted, sfx, toast } from './fx.js';
import { mountAsk } from './ask.js';
import { initExplain } from './explain.js';
import { getMode, setMode, isDegraded } from './perf.js';
import { initMusic, isMusicOn, isPlaying, setMusic, setAudioBase, startMusic, stopMusic } from './music.js';

let opts = { base: '', mission: null, shortcuts: [] };

const MEDAL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', none: 'Flown' };

export function mountShell(o = {}) {
  opts = { ...opts, ...o };
  let el = document.getElementById('shell');
  if (!el) { el = document.createElement('header'); el.id = 'shell'; document.body.prepend(el); }
  renderShell();
  initExplain();
  setAudioBase(opts.base); initMusic();
  mountAsk({ mission: opts.mission || 'all', getWorld });
  window.addEventListener('quality-degraded', () => toast('This device looked busy, so graphics switched to Lite for smoother play. Change it under ? > Graphics.', 'info', 8000));
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !e.target.closest?.('input,textarea')) toggleHelp();
    if (e.key === 'Escape') document.getElementById('help-overlay')?.remove();
  });
}

export function renderShell() {
  const el = document.getElementById('shell'); if (!el) return;
  const b = opts.base, world = getWorld(), crew = getCrew();
  const lead = crew[0];
  const lv = lead ? levelOf(lead.xp) : null;
  const track = world.missions.map((m) => {
    const res = getMission(world.id, m), M = MISSIONS[m];
    const state = res ? res.medal : 'todo';
    return `<a class="node ${opts.mission === m ? 'now' : ''} m-${state}" href="${b}${M.href}" title="${M.long}${res ? ` · best ${res.best}` : ''}">
      <span class="dot">${M.n}</span><span class="nm">${M.title}</span>${res ? `<span class="medal ${res.medal}" aria-label="${MEDAL[res.medal]}"></span>` : ''}</a>`;
  }).join('<span class="link" aria-hidden="true"></span>');
  const done = world.missions.filter((m) => getMission(world.id, m)).length;
  const here = (p) => (opts.page === p ? 'now' : '');
  const hq = `<a class="node hq ${here('hub')}" href="${b}hub.html" title="Mission Control: choose a world, crew and mission"><span class="dot" aria-hidden="true">⌂</span><span class="nm">HQ</span></a>`;
  const sum = `<a class="node sum ${here('summary')} ${done === world.missions.length ? 'm-gold' : ''}" href="${b}summary.html" title="Campaign summary: how each mission fed the next (${done} of ${world.missions.length} flown)"><span class="dot" aria-hidden="true">★</span><span class="nm">Summary</span></a>`;
  const navTrack = `${hq}<span class="link" aria-hidden="true"></span>${track}<span class="link" aria-hidden="true"></span>${sum}`;
  el.className = 'shell';
  el.innerHTML = `
    <a class="logo" href="${b}index.html" aria-label="Lunevra home">${catSVG(0, 34, { title: 'Lunevra' })}<span><b>Lunevra</b><small>by Cat on Moon</small></span></a>
    <nav class="track" aria-label="Campaign: HQ, missions and summary">${navTrack}</nav>
    <span class="chip world" title="${world.tierLabel}">${world.name}${isClassMode() ? ' · Class mode' : ''}</span>
    <span class="score-chip" title="Campaign score">${campaignScore(world.id)} <small>/ ${world.missions.length * 100}</small></span>
    <a class="crew" href="${b}profile.html" title="Crew and profiles">
      ${crew.length ? crew.map((p) => catSVG(p.avatar, 30, { title: p.name })).join('') : '<span class="add">+ Create player</span>'}
      ${lv ? `<span class="xp"><b>${lead.name}</b> <small>Lv ${lv.level} ${lv.rank}</small><span class="xpbar"><i style="width:${lv.max ? 100 : Math.round((lv.into / lv.span) * 100)}%"></i></span></span>` : ''}
    </a>
    <button class="icon" id="sh-sound" aria-pressed="${!isMuted()}" title="Sound">${isMuted() ? 'Sound off' : 'Sound on'}</button>
    <button class="icon" id="sh-music" data-music aria-pressed="${isMusicOn()}" title="Original ambient soundtrack">${isMusicOn() ? 'Music on' : 'Music off'}</button>
    <a class="icon" href="${b}about.html" title="Briefing Room: for judges and teachers">Briefing Room</a>
    <button class="icon" id="sh-help" title="Keyboard shortcuts (?)">?</button>`;
  el.querySelector('#sh-sound').onclick = (e) => { setMuted(!isMuted()); e.target.textContent = isMuted() ? 'Sound off' : 'Sound on'; e.target.setAttribute('aria-pressed', String(!isMuted())); sfx.click(); if (isMuted()) stopMusic(); else if (isMusicOn()) startMusic(); };
  el.querySelector('#sh-music').onclick = (e) => { const v = !(isMusicOn() && isPlaying()); setMusic(v); e.target.textContent = v ? 'Music on' : 'Music off'; e.target.setAttribute('aria-pressed', String(v)); };
  el.querySelector('#sh-help').onclick = toggleHelp;
}

const GFX = [['auto', 'Auto', 'Sharp and smooth, and drops to Lite by itself if your device struggles.'], ['high', 'High', 'Full resolution, large soft shadows and all effects. Needs a good graphics card.'], ['low', 'Lite', 'Lower resolution, no shadows, no animated backgrounds, 30 frames per second. Best for older laptops.']];

function toggleHelp() {
  const old = document.getElementById('help-overlay');
  if (old) { old.remove(); return; }
  const rows = [['?', 'Show or hide this help'], ['/', 'Ask CAPCOM a question'], ['Esc', 'Close pop-ups'], ...opts.shortcuts];
  const d = document.createElement('div'); d.id = 'help-overlay'; d.className = 'modal-bg';
  d.innerHTML = `<div class="panel modal pop" role="dialog" aria-label="Keyboard shortcuts"><h2>Keyboard shortcuts</h2>
    <table class="keys">${rows.map(([k, v]) => `<tr><td><span class="kbd">${k}</span></td><td>${v}</td></tr>`).join('')}</table>
    <h2>Graphics</h2>
    <div class="seg" role="radiogroup" aria-label="Graphics quality">${GFX.map(([id, name]) => `<button type="button" role="radio" data-gfx="${id}" aria-checked="${getMode() === id}" class="${getMode() === id ? 'on' : ''}">${name}</button>`).join('')}</div>
    <p class="small muted" id="gfx-note"></p>
    <button class="primary" id="help-close">Got it</button></div>`;
  document.body.appendChild(d);
  const note = () => { d.querySelector('#gfx-note').textContent = `${GFX.find(([id]) => id === getMode())[2]}${getMode() === 'auto' && isDegraded() ? ' (Lite is on right now because the device looked busy.)' : ''}`; };
  note();
  d.onclick = (e) => {
    const g = e.target.closest('[data-gfx]');
    if (g) { setMode(g.dataset.gfx); d.querySelectorAll('[data-gfx]').forEach((b) => { const on = b === g; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); note(); return; }
    if (e.target === d || e.target.id === 'help-close') d.remove();
  };
}

/** Celebrate an awardRun() result: XP toast, level-up banner, new badges. */
export function celebrate(result) {
  if (!result?.changes?.length) { toast('Create a player profile to earn XP and badges.', 'info', 5000); return; }
  toast(`+${result.xp} XP for the crew${result.medal !== 'none' ? ` · ${MEDAL[result.medal]} medal` : ''}`, 'good', 5000);
  for (const c of result.changes) {
    if (c.levelUp) {
      const d = document.createElement('div'); d.className = 'levelup';
      d.innerHTML = `<div class="pop">${catSVG(0, 64)}<b>${c.name} reached level ${c.levelUp.level}</b><span>${c.levelUp.rank}</span></div>`;
      document.body.appendChild(d); setTimeout(() => d.remove(), 3200);
    }
    c.newBadges.forEach((bdg) => toast(`${c.name} earned the badge “${bdg}”`, 'good', 5000));
  }
  renderShell();
}

/** Coach marks: a short first-time tutorial, shown once per mission per browser. */
export function coachOnce(key, steps) {
  try { if (localStorage.getItem('com.coach.' + key)) return; localStorage.setItem('com.coach.' + key, '1'); } catch { return; }
  let i = 0;
  const d = document.createElement('div'); d.className = 'coach';
  const show = () => {
    d.innerHTML = `<div class="panel pop">${catSVG(0, 48, { title: 'CAPCOM Whiskers' })}<div><b>CAPCOM Whiskers</b><p>${steps[i]}</p>
      <div class="row"><button class="primary" id="coach-next">${i < steps.length - 1 ? 'Next' : 'Let’s go'}</button><button id="coach-skip">Skip</button><span class="small muted">${i + 1}/${steps.length}</span></div></div></div>`;
    d.querySelector('#coach-next').onclick = () => { i++; if (i < steps.length) show(); else d.remove(); };
    d.querySelector('#coach-skip').onclick = () => d.remove();
  };
  document.body.appendChild(d); show();
}
