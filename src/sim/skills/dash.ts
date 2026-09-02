/**
 * Dash — left shift. A fixed-duration burst (`durationMs`, regardless of the
 * `distance` stat) in the direction the player is moving, or the last
 * direction they moved when idle. The landing spot is decided at the press:
 *
 *  - Obstacles and the arena edge cannot be crossed: the dash is shortened to
 *    the point where the circle touches the first one on its path.
 *  - Other players can be dashed over. If the dash would end overlapping an
 *    enemy: when the dash distance exceeds the centre-to-centre distance the
 *    dasher lands just *behind* the enemy (or at the full distance when that
 *    is already past them); otherwise just *in front*. If an obstacle or the
 *    edge blocks the spot behind the enemy, the dasher lands in front instead.
 *
 * During the dash the player ignores movement input and player collision;
 * position is interpolated linearly so the whole distance is covered in
 * exactly `durationMs`.
 */
import {
  add,
  CONTACT_SKIN,
  distance,
  normalize,
  scale,
  sweepCircleCircle,
  sweepCircleRect,
  sweepCircleSquare,
  type Circle,
  type Vec2,
} from "../geometry";
import { isFree, type Environment } from "../movement";
import type { PlayerState } from "../player";
import type { World } from "../world";
import { isReady, startCooldown } from "./cooldowns";
import { resolveDash } from "./stats";

export interface DashState {
  dir: Vec2;
  from: Vec2;
  /** Landing point, fixed at the press. */
  to: Vec2;
  distance: number;
  elapsedMs: number;
  durationMs: number;
}

/**
 * Decide how far a dash of `wanted` units from `start` along `dir` actually
 * travels, given the solid environment and the living enemies on the field.
 * Pure: no state is touched.
 */
export function planDash(start: Vec2, radius: number, dir: Vec2, wanted: number, env: Environment): number {
  const c: Circle = { x: start.x, y: start.y, r: radius };

  // 1. Never cross an obstacle or the edge.
  let envLimit = sweepCircleSquare(c, dir, env.arenaSize);
  for (const rect of env.obstacles) {
    const t = sweepCircleRect(c, dir, rect);
    if (t !== null && t < envLimit) envLimit = t;
  }
  envLimit = Math.max(0, envLimit - CONTACT_SKIN);
  let landing = Math.min(wanted, envLimit);

  // 2. Resolve enemies the landing would overlap, nearest first.
  const enemies = env.others
    .map((o) => ({ o, hit: sweepCircleCircle(c, dir, o) }))
    .filter((e) => e.hit !== null)
    .sort((a, b) => a.hit!.entry - b.hit!.entry);

  for (const { o, hit } of enemies) {
    const { entry, exit } = hit!;
    if (entry >= landing || exit <= landing) continue; // not reached, or fully passed over
    const front = Math.max(0, entry - CONTACT_SKIN);
    const behind = exit + CONTACT_SKIN;
    const goesOver = wanted > distance(start, o);
    landing = goesOver && behind <= envLimit ? behind : front;
  }

  // 3. Safety net: a landing that still overlaps something falls back to the
  //    first free spot in front of the nearest enemy, or to not moving at all.
  const at = (t: number): Circle => ({ ...add(start, scale(dir, t)), r: radius });
  if (!isFree(at(landing), env)) {
    const first = enemies[0]?.hit;
    landing = first ? Math.max(0, first.entry - CONTACT_SKIN) : 0;
    if (!isFree(at(landing), env)) landing = 0;
  }
  return landing;
}

/** Start a dash along `moveInput` (or the last movement direction when idle). */
export function triggerDash(world: World, p: PlayerState, moveInput: Vec2, env: Environment): boolean {
  if (!isReady(p, "dash")) return false;
  const stats = resolveDash(p.loadout, world.config);
  startCooldown(p, "dash", stats.cooldownMs);

  const wanted = normalize(moveInput);
  const dir = wanted.x !== 0 || wanted.y !== 0 ? wanted : { ...p.lastMoveDir };
  const dist = planDash(p.pos, p.radius, dir, stats.distance, env);
  p.dash = {
    dir,
    from: { ...p.pos },
    to: add(p.pos, scale(dir, dist)),
    distance: dist,
    elapsedMs: 0,
    durationMs: stats.durationMs,
  };
  p.lastMoveDir = dir;
  world.events.push({ type: "skill", skill: "dash", playerId: p.id });
  return true;
}

/** Move along the planned dash; replaces normal movement while active. */
export function tickDash(p: PlayerState, dtMs: number): void {
  const d = p.dash;
  if (!d) return;
  d.elapsedMs += dtMs;
  const progress = Math.min(1, d.elapsedMs / d.durationMs);
  p.pos = progress >= 1 ? { ...d.to } : add(d.from, scale(d.dir, d.distance * progress));
  if (progress >= 1) p.dash = null;
}
