// Guided CAPCOM tutorial for Mission 1 (uses the shared tutorial engine in shared/tutorial.js).
// Steps point at real controls and wait for the player to use them; they never change game state themselves.
import { registerTutorial } from '../../shared/tutorial.js';

export function registerOrbitTutorial(screen) {
  registerTutorial({
    mission: 'orbit', title: 'Mission 1 tutorial', minutes: 5, screen,
    steps: [
      { screen: 'Briefing', at: '#profiles', say: 'First decide <b>what your satellite is for</b>. Every option relays the rover’s messages; two also carry a science instrument.',
        sci: 'Real relays like NASA’s TDRS carry no science. Orbiters like LRO do both, but compromise on their orbit.', until: { click: '[data-profile]' }, hint: 'Click one of the three cards.' },
      { screen: 'Briefing', at: '.wt', say: 'This diagram reads top to bottom: <b>WHAT</b> you must achieve, <b>HOW</b> you get there in four steps, and <b>WHY</b> each step matters.' },
      { screen: 'Briefing', at: '#next', say: 'Ready? Go to the assembly bay.', until: { screen: 'Spacecraft' }, hint: 'Click “Build the satellite”.' },
      { screen: 'Spacecraft', at: '#bay3d', say: 'This is your satellite, built from NASA Satellite Kit parts. It changes when you change a part. Drag to turn it.' },
      { screen: 'Spacecraft', at: '#chain', say: 'These chains show <b>consequences</b>: parts add mass, mass needs fuel, and everything must fit the rocket and the budget.',
        sci: 'The rocket equation: fuel grows exponentially with the speed change you need, so every extra kilogram costs more fuel.' },
      { screen: 'Spacecraft', at: '[data-k="antenna"][data-val="big"]', say: 'Try the <b>large dish</b> and watch the chains: more data, but 120 W of power.', until: { click: '[data-k="antenna"]' }, hint: 'Click any antenna card.' },
      { screen: 'Spacecraft', at: '#delta', say: 'This line tells you exactly what your last click changed. If a chain turns red, fix it before moving on.' },
      { screen: 'Spacecraft', at: '#next', say: 'Hover any card or <b>i</b> badge if a word is new. Then design the orbit.', until: { screen: 'Orbit design' }, hint: 'Click “Design the orbit”.' },
      { screen: 'Orbit design', at: '[data-preset]', say: 'Start from a <b>real mission’s orbit</b>: press 1, 2 or 3, or click a button.', until: { click: '[data-preset]' }, hint: 'Pick a preset.' },
      { screen: 'Orbit design', at: '.elements', say: 'Four numbers define the orbit. Hover the <b>i</b> next to each. Try moving the <b>apoapsis</b> (highest point) slider.',
        sci: 'Kepler’s 2nd law: a satellite crawls at its high point. Put that point over the base and it stays in view for hours.', until: { input: '[data-f]' }, hint: 'Drag any slider.' },
      { screen: 'Orbit design', at: '.gng', say: 'The <b>go / no-go</b> board is the flight controllers’ checklist. Every line must be GO or WARN before the burn.' },
      { screen: 'Orbit design', at: '#science', skip: { not: '#science' }, say: 'Your instrument’s view: the picture gets blockier as the orbit gets higher. Science wants low, the relay wants high. Find the balance.' },
      { screen: 'Orbit design', at: '#next', say: 'When the board is green, go to the capture burn.', until: { screen: 'Capture burn' }, hint: 'Click “Go to capture burn”.' },
      { screen: 'Capture burn', at: '.burnbox', say: 'You arrive too fast to stay. Set how hard to <b>brake</b>. The prediction shows the orbit you would get.',
        sci: 'Vis-viva: v² = GM (2/r − 1/a). A few metres per second change the high point by hundreds of kilometres.', until: { input: '#dvr, #dvn' }, hint: 'Move the brake slider or use the ± buttons.' },
      { screen: 'Capture burn', at: '#fire', say: 'Aim for an apoapsis error under 2%, then execute the burn.', until: { screen: ['Operations', 'Debrief'] }, hint: 'Click “Execute burn”.' },
      { screen: 'Operations', at: '#tlbar', say: 'Each green bar is a <b>contact window</b>: the rover can talk to Earth. These exact windows go to Mission 2.' },
      { screen: 'Operations', at: '#evbox .event-box', show: '#evbox .event-box', say: 'A solar storm! The analyst computed both outcomes before you decide. Your shielding set the odds.', until: { click: '[data-ev]' }, hint: 'Choose an order.' },
      { screen: 'Debrief', at: '#whytree', say: 'Read the tree: <b>WHAT</b> happened, <b>HOW</b> your decisions led there, and <b>WHY</b> the physics did what it did.' },
      { screen: 'Debrief', at: '#matrix', say: 'Tap any row for the formula and the numbers behind it. Then fly the rover in Mission 2.' },
    ],
    finale: { say: 'You placed a relay satellite like a real flight-dynamics team. Ask me about any word you met.' },
  });
}
