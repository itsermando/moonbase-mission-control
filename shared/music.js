// Soundtrack: an original ambient score generated live with Web Audio (no music files, nothing copyrighted),
// plus short NASA public-domain recordings (Apollo 11 and Sputnik) played at key moments.
import { isMuted } from './fx.js';

const KEY = 'smg.music';
let ctx = null, out = null, on = false, timers = [], voices = [];
export const isPlaying = () => on;
export const isMusicOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };

// D Lydian / Dorian colours: open, spacey chords that never resolve too hard
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const CHORDS = [[50, 57, 64, 69, 76], [48, 55, 62, 67, 74], [46, 53, 60, 65, 72], [45, 52, 59, 64, 71], [43, 50, 57, 62, 69]];
const SPARKLE = [74, 76, 78, 81, 83, 86, 88, 90, 93];

function reverb(a, seconds = 4.5) {
  const len = a.sampleRate * seconds, buf = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
  const cv = a.createConvolver(); cv.buffer = buf; return cv;
}

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  out = ctx.createGain(); out.gain.value = 0;
  const dry = ctx.createGain(); dry.gain.value = 0.55;
  const wet = ctx.createGain(); wet.gain.value = 0.9;
  const rv = reverb(ctx);
  out.connect(dry).connect(ctx.destination); out.connect(rv).connect(wet).connect(ctx.destination);
}

function pad(chord, t0, dur) {
  const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = 0.7;
  filt.frequency.setValueAtTime(380, t0); filt.frequency.linearRampToValueAtTime(1300, t0 + dur * 0.5); filt.frequency.linearRampToValueAtTime(420, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + dur * 0.3); g.gain.linearRampToValueAtTime(0, t0 + dur);
  filt.connect(g).connect(out);
  for (const m of chord) for (const det of [-7, 6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
    o.connect(filt); o.start(t0); o.stop(t0 + dur + 0.1); voices.push(o);
  }
  const sub = ctx.createOscillator(), sg = ctx.createGain(); sub.type = 'sine'; sub.frequency.value = hz(chord[0] - 12);
  sg.gain.setValueAtTime(0, t0); sg.gain.linearRampToValueAtTime(0.12, t0 + dur * 0.4); sg.gain.linearRampToValueAtTime(0, t0 + dur);
  sub.connect(sg).connect(out); sub.start(t0); sub.stop(t0 + dur + 0.1); voices.push(sub);
}

function sparkle() {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = hz(SPARKLE[Math.floor(Math.random() * SPARKLE.length)]);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; o.connect(g).connect(pan).connect(out); } else o.connect(g).connect(out);
  o.start(t); o.stop(t + 3);
}

// a soft rush of filtered noise now and then, like a radio listening to the solar wind
function wind() {
  const t = ctx.currentTime, len = ctx.sampleRate * 6, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 3); f.frequency.exponentialRampToValueAtTime(500, t + 6);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 2.5); g.gain.linearRampToValueAtTime(0, t + 6);
  s.connect(f).connect(g).connect(out); s.start(t);
}

export function startMusic() {
  if (on || isMuted()) return;
  try { if (!ctx) setup(); } catch { return; }
  ctx.resume(); on = true;
  out.gain.cancelScheduledValues(ctx.currentTime); out.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 3);
  let k = 0; const BAR = 11;
  const next = () => { voices = voices.slice(-60); pad(CHORDS[k++ % CHORDS.length], ctx.currentTime + 0.05, BAR + 4); };
  next(); timers.push(setInterval(next, BAR * 1000));
  const sp = () => { if (on) { sparkle(); timers.push(setTimeout(sp, 1400 + Math.random() * 3200)); } };
  timers.push(setTimeout(sp, 2500));
  timers.push(setInterval(() => { if (Math.random() < 0.6) wind(); }, 17000));
}

export function stopMusic() {
  if (!on) return; on = false;
  timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); timers = [];
  const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 1.2);
  const vs = voices; voices = []; setTimeout(() => vs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }), 1400);
}

export function setMusic(v) {
  try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* storage blocked */ }
  if (v) startMusic(); else stopMusic();
  window.dispatchEvent(new Event('musicchange'));
}

/** Start the score after the first click or key press (browsers block sound before that). */
export function initMusic() {
  if (!isMusicOn()) return;
  const go = (e) => { window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); if (e.target?.closest?.('[data-music]')) return; if (isMusicOn()) startMusic(); };
  window.addEventListener('pointerdown', go); window.addEventListener('keydown', go);
}

// NASA public-domain recordings (nasa.gov), see the credits page
const CLIPS = { eagle: 'eagle-has-landed.mp3', step: 'one-small-step.mp3', sputnik: 'sputnik-beep.mp3' };
let base = '';
export function setAudioBase(b) { base = b; }
export function playClip(name, volume = 0.8) {
  if (isMuted() || !CLIPS[name]) return;
  const a = new Audio(`${base}shared/audio/${CLIPS[name]}`); a.volume = volume;
  if (on && out) { out.gain.setTargetAtTime(0.35, ctx.currentTime, 0.3); a.onended = () => on && out.gain.setTargetAtTime(0.9, ctx.currentTime, 1); }
  a.play().catch(() => { /* blocked until the player interacts */ });
}
