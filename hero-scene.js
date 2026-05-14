/* =========================================================
   Aatiqa Aslam — Saturn orbital animation system
   GPU-optimized 3D-feeling orbits with mouse parallax,
   depth-based scaling, opacity, and z-ordering.
   ========================================================= */

(function () {
  'use strict';

  const stage = document.getElementById('saturnStage');
  if (!stage) return;

  const orbiters = Array.from(stage.querySelectorAll('.orbiter'));
  if (!orbiters.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;

  /* Each orbit is a circle in a plane tilted by `tilt` degrees away from
     the screen and then twisted by `twist` degrees in screen space.
     `speed` is radians per millisecond (negative = reverse).
     `depth` is the icon's base scale (varies for layered hierarchy). */
  const configs = [
    { radius: 124, speed:  0.00075, tilt: 72, twist:  10, start: 0.00, depth: 0.85 },
    { radius: 170, speed: -0.00055, tilt: 68, twist: -12, start: 0.95, depth: 1.00 },
    { radius: 144, speed:  0.00068, tilt: 65, twist:   5, start: 1.85, depth: 0.95 },
    { radius: 200, speed: -0.00044, tilt: 78, twist:  -7, start: 2.70, depth: 1.05 },
    { radius: 110, speed:  0.00094, tilt: 60, twist:  14, start: 3.55, depth: 0.78 },
    { radius: 218, speed: -0.00038, tilt: 75, twist:  -9, start: 4.40, depth: 1.10 },
    { radius: 160, speed:  0.00060, tilt: 70, twist:   2, start: 5.25, depth: 0.92 }
  ];

  /* Project a single orbit configuration to screen-space coordinates.
     Returns { x, y, z } in stage-center-relative pixels. */
  function project(c, angle) {
    const tA = c.tilt  * Math.PI / 180;
    const wA = c.twist * Math.PI / 180;
    const lx = Math.cos(angle) * c.radius;
    const ly = Math.sin(angle) * c.radius;
    // tilt the orbit plane around the screen X axis
    const yT = ly * Math.cos(tA);
    const zT = ly * Math.sin(tA);
    // twist around the screen Z axis
    const x  = lx * Math.cos(wA) - yT * Math.sin(wA);
    const y  = lx * Math.sin(wA) + yT * Math.cos(wA);
    return { x: x, y: y, z: zT };
  }

  let scaleFactor = 1;
  function computeScale() {
    const w = stage.clientWidth || 480;
    scaleFactor = Math.max(0.55, Math.min(1.05, w / 480));
  }
  computeScale();

  /* Reduced motion: place each icon at its starting angle and stop. */
  if (reduced) {
    orbiters.forEach((el, i) => {
      const c = configs[i] || configs[0];
      const p = project(c, c.start);
      el.style.transform = `translate3d(${p.x * scaleFactor}px, ${p.y * scaleFactor}px, 0) scale(${c.depth})`;
      el.style.zIndex    = p.z > 0 ? 6 : 1;
    });
    return;
  }

  const angles = configs.map(c => c.start);
  let mouseTx = 0, mouseTy = 0, mouseX = 0, mouseY = 0;
  let lastT = performance.now();
  let rafId = 0;
  let running = true;

  /* Scale & visibility on resize */
  if ('ResizeObserver' in window) {
    new ResizeObserver(computeScale).observe(stage);
  } else {
    window.addEventListener('resize', computeScale);
  }

  /* Mouse parallax (desktop only) */
  if (!isCoarse) {
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      mouseTx = (e.clientX - r.left - r.width  / 2) / r.width;
      mouseTy = (e.clientY - r.top  - r.height / 2) / r.height;
    };
    const onLeave = () => { mouseTx = 0; mouseTy = 0; };
    stage.addEventListener('mousemove', onMove);
    stage.addEventListener('mouseleave', onLeave);
  }

  /* Pause when stage is offscreen */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      const wasRunning = running;
      running = entry.isIntersecting;
      if (running && !wasRunning) {
        lastT = performance.now();
        rafId = requestAnimationFrame(step);
      }
    }, { threshold: 0 }).observe(stage);
  }

  /* Pre-set will-change once so the layer is promoted */
  orbiters.forEach(el => { el.style.willChange = 'transform, opacity'; });

  function step(t) {
    if (!running) return;
    const dt = Math.min(60, t - lastT);
    lastT = t;

    /* Smooth easing for parallax (inertia / lerp) */
    mouseX += (mouseTx - mouseX) * 0.07;
    mouseY += (mouseTy - mouseY) * 0.07;

    const pStr = 16; // parallax strength in pixels

    for (let i = 0; i < orbiters.length; i++) {
      const c = configs[i];
      if (!c) continue;

      /* Advance angle */
      angles[i] += c.speed * dt;
      if (angles[i] >  Math.PI * 2) angles[i] -= Math.PI * 2;
      if (angles[i] < -Math.PI * 2) angles[i] += Math.PI * 2;

      /* Project to 3D-tilted screen coords */
      const tA = c.tilt  * Math.PI / 180;
      const wA = c.twist * Math.PI / 180;
      const cosT = Math.cos(tA), sinT = Math.sin(tA);
      const cosW = Math.cos(wA), sinW = Math.sin(wA);

      const r  = c.radius * scaleFactor;
      const lx = Math.cos(angles[i]) * r;
      const ly = Math.sin(angles[i]) * r;
      const yT = ly * cosT;
      const zT = ly * sinT;
      const x  = lx * cosW - yT * sinW;
      const y  = lx * sinW + yT * cosW;
      const z  = zT;

      /* Depth-based scale: closer (z > 0) renders bigger.
         Normalized so a max-depth icon is ~1.18x and a far icon ~0.82x. */
      const depthScale = 1 + z * 0.0012;
      const finalScale = c.depth * depthScale;

      /* Opacity fade in the back */
      const depthNorm = (z + r) / (2 * r);          // 0 (far) ... 1 (near)
      const opacity   = 0.55 + depthNorm * 0.45;

      /* Parallax displacement — farther icons drift more */
      const pDep = 1 - z * 0.0018;
      const px   = mouseX * pStr * pDep;
      const py   = mouseY * pStr * pDep;

      const el = orbiters[i];
      el.style.transform = 'translate3d(' + (x + px).toFixed(2) + 'px, ' +
                           (y + py).toFixed(2) + 'px, 0) scale(' + finalScale.toFixed(3) + ')';
      el.style.opacity   = Math.max(0.32, Math.min(1, opacity)).toFixed(3);
      el.style.zIndex    = z > 0 ? 6 : 1;
    }

    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);
})();
