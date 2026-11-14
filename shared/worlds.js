// Destinations. Physical constants from NASA/JPL planetary data (GM in km^3/s^2, radius in km).
// Light time is the one-way signal delay to Earth in seconds (min..max over the year).
// dayHours = solar day (sunrise to sunrise); rotHours = sidereal rotation (one turn relative to the stars).

export const WORLDS = {
  moon: {
    id: 'moon', name: 'Moon', tier: 'main', tierLabel: 'Main campaign',
    gm: 4902.8, radiusKm: 1737.4, gravity: 1.62, dayHours: 708.7, rotHours: 655.72,
    lightSec: [1.25, 1.35], vInfKms: 0.8,
    site: { name: 'Shackleton crater rim, south pole', latDeg: -89.5 },
    texture: 'shared/textures/moon.jpg', tint: '#c9c4b8',
    blurb: 'Water ice hides in craters that never see the Sun. Artemis astronauts will need it.',
    roverTarget: 'ice', missions: ['orbit', 'rover', 'comms'],
    source: 'NASA LRO Wide Angle Camera mosaic and LOLA laser altimeter, via NASA Moon Trek',
  },
  mars: {
    id: 'mars', name: 'Mars', tier: 'bonus', tierLabel: 'Bonus campaign',
    gm: 42828.37, radiusKm: 3389.5, gravity: 3.71, dayHours: 24.66, rotHours: 24.623,
    lightSec: [182, 1342], vInfKms: 2.6,
    site: { name: 'Jezero crater, an ancient river delta', latDeg: 18.4 },
    texture: 'shared/textures/mars.jpg', tint: '#c97b4a',
    blurb: 'Perseverance collects rock samples here. Signals take 3 to 22 minutes each way.',
    roverTarget: 'samples', missions: ['orbit', 'rover', 'comms'],
    source: 'NASA Viking colour mosaic, MGS MOLA and MRO CTX, via NASA Mars Trek',
  },
  mercury: {
    id: 'mercury', name: 'Mercury', tier: 'challenge', tierLabel: 'Orbit challenge',
    gm: 22031.8, radiusKm: 2439.4, gravity: 3.7, dayHours: 4222.6, rotHours: 1407.6,
    lightSec: [260, 740], vInfKms: 6.5,
    site: { name: 'Shadowed craters near the north pole', latDeg: 85.8 },
    texture: 'shared/textures/mercury.jpg', tint: '#a9a39b',
    blurb: 'Closest to the Sun and the hardest to reach: you need a lot of fuel to slow down.',
    roverTarget: null, missions: ['orbit'],
    source: 'NASA MESSENGER MDIS mosaic, via NASA Mercury Trek',
  },
  ceres: {
    id: 'ceres', name: 'Ceres', tier: 'challenge', tierLabel: 'Orbit challenge',
    gm: 62.6284, radiusKm: 469.7, gravity: 0.28, dayHours: 9.07, rotHours: 9.074,
    lightSec: [790, 1660], vInfKms: 1.0,
    site: { name: 'Occator crater bright spots', latDeg: 19.8 },
    texture: 'shared/textures/ceres.jpg', tint: '#8f8a83',
    blurb: 'A dwarf planet with salty bright spots. Gravity is so weak that orbits are slow and gentle.',
    roverTarget: null, missions: ['orbit'],
    source: 'NASA Dawn Framing Camera mosaic, via NASA Ceres Trek',
  },
};

export const MISSIONS = {
  orbit: { id: 'orbit', n: 1, title: 'Orbit', long: 'Place the relay satellite', href: 'missions/orbit/index.html' },
  rover: { id: 'rover', n: 2, title: 'Rover', long: 'Land and dig', href: 'missions/rover/index.html' },
  comms: { id: 'comms', n: 3, title: 'Comms', long: 'Send the science home', href: 'missions/comms/index.html' },
};

export function lightDelayText(world) {
  const [a, b] = world.lightSec;
  if (b < 60) return `${a.toFixed(1)} s`;
  return `${Math.round(a / 60)}–${Math.round(b / 60)} min`;
}
