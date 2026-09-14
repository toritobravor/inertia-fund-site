/* Inertia Fund — the path of a megawatt.
   A single lit scene: a three-stage turbine-generator rotor on a shaft, and further along the
   same axis the step-up transformer it feeds. The camera travels along the shaft as the reader
   scrolls. Three.js, self-hosted; graphite, steel and porcelain only. */
import * as THREE from '/vendor/three.module.min.js';
import { RoomEnvironment } from '/vendor/RoomEnvironment.js';

const stage = document.getElementById('stage');
if (stage) init();

function init() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const GRAPHITE = 0x15191d;
  scene.background = new THREE.Color(GRAPHITE);
  scene.fog = new THREE.FogExp2(GRAPHITE, 0.040);

  // Environment for metal reflections — a neutral studio room, no HDR download needed.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);

  // ---- lights: one key, one cool rim, low fill ----
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.set(6, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9d6e6, 1.1); rim.position.set(-8, 3, -6); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x8a94a0, 0.25));

  // ---- materials ----
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, metalness: 1.0, roughness: 0.26 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x565d66, metalness: 0.95, roughness: 0.42 });
  const paint = new THREE.MeshStandardMaterial({ color: 0x3a424b, metalness: 0.55, roughness: 0.55 });
  const porcelain = new THREE.MeshStandardMaterial({ color: 0xd8d3ca, metalness: 0.0, roughness: 0.32 });
  const ground = new THREE.MeshStandardMaterial({ color: 0x0f1216, metalness: 0.2, roughness: 0.85 });

  // ---- ground plane, far below, catches a little reflection ----

  // ---- the rotor: three stages on one shaft along +x ----
  const rotor = new THREE.Group(); scene.add(rotor);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 7.2, 48), darkSteel);
  shaft.rotation.z = Math.PI / 2; shaft.position.x = 1.0; rotor.add(shaft);

  const STAGES = [
    { x: -1.5, scale: 1.00, spin: 1.00, blades: 30 },
    { x:  0.2, scale: 0.70, spin: 0.62, blades: 24 },
    { x:  1.9, scale: 1.00, spin: 1.00, blades: 30 }
  ];
  const stageGroups = STAGES.map(S => {
    const g = new THREE.Group(); g.position.x = S.x; rotor.add(g);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * S.scale, 0.62 * S.scale, 0.26, 64), steel);
    disc.rotation.z = Math.PI / 2; g.add(disc);
    const bladeGeo = bladeGeometry(0.60 * S.scale, 1.40 * S.scale, 0.30 * S.scale);
    for (let i = 0; i < S.blades; i++) {
      const b = new THREE.Mesh(bladeGeo, steel);
      b.rotation.x = i / S.blades * Math.PI * 2;
      g.add(b);
    }
    return { g, spin: S.spin };
  });

  // A twisted blade: a lofted surface from root to tip, thin, with an airfoil-like camber.
  function bladeGeometry(rRoot, rTip, chord) {
    const NU = 10, NV = 4;                        // span, chord subdivisions
    const geo = new THREE.PlaneGeometry(1, 1, NU, NV);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5, v = pos.getY(i) + 0.5;   // 0..1
      const r = rRoot + (rTip - rRoot) * u;
      const stagger = 0.80 - 0.40 * u;                        // twist toward the tip
      const c = chord * (1.0 - 0.25 * u);                     // taper
      const s = (v - 0.5) * c;                                // along the chord
      const camber = Math.sin(v * Math.PI) * c * 0.10;         // gentle curve
      const ax = s * Math.cos(stagger);                        // axial (x)
      const tg = s * Math.sin(stagger) + camber;               // tangential
      // blade at angle 0: radial = +y, tangential = +z
      pos.setXYZ(i, ax, r, tg);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // ---- the step-up transformer, further along the axis ----
  const xf = new THREE.Group(); xf.position.set(15.5, -0.6, 0); scene.add(xf);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.0, 2.3), paint); tank.position.y = 0; xf.add(tank);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 2.5), darkSteel); lid.position.y = 1.57; xf.add(lid);
  // radiator banks on both long sides
  for (const side of [-1, 1]) {
    for (let i = 0; i < 16; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.5, 0.85), darkSteel);
      fin.position.set(-1.9 + i * 0.25, -0.1, side * (1.15 + 0.5));
      xf.add(fin);
    }
    const header = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.0, 24), steel);
    header.rotation.z = Math.PI / 2; header.position.set(0, 1.2, side * 1.6); xf.add(header);
    const header2 = header.clone(); header2.position.y = -1.3; xf.add(header2);
  }
  // conservator tank on top, rear
  const cons = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 3.6, 40), paint);
  cons.rotation.z = Math.PI / 2; cons.position.set(0.2, 2.35, -0.75); xf.add(cons);
  // three HV bushings: porcelain sheds on a core, steel cap
  for (let k = -1; k <= 1; k++) {
    const bx = k * 1.25, bz = 0.35;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 2.1, 24), porcelain); core.position.set(bx, 2.65, bz); xf.add(core);
    for (let s = 0; s < 9; s++) {
      const shed = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.20, 0.09, 32), porcelain);
      shed.position.set(bx, 1.85 + s * 0.22, bz); xf.add(shed);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 24), steel); cap.position.set(bx, 3.8, bz); xf.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 32), darkSteel); base.position.set(bx, 1.7, bz); xf.add(base);
  }
  // wheels / rails
  for (const sx of [-1.6, 1.6]) for (const sz of [-0.8, 0.8]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 24), darkSteel);
    w.rotation.z = Math.PI / 2; w.position.set(sx, -1.6, sz); xf.add(w);
  }
  // the connection: a short coupling from the shaft end toward the transformer (the "path")
  const coupling = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 9.5, 24), darkSteel);
  coupling.rotation.z = Math.PI / 2; coupling.position.set(9.2, 0, 0); scene.add(coupling);

  // ---- camera keyframes along the scroll (u = 0..1 over the whole page) ----
  //   pos, look, exposure
  const KEYS = [
    { u: 0.00, pos: [ 3.6,  0.8,  7.8], look: [-2.6,  0.0, 0], exp: 1.00 },
    { u: 0.13, pos: [ 1.6,  0.4,  5.4], look: [-2.4, -0.2, 0], exp: 1.00 },
    { u: 0.27, pos: [21.5,  2.6, 12.5], look: [15.6,  0.5, 0], exp: 1.00 },
    { u: 0.41, pos: [19.5,  1.2,  9.5], look: [15.8,  0.8, 0], exp: 0.22 },
    { u: 0.55, pos: [24.0,  3.4, 14.0], look: [15.0,  0.2, 0], exp: 1.00 },
    { u: 0.69, pos: [25.0,  3.8, 14.5], look: [14.8,  0.2, 0], exp: 0.18 },
    { u: 0.84, pos: [28.0,  4.8, 17.5], look: [13.5,  0.0, 0], exp: 0.55 },
    { u: 1.00, pos: [30.0,  5.2, 19.5], look: [13.0,  0.0, 0], exp: 0.35 }
  ];
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  function poseAt(u) {
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) if (u >= KEYS[i].u && u <= KEYS[i + 1].u) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const t = smooth((u - a.u) / Math.max(b.u - a.u, 1e-6));
    tmpPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
    tmpLook.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
    return lerp(a.exp, b.exp, t);
  }
  const smooth = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---- resize ----
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    narrow = w < 800;
  }
  let narrow = false;
  addEventListener('resize', resize); resize();

  // ---- loop ----
  let angle = 0, last = performance.now(), curU = 0, curExp = 1;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    const target = (scrollY || 0) / max;
    curU += (target - curU) * 0.12;                       // eased scroll
    const exp = poseAt(curU);
    curExp += (exp - curExp) * 0.08;
    renderer.toneMappingExposure = curExp;
    camera.position.copy(tmpPos);
    if (narrow) { camera.position.z += 3.5; camera.position.y += 1.2; }
    camera.lookAt(tmpLook);

    // the rotor turns fast at the top and settles as the reader moves along the shaft
    const rate = reduceMotion ? 0 : lerp(1.6, 0.25, smooth(curU / 0.3));
    angle += dt * rate;
    stageGroups.forEach((s, i) => { s.g.rotation.x = angle * s.spin + i * 0.13; });

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
