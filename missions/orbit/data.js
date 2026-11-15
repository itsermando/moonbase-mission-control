// Orbit mission catalogue: rockets, satellite parts, goals and real-mission presets per world.

export const BUDGET_M = 200;
export const BUS = { name: 'Satellite body, computer and thrusters', massKg: 120, costM: 40, powerW: 40 };

// payload to a transfer orbit toward the Moon; farther worlds take a smaller share (more energy needed)
export const ROCKETS = [
  { id: 'small', name: 'Small launcher', capKg: 350, costM: 20, info: 'Cheap and quick, but carries very little.' },
  { id: 'medium', name: 'Medium launcher', capKg: 1200, costM: 60, info: 'The workhorse: most relay satellites fly on one of these.' },
  { id: 'heavy', name: 'Heavy launcher', capKg: 4000, costM: 140, info: 'Lifts anything you like, but eats most of the budget.' },
];
export const PAYLOAD_FACTOR = { moon: 1, mars: 0.55, mercury: 0.35, ceres: 0.4, vesta: 0.4 };

export const ANTENNAS = [
  { id: 'patch', name: 'Small patch antenna', massKg: 5, costM: 5, powerW: 30, rate: 1, info: 'Light, slow data.' },
  { id: 'dish', name: 'Medium dish', massKg: 15, costM: 12, powerW: 60, rate: 2, info: 'Twice the data rate.' },
  { id: 'big', name: 'Large dish', massKg: 35, costM: 25, powerW: 120, rate: 4, info: 'Four times the data. Heavy and power-hungry.' },
];
export const POWER = [
  { id: 'solarS', name: 'Small solar wings (150 W)', massKg: 20, costM: 6, powerW: 150, info: 'Enough for a small antenna.' },
  { id: 'solarL', name: 'Large solar wings (400 W)', massKg: 45, costM: 14, powerW: 400, info: 'Powers any antenna.' },
];

// Operations event: a solar storm. Safe mode costs a known time; keeping the antenna on risks a longer reset.
// Expected loss is about equal on purpose (0.4 x 14 h vs 6 h), so the choice is about risk, not a trick.
export const STORM = { safeH: 6, resetH: 14, hitChance: 0.4 };

export const GOALS = { moon: 0.5, mars: 0.35, mercury: 0.35, ceres: 0.3, vesta: 0.3 };
export const LIMITS = {
  moon: { minPeri: 20, maxApo: 75000 }, mars: { minPeri: 120, maxApo: 25000 },
  mercury: { minPeri: 200, maxApo: 16000 }, ceres: { minPeri: 50, maxApo: 6000 },
  vesta: { minPeri: 30, maxApo: 5000 },
};

// Presets based on real orbits (simplified to two-body ellipses)
export const PRESETS = {
  moon: [
    { name: 'Low polar orbit', like: 'like NASA LRO', p: { periAltKm: 50, apoAltKm: 50, incDeg: 90, argpDeg: 90 } },
    { name: 'Elliptical frozen orbit', like: 'inspired by ESA Lunar Pathfinder', p: { periAltKm: 800, apoAltKm: 8000, incDeg: 60, argpDeg: 90 } },
    { name: 'Halo-style orbit', like: 'like NASA Gateway’s NRHO, simplified', p: { periAltKm: 3000, apoAltKm: 70000, incDeg: 90, argpDeg: 90 } },
  ],
  mars: [
    { name: 'Low polar orbit', like: 'like NASA MRO', p: { periAltKm: 255, apoAltKm: 320, incDeg: 93, argpDeg: 90 } },
    { name: 'Elliptical orbit', like: 'like NASA MAVEN', p: { periAltKm: 150, apoAltKm: 6200, incDeg: 75, argpDeg: 270 } },
    { name: 'Areostationary orbit', like: 'Mars’s version of a geostationary orbit', p: { periAltKm: 17032, apoAltKm: 17032, incDeg: 0, argpDeg: 0 } },
  ],
  mercury: [
    { name: 'Low polar orbit', like: 'a simple mapping orbit', p: { periAltKm: 200, apoAltKm: 200, incDeg: 90, argpDeg: 270 } },
    { name: 'Elliptical orbit', like: 'like NASA MESSENGER', p: { periAltKm: 200, apoAltKm: 15200, incDeg: 82.5, argpDeg: 90 } },
    { name: 'Flipped elliptical orbit', like: 'MESSENGER’s orbit turned over', p: { periAltKm: 500, apoAltKm: 15000, incDeg: 85, argpDeg: 270 } },
  ],
  ceres: [
    { name: 'Low mapping orbit', like: 'like NASA Dawn’s LAMO', p: { periAltKm: 385, apoAltKm: 385, incDeg: 90, argpDeg: 270 } },
    { name: 'High mapping orbit', like: 'like NASA Dawn’s HAMO', p: { periAltKm: 1470, apoAltKm: 1470, incDeg: 90, argpDeg: 270 } },
    { name: 'Elliptical orbit', like: 'a custom design', p: { periAltKm: 400, apoAltKm: 5000, incDeg: 30, argpDeg: 270 } },
  ],
  vesta: [
    { name: 'Low mapping orbit', like: 'like NASA Dawn’s LAMO', p: { periAltKm: 210, apoAltKm: 210, incDeg: 90, argpDeg: 90 } },
    { name: 'High mapping orbit', like: 'like NASA Dawn’s HAMO', p: { periAltKm: 680, apoAltKm: 680, incDeg: 90, argpDeg: 90 } },
    { name: 'Elliptical orbit', like: 'between Dawn’s survey and mapping orbits', p: { periAltKm: 210, apoAltKm: 2700, incDeg: 90, argpDeg: 90 } },
  ],
};

export const GLOSSARY = [
  ['Orbit', 'A path around a world. The satellite is always falling, but moving sideways so fast it keeps missing the ground.'],
  ['Periapsis / apoapsis', 'The lowest and highest points of an elliptical orbit. A satellite moves fastest at periapsis and slowest at apoapsis.'],
  ['Inclination', 'How tilted the orbit is. 90° passes over both poles; 0° follows the equator.'],
  ['Kepler’s third law', 'Bigger orbits take longer: the period grows with the orbit size to the power 1.5.'],
  ['Delta-v', 'The change in speed an engine must make. More delta-v needs much more fuel (the rocket equation).'],
  ['Relay satellite', 'A satellite that passes messages between a lander and Earth when they can’t see each other.'],
  ['Elevation angle', 'How high the satellite is above the horizon seen from the base. Below about 10° the signal is blocked.'],
];

// What the satellite is FOR. Every profile is a relay first; two of them also carry a science instrument,
// which pulls the orbit design in a different direction (sharp pictures want a LOW orbit, a relay wants a HIGH one).
export const PROFILES = [
  { id: 'relay', name: 'Pure relay', icon: '📡', ins: 'none',
    what: 'Pass every message between the rover and Earth.',
    why: 'From the crater rim Earth sits on the horizon or below it, so the rover can almost never call home directly.',
    how: 'High orbit with its slow, high point over the base: long contact windows. No camera to carry.',
    tradeoff: 'Cheapest and lightest. Easiest to get a high score, but no science of its own.' },
  { id: 'scout', name: 'Relay + hazard scout', icon: '🛰️', ins: 'scout',
    what: 'Relay messages AND photograph boulders and slopes where the rover will drive.',
    why: 'Real rovers are guided by orbital pictures: NASA plans every Perseverance drive with MRO images.',
    how: 'A sharp camera needs the satellite close to the ground, but a relay wants to be high. Find the compromise.',
    tradeoff: 'Hardest choice: the camera adds mass, power and cost, and fights the relay for altitude.' },
  { id: 'prospector', name: 'Relay + ice hunter', icon: '🧊', ins: 'prospector',
    what: 'Relay messages AND sniff out buried water ice from orbit.',
    why: 'Neutron detectors on LRO found hydrogen in the polar craters: that is how we know where to dig.',
    how: 'The detector sees a blurry patch about as wide as its altitude, so it only works when the orbit dips low over the pole.',
    tradeoff: 'Medium difficulty: light instrument, but you need a low periapsis over the base.' },
];
// Which real instrument each profile flies on each world (ids from instruments.js)
export const PROFILE_INS = {
  scout: { moon: 'nac', mars: 'hirise', mercury: 'mdis-n', ceres: 'fc', vesta: 'fc' },
  prospector: { moon: 'lend', mars: 'sharad', mercury: 'grns', ceres: 'grand', vesta: 'grand' },
};

// Radiation protection for the computer. 'standard' is what the bus already has (no extra mass or cost).
export const SHIELDS = [
  { id: 'none', name: 'Bare electronics', massKg: 0, costM: -4, hit: 0.65, info: 'Saves $4M by using ordinary chips. A solar storm will very likely reset the computer.' },
  { id: 'standard', name: 'Standard shielding', massKg: 0, costM: 0, hit: 0.4, info: 'Aluminium box around the computer, already in the body. A storm resets it 4 times in 10.' },
  { id: 'hardened', name: 'Radiation-hardened', massKg: 15, costM: 10, hit: 0.1, info: 'Thick shielding and space-grade chips, like deep-space probes. Only 1 storm in 10 gets through.' },
];

// Short, plain explanations for every number the player sees. Shown on hover, focus or tap.
export const TIPS = {
  rocket: 'The rocket throws your satellite toward the target. Its capacity is the most it can carry, satellite plus fuel.',
  antenna: 'A bigger dish focuses the radio beam more tightly, so more data per second reaches Earth. It also needs more power.',
  power: 'Solar wings turn sunlight into electricity. They must cover the computer plus the antenna, or the satellite browns out.',
  instrument: 'An optional science tool. It adds mass, power and cost, and works best at a particular height.',
  shield: 'Space radiation can flip bits in the computer and force a reset. Shielding costs mass and money but lowers the risk.',
  periAltKm: 'Periapsis: the LOWEST point of the orbit, measured above the ground. The satellite moves fastest here.',
  apoAltKm: 'Apoapsis: the HIGHEST point of the orbit. The satellite moves slowest here, so it lingers over whatever is below.',
  incDeg: 'Inclination: how tilted the orbit is. 90° flies over both poles, 0° follows the equator. A polar base needs about 90°.',
  argpDeg: 'Argument of periapsis ω: where the lowest point sits along the orbit. 90° puts the high, slow point over the south pole.',
  a: 'Semi-major axis: half the longest width of the ellipse. It alone sets the period (Kepler’s third law).',
  e: 'Eccentricity: 0 is a circle, close to 1 is a long, thin ellipse.',
  T: 'Period: time for one full lap around the world.',
  speed: 'Orbital speed at the lowest and highest points, from the vis-viva equation v² = GM (2/r − 1/a).',
  dv: 'Δv (delta-v): how much the engine must change the speed to brake into orbit. More Δv needs far more fuel.',
  fuel: 'Fuel needed for the brake burn, from the rocket equation, plus 10% spare for small corrections.',
  coverage: 'Share of time the base can see the satellite at least 10° above its horizon, so the rover can talk to Earth.',
  window: 'A contact window is one pass when the base can talk. The gap is the longest wait between passes.',
  gsd: 'Ground sample distance: how big one pixel of the picture is on the ground. Smaller is sharper.',
  swath: 'Swath: how wide a strip of ground the instrument sees on each pass.',
  mapTime: 'How long the instrument needs to cover the whole world once, strip by strip.',
  launchMass: 'Satellite (dry mass) plus fuel. It must fit inside the rocket’s capacity.',
  budget: 'Total cost of rocket, body and parts. The mission has $200M.',
  powerBal: 'Electricity made by the wings compared with what the computer, antenna and instrument use.',
};
