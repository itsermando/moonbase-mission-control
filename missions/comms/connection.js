'use strict';

const $ = id => document.getElementById(id);

const stageNames = ['Briefing', 'Equipment', 'Encode', 'Transmit', 'DSN Station', 'Detect', 'Reconstruct', 'Debrief'];

const state = {
  step: 0, camera: 'standard', energy: 80, image: null, imageTitle: '',
  imageBits: [], packets: [], packetIndex: 0, bitIndex: 0, mistakes: 0,
  sync: [], syncIndex: 0, syncHits: 0, syncTimer: null, syncStarted: false,
  station: null, candidates: [], correctCandidate: 0, detectionTimer: null,
  detectionTime: 25, repairs: [], repairIndex: 0, repaired: [],
  revealCount: 0, fallback: false,
  missionScore: 100, missionErrors: [],
  reconstructionIntroShown: false, imageSourceUrl: '', imageError: ''
};

const cameraOptions = [
  {
    id: 'temperature', name: 'Temperature Sensor', power: 5, packets: 3, desc: 'Low data · 5 W'
  },
  {
    id: 'standard', name: 'Standard Camera', power: 10, packets: 4, desc: 'Medium data · 10 W'
  },
  {
    id: 'hd', name: 'HD Camera', power: 20, packets: 5, desc: 'High detail · 20 W'
  }
];

const notes = [
  'NASA uses the Deep Space Network (DSN) to communicate with distant robotic spacecraft.',
  'Real spacecraft hardware is chosen before launch. Here, equipment choice is a simplified planning challenge.',
  'A real digital image is encoded, compressed and protected with error-correcting codes. This exercise uses sampled image bits.',
  'A synchronization sequence helps a receiver locate data boundaries. The Space-key rhythm is a classroom analogy, not NASA modulation.',
  'Goldstone (USA), Madrid (Spain), and Canberra (Australia) provide global DSN coverage as Earth rotates.',
  'DSN antennas receive extremely weak radio signals. Audio here represents an electronically generated signal, not sound traveling in space.',
  'Real missions use advanced error-correcting codes. Majority voting over three copies is a simple teaching model.',
  'The mission score summarizes gameplay performance, not an actual NASA mission evaluation.'
];

const messages = [
  'Mission control to spacecraft: bring a scientific image home through the Deep Space Network.',
  'Select an instrument. You have 80 W of game energy; the radio hardware reserves 40 W.',
  'Each binary digit comes from a simplified black-and-white sampling of the image. Enter the highlighted bits.',
  'Press SPACE when the blue pulse enters the target zone. Build the known synchronization sequence.',
  'Earth rotates, so different DSN stations can see a spacecraft at different times. Choose the highlighted station.',
  'Listen to the three radio-inspired patterns. Identify the one sent by your spacecraft.',
  'Compare three received copies of each damaged bit. Choose the majority bit to restore the image.',
  'Mission debrief: review your score, performance grade, and mistakes made during the mission.'
];

let audioContext = null;

function randomInt(n) {
  return Math.floor(Math.random() * n)
}

function randomBits(n) {
  return Array.from({
    length: n
  }, () => randomInt(2))
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

function setStatus(msg, type = '') {
  const el = $('game-status');
  if (el) {
    el.textContent = msg;
    el.className = 'status ' + type
  }
}

function btn(text, action, cls = '') {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.textContent = text;
  b.addEventListener('click', action);
  return b
}

function makeButtonHTML(label, onclick, primary = false) {
  const b = btn(label, onclick, primary ? 'primary' : '');
  return b
}

function actions(...buttons) {
  const row = document.createElement('div');
  row.className = 'actions';
  buttons.forEach(b => row.append(b));
  return row
}

function clearTimers() {
  if (state.syncTimer) {
    clearInterval(state.syncTimer);
    state.syncTimer = null
  }
  if (state.detectionTimer) {
    clearInterval(state.detectionTimer);
    state.detectionTimer = null
  }
}

function setStep(step) {
  clearTimers();
  state.step = step;
  render();

  if (step === 6 && !state.reconstructionIntroShown) {
    state.reconstructionIntroShown = true;
    showReconstructionIntro();
  }
}

function recordMissionError(stage, description, penalty = 5) {
  state.missionScore = Math.max(0, state.missionScore - penalty);
  state.missionErrors.push({ stage, description, penalty });
}

function getMissionResult() {
  const score = state.missionScore;

  if (score <= 50) return { label: 'MISSION FAILED', level: 'failed', success: false };
  if (score <= 70) return { label: 'PASS & SUCCESS', level: 'pass', success: true };
  if (score <= 80) return { label: 'GOOD & SUCCESS', level: 'good', success: true };

  return { label: 'EXCELLENT & SUCCESS', level: 'excellent', success: true };
}

function resetMission() {
  clearTimers();
  state.station = null;
  state.syncStarted = false;
  state.energy = 80;
  state.revealCount = 0;
  state.mistakes = 0;
  state.repairIndex = 0;
  state.repaired = [];
  state.missionScore = 100;
  state.missionErrors = [];
  state.reconstructionIntroShown = false;
  buildPackets();
}

function showReconstructionIntro() {
  if (document.getElementById('reconstruction-intro')) return;

  const overlay = document.createElement('div');
  overlay.id = 'reconstruction-intro';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    background: 'rgba(3, 9, 22, 0.84)',
    display: 'grid',
    placeItems: 'center',
    padding: '20px'
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    maxWidth: '540px',
    width: '100%',
    background: '#101c33',
    border: '1px solid #4774ac',
    borderRadius: '18px',
    padding: '32px',
    color: '#e2eaf8',
    boxShadow: '0 18px 70px rgba(0, 0, 0, 0.5)'
  });

  panel.innerHTML = `
    <div class="eyebrow">STEP 6 · EARTH RECEIVER</div>
    <h2>How to Restore the Image</h2>
    <p>Three copies of the same bit have arrived on Earth.</p>
    <p>Choose the value that appears at least twice.</p>
    <p style="font-size: 24px; text-align: center; letter-spacing: 8px;">
      1 · 0 · 1 → <strong>1</strong>
    </p>
    <p>Each correct answer reveals one image tile. Wrong answers reduce your mission score.</p>
  `;

  const start = makeButtonHTML('Start reconstruction →', () => overlay.remove(), true);
  panel.append(start);
  overlay.append(panel);
  document.body.append(overlay);
  start.focus();
}


function updateHUD() {
  const progress = Math.min(100, Math.round(state.step / 6 * 100));
  $('progress-text').textContent = progress + '%';
  $('progress-bar').style.width = progress + '%';
  $('phase-chip').textContent = state.step <= 3 ? 'SPACECRAFT' : 'EARTH · DSN';
  $('energy-chip').textContent = 'ENERGY ' + state.energy + ' W';
  $('link-chip').textContent = state.step >= 5 ? 'SIGNAL RECEIVED ●' : 'EARTH LINK ●';
  $('status-line').textContent = stageNames[state.step] + ' · Operation Deep Link'
}


function render() {
  updateHUD();

  $('step-nav').replaceChildren(
    ...stageNames.map((name, i) => {
      const s = document.createElement('span');

      s.textContent = `${i} ${name}`;

      s.className =
        i === state.step
          ? 'active'
          : i < state.step
            ? 'done'
            : '';

      return s;
    })
  );

  $('capcom-message').textContent = messages[state.step];
  $('science-note').textContent = notes[state.step];

  const scene = $('scene');
  const controls = $('control-body');
  const stage = document.querySelector('.stage');

  stage.classList.toggle('reconstruction-stage', state.step === 6);
  stage.classList.toggle('debrief-stage', state.step === 7);

  scene.classList.remove("briefing-scene");

  scene.replaceChildren();
  controls.replaceChildren();

  $('control-title').textContent = stageNames[state.step];
  $('control-hint').textContent = state.step === 7 ? 'Mission report' : 'Mission ' + (state.step + 1) + ' / 7';

  ({
    0: briefing,
    1: equipment,
    2: encoding,
    3: transmission,
    4: station,
    5: detection,
    6: reconstruction,
    7: debrief
  })[state.step](scene, controls);
}


function sceneHTML(scene, html) {
  scene.innerHTML = '<div class="scene-content">' + html + '</div>';
  return scene.querySelector('.scene-content')
}


function briefing(scene, controls) {
  scene.classList.add("briefing-scene");

  sceneHTML(scene, `
        <div class="briefing-content">
            <div class="eyebrow">
                NASA DEEP SPACE NETWORK · EDUCATIONAL SIMULATION
            </div>

            <h1>Connection Between Earth & Space</h1>

            <p>
                Capture scientific data, encode it,
                synchronize the radio signal,
                and reconstruct the image on Earth.
            </p>

            <p class="small">
                7 short stages · Space-key timing · NASA public image API
            </p>
        </div>
    `);

  controls.append(
    actions(
      makeButtonHTML(
        "Start mission →",
        () => setStep(1),
        true
      ),

      makeButtonHTML(
        "Load another NASA image",
        async () => {
          await loadNASAImage();
          render();
        }
      )
    )
  );
}


function equipment(scene, controls) {
  const el = sceneHTML(scene, '<div class="eyebrow">STEP 1 · SPACECRAFT</div><h1>Choose Your Instrument</h1><p>Radio and antenna reserve 40 W. Your total energy limit is 80 W.</p><div class="choice-grid" id="choices"></div><div id="game-status" class="status">Choose one instrument to continue.</div>');
  const grid = el.querySelector('#choices');
  cameraOptions.forEach(item => {
    const b = document.createElement('button'); b.className = 'choice' + (state.camera === item.id ? ' selected' : ''); b.innerHTML = `📷<strong>${item.name}</strong><small>${item.desc}<br>${item.packets} packets</small>`; b.onclick = () => {
      state.camera = item.id; equipment(scene, controls);
    }; grid.append(b)
  });
  controls.replaceChildren(actions(makeButtonHTML('Confirm equipment →', () => {
    const c = cameraOptions.find(c => c.id === state.camera); state.energy = 80 - 40 - c.power; buildPackets(); setStep(2)
  }, true)))
}

function imageBitsFromCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, 16, 16);

  const pixels = ctx.getImageData(0, 0, 16, 16).data;
  const brightness = [];

  for (let i = 0; i < 256; i++) {
    const offset = i * 4;
    brightness.push(
      0.2126 * pixels[offset] +
      0.7152 * pixels[offset + 1] +
      0.0722 * pixels[offset + 2]
    );
  }

  const sorted = [...brightness].sort((a, b) => a - b);
  const median = (sorted[127] + sorted[128]) / 2;
  const bits = brightness.map(value => value < median ? 1 : 0);

  if (new Set(bits).size === 1) {
    return randomBits(256);
  }

  return bits;
}

function fallbackImage() {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 260;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 400, 260);
  g.addColorStop(0, '#a97747');
  g.addColorStop(.6, '#693d35');
  g.addColorStop(1, '#302c45');
  x.fillStyle = g;
  x.fillRect(0, 0, 400, 260);
  for (let i = 0; i < 150; i++) {
    x.fillStyle = `rgba(${80 + randomInt(90)},${50 + randomInt(70)},${30 + randomInt(50)},${Math.random() * .35})`;
    x.beginPath();
    x.ellipse(randomInt(400), randomInt(260), 10 + randomInt(70), 4 + randomInt(28), Math.random() * 2, 0, Math.PI * 2);
    x.fill()
  }
  return c
}

async function loadNASAImage() {
  state.image = null;
  state.imageSourceUrl = '';
  state.imageError = '';
  state.fallback = false;
  $('image-credit').textContent = 'Searching NASA Moon photographs…';

  try {
    const query = encodeURIComponent('lunar surface Moon');
    const response = await fetch(
      `https://images-api.nasa.gov/search?q=${query}&media_type=image&page_size=100`
    );

    if (!response.ok) {
      throw new Error(`NASA image search returned ${response.status}`);
    }

    const json = await response.json();
    const items = (json.collection?.items || []).filter(item => {
      const data = item.data?.[0] || {};
      const text = `${data.title || ''} ${data.description || ''}`.toLowerCase();
      return /moon|lunar|apollo/.test((data.title || '').toLowerCase())
        && !/diagram|logo|patch|spacecraft components|illustration|graphic|model/.test((data.title || '').toLowerCase())
        && item.links?.some(link =>
        link.render === 'image' || /\.(jpg|jpeg|png)(\?|$)/i.test(link.href || '')
      );
    });

    if (!items.length) throw new Error('NASA returned no usable lunar images');

    const candidates = shuffle(items).slice(0, 10);
    let lastError = null;

    for (const item of candidates) {
      const links = item.links || [];
      const url = links.find(link => link.render === 'image' && /\.(jpg|jpeg|png)(\?|$)/i.test(link.href || ''))?.href
        || links.find(link => /\.(jpg|jpeg|png)(\?|$)/i.test(link.href || ''))?.href;

      if (!url) continue;

      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image();
          const timeout = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            reject(new Error('Image loading timed out'));
          }, 4000);

          img.crossOrigin = 'anonymous';
          img.onload = () => {
            clearTimeout(timeout);
            if (img.naturalWidth < 64 || img.naturalHeight < 64) {
              reject(new Error('Image resolution too small'));
            } else {
              resolve(img);
            }
          };
          img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Image could not be loaded'));
          };
          img.src = url;
        });

        const bits = imageBitsFromCanvas(image);
        state.image = image;
        state.imageBits = bits;
        state.imageSourceUrl = url;
        state.imageTitle = item.data?.[0]?.title || 'NASA lunar photograph';
        $('image-credit').replaceChildren();
        const title = document.createElement('span');
        title.textContent = `${state.imageTitle} · NASA Image and Video Library `;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View original';
        $('image-credit').append(title, link);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('No NASA Moon image could be displayed');
  } catch (error) {
    state.fallback = true;
    state.imageError = error.message;
    state.image = fallbackImage();
    state.imageBits = imageBitsFromCanvas(state.image);
    state.imageTitle = 'Generated practice image';
    $('image-credit').textContent =
      `NASA photo unavailable — using a generated practice image (NOT a NASA photograph). ${error.message}`;
  }
}
function buildPackets() {
  const packetCount = cameraOptions.find(option => option.id === state.camera).packets;
  const source = state.imageBits.length ? state.imageBits : randomBits(256);

  state.packets = Array.from({ length: packetCount }, () => {
    let bits = Array.from({ length: 8 }, () => String(source[randomInt(source.length)]));

    if (new Set(bits).size === 1) {
      bits[randomInt(bits.length)] = bits[0] === '1' ? '0' : '1';
    }

    return bits.join('');
  });

  state.packetIndex = 0;
  state.bitIndex = 0;
  state.mistakes = 0;
}

function encoding(scene, controls) {
  const packet = state.packets[state.packetIndex];
  const el = sceneHTML(scene, `<div class="eyebrow">STEP 2 · BINARY DATA</div><h1>Encode Image Bits</h1><p>Packet ${state.packetIndex + 1} of ${state.packets.length}. Match each highlighted bit using O (0) or X (1).</p><div class="big-pattern" id="bits"></div><div id="game-status" class="status">Errors: ${state.mistakes} / 5</div>`);
  const bits = el.querySelector('#bits');
  [...packet].forEach((v, i) => {
    const d = document.createElement('div'); d.className = 'bit' + (i < state.bitIndex ? ' good' : i === state.bitIndex ? ' on' : ''); d.textContent = v; bits.append(d)
  });
  controls.append(actions(makeButtonHTML('O · 0', () => enterBit('0'), true), makeButtonHTML('X · 1', () => enterBit('1'), true), makeButtonHTML('New bit sets ↻', () => {
    buildPackets(); render()
  })))
}

function enterBit(bit) {
  if (state.step !== 2) return;
  const packet = state.packets[state.packetIndex];
  if (packet[state.bitIndex] !== bit) {
    state.mistakes++;
    recordMissionError('Encode', `Incorrect bit in packet ${state.packetIndex + 1}`, 5);
    if (state.mistakes >= 5) {
      buildPackets();
      render();
      setStatus('Too many errors. New randomized packets created.', 'error')
    } else {
      setStatus('Wrong bit. ' + state.mistakes + '/5 errors.', 'error')
    }
    return
  }
  state.bitIndex++;
  if (state.bitIndex >= packet.length) {
    state.packetIndex++;
    state.bitIndex = 0;
    if (state.packetIndex >= state.packets.length) {
      state.sync = randomBits(8);
      state.syncIndex = 0;
      state.syncHits = 0;
      setStep(3);
      return
    }
  }
  render()
}

function transmission(scene, controls) {
  const el = sceneHTML(scene, '<div class="eyebrow">STEP 3 · SPACECRAFT RADIO</div><h1>Synchronize & Transmit</h1><p>Hit <span class="kbd">SPACE</span> when the moving marker reaches the target. Each hit sends the next sync pulse.</p><div class="big-pattern" id="sync-bits"></div><div class="scanline" id="sync-line"><div id="marker" style="position:absolute;left:0;top:0;height:100%;width:5px;background:#a3e3ff"></div><div style="position:absolute;left:46%;width:8%;height:100%;border-left:2px solid #8af0c0;border-right:2px solid #8af0c0;background:#3dd9a01e"></div></div><div id="game-status" class="status">Press Start, then SPACE in the center target zone.</div>');
  const b = el.querySelector('#sync-bits');
  state.sync.forEach((v, i) => {
    const d = document.createElement('div'); d.className = 'bit' + (i < state.syncIndex ? ' good' : i === state.syncIndex ? ' on' : ''); d.textContent = v; b.append(d)
  });
  controls.append(actions(makeButtonHTML(state.syncStarted ? 'Restart timing' : 'Start timing', startSync, true), makeButtonHTML('SPACE · Pulse', hitSync)));
  if (state.syncStarted) startSyncLoop()
}

function startSync() {
  clearTimers();
  state.syncStarted = true;
  state.syncIndex = 0;
  state.syncHits = 0;
  state.syncStart = performance.now();
  render()
}

function startSyncLoop() {
  if (state.syncTimer) clearInterval(state.syncTimer);
  state.syncTimer = setInterval(() => {
    if (state.step !== 3) return; const marker = $('marker'); if (!marker) return; const p = ((performance.now() - state.syncStart) % 1800) / 1800; marker.style.left = (p * 100) + '%'
  }, 30)
}

function hitSync() {
  if (state.step !== 3 || !state.syncStarted) return;
  const p = ((performance.now() - state.syncStart) % 1800) / 1800;
  const ok = Math.abs(p - .5) < .15;
  if (!ok) {
    recordMissionError('Transmit', `Missed synchronization pulse ${state.syncIndex + 1}`, 5);
    setStatus('Timing missed! Wait for the blue marker to enter the center zone.', 'error');
    return
  }
  state.syncHits++;
  state.syncIndex++;
  beep(state.sync[state.syncIndex - 1] === 1 ? 650 : 430, .11);
  if (state.syncIndex >= state.sync.length) {
    state.syncStarted = false;
    clearTimers();
    setStep(4)
  } else {
    state.syncStart = performance.now();
    render();
    setStatus('Pulse transmitted! ' + state.syncIndex + '/' + state.sync.length, 'ok')
  }
}

function station(scene, controls) {
  const selected = ['Goldstone', 'Madrid', 'Canberra'];
  if (!state.station) state.correctStation = selected[randomInt(3)];
  const el = sceneHTML(scene, `<div class="eyebrow">STEP 4 · EARTH RECEIVER</div><h1>Choose a DSN Ground Station</h1><p>Mission scenario: ${state.correctStation} currently has line of sight to the spacecraft. Choose that station.</p><div class="choice-grid" id="stations"></div><div id="game-status" class="status">Earth rotates. Only one station has the correct view in this simplified scenario.</div>`);
  selected.forEach(name => {
    const b = document.createElement('button'); b.className = 'choice' + (state.station === name ? ' selected' : ''); b.innerHTML = `📡<strong>${name}</strong><small>${name === 'Goldstone' ? 'California, USA' : name === 'Madrid' ? 'Spain' : 'Australia'}</small>`; b.onclick = () => {
      state.station = name; station(scene, controls)
    }; el.querySelector('#stations').append(b)
  });
  controls.replaceChildren(actions(makeButtonHTML('Point antenna →', () => {
    if (!state.station) {
      setStatus('Select a station first.', 'error'); return
    }
    if (state.station !== state.correctStation) {
      recordMissionError('DSN Station', `Selected ${state.station} instead of ${state.correctStation}`, 5);
      setStatus('No line of sight in this scenario. Try another station.', 'error'); return
    }
    setupDetection(); setStep(5)
  }, true)))
}

function setupDetection() {
  state.correctCandidate = randomInt(3);
  state.candidates = Array.from({
    length: 3
  }, (_, i) => i === state.correctCandidate ? [...state.sync] : shuffle(state.sync.map((v, j) => j === randomInt(8) ? 1 - v : v)));
  for (let i = 0; i < 3; i++)if (i !== state.correctCandidate) {
    let candidate = randomBits(8);
    while (candidate.join('') === state.sync.join('')) candidate = randomBits(8);
    state.candidates[i] = candidate
  }
  state.detectionTime = 25
}

function beep(frequency, duration = .13) {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const o = audioContext.createOscillator(), g = audioContext.createGain();
    o.type = 'sine';
    o.frequency.value = frequency;
    g.gain.setValueAtTime(.0001, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(.08, audioContext.currentTime + .01);
    g.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + duration);
    o.connect(g);
    g.connect(audioContext.destination);
    o.start();
    o.stop(audioContext.currentTime + duration + .01)
  } catch (e) {
  }
}

function playPattern(pattern) {
  pattern.forEach((v, i) => setTimeout(() => beep(v ? 740 : 370, .12), i * 260))
}

function detection(scene, controls) {
  sceneHTML(scene, `<div class="eyebrow">STEP 5 · EARTH · SIGNAL SEARCH</div><h1>Detect the Spacecraft Signal</h1><p>Listen to the reference signal and three candidates. Find the matching pattern before time runs out.</p><div class="scanline"></div><div class="countdown" id="detection-clock">${state.detectionTime}s</div><div id="game-status" class="status">Reference: ${state.sync.join(' ')} · Listen and compare the sound patterns.</div>`);
  controls.append(actions(makeButtonHTML('▶ Reference', () => playPattern(state.sync), true), ...state.candidates.map((pattern, i) => makeButtonHTML('▶ Signal ' + (i + 1), () => playPattern(pattern))), ...state.candidates.map((_, i) => makeButtonHTML('Lock ' + (i + 1), () => lockSignal(i)))));
  state.detectionTimer = setInterval(() => {
    state.detectionTime--; const clock = $('detection-clock'); if (clock) clock.textContent = state.detectionTime + 's'; if (state.detectionTime <= 0) {
      recordMissionError('Detect', 'Signal detection timer expired', 10);
      clearTimers(); state.detectionTime = 25; render(); setStatus('Time expired. Signal search restarted.', 'error')
    }
  }, 1000)
}

function lockSignal(i) {
  if (state.step !== 5) return;
  if (i !== state.correctCandidate) {
    recordMissionError('Detect', `Locked incorrect signal ${i + 1}`, 5);
    state.detectionTime = Math.max(0, state.detectionTime - 3);
    setStatus('Incorrect signal. −3 seconds. Try again.', 'error');
    return
  }
  setupRepairs();
  setStep(6)
}

function setupRepairs() {
  state.repairs = Array.from({
    length: 8
  }, (_, i) => {
    const bit = state.imageBits[(i * 29 + 11) % state.imageBits.length] || 0; const triple = shuffle([bit, bit, 1 - bit]); return {
      bit, triple
    }
  });
  state.repairIndex = 0;
  state.repaired = [];
  state.revealCount = 0
}

function drawReconstruction() {
  const canvas = $('reconstruction-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const source = state.image || fallbackImage();
  canvas.width = 480;
  canvas.height = 320;
  ctx.fillStyle = '#172238';
  ctx.fillRect(0, 0, 480, 320);
  const cols = 4, rows = 2;
  for (let i = 0; i < state.revealCount; i++) {
    const x = (i % cols) * 120, y = Math.floor(i / cols) * 160;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, 120, 160);
    ctx.clip();
    const scale = state.revealCount === 8 ? 1 : Math.max(1, Math.ceil(18 - state.revealCount * 2));
    const temp = document.createElement('canvas');
    temp.width = Math.max(1, Math.round(480 / scale));
    temp.height = Math.max(1, Math.round(320 / scale));
    temp.getContext('2d').drawImage(source, 0, 0, temp.width, temp.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(temp, 0, 0, 480, 320);
    ctx.restore()
  }
  ctx.strokeStyle = '#7aa8d566';
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 120, 0);
    ctx.lineTo(i * 120, 320);
    ctx.stroke()
  }
  ctx.beginPath();
  ctx.moveTo(0, 160);
  ctx.lineTo(480, 160);
  ctx.stroke()
}

function reconstruction(scene, controls) {
  const complete = state.repairIndex >= state.repairs.length;
  const el = sceneHTML(scene, `<div class="eyebrow">STEP 6 · EARTH · IMAGE RECONSTRUCTION</div><h1>${complete ? 'Image Recovered!' : 'Repair the Missing Image Bits'}</h1><p>${complete ? 'Mission complete — your image has arrived on Earth.' : 'Three copies of a bit were received. Choose the value appearing at least twice.'}</p><div class="image-wrap"><canvas id="reconstruction-canvas" width="480" height="320"></canvas></div><div id="repair-info" class="status ${complete ? 'ok' : ''}">${complete ? 'All 8 image tiles restored.' : `Tile ${state.repairIndex + 1
    }
    /8 · Received copies: ${state.repairs[state.repairIndex].triple.join('  |  ')
    }
    `}</div>`);
  drawReconstruction();
  if (complete) {
    controls.append(actions(
      makeButtonHTML('View mission report →', () => setStep(7), true)
    ));
    setTimeout(() => {
      if (state.step === 6 && state.repairIndex === state.repairs.length) {
        setStep(7);
      }
    }, 900);
    return;
  }
  controls.append(actions(makeButtonHTML('Repair as 0', () => repair(0), true), makeButtonHTML('Repair as 1', () => repair(1), true)))
}

function debrief(scene, controls) {
  const result = getMissionResult();
  const score = state.missionScore;
  const errors = state.missionErrors;
  const groups = [
    { name: 'Image Encoding', stages: ['Encode'] },
    { name: 'Signal Transmission', stages: ['Transmit'] },
    { name: 'DSN Ground Station', stages: ['DSN Station'] },
    { name: 'Signal Detection', stages: ['Detect'] },
    { name: 'Image Reconstruction', stages: ['Reconstruct'] }
  ];

  const root = document.createElement('div');
  root.className = 'debrief-content';
  const heading = document.createElement('div');
  heading.className = 'debrief-header';

  const headingLeft = document.createElement('div');
  const pill = document.createElement('span');
  pill.className = `result-pill ${result.level}`;
  pill.textContent = result.success ? 'Mission successful' : 'Mission failed';

  const title = document.createElement('h1');
  title.textContent = 'Mission Debrief';
  const subtitle = document.createElement('p');
  subtitle.textContent = result.success
    ? 'Your lunar image reached Earth. Review your mission performance.'
    : 'The image was reconstructed, but the mission score was too low.';
  headingLeft.append(pill, title, subtitle);

  const stars = document.createElement('div');
  stars.className = 'result-stars';
  const count = score > 80 ? 3 : score > 70 ? 2 : score > 50 ? 1 : 0;
  stars.textContent = '★'.repeat(count) + '☆'.repeat(3 - count);
  stars.setAttribute('aria-label', `${count} of 3 stars`);
  heading.append(headingLeft, stars);
  root.append(heading);

  const scoreRow = document.createElement('div');
  scoreRow.className = 'debrief-score';
  const number = document.createElement('strong');
  number.textContent = String(score);
  const total = document.createElement('span');
  total.textContent = ' / 100 points';
  scoreRow.append(number, total);
  root.append(scoreRow);

  const grade = document.createElement('p');
  grade.className = `debrief-grade ${result.level}`;
  grade.textContent = result.label;
  root.append(grade);

  const track = document.createElement('div');
  track.className = 'debrief-progress';
  const fill = document.createElement('div');
  fill.style.width = `${score}%`;
  track.append(fill);
  root.append(track);

  const section = document.createElement('div');
  section.className = 'debrief-categories';

  groups.forEach(group => {
    const mistakes = errors.filter(error => group.stages.includes(error.stage));
    const lost = mistakes.reduce((sum, error) => sum + error.penalty, 0);
    const row = document.createElement('div');
    row.className = 'debrief-category';
    const chip = document.createElement('span');
    chip.className = `category-score ${lost ? 'has-errors' : 'perfect'}`;
    chip.textContent = lost ? `−${lost}` : '✓';
    const content = document.createElement('div');
    const label = document.createElement('strong');
    label.textContent = group.name;
    const description = document.createElement('p');
    description.textContent = mistakes.length
      ? `${mistakes.length} mistake(s) · ${lost} points deducted`
      : 'Completed without mistakes';
    content.append(label, description);
    row.append(chip, content);
    section.append(row);
  });
  root.append(section);

  const details = document.createElement('details');
  details.className = 'debrief-errors';
  const summary = document.createElement('summary');
  summary.textContent = `Activity report · ${errors.length} recorded mistake(s)`;
  details.append(summary);
  if (errors.length) {
    const list = document.createElement('ol');
    errors.forEach(error => {
      const li = document.createElement('li');
      li.textContent = `${error.stage}: ${error.description} (−${error.penalty} points)`;
      list.append(li);
    });
    details.append(list);
  } else {
    const perfect = document.createElement('p');
    perfect.textContent = 'No mistakes recorded. Perfect mission!';
    details.append(perfect);
  }
  root.append(details);

  const imageSummary = document.createElement('div');
  imageSummary.className = 'debrief-image-summary';
  const imageLabel = document.createElement('strong');
  imageLabel.textContent = state.fallback ? 'Practice image (NASA unavailable)' : 'NASA Moon image recovered';
  const imageDescription = document.createElement('p');
  imageDescription.textContent = state.imageTitle;
  imageSummary.append(imageLabel, imageDescription);
  if (state.imageSourceUrl) {
    const source = document.createElement('a');
    source.href = state.imageSourceUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Open original NASA image ↗';
    imageSummary.append(source);
  }
  root.append(imageSummary);

  scene.replaceChildren(root);
  controls.append(actions(
    makeButtonHTML('Play again ↻', () => {
      resetMission();
      setStep(0);
    }, true),
    makeButtonHTML('Load another NASA Moon image', async () => {
      await loadNASAImage();
      resetMission();
      setStep(0);
    })
  ));
}

function repair(value) {
  if (state.step !== 6 || state.repairIndex >= state.repairs.length) return;
  const r = state.repairs[state.repairIndex];
  if (value !== r.bit) {
    recordMissionError('Reconstruct', `Wrong repair for tile ${state.repairIndex + 1}: chose ${value}, expected ${r.bit}`, 5);
    setStatus('Not quite. Count the three copies: ' + r.triple.join(', ') + '.', 'error');
    return
  }
  state.repaired.push(value);
  state.repairIndex++;
  state.revealCount = state.repairIndex;
  render()
}

document.addEventListener('keydown', e => {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return; if (e.code === 'Space' && state.step === 3) {
    e.preventDefault(); hitSync()
  }
  if (state.step === 2) {
    if (e.key.toLowerCase() === 'o' || e.key === '0') enterBit('0'); if (e.key.toLowerCase() === 'x' || e.key === '1') enterBit('1')
  }
  if (state.step === 6) {
    if (e.key === '0') repair(0); if (e.key === '1') repair(1)
  }
});

(async () => {
  await loadNASAImage(); render()
})();