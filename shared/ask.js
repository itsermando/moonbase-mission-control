// "Ask CAPCOM": a floating question box on every game page. Answers come from capcom-kb.js (offline, no AI, nothing is sent anywhere).
import { ask, answerFor, suggestions } from './capcom-kb.js';
import { whiskersSVG } from './cat.js';

export function mountAsk({ mission = 'all', getWorld, plain = false }) {
  if (document.getElementById('ask-btn')) return;
  if (!document.querySelector('link[data-ask-css]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./ask.css', import.meta.url).href; l.dataset.askCss = ''; document.head.appendChild(l);
  }
  const ctx = { mission, get world() { return getWorld(); } };
  const btn = document.createElement('button');
  btn.id = 'ask-btn'; btn.type = 'button'; btn.className = plain ? 'ask-btn plain' : 'ask-btn'; btn.title = 'Ask CAPCOM a question (press /)';
  btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = `${whiskersSVG(26)}<span>Ask CAPCOM</span>`;
  const panel = document.createElement('section');
  panel.id = 'ask-panel'; panel.className = plain ? 'ask-panel panel plain' : 'ask-panel panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Ask CAPCOM');
  panel.innerHTML = `<div class="ask-head"><b>Ask CAPCOM</b><button type="button" class="icon" id="ask-close" aria-label="Close">×</button></div>
    <div class="ask-log" id="ask-log" aria-live="polite"></div>
    <div class="ask-chips" id="ask-chips"></div>
    <form class="ask-form" id="ask-form"><input id="ask-input" type="text" maxlength="140" autocomplete="off" placeholder="Ask about orbits, rovers, signals…" aria-label="Your question"><button type="submit" class="primary">Ask</button></form>
    <p class="small muted">Answers come from the game’s built-in notes. Your question never leaves this device.</p>`;
  document.body.append(btn, panel);
  const log = panel.querySelector('#ask-log'), chips = panel.querySelector('#ask-chips'), input = panel.querySelector('#ask-input');

  const say = (who, text) => {
    const d = document.createElement('div'); d.className = `ask-msg ${who}`; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  };
  const setChips = (list) => {
    chips.replaceChildren(...list.map((c) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.id = c.id; b.textContent = c.q; return b; }));
  };
  const reply = (r) => { say('cap', r.text); setChips(r.related.length ? r.related : suggestions(mission)); };

  let greeted = false;
  const open = () => {
    panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
    if (!greeted) { greeted = true; say('cap', 'CAPCOM here. Ask me anything about the mission, or tap a question below.'); setChips(suggestions(mission)); }
    input.focus();
  };
  const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); };

  btn.onclick = () => (panel.hidden ? open() : close());
  panel.querySelector('#ask-close').onclick = close;
  panel.onkeydown = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  panel.querySelector('#ask-form').onsubmit = (e) => {
    e.preventDefault();
    const q = input.value.trim(); if (!q) return;
    say('me', q); input.value = ''; reply(ask(q, ctx));
  };
  chips.onclick = (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const r = answerFor(b.dataset.id, ctx); if (!r) return;
    say('me', r.q); reply({ ...r, related: ask(r.q, ctx).related });
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.target.closest?.('input,textarea,select,[contenteditable]')) { e.preventDefault(); if (panel.hidden) open(); else input.focus(); }
  });
}
