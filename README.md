# Moonbase Mission Control

**Every choice has a cost. Our game shows you why.**

NASA Space Apps Challenge 2026 · Challenge: *Space Mission Design Game* · Team **Cat on Moon** (Jeongha, David, Emad), Budapest

A decision-based teaching game. Players design and fly a complete space mission in three linked parts, on real NASA maps, and learn from every result:

| # | Mission | You decide | Hands on to the next mission |
|---|---|---|---|
| 1 | **Orbit**: place the relay satellite | Rocket, antenna, solar power, orbit shape; a timed capture burn | Relay contact windows |
| 2 | **Rover**: land and dig (Moon) or core samples (Mars) | Landing site, 7 rover parts, every move | Science data packets |
| 3 | **Comms**: send the science home | Packet order, compression, parity check; encode bits, decode Earth's reply | Final campaign score |

Every mission has the same six-stage loop (briefing → design → test → deploy → debrief), a guide called **CAPCOM Whiskers**, random events, and a debrief that explains *why* it worked or failed.

**Play:** https://itsermando.github.io/moonbase-mission-control/

## Features
- **Worlds:** the Moon (main campaign, Shackleton crater from NASA LRO LOLA data), Mars (bonus campaign, Jezero crater from NASA Mars Trek), and Mercury and Ceres as orbit challenges. Globes use NASA global mosaics.
- **3D:** three.js globes for orbit design and a 3D rover view on the real terrain, with a 2D map fallback.
- **Mission analyst (forecast, then choose):** before you decide, the game calculates the outcome of each option with its own physics and scoring and shows it as a decision tree. Orbit: three different designs that pass every go / no-go check, and the exact contact and score each solar-storm response would cost. Comms: three downlink plans with predicted science and noise risk. An optional, off-by-default AI can reword the forecast in plain language (`api/advise.js`, set `AI_GATEWAY_API_KEY` and `ADVISOR_MODEL`, see `.env.example`); it never calculates anything and only receives mission numbers. Without it the game is unchanged.
  - **Hosting the AI advisor:** GitHub Pages is static, so `api/advise.js` only runs on a server host such as Vercel (set `AI_GATEWAY_API_KEY` and `ADVISOR_MODEL=llama-3.1-8b-instant` in that project). To use it from a Pages site, deploy the repo to Vercel too, add `<meta name="advisor-url" content="https://YOUR-PROJECT.vercel.app/api/advise">` to the pages, and set `ALLOWED_ORIGINS` to the Pages origin. On plain Pages the toggle is harmless: the game falls back to its built-in explanations.
- **Data provenance:** the Briefing Room lists each NASA source with its entry in the NASA Open Data Portal (`shared/datasets.js`).
- **Profiles:** up to 4 crew members per game, with XP, ranks, medals, badges and a history of decisions. Stored only in the browser.
- **Class mode:** shorter missions so a whole campaign fits in a 45-minute lesson. The Briefing Room has a lesson plan, discussion questions, a printable worksheet and a CSV export of results.
- **Briefing Room** (`about.html`): answers for judges (audience, challenge fit, NASA data, accuracy, testing, privacy, accessibility) and teachers.

## Run it
No build step. Any static web server works (ES modules don't load from `file://`):

```bash
python -m http.server 5173
```

Open http://localhost:5173 for the landing page, or http://localhost:5173/hub.html to go straight to Mission Control. Tests: `npm test` (Node 20+): over 30 tests covering orbit physics against real missions, contact outages, terrain rules, design limits, Mars rules, the parity code and the hand-offs between missions. They also run on every push through GitHub Actions (`.github/workflows/test.yml`).

## Project layout
| Path | What it is |
|---|---|
| `index.html`, `shared/landing.*` | Landing page: what the game is, the three missions, worlds, teachers, team |
| `hub.html`, `shared/hub.js` | Mission control hub: globe, campaign track, worlds, crew, class mode |
| `profile.html`, `about.html` | Profiles; Briefing Room for judges and teachers |
| `shared/` | HUD shell, profiles, campaign hand-offs, worlds and constants, globe, sounds, styles |
| `missions/orbit/` | Mission 1: two-body orbit physics (`orbit.js`), catalogue (`data.js`), screens (`ui.js`) |
| `missions/rover/` | Mission 2: worlds and terrain, engine, events, CAPCOM, screens, 3D scene |
| `missions/comms/` | Mission 3: signal maths (`codec.js`) and screens (`comms.js`) |
| `scripts/` | Rebuild terrain and planet textures from NASA Trek tiles |
| `tests/` | Automated tests |

## NASA data
- **Moon:** LRO LOLA 87.5°S slope and elevation products (5 m/px) and Site04 Shackleton Rim hillshade; LRO WAC global mosaic. NASA Moon Trek.
- **Mars:** MGS MOLA + Mars Express HRSC colour hillshade (heights read from colour, approximate) and MRO CTX Jezero mosaic; Viking MDIM 2.1 global mosaic. NASA Mars Trek.
- **Mercury and Ceres:** MESSENGER MDIS and Dawn FC global mosaics. NASA Solar System Treks.
- **Constants:** planet GM, radius and day length from NASA/JPL; real-mission orbits (LRO, Gateway NRHO, MRO, MAVEN, MESSENGER, Dawn) used as presets.
- **Reference figures:** VIPER, RASSOR, TRIDENT, MMRTG, LCROSS (about 5.6% water), Perseverance, Deep Space Network.
- **Challenge resources:** NASA *Design and Develop Science Missions*, JPL *Concept Maturity Levels*, NASA GSFC *Mission Design Lab*, NASA GMAT.

Sunlight, ice amounts, Earth visibility, Mars heights, noise and costs are simplified game models and are labelled as such in the game.

## Music and sound
The soundtrack is inspired by the Voyager Golden Record, but the record's music is still under copyright, so the game plays an original ambient score generated live with Web Audio (`shared/music.js`). Short NASA public-domain recordings from the nasa.gov audio collection play at key moments: "The Eagle has landed" and "One small step" (Apollo 11) and the Sputnik 1 beeps (`shared/audio/`). The Golden Record picture is NASA/JPL-Caltech PIA14113.

## Team and credits
Team Cat on Moon: **Jeongha, David and Emad**. The idea came from a brainstorm by the three of us; Mission 3's signal-encoding game is based on Jeongha's design.
Software: three.js r170 (MIT) via jsDelivr. Cat illustrations and sound effects are original (drawn as SVG and generated with Web Audio).

## Use of AI
Some code was written with the help of an AI coding assistant, as allowed by the Space Apps rules. At play time the optional AI advisor only rewords forecasts the game computed. The idea, missions and design decisions are the team's.
