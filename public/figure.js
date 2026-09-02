/* Inertia Fund — the figure.
   A wireframe turbine stage that, as the reader scrolls, slows and morphs into a flywheel
   (the rotating mass that is the physical source of grid inertia) and then a transmission lattice.
   Plain Canvas 2D, no dependencies, hairline strokes only. */
(function () {
  'use strict';

  var canvas = document.getElementById('figure');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- geometry ----------
  var A = 36;            // angular samples
  var R = 4;             // rings / layers
  var N = A * R;         // vertices per shape (144)
  var TAU = Math.PI * 2;

  // Shape 1 — rotor: a flywheel. Hub ring + rim, each doubled in z (a short cylinder), spokes.
  function rotor() {
    var v = [], e = [];
    var radii = [0.28, 0.28, 1.0, 1.0], zs = [0.16, -0.16, 0.22, -0.22];
    for (var r = 0; r < R; r++) for (var a = 0; a < A; a++) {
      var t = a / A * TAU;
      v.push([Math.cos(t) * radii[r], Math.sin(t) * radii[r], zs[r]]);
    }
    for (r = 0; r < R; r++) for (a = 0; a < A; a++) e.push([r * A + a, r * A + (a + 1) % A]);       // rings
    for (a = 0; a < A; a++) { e.push([a, A + a]); e.push([2 * A + a, 3 * A + a]); }                 // cylinder walls
    for (a = 0; a < A; a += 3) { e.push([a, 2 * A + a]); e.push([A + a, 3 * A + a]); }              // spokes
    return { v: v, e: e };
  }

  // Shape 2 — a three-stage axial turbine on one shaft: a large front stage, a smaller stage
  // behind it, and a second large stage at the back. Each stage is 18 twisted blades from a hub
  // ring to a free tip, drawn as leading edge, trailing edge and chord lines. The front stage
  // occupies indices 0..N-1 and mirrors the flywheel's (station × angle) layout so the two morph
  // cleanly; the other stages collapse onto it during the morph.
  var STAGES = [
    { z: -0.85, scale: 1.00, spin: 1.00, phase: 0.00, ink: 1.00 },
    { z:  0.00, scale: 0.66, spin: 0.62, phase: 0.17, ink: 0.62 },
    { z:  0.85, scale: 1.00, spin: 1.00, phase: 0.09, ink: 0.42 }
  ];
  function turbine() {
    var v = new Array(N * STAGES.length), e = [], B = A / 2, chord = 0.26;
    for (var k = 0; k < STAGES.length; k++) {
      var S = STAGES[k], base = k * N;
      for (var st = 0; st < R; st++) {
        var f = st / (R - 1);                          // 0 root → 1 tip
        var rad = (0.34 + 0.66 * f) * S.scale;
        var stagger = 0.95 - 0.45 * f;                // blades twist toward the tip
        for (var bl = 0; bl < B; bl++) {
          var th = bl / B * TAU;
          for (var edge = 0; edge < 2; edge++) {
            var sgn = edge === 0 ? 1 : -1;            // leading / trailing edge
            var dz = sgn * chord / 2 * Math.cos(stagger) * S.scale;
            var dth = sgn * chord / 2 * Math.sin(stagger) / rad * S.scale;
            v[base + st * A + bl * 2 + edge] = [Math.cos(th + dth) * rad, Math.sin(th + dth) * rad, S.z + dz];
          }
        }
      }
      for (var bl2 = 0; bl2 < B; bl2++) {
        for (var st2 = 0; st2 < R; st2++) {
          var le = base + st2 * A + bl2 * 2, te = le + 1;
          e.push([le, te, S.ink]);                                                      // chord at each station
          if (st2 < R - 1) { e.push([le, le + A, S.ink]); e.push([te, te + A, S.ink]); } // leading and trailing edges along the span
        }
        var nb = (bl2 + 1) % B;
        e.push([base + bl2 * 2, base + nb * 2, S.ink]); e.push([base + bl2 * 2 + 1, base + nb * 2 + 1, S.ink]); // hub rings
      }
    }
    // The shaft: six lines joining the hub rings of adjacent stages
    for (k = 0; k < STAGES.length - 1; k++) for (var q = 0; q < B; q += 3) {
      e.push([k * N + q * 2 + 1, (k + 1) * N + q * 2, STAGES[k + 1].ink]);
    }
    return { v: v, e: e };
  }

  // Shape 3 — transmission lattice: a 6 × 6 × 4 grid (144 nodes).
  function lattice() {
    var v = [], e = [], X = 6, Y = 6, Z = 4;
    for (var z = 0; z < Z; z++) for (var y = 0; y < Y; y++) for (var x = 0; x < X; x++) {
      v.push([(x / (X - 1) - 0.5) * 1.7, (y / (Y - 1) - 0.5) * 1.7, (z / (Z - 1) - 0.5) * 0.9]);
    }
    function id(x, y, z) { return z * X * Y + y * X + x; }
    for (z = 0; z < Z; z++) for (y = 0; y < Y; y++) for (var x2 = 0; x2 < X; x2++) {
      if (x2 < X - 1) e.push([id(x2, y, z), id(x2 + 1, y, z)]);
      if (y < Y - 1) e.push([id(x2, y, z), id(x2, y + 1, z)]);
      if (z < Z - 1 && ((x2 + y) % 2 === 0)) e.push([id(x2, y, z), id(x2, y, z + 1)]);
    }
    return { v: v, e: e };
  }

  var shapes = [turbine(), rotor(), lattice()];   // masthead → firm → theses

  // ---------- scroll → stage ----------
  // Stage boundaries are read from sections so the morph tracks the page's own structure.
  function marks() {
    var ids = ['firm', 'believe', 'name'];
    var m = [0];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      m.push(el ? el.offsetTop : (i + 1) * window.innerHeight * 2);
    }
    return m; // [0, firm, believe, name]
  }
  var M = marks();
  window.addEventListener('resize', function () { M = marks(); resize(); draw(true); });

  function progress() {
    var y = window.scrollY || window.pageYOffset || 0;
    var vh = window.innerHeight;
    // turbine → flywheel across masthead → firm; flywheel → lattice across firm → believe
    var p1 = clamp((y - (M[1] - vh * 0.7)) / (vh * 0.7), 0, 1);
    var p2 = clamp((y - (M[2] - vh * 0.7)) / (vh * 0.7), 0, 1);
    var fade = clamp((y - (M[3] - vh * 0.6)) / (vh * 0.8), 0, 1); // fade out toward "The name"
    var dark = clamp(1 - (y - (M[1] - vh)) / (vh * 0.6), 0, 1);  // 1 on the dark masthead, 0 on paper
    return { p1: ease(p1), p2: ease(p2), fade: fade, dark: dark, y: y };
  }

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---------- render ----------
  var W, H, DPR;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  var spin = 0, last = 0, lastY = -1, running = true, occl = 0;
  var heads = document.querySelectorAll('.section-head');
  var slot = document.querySelector('.figure-slot');
  // 1 when a section head (or the hero copy) would sit over the figure; the figure yields to the type.
  // The figure hangs beneath the current section head in the left column and yields
  // (fades) when the head has not yet left it room.
  function anchor(r) {
    var cur = null;
    for (var i = 0; i < heads.length; i++) {
      var b = heads[i].getBoundingClientRect();
      if (b.top < H * 0.6 && (!cur || b.top > cur.top)) cur = { top: b.top, bottom: b.top + heads[i].scrollHeight, full: heads[i].hasAttribute('data-nofigure') };
    }
    if (!cur) return { cy: H * 0.68, hit: 0 };
    var cy = cur.bottom + r * 1.15;
    var hit = (cy + r * 1.05 > H || cur.full) ? 1 : 0;
    return { cy: Math.min(cy, H - r * 1.3), hit: hit };
  }

  function draw(force) {
    var s = progress();
    if (!force && !running && s.y === lastY) return;
    lastY = s.y;

    var narrow = W < 800;
    // On the dark masthead the figure sits large at the right; on paper it moves to the
    // left column, beneath the section heads, where the page leaves room for it.
    var rPaper = narrow ? Math.min(W * 0.28, H * 0.14) : Math.min(W * 0.10, H * 0.14);
    var rDark = narrow ? Math.min(W * 0.34, H * 0.20) : Math.min(W * 0.135, H * 0.26);
    var radius = lerp(rPaper, rDark, s.dark);
    var an = anchor(rPaper);
    var cx = narrow ? W * 0.5 : lerp(W * 0.22, W * 0.76, s.dark);
    var cy = narrow ? H * 0.5 : lerp(an.cy, H * 0.50, s.dark);
    if (narrow && slot) {                      // small screens: the figure sits in its own slot in the hero
      var sb = slot.getBoundingClientRect();
      cy = sb.top + sb.height / 2;
      radius = Math.min(W * 0.36, sb.height * 0.42);
    }

    // Blend vertices: turbine → flywheel → lattice. The turbine's rear stages collapse onto the
    // front stage's targets as the morph begins, so they vanish into the flywheel.
    var NT = shapes[0].v.length;
    var pts = new Array(NT);
    for (var i = 0; i < NT; i++) {
      var j = i % N;
      var a = shapes[0].v[i], b = shapes[1].v[j], c = shapes[2].v[j];
      var x = lerp(lerp(a[0], b[0], s.p1), c[0], s.p2);
      var y = lerp(lerp(a[1], b[1], s.p1), c[1], s.p2);
      var z = lerp(lerp(a[2], b[2], s.p1), c[2], s.p2);
      pts[i] = [x, y, z];
    }

    // Own-axis spin (fast as a rotor, slower as a turbine, none as a lattice) + a slow tumble
    var spinRate = lerp(lerp(1.0, 0.45, s.p1), 0, s.p2);
    var tilt = lerp(lerp(0.18, 0.72, s.p1), 0.55, s.p2);     // the turbine stands upright; the lattice is seen more from above
    var yaw = lerp(-0.8, 0.3, s.p1) + 0.3 * Math.sin(s.y * 0.0008);   // the turbine is seen from the side-front so its stages read along the shaft
    var ct = Math.cos(tilt), st = Math.sin(tilt);
    var cyw = Math.cos(yaw), syw = Math.sin(yaw);

    var proj = new Array(NT);
    for (i = 0; i < NT; i++) {
      var p = pts[i];
      // each turbine stage spins at its own rate (the flywheel and lattice use the front stage's)
      var S = STAGES[Math.floor(i / N)], ang = spin * lerp(S.spin, 1, s.p1) + S.phase * (1 - s.p1);
      var cs = Math.cos(ang), sn = Math.sin(ang);
      // spin about z (the shaft), then tilt about x, then yaw about y
      var x1 = p[0] * cs - p[1] * sn, y1 = p[0] * sn + p[1] * cs, z1 = p[2];
      var y2 = y1 * ct - z1 * st, z2 = y1 * st + z1 * ct;
      var x3 = x1 * cyw + z2 * syw, z3 = -x1 * syw + z2 * cyw;
      var d = 4.6 / (4.6 + z3);            // perspective
      proj[i] = [cx + x3 * radius * d, cy + y2 * radius * d, d];
    }

    ctx.clearRect(0, 0, W, H);

    // Stroke: bone on the dark masthead, graphite on paper; recede as we reach "The name".
    var alphaBase = narrow ? 0.55 : 0.85;
    var onPaper = 1 - s.dark;
    var target = narrow ? 0 : an.hit * (1 - s.dark);
    occl += (target - occl) * 0.3;
    var alpha = lerp(alphaBase, narrow ? 0 : 0.42, onPaper) * (1 - s.fade) * (1 - occl);
    var settling = Math.abs(target - occl) > 0.01;
    
    if (alpha <= 0.005 && !settling) { running = false; return; }
    var col = s.dark > 0.5 ? '244,242,237' : '21,25,29';

    function edges(shape, weight) {
      if (weight <= 0.01) return;
      // edges may carry a third value: a per-edge ink weight (rear turbine stages recede)
      var groups = {};
      for (var k = 0; k < shape.e.length; k++) {
        var w = shape.e[k][2] === undefined ? 1 : shape.e[k][2];
        (groups[w] = groups[w] || []).push(shape.e[k]);
      }
      ctx.lineWidth = 1;
      for (var g in groups) {
        ctx.beginPath();
        var list = groups[g];
        for (var m = 0; m < list.length; m++) {
          var pa = proj[list[m][0]], pb = proj[list[m][1]];
          ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
        }
        ctx.strokeStyle = 'rgba(' + col + ',' + (alpha * weight * lerp(parseFloat(g), 1, s.p1)).toFixed(3) + ')';
        ctx.stroke();
      }
    }
    // Crossfade edge sets
    edges(shapes[0], (1 - s.p1) * (1 - s.p2));
    edges(shapes[1], s.p1 * (1 - s.p2));
    edges(shapes[2], s.p2);

    // The one accent: the shaft point in Arc.
    var hub = proj[0];
    var hx = cx + (0) * radius, hy = cy;
    ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, TAU);
    ctx.fillStyle = 'rgba(204,67,24,' + (alpha * 1.1).toFixed(3) + ')';
    ctx.fill();
    void hub;

    // Idle: stop redrawing when the lattice is static and the reader is not scrolling
    running = (spinRate > 0.001 && !reduceMotion) || settling;
    if (running) spin += 0.012 * spinRate;
  }

  function loop(t) {
    if (t - last > 16) { last = t; draw(false); }
    requestAnimationFrame(loop);
  }

  resize();
  draw(true);
  if (!reduceMotion) requestAnimationFrame(loop);
  else window.addEventListener('scroll', function () { draw(true); }, { passive: true });
  window.addEventListener('scroll', function () { lastY = -1; }, { passive: true });
})();
