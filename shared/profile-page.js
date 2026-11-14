// Profiles page: every player's level, medals, badges and the decisions behind each run.
import { listProfiles, getCrew, toggleCrew, createProfile, updateProfile, deleteProfile, levelOf, ROLES, AVATARS } from './profile.js';
import { mountShell, renderShell } from './shell.js';
import { catSVG, AVATAR_NAMES } from './cat.js';
import { WORLDS, MISSIONS } from './worlds.js';
import { sfx } from './fx.js';

const $ = (s) => document.querySelector(s);
mountShell({ base: '', mission: null });
let sel = new URLSearchParams(location.search).get('id') || listProfiles()[0]?.id || null;

const ALL_BADGES = ['Bullseye burn', 'Always in touch', 'Thrifty engineer', 'Real-mission twin', 'Objective met', 'Survivor', 'Into the dark', 'Ice mapper',
  'Delta hunter', 'Field geologist', 'Never flat', 'Penny pincher', 'Light packer', 'Mission control', 'Clean signal', 'Codebreaker', 'Data hero'];
const MEDAL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', none: '—' };

function list() {
  const crew = getCrew().map((p) => p.id);
  $('#plist').innerHTML = listProfiles().map((p) => { const lv = levelOf(p.xp); return `<button class="pchip ${p.id === sel ? 'sel' : ''} ${crew.includes(p.id) ? 'on' : ''}" data-sel="${p.id}">
    ${catSVG(p.avatar, 40, { title: p.name })}<span><b>${p.name}</b><small>Lv ${lv.level} ${lv.rank}${crew.includes(p.id) ? ' · in crew' : ''}</small></span></button>`; }).join('')
    + '<button class="pchip add" id="newp">+ New player</button>';
}

function detail() {
  const p = listProfiles().find((x) => x.id === sel);
  if (!p) { $('#pdetail').innerHTML = '<section class="panel"><h2>No players yet</h2><p>Create a player to start collecting XP, medals and badges. Everything stays in this browser.</p></section>'; return; }
  const lv = levelOf(p.xp), inCrew = getCrew().some((c) => c.id === p.id);
  const bestRows = Object.entries(p.best).map(([k, v]) => { const [m, w] = k.split(':'); return `<div class="stat"><div class="lbl">${MISSIONS[m]?.title || m} · ${WORLDS[w]?.name || w}</div><div class="val"><span class="medal ${v.medal}"></span> ${v.score}</div></div>`; }).join('');
  $('#pdetail').innerHTML = `<section class="panel stack">
    <div class="row" style="gap:18px">${catSVG(p.avatar, 96, { title: p.name })}
      <div style="flex:1"><h1 style="margin:0">${p.name}</h1><p class="muted" style="margin:0">${lv.rank} · Level ${lv.level} · ${p.role}${p.group ? ` · ${p.group}` : ''}</p>
      <div class="xpbar" style="height:10px;margin-top:8px;max-width:360px"><i style="width:${lv.max ? 100 : Math.round((lv.into / lv.span) * 100)}%"></i></div>
      <p class="small muted">${p.xp} XP${lv.max ? ' · top rank!' : ` · ${lv.span - lv.into} XP to level ${lv.level + 1}`}</p></div>
      <div class="stack" style="gap:6px"><button class="${inCrew ? '' : 'primary'}" id="crewbtn">${inCrew ? 'Remove from crew' : 'Add to crew'}</button><button id="editbtn">Edit</button><button id="delbtn">Delete</button></div></div>
    <div class="statgrid"><div class="stat"><div class="lbl">Missions flown</div><div class="val">${p.runs.length}</div></div>
      <div class="stat"><div class="lbl">Badges</div><div class="val">${p.badges.length} / ${ALL_BADGES.length}</div></div>
      <div class="stat"><div class="lbl">Gold medals</div><div class="val">${Object.values(p.best).filter((b) => b.medal === 'gold').length}</div></div>
      <div class="stat"><div class="lbl">Best score</div><div class="val">${Math.max(0, ...Object.values(p.best).map((b) => b.score))}</div></div></div>
    ${bestRows ? `<h2>Best results</h2><div class="statgrid">${bestRows}</div>` : ''}
    <h2>Badges</h2><div class="badges">${ALL_BADGES.map((b) => `<div class="badge ${p.badges.includes(b) ? 'got' : ''}"><b>${b}</b></div>`).join('')}</div>
    <h2>Mission history and decisions</h2>
    ${p.runs.length ? `<table class="history"><tr><th>When</th><th>Mission</th><th>Score</th><th>What happened</th><th>Key decisions</th></tr>
      ${p.runs.map((r) => `<tr><td>${r.at.slice(0, 16).replace('T', ' ')}</td><td>${MISSIONS[r.mission]?.title || r.mission} · ${WORLDS[r.world]?.name || r.world}</td>
      <td><span class="medal ${r.medal}"></span> ${r.score} <small class="muted">${MEDAL[r.medal]}</small></td><td>${r.summary}</td><td class="small muted">${(r.decisions || []).join(' · ')}</td></tr>`).join('')}</table>`
      : '<p class="muted">No missions yet. Add this player to the crew and fly!</p>'}</section>`;
  $('#crewbtn').onclick = () => { toggleCrew(p.id); sfx.click(); refresh(); };
  $('#delbtn').onclick = () => { if (confirm(`Delete ${p.name}? Their XP, badges and history will be lost.`)) { deleteProfile(p.id); sel = listProfiles()[0]?.id || null; refresh(); } };
  $('#editbtn').onclick = () => form(p);
}

function form(p) {
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<form class="panel modal stack pop" id="pf"><h2>${p ? 'Edit player' : 'New player'}</h2>
    <label>Callsign <input name="name" maxlength="24" required value="${p ? p.name.replace(/"/g, '&quot;') : ''}" placeholder="Captain Paws" class="field"></label>
    <div><b>Cat</b><div class="row" style="margin-top:6px">${Array.from({ length: AVATARS }, (_, i) => `<label class="avpick"><input type="radio" name="avatar" value="${i}" ${(p ? p.avatar : 0) === i ? 'checked' : ''}>${catSVG(i, 48)}<small>${AVATAR_NAMES[i]}</small></label>`).join('')}</div></div>
    <label>Favourite role <select name="role" class="field">${ROLES.map((r) => `<option ${p?.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
    <label>Class or group (optional) <input name="group" maxlength="30" value="${p?.group || ''}" class="field"></label>
    <p class="small" id="pf-err" style="color:var(--bad)"></p>
    <div class="row"><button class="primary" type="submit">Save</button><button type="button" id="pf-cancel">Cancel</button></div></form>`;
  document.body.appendChild(d);
  d.querySelector('#pf-cancel').onclick = () => d.remove();
  d.querySelector('#pf').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target), name = String(f.get('name') || '').trim();
    if (!name) { d.querySelector('#pf-err').textContent = 'Enter a callsign first.'; return; }
    const data = { name, avatar: Number(f.get('avatar')), role: f.get('role'), group: String(f.get('group') || '').trim() };
    if (p) updateProfile(p.id, data); else sel = createProfile(data).id;
    sfx.good(); d.remove(); refresh();
  };
}

function refresh() { list(); detail(); renderShell(); }
$('#plist').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.sel) { sel = b.dataset.sel; sfx.click(); refresh(); }
  if (b.id === 'newp') form(null);
};
refresh();
