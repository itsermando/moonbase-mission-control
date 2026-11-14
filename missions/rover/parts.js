// Rover mission catalogue: objectives, limits and parts.
// Numbers are game-balanced but anchored on real hardware where noted.

export const LIMITS = {
  landerCapacityKg: 450,   // what the lander can carry to the surface
  budgetM: 400,            // total money in $ millions
  missionHours: 336,       // 14 Earth days of sunlight before the long night
  testCostM: 5,            // each test campaign costs money
  baseLoadW: 50,           // computer, cameras and radio idle power
};

export const BUS = { name: 'Rover body, computer and cameras', massKg: 120, costM: 110 };

export const OBJECTIVES = [
  {
    id: 'base', level: 'Easy', title: 'Build the base',
    goal: 'Dig 1,500 kg of regolith (moon soil) for landing pads and radiation walls.',
    metric: 'regolith', target: 1500, unit: 'kg regolith',
  },
  {
    id: 'ice', level: 'Medium', title: 'Ice hunter',
    goal: 'Extract 12 kg of water ice from cold traps: small shadowed craters on the plateau.',
    metric: 'water', target: 12, unit: 'kg water',
  },
  {
    id: 'dark', level: 'Hard', title: 'Into the dark',
    goal: 'Extract 25 kg of water ice. The richest ice is on the floor of Shackleton crater, which never sees sunlight.',
    metric: 'water', target: 25, unit: 'kg water',
  },
];

// Mars (bonus campaign): collect rock samples like NASA Perseverance, which cores rocks into sample tubes.
export const MARS_OBJECTIVES = [
  {
    id: 'm-first', level: 'Easy', title: 'First samples',
    goal: 'Core 3 rock samples anywhere in Jezero crater.',
    metric: 'samples', target: 3, needKinds: [], unit: 'samples',
  },
  {
    id: 'm-delta', level: 'Medium', title: 'Delta explorer',
    goal: 'Core 5 samples, including 2 from the ancient river delta, where life could have left traces.',
    metric: 'samples', target: 5, needKinds: ['delta', 'delta'], unit: 'samples',
  },
  {
    id: 'm-story', level: 'Hard', title: 'The story of Jezero',
    goal: 'Core 6 samples that tell the crater’s story: at least one each from the floor, the delta and the rim.',
    metric: 'samples', target: 6, needKinds: ['floor', 'delta', 'rim'], unit: 'samples',
  },
];

export const objectivesFor = (worldId) => (worldId === 'mars' ? MARS_OBJECTIVES : OBJECTIVES);
export const findObjective = (id) => [...OBJECTIVES, ...MARS_OBJECTIVES].find((o) => o.id === id);
/** Class mode halves the target so a whole campaign fits in a lesson. */
export const scaledObjective = (o, classMode) => (!o || !classMode ? o : { ...o, target: o.metric === 'samples' ? Math.ceil(o.target / 2) : o.target / 2 });

// role: who decides this slot in team mode (up to 4 players)
export const SLOTS = [
  { id: 'mobility', label: 'Wheels or legs', role: 'Engineer' },
  { id: 'power', label: 'Power', role: 'Engineer' },
  { id: 'digger', label: 'Excavator', role: 'Scientist' },
  { id: 'thermal', label: 'Thermal', role: 'Engineer' },
  { id: 'comms', label: 'Communications', role: 'Comms' },
  { id: 'science', label: 'Ice finder', role: 'Scientist' },
  { id: 'extra', label: 'Special kit', role: 'Mission lead' },
];

export const PARTS = {
  mobility: [
    { id: 'rigid4', name: '4 rigid wheels', massKg: 35, costM: 20, driveW: 100, speedKmh: 0.5, maxSlope: 1,
      info: 'Light and cheap. Climbs slopes up to 15°. Fast on flat ground.' },
    { id: 'mesh6', name: '6 mesh wheels, wheel-walking', massKg: 60, costM: 45, driveW: 140, speedKmh: 0.4, maxSlope: 2,
      info: 'Uses the "wheel-walking" idea from NASA VIPER: each wheel can lift and push, so it climbs up to 20° in soft soil.' },
    { id: 'legs', name: '6-legged walker', massKg: 95, costM: 80, driveW: 220, speedKmh: 0.2, maxSlope: 3,
      info: 'Walks on any slope, even crater walls, but is slow, power-hungry and can slip.' },
  ],
  power: [
    { id: 'solarS', name: 'Solar 250 W + 2 kWh battery', massKg: 55, costM: 25, solarW: 250, batteryWh: 2000,
      info: 'Cheap and light. Makes nothing in shadow.' },
    { id: 'solarL', name: 'Solar 450 W + 5 kWh battery', massKg: 105, costM: 50, solarW: 450, batteryWh: 5000,
      info: 'Big panels and battery. Heavy, but lets you stay in shadow for hours.' },
    { id: 'rtg', name: 'Nuclear RTG 110 W + 2.5 kWh battery', massKg: 70, costM: 130, rtgW: 110, batteryWh: 2500, warm: true,
      info: 'Like Curiosity and Perseverance: steady power day and night, and its heat keeps the rover warm. Very expensive and low power.' },
  ],
  digger: [
    { id: 'scoop', name: 'Scoop arm', massKg: 20, costM: 10, digW: 60, rateKgH: 25, iceFactor: 0.2,
      info: 'Simple. Bounces off frozen, ice-cemented soil.' },
    { id: 'drum', name: 'Bucket drum digger', massKg: 66, costM: 40, digW: 200, rateKgH: 80, iceFactor: 0.5,
      info: 'Like NASA RASSOR: two drums spin opposite ways, so it digs a lot without being pushed back in low gravity.' },
    { id: 'drill', name: '1 m percussion drill', massKg: 25, costM: 30, digW: 150, rateKgH: 12, iceFactor: 1.0,
      info: 'Like the TRIDENT drill: slow, but cuts frozen ice-rich soil at full speed.' },
  ],
  thermal: [
    { id: 'blanket', name: 'Insulation blankets', massKg: 8, costM: 5, heaterW: 0, shadowLimitH: 3,
      info: 'Light. Electronics freeze after about 3 hours in shadow (-200 °C).' },
    { id: 'heaters', name: 'Insulation + heaters', massKg: 20, costM: 12, heaterW: 60, shadowLimitH: Infinity,
      info: 'Survives shadow, but heaters use 60 W from the battery while it is dark.' },
  ],
  comms: [
    { id: 'dte', name: 'Direct-to-Earth antenna', massKg: 15, costM: 15, dte: true,
      info: 'Earth sits low on the horizon at the pole, so it only works from high ground.' },
    { id: 'relay', name: 'Relay radio (orbit team satellite)', massKg: 6, costM: 25, relay: true,
      info: 'Works anywhere, even in craters, but only when the relay satellite passes overhead: 4 hours in every 12.' },
    { id: 'both', name: 'Both antennas', massKg: 21, costM: 38, dte: true, relay: true,
      info: 'Best coverage. Heavier and pricier.' },
  ],
  science: [
    { id: 'none', name: 'Cameras only', massKg: 0, costM: 0,
      info: 'You dig where you guess. Ice is invisible under the surface.' },
    { id: 'nss', name: 'Neutron spectrometer', massKg: 10, costM: 25, scanW: 15, scan: true,
      info: 'Like VIPER\'s NSS: counts neutrons bouncing off hydrogen to reveal buried ice nearby.' },
  ],
  extra: [
    { id: 'none', name: 'Nothing', massKg: 0, costM: 0, info: 'Save mass and money.' },
    { id: 'tether', name: '3 km winch tether', massKg: 30, costM: 35, tether: true,
      info: 'Lets wheels go down walls steeper than 20° on a cable (like JPL\'s Axel rover). Slow and power-hungry there.' },
    { id: 'panels', name: 'Spare solar wing', massKg: 25, costM: 15, extraSolarW: 150,
      info: 'More power in sunlight. Useless in shadow.' },
  ],
};

export function partById(slot, id) {
  return PARTS[slot].find((p) => p.id === id);
}

export function defaultDesign() {
  return { mobility: 'mesh6', power: 'solarS', digger: 'scoop', thermal: 'blanket', comms: 'dte', science: 'none', extra: 'none' };
}

/** Totals and derived numbers for a design. */
export function summarize(design) {
  const parts = SLOTS.map((s) => partById(s.id, design[s.id]));
  const massKg = BUS.massKg + parts.reduce((a, p) => a + p.massKg, 0);
  const costM = BUS.costM + parts.reduce((a, p) => a + p.costM, 0);
  const pw = partById('power', design.power);
  const solarW = (pw.solarW || 0) + (partById('extra', design.extra).extraSolarW || 0);
  return {
    parts, massKg, costM, solarW,
    rtgW: pw.rtgW || 0,
    batteryWh: pw.batteryWh,
    mob: partById('mobility', design.mobility),
    dig: partById('digger', design.digger),
    therm: partById('thermal', design.thermal),
    comm: partById('comms', design.comms),
    sci: partById('science', design.science),
    extra: partById('extra', design.extra),
    warm: !!pw.warm,
  };
}
