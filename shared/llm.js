// Optional AI wording for the analyst's forecasts. OFF by default.
// The game computes every number itself; this only asks a language model to explain the trade-off in plain words.
// Only mission numbers are sent (never names or profiles), through our own /api/advise endpoint so no key is in the browser.
// If the endpoint is missing (for example on GitHub Pages) or fails, the game silently keeps its built-in explanation.

const KEY = 'com.ai.v1';
const cache = new Map();

export function aiEnabled() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
export function setAiEnabled(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ } }

const endpoint = () => document.querySelector('meta[name="advisor-url"]')?.content || new URL('../api/advise', import.meta.url).href;

/** facts: [[label, value], ...]. Resolves to a short text, or null when AI is off or unavailable. */
export async function narrate(kind, facts) {
  if (!aiEnabled()) return null;
  const body = JSON.stringify({ kind, facts: facts.slice(0, 10).map(([l, v]) => [String(l).slice(0, 60), String(v).slice(0, 80)]) });
  if (cache.has(body)) return cache.get(body);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(endpoint(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctl.signal });
    if (!r.ok) return null;
    const { text } = await r.json();
    const out = typeof text === 'string' && text.trim() ? text.trim().slice(0, 700) : null;
    if (out) cache.set(body, out);
    return out;
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Append an AI-worded note to `container` once it arrives. Does nothing when AI is off. */
export function aiNote(container, kind, facts) {
  if (!container || !aiEnabled()) return;
  const p = document.createElement('p');
  p.className = 'ai-note small'; p.textContent = 'CAPCOM’s AI is thinking…'; p.setAttribute('aria-live', 'polite');
  container.appendChild(p);
  narrate(kind, facts).then((t) => {
    if (!t) { p.remove(); return; }
    p.textContent = '';
    const tag = document.createElement('b'); tag.textContent = 'AI-worded: ';
    p.append(tag, document.createTextNode(`${t} (The numbers above were computed by the game, not by the AI.)`));
  });
}
