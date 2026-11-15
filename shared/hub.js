// Mission Control hub: hero globe, solar-system map, campaign track, crew and class mode.
import { WORLDS, MISSIONS, lightDelayText } from './worlds.js';
import { getWorld, setWorld, getMission, isClassMode, setClassMode, campaignScore } from './campaign.js';
import { listProfiles, getCrew, toggleCrew, createProfile, levelOf, ROLES, AVATARS } from './profile.js';
import { mountShell, renderShell } from './shell.js';
import { catSVG, AVATAR_NAMES } from './cat.js';
import { sfx } from './fx.js';
import { setMusic, isMusicOn, isPlaying } from './music.js';
import { aiEnabled, setAiEnabled } from './llm.js';

const $ = (s) => document.querySelector(s);
let globe = null, layer = 'imagery';

mountShell({ base: '', mission: null });
{
  const pm = document.getElementById('play-music');
  const label = () => { if (pm) pm.textContent = isMusicOn() && isPlaying() ? 'Stop the soundtrack' : 'Play the soundtrack'; };
  window.addEventListener('musicchange', label);
  if (pm) { label(); pm.onclick = () => { setMusic(!(isMusicOn() && isPlaying())); label(); renderShell(); }; }
}

function hero() {
  const w = getWorld();
  const next = w.missions.find((m) => !getMission(w.id, m)) || w.missions[0];
  $('#hero-text').innerHTML = `<p class="eyebrow">Cat on Moon presents</p>
    <h1 class="hero-title">Moonbase Mission Control</h1>
    <p class="hero-hook">Every choice has a cost.<br><span>Our game shows you why.</span></p>
    <p class="lead">A decision-based teaching game. Design a relay satellite, a rover and a radio link, fly them on real NASA maps, survive the surprises, and learn from every result.</p>
    <div class="row"><a href="${MISSIONS[next].href}"><button class="primary big">${getMission(w.id, w.missions[0]) ? 'Continue' : 'Start'} the ${w.name} campaign</button></a>
    <a href="about.html"><button class="big">Briefing Room (judges and teachers)</button></a></div>`;
  if (!w.textureTopo) layer = 'imagery';
  $('#hero-world').innerHTML = `<b>${w.name}</b> · ${w.tierLabel}<br><span class="small muted">${w.blurb}</span>
    ${w.textureTopo ? `<div class="mv-tabs" role="group" aria-label="Map layer"><button type="button" data-layer="imagery" class="${layer === 'imagery' ? 'on' : ''}">NASA imagery</button><button type="button" data-layer="topo" class="${layer === 'topo' ? 'on' : ''}">Elevation (laser altimeter)</button></div>` : ''}`;
  $('#hero-world').onclick = (e) => { const b = e.target.closest('[data-layer]'); if (!b) return; layer = b.dataset.layer; globe?.setWorld(w, layer); document.querySelectorAll('#hero-world [data-layer]').forEach((x) => x.classList.toggle('on', x === b)); };
  if (globe) globe.setWorld(w, layer); else import('./globe.js').then(({ Globe }) => {
    globe = new Globe($('#hero-globe'), { world: w, autoRotate: 0.12, controls: true });
    if (layer === 'topo') globe.setWorld(w, layer);
    globe.setSite(w.site.latDeg); globe.frame(3.1);
  }).catch(() => { $('#hero-globe').innerHTML = `<div class="planet big" style="background-image:url(${w.texture.replace('textures/', 'textures/thumbs/')})"></div>`; });
  if (globe) globe.setSite(w.site.latDeg);
}

function track() {
  const w = getWorld();
  const flow = { orbit: 'relay schedule', rover: 'science data' };
  $('#track').innerHTML = w.missions.map((m, n) => {
    const M = MISSIONS[m], r = getMission(w.id, m);
    return `${n ? `<div class="handoff" aria-hidden="true"><span>${flow[w.missions[n - 1]]}</span></div>` : ''}
    <a class="mcard ${r ? 'flown' : ''}" href="${M.href}">
      <span class="tag accent">Mission ${M.n}</span><h3>${M.title}: ${M.long}</h3>
      <p class="small muted">${{ orbit: 'Rocket, antenna and orbit shape decide how often the base can talk to Earth.', rover: w.id === 'mars' ? 'Land in Jezero crater and core rock samples like Perseverance.' : 'Land on Shackleton’s rim, survive the cold and dig for ice.', comms: 'Encode the rover’s data, beat the noise and decode Earth’s reply.' }[m]}</p>
      ${r ? `<p class="small"><span class="medal ${r.medal}"></span> Best ${r.best}/100</p>` : '<p class="small muted">Not flown yet</p>'}
      <span class="go">${r ? 'Fly again' : 'Play'} →</span></a>`;
  }).join('');
  $('#camp-score').textContent = `${campaignScore(w.id)} / ${w.missions.length * 100}`;
}

function worlds() {
  const cur = getWorld().id;
  $('#worlds').innerHTML = Object.values(WORLDS).map((w) => `<button class="wcard ${w.id === cur ? 'on' : ''}" data-world="${w.id}">
    <div class="planet" style="background-image:url(${w.texture.replace('textures/', 'textures/thumbs/')})"></div>
    <div><span class="tag ${w.tier === 'main' ? 'good' : w.tier === 'bonus' ? 'warn' : ''}">${w.tierLabel}</span><h3>${w.name}</h3>
    <p class="small muted">${w.site.name}</p><p class="nums">Gravity ${w.gravity} m/s² · signal ${lightDelayText(w)}</p></div></button>`).join('');
}

function crew() {
  const all = listProfiles(), ids = getCrew().map((p) => p.id);
  $('#crew').innerHTML = `${all.map((p) => { const lv = levelOf(p.xp); return `<button class="pchip ${ids.includes(p.id) ? 'on' : ''}" data-crew="${p.id}" aria-pressed="${ids.includes(p.id)}">
      ${catSVG(p.avatar, 38, { title: p.name })}<span><b>${p.name}</b><small>Lv ${lv.level} ${lv.rank} · ${p.role}</small></span></button>`; }).join('')}
    <button class="pchip add" id="newp">+ New player</button>`;
  $('#crew-note').textContent = ids.length ? `${ids.length} of 4 in the crew. Everyone in the crew earns XP and badges.` : 'Create players to earn XP, ranks and badges. Up to 4 can fly together.';
}

function newPlayerForm() {
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<form class="panel modal stack pop" id="pf"><h2>New player</h2>
    <label>Callsign <input name="name" maxlength="24" required placeholder="Captain Paws" class="field"></label>
    <div><b>Pick your cat</b><div class="row" style="margin-top:6px">${Array.from({ length: AVATARS }, (_, i) => `<label class="avpick"><input type="radio" name="avatar" value="${i}" ${i ? '' : 'checked'}>${catSVG(i, 48)}<small>${AVATAR_NAMES[i]}</small></label>`).join('')}</div></div>
    <label>Favourite role <select name="role" class="field">${ROLES.map((r) => `<option>${r}</option>`).join('')}</select></label>
    <label>Class or group (optional) <input name="group" maxlength="30" placeholder="7B" class="field"></label>
    <p class="small muted">Saved only in this browser. No account, no email.</p>
    <p class="small" id="pf-err" style="color:var(--bad)"></p>
    <div class="row"><button class="primary" type="submit">Create</button><button type="button" id="pf-cancel">Cancel</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('[name=name]').focus();
  d.querySelector('#pf-cancel').onclick = () => d.remove();
  d.querySelector('#pf').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target), name = String(f.get('name') || '').trim();
    if (!name) { d.querySelector('#pf-err').textContent = 'Enter a callsign first.'; return; }
    createProfile({ name, avatar: Number(f.get('avatar')), role: f.get('role'), group: f.get('group') });
    sfx.good(); d.remove(); crew(); renderShell();
  };
}

function render() { hero(); track(); worlds(); crew(); $('#classmode').checked = isClassMode(); }

document.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.world) { setWorld(b.dataset.world); sfx.select(); render(); renderShell(); }
  if (b.dataset.crew) { toggleCrew(b.dataset.crew); sfx.click(); crew(); renderShell(); }
  if (b.id === 'newp') newPlayerForm();
});
$('#classmode').onchange = (e) => { setClassMode(e.target.checked); sfx.click(); renderShell(); };
$('#aimode').checked = aiEnabled();
$('#aimode').onchange = (e) => { setAiEnabled(e.target.checked); sfx.click(); };
render();
