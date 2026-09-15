/* Inertia Fund — the path of a megawatt.
   One continuous lit scene. A double-flow low-pressure steam turbine rotor — ten rows of solid,
   twisted airfoil blades, shortest at the steam inlet in the middle and longest at the ends —
   on a stepped forged rotor body, and further along the same axis the generator step-up
   transformer it feeds. The camera travels along the axis as the reader scrolls.
   Three.js, self-hosted. Studio lighting from an environment map; brushed metal, paint, porcelain. */
import * as THREE from '/vendor/three.module.min.js';
import { RoomEnvironment } from '/vendor/RoomEnvironment.js';

const stage = document.getElementById('stage');
if (stage) init();

function init() {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const GRAPHITE = 0x15191d;
  scene.background = new THREE.Color(GRAPHITE);
  scene.fog = new THREE.FogExp2(GRAPHITE, 0.030);

  // Studio environment: a soft graded dome with two large softboxes, so metal picks up long,
  // smooth highlights rather than hard hot spots.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.02).texture;
  function studio() {
    const env = new THREE.Scene();
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0x737a81) }, mid: { value: new THREE.Color(0x3a4149) }, bot: { value: new THREE.Color(0x0b0e11) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.8)) : mix(mid, bot, pow(-h, 0.6)); gl_FragColor = vec4(c, 1.0); }'
    });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), domeMat));
    const box = (w, h, x, y, z, ry, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(i) })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    box(18, 10, -12, 14, 10, 0, 3.2);     // key softbox, upper left
    box(10, 22, 20, 4, -12, 0, 1.6);      // tall rim panel, back right
    box(30, 6, 0, -14, 6, 0, 0.5);        // faint floor bounce
    return env;
  }

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 300);

  // A gentle warm key and a cool rim, both weak — the environment does the work.
  const key = new THREE.DirectionalLight(0xffe9d2, 0.5); key.position.set(4, 8, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd0e6, 0.35); rim.position.set(-6, 2, -8); scene.add(rim);

  // ---- materials ----
  const bladeSteel = new THREE.MeshPhysicalMaterial({ color: 0x777e86, metalness: 1.0, roughness: 0.40, anisotropy: 0.5, envMapIntensity: 0.85, side: THREE.DoubleSide });
  const rotorSteel = new THREE.MeshPhysicalMaterial({ color: 0x5c636b, metalness: 1.0, roughness: 0.44, anisotropy: 0.7, envMapIntensity: 0.9 });
  const darkSteel  = new THREE.MeshPhysicalMaterial({ color: 0x3f464e, metalness: 0.9, roughness: 0.5 });
  const paint      = new THREE.MeshPhysicalMaterial({ color: 0x565f68, metalness: 0.25, roughness: 0.58, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const porcelain  = new THREE.MeshPhysicalMaterial({ color: 0xcfcac0, metalness: 0.0, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const concrete   = new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.0, roughness: 0.95 });

  // ---- helpers ----
  // Revolve an (x, r) profile around the x axis.
  function latheX(profile, segments = 96) {
    const pts = profile.map(([x, r]) => new THREE.Vector2(r, x));
    const geo = new THREE.LatheGeometry(pts, segments);
    geo.rotateZ(-Math.PI / 2);           // lathe axis (y) → x
    return geo;
  }

  // A solid twisted airfoil blade lofted from root to tip.
  // Local frame: radial = +y (root at y = rRoot), axial = +x, tangential = +z.
  function bladeGeometry(rRoot, height, chordRoot, chordTip, staggerRoot, staggerTip, thick) {
    const S = 9, K = 14;                       // span stations, points per side of the section
    const rings = [];
    for (let i = 0; i <= S; i++) {
      const u = i / S;
      const r = rRoot + height * u;
      const c = chordRoot + (chordTip - chordRoot) * u;
      const st = staggerRoot + (staggerTip - staggerRoot) * u;
      const cs = Math.cos(st), sn = Math.sin(st);
      const ring = [];
      // upper surface leading → trailing, then lower surface trailing → leading
      for (let side = 0; side < 2; side++) for (let k = 0; k < K; k++) {
        const t = side === 0 ? k / (K - 1) : 1 - k / (K - 1);
        const th = 5 * thick * (0.2969 * Math.sqrt(t) - 0.1260 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
        const camber = 0.16 * t * (1 - t) * 4 * 0.5;
        const y2 = camber + (side === 0 ? th : -th);           // section y (normal to chord)
        const x2 = t - 0.42;                                    // section x along chord, pivot near mid
        // rotate section by stagger in the (axial, tangential) plane, scale by chord
        const ax = (x2 * cs - y2 * sn) * c;
        const tg = (x2 * sn + y2 * cs) * c;
        ring.push([ax, r, tg]);
      }
      rings.push(ring);
    }
    const n = rings[0].length, pos = [], idx = [];
    rings.forEach(ring => ring.forEach(p => pos.push(...p)));
    for (let i = 0; i < S; i++) for (let k = 0; k < n; k++) {
      const a = i * n + k, b = i * n + (k + 1) % n, c2 = (i + 1) * n + k, d = (i + 1) * n + (k + 1) % n;
      idx.push(a, c2, b, b, c2, d);
    }
    // caps
    const rootC = pos.length / 3; { let cx = 0, cy = 0, cz = 0; rings[0].forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; }); pos.push(cx / n, cy / n, cz / n); }
    const tipC = pos.length / 3;  { let cx = 0, cy = 0, cz = 0; rings[S].forEach(p => { cx += p[0]; cy += p[1]; cz += p[2]; }); pos.push(cx / n, cy / n, cz / n); }
    for (let k = 0; k < n; k++) { idx.push(rootC, (k + 1) % n, k); idx.push(tipC, S * n + k, S * n + (k + 1) % n); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // ---- the rotor ----
  const rotor = new THREE.Group(); scene.add(rotor);
  const DRUM = 0.62;
  // Ten blade rows: mirrored about the inlet at x = 0. [x, height, count]
  const half = [[0.38, 0.30, 110], [0.92, 0.42, 96], [1.52, 0.60, 84], [2.20, 0.86, 70], [3.00, 1.22, 58]];
  const rows = [...half.map(([x, h, n]) => [x, h, n]), ...half.map(([x, h, n]) => [-x, h, n])];

  // Forged rotor body: journals, coupling, the bladed drum with grooves between rows.
  const prof = [[-4.9, 0.0], [-4.9, 0.24], [-4.5, 0.24], [-4.45, 0.34], [-3.55, 0.34], [-3.5, DRUM]];
  const grooves = [2.6, 1.86, 1.22, 0.65];
  for (const g of grooves.slice().reverse().map(v => -v)) prof.push([g - 0.09, DRUM], [g - 0.06, DRUM - 0.10], [g + 0.06, DRUM - 0.10], [g + 0.09, DRUM]);
  prof.push([-0.16, DRUM], [-0.14, DRUM + 0.05], [0.14, DRUM + 0.05], [0.16, DRUM]);
  for (const g of grooves) prof.push([g - 0.09, DRUM], [g - 0.06, DRUM - 0.10], [g + 0.06, DRUM - 0.10], [g + 0.09, DRUM]);
  prof.push([3.5, DRUM], [3.55, 0.34], [4.45, 0.34], [4.5, 0.24], [5.2, 0.24], [5.2, 0.30], [5.45, 0.30], [5.45, 0.0]);
  const body = new THREE.Mesh(latheX(prof, 128), rotorSteel); rotor.add(body);

  // Blade rows as instanced solid airfoils.
  const rowMeshes = [];
  for (const [x, h, n] of rows) {
    const geo = bladeGeometry(DRUM - 0.02, h, 0.30 + 0.12 * h, 0.22 + 0.10 * h, 0.95, 0.35, 0.07);
    const inst = new THREE.InstancedMesh(geo, bladeSteel, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(1, 0, 0), p = new THREE.Vector3(x, 0, 0), s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < n; i++) { q.setFromAxisAngle(ax, i / n * Math.PI * 2); m.compose(p, q, s); inst.setMatrixAt(i, m); }
    inst.instanceMatrix.needsUpdate = true;
    rotor.add(inst); rowMeshes.push(inst);
    // root platform ring under each row
    const ring = new THREE.Mesh(latheX([[x - 0.16, DRUM - 0.03], [x - 0.16, DRUM + 0.04], [x + 0.16, DRUM + 0.04], [x + 0.16, DRUM - 0.03]], 96), rotorSteel);
    rotor.add(ring);
  }

  // ---- the step-up transformer, further along the axis ----
  const xf = new THREE.Group(); xf.position.set(19.0, -1.0, 0); scene.add(xf);
  function roundedBox(w, h, d, r) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -d / 2); return g;
  }
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 4.6), concrete); plinth.position.y = -1.85; xf.add(plinth);
  const tank = new THREE.Mesh(roundedBox(4.6, 3.2, 2.4, 0.12), paint); xf.add(tank);
  const lid = new THREE.Mesh(roundedBox(4.7, 0.16, 2.5, 0.05), darkSteel); lid.position.y = 1.68; xf.add(lid);
  // Two radiator banks per long side: thin panels on header pipes, standing off the tank.
  const panelGeo = new THREE.BoxGeometry(0.035, 2.4, 0.9);
  for (const side of [-1, 1]) for (const bank of [-1.15, 1.15]) {
    const n = 14, inst = new THREE.InstancedMesh(panelGeo, darkSteel, n), m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { m.makeTranslation(bank - 0.585 + i * 0.09, -0.15, side * 1.85); inst.setMatrixAt(i, m); }
    inst.instanceMatrix.needsUpdate = true; xf.add(inst);
    for (const y of [1.1, -1.4]) {
      const hdr = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.5, 24), darkSteel);
      hdr.rotation.z = Math.PI / 2; hdr.position.set(bank, y, side * 1.85); xf.add(hdr);
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.7, 24), darkSteel);
      stub.rotation.x = Math.PI / 2; stub.position.set(bank, y, side * 1.5); xf.add(stub);
    }
  }
  // Conservator on top, rear, with its pipe
  const cons = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.4, 48), paint);
  cons.rotation.z = Math.PI / 2; cons.position.set(0.3, 2.55, -0.72); xf.add(cons);
  const consPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 16), darkSteel);
  consPipe.position.set(-1.2, 2.1, -0.72); xf.add(consPipe);
  // Three HV bushings: tapered porcelain with alternating sheds, a steel flange and a cap
  for (let k = -1; k <= 1; k++) {
    const bx = k * 1.35, bz = 0.35, y0 = 1.76;
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.14, 40), darkSteel); flange.position.set(bx, y0 + 0.07, bz); xf.add(flange);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 2.6, 32), porcelain); core.position.set(bx, y0 + 1.45, bz); xf.add(core);
    for (let s = 0; s < 16; s++) {
      const big = s % 2 === 0;
      const shed = new THREE.Mesh(new THREE.CylinderGeometry(big ? 0.27 : 0.22, 0.13, 0.07, 40), porcelain);
      shed.position.set(bx, y0 + 0.30 + s * 0.15, bz); xf.add(shed);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 32), bladeSteel); cap.position.set(bx, y0 + 2.85, bz); xf.add(cap);
    const terminal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), bladeSteel); terminal.position.set(bx, y0 + 3.05, bz); xf.add(terminal);
  }
  // The coupling from the turbine toward the generator/transformer: the path itself.
  const coupling = new THREE.Mesh(latheX([[0, 0], [0, 0.22], [10.4, 0.22], [10.4, 0.34], [10.8, 0.34], [10.8, 0]], 64), rotorSteel);
  coupling.position.set(5.45, 0, 0); scene.add(coupling);

  // ---- camera keyframes along the scroll (u = 0..1 over the whole page): pos, look, exposure ----
  const KEYS = [
    { u: 0.00, pos: [ 8.5,  2.4, 10.5], look: [-1.2, -0.5, 0], exp: 0.9 },
    { u: 0.13, pos: [ 4.0,  1.2,  6.2], look: [-2.6, -0.4, 0], exp: 0.9 },
    { u: 0.27, pos: [27.5,  3.4, 15.5], look: [19.0,  0.5, 0], exp: 0.9 },
    { u: 0.41, pos: [24.5,  1.4, 11.0], look: [19.4,  0.7, 0], exp: 0.22 },
    { u: 0.55, pos: [29.5,  3.8, 16.5], look: [18.6, -0.2, 0], exp: 0.9 },
    { u: 0.69, pos: [28.5,  3.6, 14.5], look: [18.4, -0.2, 0], exp: 0.18 },
    { u: 0.84, pos: [31.5,  4.6, 17.5], look: [17.0, -0.4, 0], exp: 0.55 },
    { u: 1.00, pos: [33.5,  5.0, 19.5], look: [16.5, -0.4, 0], exp: 0.35 }
  ];
  const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
  const smooth = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  function poseAt(u) {
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) if (u >= KEYS[i].u && u <= KEYS[i + 1].u) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const t = smooth((u - a.u) / Math.max(b.u - a.u, 1e-6));
    tmpPos.set(lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t));
    tmpLook.set(lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t), lerp(a.look[2], b.look[2], t));
    return lerp(a.exp, b.exp, t);
  }

  let narrow = false;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    narrow = w < 800;
  }
  addEventListener('resize', resize); resize();

  let angle = 0, last = performance.now(), curU = 0, curExp = 0.9;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    const snap = location.hash === '#snap';   // test hook: no easing, for screenshots
    curU += ((scrollY || 0) / max - curU) * (snap ? 1 : 1 - Math.exp(-dt * 7));   // time-based easing
    const exp = poseAt(curU);
    curExp += (exp - curExp) * (snap ? 1 : 1 - Math.exp(-dt * 5));
    renderer.toneMappingExposure = curExp;
    camera.position.copy(tmpPos);
    if (narrow) { camera.position.z += 4.5; camera.position.y += 1.4; }
    camera.lookAt(tmpLook);

    // The rotor turns; slowly, since real machines read as heavy. It settles as the reader moves on.
    const rate = reduceMotion ? 0 : lerp(0.55, 0.08, smooth(curU / 0.3));
    angle += dt * rate;
    rotor.rotation.x = angle;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
