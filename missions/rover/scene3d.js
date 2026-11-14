// 3D view of the real Shackleton crater rim (NASA LRO LOLA elevation) with three.js.
// The 2D game map is draped over the terrain as a texture, so every overlay shows in 3D.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { terrainData, WORLD_ID } from './world.js';
import { buildRover, buildLander, animateRover } from './rover-model.js';

let T = terrainData(), N = T.n;
// Grey level 0-255 spans roughly the 4.2 km from crater floor to rim; one cell is 333 m.
// Moon: grey 0-255 spans ~4.2 km over 333 m squares. Mars: ~700 m over 739 m squares, shown 4x taller so you can see it.
let HEIGHT = 4200 / 333 / 255;
function configure() {
  T = terrainData(); N = T.n;
  HEIGHT = WORLD_ID === 'mars' ? ((T.meta.relief_m / T.meta.cell_m) / 255) * 4 : 4200 / 333 / 255;
}
const ROVER_SCALE = 0.55; // shown much bigger than real so you can see it

function elevAt(fx, fz) {
  // bilinear sample in cell units, (0,0) = centre of the top-left cell
  const x = Math.max(0, Math.min(N - 1.001, fx)), z = Math.max(0, Math.min(N - 1.001, fz));
  const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j;
  const e = (a, b) => T.elev[b * N + a];
  return (e(i, j) * (1 - u) * (1 - v) + e(i + 1, j) * u * (1 - v) + e(i, j + 1) * (1 - u) * v + e(i + 1, j + 1) * u * v) * HEIGHT;
}
/** world position of a (fractional) cell coordinate */
export function cellToWorld(ci, cj) { return new THREE.Vector3(ci - N / 2 + 0.5, elevAt(ci, cj), cj - N / 2 + 0.5); }

export class MoonScene {
  constructor(container, overlayCanvas) {
    configure();
    this.mars = WORLD_ID === 'mars';
    this.el = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.mars ? 0x24140e : 0x020308);
    if (this.mars) this.scene.fog = new THREE.Fog(0x8a5a40, 60, 220); // dusty Martian air
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.camera.position.set(-30, 34, 40);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.maxPolarAngle = 1.45; this.controls.minDistance = 4; this.controls.maxDistance = 110;
    this.follow = true;

    this.addSky();
    this.addLights();
    this.addTerrain(overlayCanvas);
    this.addFx();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.anim = null; this.digUntil = 0; this.state = { moving: false, digging: false, dark: false };
    this.onHover = null; this.onPick = null;
    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  addSky() {
    const n = 2500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(600);
      if (v.y < -50) v.y = -v.y;
      pos.set([v.x, v.y, v.z], k * 3);
      const c = 0.5 + Math.random() * 0.5; col.set([c, c, c * (0.9 + Math.random() * 0.2)], k * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, vertexColors: true, sizeAttenuation: false })));
    // Earth sits low on the horizon as seen from the south pole
    const earth = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16), new THREE.MeshBasicMaterial({ color: 0x3d7bd9 }));
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(9.2, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
    earth.add(cloud); earth.position.set(-220, 18, -320); this.scene.add(earth); this.earth = earth;
    if (this.mars) earth.visible = false; // from Mars, Earth is just a bright dot
  }

  addLights() {
    // no air on the Moon means black shadows; a little fill keeps the game readable
    this.scene.add(new THREE.AmbientLight(0x56607a, 0.9));
    this.scene.add(new THREE.HemisphereLight(0x8090b0, 0x202020, 0.6));
    const sun = new THREE.DirectionalLight(0xfff4e0, 3.2);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 260 });
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target); this.sun = sun;
    const disc = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 12), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
    this.scene.add(disc); this.sunDisc = disc;
    this.setSunTime(0);
  }

  /** The Sun circles the horizon once per lunar day (about 708 hours), only a few degrees up. */
  setSunTime(t) {
    const az = (t / 708) * Math.PI * 2 + 0.6, el = 0.12;
    const d = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    this.sun.position.copy(d.clone().multiplyScalar(120));
    this.sunDisc.position.copy(d.clone().multiplyScalar(560));
  }

  addTerrain(overlayCanvas) {
    const seg = 191;
    const geo = new THREE.PlaneGeometry(N, N, seg, seg); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setY(k, elevAt(p.getX(k) + N / 2 - 0.5, p.getZ(k) + N / 2 - 0.5));
    geo.computeVertexNormals();
    this.texture = new THREE.CanvasTexture(overlayCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.anisotropy = 8;
    const m = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.95, metalness: 0, color: this.mars ? 0xe8a47a : 0xffffff });
    this.terrain = new THREE.Mesh(geo, m); this.terrain.receiveShadow = true; this.terrain.castShadow = true;
    this.scene.add(this.terrain);
    // a dark skirt so the map edge doesn't look paper-thin
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(N, 2, N), new THREE.MeshStandardMaterial({ color: 0x15171c }));
    skirt.position.y = -1.01; this.scene.add(skirt);
  }

  refreshOverlay() { this.texture.needsUpdate = true; }

  addFx() {
    // dust particles
    this.dustN = 400;
    const g = new THREE.BufferGeometry();
    this.dustPos = new Float32Array(this.dustN * 3); this.dustVel = new Float32Array(this.dustN * 3); this.dustLife = new Float32Array(this.dustN);
    g.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: this.mars ? 0xc98a5e : 0xc9c2b4, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
    this.dust.frustumCulled = false; this.scene.add(this.dust); this.dustNext = 0;
    // scan pulse rings
    this.rings = [];
  }

  emitDust(at, count, spread = 0.6, up = 1.2) {
    for (let n = 0; n < count; n++) {
      const k = this.dustNext++ % this.dustN;
      this.dustPos.set([at.x + (Math.random() - 0.5) * 0.3, at.y + 0.1, at.z + (Math.random() - 0.5) * 0.3], k * 3);
      // low gravity: dust flies in clean arcs, no air to slow it
      this.dustVel.set([(Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread], k * 3);
      this.dustLife[k] = 1.5 + Math.random();
    }
  }

  scanPulse() {
    if (!this.rover) return;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: 0x7fdcff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(this.rover.position).add(new THREE.Vector3(0, 0.4, 0));
    ring.userData.age = 0; this.scene.add(ring); this.rings.push(ring);
  }

  setRover(design, k) {
    if (this.rover) this.scene.remove(this.rover);
    this.rover = buildRover(design); this.rover.scale.setScalar(ROVER_SCALE);
    this.rover.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.rover);
    this.placeRover(k % N, Math.floor(k / N), 0);
  }

  setLander(k) {
    if (!this.lander) { this.lander = buildLander(); this.lander.scale.setScalar(0.6); this.lander.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(this.lander); }
    // stand the lander just beside the rover's start square so both are visible
    const ci = k % N - 0.9, cj = Math.floor(k / N) - 0.7;
    const p = cellToWorld(ci, cj); this.lander.position.copy(p); this.landerHome = p.clone();
  }

  placeRover(ci, cj, heading) {
    const p = cellToWorld(ci, cj);
    this.rover.position.copy(p);
    // tilt with the ground
    const dx = elevAt(ci + 0.3, cj) - elevAt(ci - 0.3, cj), dz = elevAt(ci, cj + 0.3) - elevAt(ci, cj - 0.3);
    this.rover.rotation.set(0, 0, 0);
    this.rover.rotateY(-heading);
    const fwd = Math.cos(heading) * dx + Math.sin(heading) * dz, side = -Math.sin(heading) * dx + Math.cos(heading) * dz;
    this.rover.rotateZ(Math.atan(fwd / 0.6) * 0.8); this.rover.rotateX(-Math.atan(side / 0.6) * 0.8);
  }

  /** Animate the rover along cells [{i,j}], about 180 ms per cell. Resolves when done. */
  driveAlong(cells, onStep) {
    if (cells.length < 2) return Promise.resolve();
    const per = Math.max(90, Math.min(220, 2600 / cells.length));
    return new Promise((resolve) => {
      this.anim = { cells, t0: performance.now(), per, onStep, resolve, last: -1 };
      // browsers pause animation frames in background tabs: never let the game hang on them
      setTimeout(() => {
        if (this.anim && this.anim.resolve === resolve) {
          const c = cells[cells.length - 1]; this.placeRover(c.i, c.j, this.heading || 0); this.anim = null; resolve();
        }
      }, per * cells.length + 800);
    });
  }

  dig(seconds = 1.6) { this.digUntil = performance.now() + seconds * 1000; }

  /** Landing: the lander drops from the sky with its engine firing, kicks up dust and touches down. */
  playLanding(k) {
    this.setLander(k);
    const home = this.landerHome.clone();
    const startCam = home.clone().add(new THREE.Vector3(-14, 10, 16));
    this.camera.position.copy(startCam); this.controls.target.copy(home);
    this.follow = false;
    return new Promise((resolve) => {
      this.landing = { t0: performance.now(), dur: 3600, home, resolve };
      setTimeout(() => { if (this.landing && this.landing.resolve === resolve) this.endLanding(); }, 4600);
    });
  }

  endLanding() {
    const L = this.landing; if (!L) return;
    this.lander.position.copy(L.home); this.lander.userData.flame.material.opacity = 0;
    this.landing = null; this.follow = true; L.resolve();
  }

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    const cellAt = (ev) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObject(this.terrain)[0];
      if (!hit) return null;
      const i = Math.floor(hit.point.x + N / 2), j = Math.floor(hit.point.z + N / 2);
      return i >= 0 && j >= 0 && i < N && j < N ? j * N + i : null;
    };
    el.addEventListener('pointermove', (ev) => { if (this.onHover) this.onHover(cellAt(ev), ev); });
    el.addEventListener('pointerleave', () => this.onHover && this.onHover(null));
    el.addEventListener('pointerdown', (ev) => { down = [ev.clientX, ev.clientY]; });
    el.addEventListener('pointerup', (ev) => {
      // a click, not a camera drag
      if (down && Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) < 6 && this.onPick) this.onPick(cellAt(ev));
      down = null;
    });
  }

  resize() {
    const w = this.el.clientWidth || 800, h = this.el.clientHeight || 500;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  setDark(dark) { this.state.dark = dark; }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta()), time = this.clock.elapsedTime, now = performance.now();
    let moving = false;

    if (this.anim && this.rover) {
      const a = this.anim, f = (now - a.t0) / a.per, n = Math.min(a.cells.length - 1, Math.floor(f));
      if (n !== a.last) { a.last = n; if (a.onStep) a.onStep(n); }
      if (f >= a.cells.length - 1) {
        const c = a.cells[a.cells.length - 1]; this.placeRover(c.i, c.j, this.heading || 0);
        this.anim = null; a.resolve();
      } else {
        const c0 = a.cells[n], c1 = a.cells[n + 1], u = f - n;
        const target = Math.atan2(c1.j - c0.j, c1.i - c0.i);
        let dh = target - (this.heading ?? target); dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        this.heading = (this.heading ?? target) + dh * Math.min(1, dt * 10);
        this.placeRover(c0.i + (c1.i - c0.i) * u, c0.j + (c1.j - c0.j) * u, this.heading);
        moving = true;
        if (Math.random() < 0.6) this.emitDust(this.rover.position, 2, 0.5, 0.6);
      }
    }
    const digging = now < this.digUntil;
    if (digging && this.rover) {
      const front = new THREE.Vector3(1.2 * ROVER_SCALE, 0, 0).applyEuler(this.rover.rotation).add(this.rover.position);
      this.emitDust(front, 4, 1.4, 2.2);
    }
    if (this.rover) animateRover(this.rover, time, { moving, digging, dark: this.state.dark });

    // dust physics: lunar gravity, no air
    for (let k = 0; k < this.dustN; k++) {
      if (this.dustLife[k] <= 0) { this.dustPos[k * 3 + 1] = -999; continue; }
      this.dustLife[k] -= dt;
      this.dustVel[k * 3 + 1] -= (this.mars ? 3.71 : 1.62) * 0.6 * dt; // real surface gravity
      for (let a = 0; a < 3; a++) this.dustPos[k * 3 + a] += this.dustVel[k * 3 + a] * dt;
    }
    this.dust.geometry.attributes.position.needsUpdate = true;

    this.rings = this.rings.filter((r) => {
      r.userData.age += dt; const s = 1 + r.userData.age * 7; r.scale.setScalar(s);
      r.material.opacity = Math.max(0, 0.9 - r.userData.age * 0.6);
      if (r.userData.age > 1.5) { this.scene.remove(r); r.geometry.dispose(); r.material.dispose(); return false; }
      return true;
    });

    if (this.landing) {
      const L = this.landing, u = Math.min(1, (now - L.t0) / L.dur), e = 1 - Math.pow(1 - u, 3);
      this.lander.position.copy(L.home).add(new THREE.Vector3(0, (1 - e) * 26, 0));
      this.lander.userData.flame.material.opacity = u < 0.95 ? 0.75 + Math.random() * 0.25 : 0;
      this.lander.userData.flame.scale.y = 0.7 + Math.random() * 0.5;
      if (u > 0.55 && u < 0.98) this.emitDust(L.home, 8, 3.5, 0.8);
      const shake = u > 0.6 && u < 0.98 ? 0.08 : 0;
      this.controls.target.copy(this.lander.position).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
      if (u >= 1) this.endLanding();
    }

    if (this.follow && this.rover && !this.landing) {
      this.controls.target.lerp(this.rover.position, Math.min(1, dt * 3));
    }
    this.earth.rotation.y += dt * 0.02;
    this.sun.target.position.copy(this.controls.target);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  overview() { this.follow = false; this.camera.position.set(-30, 34, 40); this.controls.target.set(0, 4, 0); }
  chase() {
    if (!this.rover) return;
    this.follow = true;
    this.camera.position.copy(this.rover.position).add(new THREE.Vector3(-5, 4, 5));
  }

  dispose() {
    cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose(); this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** Small turntable view of the rover for the Build screen. */
export class RoverPreview {
  constructor(container) {
    this.el = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(3.4, 2.2, 3.4); this.camera.lookAt(0, 0.85, 0);
    this.scene.add(new THREE.AmbientLight(0x6070a0, 0.8));
    const key = new THREE.DirectionalLight(0xfff1dd, 3); key.position.set(4, 3, 2); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fb0ff, 1.5); rim.position.set(-3, 2, -4); this.scene.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; this.scene.add(ground);
    this.clock = new THREE.Clock();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const t = this.clock.getElapsedTime();
      if (this.rover) { this.rover.rotation.y = t * 0.5; animateRover(this.rover, t, { moving: true, digging: true }); }
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
  setDesign(design) {
    if (this.rover) this.scene.remove(this.rover);
    this.rover = buildRover(design); this.scene.add(this.rover);
    this.rover.scale.setScalar(0.001);
    const t0 = performance.now();
    const grow = () => { const u = Math.min(1, (performance.now() - t0) / 350); this.rover.scale.setScalar(0.4 + 0.6 * (1 - Math.pow(1 - u, 3)) ); if (u < 1) requestAnimationFrame(grow); };
    grow();
  }
  resize() { const w = this.el.clientWidth || 300, h = this.el.clientHeight || 220; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  dispose() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
