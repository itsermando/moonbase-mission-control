// CAPCOM Whiskers: the in-game guide. Rule-based, so it gives the same advice every time.
// It explains WHY a choice matters instead of only saying right or wrong.
import { LIMITS } from './parts.js';
import { cells, nearestReachable, findPath, sunAt, commsAt, SLOPE_TEXT, WORLD_ID, relayInfo } from './world.js';

const mars = () => WORLD_ID === 'mars';
const h = (x) => (x < 1 ? `${Math.round(x * 60)} min` : `${x.toFixed(1)} h`);

/** Pre-launch test campaign. Returns checks with status 'pass' | 'warn' | 'fail'. */
export function runTests(sum, objective, siteK) {
  const out = [];
  const add = (status, title, why) => out.push({ status, title, why });
  const site = cells[siteK];

  add(sum.massKg <= LIMITS.landerCapacityKg ? 'pass' : 'fail', `Mass ${sum.massKg} kg (limit ${LIMITS.landerCapacityKg} kg)`,
    sum.massKg <= LIMITS.landerCapacityKg ? 'The lander can carry it.' : 'Too heavy: the lander cannot land with this rover. Remove or swap parts.');
  add(sum.costM <= LIMITS.budgetM ? 'pass' : 'fail', `Cost $${sum.costM}M (budget $${LIMITS.budgetM}M)`,
    sum.costM <= LIMITS.budgetM ? 'Within budget.' : 'Over budget: the mission would be cancelled.');

  const workW = LIMITS.baseLoadW + sum.dig.digW;
  const peakSun = mars() ? 0.45 : sunAt(site, 0);
  const sunGen = sum.solarW * peakSun + sum.rtgW;
  const darkLoad = LIMITS.baseLoadW + (sum.warm ? 0 : sum.therm.heaterW) - sum.rtgW;
  const darkHours = darkLoad > 0 ? sum.batteryWh / darkLoad : Infinity;
  const title = sum.rtgW ? 'Power while digging' : 'Power in sunlight';
  const need = `The ${sum.dig.name.toLowerCase()} needs ${sum.dig.digW} W, plus ${LIMITS.baseLoadW} W for the computer`;
  if (sunGen >= workW) add('pass', title, `${need}. You make about ${Math.round(sunGen)} W${sum.rtgW ? ' from the RTG' : ' in full sun here'}.`);
  else add('warn', title, `${need}, but you make about ${Math.round(sunGen)} W${sum.rtgW ? ' from the RTG' : ' in full sun here'}. The battery will drain while you dig.`);

  if (mars()) {
    if (sum.warm) add('pass', 'Surviving the night', 'Martian nights last about 12 hours at around -80 °C. The RTG keeps you warm and powered, like Curiosity and Perseverance.');
    else if (darkHours >= 13 && sum.therm.heaterW) add('pass', 'Surviving the night', `Heaters plus battery last about ${h(darkHours)} in the dark: enough for one night.`);
    else add('warn', 'Surviving the night', sum.therm.heaterW ? `Your battery keeps the heaters going about ${h(darkHours)}, but a Martian night lasts about 12 hours.` : 'Blankets alone freeze within 3 hours of nightfall. Add heaters, a bigger battery or an RTG.');
  } else if (objective.id !== 'base') {
    if (sum.warm) add('pass', 'Cold and dark', 'The RTG keeps you warm and powered in shadow.');
    else if (sum.therm.heaterW) add(darkHours > 6 ? 'pass' : 'warn', 'Cold and dark', `In shadow you can work about ${h(darkHours)} on battery before you must come back to the Sun.`);
    else add('warn', 'Cold and dark', 'Ice is only in shadow, and blankets alone freeze after 3 hours there. Add heaters or an RTG, or keep trips very short.');
  }

  // groups of places the rover must reach; one group = "any of these"
  const groups = mars() ? (objective.needKinds?.length ? [...new Set(objective.needKinds)].map((k) => [k]) : [['delta', 'floor', 'rim', 'plain']])
    : [objective.id === 'dark' ? ['floor'] : objective.id === 'ice' ? ['trap', 'floor', 'wall'] : ['plain', 'trap']];
  const goals = groups.map((g) => nearestReachable(site, g, sum));
  if (goals.some((g) => !g)) {
    add('fail', 'Can it reach the dig sites?', objective.id === 'dark'
      ? 'Shackleton’s walls are steeper than 20°. Wheels alone cannot get down. You need a tether or a walker.'
      : 'No route from your landing site to every place you must visit. Pick a different site or better mobility.');
  } else {
    const p = findPath(site, goals[0], sum);
    add(p.hours < 60 ? 'pass' : 'warn', 'Can it reach the dig sites?', `Yes: the first site is about ${p.hours.toFixed(0)} h away, ${(p.wh / 1000).toFixed(1)} kWh. ${p.hours >= 60 ? 'That is a long way. Land closer?' : ''}`);
  }

  if (!mars() && objective.id !== 'base') {
    add(sum.sci.scan ? 'pass' : 'warn', 'Finding the ice', sum.sci.scan ? 'The neutron spectrometer will show buried ice.' : 'Without an ice detector you dig blind. Ice amounts change a lot between spots.');
    add(sum.dig.iceFactor >= 0.5 ? 'pass' : 'warn', 'Digging frozen soil', sum.dig.iceFactor >= 0.5 ? `Your ${sum.dig.name.toLowerCase()} handles ice-cemented soil.` : 'Icy soil is hard as concrete. The scoop works at only 20% speed there.');
  }
  if (mars()) add(sum.dig.id === 'drill' ? 'pass' : 'warn', 'Coring rock', sum.dig.id === 'drill' ? 'A drill cores solid rock samples, like Perseverance.' : 'Scoops and drums only collect loose soil. Samples still count, but scientists prefer rock cores.');

  const r = relayInfo();
  const linkHours = Array.from({ length: 24 }, (_, t) => commsAt(site, t, sum.comm).ok).filter(Boolean).length;
  add(linkHours >= 8 ? 'pass' : 'warn', 'Link to Earth', `${linkHours} of 24 hours with a link at the landing site.${sum.comm.relay ? ` Relay windows: ${h(r.windowH)} every ${h(r.periodH)}.` : ''}`);
  return out;
}

/** Short tips for each stage. */
export function hint(stage, ctx) {
  const tips = [];
  if (stage === 'briefing') tips.push(mars()
    ? 'Welcome to Mars, flight director. Signals take minutes to reach Earth, so your rover must survive on its own decisions.'
    : 'Welcome, flight director. Pick an objective. Harder ones score more science but need better hardware.');
  if (stage === 'site') {
    tips.push(mars() ? 'Pick a flat landing spot (green). The delta in the west holds the most interesting rocks.' : 'Landers need ground under 10°. Green squares are safe.');
    if (ctx.cell) {
      const c = ctx.cell;
      tips.push(mars() ? `This spot: ${SLOPE_TEXT[c.slope]} ground, ${c.kind === 'plain' ? 'open plain' : c.kind}.`
        : `This spot: slope ${SLOPE_TEXT[c.slope]}, sunlight about ${Math.round(sunAt(c, 0) * 100)}% now. ${c.elev >= 150 ? 'High enough to see Earth.' : 'Too low to see Earth directly.'}`);
    }
    if (!mars()) tips.push('Trade-off: high rims get Sun and an Earth view; the ice is down in the dark. Landing close to ice saves driving time.');
  }
  if (stage === 'build' && ctx.sum) {
    const s = ctx.sum;
    if (s.massKg > LIMITS.landerCapacityKg) tips.push(`Too heavy by ${s.massKg - LIMITS.landerCapacityKg} kg. Every kilogram costs fuel to land.`);
    if (s.costM > LIMITS.budgetM) tips.push(`Over budget by $${s.costM - LIMITS.budgetM}M.`);
    if (ctx.objective?.id === 'dark' && !s.extra.tether && s.mob.id !== 'legs') tips.push('The crater floor is behind walls steeper than 20°. Wheels alone will not make it down.');
    if (mars() && !s.warm && !s.therm.heaterW) tips.push('Martian nights last about 12 hours at around -80 °C. Blankets alone won’t survive one.');
    if (!mars() && ctx.objective?.id !== 'base' && !s.warm && !s.therm.heaterW) tips.push('Ice lives in permanent shadow at about -200 °C. Blankets alone give you 3 hours there.');
    if (s.rtgW && s.dig.digW > s.rtgW) tips.push(`The RTG gives ${s.rtgW} W but your digger needs ${s.dig.digW} W. You will dig in short bursts on battery.`);
    if (!tips.length) tips.push('Looks balanced. Run a test campaign before you launch: tests cost money but find problems on Earth, not on the Moon.');
  }
  if (stage === 'deploy' && ctx.state) {
    const s = ctx.state, c = cells[s.k];
    const pct = s.batteryWh / s.rover.batteryWh, sun = sunAt(c, s.t);
    if (pct < 0.25) {
      if (s.rover.rtgW) tips.push('Battery low. Rest anywhere: your RTG recharges you, Sun or no Sun.');
      else if (sun < 0.2) tips.push(mars() ? 'Battery low at night. Rest until sunrise and keep loads small.' : 'Battery low and no Sun here. Drive back to a sunlit spot now.');
      else tips.push('Battery low. Rest in the sunlight to recharge.');
    } else if (pct < 0.45 && sun < 0.1 && !s.rover.rtgW) tips.push('Working in the dark drains the battery fast. Plan your way back to sunlight.');
    if (s.shadowH > 1.5 && !s.rover.warm && !s.rover.therm.heaterW) tips.push(`You have been in the cold for ${s.shadowH.toFixed(1)} h. Blankets give out at 3 h.`);
    if (!commsAt(c, s.t, s.rover.comm).ok) tips.push('No link to Earth right now. If something goes wrong, the rover must decide on its own.');
    if (!mars() && s.rover.sci.scan && s.scanned.size === 0) tips.push('Try a neutron scan. It shows where buried ice is before you dig.');
    if (mars() && s.samples.length === 0) tips.push('Drill for 2 hours at a new spot to core a sample. The delta is worth the most.');
    if (s.dust > 0) tips.push(`Dust is blocking ${Math.round(s.dust * 100)}% of your solar power.`);
    const done = s.objective.metric === 'samples' ? s.samples.length >= s.objective.target : (s.objective.metric === 'water' ? s.cargo.water : s.cargo.regolith) >= s.objective.target;
    if (done) tips.push('Objective complete. Park somewhere safe and end the mission to bank the survival points.');
    if (!tips.length) tips.push('All systems nominal. Hover the ground to preview a route, then click twice to drive.');
  }
  return tips;
}

export const GLOSSARY = [
  ['Regolith', 'The loose, dusty soil and broken rock that covers the Moon and Mars.'],
  ['Cold trap', 'A spot that never gets sunlight, so ice that lands there stays frozen for billions of years.'],
  ['Permanently shadowed region', 'Crater floors near the lunar poles where the low Sun never shines. About -200 °C.'],
  ['Slope', 'How steep the ground is. Most rovers struggle above 15-20°.'],
  ['RTG', 'Radioisotope generator. Turns heat from decaying plutonium into steady electricity, day and night. Curiosity and Perseverance use one.'],
  ['Neutron spectrometer', 'Counts neutrons coming out of the ground. Fewer fast neutrons means hydrogen, which usually means water ice.'],
  ['Sol', 'A day on Mars: 24 hours 39 minutes.'],
  ['River delta', 'Where an old river dropped its mud into a lake. On Earth, deltas preserve signs of life, which is why Perseverance went to Jezero’s.'],
  ['LOLA / MOLA', 'Laser altimeters on NASA orbiters that measured the height of the Moon (LOLA) and Mars (MOLA). This game’s maps use their data.'],
  ['Relay satellite', 'A satellite that passes on messages between the rover and Earth. Yours comes from Mission 1.'],
];
