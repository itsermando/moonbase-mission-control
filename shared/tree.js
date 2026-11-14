// Decision tree view: a question, then each option with the outcomes the game computed for it BEFORE the player chooses.
// Every number shown comes from the game's own physics and scoring code, never from an AI model.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * question: string
 * options: [{ id, title, summary, expected?: string, branches: [{ p?: 0..1, text, tone?: 'good'|'warn'|'bad' }], button?: string, recommended?: bool }]
 * attr: name of the data attribute on each pick button (read it from the click handler)
 */
export function treeHTML({ question, options, attr = 'pick', note = '' }) {
  return `<div class="dtree" role="group" aria-label="${esc(question)}">
    <p class="dq">${esc(question)}</p>
    <ul class="dopts">${options.map((o) => `<li class="dopt${o.recommended ? ' rec' : ''}">
      <div class="dhead"><b>${esc(o.title)}</b>${o.recommended ? '<span class="drec">Analyst pick</span>' : ''}</div>
      <p class="small muted">${esc(o.summary)}</p>
      <ul class="dbranches">${o.branches.map((b) => `<li class="${b.tone || ''}">
        ${b.p == null ? '<span class="dp">sure</span>' : `<span class="dp">${Math.round(b.p * 100)}%</span><i style="--p:${Math.round(b.p * 100)}%"></i>`}<span class="dt">${esc(b.text)}</span></li>`).join('')}</ul>
      ${o.expected ? `<p class="dexp small">${esc(o.expected)}</p>` : ''}
      <button type="button" data-${attr}="${esc(o.id)}">${esc(o.button || 'Choose this')}</button></li>`).join('')}</ul>
    ${note ? `<p class="small muted dnote">${esc(note)}</p>` : ''}</div>`;
}
