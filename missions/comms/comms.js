// Mission 3: Comms. Send the rover's science home through the relay, then decode Earth's reply.
// Game design based on Jeongha's signal-encoding mission (O/X bit typing).
import * as C from './codec.js';
import { mountShell, celebrate, coachOnce } from '../../shared/shell.js';
import { getWorld, getWorldId, relaySchedule, roverPackets, saveMission, campaignScore } from '../../shared/campaign.js';
import { awardRun } from '../../shared/profile.js';
import { whiskersSVG } from '../../shared/cat.js';
import { sfx, toast } from '../../shared/fx.js';
import { lightDelayText } from '../../shared/worlds.js';
import { playClip } from '../../shared/music.js';
import { treeHTML } from '../../shared/tree.js';
import { aiNote } from '../../shared/llm.js';

const $ = (s) => document.querySelector(s);
const world = getWorld();
const wid = getWorldId() === 'mars' ? 'mars' : 'moon';
const relay = relaySchedule(wid);
const { packets: PACKETS, assumed } = roverPackets(wid);
const STAGES = ['Briefing', 'Plan', 'Downlink', 'Uplink', 'Debrief'];
const RATE_X = { 1: 1, 2: 1.15, 4: 1.3 };
const WINDOW_S = Math.round(Math.min(80, Math.max(30, 25 + relay.windowH * 5)) * (RATE_X[relay.dataRate] || 1));
const S = { stage: 0, order: PACKETS.map((p) => p.id), skip: new Set(), comp: 'smart', check: 'parity', dl: null, ul: null };

mountShell({ base: '../../', mission: 'comms', shortcuts: [['O or 0', 'Type a 0 bit'], ['X or 1', 'Type a 1 bit'], ['Enter', 'Send your decoded word (Uplink)']] });

const comp = () => C.COMPRESSION.find((c) => c.id === S.comp);
const check = () => C.CHECKS.find((c) => c.id === S.check);
const chosen = () => S.order.filter((id) => !S.skip.has(id)).map((id) => PACKETS.find((p) => p.id === id));
const whiskers = (tips) => `<section class="panel capcom" aria-live="polite"><h3>${whiskersSVG(36)} CAPCOM Whiskers</h3><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
  <details class="small"><summary>Space words explained</summary>
  <p><b>Bit:</b> a single 0 or 1. Everything a spacecraft sends is made of bits.</p>
  <p><b>Byte:</b> a group of 8 bits.</p><p><b>Parity bit:</b> an extra bit that makes the number of 1s even. If one bit flips on the way, the count turns odd and Earth knows.</p>
  <p><b>Compression:</b> squeezing data into fewer bits. Some kinds lose detail.</p>
  <p><b>Light delay:</b> radio travels at the speed of light, which still takes ${lightDelayText(world)} from ${world.name} to Earth.</p>
  <p><b>Deep Space Network:</b> NASA’s three giant antenna sites in California, Spain and Australia, spaced so one always faces the spacecraft.</p></details></section>`;

function stageBar() { $('#stages').innerHTML = STAGES.map((s, n) => `<span class="stage ${n < S.stage ? 'done' : n === S.stage ? 'now' : ''}">${n + 1} ${s}</span>`).join(''); }
function go(n) { if (n === 2 && S.stage !== 2) playClip('sputnik', 0.45); S.stage = n; clearInterval(S.timer); const m = $('#main'); m.onclick = null; m.onchange = null; document.onkeydown = null; render(); window.scrollTo({ top: 0 }); }

/* ---------- 1 Briefing ---------- */
function briefing() {
  const st = C.dsnStation(new Date().getUTCHours());
  $('#main').innerHTML = `<section class="panel stack hero"><span class="tag accent">Mission 3 of 3 · ${world.name}</span>
    <h1 class="big-title">Send the science home</h1>
    <p class="lead">Your rover’s data is useless until it reaches Earth. It travels through your relay satellite to NASA’s Deep Space Network. You get <b>${WINDOW_S} seconds</b> of relay contact: encode the most valuable data first, beat the noise, then decode Earth’s reply.</p>
    <div class="linkbar"><span class="end">Rover</span><span class="hop">Relay satellite</span><span class="end">Earth · ${st.name}</span><i class="pulse"></i></div>
    <div class="statgrid">
      <div class="stat"><div class="lbl">Contact window</div><div class="val">${WINDOW_S} s</div></div>
      <div class="stat"><div class="lbl">Signal delay</div><div class="val">${lightDelayText(world)}</div></div>
      <div class="stat"><div class="lbl">Noise</div><div class="val">${Math.round(C.NOISE[wid] * 100)}% of bits flip</div></div>
      <div class="stat"><div class="lbl">Data from the rover</div><div class="val">${PACKETS.length} packets</div></div>
    </div>
    ${assumed ? '<p class="lastline">No rover mission flown yet, so you are sending a standard test packet set. Fly Mission 2 to send your own science.</p>' : '<p class="lastline good">These packets come from your Mission 2 rover.</p>'}
    ${relay.assumed ? '<p class="lastline">No relay orbit flown yet: you have a standard contact window. A better Mission 1 orbit gives you more time.</p>' : `<p class="lastline good">Your Mission 1 relay gives ${relay.windowH.toFixed(1)} h contacts and a data rate of ×${relay.dataRate}, which sets your time here.</p>`}
    <div class="row"><button class="primary big" id="next">Plan the downlink</button></div>
    <p class="small muted">Mission design by Jeongha (Cat on Moon). The station on duty is simplified from the real Deep Space Network schedule.</p></section>`;
  $('#side').innerHTML = whiskers(['Every choice has a cost: compression saves time but loses detail; error checks add bits but catch damage.', 'Signals are slow to cross space. You can’t ask Earth for help instantly.']);
  $('#next').onclick = () => { sfx.click(); go(1); };
}

/* ---------- 2 Plan ---------- */
function plan(focus) {
  const tot = C.planTotals(chosen(), comp(), check());
  const est = Math.round(WINDOW_S * C.TYPE_BPS); // a typical player types about 2 bits per second
  const adv = C.planChoices(PACKETS, { windowS: WINDOW_S, noise: C.NOISE[wid] });
  const advHTML = adv.choices.length ? `<details class="analyst" open><summary><b>Mission analyst</b>: ${adv.choices.length} plans, calculated before you decide</summary>
    ${treeHTML({ question: 'Which plan do you want to start from?', attr: 'plan', note: 'Calculated from your window, the noise on this world and typing speed. You can still change anything after loading a plan.',
      options: adv.choices.map((c) => ({ id: c.id, title: c.title, recommended: c.recommended, summary: c.summary, branches: c.branches, button: 'Use this plan',
        expected: `Predicted: ${c.metrics.bits} of about ${c.metrics.budget} typeable bits, ${c.metrics.timeLeftS} s to spare.` })) })}</details>` : '';
  $('#main').innerHTML = `<section class="panel stack"><h1>Plan the downlink</h1><p>Pick what to send and in what order. Anything you don’t finish before the window closes stays on the rover.</p>
    <div id="analyst">${advHTML}</div>
    <h2>Data packets</h2><div class="stack" style="gap:8px">${S.order.map((id, n) => {
      const p = PACKETS.find((x) => x.id === id), off = S.skip.has(id);
      return `<div class="choice ${off ? '' : 'on'}" style="flex-direction:row;align-items:center;gap:12px;cursor:default">
        <input type="checkbox" data-pk="${id}" ${off ? '' : 'checked'} aria-label="Send ${p.label}">
        <div style="flex:1"><b>${n + 1}. ${p.label}</b><div class="nums">${p.bits} bits · science value ${p.value}</div></div>
        <button data-up="${id}" ${n === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button data-down="${id}" ${n === S.order.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></div>`;
    }).join('')}</div>
    <h2>Compression</h2><div class="choice-grid">${C.COMPRESSION.map((c) => `<button class="choice ${S.comp === c.id ? 'on' : ''}" data-comp="${c.id}"><b>${c.name}</b><span class="small muted">${c.info}</span><span class="nums">bits ×${c.bitsX} · science ×${c.valueX}</span></button>`).join('')}</div>
    <h2>Error check</h2><div class="choice-grid">${C.CHECKS.map((c) => `<button class="choice ${S.check === c.id ? 'on' : ''}" data-check="${c.id}"><b>${c.name}</b><span class="small muted">${c.info}</span></button>`).join('')}</div>
    <div class="row"><button id="back">Back</button><button class="primary big" id="next" ${chosen().length ? '' : 'disabled'}>Open the link</button></div></section>`;
  const tips = [];
  if (tot.bits > est) tips.push(`That’s ${tot.bits} bits for about ${est} you can type in ${WINDOW_S} s. Compress, or drop the least valuable packets.`);
  if (S.check === 'none') tips.push(`Without parity, about ${Math.round(C.NOISE[wid] * 8 * 100)}% of bytes get a flipped bit that nobody notices. That ruins the packet.`);
  if (!tips.length) tips.push('Put the most valuable packets first, in case time runs out.');
  $('#side').innerHTML = `<section class="panel"><h3>Downlink plan</h3><div class="statgrid">
    <div class="stat ${tot.bits > est ? 'bad' : 'good'}"><div class="lbl">Bits to type</div><div class="val">${tot.bits}</div></div>
    <div class="stat"><div class="lbl">You can type about</div><div class="val">${est}</div></div>
    <div class="stat"><div class="lbl">Science if all arrives</div><div class="val">${tot.value}</div></div></div></section>` + whiskers(tips);
  $('#main').onchange = (e) => { const id = e.target.dataset.pk; if (!id) return; if (e.target.checked) S.skip.delete(id); else S.skip.add(id); sfx.select(); plan(`[data-pk="${id}"]`); };
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const move = (id, d) => { const i = S.order.indexOf(id); const j = i + d; [S.order[i], S.order[j]] = [S.order[j], S.order[i]]; };
    // plan() redraws everything, so hand focus back to the control the player just used (keyboard play)
    if (b.dataset.up) { move(b.dataset.up, -1); sfx.click(); plan(S.order[0] === b.dataset.up ? `[data-down="${b.dataset.up}"]` : `[data-up="${b.dataset.up}"]`); }
    if (b.dataset.down) { move(b.dataset.down, 1); sfx.click(); plan(S.order[S.order.length - 1] === b.dataset.down ? `[data-up="${b.dataset.down}"]` : `[data-down="${b.dataset.down}"]`); }
    if (b.dataset.comp) { S.comp = b.dataset.comp; sfx.select(); plan(`[data-comp="${b.dataset.comp}"]`); }
    if (b.dataset.check) { S.check = b.dataset.check; sfx.select(); plan(`[data-check="${b.dataset.check}"]`); }
    if (b.dataset.plan) {
      const c = adv.choices.find((x) => x.id === b.dataset.plan);
      if (c) { S.order = [...c.plan.order]; S.skip = new Set(c.plan.skip); S.comp = c.plan.comp; S.check = c.plan.check; sfx.select(); plan('#next'); }
    }
    if (b.id === 'back') go(0);
    if (b.id === 'next') { sfx.click(); go(2); }
  };
  if (adv.choices.length) aiNote($('#analyst .analyst'), 'comms-plan', adv.choices.map((c) => [c.title + (c.recommended ? ' (analyst pick)' : ''),
    `${c.metrics.clean} science points if clean, ${c.metrics.timeLeftS} s to spare, ${c.plan.check === 'parity' ? 'parity on' : 'no error check'}`]));
  if (focus) $(focus)?.focus();
}

/* ---------- 3 Downlink: type the bits ---------- */
function downlink() {
  const par = S.check === 'parity';
  const queue = [];
  for (const p of chosen()) C.packetBytes(p, comp()).forEach((byte, i, all) => queue.push({ p, byte: par ? C.withParity(byte) : byte, last: i === all.length - 1 }));
  const dl = S.dl = { queue, qi: 0, pos: 0, time: WINDOW_S, mistakes: 0, resent: 0, typed: 0, packets: {}, done: false };
  chosen().forEach((p) => { dl.packets[p.id] = { p, state: 'waiting', damaged: false }; });
  $('#main').innerHTML = `<section class="panel stack mission-1" style="padding:16px"><h1>Downlink</h1>
    <div class="metrics"><div><span>TIME LEFT</span><strong id="dl-time"></strong></div><div><span>PACKET</span><strong id="dl-pkt"></strong></div><div><span>MISTAKES</span><strong id="dl-mis"></strong></div></div>
    <div class="encoding-panel" style="min-height:0">
      <div class="progress-track"><div id="progress-fill"></div></div>
      <p class="instructions">Type the highlighted bit: <b>O</b> for 0, <b>X</b> for 1</p>
      <div class="bits" id="target-message"></div>
      <div class="input-buttons"><button type="button" id="b0">O<small>BINARY 0 · KEY O</small></button><button type="button" id="b1">X<small>BINARY 1 · KEY X</small></button></div>
      <p id="encoding-feedback" aria-live="polite">${par ? 'The last bit of each byte is the parity bit.' : 'No error check: watch out for noise.'}</p>
      <div class="linkbar"><span class="end">Rover</span><span class="hop">Relay</span><span class="end">Earth</span><i class="pulse" id="pulse"></i></div>
    </div></section>`;
  $('#side').innerHTML = `<section class="panel"><h3>Packets</h3><div id="pk-list" class="stack" style="gap:6px"></div></section>` + whiskers(['Accuracy beats speed: each wrong key costs 2 seconds.', par ? 'If a byte arrives with an odd number of 1s, Earth asks for it again.' : 'Noise can ruin a whole packet without anyone knowing.']);
  const press = (bit) => {
    if (dl.done) return;
    const cur = dl.queue[dl.qi];
    if (bit !== cur.byte[dl.pos]) {
      dl.mistakes++; dl.time = Math.max(0, dl.time - 2); sfx.bad(); $('#encoding-feedback').textContent = 'Wrong bit! −2 s'; draw();
      if (dl.time === 0) { toast('The relay dropped below the horizon. Link closed.', 'bad'); finishDownlink(); }
      return;
    }
    sfx.click(); dl.pos++; dl.typed++;
    if (dl.pos === cur.byte.length) sendByte(cur);
    draw();
  };
  const sendByte = (cur) => {
    const rec = C.transmitByte(cur.byte, C.NOISE[wid]);
    const flipped = rec !== cur.byte, pk = dl.packets[cur.p.id];
    const pulse = $('#pulse'); if (pulse) { pulse.classList.remove('go'); void pulse.offsetWidth; pulse.classList.add('go'); }
    if (flipped && par && !C.parityOk(rec)) {
      dl.resent++; dl.pos = 0; toast('Parity error: Earth asks you to resend that byte.', 'bad', 2500); $('#encoding-feedback').textContent = 'Parity caught a flipped bit. Resend the byte.';
      return; // same byte again
    }
    if (flipped) pk.damaged = true; // no check, or an even number of flips slipped through
    pk.state = 'sending'; dl.pos = 0; dl.qi++;
    if (cur.last) { pk.state = pk.damaged ? 'damaged' : 'arrived'; $('#encoding-feedback').textContent = `${cur.p.label}: sent.`; }
    if (dl.qi >= dl.queue.length) finishDownlink();
  };
  const draw = () => {
    const cur = dl.queue[Math.min(dl.qi, dl.queue.length - 1)];
    $('#dl-time').textContent = `${dl.time}s`; $('#dl-mis').textContent = dl.mistakes;
    $('#dl-pkt').textContent = cur ? cur.p.label : '—';
    const total = dl.queue.reduce((a, q) => a + q.byte.length, 0), done = dl.queue.slice(0, dl.qi).reduce((a, q) => a + q.byte.length, 0) + dl.pos;
    $('#progress-fill').style.width = `${(100 * done) / total}%`;
    $('#target-message').innerHTML = dl.done ? '' : [...cur.byte].map((b, i) => `<span class="bit ${i < dl.pos ? 'correct' : i === dl.pos ? 'active' : ''} ${par && i === 8 ? 'parity' : ''}">${b}</span>`).join('');
    $('#pk-list').innerHTML = Object.values(dl.packets).map(({ p, state }) => `<div class="row small" style="justify-content:space-between"><span>${p.label}</span><span class="tag ${state === 'arrived' || state === 'damaged' ? 'good' : state === 'sending' ? 'accent' : ''}">${state === 'damaged' ? 'sent' : state}</span></div>`).join('');
  };
  const finishDownlink = () => { dl.done = true; clearInterval(S.timer); setTimeout(() => go(3), 700); };
  $('#b0').onclick = () => press('0'); $('#b1').onclick = () => press('1');
  document.onkeydown = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'o' || k === '0') press('0'); if (k === 'x' || k === '1') press('1');
  };
  S.timer = setInterval(() => { dl.time = Math.max(0, dl.time - 1); draw(); if (dl.time === 0 && !dl.done) { toast('The relay dropped below the horizon. Link closed.', 'bad'); finishDownlink(); } }, 1000);
  draw();
  coachOnce('comms-downlink', ['Type each highlighted bit with O (0) or X (1), or click the big buttons.', 'When a byte is done it flies to Earth. Noise may flip bits on the way.']);
}

/* ---------- 4 Uplink: decode Earth's reply ---------- */
function uplink() {
  const word = C.COMMANDS[Math.floor(Math.random() * C.COMMANDS.length)];
  const groups = C.encodeWord(word);
  const ul = S.ul = S.ul && S.ul.word ? S.ul : { word, groups, tries: 0, hint: 0, solved: false };
  const table = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  $('#main').innerHTML = `<section class="panel stack"><h1>Earth replies</h1>
    <p>Mission control sent a command. ${wid === 'mars' ? `It spent about ${lightDelayText(world)} crossing space (sped up here).` : 'It took about 1.3 seconds to arrive.'} Each letter is 5 bits. Decode it with the code table and type the word.</p>
    <div class="row" style="gap:14px;flex-wrap:wrap">${ul.groups.map((g, i) => `<div class="stat" style="text-align:center"><div class="val mono">${g}</div><div class="lbl">${i < ul.hint ? ul.word[i] : `letter ${i + 1}`}</div></div>`).join('')}</div>
    <div class="row"><input id="answer" maxlength="8" autocomplete="off" placeholder="Type the word" style="font-size:22px;letter-spacing:4px;text-transform:uppercase;padding:10px;border-radius:8px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--text);width:220px" aria-label="Decoded command">
      <button class="primary big" id="send">Send</button><button id="hint">Hint (−5 points)</button></div>
    <p id="ul-msg" class="small" aria-live="polite"></p>
    <details open><summary><b>Code table</b> (A = 1 = 00001)</summary><div class="codegrid">${table.map((ch) => `<span><b>${ch}</b> ${C.encodeLetter(ch)}</span>`).join('')}</div></details></section>`;
  $('#side').innerHTML = whiskers(['Read each 5-bit group as a number: 00100 = 4 = D.', 'Binary place values from the right: 1, 2, 4, 8, 16.']);
  const send = () => {
    const a = $('#answer').value.trim().toUpperCase(); if (!a) { $('#ul-msg').textContent = 'Type the word first.'; return; }
    ul.tries++;
    if (a === ul.word) { ul.solved = true; sfx.good(); toast(`Command “${ul.word}” received. The rover obeys!`, 'good'); setTimeout(() => go(4), 700); }
    else { sfx.bad(); $('#ul-msg').textContent = `Not quite. ${ul.tries >= 3 ? `The word was ${ul.word}.` : 'Check each group again.'}`; if (ul.tries >= 3) setTimeout(() => go(4), 1400); }
  };
  $('#send').onclick = send;
  $('#hint').onclick = () => { if (ul.hint < ul.word.length - 1) { ul.hint++; sfx.click(); uplink(); } };
  $('#answer').onkeydown = (e) => { if (e.key === 'Enter') send(); };
  $('#answer').focus();
}

/* ---------- 5 Debrief ---------- */
function debrief() {
  const dl = S.dl, ul = S.ul, compC = comp();
  const maxValue = PACKETS.reduce((a, p) => a + p.value, 0);
  const got = Object.values(dl.packets).filter((x) => x.state === 'arrived').reduce((a, x) => a + x.p.value * compC.valueX, 0);
  const ruined = Object.values(dl.packets).filter((x) => x.state === 'damaged');
  const unsent = Object.values(dl.packets).filter((x) => x.state === 'waiting' || x.state === 'sending');
  const sci = Math.round(60 * Math.min(1, got / maxValue));
  const acc = Math.max(0, 15 - dl.mistakes * 2);
  const dec = ul.solved ? Math.max(0, (ul.tries === 1 ? 15 : 10) - ul.hint * 5) : 0;
  const tim = Math.round(10 * Math.min(1, dl.time / (WINDOW_S * 0.25)));
  const score = sci + acc + dec + tim;
  const items = [['Science delivered', 60, sci, `${Math.round(got)} of ${maxValue} science value reached Earth intact.`],
    ['Typing accuracy', 15, acc, `${dl.mistakes} wrong key${dl.mistakes === 1 ? '' : 's'}.`],
    ['Decoding', 15, dec, ul.solved ? `Decoded “${ul.word}” on try ${ul.tries}${ul.hint ? ` with ${ul.hint} hint${ul.hint > 1 ? 's' : ''}` : ''}.` : `The command was “${ul.word}”.`],
    ['Time left', 10, tim, `${dl.time} s of the window left.`]];
  const lessons = [];
  if (ruined.length) lessons.push(`${ruined.length} packet${ruined.length > 1 ? 's were' : ' was'} damaged by noise and nobody noticed. A parity bit per byte would have caught it. (Real missions use even stronger codes, like Reed-Solomon, that can also repair errors.)`);
  if (dl.resent) lessons.push(`Parity caught ${dl.resent} damaged byte${dl.resent > 1 ? 's' : ''} and you resent ${dl.resent > 1 ? 'them' : 'it'}. Error checks cost bits but save the data.`);
  if (unsent.length) lessons.push(`${unsent.length} packet${unsent.length > 1 ? 's' : ''} never left the rover. More compression, a better relay orbit (Mission 1) or a bigger antenna gives more time.`);
  if (S.comp === 'max') lessons.push('Maximum compression saved time but threw away a third of the detail. Scientists usually prefer fewer, better packets.');
  if (!lessons.length) lessons.push('A clean downlink. Real missions plan every pass like this, because contact time is precious.');
  const badges = [];
  if (!ruined.length && !unsent.length) badges.push('Clean signal');
  if (ul.solved && ul.tries === 1 && !ul.hint) badges.push('Codebreaker');
  if (got / maxValue >= 0.8) badges.push('Data hero');
  saveMission(wid, 'comms', { score });
  const award = awardRun({ mission: 'comms', world: wid, score, badges, summary: `${Math.round(got)}/${maxValue} science, decoded ${ul.solved ? ul.word : 'no'}`,
    decisions: [compC.name, check().name, `Sent ${chosen().length} of ${PACKETS.length} packets`] });
  celebrate(award); if (score >= 65) sfx.good(); else sfx.bad();
  if (score >= 65) setTimeout(() => playClip('step', 0.7), 1500); // the whole campaign is done: one small step
  const total = campaignScore(wid), stars = score >= 85 ? 3 : score >= 60 ? 2 : score >= 35 ? 1 : 0;
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><div><span class="tag ${score >= 65 ? 'good' : 'warn'}">${score >= 65 ? 'Data home' : 'Partial downlink'}</span>
    <div class="row" style="align-items:baseline"><div class="score">${score}</div><div class="muted">/ 100</div></div></div>
    <div class="stars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="--i:${n}">★</span>`).join('')}</div></div>
    <div>${items.map(([l, m, p, w], n) => `<div class="check rise" style="--i:${n}"><span class="tag ${p >= m * 0.8 ? 'good' : p >= m * 0.4 ? 'warn' : 'bad'}">${p}/${m}</span><div><b>${l}</b><div class="small muted">${w}</div></div></div>`).join('')}</div>
    <h2>Why it went this way</h2><ul>${lessons.map((l) => `<li>${l}</li>`).join('')}</ul>
    <div class="panel" style="background:var(--panel-2)"><h2>Campaign total: ${total} / 300</h2><p>Orbit, rover and comms together. Every mission’s choices shaped the next one.</p></div>
    <div class="row"><a href="../../hub.html"><button class="primary big">Back to mission control</button></a><button id="again">Send again</button></div></section>`;
  $('#side').innerHTML = whiskers(['Real missions do this every day: NASA’s Deep Space Network talks to dozens of spacecraft, from the Moon to beyond the planets.']);
  $('#again').onclick = () => { S.ul = null; go(1); };
}

function render() { stageBar(); [briefing, plan, downlink, uplink, debrief][S.stage](); }
render();
