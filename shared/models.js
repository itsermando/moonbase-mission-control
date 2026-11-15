// Real NASA 3D models (NASA 3D Resources, github.com/nasa/NASA-3D-Resources: "free and without copyright") in small, lazy viewers.
// Models load only when a screen shows them, are cached, and the game works without them (3D or network missing = a text caption).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { pixelRatio, useAntialias, onChange, Governor } from './perf.js';

if (!document.querySelector('link[data-models-css]')) {
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./models.css', import.meta.url).href; l.dataset.modelsCss = ''; document.head.appendChild(l);
}

export const CREDIT = '3D model: NASA 3D Resources (nasa/NASA-3D-Resources, public domain).';

export const MODELS = {
  'jupiter-c': { label: 'Jupiter-C', name: 'Jupiter-C', kind: 'Small launcher', fact: 'This rocket launched Explorer 1, the first US satellite, on 31 January 1958. Small rockets are cheap, but lift very little.' },
  atlas: { label: 'Atlas', name: 'Atlas (Mercury-Atlas 9)', kind: 'Medium launcher', fact: 'Atlas rockets carried the Mercury astronauts, such as Gordon Cooper in Faith 7 (1963), and then decades of probes. The workhorse class.' },
  'saturn-v': { label: 'Saturn V', name: 'Saturn V', kind: 'Heavy launcher', fact: '110.6 m tall. It flew 13 times between 1967 and 1973 and sent every Apollo crew to the Moon. Heavy lift costs a lot, which is why the game makes you pay for it.' },
  lro: { label: 'LRO', name: 'Lunar Reconnaissance Orbiter', kind: 'Real Moon orbiter', fact: 'Launched in 2009 and still mapping the Moon. Its laser altimeter (LOLA) made the elevation data behind this game’s Shackleton map.' },
  mro: { label: 'MRO', name: 'Mars Reconnaissance Orbiter', kind: 'Real Mars orbiter', fact: 'Orbiting Mars since 2006 in a low polar orbit like the game’s MRO preset. It also relays data from rovers on the ground.' },
  messenger: { label: 'MESSENGER', name: 'MESSENGER', kind: 'Real Mercury orbiter', fact: 'The first spacecraft to orbit Mercury (2011 to 2015). Its elliptical orbit kept it away from the Sun’s heat most of the time.' },
  dawn: { label: 'Dawn', name: 'Dawn', kind: 'Real asteroid orbiter', fact: 'The first spacecraft to orbit two worlds beyond the Earth and Moon: the giant asteroid Vesta (2011 to 2012), then the dwarf planet Ceres (from 2015), moving between them on ion engines.' },
  tdrs: { label: 'TDRS', name: 'TDRS relay satellite', kind: 'Real relay satellite', fact: 'NASA’s Tracking and Data Relay Satellites sit in high orbits and pass data between low-flying spacecraft, like the Space Station, and the ground. Your relay does the same job.' },
  perseverance: { label: 'Perseverance', name: 'Perseverance rover', kind: 'Real Mars rover', fact: 'Landed in Jezero crater on 18 February 2021. It weighs about 1,025 kg and seals rock cores into sample tubes, the job you give your rover on Mars.' },
  opportunity: { label: 'Opportunity', name: 'Opportunity (MER-B)', kind: 'Real Mars rover', fact: 'Landed in 2004 for a 90-day mission and kept driving until 2018, about 45 km in all. Good design lasts.' },
  rassor: { label: 'RASSOR', name: 'RASSOR excavator', kind: 'Real Moon digger', fact: 'NASA’s Regolith Advanced Surface Systems Operations Robot. Its two bucket drums spin in opposite directions so the robot can dig in low gravity without pushing itself away.' },
  'apollo-lm': { label: 'Apollo LM', name: 'Apollo Lunar Module', kind: 'Real lander', fact: 'The Eagle landed Apollo 11 on 20 July 1969. A lander has to carry everything your rover needs, so mass matters.' },
  'viking-lander': { label: 'Viking', name: 'Viking Lander', kind: 'Real Mars lander', fact: 'Viking 1 landed on Mars on 20 July 1976 and worked for years. It tested the soil for signs of life.' },
  'dsn-70m': { label: '70 m dish', name: 'Deep Space Network 70 m dish', kind: 'Real ground antenna', fact: 'The biggest dishes of NASA’s Deep Space Network, at Goldstone (California), Madrid (Spain) and Canberra (Australia). One site always faces your spacecraft.' },
  'dsn-34m': { label: '34 m dish', name: 'Deep Space Network 34 m dish', kind: 'Real ground antenna', fact: 'The workhorse dish of the Deep Space Network. Each site has several, so many missions can talk at once.' },
};

const urlOf = (file) => new URL(`./models/${file}.glb`, import.meta.url).href;
const loader = new GLTFLoader();
// Many NASA files are Draco-compressed; the decoder comes from the same CDN version as three.js.
loader.setDRACOLoader(new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/'));
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
export function loadModel(file) {
  if (!cache.has(file)) cache.set(file, loader.loadAsync(urlOf(file)).then((g) => g.scene).catch((e) => { cache.delete(file); throw e; }));
  return cache.get(file);
}

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ModelViewer {
  constructor(el, { autoRotate = 1.1 } = {}) {
    this.el = el; this.token = 0; this.visible = true; this.alive = true;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: useAntialias(), alpha: true });
    r.setPixelRatio(pixelRatio());
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    el.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(4, 5, 3); this.scene.add(sun, new THREE.HemisphereLight(0x9fc4ff, 0x1a2238, 0.6));
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enablePan: false, enableDamping: true, autoRotate: !reduce() && autoRotate > 0, autoRotateSpeed: autoRotate });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.io = new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; }); this.io.observe(el);
    const gov = new Governor();
    this.offQ = onChange(() => { r.setPixelRatio(pixelRatio()); this.resize(); });
    const loop = (ts) => {
      if (!this.alive) return;
      this.raf = requestAnimationFrame(loop);
      if (!this.visible || !gov.render(ts)) return;
      this.controls.update(); r.render(this.scene, this.camera);
    };
    loop(); this.resize();
  }

  resize() {
    const w = this.el.clientWidth || 300, h = this.el.clientHeight || 220;
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.fit();
  }

  fit() {
    if (!this.size) return;
    const { x, y, z } = this.size, t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const horiz = Math.max(x, z), dist = (Math.max(y / 2 / t, horiz / 2 / (t * this.camera.aspect)) + horiz / 2) * 1.12;
    const dir = new THREE.Vector3(0.55, 0.35, 1).normalize();
    this.camera.position.copy(dir.multiplyScalar(dist)); this.camera.near = dist / 100; this.camera.far = dist * 20; this.camera.updateProjectionMatrix();
    this.controls.minDistance = dist * 0.4; this.controls.maxDistance = dist * 2.5; this.controls.target.set(0, 0, 0); this.controls.update();
  }

  /** files: one model file name or several that share an origin (the Satellite Kit parts). Resolves true when shown. */
  async show(files) {
    const my = ++this.token;
    const parts = await Promise.all([].concat(files).map(loadModel));
    if (!this.alive || my !== this.token) return false;
    if (this.model) this.scene.remove(this.model);
    const group = new THREE.Group(); parts.forEach((p) => group.add(p.clone(true)));
    const box = new THREE.Box3().setFromObject(group), c = box.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group(); group.position.sub(c); pivot.add(group);
    const s = 3 / Math.max(...box.getSize(new THREE.Vector3()).toArray()); pivot.scale.setScalar(s);
    this.scene.add(pivot); this.model = pivot;
    this.size = box.getSize(new THREE.Vector3()).multiplyScalar(s); this.fit();
    return true;
  }

  dispose() {
    this.alive = false; this.offQ?.(); cancelAnimationFrame(this.raf); this.ro.disconnect(); this.io.disconnect(); this.controls.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** An item is a known model id, or { key, label, files, name, kind, fact } for an assembly. */
const toItem = (it) => (typeof it === 'string' ? { key: it, files: it, ...MODELS[it] } : { ...it, files: it.files || it.key });

/**
 * Put a titled 3D viewer with optional tabs and a caption into `el`. Returns { select(key), update(key, patch), dispose() }.
 * Never throws: with no WebGL or no network it shows the caption only.
 */
export function mountViewer(el, entries, { height = 230, title = '', autoRotate } = {}) {
  const items = entries.map(toItem);
  el.classList.add('mv');
  el.innerHTML = `${title ? `<h3>${esc(title)}</h3>` : ''}<div class="mv-stage" style="height:${height}px"><span class="mv-load small muted">Loading NASA model…</span></div>
    ${items.length > 1 ? `<div class="mv-tabs" role="tablist">${items.map((i) => `<button type="button" role="tab" data-mv="${esc(i.key)}">${esc(i.label)}</button>`).join('')}</div>` : ''}
    <div class="mv-cap"></div><p class="mv-credit">${CREDIT}</p>`;
  const stage = el.querySelector('.mv-stage'), cap = el.querySelector('.mv-cap'), load = el.querySelector('.mv-load');
  let viewer = null, cur = null, dead = false;
  try { viewer = new ModelViewer(stage, { autoRotate }); } catch { load.textContent = '3D view is not available on this device.'; }
  const show = () => {
    const i = items.find((x) => x.key === cur); if (!i) return;
    cap.innerHTML = `<b>${esc(i.name)}</b> <span class="tag">${esc(i.kind)}</span><p class="small muted">${esc(i.fact)}</p>`;
    el.querySelectorAll('[data-mv]').forEach((b) => { b.classList.toggle('on', b.dataset.mv === cur); b.setAttribute('aria-selected', String(b.dataset.mv === cur)); });
    if (!viewer) return;
    load.hidden = false; load.textContent = 'Loading NASA model…';
    viewer.show(i.files).then((ok) => { if (ok && !dead) load.hidden = true; }).catch((err) => { console.error('NASA model failed to show', i.files, err); if (!dead) { load.hidden = false; load.textContent = 'The 3D model could not be loaded (needs the network).'; } });
  };
  el.onclick = (e) => { const b = e.target.closest('[data-mv]'); if (b) { cur = b.dataset.mv; show(); } };
  cur = items[0].key; show();
  return {
    select(key) { if (key !== cur) { cur = key; show(); } },
    update(key, patch) { const i = items.find((x) => x.key === key); if (i) Object.assign(i, patch); cur = key; show(); },
    dispose() { dead = true; viewer?.dispose(); viewer = null; el.onclick = null; },
  };
}
