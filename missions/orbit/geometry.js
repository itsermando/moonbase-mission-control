// Pure geometry for the 3D orbit view (no three.js, so it is unit-tested in node).
// Frame: the physics frame of orbit.js (z = north pole). toView() maps it to the viewer's frame (y = north, 1 = one world radius).
import { posFromNu, positionAt, elevationDeg, subPoint, stateAt } from './orbit.js';

const D2R = Math.PI / 180;
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Physics frame (km, z north) to the viewer's frame (world radii, y north): same mapping the globe uses for its markers. */
export const toView = (p, R) => [p[0] / R, p[2] / R, -p[1] / R];
/** Latitude/longitude (degrees) to a point on a sphere of radius r, in the viewer's frame (same as shared/globe.js latToVec). */
export const latLonToXYZ = (latDeg, lonDeg, r = 1) => [r * Math.cos(latDeg * D2R) * Math.cos(lonDeg * D2R), r * Math.sin(latDeg * D2R), -r * Math.cos(latDeg * D2R) * Math.sin(lonDeg * D2R)];

/** Direction to the Sun in the viewer's frame. beta lifts the Sun above the orbit-plane's reference (degrees). */
export function sunDirection(azDeg = 34, elDeg = 14) {
  const a = azDeg * D2R, e = elDeg * D2R;
  return [Math.cos(e) * Math.cos(a), Math.sin(e), -Math.cos(e) * Math.sin(a)];
}

/** True when a point (viewer frame, world radii) is inside the planet's cylindrical shadow. */
export function inEclipse(p, sun) {
  const along = dot(p, sun);
  if (along >= 0) return false;
  const perp = [p[0] - along * sun[0], p[1] - along * sun[1], p[2] - along * sun[2]];
  return Math.hypot(...perp) < 1;
}

/** Fraction of one orbit spent in the planet's shadow, by sampling the orbit (viewer frame). */
export function eclipseFraction(el, sun, n = 360) {
  let k = 0;
  for (let s = 0; s < n; s++) {
    const nu = (2 * Math.PI * s) / n, r = (el.a * (1 - el.e ** 2)) / (1 + el.e * Math.cos(nu));
    if (inEclipse(toView(posFromNu(el, nu, r), el.R), sun)) k++;
  }
  return k / n;
}

/** Ellipse points of the whole orbit in the viewer's frame, evenly spaced in true anomaly (smooth for eccentric orbits). */
export function ellipsePoints(el, n = 360) {
  return Array.from({ length: n + 1 }, (_, k) => {
    const nu = (2 * Math.PI * k) / n;
    return toView(posFromNu(el, nu, (el.a * (1 - el.e ** 2)) / (1 + el.e * Math.cos(nu))), el.R);
  });
}

/** Unit vectors P (toward periapsis) and Q (90° ahead, in the orbit plane) in the viewer's frame. */
export function planeBasis(el) {
  return { P: norm(toView(posFromNu(el, 0, 1), 1)), Q: norm(toView(posFromNu(el, Math.PI / 2, 1), 1)) };
}

/** Point on a conic with periapsis rp (km) and eccentricity e (any e > 0) at true anomaly nu, in the viewer's frame.
 *  off turns the conic's periapsis direction by that angle from the reference orbit's (π when the burn point is the new apoapsis). */
export function conicPoint(orient, rp, e, nu, off = 0) {
  const r = (rp * (1 + e)) / (1 + e * Math.cos(nu));
  return toView(posFromNu(orient, nu + off, r), orient.R);
}

/** True-anomaly range [min, max] that stays within radius rCap (km). Ellipses that fit give the full turn. */
export function conicRange(rp, e, rCap) {
  const p = rp * (1 + e);
  if (e < 1) { const ra = p / (1 - e); if (ra <= rCap) return [-Math.PI, Math.PI]; }
  const c = Math.max(-1, Math.min(1, (p / rCap - 1) / e));
  const nu = Math.acos(c);
  return [-nu, nu];
}

/** Points along a conic over a true-anomaly range, in the viewer's frame. */
export function conicPoints(orient, rp, e, [n0, n1], n = 160, off = 0) {
  return Array.from({ length: n + 1 }, (_, k) => conicPoint(orient, rp, e, n0 + ((n1 - n0) * k) / n, off));
}

/** Eccentricity and periapsis for the hyperbola of arrival: speed vInf far away, periapsis radius rp. */
export const hyperbola = (rp, vInf, gm) => ({ rp, e: 1 + (rp * vInf * vInf) / gm, a: -gm / (vInf * vInf) });

/** Rate of change of true anomaly (rad/s) on a conic with semi-latus rectum p (km): h / r^2. */
export const nuRate = (nu, p, e, gm) => { const r = p / (1 + e * Math.cos(nu)); return Math.sqrt(gm * p) / (r * r); };

/** One step of true anomaly over dt seconds (midpoint rule, so it stays accurate on eccentric orbits). */
export function stepNu(nu, dt, p, e, gm) {
  const mid = nu + 0.5 * dt * nuRate(nu, p, e, gm);
  return nu + dt * nuRate(mid, p, e, gm);
}

/** Time (s) to fly from true anomaly nu0 to nu1 (Simpson's rule on r^2/h). */
export function timeBetween(nu0, nu1, p, e, gm, n = 400) {
  const f = (nu) => { const r = p / (1 + e * Math.cos(nu)); return (r * r) / Math.sqrt(gm * p); };
  const h = (nu1 - nu0) / n; let s = f(nu0) + f(nu1);
  for (let k = 1; k < n; k++) s += f(nu0 + k * h) * (k % 2 ? 4 : 2);
  return (s * h) / 3;
}

/** Half-angle (radians) of the ground circle from which a satellite at radius rKm is at least minElevDeg above the horizon. */
export function footprintHalfAngle(rKm, R, minElevDeg = 10) {
  const e = minElevDeg * D2R;
  return Math.max(0, Math.acos(Math.min(1, (R * Math.cos(e)) / rKm)) - e);
}

/** Points of a small circle on a sphere around (latDeg, lonDeg) with angular radius ang (radians), viewer frame, radius r. */
export function circleOnSphere(latDeg, lonDeg, ang, r = 1, n = 72) {
  const c = latLonToXYZ(latDeg, lonDeg, 1);
  const ref = Math.abs(c[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(c, ref)), v = cross(c, u);
  return Array.from({ length: n + 1 }, (_, k) => {
    const f = (2 * Math.PI * k) / n, ca = Math.cos(ang), sa = Math.sin(ang);
    return [0, 1, 2].map((i) => r * (ca * c[i] + sa * (Math.cos(f) * u[i] + Math.sin(f) * v[i])));
  });
}

/** Ground track (viewer frame, on the surface, planet-fixed) for the hours [t0H, t1H]: n points. */
export function groundTrackPoints(el, world, t0H, t1H, n = 120, r = 1.004) {
  return Array.from({ length: n + 1 }, (_, k) => {
    const s = subPoint(el, world, t0H + ((t1H - t0H) * k) / n);
    return latLonToXYZ(s.lat, s.lon, r);
  });
}

/** Planet-fixed longitude of the landing site at hour tH is lon0; the site is seen when the satellite is above minElevDeg. */
export function siteVisible(el, world, tH, minElevDeg = 10, lon0 = 0) {
  const lat = world.site.latDeg * D2R, lon = (lon0 + (360 * tH) / (world.rotHours || world.dayHours)) * D2R, R = el.R;
  const site = [R * Math.cos(lat) * Math.cos(lon), R * Math.cos(lat) * Math.sin(lon), R * Math.sin(lat)];
  return elevationDeg(positionAt(el, tH * 3600), site) >= minElevDeg;
}

/** Facts for the live readout at hour tH on an orbit. */
export function readout(el, world, tH) {
  const s = stateAt(el, tH * 3600), sub = subPoint(el, world, tH);
  return { altKm: s.r - el.R, speedKms: s.v, nuDeg: ((s.nu / D2R) + 360) % 360, lat: sub.lat, lon: sub.lon, rKm: s.r };
}

/** Area swept per second (km²/s) is constant (Kepler's 2nd law): h/2. */
export const arealVelocity = (el) => 0.5 * Math.sqrt(el.gm * el.a * (1 - el.e * el.e));
