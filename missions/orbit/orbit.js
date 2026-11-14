// Orbit physics for the relay-satellite mission. Pure functions, no screen code.
// Two-body Kepler orbits: good for planning and teaching; real missions refine them in tools like NASA GMAT.
// Frame: z = the planet's north pole axis. Distances in km, times in seconds unless named *H (hours).

export const G0 = 9.80665;          // m/s^2
export const ISP_S = 320;           // typical storable bipropellant engine

export const period = (aKm, gm) => 2 * Math.PI * Math.sqrt(aKm ** 3 / gm);
export const visViva = (rKm, aKm, gm) => Math.sqrt(gm * (2 / rKm - 1 / aKm));

const APO_OVER = { south: 90, north: 270, equator: 0 }; // argument of periapsis (deg) that puts apoapsis there

export function elements({ periAltKm, apoAltKm, incDeg, apoOver = 'south' }, world) {
  const R = world.radiusKm;
  const rp = R + Math.min(periAltKm, apoAltKm), ra = R + Math.max(periAltKm, apoAltKm);
  const a = (rp + ra) / 2, e = (ra - rp) / (ra + rp);
  return { rp, ra, a, e, i: (incDeg * Math.PI) / 180, w: (APO_OVER[apoOver] * Math.PI) / 180, gm: world.gm, R, T: period(a, world.gm) };
}

function eccentricAnomaly(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-10) break; }
  return E;
}

/** Position [x,y,z] (km) at time tSec after periapsis. */
export function positionAt(el, tSec) {
  const M = ((2 * Math.PI * tSec) / el.T) % (2 * Math.PI);
  const E = eccentricAnomaly(M, el.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  const r = el.a * (1 - el.e * Math.cos(E));
  const u = nu + el.w;
  return [r * Math.cos(u), r * Math.sin(u) * Math.cos(el.i), r * Math.sin(u) * Math.sin(el.i)];
}

/** Points around the whole orbit, for drawing. */
export function orbitPath(el, n = 240) {
  return Array.from({ length: n + 1 }, (_, k) => positionAt(el, (k / n) * el.T));
}

function siteVec(latDeg, lonDeg, R) {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
  return [R * Math.cos(la) * Math.cos(lo), R * Math.cos(la) * Math.sin(lo), R * Math.sin(la)];
}

/** Elevation angle (deg) of the satellite seen from a site on the surface. */
export function elevationDeg(sat, site) {
  const d = [sat[0] - site[0], sat[1] - site[1], sat[2] - site[2]];
  const dl = Math.hypot(...d), sl = Math.hypot(...site);
  return (Math.asin((d[0] * site[0] + d[1] * site[1] + d[2] * site[2]) / (dl * sl)) * 180) / Math.PI;
}

/**
 * Contact timeline between the satellite and the landing site over `hours`, with the planet turning.
 * Returns windows [{startH, endH}], coverage (0..1), average window and gap lengths.
 */
export function contactTimeline(el, world, { hours = 72, minElevDeg = 10, siteLonDeg = 0 } = {}) {
  const dtH = Math.min(0.05, el.T / 3600 / 200);
  const steps = Math.ceil(hours / dtH);
  const windows = []; let open = null, visible = 0;
  for (let k = 0; k <= steps; k++) {
    const tH = k * dtH;
    const lon = siteLonDeg + (360 * tH) / world.dayHours;
    const ok = elevationDeg(positionAt(el, tH * 3600), siteVec(world.site.latDeg, lon, el.R)) >= minElevDeg;
    if (ok) visible++;
    if (ok && !open) open = { startH: tH };
    if (!ok && open) { open.endH = tH; windows.push(open); open = null; }
  }
  if (open) { open.endH = hours; windows.push(open); }
  const coverage = visible / (steps + 1);
  const avgWindowH = windows.length ? windows.reduce((s, w) => s + (w.endH - w.startH), 0) / windows.length : 0;
  const cycleH = windows.length > 1 ? (windows[windows.length - 1].startH - windows[0].startH) / (windows.length - 1) : hours;
  return { windows, coverage, avgWindowH, cycleH, hours };
}

/** Capture burn at periapsis from an arrival speed v_inf (km/s), and the propellant it needs. */
export function captureBurn(el, vInfKms) {
  const vHyp = Math.sqrt(vInfKms ** 2 + (2 * el.gm) / el.rp);
  const vOrb = visViva(el.rp, el.a, el.gm);
  return Math.max(0, vHyp - vOrb); // km/s
}
export const propellantKg = (dryKg, dvKms) => dryKg * (Math.exp((dvKms * 1000) / (ISP_S * G0)) - 1);

/** A badly timed burn leaves the apoapsis too high or too low. err in -1..1 (0 = perfect). */
export function missedBurn(params, err) {
  const factor = 1 + 0.7 * err;
  return { ...params, apoAltKm: Math.max(params.periAltKm + 50, params.apoAltKm * factor) };
}
