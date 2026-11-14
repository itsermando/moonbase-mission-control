// Orbit physics for the relay-satellite mission. Pure functions, no screen code.
// Two-body Kepler orbits in an inertial frame, with the planet turning underneath at its sidereal rate.
// This is the same first approximation mission designers start from before refining in tools like NASA GMAT.
// Frame: z = the planet's north pole axis. Distances in km, times in seconds unless named *H (hours).

export const G0 = 9.80665;          // m/s^2
export const ISP_S = 320;           // typical storable bipropellant engine (s)
export const MIN_ELEV_DEG = 10;     // the base needs the satellite at least 10° above its horizon

export const period = (aKm, gm) => 2 * Math.PI * Math.sqrt(aKm ** 3 / gm);
export const visViva = (rKm, aKm, gm) => Math.sqrt(gm * (2 / rKm - 1 / aKm));
const D2R = Math.PI / 180;
const APO_OVER = { south: 90, north: 270, equator: 0 }; // argument of periapsis that puts the apoapsis there
const rotHours = (world) => world.rotHours || world.dayHours;

/**
 * Orbit elements from mission-planner inputs.
 * params: { periAltKm, apoAltKm, incDeg, argpDeg } (argpDeg = argument of periapsis; 90° puts apoapsis over the south pole)
 */
export function elements(params, world) {
  const { periAltKm, apoAltKm, incDeg } = params;
  const argp = params.argpDeg ?? APO_OVER[params.apoOver || 'south'];
  const R = world.radiusKm;
  const rp = R + Math.min(periAltKm, apoAltKm), ra = R + Math.max(periAltKm, apoAltKm);
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  return { rp, ra, a, e, i: incDeg * D2R, w: argp * D2R, gm: world.gm, R, T: period(a, world.gm) };
}

function eccentricAnomaly(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 40; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-12) break; }
  return E;
}

/** True anomaly and radius at time tSec after periapsis. */
export function stateAt(el, tSec) {
  const M = (((2 * Math.PI * tSec) / el.T) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const E = eccentricAnomaly(M, el.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const r = el.a * (1 - el.e * Math.cos(E));
  return { nu, r, v: visViva(r, el.a, el.gm) };
}

/** Position [x,y,z] (km) at time tSec after periapsis, inertial frame. */
export function positionAt(el, tSec) {
  const { nu, r } = stateAt(el, tSec);
  return posFromNu(el, nu, r);
}
function posFromNu(el, nu, r) {
  const u = nu + el.w;
  return [r * Math.cos(u), r * Math.sin(u) * Math.cos(el.i), r * Math.sin(u) * Math.sin(el.i)];
}

/** Points around the whole orbit, evenly spaced in angle (smooth even for very elliptical orbits). */
export function orbitPath(el, n = 360) {
  return Array.from({ length: n + 1 }, (_, k) => {
    const nu = (2 * Math.PI * k) / n;
    return posFromNu(el, nu, (el.a * (1 - el.e ** 2)) / (1 + el.e * Math.cos(nu)));
  });
}
export const periapsisPos = (el) => posFromNu(el, 0, el.rp);
export const apoapsisPos = (el) => posFromNu(el, Math.PI, el.ra);

function siteVec(latDeg, lonDeg, R) {
  const la = latDeg * D2R, lo = lonDeg * D2R;
  return [R * Math.cos(la) * Math.cos(lo), R * Math.cos(la) * Math.sin(lo), R * Math.sin(la)];
}

/** Elevation angle (deg) of the satellite seen from a site on the surface. */
export function elevationDeg(sat, site) {
  const d = [sat[0] - site[0], sat[1] - site[1], sat[2] - site[2]];
  const dl = Math.hypot(...d), sl = Math.hypot(...site);
  return Math.asin((d[0] * site[0] + d[1] * site[1] + d[2] * site[2]) / (dl * sl)) / D2R;
}

/** Latitude/longitude under the satellite at hour tH (the planet turns at its sidereal rate). */
export function subPoint(el, world, tH) {
  const [x, y, z] = positionAt(el, tH * 3600);
  const lat = Math.atan2(z, Math.hypot(x, y)) / D2R;
  let lon = Math.atan2(y, x) / D2R - (360 * tH) / rotHours(world);
  lon = ((lon + 540) % 360) - 180;
  return { lat, lon };
}

/** Ground track over `hours`, with a flag for whether the base can see the satellite. */
export function groundTrack(el, world, { hours = 72, siteLonDeg = 0 } = {}) {
  const dtH = Math.min(0.1, el.T / 3600 / 120), pts = [];
  for (let tH = 0; tH <= hours; tH += dtH) {
    const p = subPoint(el, world, tH);
    const lon = siteLonDeg + (360 * tH) / rotHours(world);
    p.inView = elevationDeg(positionAt(el, tH * 3600), siteVec(world.site.latDeg, lon, el.R)) >= MIN_ELEV_DEG;
    pts.push(p);
  }
  return pts;
}

/**
 * Contact timeline between the satellite and the base over `hours`, with the planet turning.
 * Returns windows [{startH, endH}], coverage (0..1), average contact, longest gap and repeat cycle.
 */
export function contactTimeline(el, world, { hours = 72, minElevDeg = MIN_ELEV_DEG, siteLonDeg = 0 } = {}) {
  const dtH = Math.min(0.05, el.T / 3600 / 200);
  const steps = Math.ceil(hours / dtH);
  const windows = []; let open = null, visible = 0;
  for (let k = 0; k <= steps; k++) {
    const tH = k * dtH;
    const lon = siteLonDeg + (360 * tH) / rotHours(world);
    const ok = elevationDeg(positionAt(el, tH * 3600), siteVec(world.site.latDeg, lon, el.R)) >= minElevDeg;
    if (ok) visible++;
    if (ok && !open) open = { startH: tH };
    if (!ok && open) { open.endH = tH; windows.push(open); open = null; }
  }
  if (open) { open.endH = hours; windows.push(open); }
  const coverage = visible / (steps + 1);
  const avgWindowH = windows.length ? windows.reduce((s, w) => s + (w.endH - w.startH), 0) / windows.length : 0;
  const cycleH = windows.length > 1 ? (windows[windows.length - 1].startH - windows[0].startH) / (windows.length - 1) : hours;
  let maxGapH = windows.length ? Math.max(windows[0].startH, hours - windows[windows.length - 1].endH) : hours;
  for (let k = 1; k < windows.length; k++) maxGapH = Math.max(maxGapH, windows[k].startH - windows[k - 1].endH);
  return { windows, coverage, avgWindowH, cycleH, maxGapH, hours };
}

/* ---------- capture burn: arriving on a hyperbola, braking at periapsis ---------- */
export const arrivalSpeed = (rpKm, vInfKms, gm) => Math.sqrt(vInfKms ** 2 + (2 * gm) / rpKm);

/** Brake needed at periapsis to end up with apoapsis radius raKm. */
export function requiredDv(rpKm, raKm, vInfKms, gm) {
  return arrivalSpeed(rpKm, vInfKms, gm) - visViva(rpKm, (rpKm + raKm) / 2, gm);
}
/** Kept for the scoring/test code: brake needed for an orbit made by elements(). */
export const captureBurn = (el, vInfKms) => Math.max(0, requiredDv(el.rp, el.ra, vInfKms, el.gm));

/**
 * What a brake of dv (km/s) at periapsis actually does (vis-viva):
 * escaped (still on a hyperbola), crashed (new low point below the surface), or the resulting orbit.
 */
export function captureResult(rpKm, vInfKms, dvKms, gm, R) {
  const v = arrivalSpeed(rpKm, vInfKms, gm) - dvKms;
  const energy = (v * v) / 2 - gm / rpKm;
  if (energy >= 0) return { escaped: true, v };
  const a = -gm / (2 * energy), other = 2 * a - rpKm;
  const lo = Math.min(rpKm, other), hi = Math.max(rpKm, other);
  return { escaped: false, crashed: lo < R, v, a, periKm: lo, apoKm: hi, periAltKm: lo - R, apoAltKm: hi - R };
}

export const propellantKg = (dryKg, dvKms) => dryKg * (Math.exp((dvKms * 1000) / (ISP_S * G0)) - 1);
/** Delta-v the loaded fuel can give (the rocket equation). */
export const dvAvailable = (dryKg, propKg) => (ISP_S * G0 * Math.log((dryKg + propKg) / dryKg)) / 1000;
