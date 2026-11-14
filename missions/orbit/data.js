// Orbit mission catalogue: rockets, satellite parts, goals and real-mission presets per world.

export const BUDGET_M = 200;
export const BUS = { name: 'Satellite body, computer and thrusters', massKg: 120, costM: 40, powerW: 40 };

// payload to a transfer orbit toward the Moon; farther worlds take a smaller share (more energy needed)
export const ROCKETS = [
  { id: 'small', name: 'Small launcher', capKg: 350, costM: 20, info: 'Cheap and quick, but carries very little.' },
  { id: 'medium', name: 'Medium launcher', capKg: 1200, costM: 60, info: 'The workhorse: most relay satellites fly on one of these.' },
  { id: 'heavy', name: 'Heavy launcher', capKg: 4000, costM: 140, info: 'Lifts anything you like, but eats most of the budget.' },
];
export const PAYLOAD_FACTOR = { moon: 1, mars: 0.55, mercury: 0.35, ceres: 0.4 };

export const ANTENNAS = [
  { id: 'patch', name: 'Small patch antenna', massKg: 5, costM: 5, powerW: 30, rate: 1, info: 'Light, slow data.' },
  { id: 'dish', name: 'Medium dish', massKg: 15, costM: 12, powerW: 60, rate: 2, info: 'Twice the data rate.' },
  { id: 'big', name: 'Large dish', massKg: 35, costM: 25, powerW: 120, rate: 4, info: 'Four times the data. Heavy and power-hungry.' },
];
export const POWER = [
  { id: 'solarS', name: 'Small solar wings (150 W)', massKg: 20, costM: 6, powerW: 150, info: 'Enough for a small antenna.' },
  { id: 'solarL', name: 'Large solar wings (400 W)', massKg: 45, costM: 14, powerW: 400, info: 'Powers any antenna.' },
];

export const GOALS = { moon: 0.5, mars: 0.35, mercury: 0.35, ceres: 0.3 };
export const LIMITS = {
  moon: { minPeri: 20, maxApo: 75000 }, mars: { minPeri: 120, maxApo: 25000 },
  mercury: { minPeri: 200, maxApo: 16000 }, ceres: { minPeri: 50, maxApo: 6000 },
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
