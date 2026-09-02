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
