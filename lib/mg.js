// Injected into every clip by the render and check scripts. Clips call MG.clip() once.
// Every helper is a pure function of its inputs, so a frame depends only on t.
(() => {
  const FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  const MG = {
    // spec: { width, height, fps, duration, alpha, brand }. defaults: the clip's placeholder text.
    // Returns the data for this render: defaults overridden by the batch row, if any.
    clip(spec, defaults = {}) {
      const { width, height, fps, duration, alpha } = spec;
      const brand = spec.brand ?? MG.brandVar('--brand');
      if (!FPS.includes(fps)) throw new Error(`fps must be one of ${FPS.join(', ')}; got ${fps}`);
      if (width % 2 || height % 2) throw new Error(`width and height must be even; got ${width}x${height}`);
      if (!(duration > 0)) throw new Error(`duration must be above 0; got ${duration}`);
      window.CLIP = { width, height, fps, duration, alpha: !!alpha, brand, defaults };
      document.documentElement.style.width = width + 'px';
      document.documentElement.style.height = height + 'px';
      return Object.assign({}, defaults, window.__MG_DATA__ || {});
    },

    // A string custom property from the brand block, without quotes. '' when unset.
    brandVar(name) {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim().replace(/^["']|["']$/g, '');
    },
    // Path of the brand logo copied in by apply-brand, or '' when the kit has none.
    logo() {
      return MG.brandVar('--logo-src');
    },

    clamp,
    lerp: (a, b, p) => a + (b - a) * p,
    // Progress 0..1 of an action that starts at t0 and lasts d seconds.
    prog: (t, t0, d) => clamp((t - t0) / d),
    ease: {
      linear: p => p,
      inCubic: p => p * p * p,
      outCubic: p => 1 - Math.pow(1 - p, 3),
      inOutCubic: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
      outExpo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
      inExpo: p => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10)),
      outBack: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
    },
    // Damped spring from a to b starting at t0. Closed form, so seeking is exact.
    // stiffness: higher is faster. damping: 1 = no overshoot, lower = more bounce.
    spring(t, t0, a, b, { stiffness = 14, damping = 0.55 } = {}) {
      const x = t - t0;
      if (x <= 0) return a;
      const w = stiffness, z = Math.min(damping, 0.999), wd = w * Math.sqrt(1 - z * z);
      const env = Math.exp(-z * w * x);
      const p = 1 - env * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
      return a + (b - a) * p;
    },
    // Seeded random numbers: MG.rand(seed)() gives the same sequence every time.
    rand(seed) {
      let s = typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761), 1) : seed | 0;
      return () => {
        s = (s + 0x6D2B79F5) | 0;
        let r = Math.imul(s ^ (s >>> 15), 1 | s);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      };
    },
  };
  window.MG = MG;
})();
