// Mission 1 debrief pieces: the explanation matrix (choice -> physics -> result) and the WHAT / HOW / WHY tree.
// Builders only; every value comes from the run the player just flew.
import * as D from './data.js';
import { sizeText } from './instruments.js';
import { whyTree } from '../../shared/explain.js';

const fmt = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const hrs = (h) => (h < 1 ? `${fmt(h * 60, 0)} min` : `${fmt(h, 1)} h`);
const pct = (x) => `${fmt(x * 100, 0)}%`;

/** run: { d, t, p, err, retries, dv, event, sp, wid, world, presetName } */
export function matrixSpec(run) {
  const { d, t, p, err, retries, dv, event, sp, wid, world } = run, goal = D.GOALS[wid];
  const rows = [
    { icon: '🚀', label: 'Launch', choice: d.rk.name, physics: `Launch mass ${fmt(d.wet)} kg vs ${fmt(d.cap)} kg capacity`, value: fmt(d.cap - d.wet), unit: 'kg spare',
      bar: { v: Math.round(d.cap - d.wet), min: 0, max: Math.round(d.cap * 0.6), good: [Math.round(d.cap * 0.1), Math.round(d.cap * 0.6)] },
      say: `The ${d.rk.name.toLowerCase()} carried ${fmt(d.dry)} kg of satellite and ${fmt(d.prop)} kg of fuel.`,
      why: 'Spare capacity is safety margin: real missions keep some in case the satellite grows heavier during building.',
      spec: `m_launch = m_dry + m_fuel = ${fmt(d.dry)} + ${fmt(d.prop)} kg` },
    { icon: '⚡', label: 'Power', choice: `${d.pw.name}`, physics: `Uses ${d.needW} W, makes ${d.haveW} W`, value: `${d.haveW - d.needW}`, unit: 'W spare',
      bar: { v: d.haveW - d.needW, min: -100, max: 300, good: [20, 300] },
      say: 'The wings ran the computer, the antenna' + (d.ins.powerW ? ' and the instrument.' : '.'), why: 'Without spare power the satellite must switch things off, and contact is lost.',
      spec: `P_need = ${D.BUS.powerW} (computer) + ${d.an.powerW} (antenna)${d.ins.powerW ? ` + ${d.ins.powerW} (instrument)` : ''} W` },
    { icon: '🛰️', label: 'Orbit shape', choice: `${fmt(p.periAltKm)} × ${fmt(p.apoAltKm)} km, i ${fmt(p.incDeg)}°, ω ${fmt(p.argpDeg)}°`, physics: `Period ${hrs(run.periodH)}; slow high point ${p.argpDeg > 0 && p.argpDeg < 180 ? 'over the south' : 'over the north'}`,
      value: pct(t.coverage), unit: 'contact', bar: { v: Math.round(t.coverage * 100), min: 0, max: 100, good: [Math.round(goal * 100), 100] },
      say: `The base could talk to Earth ${pct(t.coverage)} of the time; the goal was ${pct(goal)}.`,
      why: 'A satellite moves slowest at its highest point (Kepler’s 2nd law), so the side of the world under that point gets the long passes.',
      spec: 'T = 2π √(a³ / GM);  contact when elevation ≥ 10°' },
    { icon: '⏱️', label: 'Contact rhythm', choice: 'Result of the orbit', physics: `${hrs(t.avgWindowH)} per pass`, value: hrs(t.maxGapH), unit: 'longest gap',
      bar: { v: +t.maxGapH.toFixed(1), min: 0, max: 24, good: [0, 8] }, say: `Each pass lasted ${hrs(t.avgWindowH)}; the rover waited up to ${hrs(t.maxGapH)} between them.`,
      why: 'Long gaps mean the rover in Mission 2 must make decisions on its own, without asking Earth.', spec: 'gap = time between the end of one window and the start of the next' },
    { icon: '🔥', label: 'Capture burn', choice: `${fmt(dv * 1000)} m/s brake`, physics: `${retries ? 'Flew past once, then ' : ''}apoapsis ${fmt(err * 100, 1)}% off plan`, value: `${fmt(err * 100, 1)}%`, unit: 'error',
      bar: { v: +(err * 100).toFixed(1), min: 0, max: 25, good: [0, 2] }, status: retries ? 'warn' : undefined,
      say: retries ? 'The first burn was too gentle: the satellite flew past and needed a fuel-hungry loop back.' : 'The burn slowed the satellite enough for gravity to capture it.',
      why: 'Vis-viva: a few metres per second change the high point by hundreds of kilometres.', spec: 'v² = GM (2/r − 1/a)  →  a = 1 / (2/rₚ − v²/GM)' },
  ];
  if (sp) rows.push({ icon: '🔭', label: 'Science', choice: d.ins.name, physics: `${sizeText(sp.gsdM)} pixels from ${fmt(sp.hPeriKm)} km over the base`, value: sizeText(sp.gsdM), unit: `goal ${sizeText(sp.goalGsdM)}`,
    status: sp.goalMet ? 'ok' : sp.gsdM < sp.goalGsdM * 3 ? 'warn' : 'fail',
    say: sp.goalMet ? `The ${d.ins.name.toLowerCase()} could do its job from the low point.` : `From ${fmt(sp.hPeriKm)} km the ${d.ins.name.toLowerCase()} was too far away to see the detail it needs.`,
    why: 'Pixel size grows with distance: twice as high, twice as blurry. Science wants low; a relay wants high.', spec: `GSD = h × IFOV = ${fmt(sp.hPeriKm)} km × ${d.ins.ifovUrad} µrad` });
  if (event) rows.push({ icon: '☀️', label: 'Solar storm', choice: event.choice === 'safe' ? 'Safe mode' : 'Kept transmitting', physics: `${d.sh.name}: ${Math.round(d.sh.hit * 100)}% reset risk`,
    value: hrs(event.lostH), unit: 'contact lost', status: event.hit ? 'fail' : event.lostH > 0 ? 'warn' : 'ok',
    say: event.hit ? 'The storm reset the computer.' : event.choice === 'safe' ? 'Safe mode protected the satellite at a known cost.' : 'The gamble paid off this time.',
    why: 'Operators weigh a small certain loss against a bigger uncertain one: that is risk management.', spec: `expected loss = P(reset) × outage = ${Math.round(d.sh.hit * 100)}% × ${D.STORM.resetH} h` });
  return { title: 'What your choices caused', subtitle: 'Each row reads left to right: what you chose, the physics it triggered, and the result. Tap a row for the formula.', rows };
}

export function debriefTree(run, score) {
  const { d, t, p, err, retries, event, sp, wid } = run, goal = D.GOALS[wid];
  const tone = (ok, mid) => (ok ? 'good' : mid ? 'warn' : 'bad');
  const branches = [
    { how: `Built: ${d.an.name}, ${d.pw.name.toLowerCase()}`, detail: `${fmt(d.wet)} kg on a ${d.rk.name.toLowerCase()}`, tone: tone(d.wet <= d.cap * 0.9, d.wet <= d.cap),
      why: [{ text: `${fmt(d.cap - d.wet)} kg spare on the rocket`, tone: tone(d.cap - d.wet > d.cap * 0.1, true) }, { text: `Data rate ×${d.an.rate}`, detail: 'more science home in Mission 3' }] },
    { how: `Orbit ${fmt(p.periAltKm)} × ${fmt(p.apoAltKm)} km`, detail: `tilt ${fmt(p.incDeg)}°, high point ω ${fmt(p.argpDeg)}°`, tone: tone(t.coverage >= goal, t.coverage >= goal * 0.7),
      why: [{ text: `${pct(t.coverage)} contact (goal ${pct(goal)})`, detail: 'slow high point over the base', tone: tone(t.coverage >= goal, t.coverage >= goal * 0.7) }]
        .concat(sp ? [{ text: `${sizeText(sp.gsdM)} pixels (goal ${sizeText(sp.goalGsdM)})`, detail: 'pixel size grows with height', tone: tone(sp.goalMet, sp.gsdM < sp.goalGsdM * 3) }] : []) },
    { how: `Burn ${fmt(run.dv * 1000)} m/s`, detail: retries ? 'after one fly-by' : 'first try', tone: tone(err < 0.02 && !retries, err < 0.1),
      why: [{ text: `${fmt(err * 100, 1)}% off the planned high point`, detail: 'vis-viva: small Δv, big change', tone: tone(err < 0.02, err < 0.1) }] },
  ];
  if (event) branches.push({ how: `Storm: ${event.choice === 'safe' ? 'safe mode' : 'kept transmitting'}`, detail: d.sh.name, tone: tone(!event.hit && event.lostH < 2, !event.hit),
    why: [{ text: event.hit ? `Reset: ${hrs(event.lostH)} lost` : event.lostH > 0 ? `${hrs(event.lostH)} lost, satellite safe` : 'Nothing lost', tone: tone(!event.hit && event.lostH < 2, !event.hit) }] });
  return whyTree({ title: 'Why it went this way: WHAT happened, HOW you decided, WHY it turned out so', what: `${score} / 100 · ${score >= 65 ? 'Relay online' : 'Relay weak'}`, whatDetail: `${pct(t.coverage)} contact for the rover`, tone: score >= 65 ? 'good' : 'warn', branches,
    labels: ['WHAT', 'HOW', 'WHY'] });
}
