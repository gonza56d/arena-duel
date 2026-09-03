/**
 * Fog of war: what one player can see of another.
 *
 * Vision is line-of-sight occluded by obstacles — "fog of war will not let you
 * see your rival if they're hidden using the obstacles" (README). A rival is
 * visible when *any* clear sight line reaches it: we test its centre plus the
 * two silhouette edges (the centre offset perpendicular to the view by its
 * radius). Sampling the silhouette rather than the centre alone means a rival is
 * shown the moment a sliver of it clears a corner, instead of popping in only
 * when its exact centre does — which reads far better in motion. A rival fully
 * behind an obstacle has every sample blocked and stays hidden.
 *
 * Pure and DOM-free like the rest of `sim/`; the renderer calls it to decide
 * whether to draw a rival, but the occlusion rule itself lives here so it can be
 * tested directly.
 */
import { normalize, segmentIntersectsRect, sub, type Rect, type Vec2 } from "./geometry";

/** A circular body that can be seen or hidden. */
export interface VisionTarget {
  pos: Vec2;
  radius: number;
}

/** True when no obstacle lies across the segment `from → to`. */
export function hasClearLine(from: Vec2, to: Vec2, obstacles: readonly Rect[]): boolean {
  for (const o of obstacles) if (segmentIntersectsRect(from, to, o)) return false;
  return true;
}

/**
 * Whether `viewer` can see `target` past `obstacles`. Visible when the centre or
 * either silhouette edge has a clear line. Coincident positions are visible.
 */
export function canSee(viewer: Vec2, target: VisionTarget, obstacles: readonly Rect[]): boolean {
  if (hasClearLine(viewer, target.pos, obstacles)) return true;

  const dir = normalize(sub(target.pos, viewer));
  if (dir.x === 0 && dir.y === 0) return true; // on top of each other
  const perp = { x: -dir.y, y: dir.x };
  const edgeA = { x: target.pos.x + perp.x * target.radius, y: target.pos.y + perp.y * target.radius };
  const edgeB = { x: target.pos.x - perp.x * target.radius, y: target.pos.y - perp.y * target.radius };
  return hasClearLine(viewer, edgeA, obstacles) || hasClearLine(viewer, edgeB, obstacles);
}

/**
 * How far (in arena units) shadow wedges are projected. Far enough that the
 * truncated far edge of every wedge lies well outside any arena, even for an
 * obstacle edge seen almost edge-on from right next to it.
 */
export const SHADOW_FAR = 100_000;

/**
 * The region of the plane `viewer` cannot see because of `obstacles`, as a
 * list of polygons — the visual dual of {@link canSee}, for drawing fog.
 *
 * Each obstacle edge that faces the viewer casts one wedge: the edge itself,
 * then its two ends (and midpoint, so the far side never cuts a corner) pushed
 * `far` units straight away from the viewer. The union of the wedges is exactly
 * the set of points with no clear line to the viewer. Every polygon is wound the
 * same way, so a canvas can fill all of them as one path under the non-zero rule
 * and get their union without double-shading overlaps.
 *
 * Edges facing away are skipped: their shadow lies inside the front edges'
 * wedges anyway. A viewer standing exactly in an edge's plane sees it edge-on
 * and it casts nothing.
 */
export function shadowPolygons(viewer: Vec2, obstacles: readonly Rect[], far = SHADOW_FAR): Vec2[][] {
  const out: Vec2[][] = [];
  for (const o of obstacles) {
    const x0 = o.x;
    const y0 = o.y;
    const x1 = o.x + o.w;
    const y1 = o.y + o.h;
    if (viewer.x < x0) pushWedge(out, viewer, { x: x0, y: y0 }, { x: x0, y: y1 }, far); // left edge
    if (viewer.x > x1) pushWedge(out, viewer, { x: x1, y: y0 }, { x: x1, y: y1 }, far); // right edge
    if (viewer.y < y0) pushWedge(out, viewer, { x: x0, y: y0 }, { x: x1, y: y0 }, far); // top edge
    if (viewer.y > y1) pushWedge(out, viewer, { x: x0, y: y1 }, { x: x1, y: y1 }, far); // bottom edge
  }
  return out;
}

function pushWedge(out: Vec2[][], viewer: Vec2, a: Vec2, b: Vec2, far: number): void {
  // Order the edge so every wedge has the same (positive) winding: the near
  // edge runs clockwise about the viewer, the far side back anticlockwise.
  const cross = (a.x - viewer.x) * (b.y - viewer.y) - (a.y - viewer.y) * (b.x - viewer.x);
  if (cross === 0) return; // edge-on: degenerate, casts no area
  if (cross > 0) [a, b] = [b, a];
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  out.push([a, b, project(viewer, b, far), project(viewer, m, far), project(viewer, a, far)]);
}

/** `p` pushed `far` units further along the ray from `viewer` through it. */
function project(viewer: Vec2, p: Vec2, far: number): Vec2 {
  const d = normalize(sub(p, viewer));
  return { x: p.x + d.x * far, y: p.y + d.y * far };
}
