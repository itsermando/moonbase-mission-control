// Random mission events. Each one teaches a real surface-operations problem.
// If the rover has no link to Earth when an event happens, the team can't choose:
// the rover takes the default action on its own.

const roll = (state) => state.rand();

export const EVENTS = [
  {
    id: 'dust', title: 'Dust on the solar panels',
    when: (s, ctx) => s.rover.solarW > 0 && ctx.action === 'drive',
    weight: 1,
    text: 'Driving kicked up dust. It sticks to everything (on the Moon it is even electrically charged). Your panels now make 25% less power.',
    apply: (s) => { s.dust = Math.min(0.5, s.dust + 0.25); },
    choices: [
      { label: 'Tilt and shake the panels (1 h)', run: (s, eng) => { eng.wait(s, 1); s.dust = 0; return 'Panels clean. Full power again.'; } },
      { label: 'Ignore it', run: () => 'Panels stay dusty. Less power for the rest of the mission unless you clean them.' },
    ],
    auto: 1,
  },
  {
    id: 'stuck', title: 'Wheel stuck in soft soil',
    when: (s, ctx) => ctx.action === 'drive' && s.rover.mob.id !== 'legs',
    weight: 1,
    text: 'One wheel sank into fluffy regolith. Spirit rover got stuck like this on Mars in 2009 and never got out.',
    choices: [
      { label: 'Wheel-walk out (2 h, mesh wheels only)', needs: (s) => s.rover.mob.id === 'mesh6',
        run: (s, eng) => { eng.wait(s, 2, 140); return 'Each wheel lifted and pushed in turn. Free.'; } },
      { label: 'Rock back and forth (3 h, may fail)', run: (s, eng) => {
        eng.wait(s, 3, 140);
        if (roll(s) < 0.7) return 'It worked. Free after 3 hours.';
        eng.wait(s, 8, 140); return 'Dug in deeper. It took 11 hours in total to get out.';
      } },
      { label: 'Ask engineers on Earth to plan an escape (4 h, needs link)', needsLink: true,
        run: (s, eng) => { eng.wait(s, 4, 60); return 'The team on Earth tested the move on a twin rover first. Free.'; } },
    ],
    auto: 1,
  },
  {
    id: 'slip', title: 'Leg slipped on the crater wall',
    when: (s, ctx) => ctx.action === 'drive' && ctx.steep && s.rover.mob.id === 'legs',
    weight: 3,
    text: 'Loose rocks rolled away under one leg on the steep wall.',
    choices: [
      { label: 'Stop and re-plan each step (2 h)', run: (s, eng) => { eng.wait(s, 2); return 'Slow and safe. No damage.'; } },
      { label: 'Push on', run: (s) => {
        if (roll(s) < 0.4) { s.damage.drive = 1.3; return 'A leg motor is strained. Driving now costs 30% more power.'; }
        return 'Lucky. It held.';
      } },
    ],
    auto: 1,
  },
  {
    id: 'flare', title: 'Solar flare warning',
    when: () => true,
    weight: 0.6,
    text: 'Space weather forecasters on Earth see a big solar flare. Its radiation can scramble the rover computer.',
    noLinkText: 'There was no link to Earth, so the warning never arrived. Radiation hit while the rover was working and the computer restarted. You lost 8 hours.',
    noLink: (s, eng) => { eng.wait(s, 8, 0); },
    choices: [
      { label: 'Park, power down, wait it out (6 h)', run: (s, eng) => { eng.wait(s, 6, -30); return 'Safe. Powering down saved energy too.'; } },
      { label: 'Keep working', run: (s, eng) => {
        if (roll(s) < 0.5) { eng.wait(s, 8, 0); return 'The computer restarted anyway. You lost 8 hours.'; }
        return 'No damage this time.';
      } },
    ],
    auto: 0,
  },
  {
    id: 'heater', title: 'Heater circuit fault',
    when: (s) => s.rover.therm.id === 'heaters' && !s.rover.warm && !s.damage.noHeater,
    weight: 0.5,
    text: 'A heater circuit stopped working. Without heat, electronics freeze within hours in shadow (about -200 °C).',
    choices: [
      { label: 'Switch to the backup circuit (1 h, needs link)', needsLink: true, run: (s, eng) => { eng.wait(s, 1); return 'Backup heater on.'; } },
      { label: 'Carry on without it', run: (s) => { s.damage.noHeater = true; return 'No heaters now. Leave shadow within 3 hours.'; } },
    ],
    auto: 1,
  },
  {
    id: 'rock', title: 'Hit a buried rock',
    when: (s, ctx) => ctx.action === 'dig',
    weight: 1,
    text: 'The excavator hit a rock under the soil. Regolith is full of rocks thrown out by old impacts.',
    choices: [
      { label: 'Move over a little and dig again (1 h)', run: (s, eng) => { eng.wait(s, 1, 60); return 'New spot, clean soil.'; } },
      { label: 'Grind through it', run: (s) => { s.damage.digSlow = 0.5; return 'The next dig is half speed while you chew through rock.'; } },
    ],
    auto: 0,
  },
];

/** Maybe pick an event after an action that took `hours`. */
export function rollEvent(state, ctx, hours) {
  if (!state.rover.alive || state.ended) return null;
  const p = 1 - Math.pow(1 - 0.035, hours);
  if (state.rand() > p) return null;
  const pool = EVENTS.filter((e) => e.when(state, ctx) && state.lastEvent !== e.id);
  if (!pool.length) return null;
  let r = state.rand() * pool.reduce((a, e) => a + e.weight, 0);
  for (const e of pool) { r -= e.weight; if (r <= 0) { state.lastEvent = e.id; return e; } }
  return pool[pool.length - 1];
}
