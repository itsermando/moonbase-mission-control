// The game shell: one top HUD on every page (logo, campaign track, crew, XP, world, sound, help),
// a level-up celebration and a keyboard-shortcut overlay.
import { catSVG } from './cat.js';
import { getCrew, levelOf } from './profile.js';
import { getWorld, getMission, isClassMode, campaignScore } from './campaign.js';
import { MISSIONS } from './worlds.js';
import { isMuted, setMuted, sfx, toast } from './fx.js';

let opts = { base: '', mission: null, shortcuts: [] };

const MEDAL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', none: 'Flown' };

export function mountShell(o = {}) {
  opts = { ...opts, ...o };
  let el = document.getElementById('shell');
  if (!el) { el = document.createElement('header'); el.id = 'shell'; document.body.prepend(el); }
  renderShell();
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
  el.className = 'shell';
  el.innerHTML = `
    <a class="logo" href="${b}index.html" aria-label="Cat on Moon home">${catSVG(0, 34, { title: 'Cat on Moon' })}<span><b>Cat on Moon</b><small>Mission Control</small></span></a>
    <nav class="track" aria-label="Campaign missions">${track}</nav>
    <span class="chip world" title="${world.tierLabel}">${world.name}${isClassMode() ? ' · Class mode' : ''}</span>
    <span class="score-chip" title="Campaign score">${campaignScore(world.id)} <small>/ ${world.missions.length * 100}</small></span>
    <a class="crew" href="${b}profile.html" title="Crew and profiles">
      ${crew.length ? crew.map((p) => catSVG(p.avatar, 30, { title: p.name })).join('') : '<span class="add">+ Create player</span>'}
      ${lv ? `<span class="xp"><b>${lead.name}</b> <small>Lv ${lv.level} ${lv.rank}</small><span class="xpbar"><i style="width:${lv.max ? 100 : Math.round((lv.into / lv.span) * 100)}%"></i></span></span>` : ''}
    </a>
    <button class="icon" id="sh-sound" aria-pressed="${!isMuted()}" title="Sound">${isMuted() ? 'Sound off' : 'Sound on'}</button>
    <a class="icon" href="${b}about.html" title="Briefing Room: for judges and teachers">Briefing Room</a>
    <button class="icon" id="sh-help" title="Keyboard shortcuts (?)">?</button>`;
  el.querySelector('#sh-sound').onclick = (e) => { setMuted(!isMuted()); e.target.textContent = isMuted() ? 'Sound off' : 'Sound on'; e.target.setAttribute('aria-pressed', String(!isMuted())); sfx.click(); };
  el.querySelector('#sh-help').onclick = toggleHelp;
}

function toggleHelp() {
  const old = document.getElementById('help-overlay');
  if (old) { old.remove(); return; }
  const rows = [['?', 'Show or hide this help'], ['Esc', 'Close pop-ups'], ...opts.shortcuts];
  const d = document.createElement('div'); d.id = 'help-overlay'; d.className = 'modal-bg';
  d.innerHTML = `<div class="panel modal pop" role="dialog" aria-label="Keyboard shortcuts"><h2>Keyboard shortcuts</h2>
    <table class="keys">${rows.map(([k, v]) => `<tr><td><span class="kbd">${k}</span></td><td>${v}</td></tr>`).join('')}</table>
    <button class="primary" id="help-close">Got it</button></div>`;
  document.body.appendChild(d);
  d.onclick = (e) => { if (e.target === d || e.target.id === 'help-close') d.remove(); };
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
