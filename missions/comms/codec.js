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
