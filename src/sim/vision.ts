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
