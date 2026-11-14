# Moonbase Mission Control

NASA Space Apps Challenge 2026 · Challenge: **Space Mission Design Game** · Team [Team name], Budapest

A role-playing survival game. Players design, test and fly three linked missions under real limits on mass, power, money, communications and time. In every mission they:

1. **Briefing**: choose an objective (easy, medium, hard)
2. **Site**: pick where to go on a real NASA map
3. **Build**: pick parts. Every part costs mass, money and power
4. **Test**: pay for a test campaign. Blockers stop launch; warnings are risks
5. **Deploy**: survive surprises with limited resources
6. **Debrief**: a score out of 100 and an explanation of why it worked or failed

A rule-based guide called **CAPCOM** explains *why* each choice matters, with a glossary.

| Mission | Owner | Status |
|---|---|---|
| 1. Earth-space link ("Signal Encoding") | Jeongha | playable |
| 2. Excavation and rover ("Operation Regolith") | [name] | playable |
| 3. Orbits and satellites | [name] | in development |

## Run it

No build step. Any static web server works (ES modules don't load from `file://`):

```bash
python -m http.server 5173
```

Then open http://localhost:5173. Tests: `npm test` (Node 20+).

## Mission 1: Earth-space link

Choose an instrument (temperature sensor, standard camera or HD camera), then encode its data into binary before the downlink window closes: press `O` for 0 and `X` for 1. Each packet makes the clock run faster; a wrong bit costs 3 seconds and 5 errors end the transmission. Files: `missions/comms/` (`connection.js` game logic, `style.css`, `result.js` saves the score to the hub).

## Mission 2: Operation Regolith

Land a rover on the rim of Shackleton crater at the lunar south pole and dig for regolith or water ice for 14 days before the lunar night.

- **Real terrain.** A 48 × 48 grid (about 333 m per cell) built from NASA LRO LOLA slope and elevation products, Site04 "Shackleton Rim". Shackleton's walls are steeper than 20°, so wheels alone can't reach the icy floor. Players need a tether or a walker.
- **Seven design slots**: mobility, power, excavator, thermal, comms, ice finder, special kit. Lander capacity is 450 kg and the budget $400M, so no rover can take every best part.
- **Survival**: battery, about -200 °C shadows, fault protection, and random events (stuck wheel, dust, solar flare, heater fault, buried rock). With no link to Earth, the rover picks the default action.
- **3D Moon (three.js)**: the real elevation becomes a 3D terrain with the game map draped over it. A low polar Sun circles the horizon and casts long shadows, Earth hangs low in the sky, and the rover (built from the parts you chose) drives, digs and scans with dust and pulse effects. Includes a powered-descent landing. A 2D map is always one click away, and is used automatically if three.js can't load.
- **Controls**: hover the ground to preview a route with its time and energy cost; click to plan and click again to drive. `W A S D` / arrow keys drive one square, `Space` digs, `F` scans, `R` rests, `Enter` drives the plan, `Esc` clears it. Sound effects can be muted.
- **Tests** (`tests/`): a robot player wins all three objectives with a sensible design, and a blankets-only rover freezes in the crater.

### Files

| File | What it does |
|---|---|
| `missions/rover/parts.js` | Objectives, limits, parts catalogue |
| `missions/rover/world.js` | Terrain, sunlight, ice, comms, pathfinding |
| `missions/rover/engine.js` | Game rules and scoring (no screen code) |
| `missions/rover/events.js` | Random events |
| `missions/rover/capcom.js` | Test checks and CAPCOM hints |
| `missions/rover/game.js`, `deploy.js`, `debrief.js`, `map.js` | Screens |
| `missions/rover/scene3d.js`, `rover-model.js` | three.js terrain, rover, lander and effects |
| `shared/fx.js`, `shared/game.css` | Sounds, toasts, game styling |
| `scripts/build_terrain.py` | Rebuilds `data/terrain.js` and the map pictures from NASA Moon Trek |

## For teammates: add your mission

1. Create `missions/<your-id>/index.html` and link `../../shared/style.css` so it looks the same.
2. Follow the same six stages and use the `.panel`, `.card`, `.meter`, `.capcom` classes.
3. At the end, call `saveResult('<your-id>', { score, grade, summary })` from `shared/results.js`. The hub reads it.
4. Share values between missions with `shareValue` / `readShared`. Example: the orbit mission can publish the relay pass schedule (`relayPasses`) and the rover can read it instead of its built-in "4 hours in every 12".
5. Set `ready: true` for your mission in `index.html`.

## NASA data and resources

- **LRO LOLA** south-pole products (87.5°S, 5 m/px): `ColorSlope_10below/15below/20above_LRO_LOLA_DEM_SPole875_5m`, `ColorSlope_LRO_LOLA_DEM_SPole875_5mp_v04`, `LRO_LOLA_Gray_SPole875_5mp_v04`, and `Site04_final_adj_5mpp_Hillshade`, all from [NASA Moon Trek WMTS](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon).
- Challenge resources used for the design: NASA *Design and Develop Science Missions* (mission segments), JPL *Concept Maturity Levels*, NASA GSFC *Mission Design Lab* study stages, and GMAT for the orbit mission.
- Real hardware the parts are modelled on: NASA VIPER (wheel-walking, neutron spectrometer), NASA RASSOR (bucket drums), Honeybee Robotics TRIDENT (drill), MMRTG (about 110 W). Ice levels are guided by the LCROSS result (about 5.6% water by mass in Cabeus crater).

**Simplified on purpose:** sunlight percentages, cold-trap locations (local low spots in the LOLA elevation), ice amounts and Earth visibility are game models based on the terrain, not measurements. The game says so on screen.

## Use of AI

The team chose the idea and the design decisions. We used an AI coding assistant as a tool to:
- research NASA data sources and check that the Moon Trek tiles can be used,
- write code for Mission 2 to the team's specification,
- draft the presentation slides.

The team reviewed, tested and edited everything. No AI-generated images or audio are used.

## Credits

NASA Moon Trek / LRO LOLA data (public domain). [three.js](https://threejs.org) r170 (MIT licence), loaded from the jsDelivr CDN. Sound effects are generated in the browser (Web Audio), no audio files. Fonts in the deck: Space Grotesk and Inter (SIL Open Font License).
