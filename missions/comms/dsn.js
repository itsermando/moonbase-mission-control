// Mission 3, stage 4: the Ground station. Jeongha's Operation Deep Link mini-games, built into the mission:
// 1 point the right Deep Space Network antenna, 2 lock the sync pulses, 3 find your spacecraft's signal by ear,
// 4 rebuild the rover's photo by majority voting. Pure helpers at the top (tested in Node), screens below.
import { DSN, dsnStation } from './codec.js';

/* ------------------------------------------------------------------ pure helpers */

/** The bit that appears at least twice in three received copies. */
export const majority = (t) => (t[0] + t[1] + t[2] >= 2 ? 1 : 0);
/** A sync press is good when the sweep (0..1) is inside the target zone around the middle. */
export const SYNC = { periodMs: 1800, zone: 0.12, pulses: 6 };
export const syncHit = (phase) => Math.abs(phase - 0.5) <= SYNC.zone;
/** Angle (degrees) between a station and the direction the Moon is in, seen from above the North Pole at this UTC hour. */
export function stationAngle(lon, utcHour) {
  const facing = ((180 - utcHour * 15 + 540) % 360) - 180; // longitude where it is local midnight: the side facing away from the Sun
  return Math.abs(((lon - facing + 540) % 360) - 180);
}
/** Points for the ground station (out of 20): station 4, sync 5, signal 5, photo 6. */
export function scoreDSN(r) {
  const station = Math.max(0, 4 - 2 * r.stationWrong);
  const sync = Math.max(0, 5 - r.syncMiss);
  const signal = r.signalTimeout ? 0 : Math.max(0, 5 - 2 * r.signalWrong - (r.signalPeek ? 1 : 0));
  const photo = Math.max(0, 6 - r.photoWrong);
  return { station, sync, signal, photo, total: station + sync + signal + photo };
}
/** A wrong candidate: the reference with two different bits flipped (close enough that you must really listen). */
export function decoy(ref, rand = Math.random) {
  const a = Math.floor(rand() * ref.length);
  let b = Math.floor(rand() * (ref.length - 1)); if (b >= a) b++;
  return ref.map((v, i) => (i === a || i === b ? 1 - v : v));
}

/* ------------------------------------------------------------------ screens */

const $ = (s) => document.querySelector(s);
const bits = (n) => Array.from({ length: n }, () => (Math.random() < 0.5 ? 0 : 1));
let ctx = null;
function beep(freq, dur = 0.12, muted = false) {
  if (muted) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur + 0.02);
  } catch { /* no audio on this device */ }
}

/**
 * Run the four mini-games. o: { world, wid, whiskers(tips) -> html, sfx, isMuted(), onDone(result), photo: url }
 * Returns a cleanup function (stops timers and key handlers).
 */
export function groundStation(o) {
  const R = { stationWrong: 0, syncMiss: 0, signalWrong: 0, signalPeek: false, signalTimeout: false, photoWrong: 0, station: null };
  const utc = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  const right = dsnStation(Math.floor(utc));
  const ref = bits(8);
  let step = 0, timer = null, raf = null;
  const stop = () => { clearInterval(timer); cancelAnimationFrame(raf); document.onkeydown = null; };
  const STEPS = ['Point the antenna', 'Lock the sync', 'Find your signal', 'Rebuild the photo'];
  const frame = (title, body, tips) => {
    $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><h1 style="margin:0">Ground station</h1><span class="tag accent">Deep Space Network</span></div>
      <ol class="gs-steps" aria-label="Ground station steps">${STEPS.map((s, i) => `<li class="${i < step ? 'done' : i === step ? 'now' : ''}">${i + 1} ${s}</li>`).join('')}</ol>
      <h2>${title}</h2>${body}<p class="small muted">Mini-games designed by Jeongha (Operation Deep Link). Simplified teaching models of real DSN work.</p></section>`;
    $('#side').innerHTML = o.whiskers(tips);
  };
  const next = () => { stop(); step++; o.sfx.good(); const f = [station, sync, signal, photo][step]; if (f) f(); else o.onDone(R); };

  /* 1 · Point the antenna: which site faces the Moon right now? */
  function station() {
    const pos = DSN.map((s) => {
      const a = ((s.lon + utc * 15 - 180) * Math.PI) / 180; // Earth turns 15° an hour, seen from above the North Pole; 0° = toward the target
      return { ...s, x: 110 + 78 * Math.cos(a), y: 110 - 78 * Math.sin(a), ang: stationAngle(s.lon, utc) };
    });
    frame('Point the antenna', `<p>Your data is racing toward Earth. Three giant NASA dishes are spread around the planet so one can always see the spacecraft. <b>Which one is facing ${o.world.name === 'Mars' ? 'Mars' : 'the Moon'} right now?</b></p>
      <div class="gs-earth"><svg viewBox="0 0 300 220" role="img" aria-label="Earth seen from above the North Pole, with the three DSN sites and the direction of the target">
        <circle cx="110" cy="110" r="78" fill="#0c2a4a" stroke="#00e5ff" stroke-opacity=".5"/><path d="M110 32 A78 78 0 0 1 110 188 Z" fill="#000" opacity=".45"/>
        <text x="110" y="114" text-anchor="middle" fill="#8fa3c8" font-size="11">North Pole</text>
        <line x1="190" y1="110" x2="290" y2="110" stroke="#ffd23f" stroke-dasharray="5 4"/><text x="290" y="100" text-anchor="end" fill="#ffd23f" font-size="12">${o.world.name} →</text>
        <text x="20" y="20" fill="#ffb000" font-size="11">← Sun</text>
        ${pos.map((p, i) => `<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" fill="#ff2bd6"/><text x="${p.x.toFixed(1)}" y="${(p.y - 11).toFixed(1)}" text-anchor="middle" fill="#e6f1ff" font-size="11">${i + 1}</text></g>`).join('')}
      </svg></div>
      <div class="choice-grid">${pos.map((p, i) => `<button class="choice" data-st="${p.name}"><b>${i + 1} · ${p.name.split(',')[0]}</b><span class="small muted">${p.name.split(',')[1]?.trim() || ''} · longitude ${p.lon > 0 ? p.lon + '° E' : -p.lon + '° W'}</span></button>`).join('')}</div>
      <p id="gs-msg" class="lastline" aria-live="polite">Hint: the dashed arrow points at the target. Earth turns 15° every hour, so the dish nearest the arrow can see it. (Simplified: the target is drawn opposite the Sun.)</p>`,
    ['Real DSN sites are about 120° apart in longitude, so as Earth turns one of them always has the spacecraft in view.', `It is ${String(Math.floor(utc)).padStart(2, '0')}:${String(Math.floor((utc % 1) * 60)).padStart(2, '0')} UTC now; the map is drawn for this moment.`]);
    $('#main').onclick = (e) => {
      const b = e.target.closest('[data-st]'); if (!b) return;
      if (b.dataset.st === right.name) { R.station = right.name; $('#gs-msg').textContent = `Antenna pointed: ${right.name} has line of sight.`; $('#gs-msg').className = 'lastline good'; setTimeout(next, 900); }
      else { R.stationWrong++; o.sfx.bad(); b.disabled = true; $('#gs-msg').textContent = `${b.dataset.st.split(',')[0]} is on the wrong side of Earth right now. Look for the dish nearest the dashed arrow.`; }
    };
  }

  /* 2 · Lock the sync: press Space when the sweep is in the target zone */
  function sync() {
    let n = 0, t0 = performance.now();
    frame('Lock the sync', `<p>Before data, the spacecraft sends a known <b>sync pattern</b> so Earth can tell where each byte starts. Press <span class="kbd">Space</span> (or the button) each time the sweep crosses the green zone.</p>
      <div class="gs-sync" aria-hidden="true"><i class="gs-zone"></i><i class="gs-marker" id="gs-marker"></i></div>
      <div class="bits" id="gs-bits"></div>
      <div class="row"><button class="primary big" id="gs-pulse">Pulse (Space)</button><span id="gs-msg" class="small" aria-live="polite">${SYNC.pulses} pulses to lock.</span></div>`,
    ['Real receivers search for a known bit pattern called a sync marker; the rhythm here is a classroom version of that idea.', 'A miss costs a point but you can keep trying.']);
    const draw = () => { $('#gs-bits').innerHTML = ref.slice(0, SYNC.pulses).map((b, i) => `<span class="bit ${i < n ? 'correct' : i === n ? 'active' : ''}">${b}</span>`).join(''); };
    const loop = () => { const m = $('#gs-marker'); if (!m) return; m.style.left = `${(((performance.now() - t0) % SYNC.periodMs) / SYNC.periodMs) * 100}%`; raf = requestAnimationFrame(loop); };
    const press = () => {
      const phase = ((performance.now() - t0) % SYNC.periodMs) / SYNC.periodMs;
      if (!syncHit(phase)) { R.syncMiss++; o.sfx.bad(); $('#gs-msg').textContent = `Missed: wait for the green zone. (${R.syncMiss} miss${R.syncMiss > 1 ? 'es' : ''})`; return; }
      beep(ref[n] ? 680 : 440, 0.1, o.isMuted()); n++; t0 = performance.now(); draw();
      $('#gs-msg').textContent = `Locked ${n} / ${SYNC.pulses}`;
      if (n >= SYNC.pulses) { cancelAnimationFrame(raf); setTimeout(next, 600); }
    };
    $('#gs-pulse').onclick = press;
    document.onkeydown = (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); } };
    draw(); loop();
  }

  /* 3 · Find your signal: three candidates, one matches the reference */
  function signal() {
    const correct = Math.floor(Math.random() * 3);
    const cand = [0, 1, 2].map((i) => (i === correct ? [...ref] : decoy(ref)));
    let left = 25;
    const play = (p) => p.forEach((v, i) => setTimeout(() => beep(v ? 740 : 370, 0.12, o.isMuted()), i * 260));
    frame('Find your signal', `<p>The dish hears three signals. Only one is your spacecraft: it repeats the sync pattern you just locked. <b>Listen</b> to the reference, then to each signal, and lock the match.</p>
      <div class="metrics"><div><span>TIME LEFT</span><strong id="gs-time">${left}s</strong></div><div><span>REFERENCE</span><strong>${ref.join(' ')}</strong></div></div>
      <div class="row"><button class="primary" id="gs-ref">▶ Reference</button>${cand.map((_, i) => `<button data-play="${i}">▶ Signal ${i + 1}</button>`).join('')}</div>
      <div class="row">${cand.map((_, i) => `<button class="big" data-lock="${i}">Lock signal ${i + 1}</button>`).join('')}</div>
      <div id="gs-peek"></div>
      <div class="row"><button id="gs-show" class="small">Can’t use sound? Show the patterns (−1)</button><span id="gs-msg" class="small" aria-live="polite">High beep = 1, low beep = 0.</span></div>`,
    ['DSN antennas pick up signals weaker than a billionth of a billionth of a watt, then match them against known patterns.', 'The sounds are a way to hear the bits; radio waves do not make sound in space.']);
    $('#main').onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'gs-ref') play(ref);
      if (b.dataset.play) play(cand[+b.dataset.play]);
      if (b.id === 'gs-show') { R.signalPeek = true; b.disabled = true; $('#gs-peek').innerHTML = cand.map((c, i) => `<p class="mono">Signal ${i + 1}: ${c.join(' ')}</p>`).join(''); }
      if (b.dataset.lock) {
        if (+b.dataset.lock === correct) { $('#gs-msg').textContent = 'Signal locked: that is your spacecraft.'; setTimeout(next, 700); clearInterval(timer); }
        else { R.signalWrong++; o.sfx.bad(); b.disabled = true; left = Math.max(1, left - 3); $('#gs-msg').textContent = 'Not that one (−3 s). Compare the beeps again.'; }
      }
    };
    document.onkeydown = (e) => { if (['1', '2', '3'].includes(e.key)) $(`[data-lock="${+e.key - 1}"]`)?.click(); };
    timer = setInterval(() => {
      left--; const t = $('#gs-time'); if (t) t.textContent = `${left}s`;
      if (left <= 0) { clearInterval(timer); R.signalTimeout = true; $('#gs-msg').textContent = `Time is up. It was signal ${correct + 1}. The station locks on automatically.`; setTimeout(next, 1800); }
    }, 1000);
  }

  /* 4 · Rebuild the photo: majority voting on three received copies of each damaged bit */
  function photo() {
    const tiles = 8, cols = 4, reps = Array.from({ length: tiles }, () => { const b = Math.random() < 0.5 ? 0 : 1; const t = [b, b, 1 - b].sort(() => Math.random() - 0.5); return t; });
    let k = 0;
    frame('Rebuild the photo', `<p>The rover’s photo arrived, but noise damaged one bit in every tile. Each bit was sent <b>three times</b>. Pick the value that arrived at least twice: that is <b>majority voting</b>, the simplest error-correcting code.</p>
      <div class="gs-photo"><canvas id="gs-canvas" width="480" height="240" aria-label="The rover photo, tile by tile"></canvas></div>
      <p class="lastline" id="gs-msg" aria-live="polite"></p>
      <div class="input-buttons"><button type="button" id="gs-0">0<small>KEY 0</small></button><button type="button" id="gs-1">1<small>KEY 1</small></button></div>`,
    ['Real missions use much stronger codes (like Reed-Solomon and turbo codes), but the idea is the same: send extra bits so Earth can fix damage.', 'A wrong vote costs a point; the tile stays until you get it right.']);
    const img = new Image(); img.src = o.photo;
    const draw = () => {
      const c = $('#gs-canvas'); if (!c) return; const g = c.getContext('2d');
      g.fillStyle = '#0b1424'; g.fillRect(0, 0, 480, 240);
      for (let i = 0; i < tiles; i++) {
        const x = (i % cols) * 120, y = Math.floor(i / cols) * 120;
        if (i < k && img.complete && img.naturalWidth) { g.save(); g.beginPath(); g.rect(x, y, 120, 120); g.clip(); g.drawImage(img, 0, 0, 480, 240); g.restore(); }
        else { for (let n = 0; n < 60; n++) { g.fillStyle = `rgba(0,229,255,${Math.random() * 0.25})`; g.fillRect(x + Math.random() * 116, y + Math.random() * 116, 4, 4); } }
        g.strokeStyle = 'rgba(0,229,255,.35)'; g.strokeRect(x + 0.5, y + 0.5, 119, 119);
      }
      $('#gs-msg').textContent = k < tiles ? `Tile ${k + 1} of ${tiles} · received copies: ${reps[k].join('  |  ')}` : 'Photo rebuilt: every tile restored.';
    };
    img.onload = draw;
    const vote = (v) => {
      if (k >= tiles) return;
      if (v !== majority(reps[k])) { R.photoWrong++; o.sfx.bad(); $('#gs-msg').textContent = `Count again: ${reps[k].join(', ')}. Which value appears twice?`; return; }
      beep(620, 0.08, o.isMuted()); k++; draw();
      if (k >= tiles) setTimeout(next, 1100);
    };
    $('#gs-0').onclick = () => vote(0); $('#gs-1').onclick = () => vote(1);
    document.onkeydown = (e) => { if (e.key === '0') vote(0); if (e.key === '1') vote(1); };
    draw();
  }

  station();
  return stop;
}
