// Connects Mission 1 (signal encoding, by Jeongha) to the shared hub:
// saves the score and shows a short debrief. The game logic stays in connection.js.
import { saveResult } from '../../shared/results.js';
import { sfx } from '../../shared/fx.js';

const CAMERA = { temperature: 'Temperature sensor', 'standard-camera': 'Standard camera', 'hd-camera': 'HD camera' };
// Science value of each instrument (score bonus when its data gets through).
const SCIENCE = { temperature: 10, 'standard-camera': 20, 'hd-camera': 30 };

const box = document.getElementById('result');

function show({ score, grade, lines }) {
  box.innerHTML = `<section class="panel stack" style="margin-top:20px">
    <span class="tag ${grade === 'Mission success' ? 'good' : 'bad'}">${grade}</span>
    <div class="row" style="align-items:baseline"><div class="score">${score}</div><div class="muted">/ 100 points</div></div>
    <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    <div class="row"><a href="../rover/index.html"><button class="primary">Next: Mission 2, the rover</button></a>
    <a href="../../index.html"><button>Back to mission control</button></a></div></section>`;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.addEventListener('encodingComplete', (e) => {
  const { camera, timeRemaining, mistakes } = e.detail;
  const score = Math.min(100, 40 + SCIENCE[camera] + Math.min(20, timeRemaining) + (5 - mistakes) * 2);
  const grade = 'Mission success';
  saveResult('comms', { score, grade, summary: `${CAMERA[camera]}: all packets sent, ${mistakes} error${mistakes === 1 ? '' : 's'}` });
  sfx.good();
  show({ score, grade, lines: [
    `All 5 data packets reached Earth with the ${CAMERA[camera].toLowerCase()}.`,
    `${timeRemaining} s of the downlink window left, ${mistakes} wrong bit${mistakes === 1 ? '' : 's'}.`,
    'Real missions add error-correcting codes, so a few flipped bits can be repaired on the ground instead of resent.',
  ] });
});

window.addEventListener('encodingFailed', (e) => {
  const { camera, packetsCompleted, reason } = e.detail;
  const score = packetsCompleted * 8;
  const grade = 'Mission failed';
  saveResult('comms', { score, grade, summary: `${CAMERA[camera]}: ${packetsCompleted} of 5 packets sent` });
  sfx.bad();
  show({ score, grade, lines: [
    `${reason} ${packetsCompleted} of 5 packets reached Earth.`,
    'Each wrong bit costs 3 seconds of the window, and 5 errors end the transmission. Accuracy beats speed.',
  ] });
});
