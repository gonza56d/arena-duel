/**
 * The whole simulation state and its fixed-step update. Pure and deterministic:
 * given the same seed, config and input sequence, two runs produce identical
 * worlds. No DOM, no timers — the game loop feeds it `dtMs` slices.
 */
import { CONFIG, validateConfig, type GameConfig } from "../config";
import type { WorldEvent } from "./events";
import { normalize, sub, type Circle, type Vec2 } from "./geometry";
import { assertValidLoadout, generateLoadout, type Loadout } from "./loadout";
import { movePlayer, type Environment } from "./movement";
import { generateObstacles, type Obstacle } from "./obstacles";
import { applyDamage, createPlayer, isDead, tickHeal, tickSlow, type PlayerState } from "./player";
import { createRng, randomSeed } from "./rng";
import { NO_TRIGGERS, stepProjectiles, tickPlayerSkills, tickShields, triggerSkills, type SkillTriggers } from "./skills";
import { tickCooldowns } from "./skills/cooldowns";
import { tickDash } from "./skills/dash";
import type { Projectile } from "./skills/shot";

export interface World {
  readonly config: GameConfig;
  readonly seed: number;
  readonly arenaSize: number;
  readonly obstacles: readonly Obstacle[];
  readonly players: PlayerState[];
  /** Bullets in flight. */
  readonly projectiles: Projectile[];
  /** What happened during the last tick (cleared at the start of each step). */
  readonly events: WorldEvent[];
  /** Simulated time elapsed, in ms. */
  timeMs: number;
  /** Number of `stepWorld` calls so far. */
  tick: number;
}

export interface PlayerInput {
  /** Desired movement direction; any magnitude, zero = idle. */
  move: Vec2;
  /** Pointer position in arena units; sets the aim direction. Omit to keep the last aim. */
  aim?: Vec2;
  /** Skills pressed this tick. */
  skills?: SkillTriggers;
}

/** Inputs keyed by player id; players without an entry stand still. */
export type WorldInputs = Partial<Record<number, PlayerInput>>;

export interface CreateWorldOptions {
  seed?: number;
  config?: GameConfig;
  /** Players to spawn (uses the first N config spawn points). Default 2. */
  playerCount?: number;
  /**
   * One loadout per player (index = player id), normally fixed by the match
   * so every round shares them. When omitted, each player gets a random valid
   * build rolled from the world seed (after the obstacles, so a seed's layout
   * is the same either way).
   */
  loadouts?: readonly Loadout[];
}

export function createWorld(opts: CreateWorldOptions = {}): World {
  const config = opts.config ?? CONFIG;
  validateConfig(config);

  const seed = opts.seed ?? randomSeed();
  const playerCount = opts.playerCount ?? 2;
  if (playerCount > config.arena.spawnPoints.length) {
    throw new Error(`Cannot spawn ${playerCount} players with ${config.arena.spawnPoints.length} spawn points`);
  }

  const rng = createRng(seed);
  const obstacles = generateObstacles(rng, config);

  const loadouts = opts.loadouts ?? Array.from({ length: playerCount }, () => generateLoadout(rng, config));
  if (loadouts.length < playerCount) {
    throw new Error(`Cannot spawn ${playerCount} players with ${loadouts.length} loadouts`);
  }

  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    assertValidLoadout(loadouts[i], config);
    players.push(createPlayer(i, config.arena.spawnPoints[i], loadouts[i], config));
  }

  return {
    config,
    seed,
    arenaSize: config.arena.size,
    obstacles,
    players,
    projectiles: [],
    events: [],
    timeMs: 0,
    tick: 0,
  };
}

/**
 * Advance the world by one fixed step (`dtMs` defaults to `sim.tickMs`).
 *
 * Order within a tick:
 *  1. aim, cooldown and slow timers, then skill triggers (a skill pressed this
 *     tick starts now);
 *  2. movement (a dashing player follows its dash instead of its input);
 *  3. skill timelines (wind-ups complete, blades sweep, bullets spawn),
 *     projectiles (sweep against edges, obstacles, players), then shields;
 *  4. passive heal timer.
 */
export function stepWorld(world: World, inputs: WorldInputs = {}, dtMs: number = world.config.sim.tickMs): void {
  const { config } = world;
  world.events.length = 0;

  for (const p of world.players) {
    if (isDead(p)) continue;
    const input = inputs[p.id];
    if (input?.aim) updateAim(p, input.aim);
    tickCooldowns(p, dtMs);
    tickSlow(p, dtMs);
    const triggers = input?.skills ?? NO_TRIGGERS;
    if (triggers !== NO_TRIGGERS) {
      triggerSkills(world, p, triggers, input?.move ?? { x: 0, y: 0 }, environmentFor(world, p));
    }
  }

  for (const p of world.players) {
    if (isDead(p)) continue;
    const env = environmentFor(world, p);
    if (p.dash) {
      tickDash(p, dtMs);
    } else {
      const move = inputs[p.id]?.move ?? { x: 0, y: 0 };
      movePlayer(p, move, dtMs, env, config);
    }
  }

  for (const p of world.players) {
    if (isDead(p)) continue;
    tickPlayerSkills(world, p, dtMs);
  }
  stepProjectiles(world, dtMs);
  tickShields(world, dtMs);

  for (const p of world.players) {
    tickHeal(p, dtMs, config);
  }

  world.timeMs += dtMs;
  world.tick += 1;
}

/** Point the player at an arena position; a pointer on the centre keeps the last aim. */
function updateAim(p: PlayerState, aim: Vec2): void {
  const dir = normalize(sub(aim, p.pos));
  if (dir.x !== 0 || dir.y !== 0) p.aimDir = dir;
}

/** Everything solid `p` can collide with right now. */
export function environmentFor(world: World, p: PlayerState): Environment {
  return {
    arenaSize: world.arenaSize,
    obstacles: world.obstacles,
    others: collidableOthers(world, p),
  };
}

/** Living players other than `self`. */
export function livingOthers(world: World, self: PlayerState): PlayerState[] {
  return world.players.filter((o) => o !== self && !isDead(o));
}

/**
 * Living players other than `self`, as collision circles. A dashing player is
 * "in the air": it is left out so it passes over others instead of shoving them.
 */
function collidableOthers(world: World, self: PlayerState): Circle[] {
  const out: Circle[] = [];
  for (const o of world.players) {
    if (o === self || isDead(o) || o.dash) continue;
    out.push({ x: o.pos.x, y: o.pos.y, r: o.radius });
  }
  return out;
}

/** Deal integer damage to a player by id. Returns the resulting HP. */
export function damagePlayer(world: World, playerId: number, amount: number): number {
  const p = world.players.find((x) => x.id === playerId);
  if (!p) throw new Error(`No player with id ${playerId}`);
  return applyDamage(p, amount, world.config);
}
