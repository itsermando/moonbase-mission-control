# Lunevra

**Every choice has a cost. Our game shows you why.**

NASA Space Apps Challenge 2026 · Challenge: *Space Mission Design Game* · Team **Cat on Moon** (Jeongha, David, Emad), Budapest

A decision-based teaching game. Players design and fly a complete space mission in three linked parts, on real NASA maps, and learn from every result:

| # | Mission | You decide | Hands on to the next mission |
|---|---|---|---|
| 1 | **Orbit**: place the relay satellite | The satellite's job (pure relay, relay + hazard camera, relay + ice hunter), rocket, antenna, solar power, science instrument, radiation shielding, orbit shape; a timed capture burn; a solar-storm decision | Relay contact windows |
| 2 | **Rover**: land and dig (Moon) or core samples (Mars) | Landing site, 7 rover parts, every move | Science data packets |
| 3 | **Comms**: send the science home | Packet order, compression, parity check; encode bits, decode Earth's reply | Final campaign score |

Every mission has the same six-stage loop (briefing → design → test → deploy → debrief), a guide called **CAPCOM Whiskers**, random events, and a debrief that explains *why* it worked or failed.

**Play:** https://itsermando.github.io/moonbase-mission-control/

## Features
- **Explained for newcomers:** hover, focus or tap any dotted word or **i** badge for a one-line explanation; common space words (periapsis, Δv, swath, parity …) get one automatically on every page (`shared/explain.js`). Mission 1 has a guided CAPCOM tutorial that points at each control and waits for you to try it (`missions/orbit/tutorial-steps.js`, `shared/tutorial.js`).
- **Consequences you can see:** in the assembly bay the 3D satellite rebuilds with every part, and consequence chains show how each part changes mass → fuel → rocket, power and money. In orbit design a simulated camera view gets blockier as the orbit rises. Debriefs show a WHAT / HOW / WHY tree and a choice → physics → result table with the formula behind each row.
- **A real satellite trade-off:** a relay wants its slow, high point over the base; a camera or neutron detector wants to pass low over it. Instruments are modelled on real ones (LRO LROC and LEND, MRO HiRISE and SHARAD, MESSENGER MDIS, Dawn FC), and the pixel size is computed from the height at which the orbit passes over the landing site (`missions/orbit/instruments.js`).
- **Campaign summary** (`summary.html`): after Mission 3, one page shows how each mission fed the next, a WHAT / HOW / WHY tree of the whole campaign, your decisions and the science behind them. Printable.
- **Operation Deep Link** (`missions/comms/connection.html`): Jeongha's Deep Space Network training game — encode an image, find the spacecraft's signal, and repair errors by majority voting — linked from Mission 3.
- **Worlds:** the Moon (main campaign, Shackleton crater from NASA LRO LOLA data), Mars (bonus campaign, Jezero crater from NASA Mars Trek), and Mercury, Ceres and Vesta as orbit challenges. Globes use NASA global maps, and the Moon and Mars can switch between imagery and laser-altimeter elevation (LRO LOLA, MGS MOLA).
- **Real NASA 3D models:** when you configure the spacecraft, the game shows NASA’s own models: an assembled satellite from the NASA Satellite Kit that changes with your antenna and solar-wing choice, the launcher class (Jupiter-C, Atlas, Saturn V), the real orbiter for each world (LRO, MRO, MESSENGER, Dawn), real rovers and landers (Perseverance, Opportunity, RASSOR, Apollo Lunar Module, Viking), and the Deep Space Network dishes and TDRS relay. See `shared/models.js` and `shared/models/`.
- **3D:** three.js globes for orbit design and a 3D rover view on the real terrain, with a 2D map fallback.
- **Runs on slower laptops:** a Graphics setting (press ? in the game): **Auto** starts sharp and drops to **Lite** by itself if the frame rate stays low, **High** uses full resolution, **Lite** uses 1x resolution, no shadows, no animated backgrounds and a 30 fps cap. 3D views also pause when offscreen or in a background tab, and planet icons use small thumbnails instead of the full 2048 px maps (`shared/perf.js`).
- **Ask CAPCOM:** a question box on every page (press /). Over 60 answers about orbits, rovers, signals and the game, matched by keywords from the game's built-in notes (`shared/capcom-kb.js`). It runs offline: no AI model, and the question never leaves the device.
- **Mission analyst (forecast, then choose):** before you decide, the game calculates the outcome of each option with its own physics and scoring and shows it as a decision tree. Orbit: three different designs that pass every go / no-go check, and the exact contact and score each solar-storm response would cost. Comms: three downlink plans with predicted science and noise risk. An optional, off-by-default AI can reword the forecast in plain language (`api/advise.js`, set `ADVISOR_API_KEY` and `ADVISOR_MODEL`, see `.env.example`; works with any OpenAI-compatible provider and defaults to the free Groq tier, no card needed); it never calculates anything and only receives mission numbers. Without it the game is unchanged.
  - **Hosting the AI advisor:** GitHub Pages is static, so `api/advise.js` only runs on a server host such as Vercel (set `ADVISOR_API_KEY` and `ADVISOR_MODEL=llama-3.1-8b-instant` in that project; a free Groq key is enough, and so is the free Vercel Hobby plan). To use it from a Pages site, deploy the repo to Vercel too, add `<meta name="advisor-url" content="https://YOUR-PROJECT.vercel.app/api/advise">` to the pages, and set `ALLOWED_ORIGINS` to the Pages origin. On plain Pages the toggle is harmless: the game falls back to its built-in explanations.
- **Data provenance:** the Briefing Room lists each NASA source with its entry in the NASA Open Data Portal (`shared/datasets.js`).
- **Profiles:** up to 4 crew members per game, with XP, ranks, medals, badges and a history of decisions. Stored only in the browser.
- **Class mode:** shorter missions so a whole campaign fits in a 45-minute lesson. The Briefing Room has a lesson plan, discussion questions, a printable worksheet and a CSV export of results.
- **Briefing Room** (`about.html`): answers for judges (audience, challenge fit, NASA data, accuracy, testing, privacy, accessibility) and teachers.

## Run it
No build step. Any static web server works (ES modules don't load from `file://`):

```bash
python -m http.server 5173
```

Plain static servers (`python -m http.server`, `npx serve`) serve every file in the folder, so never keep a real API key in `.env.local` inside it while one is running; use `vercel dev`, or keep the key outside the served folder.

Open http://localhost:5173 for the landing page, or http://localhost:5173/hub.html to go straight to Mission Control. Tests: `npm test` (Node 20+): over 70 tests covering orbit physics against real missions, contact outages, terrain rules, design limits, Mars rules, the parity code, the hand-offs between missions, the NASA model files, the CAPCOM question matcher, the graphics governor and the AI advisor endpoint (with a fake provider). They also run on every push through GitHub Actions (`.github/workflows/test.yml`).

## Project layout
| Path | What it is |
|---|---|
| `index.html`, `shared/landing.*` | Landing page: what the game is, the three missions, worlds, teachers, team |
| `hub.html`, `shared/hub.js` | Mission control hub: globe, campaign track, worlds, crew, class mode |
| `profile.html`, `about.html` | Profiles; Briefing Room for judges and teachers |
| `shared/` | HUD shell, profiles, campaign hand-offs, worlds and constants, globe, NASA model viewer (`models.js`), graphics quality (`perf.js`), Ask CAPCOM (`ask.js`, `capcom-kb.js`), sounds, styles |
| `missions/orbit/` | Mission 1: two-body orbit physics (`orbit.js`), catalogue (`data.js`), instruments (`instruments.js`), screens (`ui.js`, `bay.js`, `report.js`), tutorial |
| `missions/rover/` | Mission 2: worlds and terrain, engine, events, CAPCOM, screens, 3D scene |
| `missions/comms/` | Mission 3: signal maths (`codec.js`) and screens (`comms.js`); Operation Deep Link training (`connection.*`, by Jeongha) |
| `scripts/` | Rebuild terrain and planet textures from NASA Trek tiles |
| `tests/` | Automated tests |

## NASA data
- **Moon:** LRO LOLA 87.5°S slope and elevation products (5 m/px) and Site04 Shackleton Rim hillshade; LRO WAC global mosaic. NASA Moon Trek.
- **Mars:** MGS MOLA + Mars Express HRSC colour hillshade (heights read from colour, approximate) and MRO CTX Jezero mosaic; Viking MDIM 2.1 global mosaic. NASA Mars Trek.
- **Mercury, Ceres and Vesta:** MESSENGER MDIS and Dawn FC global maps. NASA Solar System Treks.
- **3D models:** NASA 3D Resources, github.com/nasa/NASA-3D-Resources (NASA states they are free and without copyright). Credit: NASA.
- **Constants:** planet GM, radius and day length from NASA/JPL; real-mission orbits (LRO, Gateway NRHO, MRO, MAVEN, MESSENGER, Dawn) used as presets.
- **Reference figures:** VIPER, RASSOR, TRIDENT, MMRTG, LCROSS (about 5.6% water), Perseverance, Deep Space Network.
- **Challenge resources:** NASA *Design and Develop Science Missions*, JPL *Concept Maturity Levels*, NASA GSFC *Mission Design Lab*, NASA GMAT.

Sunlight, ice amounts, Earth visibility, Mars heights, noise and costs are simplified game models and are labelled as such in the game.

## Music and sound
The soundtrack is inspired by the Voyager Golden Record, but the record's music is still under copyright, so the game plays an original ambient score generated live with Web Audio (`shared/music.js`). Short NASA public-domain recordings from the nasa.gov audio collection play at key moments: "The Eagle has landed" and "One small step" (Apollo 11) and the Sputnik 1 beeps (`shared/audio/`). The Golden Record picture is NASA/JPL-Caltech PIA14113.

## Team and credits
Team Cat on Moon: **Jeongha, David and Emad**. The idea came from a brainstorm by the three of us; Mission 3's signal-encoding game is based on Jeongha's design, and Operation Deep Link is Jeongha's.
Software: three.js r170 (MIT) via jsDelivr. Cat illustrations and sound effects are original (drawn as SVG and generated with Web Audio).

## Use of AI
Some code was written with the help of an AI coding assistant, as allowed by the Space Apps rules. At play time the optional AI advisor only rewords forecasts the game computed. The idea, missions and design decisions are the team's.
