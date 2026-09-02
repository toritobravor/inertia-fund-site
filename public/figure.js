/* Inertia Fund — the figure.
   A wireframe rotating mass (the physical source of grid inertia) that slows and
   morphs, as the reader scrolls, into a turbine disc and then a transmission lattice.
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

  // Shape 2 — turbine disc: blades sweep outward with a twist; layers become blade root → tip.
  function turbine() {
    var v = [], e = [];
    for (var r = 0; r < R; r++) for (var a = 0; a < A; a++) {
      var f = r / (R - 1);                       // 0 root → 1 tip
      var rad = 0.18 + f * 0.82;
      var t = a / A * TAU + f * 0.9;             // sweep
      var z = (f - 0.5) * 0.36 * Math.sin(a / A * TAU * 3);
      v.push([Math.cos(t) * rad, Math.sin(t) * rad, z]);
    }
    for (var a2 = 0; a2 < A; a2++) for (var r2 = 0; r2 < R - 1; r2++) e.push([r2 * A + a2, (r2 + 1) * A + a2]); // blade lines
    for (a2 = 0; a2 < A; a2++) { e.push([a2, (a2 + 1) % A]); e.push([(R - 1) * A + a2, (R - 1) * A + (a2 + 1) % A]); } // hub and rim
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

  var shapes = [rotor(), turbine(), lattice()];

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
    // rotor → turbine across masthead → firm; turbine → lattice across firm → believe
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
    var rDark = narrow ? Math.min(W * 0.36, H * 0.22) : Math.min(W * 0.21, H * 0.36);
    var radius = lerp(rPaper, rDark, s.dark);
    var an = anchor(rPaper);
    var cx = narrow ? W * 0.5 : lerp(W * 0.22, W * 0.70, s.dark);
    var cy = narrow ? H * 0.5 : lerp(an.cy, H * 0.50, s.dark);
    if (narrow && slot) {                      // small screens: the figure sits in its own slot in the hero
      var sb = slot.getBoundingClientRect();
      cy = sb.top + sb.height / 2;
      radius = Math.min(W * 0.36, sb.height * 0.42);
    }

    // Blend vertices: rotor → turbine → lattice
    var pts = new Array(N);
    for (var i = 0; i < N; i++) {
      var a = shapes[0].v[i], b = shapes[1].v[i], c = shapes[2].v[i];
      var x = lerp(lerp(a[0], b[0], s.p1), c[0], s.p2);
      var y = lerp(lerp(a[1], b[1], s.p1), c[1], s.p2);
      var z = lerp(lerp(a[2], b[2], s.p1), c[2], s.p2);
      pts[i] = [x, y, z];
    }

    // Own-axis spin (fast as a rotor, slower as a turbine, none as a lattice) + a slow tumble
    var spinRate = lerp(lerp(1.0, 0.35, s.p1), 0, s.p2);
    var tilt = lerp(0.95, 0.55, s.p2);     // view the rotor almost edge-on; the lattice more from above
    var yaw = 0.35 + s.y * 0.0006;          // gentle rotation driven by scroll
    var cs = Math.cos(spin), sn = Math.sin(spin);
    var ct = Math.cos(tilt), st = Math.sin(tilt);
    var cyw = Math.cos(yaw), syw = Math.sin(yaw);

    var proj = new Array(N);
    for (i = 0; i < N; i++) {
      var p = pts[i];
      // spin about z (the shaft), then tilt about x, then yaw about y
      var x1 = p[0] * cs - p[1] * sn, y1 = p[0] * sn + p[1] * cs, z1 = p[2];
      var y2 = y1 * ct - z1 * st, z2 = y1 * st + z1 * ct;
      var x3 = x1 * cyw + z2 * syw, z3 = -x1 * syw + z2 * cyw;
      var d = 3.2 / (3.2 + z3);            // perspective
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
      ctx.beginPath();
      for (var k = 0; k < shape.e.length; k++) {
        var pa = proj[shape.e[k][0]], pb = proj[shape.e[k][1]];
        ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]);
      }
      ctx.strokeStyle = 'rgba(' + col + ',' + (alpha * weight).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
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
