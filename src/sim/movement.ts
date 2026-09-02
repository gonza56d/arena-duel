/**
 * Movement and collision resolution for one player circle.
 *
 * Movement is 2D in any direction at a constant speed: the raw input vector is
 * normalised so diagonals are not faster, then the circle is displaced by
 * `speed × dt` and pushed out of anything it overlaps (other players,
 * obstacles, arena edges). Pushing out along the contact normal leaves the
 * tangential component intact, which gives natural sliding along walls.
 */
import { CONFIG, moveSpeedUnitsPerMs, type GameConfig } from "../config";
import {
  add,
  circleInsideSquare,
  circleIntersectsRect,
  circlesIntersect,
  clampCircleToSquare,
  normalize,
  resolveCircleCircle,
  resolveCircleRect,
  scale,
  type Circle,
  type Rect,
  type Vec2,
} from "./geometry";
import { speedMultiplier, type PlayerState } from "./player";

/** Everything solid a moving circle can collide with. */
export interface Environment {
  arenaSize: number;
  obstacles: readonly Rect[];
  /** Other collidable circles (e.g. the rival). Must not include the mover. */
  others: readonly Circle[];
}

/** Distance covered in `dtMs` at the configured movement speed. */
export function moveDistance(dtMs: number, cfg: GameConfig = CONFIG): number {
  return moveSpeedUnitsPerMs(cfg) * dtMs;
}

/**
 * Move `p` by its input for `dtMs`, then resolve collisions. `input` is any
 * vector; only its direction matters (zero = stand still, but collisions are
 * still resolved so the circle is never left overlapping something). An active
 * slow effect scales the distance covered.
 *
 * Invariant: a player that starts a tick in a free spot ends it in a free spot.
 * If the iterative resolver cannot settle (e.g. wedged between the arena edge
 * and the rival), the move is cancelled and the player keeps its last position.
 */
export function movePlayer(
  p: PlayerState,
  input: Vec2,
  dtMs: number,
  env: Environment,
  cfg: GameConfig = CONFIG,
): void {
  const before = p.pos;
  let target = before;

  const dir = normalize(input);
  if (dir.x !== 0 || dir.y !== 0) {
    p.lastMoveDir = dir;
    target = add(before, scale(dir, moveDistance(dtMs, cfg) * speedMultiplier(p)));
  }

  const resolved = resolvePosition({ x: target.x, y: target.y, r: p.radius }, env, cfg);
  if (isFree({ ...resolved, r: p.radius }, env) || !isFree({ ...before, r: p.radius }, env)) {
    p.pos = resolved;
  } else {
    p.pos = before;
  }
}

/** True when the circle overlaps nothing solid and lies inside the arena. */
export function isFree(c: Circle, env: Environment): boolean {
  if (!circleInsideSquare(c, env.arenaSize)) return false;
  for (const rect of env.obstacles) if (circleIntersectsRect(c, rect)) return false;
  for (const other of env.others) if (circlesIntersect(c, other)) return false;
  return true;
}

/**
 * Push a circle out of every solid it overlaps and clamp it inside the arena.
 * Runs up to `sim.collisionIterations` passes so corner cases (pushed out of an
 * obstacle into another) settle. The final clamp guarantees the circle never
 * leaves the arena regardless of what the other passes did.
 */
export function resolvePosition(c: Circle, env: Environment, cfg: GameConfig = CONFIG): Vec2 {
  let pos: Vec2 = clampCircleToSquare(c, env.arenaSize);

  for (let i = 0; i < cfg.sim.collisionIterations; i++) {
    let moved = false;
    const cur: Circle = { x: pos.x, y: pos.y, r: c.r };

    for (const rect of env.obstacles) {
      const mtv = resolveCircleRect(cur, rect);
      if (mtv) {
        cur.x += mtv.x;
        cur.y += mtv.y;
        moved = true;
      }
    }
    for (const other of env.others) {
      const mtv = resolveCircleCircle(cur, other);
      if (mtv) {
        cur.x += mtv.x;
        cur.y += mtv.y;
        moved = true;
      }
    }

    const clamped = clampCircleToSquare(cur, env.arenaSize);
    if (clamped.x !== cur.x || clamped.y !== cur.y) moved = true;
    pos = clamped;

    if (!moved) break;
  }

  return pos;
}
