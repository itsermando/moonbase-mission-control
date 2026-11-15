// CAPCOM's built-in knowledge: short answers in plain language, matched to a question by keywords.
// Runs entirely in the browser, offline. No AI model and no network: the question never leaves the device.
// Numbers quoted here match the game's own data (missions/*/data.js, parts.js, shared/worlds.js).
import { lightDelayText } from './worlds.js';

const STOP = new Set('the a an is are was were be been am do does did i me my we you your it its this that these those of in on at to for from with and or but so if then what whats how why when where which who can could should would will tell about explain mean means meaning please make get give use used using there here as by'.split(' '));

/** Lowercase words without filler, with plurals and -ing/-ed endings trimmed. Exported for tests. */
export function tokens(text) {
  return String(text).toLowerCase().replace(/[’']s\b/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean).filter((w) => !STOP.has(w)).map(stem);
}
function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) return w.slice(0, -1);
  return w;
}

// id, the question shown on its suggestion chip, w (optional weight below 1 for generic words so specific entries win), keywords (all words of one keyword must appear), missions it is most useful in, and the answer.
export const KB = [
  /* ----- the game ----- */
  { id: 'capcom', q: 'Who is CAPCOM Whiskers?', m: ['all'], keys: ['capcom', 'whiskers', 'who are you', 'cat guide'],
    a: 'CAPCOM stands for Capsule Communicator: the person in Mission Control who talks to the crew. Whiskers is our cat version. I explain trade-offs and warn you about problems. My answers come from the game’s built-in notes, so they work offline.' },
  { id: 'how-to-play', q: 'How do I play?', m: ['all'], keys: ['play', 'start', 'begin', 'instruction', 'get started', 'how to'],
    a: 'Fly three linked missions in order: 1 Orbit (place a relay satellite), 2 Rover (land and dig), 3 Comms (send the science home). Each mission hands its result to the next. Every one ends with a debrief that explains why you scored what you did.' },
  { id: 'scoring', q: 'How do I score higher?', m: ['all'], keys: ['score', 'scoring', 'point', 'win', 'medal', 'grade', 'higher', 'better', 'improve'],
    a: 'Each mission is scored out of 100 and the debrief lists every part of the score and why. The Moon campaign totals 300. Read the debrief, change one decision at a time and fly again: the Mission analyst shows what each option would cost before you choose.' },
  { id: 'analyst', q: 'What is the Mission analyst?', m: ['orbit', 'comms'], keys: ['analyst', 'forecast', 'recommend', 'decision tree', 'analyst pick', 'option', 'suggest'],
    a: 'Before you decide, the analyst calculates the outcome of each option with the game’s own physics and scoring, and shows it as a decision tree. “Analyst pick” marks the best predicted score. It never plays for you: you still fly the burn and make every call.' },
  { id: 'class-mode', q: 'What is class mode?', m: ['all'], keys: ['class mode', 'classroom', 'lesson', 'teacher', 'school', 'worksheet'],
    a: 'Class mode makes the missions shorter so a whole campaign fits in about 45 minutes. The Briefing Room has a lesson plan, discussion questions, a printable worksheet and a CSV export of results.' },
  { id: 'profiles', q: 'How do profiles and XP work?', m: ['all'], keys: ['profile', 'xp', 'level', 'badge', 'crew', 'player', 'rank'],
    a: 'Create up to four crew members. They earn XP, ranks, medals and badges as you fly. Everything is stored only in your browser: no accounts, and nothing is sent anywhere.' },
  { id: 'ai', q: 'Does the game use AI?', m: ['all'], keys: ['ai', 'artificial intelligence', 'chatgpt', 'language model', 'llm', 'gpt'],
    a: 'There is an optional AI mode, off by default, that can reword the analyst’s forecasts in plain language. It never calculates anything and only receives mission numbers. This question box does not use AI: its answers come from the game’s built-in notes.' },
  { id: 'data-sources', q: 'Where does the data come from?', m: ['all'], keys: ['data', 'source', 'nasa data', 'real data', 'where from', 'real', 'true'],
    a: 'Maps and heights come from NASA: LRO and its LOLA laser altimeter for the Moon, MGS MOLA and Viking for Mars, MESSENGER for Mercury, Dawn for Ceres and Vesta. Planet constants come from NASA/JPL. The Briefing Room lists every source. Sunlight, ice amounts and costs are simplified game models and are labelled.' },
  { id: 'accuracy', q: 'How accurate is the physics?', m: ['all'], keys: ['accurate', 'accuracy', 'realistic', 'simplified', 'physics', 'simulation', 'gmat'],
    a: 'Orbits use real two-body physics (Kepler’s laws and the rocket equation), the same first step NASA’s GMAT tool starts from. Costs, noise, sunlight at the pole and ice amounts are simplified so a student can reason about them.' },
  { id: 'models', q: 'Are the 3D models real NASA models?', m: ['all'], keys: ['model', '3d', 'nasa model', 'satellite kit', 'real spacecraft', 'saturn v', 'atlas', 'jupiter'],
    a: 'Yes. They come from NASA’s free 3D Resources library. On the spacecraft screen the satellite is built from NASA’s Satellite Kit parts and changes with your antenna and solar-wing choices. The models are for illustration; the game’s numbers are simplified.' },
  { id: 'slow', q: 'The game is slow. What can I do?', m: ['all'], keys: ['slow', 'lag', 'laggy', 'performance', 'fps', 'graphics', 'speed', 'fast', 'smooth', 'freeze', 'stutter'],
    a: 'Open the ? menu and set Graphics to Lite. It lowers the resolution, turns off shadows and animated backgrounds and caps the frame rate at 30. Auto does this by itself when your device struggles. Closing other tabs also helps.' },
  { id: 'elevation', q: 'What does the elevation map show?', m: ['all'], keys: ['elevation', 'topography', 'height map', 'altimeter', 'layer', 'colour map', 'color map'],
    a: 'On the Moon and Mars globes you can switch from NASA imagery to elevation. The colours show height measured by laser altimeters (LOLA on LRO for the Moon, MOLA on Mars Global Surveyor for Mars): blue is low, red is high.' },
  { id: 'keyboard', q: 'What are the keyboard shortcuts?', m: ['all'], keys: ['keyboard', 'shortcut', 'key', 'control', 'press', 'hotkey'],
    a: 'Press ? for the list. Common ones: G switches the orbit globe and ground track, 1 to 3 load real-mission orbits, O and X type bits in Comms, W A S D drive the rover, Space digs, F scans, R rests, and / opens this question box.' },
  { id: 'team', q: 'Who made this game?', m: ['all'], keys: ['team', 'who made', 'creator', 'built', 'jeongha', 'david', 'emad', 'cat on moon', 'author', 'budapest'],
    a: 'Cat on Moon is a team of three from Budapest: Jeongha, David and Emad, made for the NASA Space Apps Challenge 2026. Mission 3’s signal game is based on Jeongha’s design.' },
  { id: 'music', q: 'What is the music?', m: ['all'], keys: ['music', 'soundtrack', 'golden record', 'voyager', 'song', 'sound'],
    a: 'The score is original ambient music generated live in your browser, inspired by the Voyager Golden Record. The record’s real music is still under copyright, so we don’t use it. Short NASA public-domain clips play at key moments: Apollo 11 and the Sputnik beeps.' },

  /* ----- Mission 1: Orbit ----- */
  { id: 'orbit', q: 'What is an orbit?', m: ['all'], w: 0.5, keys: ['orbit', 'orbital', 'satellite path'],
    a: 'An orbit is a path around a world. The satellite is always falling toward the world, but it is also moving sideways so fast that it keeps missing it. Higher orbits are slower and take longer to go around.' },
  { id: 'apsis', q: 'What are periapsis and apoapsis?', m: ['orbit'], keys: ['periapsis', 'apoapsis', 'periapse', 'apoapse', 'perigee', 'apogee', 'lowest point', 'highest point', 'pe ap'],
    a: 'Periapsis is the lowest point of an orbit and apoapsis the highest. A satellite moves fastest at periapsis and slowest at apoapsis (Kepler’s second law), so it spends the most time near apoapsis. That is why you put the apoapsis over your base.' },
  { id: 'inclination', q: 'What is inclination?', m: ['orbit'], keys: ['inclination', 'tilt', 'polar', 'equatorial', 'incline'],
    a: 'Inclination is how tilted the orbit is compared with the world’s equator. 0° follows the equator and 90° passes over both poles. A polar orbit is the way to see a base near a pole.' },
  { id: 'omega', q: 'What does ω (argument of periapsis) do?', m: ['orbit'], keys: ['argument of periapsis', 'omega', 'ω', 'north pole', 'south pole', 'apoapsis over'],
    a: 'ω decides where along the orbit the lowest point sits. ω = 90° puts the apoapsis over the south pole and 270° over the north pole. Since the satellite crawls at apoapsis, it hangs above the base for hours.' },
  { id: 'delta-v', q: 'What is delta-v?', m: ['orbit'], keys: ['delta v', 'deltav', 'change in speed', 'velocity change', 'dv'],
    a: 'Delta-v is the change in speed an engine has to make. Braking into orbit needs delta-v, and because of the rocket equation the fuel needed grows exponentially with it, so a big burn is very expensive.' },
  { id: 'fuel', q: 'Why does fuel matter so much?', m: ['orbit'], keys: ['fuel', 'propellant', 'rocket equation', 'tsiolkovsky', 'exponential', 'wet mass'],
    a: 'You have to launch the fuel too, and then you need more fuel to carry that fuel. That is the rocket equation: fuel grows exponentially with delta-v. The game adds a 10% safety margin, and fuel plus the satellite must fit on your rocket.' },
  { id: 'period', q: 'How long does an orbit take?', m: ['orbit'], keys: ['period', 'kepler', 'third law', 'how long orbit', 'orbit time', 'revolution', 'go around', 'one lap', 'lap'],
    a: 'Bigger orbits take longer: the period grows with the orbit size to the power 1.5 (Kepler’s third law). A 50 km lunar orbit takes about 2 hours, like NASA’s LRO, and Dawn’s 210 km orbit at Vesta takes about 4.3 hours.' },
  { id: 'capture', q: 'What is the capture burn?', m: ['orbit'], keys: ['capture', 'burn', 'brake', 'braking', 'insertion', 'loi', 'orbit insertion', 'retro'],
    a: 'On arrival the spacecraft is moving too fast for the world’s gravity to hold it. The capture burn slows it down so it falls into orbit. Too little braking and you overshoot into a huge loose orbit; too much and the orbit ends up lower than planned.' },
  { id: 'contact', q: 'How do I get more contact time?', m: ['orbit'], keys: ['contact', 'coverage', 'window', 'visibility', 'line of sight', 'elevation angle', 'horizon', 'gap'],
    a: 'Contact counts the time the satellite is above about 10° elevation as seen from the base. For more: put the apoapsis over the base (ω 90° for a southern base, 270° for a northern one), raise the apoapsis, and use a polar inclination. The analyst already offers designs that pass.' },
  { id: 'relay', q: 'Why do we need a relay satellite?', m: ['orbit', 'rover'], keys: ['relay', 'why satellite', 'need satellite', 'hidden', 'see earth', 'direct'],
    a: 'Near the poles Earth sits low on the horizon, and crater walls often hide it, so a rover cannot always call home directly. A relay satellite sees both the rover and Earth and passes the messages along.' },
  { id: 'launcher', q: 'Which launch vehicle should I pick?', m: ['orbit'], keys: ['launcher', 'rocket', 'launch vehicle', 'capacity', 'payload', 'launch mass', 'too heavy', 'heavy'],
    a: 'Each launcher can lift a limited mass, and farther worlds get a smaller share. Small is cheap ($20M) but carries little; medium ($60M) is the workhorse; heavy ($140M) lifts anything but eats most of the $200M budget. The Go / no-go board tells you if it fits.' },
  { id: 'antenna', q: 'Dish or patch antenna?', m: ['orbit'], keys: ['antenna', 'dish', 'patch', 'data rate', 'bandwidth', 'big dish'],
    a: 'A dish focuses the signal into a narrow beam, so more data gets through: the large dish gives ×4 the data of the patch. But it weighs 35 kg, costs more and needs 120 W. The patch is light and cheap but slow. More data rate gives Mission 3 more time.' },
  { id: 'power', q: 'How much power do I need?', m: ['orbit'], keys: ['solar', 'wing', 'power', 'watt', 'electricity', 'panel'],
    a: 'The bus, computer and antenna need electricity, and solar wings make it. If the antenna needs more watts than the wings give, the design is no-go. Small wings give 150 W, large wings 400 W, and they cost mass and money.' },
  { id: 'storm', q: 'What should I do in the solar storm?', m: ['orbit'], keys: ['storm', 'solar storm', 'flare', 'safe mode', 'radiation', 'reset', 'charged particle'],
    a: 'A solar storm is a burst of charged particles that can reset a satellite’s computer. Safe mode switches the antenna off for 6 hours: a known cost. Keeping it on has a 40% chance of a 14-hour reset. The expected loss is about equal, so it is really a choice about risk. Check the analyst’s numbers.' },
  { id: 'gonogo', q: 'What is the Go / no-go board?', m: ['orbit'], keys: ['go no go', 'no go', 'nogo', 'requirement', 'blocked', 'cannot launch', 'checklist'],
    a: 'Like a real launch review, each requirement shows GO, WARN or NO-GO. A NO-GO (too heavy, over budget, not enough power, periapsis too low) blocks the launch until you fix it. WARN means it works but is worth a look.' },
  { id: 'budget', q: 'How does the budget work?', m: ['orbit', 'rover'], keys: ['budget', 'cost', 'money', 'expensive', 'cheap', 'price'],
    a: 'Every part costs money. Mission 1 has a $200M budget and the rover has $400M. The analyst’s “Lowest cost” design shows the cheapest one that still meets the goal. Spending less is not always better: the score also rewards contact and data.' },
  { id: 'presets', q: 'What are the real-mission presets?', m: ['orbit'], keys: ['preset', 'real mission', 'real orbit', 'maven', 'nrho', 'halo', 'frozen orbit', 'gateway'],
    a: 'The presets are simplified versions of real orbits: NASA’s LRO (low polar, Moon), Gateway’s NRHO (a long loop passing close to the south pole), MRO and MAVEN at Mars, MESSENGER at Mercury and Dawn at Ceres and Vesta. Press 1, 2 or 3 to load one, then change anything.' },
  { id: 'lro', q: 'What is LRO?', m: ['orbit', 'rover'], keys: ['lro', 'lola', 'lunar reconnaissance', 'laser altimeter', 'wac'],
    a: 'The Lunar Reconnaissance Orbiter has mapped the Moon from orbit since 2009. Its laser altimeter, LOLA, measured the heights and slopes behind this game’s Shackleton crater map, and its Wide Angle Camera made the Moon globe.' },
  { id: 'artemis', q: 'What is Artemis?', m: ['all'], keys: ['artemis', 'astronaut', 'return to moon', 'crewed'],
    a: 'Artemis is NASA’s programme to return astronauts to the Moon, including the south pole region, where water ice may be found. Water means drinking water, air and rocket fuel, which is why this game sends a rover to look for it.' },
  { id: 'dawn', q: 'What are Vesta and Ceres?', m: ['orbit'], keys: ['vesta', 'ceres', 'dawn', 'asteroid', 'dwarf planet', 'rheasilvia', 'occator', 'belt'],
    a: 'Vesta is a giant asteroid with a basin about 500 km wide at its south pole, and Ceres is a dwarf planet with salty bright spots. NASA’s Dawn orbited both, the first spacecraft to orbit two worlds beyond the Earth and the Moon. Their gravity is weak, so orbits there are slow and gentle.' },
  { id: 'mercury', q: 'Why is Mercury hard?', m: ['orbit'], keys: ['mercury', 'messenger', 'sun heat', 'closest to sun'],
    a: 'Mercury is so deep in the Sun’s gravity well that a spacecraft arrives very fast, so braking into orbit takes a lot of fuel. NASA’s MESSENGER orbited it from 2011 to 2015 in an ellipse that kept it away from the heat.' },

  /* ----- Mission 2: Rover ----- */
  { id: 'regolith', q: 'What is regolith?', m: ['rover'], keys: ['regolith', 'moon soil', 'lunar soil', 'dust', 'soil'],
    a: 'Regolith is the loose, dusty soil that covers the Moon, made by billions of years of meteorite impacts. It is sharp and abrasive. Astronauts could use it to build landing pads and radiation walls, so digging it is a real goal.' },
  { id: 'ice', q: 'Why is there ice in some craters?', m: ['rover'], keys: ['ice', 'cold trap', 'water', 'shadowed', 'permanently shadowed', 'frozen', 'lcross'],
    a: 'Some craters near the poles never see sunlight, so they stay colder than about −200 °C. Water that lands there can stay frozen for billions of years: a cold trap. NASA’s LCROSS found about 5.6% water in Cabeus crater.' },
  { id: 'south-pole', q: 'Why the Moon’s south pole?', m: ['rover', 'orbit'], keys: ['south pole', 'shackleton', 'why pole', 'rim', 'sunlight'],
    a: 'The Sun skims the horizon there, so some high rims get almost constant sunlight for power, while nearby craters are permanently dark and hold ice. Shackleton crater’s rim is the best of both. Its walls are steep, so the floor is hard to reach.' },
  { id: 'mobility', q: 'Wheels or legs?', m: ['rover'], keys: ['wheel', 'leg', 'walker', 'mobility', 'slope', 'steep', 'rigid', 'mesh'],
    a: 'Steeper ground needs better mobility. Four rigid wheels (35 kg, $20M) cope with gentle slopes, six mesh wheels with wheel-walking (60 kg, $45M) with more, and the six-legged walker (95 kg, $80M) with the steepest, but it is the slowest at 0.2 km/h and the most expensive.' },
  { id: 'tether', q: 'What does the tether do?', m: ['rover'], keys: ['tether', 'winch', 'crater floor', 'floor', 'cliff', 'wall'],
    a: 'The 3 km winch tether lets the rover lower itself down steep crater walls and climb back out. Shackleton’s floor has the richest ice but is too steep for wheels, so it needs the tether or legs.' },
  { id: 'digger', q: 'Which excavator should I take?', m: ['rover'], keys: ['digger', 'excavator', 'scoop', 'drum', 'drill', 'dig', 'excavat', 'bucket', 'rassor'],
    a: 'The scoop is cheap but weak, the bucket drum digs fastest (80 kg an hour), and the 1 m drill is slow but best in frozen ground. In frozen ground the scoop falls to 20% of its rate and the drum to 50%, but the drill keeps its full rate.' },
  { id: 'battery', q: 'How do I save battery?', m: ['rover'], keys: ['battery', 'charge', 'recharge', 'brownout', 'fault', 'fault protection', 'energy', 'low battery'],
    a: 'Under 12% battery, fault protection stops driving and digging until you recharge. If it reaches zero in sunlight the rover shuts down and loses 6 hours; in the dark it can freeze. Rest (R) in the sun to recharge, and use the route preview to see a drive’s battery cost first.' },
  { id: 'night', q: 'What happens in the dark?', m: ['rover'], keys: ['night', 'dark', 'shadow', 'freeze', 'froze', 'cold', 'temperature', 'heater', 'insulation', 'thermal'],
    a: 'In shadow a rover loses heat and can freeze (its electronics crack at about −200 °C). Insulation blankets survive only 3 hours in shadow, insulation plus heaters survive any shadow, and an RTG keeps the rover warm. The lunar night is about 14 days long, and your mission has to end before it.' },
  { id: 'rtg', q: 'What is an RTG?', m: ['rover'], keys: ['rtg', 'nuclear', 'plutonium', 'radioisotope', 'mmrtg'],
    a: 'A radioisotope thermoelectric generator turns the heat of decaying plutonium-238 into electricity. It works in the dark and keeps the rover warm, but it is heavy and costs a lot ($130M here). Perseverance uses one.' },
  { id: 'scan', q: 'What does the scan do?', m: ['rover'], keys: ['scan', 'neutron', 'spectrometer', 'ice finder', 'hidden ice'],
    a: 'The neutron spectrometer scan (F) takes 1 hour and 15 W, and reveals hidden ice in the squares around the rover (a 5 × 5 area). Scan before you spend hours digging. You need the Neutron spectrometer part for it.' },
  { id: 'controls', q: 'How do I drive the rover?', m: ['rover'], keys: ['control', 'drive', 'move', 'click', 'route', 'plan', 'walk', 'wasd'],
    a: 'Hover the ground to see the route and what it costs in hours and battery. Click once to plan and twice to drive. W A S D move one square, Space digs for 2 hours, F scans and R rests for 4 hours.' },
  { id: 'lander', q: 'How much can the lander carry?', m: ['rover'], keys: ['lander', 'mass', 'kg', 'weight', 'limit', 'carry'],
    a: 'The lander carries 450 kg to the surface, and every part, plus the rover body (120 kg), counts against that. Lighter parts leave room for stronger ones elsewhere. The Build screen shows your mass live.' },
  { id: 'day', q: 'How long is a lunar day?', m: ['rover'], keys: ['lunar day', 'day length', 'how long day', 'sunrise', 'hours', 'time limit'],
    a: 'From one sunrise to the next takes about 29.5 Earth days. The rover mission gives you 14 days of sunlight (7 in class mode) before the long night begins, so plan your hours.' },
  { id: 'mars', q: 'What is Jezero crater?', m: ['rover'], keys: ['mars', 'jezero', 'perseverance', 'sample', 'core', 'delta', 'ancient river', 'life'],
    a: 'Jezero is a crater on Mars that once held a lake fed by a river. NASA’s Perseverance landed there on 18 February 2021 and seals rock cores into tubes for a future trip to Earth. The delta may hold signs of ancient life, so the Mars missions ask you to core samples there.' },
  { id: 'dust', q: 'What are Mars dust storms?', m: ['rover'], keys: ['dust storm', 'dust season', 'dusty', 'opportunity'],
    a: 'Mars has dust storms that block sunlight and cover solar panels. NASA’s Opportunity rover ended its mission after a global dust storm in 2018. In the game, dust lowers your solar power, and the dust season ends the mission.' },

  /* ----- Mission 3: Comms ----- */
  { id: 'bits', q: 'What is a bit?', m: ['comms'], keys: ['bit', 'byte', 'binary digit', 'zero and one', 'digital'],
    a: 'A bit is a single 0 or 1, and everything a spacecraft sends is made of bits. A byte is a group of 8 bits. Photos, soil data and commands are all just long strings of them.' },
  { id: 'binary', q: 'How do I read the binary groups?', m: ['comms'], keys: ['binary', 'convert', 'decode', 'uplink', 'five bit', 'letter', 'place value', 'number'],
    a: 'Read each 5-bit group as a number, then as a letter (A = 1, B = 2, and so on). Place values from the right are 1, 2, 4, 8 and 16. So 00100 = 4 = D, and 01111 = 8 + 4 + 2 + 1 = 15 = O.' },
  { id: 'parity', q: 'What is a parity bit?', m: ['comms'], keys: ['parity', 'error check', 'check bit', 'even', 'odd', 'error detection'],
    a: 'A parity bit is an extra bit that makes the number of 1s in a byte even. If noise flips one bit on the way, the count turns odd and Earth knows the byte is damaged and asks for it again. It catches single flips but costs one extra bit per byte.' },
  { id: 'compression', q: 'What does compression do?', m: ['comms'], keys: ['compression', 'compress', 'smart', 'lossy', 'lossless', 'squeeze', 'smaller'],
    a: 'Compression squeezes data into fewer bits so more fits in the contact window. Some kinds lose detail, so you trade science value for time. The analyst shows the best mix for your window.' },
  { id: 'noise', q: 'Why do bits flip?', m: ['comms'], keys: ['noise', 'flip', 'interference', 'corrupt', 'damage', 'static', 'error'],
    a: 'Radio signals weaken across space and pick up noise from electronics, the Sun and cosmic rays, which can flip a 0 into a 1. Error checks like parity catch the damage. Without them, a flipped bit can silently ruin a packet.' },
  { id: 'delay', q: 'Why is there a signal delay?', m: ['comms', 'orbit'], keys: ['delay', 'light time', 'light speed', 'lag', 'latency', 'how long signal', 'speed of light', 'wait'],
    a: (c) => `Radio travels at the speed of light, which still takes ${lightDelayText(c.world)} from ${c.world.name} to Earth. That is why you cannot ask Earth for help in the middle of a problem, and why real rovers must decide some things alone.` },
  { id: 'dsn', q: 'What is the Deep Space Network?', m: ['comms'], keys: ['dsn', 'deep space network', 'goldstone', 'madrid', 'canberra', 'station', 'ground antenna', 'dish'],
    a: 'NASA’s Deep Space Network has giant antennas at three sites: Goldstone in California, Madrid in Spain and Canberra in Australia, spaced so that one of them always faces a spacecraft as the Earth turns. The biggest dishes are 70 m across.' },
  { id: 'link', q: 'What are downlink and uplink?', m: ['comms'], keys: ['downlink', 'uplink', 'transmit', 'send', 'receive', 'command'],
    a: 'Downlink is data going from the spacecraft to Earth, like your rover’s science. Uplink goes from Earth to the spacecraft, like commands. In Mission 3 you downlink your packets first, then decode Earth’s reply on the uplink.' },
  { id: 'window', q: 'How long is my contact window?', m: ['comms'], keys: ['contact window', 'seconds', 'time left', 'window', 'timer', 'relay time', 'run out'],
    a: 'Your window comes from your Mission 1 relay: more contact time and a bigger antenna give you more seconds. Anything not finished when the relay drops below the horizon stays on the rover, so send the most valuable packets first.' },
  { id: 'typing', q: 'Does typing speed matter?', m: ['comms'], keys: ['typing', 'speed', 'accuracy', 'mistake', 'wrong key', 'type'],
    a: 'Accuracy beats speed: each wrong key costs 2 seconds. A typical player types about 2 bits a second, which is why the plan shows a “typeable bits” estimate. Use O or 0 for a 0 bit and X or 1 for a 1 bit.' },
  { id: 'apollo', q: 'What was Apollo 11?', m: ['all'], keys: ['apollo', 'eagle', 'neil armstrong', 'one small step', 'first landing', 'sputnik'],
    a: 'Apollo 11 landed the first people on the Moon on 20 July 1969. The game plays short NASA recordings of “The Eagle has landed” and “One small step”. Sputnik 1, launched in 1957, was the first satellite; its beeps play when the downlink opens.' },
];

const BY_MISSION = {
  orbit: ['period', 'apsis', 'delta-v', 'contact'], rover: ['ice', 'mobility', 'battery', 'scan'],
  comms: ['parity', 'binary', 'delay', 'dsn'], all: ['scoring', 'data-sources', 'models', 'slow'],
};
const byId = (id) => KB.find((e) => e.id === id);
/** Suggestion chips for a mission: [{ id, q }] */
export function suggestions(mission) { return (BY_MISSION[mission] || BY_MISSION.all).map(byId).map((e) => ({ id: e.id, q: e.q })); }

/**
 * Find the best answer. Returns { id, q, text, related: [{id, q}] }, or { id: null, text, related } when nothing matches.
 * ctx: { world, mission }
 */
export function ask(question, ctx = {}) {
  const qt = new Set(tokens(question));
  const scored = KB.map((e) => {
    let s = 0;
    for (const k of e.keys) { const kt = tokens(k); if (kt.length && kt.every((t) => qt.has(t))) s += (kt.length * 2 + 1) * (e.w ?? 1); }
    for (const t of tokens(e.q)) if (qt.has(t)) s += 0.5;
    if (s > 0 && (e.m.includes(ctx.mission) || e.m.includes('all'))) s += 0.75;
    return { e, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const best = scored[0];
  if (!best || best.s < 2.5) {
    return { id: null, q: question, text: 'I don’t have a good answer to that yet. Try one of these, or use a space word like periapsis, delta-v, parity or regolith.',
      related: suggestions(ctx.mission) };
  }
  const { e } = best;
  return { id: e.id, q: e.q, text: typeof e.a === 'function' ? e.a(ctx) : e.a, related: scored.slice(1, 4).filter((x) => x.s >= 1.5).map((x) => ({ id: x.e.id, q: x.e.q })) };
}

/** The stored answer for a chip, bypassing matching. */
export function answerFor(id, ctx = {}) {
  const e = byId(id); if (!e) return null;
  return { id: e.id, q: e.q, text: typeof e.a === 'function' ? e.a(ctx) : e.a, related: [] };
}
