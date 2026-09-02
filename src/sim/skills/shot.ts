/**
 * Shot — the gun. After `windupMs` a round bullet (half the player's width)
 * leaves the player's centre towards where the pointer was at the press and
 * flies at a fixed speed (one arena side per `travelArenaSideMs`) until it
 * touches the arena edge, an obstacle or a living player other than its
 * owner — whichever comes first along its path — or exhausts its `range`.
 *
 * Each tick the bullet is swept (not point-sampled) against everything solid,
 * so it can never tunnel through a thin obstacle or a fast-moving player.
 */
import { add, scale, sweepCircleCircle, sweepCircleRect, sweepCircleSquare, type Circle, type Vec2 } from "../geometry";
import { isDead, type PlayerState } from "../player";
import type { World } from "../world";
import { dealDamage } from "./combat";
import { isReady, startCooldown } from "./cooldowns";
import { resolveShot } from "./stats";

export interface ShotState {
  /** Bullet direction, locked at the press. */
  dir: Vec2;
  elapsedMs: number;
  windupMs: number;
}

export interface Projectile {
  id: number;
  ownerId: number;
  pos: Vec2;
  dir: Vec2;
  radius: number;
  /** Units per millisecond. */
  speed: number;
  damage: number;
  travelled: number;
  range: number;
  /**
   * When the wind-up ended part-way through a tick, the bullet flies only the
   * remainder of that tick on its first step; null afterwards.
   */
  firstStepMs: number | null;
}

let nextProjectileId = 1;

export function triggerShot(world: World, p: PlayerState): boolean {
  if (!isReady(p, "shot")) return false;
  const stats = resolveShot(p.levels, world.config);
  startCooldown(p, "shot", stats.cooldownMs);
  p.shot = { dir: { ...p.aimDir }, elapsedMs: 0, windupMs: stats.windupMs };
  world.events.push({ type: "skill", skill: "shot", playerId: p.id });
  return true;
}

/** Advance the wind-up; when it completes, spawn the bullet at the player's centre. */
export function tickShot(world: World, p: PlayerState, dtMs: number): void {
  const s = p.shot;
  if (!s) return;
  s.elapsedMs += dtMs;
  if (s.elapsedMs < s.windupMs) return;

  const stats = resolveShot(p.levels, world.config);
  world.projectiles.push({
    id: nextProjectileId++,
    ownerId: p.id,
    pos: { x: p.pos.x, y: p.pos.y },
    dir: { ...s.dir },
    radius: stats.bulletRadius,
    speed: stats.speed,
    damage: stats.damage,
    travelled: 0,
    range: stats.range,
    firstStepMs: s.elapsedMs - s.windupMs,
  });
  p.shot = null;
}

/** Move every bullet, resolving the first thing each one touches. */
export function stepProjectiles(world: World, dtMs: number): void {
  for (const b of [...world.projectiles]) {
    const stepMs = b.firstStepMs ?? dtMs;
    b.firstStepMs = null;
    stepProjectile(world, b, stepMs);
  }
}

function stepProjectile(world: World, b: Projectile, stepMs: number): void {
  const maxDist = Math.min(b.speed * stepMs, b.range - b.travelled);
  const circle: Circle = { x: b.pos.x, y: b.pos.y, r: b.radius };

  let t = maxDist;
  let reason: "edge" | "obstacle" | "player" | "range" | null = b.travelled + maxDist >= b.range ? "range" : null;
  let victim: PlayerState | null = null;

  const edge = sweepCircleSquare(circle, b.dir, world.arenaSize);
  if (edge < t) {
    t = edge;
    reason = "edge";
  }
  for (const o of world.obstacles) {
    const hit = sweepCircleRect(circle, b.dir, o);
    if (hit !== null && hit < t) {
      t = hit;
      reason = "obstacle";
    }
  }
  for (const p of world.players) {
    if (p.id === b.ownerId || isDead(p)) continue;
    const hit = sweepCircleCircle(circle, b.dir, { x: p.pos.x, y: p.pos.y, r: p.radius });
    if (hit && hit.entry < t) {
      t = hit.entry;
      reason = "player";
      victim = p;
    }
  }

  b.pos = add(b.pos, scale(b.dir, t));
  b.travelled += t;
  if (reason === null) return;

  if (victim) {
    const owner = world.players.find((p) => p.id === b.ownerId);
    if (owner) dealDamage(world, "shot", owner, victim, b.damage, b.pos);
  }
  world.events.push({ type: "bulletStop", ownerId: b.ownerId, reason, pos: { x: b.pos.x, y: b.pos.y } });
  world.projectiles.splice(world.projectiles.indexOf(b), 1);
}
