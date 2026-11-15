// Science instruments for the relay satellite, one set per world, each modelled on a real NASA orbiter instrument.
// What is real: the instrument names, what they measure, and their optics (pixel size, field of view), which come from the
// published instrument papers and NASA mission pages. What is game-scale: mass, power, cost and recorded data rate are rounded
// to the instrument's class (a wide-angle camera, a large telescope camera, a laser altimeter ...), not copied from a data sheet.
// Everything the screens show is computed from the player's orbit with the formulas written in `FORMULAS`.
// Pure functions, no screen code. el = O.elements(...) from orbit.js.

// ifovUrad: angle one pixel (or the whole footprint, for non-imaging sensors) sees, in microradians. fovDeg: full width of the strip seen.
// goalGsdM: the game's science goal, the sharpest detail (m) you need for what this instrument is for.
export const INSTRUMENTS = {
  moon: [
    { id: 'wac', name: 'Wide-angle colour camera', kind: 'imager', ref: 'LRO LROC Wide Angle Camera', ifovUrad: 2000, fovDeg: 60, massKg: 10, powerW: 12, costM: 10, mbps: 20, goalGsdM: 200,
      job: 'Colour map of the whole Moon.', info: 'Real LROC WAC: about 100 m per pixel from 50 km, 7 colour bands, a swath near 57 km.' },
    { id: 'nac', name: 'Narrow-angle camera', kind: 'imager', ref: 'LRO LROC Narrow Angle Camera', ifovUrad: 10, fovDeg: 5.7, massKg: 40, powerW: 50, costM: 35, mbps: 40, goalGsdM: 1,
      job: 'Boulders, craters and landing hazards.', info: 'Real LROC NAC: 0.5 m per pixel from 50 km, but a strip only about 5 km wide.' },
    { id: 'lola', name: 'Laser altimeter', kind: 'altimeter', ref: 'LRO LOLA', ifovUrad: 100, fovDeg: 0.06, massKg: 12, powerW: 35, costM: 20, mbps: 0.5, goalGsdM: 20,
      job: 'Measures heights to build 3D terrain.', info: 'Real LOLA fires 5 laser spots about 5 m wide and measures height to about 10 cm. Our rover terrain comes from it.' },
    { id: 'lend', name: 'Neutron detector', kind: 'spectrometer', ref: 'LRO LEND', ifovUrad: 200000, fovDeg: 11.5, massKg: 10, powerW: 10, costM: 10, mbps: 0.05, goalGsdM: 20000,
      job: 'Finds hydrogen, so buried water ice.', info: 'Real LEND sees a patch about 10 km across from 50 km up: coarse, but it points at ice.' },
  ],
  mars: [
    { id: 'ctx', name: 'Context camera', kind: 'imager', ref: 'MRO CTX', ifovUrad: 20, fovDeg: 5.7, massKg: 15, powerW: 15, costM: 12, mbps: 20, goalGsdM: 10,
      job: 'Black-and-white pictures of the landing area.', info: 'Real CTX: 6 m per pixel from 300 km, a 30 km swath. It imaged Jezero crater.' },
    { id: 'hirise', name: 'High-resolution camera', kind: 'imager', ref: 'MRO HiRISE', ifovUrad: 1, fovDeg: 1.15, massKg: 60, powerW: 55, costM: 45, mbps: 40, goalGsdM: 1,
      job: 'Rocks, dunes and rover tracks.', info: 'Real HiRISE: 0.3 m per pixel from 300 km (1 microradian) through a 0.5 m telescope, a strip only 6 km wide.' },
    { id: 'crism', name: 'Mineral mapper', kind: 'spectrometer', ref: 'MRO CRISM', ifovUrad: 60, fovDeg: 1.9, massKg: 30, powerW: 30, costM: 25, mbps: 10, goalGsdM: 50,
      job: 'Finds clays and carbonates by their colours.', info: 'Real CRISM: 544 colour bands, 18 m per pixel from 300 km. It found clays at Jezero.' },
    { id: 'sharad', name: 'Radar sounder', kind: 'radar', ref: 'MRO SHARAD', ifovUrad: 20000, fovDeg: 1.1, massKg: 25, powerW: 40, costM: 30, mbps: 8, goalGsdM: 10000,
      job: 'Sees ice and layers under the ground.', info: 'Real SHARAD: 20 MHz radar that resolves layers about 15 m thick and looks up to a kilometre down.' },
  ],
  mercury: [
    { id: 'mdis-w', name: 'Wide-angle imager', kind: 'imager', ref: 'MESSENGER MDIS wide-angle camera', ifovUrad: 179, fovDeg: 10.5, massKg: 10, powerW: 12, costM: 10, mbps: 20, goalGsdM: 1000,
      job: 'Colour map of the whole planet.', info: 'Real MDIS WAC: 10.5° field of view on a 1024-pixel detector, 12 colour filters.' },
    { id: 'mdis-n', name: 'Narrow-angle imager', kind: 'imager', ref: 'MESSENGER MDIS narrow-angle camera', ifovUrad: 25.6, fovDeg: 1.5, massKg: 20, powerW: 20, costM: 18, mbps: 30, goalGsdM: 100,
      job: 'Sharp pictures of craters and cliffs.', info: 'Real MDIS NAC: 1.5° field of view on the same 1024-pixel detector.' },
    { id: 'mla', name: 'Laser altimeter', kind: 'altimeter', ref: 'MESSENGER MLA', ifovUrad: 100, fovDeg: 0.06, massKg: 12, powerW: 30, costM: 20, mbps: 0.5, goalGsdM: 200,
      job: 'Heights of the poles and the big basins.', info: 'Real MLA could only range up to about 1,000 km, so it worked best near the low point of MESSENGER’s orbit.' },
    { id: 'grns', name: 'Gamma-ray and neutron spectrometer', kind: 'spectrometer', ref: 'MESSENGER GRS and NS', ifovUrad: 1000000, fovDeg: 57, massKg: 15, powerW: 15, costM: 15, mbps: 0.05, goalGsdM: 400000,
      job: 'Which elements are in the surface, and ice at the poles.', info: 'Real instruments with no sharp image: the patch they see is about as wide as the altitude.' },
  ],
  ceres: [
    { id: 'fc', name: 'Framing camera', kind: 'imager', ref: 'Dawn Framing Camera (FC)', ifovUrad: 93.4, fovDeg: 5.5, massKg: 12, powerW: 15, costM: 12, mbps: 15, goalGsdM: 150,
      job: 'Pictures and colour maps of Ceres.', info: 'Real Dawn FC: 5.5° field of view on a 1024-pixel detector, with 7 colour filters.' },
    { id: 'vir', name: 'Visible and infrared spectrometer', kind: 'spectrometer', ref: 'Dawn VIR', ifovUrad: 250, fovDeg: 3.7, massKg: 20, powerW: 20, costM: 22, mbps: 6, goalGsdM: 400,
      job: 'Minerals and the salts of the bright spots.', info: 'Real VIR: 250 microradians per pixel; it found ammonia-bearing clays and carbonate salts at Ceres.' },
    { id: 'grand', name: 'Gamma-ray and neutron detector', kind: 'spectrometer', ref: 'Dawn GRaND', ifovUrad: 1000000, fovDeg: 57, massKg: 10, powerW: 10, costM: 10, mbps: 0.05, goalGsdM: 1000,
      job: 'Elements and hidden water ice.', info: 'Real GRaND: sees a patch about as wide as the altitude, so it only works from a low orbit.' },
  ],
  vesta: [
    { id: 'fc', name: 'Framing camera', kind: 'imager', ref: 'Dawn Framing Camera (FC)', ifovUrad: 93.4, fovDeg: 5.5, massKg: 12, powerW: 15, costM: 12, mbps: 15, goalGsdM: 70,
      job: 'Pictures and colour maps of Vesta.', info: 'Real Dawn FC: about 20 m per pixel from the 210 km low mapping orbit, 65 m from the 680 km high one.' },
    { id: 'vir', name: 'Visible and infrared spectrometer', kind: 'spectrometer', ref: 'Dawn VIR', ifovUrad: 250, fovDeg: 3.7, massKg: 20, powerW: 20, costM: 22, mbps: 6, goalGsdM: 400,
      job: 'The rock types in the Rheasilvia basin.', info: 'Real VIR: 250 microradians per pixel; it showed Vesta’s surface is basalt-like volcanic rock.' },
    { id: 'grand', name: 'Gamma-ray and neutron detector', kind: 'spectrometer', ref: 'Dawn GRaND', ifovUrad: 1000000, fovDeg: 57, massKg: 10, powerW: 10, costM: 10, mbps: 0.05, goalGsdM: 400,
      job: 'Iron and hydrogen in the soil.', info: 'Real GRaND: sees a patch about as wide as the altitude, so it only works from a low orbit.' },
  ],
};
export const NO_INSTRUMENT = { id: 'none', name: 'No science instrument', kind: 'none', ref: 'Relay only', massKg: 0, powerW: 0, costM: 0, mbps: 0, job: 'A pure relay: nothing to image.', info: 'Cheapest and lightest. The satellite only passes messages.' };

export const DEFAULT_INSTRUMENT = { moon: 'wac', mars: 'ctx', mercury: 'mdis-w', ceres: 'fc', vesta: 'fc' };
export const instrumentsFor = (wid) => INSTRUMENTS[wid] || [];
export function findInstrument(wid, id) {
  if (!id || id === 'none') return NO_INSTRUMENT;
  return instrumentsFor(wid).find((x) => x.id === id) || NO_INSTRUMENT;
}

// Extra facts per world: mean distance from the Sun (AU, NASA planetary fact sheets), and plain thermal and radiation notes.
export const ENVIRONMENT = {
  moon: { sunAU: 1.0, thermal: 'Surface swings from about 120 °C in daylight to about −170 °C at night; permanently shadowed polar craters can drop below −200 °C.', radiation: 'No magnetic field or air, so solar storms hit directly: shield the computer.' },
  mars: { sunAU: 1.524, thermal: 'Orbit is cold and stable, but sunlight is only about 43% of what Earth gets, so solar wings make less than at home.', radiation: 'Weak magnetic field: solar storms reach orbit, like the ones MAVEN studies.' },
  mercury: { sunAU: 0.387, thermal: 'Sunlight is about 6.7 times Earth’s. MESSENGER hid behind a ceramic-cloth sunshade and the planet’s infrared glow heats a low orbit.', radiation: 'Close to the Sun, so storms are strong; a magnetic field shields part of it.' },
  ceres: { sunAU: 2.77, thermal: 'Sunlight is only about 13% of Earth’s, so Dawn used huge solar wings. Cold electronics need heaters.', radiation: 'Weak: far from the Sun and no big radiation belts.' },
  vesta: { sunAU: 2.36, thermal: 'Sunlight is about 18% of Earth’s. Dawn’s two large solar wings spanned about 19 m.', radiation: 'Weak: far from the Sun and no big radiation belts.' },
};
export const SOLAR_CONSTANT = 1361; // W/m² at 1 AU
export const sunlightFactor = (wid) => 1 / (ENVIRONMENT[wid]?.sunAU ** 2 || 1);

// Game-scale downlink to Earth: base rate times the antenna's data-rate multiplier; half the Earth-visible time goes to science.
export const DOWNLINK_MBPS_PER_RATE = 5;
export const SCIENCE_SHARE = 0.5;
export const OPTICAL_DUTY = 0.25; // an imager records only some of the daylight part of the orbit (power, heat and recorder limits)

export const FORMULAS = {
  gsd: 'GSD = h × IFOV   (ground sample distance, the size one pixel covers)',
  swath: 'swath = 2 h tan(FOV / 2)',
  groundSpeed: 'v_ground = v_orbit × R / r   (orbit speed from v = √(GM (2/r − 1/a)), projected to the surface)',
  eclipse: 'eclipse fraction ≈ asin(R / r) / π   (worst case: the Sun lies in the orbit plane)',
  mapping: 'orbits to cover the globe ≈ π R / swath;  time = orbits × T  (× 2 for cameras, which only image in daylight)',
  latitude: 'latitude reached ≈ min(i, 180° − i) + half-swath angle',
  data: 'data per orbit = rate × T × duty;  downlink per orbit = antenna rate × T × (1 − eclipse) × 0.5',
};

const rad = (deg) => (deg * Math.PI) / 180;

/** Everything about one instrument flown on this orbit. `world` supplies radiusKm/gm; `el` is O.elements(...). */
export function instrumentSpecs(ins, el, world, { antennaRate = 2 } = {}) {
  if (!ins || ins.kind === 'none') return null;
  const hPeri = Math.max(1, el.rp - world.radiusKm), hApo = Math.max(1, el.ra - world.radiusKm);
  const gsd = (h) => ins.ifovUrad * 1e-6 * h * 1000;                 // metres
  const swath = (h) => 2 * h * Math.tan(rad(ins.fovDeg) / 2);          // km
  const vPeri = Math.sqrt(world.gm * (2 / el.rp - 1 / el.a));           // km/s
  const groundSpeedKms = vPeri * world.radiusKm / el.rp;
  const eclipse = Math.asin(Math.min(1, world.radiusKm / el.a)) / Math.PI;
  const swathKm = swath(hPeri), gsdM = gsd(hPeri);
  const optical = ins.kind === 'imager' || (ins.kind === 'spectrometer' && ins.ifovUrad < 1000);
  const orbitsToMap = Math.PI * world.radiusKm / swathKm;
  const mapDays = (orbitsToMap * el.T * (optical ? 2 : 1)) / 86400;
  const inc = el.i * 180 / Math.PI, incEff = inc <= 90 ? inc : 180 - inc;
  const latReach = Math.min(90, incEff + (swathKm / 2 / world.radiusKm) * 180 / Math.PI);
  const duty = optical ? (1 - eclipse) * OPTICAL_DUTY : 1;
  const producedGb = (ins.mbps * el.T * duty) / 1000;
  const downGb = (antennaRate * DOWNLINK_MBPS_PER_RATE * el.T * (1 - eclipse) * SCIENCE_SHARE) / 1000;
  return {
    hPeriKm: hPeri, hApoKm: hApo, gsdM, gsdWorstM: gsd(hApo), swathKm, groundSpeedKms, eclipse, mapDays, latReach, optical,
    goalGsdM: ins.goalGsdM, goalMet: gsdM <= ins.goalGsdM, producedGb, downGb, returnedGb: Math.min(producedGb, downGb), returnFraction: producedGb ? Math.min(1, downGb / producedGb) : 1,
    periodH: el.T / 3600,
  };
}

/** A human size: 0.5 m, 12 m, 1.4 km. */
export function sizeText(m) {
  if (m < 1) return `${(m * 100).toFixed(0)} cm`;
  if (m < 1000) return `${m < 10 ? m.toFixed(1) : Math.round(m)} m`;
  return `${m < 10000 ? (m / 1000).toFixed(1) : Math.round(m / 1000).toLocaleString('en-US')} km`;
}
export function daysText(d) {
  if (d < 1) return `${(d * 24).toFixed(1)} h`;
  if (d < 60) return `${d.toFixed(d < 10 ? 1 : 0)} days`;
  if (d < 730) return `${Math.round(d / 30.4)} months`;
  return `${(d / 365.25).toFixed(d / 365.25 < 10 ? 1 : 0)} years`;
}
