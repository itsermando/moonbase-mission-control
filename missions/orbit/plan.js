// Design metrics and scoring for the orbit mission, shared by the screens and by the analyst's forecasts,
// so a prediction always uses exactly the rules the debrief will use. Pure functions, no screen code.
import * as O from './orbit.js';
import * as D from './data.js';
import { findInstrument } from './instruments.js';

const pick = (list, id) => list.find((x) => x.id === id);

/** sel: { rocket, antenna, power, instrument?, shield?, p: { periAltKm, apoAltKm, incDeg, argpDeg } }.
 *  instrument defaults to none and shield to standard, which add nothing, so older callers get the same numbers. */
export function designMetrics(sel, world, wid) {
  const rk = pick(D.ROCKETS, sel.rocket), an = pick(D.ANTENNAS, sel.antenna), pw = pick(D.POWER, sel.power);
  const ins = findInstrument(wid, sel.instrument), sh = pick(D.SHIELDS, sel.shield || 'standard');
  const el = O.elements(sel.p, world);
  const dvNeed = O.requiredDv(el.rp, el.ra, world.vInfKms, world.gm);
  const dry = D.BUS.massKg + an.massKg + pw.massKg + ins.massKg + sh.massKg;
  const prop = O.propellantKg(dry, dvNeed * 1.1); // 10% margin for trim burns
  const cap = Math.round(rk.capKg * D.PAYLOAD_FACTOR[wid]);
  const cost = rk.costM + D.BUS.costM + an.costM + pw.costM + ins.costM + sh.costM;
  return { rk, an, pw, ins, sh, el, dvNeed, dry, prop, wet: dry + prop, cap, cost, needW: D.BUS.powerW + an.powerW + ins.powerW, haveW: pw.powerW };
}

/** The six debrief items as numbers: [{ label, max, score }]. err = apoapsis error (0..1), retries = fly-bys.
 *  science = instrumentSpecs(...) when the satellite carries an instrument: then 'Science goal' replaces 'Data rate'. */
export function scoreParts(d, t, { err = 0, retries = 0, science = null } = {}, wid) {
  const left = D.BUDGET_M - d.cost, margin = d.cap - d.wet;
  return [
    ['Contact with the base', 35, Math.round(35 * Math.min(1, t.coverage / D.GOALS[wid]))],
    ['Contact length', 10, Math.round(10 * Math.min(1, t.avgWindowH / 2))],
    ['Capture burn accuracy', 20, Math.round(20 * Math.max(0, 1 - err / 0.25)) - (retries ? 5 : 0)],
    science ? ['Science goal', 10, (science.goalMet ? 5 : Math.round(5 * Math.min(1, science.goalGsdM / science.gsdM))) + Math.round(5 * science.returnFraction)]
      : ['Data rate', 10, Math.round((d.an.rate / 4) * 10)],
    ['Budget left', 10, Math.round(10 * Math.min(1, Math.max(0, left) / 40))],
    ['Mass margin', 15, Math.round(15 * Math.min(1, Math.max(0, margin) / (d.cap * 0.25)))],
  ].map(([label, max, score]) => ({ label, max, score: Math.max(0, score) }));
}
export const totalScore = (parts) => parts.reduce((a, p) => a + p.score, 0);

/** The go / no-go rules that must hold before the capture burn (contact goal is only a warning in the game). */
export function launchReady(d, p, wid) {
  const L = D.LIMITS[wid], low = Math.min(p.periAltKm, p.apoAltKm), high = Math.max(p.periAltKm, p.apoAltKm);
  return d.wet <= d.cap && d.cost <= D.BUDGET_M && d.haveW >= d.needW && low >= L.minPeri && high <= L.maxApo;
}
