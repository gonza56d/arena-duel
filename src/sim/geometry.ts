/**
 * Geometry primitives in arena units. Pure functions, no DOM, no config.
 *
 * Collision model (design doc): players are circles; obstacles are axis-aligned
 * rectangles; the arena is a square whose edges are solid. Every resolver
 * returns the minimum translation that moves a circle out of contact, or
 * `null` when the two shapes do not overlap.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Axis-aligned rectangle given by its top-left corner and size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ZERO: Readonly<Vec2> = Object.freeze({ x: 0, y: 0 });

/**
 * Extra separation added by every resolver, in units. Without it floating-point
 * rounding can leave two shapes overlapping by ~1e-14 after a push-out, which
 * keeps them "in contact" forever. A millionth of a unit is invisible on screen.
 */
export const CONTACT_SKIN = 1e-6;

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/** Unit vector in the same direction; the zero vector stays zero. */
export function normalize(v: Vec2): Vec2 {
  const len = length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function scale(v: Vec2, k: number): Vec2 {
  return { x: v.x * k, y: v.y * k };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Centre position that keeps the whole circle inside the [0, size] square. */
export function clampCircleToSquare(c: Circle, size: number): Vec2 {
  return {
    x: clamp(c.x, c.r, size - c.r),
    y: clamp(c.y, c.r, size - c.r),
  };
}

/** True when the circle's centre lies strictly outside or on no edge of the square. */
export function circleInsideSquare(c: Circle, size: number, epsilon = 1e-9): boolean {
  return c.x - c.r >= -epsilon && c.y - c.r >= -epsilon && c.x + c.r <= size + epsilon && c.y + c.r <= size + epsilon;
}

/** Closest point on (or inside) the rectangle to the given point. */
export function closestPointOnRect(p: Vec2, rect: Rect): Vec2 {
  return {
    x: clamp(p.x, rect.x, rect.x + rect.w),
    y: clamp(p.y, rect.y, rect.y + rect.h),
  };
}

export function circleIntersectsRect(c: Circle, rect: Rect): boolean {
  const q = closestPointOnRect(c, rect);
  return distance(c, q) < c.r;
}

export function circlesIntersect(a: Circle, b: Circle): boolean {
  return distance(a, b) < a.r + b.r;
}

/** True when the two rectangles overlap or are closer than `gap` on both axes. */
export function rectsCloserThan(a: Rect, b: Rect, gap: number): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

/**
 * Minimum translation to push circle `c` out of `rect`, or `null` if they do
 * not overlap. When the centre is inside the rectangle the circle is pushed out
 * through the nearest face.
 */
export function resolveCircleRect(c: Circle, rect: Rect): Vec2 | null {
  const q = closestPointOnRect(c, rect);
  const dx = c.x - q.x;
  const dy = c.y - q.y;
  const dist = Math.hypot(dx, dy);

  if (dist >= c.r) return null;

  if (dist > 0) {
    const push = c.r - dist + CONTACT_SKIN;
    return { x: (dx / dist) * push, y: (dy / dist) * push };
  }

  // Centre is inside the rectangle: leave through the nearest face.
  const toLeft = c.x - rect.x;
  const toRight = rect.x + rect.w - c.x;
  const toTop = c.y - rect.y;
  const toBottom = rect.y + rect.h - c.y;
  const min = Math.min(toLeft, toRight, toTop, toBottom);
  const out = c.r + CONTACT_SKIN;
  if (min === toLeft) return { x: -(toLeft + out), y: 0 };
  if (min === toRight) return { x: toRight + out, y: 0 };
  if (min === toTop) return { x: 0, y: -(toTop + out) };
  return { x: 0, y: toBottom + out };
}

/**
 * Minimum translation to push circle `a` out of circle `b`, or `null` if they
 * do not overlap. Perfectly coincident centres are separated along +x.
 */
export function resolveCircleCircle(a: Circle, b: Circle): Vec2 | null {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.r + b.r;

  if (dist >= minDist) return null;
  if (dist === 0) return { x: minDist + CONTACT_SKIN, y: 0 };

  const push = minDist - dist + CONTACT_SKIN;
  return { x: (dx / dist) * push, y: (dy / dist) * push };
}

/* ----------------------------------------------------------------- angles -- */

export const TAU = Math.PI * 2;

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Angle of a vector in radians, in (-π, π]. Screen convention: y grows downwards. */
export function angleOf(v: Vec2): number {
  return Math.atan2(v.y, v.x);
}

/** Unit vector at the given angle. */
export function fromAngle(rad: number): Vec2 {
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

/** Signed smallest difference `b - a`, wrapped into [-π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/**
 * True when `point` lies within the cone of half-angle `halfAngleRad` around
 * `dir` as seen from `origin` (distance is ignored). A point at the origin
 * counts as inside.
 */
export function withinCone(origin: Vec2, dir: Vec2, halfAngleRad: number, point: Vec2): boolean {
  const to = sub(point, origin);
  if (to.x === 0 && to.y === 0) return true;
  return Math.abs(angleDiff(angleOf(dir), angleOf(to))) <= halfAngleRad + 1e-12;
}

/** Shortest distance from `p` to the segment `ab`. */
export function distancePointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  if (len2 === 0) return distance(p, a);
  const t = clamp(dot(sub(p, a), ab) / len2, 0, 1);
  return distance(p, { x: a.x + ab.x * t, y: a.y + ab.y * t });
}

/**
 * Shortest distance from `p` to a circular sector ("pie slice") with apex
 * `apex`, radius `radius`, spanning the angles from `fromRad` to `toRad`
 * (any order, |span| ≤ 2π). Zero when the point is inside the sector.
 *
 * This is exactly the region swept by a blade of length `radius` rotating
 * about the apex between the two angles, so "circle intersects the swept
 * blade" is `distancePointToSector(centre) <= circleRadius`.
 */
export function distancePointToSector(p: Vec2, apex: Vec2, fromRad: number, toRad: number, radius: number): number {
  const to = sub(p, apex);
  const d = length(to);
  const span = Math.abs(angleDiff(fromRad, toRad));
  const lo = angleDiff(fromRad, toRad) >= 0 ? fromRad : toRad;
  const hi = lo === fromRad ? toRad : fromRad;

  if (d > 0) {
    const off = angleDiff(lo, angleOf(to));
    // Inside the angular span (offset measured from the lower edge going the short way).
    if (off >= -1e-12 && off <= span + 1e-12) return Math.max(0, d - radius);
  } else {
    return 0;
  }

  const edgeA = { x: apex.x + Math.cos(lo) * radius, y: apex.y + Math.sin(lo) * radius };
  const edgeB = { x: apex.x + Math.cos(hi) * radius, y: apex.y + Math.sin(hi) * radius };
  return Math.min(distancePointToSegment(p, apex, edgeA), distancePointToSegment(p, apex, edgeB));
}

/**
 * True when circle `c` overlaps the sector (apex, centre direction `dir`,
 * half-angle, radius). Used for cone-shaped hits (Bash, Slash).
 */
export function circleIntersectsSector(c: Circle, apex: Vec2, dir: Vec2, halfAngleRad: number, radius: number): boolean {
  const a = angleOf(dir);
  return distancePointToSector(c, apex, a - halfAngleRad, a + halfAngleRad, radius) <= c.r;
}

/* ----------------------------------------------------------------- sweeps -- */

/**
 * Swept-circle tests: a circle of radius `c.r` starting at `c` moves along the
 * unit vector `dir`. Each returns the travel distance `t ≥ 0` at which contact
 * first happens (or the entry/exit pair), or `null` when the path is clear.
 * Shapes already touching at t = 0 report 0.
 */

/** Distance until the circle touches the arena edge (always finite for a non-zero dir). */
export function sweepCircleSquare(c: Circle, dir: Vec2, size: number): number {
  let t = Infinity;
  if (dir.x > 0) t = Math.min(t, (size - c.r - c.x) / dir.x);
  if (dir.x < 0) t = Math.min(t, (c.r - c.x) / dir.x);
  if (dir.y > 0) t = Math.min(t, (size - c.r - c.y) / dir.y);
  if (dir.y < 0) t = Math.min(t, (c.r - c.y) / dir.y);
  return Math.max(0, t);
}

/** Ray vs axis-aligned rectangle (slab test). Returns entry distance or null. */
export function rayRect(origin: Vec2, dir: Vec2, rect: Rect): number | null {
  let tmin = -Infinity;
  let tmax = Infinity;
  const axes: [number, number, number, number][] = [
    [origin.x, dir.x, rect.x, rect.x + rect.w],
    [origin.y, dir.y, rect.y, rect.y + rect.h],
  ];
  for (const [o, d, lo, hi] of axes) {
    if (d === 0) {
      if (o < lo || o > hi) return null;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  if (tmax < 0) return null;
  return Math.max(0, tmin);
}

/** Ray vs circle. Returns the entry and exit distances, or null when missed / entirely behind. */
export function rayCircle(origin: Vec2, dir: Vec2, circle: Circle): { entry: number; exit: number } | null {
  const oc = sub(origin, circle);
  const b = dot(oc, dir);
  const cc = dot(oc, oc) - circle.r * circle.r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const exit = -b + s;
  if (exit < 0) return null;
  return { entry: Math.max(0, -b - s), exit };
}

/**
 * Swept circle vs rectangle: exact Minkowski sum (rectangle grown by `r` with
 * rounded corners) = union of two axis-grown rectangles and four corner circles.
 */
export function sweepCircleRect(c: Circle, dir: Vec2, rect: Rect): number | null {
  const r = c.r;
  let best: number | null = null;
  const consider = (t: number | null): void => {
    if (t !== null && (best === null || t < best)) best = t;
  };
  consider(rayRect(c, dir, { x: rect.x - r, y: rect.y, w: rect.w + 2 * r, h: rect.h }));
  consider(rayRect(c, dir, { x: rect.x, y: rect.y - r, w: rect.w, h: rect.h + 2 * r }));
  for (const corner of [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h },
  ]) {
    consider(rayCircle(c, dir, { ...corner, r })?.entry ?? null);
  }
  return best;
}

/** Swept circle vs circle: entry/exit distances of the moving circle, or null. */
export function sweepCircleCircle(c: Circle, dir: Vec2, other: Circle): { entry: number; exit: number } | null {
  return rayCircle(c, dir, { x: other.x, y: other.y, r: other.r + c.r });
}
