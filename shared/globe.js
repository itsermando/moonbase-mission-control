// A three.js globe of any world, textured with a NASA global mosaic. Used by the hub and the orbit mission.
// Units: 1 = the world's radius.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function latToVec(latDeg, lonDeg = 0, r = 1) {
  const lat = (latDeg * Math.PI) / 180, lon = (lonDeg * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), -r * Math.cos(lat) * Math.sin(lon));
}

export class Globe {
  constructor(container, { base = '', world, autoRotate = 0.08, controls = true, stars = true } = {}) {
    this.el = container; this.base = base; this.autoRotate = autoRotate;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.01, 500);
    this.camera.position.set(0, 0.6, 3.4);
    if (controls) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true; this.controls.enablePan = false; this.controls.minDistance = 1.4; this.controls.maxDistance = 14;
    }
    this.scene.add(new THREE.AmbientLight(0x8090b0, 0.45));
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.6); this.sun.position.set(5, 2, 3); this.scene.add(this.sun);
    if (stars) this.addStars();
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 1 }));
    this.spin = new THREE.Group(); this.spin.add(this.planet); this.scene.add(this.spin);
    this.extras = new THREE.Group(); this.scene.add(this.extras); // orbits and satellites don't spin with the planet
    if (world) this.setWorld(world);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.clock = new THREE.Clock();
    this.onFrame = null;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, this.clock.getDelta());
      this.spin.rotation.y += this.autoRotate * dt;
      if (this.onFrame) this.onFrame(dt, this.clock.elapsedTime);
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  addStars() {
    const n = 1800, p = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(120 + Math.random() * 60); p.set([v.x, v.y, v.z], k * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.85 })));
  }

  setWorld(world) {
    this.world = world;
    new THREE.TextureLoader().load(this.base + world.texture, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      this.planet.material.map = tex; this.planet.material.color.set(0xffffff); this.planet.material.needsUpdate = true;
    }, undefined, () => { this.planet.material.color.set(world.tint || '#999'); });
  }

  /** Mark the landing site (latitude) on the planet surface. */
  setSite(latDeg, lonDeg = 0) {
    if (this.site) this.spin.remove(this.site);
    const g = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.055, 32), new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    const pos = latToVec(latDeg, lonDeg, 1.002); dot.position.copy(pos); ring.position.copy(pos); ring.lookAt(pos.clone().multiplyScalar(2));
    g.add(dot, ring); g.userData.ring = ring; this.site = g; this.spin.add(g);
  }
  setContact(on) {
    if (!this.site) return;
    this.site.userData.ring.material.color.set(on ? 0x46c28a : 0xffd166);
    if (this.link) this.link.visible = !!on;
  }

  /** Draw an orbit from an array of [x,y,z] points (in world radii). */
  setOrbit(points, color = 0x7fd4f0) {
    if (this.orbit) { this.extras.remove(this.orbit); this.orbit.geometry.dispose(); }
    const g = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    this.orbit = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.extras.add(this.orbit);
    if (!this.sat) {
      this.sat = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xd8a943, metalness: 0.7, roughness: 0.35 }));
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.004, 0.045), new THREE.MeshStandardMaterial({ color: 0x1d3a7a, emissive: 0x0a1a40 }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      this.sat.add(body, wing, glow); this.extras.add(this.sat);
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      this.link = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: 0x46c28a, dashSize: 0.04, gapSize: 0.03 }));
      this.link.visible = false; this.extras.add(this.link);
    }
  }

  setSat([x, y, z]) {
    if (!this.sat) return;
    this.sat.position.set(x, y, z);
    if (this.link?.visible && this.site) {
      const s = new THREE.Vector3(); this.site.children[0].getWorldPosition(s);
      this.link.geometry.setFromPoints([s, this.sat.position.clone()]); this.link.computeLineDistances();
    }
  }

  frame(dist = 3.4) { this.camera.position.setLength(dist); }
  resize() { const w = this.el.clientWidth || 400, h = this.el.clientHeight || 400; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  dispose() { cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls?.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
