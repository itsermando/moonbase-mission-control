// Cat astronaut avatars and the CAPCOM Whiskers mascot, drawn as inline SVG (no image files).

const FUR = [
  ['#F2A35E', '#C9773A'], // ginger
  ['#9AA3AF', '#6E7784'], // grey
  ['#3B3F4A', '#23262E'], // black
  ['#F1ECE2', '#CFC6B6'], // white
  ['#D9B98C', '#8C6239'], // tabby
  ['#7F93B5', '#56688A'], // blue
];
export const AVATAR_NAMES = ['Ginger', 'Grey', 'Shadow', 'Snow', 'Tabby', 'Blue'];

/** A cat face inside a space helmet. */
export function catSVG(variant = 0, size = 40, { title = '' } = {}) {
  const [fur, dark] = FUR[((variant % FUR.length) + FUR.length) % FUR.length];
  const eye = variant === 2 ? '#F2C14E' : '#1B2235';
  return `<svg class="cat" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${title || AVATAR_NAMES[variant % 6] + ' cat astronaut'}">
    <circle cx="32" cy="34" r="28" fill="#0E1424" stroke="#7FD4F0" stroke-width="3"/>
    <path d="M14 30 L18 12 L27 22 Z" fill="${fur}" stroke="${dark}" stroke-width="1.5"/>
    <path d="M50 30 L46 12 L37 22 Z" fill="${fur}" stroke="${dark}" stroke-width="1.5"/>
    <ellipse cx="32" cy="36" rx="18" ry="16" fill="${fur}" stroke="${dark}" stroke-width="1.5"/>
    <ellipse cx="25" cy="33" rx="3" ry="4" fill="${eye}"/><ellipse cx="39" cy="33" rx="3" ry="4" fill="${eye}"/>
    <circle cx="26" cy="31.5" r="1" fill="#fff"/><circle cx="40" cy="31.5" r="1" fill="#fff"/>
    <path d="M30 40 L34 40 L32 42.5 Z" fill="#E87A8C"/>
    <path d="M32 42.5 Q29 46 26 44 M32 42.5 Q35 46 38 44" fill="none" stroke="${dark}" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M16 39 L6 37 M16 42 L7 44 M48 39 L58 37 M48 42 L57 44" stroke="${dark}" stroke-width="1" stroke-linecap="round"/>
    <path d="M12 20 A26 26 0 0 1 30 8" fill="none" stroke="#FFFFFF" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

/** CAPCOM Whiskers: the guide cat with a headset. */
export function whiskersSVG(size = 44) {
  return catSVG(0, size, { title: 'CAPCOM Whiskers' }).replace('</svg>',
    '<path d="M10 34 Q10 14 32 12 Q54 14 54 34" fill="none" stroke="#F2A93B" stroke-width="3"/><rect x="6" y="31" width="7" height="10" rx="3" fill="#F2A93B"/><path d="M9 41 Q12 50 22 50" fill="none" stroke="#F2A93B" stroke-width="2"/><circle cx="23" cy="50" r="2.2" fill="#F2A93B"/></svg>');
}
