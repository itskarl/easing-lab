export type Bezier = { kind: "bezier"; x1: number; y1: number; x2: number; y2: number; duration: number };
export type Spring = { kind: "spring"; stiffness: number; damping: number; mass: number };
export type Curve = Bezier | Spring;

/** A curve turned into something you can sample and hand to the browser. */
export type Resolved = {
  /** Progress (0..1 of the duration) → eased value. May overshoot 0..1. */
  fn: (t: number) => number;
  /** Milliseconds. For a spring, the time it takes to settle. */
  duration: number;
  /** A CSS <easing-function>: cubic-bezier() or linear(). */
  css: string;
};

export const Y_MIN = -0.5;
export const Y_MAX = 1.5;

export const round = (n: number, places = 3) => {
  const v = Number(n.toFixed(places));
  return Object.is(v, -0) ? 0 : v;
};

/* ---------- Cubic Bézier ---------- */

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  // Find the curve parameter t whose x is the given time: Newton first, bisection as a fallback.
  const solveT = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-7) return t;
      const d = slopeX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 50; i++) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveT(x)));
}

/* ---------- Spring ---------- */

/** Distance still left to travel at time t (seconds), for a spring released from rest at 0 toward 1. */
export function springRemaining({ stiffness: k, damping: c, mass: m }: Spring) {
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta < 1 - 1e-6) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return (t: number) => Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  if (zeta <= 1 + 1e-6) return (t: number) => Math.exp(-w0 * t) * (1 + w0 * t);
  const r = Math.sqrt(zeta * zeta - 1);
  const r1 = -w0 * (zeta - r), r2 = -w0 * (zeta + r);
  return (t: number) => (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
}

export const dampingRatio = (s: Spring) => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));

/** Seconds until the spring stays within 0.1% of its target. */
export function springSettle(s: Spring) {
  const rem = springRemaining(s);
  const dt = 1 / 600;
  let last = 0;
  for (let t = 0; t <= 10; t += dt) if (Math.abs(rem(t)) > 0.001) last = t;
  return Math.max(0.05, last + dt);
}

/* ---------- linear() ---------- */

type Pt = [number, number];

/** Ramer–Douglas–Peucker: drop points that sit on a straight line between their neighbours. */
function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

export function toLinear(fn: (t: number) => number, samples = 300, eps = 0.0015) {
  const pts: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    pts.push([t, fn(t)]);
  }
  const kept = simplify(pts, eps);
  const stops = kept.map(([t, v], i) =>
    i === 0 || i === kept.length - 1 ? `${round(v)}` : `${round(v)} ${round(t * 100, 2)}%`,
  );
  return `linear(${stops.join(", ")})`;
}

/* ---------- Resolve ---------- */

export function resolve(c: Curve): Resolved {
  if (c.kind === "bezier") {
    return {
      fn: cubicBezier(c.x1, c.y1, c.x2, c.y2),
      duration: c.duration,
      css: `cubic-bezier(${round(c.x1)}, ${round(c.y1)}, ${round(c.x2)}, ${round(c.y2)})`,
    };
  }
  const settle = springSettle(c);
  const rem = springRemaining(c);
  const fn = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - rem(t * settle));
  return { fn, duration: Math.round(settle * 1000), css: toLinear(fn) };
}

/* ---------- Presets ---------- */

export const bezierPresets: { name: string; v: [number, number, number, number] }[] = [
  { name: "ease", v: [0.25, 0.1, 0.25, 1] },
  { name: "ease-out", v: [0, 0, 0.58, 1] },
  { name: "ease-in-out", v: [0.42, 0, 0.58, 1] },
  { name: "snappy", v: [0.2, 0.8, 0.2, 1] },
  { name: "out-quart", v: [0.25, 1, 0.5, 1] },
  { name: "out-expo", v: [0.16, 1, 0.3, 1] },
  { name: "in-out-cubic", v: [0.65, 0, 0.35, 1] },
  { name: "back-out", v: [0.34, 1.56, 0.64, 1] },
  { name: "anticipate", v: [0.68, -0.6, 0.32, 1.6] },
  { name: "linear", v: [0, 0, 1, 1] },
];

export const springPresets: { name: string; v: [number, number, number] }[] = [
  { name: "gentle", v: [120, 18, 1] },
  { name: "snappy", v: [420, 34, 1] },
  { name: "bouncy", v: [300, 14, 1] },
  { name: "wobbly", v: [180, 8, 1] },
  { name: "heavy", v: [200, 30, 3] },
  { name: "molasses", v: [60, 22, 1] },
];

export const DEFAULT_BEZIER: Bezier = { kind: "bezier", x1: 0.2, y1: 0.8, x2: 0.2, y2: 1, duration: 600 };
export const DEFAULT_SPRING: Spring = { kind: "spring", stiffness: 300, damping: 14, mass: 1 };

export const sameCurve = (a: Curve | null, b: Curve | null) =>
  !!a && !!b && encode(a) === encode(b);

/* ---------- URL state ---------- */

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function encode(c: Curve) {
  return c.kind === "bezier"
    ? `b${[c.x1, c.y1, c.x2, c.y2].map((n) => round(n)).join(",")},${Math.round(c.duration)}`
    : `s${round(c.stiffness, 1)},${round(c.damping, 1)},${round(c.mass, 2)}`;
}

export function decode(s: string | null): Curve | null {
  if (!s) return null;
  const nums = s.slice(1).split(",").map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  if (s[0] === "b" && nums.length === 5) {
    const [x1, y1, x2, y2, d] = nums;
    return {
      kind: "bezier",
      x1: clamp(x1, 0, 1), y1: clamp(y1, Y_MIN, Y_MAX),
      x2: clamp(x2, 0, 1), y2: clamp(y2, Y_MIN, Y_MAX),
      duration: clamp(d, 50, 5000),
    };
  }
  if (s[0] === "s" && nums.length === 3) {
    const [k, c, m] = nums;
    return { kind: "spring", stiffness: clamp(k, 1, 2000), damping: clamp(c, 0.5, 200), mass: clamp(m, 0.1, 10) };
  }
  return null;
}

export function readHash(): { a: Curve | null; b: Curve | null } {
  const params = new URLSearchParams(location.hash.slice(1));
  return { a: decode(params.get("a")), b: decode(params.get("b")) };
}

export function writeHash(a: Curve, b: Curve | null) {
  const hash = `#a=${encode(a)}${b ? `&b=${encode(b)}` : ""}`;
  if (location.hash !== hash) history.replaceState(null, "", hash);
}
