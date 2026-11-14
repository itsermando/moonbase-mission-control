// Mission 3 signal maths: compression, parity bits, noise, and a 5-bit letter code for Earth's commands.
// Pure functions (no screen code) so they can be tested.

export const COMPRESSION = [
  { id: 'none', name: 'No compression', bitsX: 1, valueX: 1, info: 'Send every detail. The most bits to type.' },
  { id: 'smart', name: 'Smart compression', bitsX: 0.6, valueX: 0.9, info: 'Like a good photo format: 40% fewer bits, a little detail lost.' },
  { id: 'max', name: 'Maximum compression', bitsX: 0.4, valueX: 0.65, info: 'Tiny files, but scientists lose a third of the detail.' },
];
export const CHECKS = [
  { id: 'none', name: 'No error check', info: 'Fastest. If noise flips a bit, nobody notices and that packet is ruined.' },
  { id: 'parity', name: 'Parity bit on every byte', info: 'One extra bit per 8 tells Earth if a byte was damaged, so you can resend it.' },
];
export const NOISE = { moon: 0.035, mars: 0.07 }; // chance that a sent bit flips

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }

/** Bits for one packet after compression, split into bytes (8 data bits each, last may be shorter). */
export function packetBytes(packet, compression) {
  const n = Math.max(4, Math.round((packet.bits * compression.bitsX) / 4) * 4);
  const r = rng(hash(packet.id + compression.id));
  const bits = Array.from({ length: n }, () => (r() < 0.5 ? '0' : '1')).join('');
  return bits.match(/.{1,8}/g);
}

/** Even parity: the extra bit makes the count of 1s even. */
export const parityBit = (byte) => String([...byte].filter((b) => b === '1').length % 2);
export const withParity = (byte) => byte + parityBit(byte);
export const parityOk = (byte9) => [...byte9].filter((b) => b === '1').length % 2 === 0;

/** Send bits through a noisy channel: each bit may flip with probability p. */
export function transmit(bits, p, rand = Math.random) {
  return [...bits].map((b) => (rand() < p ? (b === '1' ? '0' : '1') : b)).join('');
}

/**
 * Game version of noise for one byte: at most ONE bit flips, with the same overall chance as flipping each bit
 * independently. A single flip is always caught by parity, which keeps the lesson clear.
 */
export function transmitByte(bits, p, rand = Math.random) {
  const pByte = 1 - (1 - p) ** bits.length;
  if (rand() >= pByte) return bits;
  const i = Math.floor(rand() * bits.length);
  return bits.slice(0, i) + (bits[i] === '1' ? '0' : '1') + bits.slice(i + 1);
}

/** Plan totals: how many bits the player must type, and the most science that could arrive. */
export function planTotals(packets, compression, check) {
  let bits = 0, value = 0;
  for (const p of packets) {
    const bytes = packetBytes(p, compression);
    bits += bytes.reduce((a, b) => a + b.length + (check.id === 'parity' ? 1 : 0), 0);
    value += p.value * compression.valueX;
  }
  return { bits, value: Math.round(value) };
}

export const TYPE_BPS = 2.2; // a typical player types about 2 bits per second

/**
 * Expected result of a plan, calculated before the player commits (the maths the analyst shows).
 * packets are in send order. Packets are sent whole and in order, so once one does not fit, nothing after it is sent.
 * With parity every flipped byte is caught and retyped (more bits, no damage); without it a flip silently ruins the packet.
 */
export function forecastPlan({ packets, compression, check, windowS, noise }) {
  const parity = check.id === 'parity', budget = windowS * TYPE_BPS;
  let used = 0, valueIfClean = 0, valueExpected = 0, pAllClean = 1, fits = true;
  const sent = [], dropped = [];
  for (const p of packets) {
    let bits = 0, pOk = 1;
    for (const byte of packetBytes(p, compression)) {
      const len = byte.length + (parity ? 1 : 0), pFlip = 1 - (1 - noise) ** len;
      if (parity) bits += len / (1 - pFlip); else { bits += len; pOk *= 1 - pFlip; }
    }
    if (!fits || used + bits > budget) { fits = false; dropped.push(p.id); continue; }
    used += bits; sent.push(p.id);
    const v = p.value * compression.valueX;
    valueIfClean += v; valueExpected += v * pOk; pAllClean *= pOk;
  }
  return { sent, dropped, bitsNeeded: used, budget, timeLeftS: Math.max(0, (budget - used) / TYPE_BPS), valueIfClean, valueExpected, pAllClean };
}

/** Up to three different plans that all fit the window: most science, safest, and quickest. Uses only forecastPlan. */
export function planChoices(packets, { windowS, noise }) {
  const maxValue = packets.reduce((a, p) => a + p.value, 0) || 1;
  const byDensity = [...packets].sort((a, b) => b.value / b.bits - a.value / a.bits);
  const sciOf = (v) => Math.round(60 * Math.min(1, v / maxValue));
  const cands = [];
  for (const comp of COMPRESSION) for (const check of CHECKS) for (let k = 1; k <= byDensity.length; k++) {
    const chosen = byDensity.slice(0, k);
    const f = forecastPlan({ packets: chosen, compression: comp, check, windowS, noise });
    if (f.dropped.length) continue;
    cands.push({ key: `${comp.id}|${check.id}|${k}`, comp, check, chosen, f, sci: sciOf(f.valueExpected) });
  }
  if (!cands.length) return { choices: [], maxValue };
  const used = new Set();
  const take = (pool, cmp) => { const c = pool.filter((x) => !used.has(x.key)).sort(cmp)[0]; if (c) used.add(c.key); return c; };
  const best = Math.max(...cands.map((c) => c.sci));
  const picks = [
    ['science', 'Most science', take(cands, (a, b) => b.sci - a.sci || b.f.timeLeftS - a.f.timeLeftS), 'The highest expected science that fits the window.'],
    ['safe', 'Safe and clean', take(cands.filter((c) => c.check.id === 'parity'), (a, b) => b.sci - a.sci || b.f.timeLeftS - a.f.timeLeftS), 'Parity on every byte, so noise cannot silently ruin a packet.'],
    ['quick', 'Quick and light', take(cands.filter((c) => c.sci >= best * 0.7), (a, b) => b.f.timeLeftS - a.f.timeLeftS || b.sci - a.sci), 'Keeps at least 70% of the best science and leaves the most time spare.'],
  ];
  const choices = picks.filter(([, , c]) => c).map(([id, title, c, why]) => {
    const f = c.f, clean = sciOf(f.valueIfClean), pDamaged = 1 - f.pAllClean;
    const damaged = pDamaged > 0.0001 ? sciOf((f.valueExpected - f.pAllClean * f.valueIfClean) / pDamaged) : clean;
    const branches = c.check.id === 'parity'
      ? [{ text: `Every byte checked: ${clean} science points, about ${Math.round(f.timeLeftS)} s to spare`, tone: 'good' }]
      : [{ p: f.pAllClean, text: `Every packet arrives intact: ${clean} science points`, tone: 'good' },
         { p: pDamaged, text: `Noise ruins a packet: about ${damaged} points`, tone: 'bad' }].filter((b) => b.p >= 0.005);
    return {
      id, title, why, sci: c.sci, metrics: { bits: Math.round(f.bitsNeeded), budget: Math.round(f.budget), timeLeftS: Math.round(f.timeLeftS), clean, damaged },
      plan: { order: [...c.chosen.map((p) => p.id), ...packets.filter((p) => !c.chosen.includes(p)).map((p) => p.id)], skip: packets.filter((p) => !c.chosen.includes(p)).map((p) => p.id), comp: c.comp.id, check: c.check.id },
      summary: `${c.chosen.length} of ${packets.length} packets, ${c.comp.name.toLowerCase()}, ${c.check.id === 'parity' ? 'parity on' : 'no error check'}. ${why}`,
      branches, recommended: false,
    };
  });
  if (choices.length) choices.reduce((a, b) => (b.sci > a.sci ? b : a)).recommended = true;
  return { choices, maxValue };
}

/** 5-bit letter code: A=00001 ... Z=11010 (like early teleprinter codes, simplified). */
export const encodeLetter = (ch) => (ch.toUpperCase().charCodeAt(0) - 64).toString(2).padStart(5, '0');
export const decodeGroup = (bits) => String.fromCharCode(64 + parseInt(bits, 2));
export const encodeWord = (w) => [...w.toUpperCase()].map(encodeLetter);
export const decodeWord = (groups) => groups.map(decodeGroup).join('');

export const COMMANDS = ['DRILL', 'SCAN', 'HOME', 'MAP', 'DIG', 'WAKE', 'SOLAR', 'ROVE'];

/** NASA Deep Space Network: three stations about 120° apart so one always faces the spacecraft. */
export const DSN = [
  { name: 'Goldstone, USA', lon: -116.9 }, { name: 'Madrid, Spain', lon: -4.2 }, { name: 'Canberra, Australia', lon: 149.0 },
];
/** Simplified: the station whose local time is closest to midnight-to-noon "facing out" for a target opposite the Sun. */
export function dsnStation(utcHour) {
  const facing = ((180 - utcHour * 15 + 540) % 360) - 180; // longitude where it is local midnight
  return DSN.reduce((best, s) => (Math.abs(((s.lon - facing + 540) % 360) - 180) < Math.abs(((best.lon - facing + 540) % 360) - 180) ? s : best));
}
