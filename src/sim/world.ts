/**
 * The whole simulation state and its fixed-step update. Pure and deterministic:
 * given the same seed, config and input sequence, two runs produce identical
 * worlds. No DOM, no timers — the game loop feeds it `dtMs` slices.
 */
import { CONFIG, validateConfig, type GameConfig } from "../config";
import type { Circle, Vec2 } from "./geometry";
import { assertValidLoadout, generateLoadout, type Loadout } from "./loadout";
import { movePlayer, type Environment } from "./movement";
import { generateObstacles, type Obstacle } from "./obstacles";
import { applyDamage, createPlayer, isDead, tickHeal, type PlayerState } from "./player";
import { createRng, randomSeed } from "./rng";

export interface World {
  readonly config: GameConfig;
  readonly seed: number;
  readonly arenaSize: number;
  readonly obstacles: readonly Obstacle[];
  readonly players: PlayerState[];
  /** Simulated time elapsed, in ms. */
  timeMs: number;
  /** Number of `stepWorld` calls so far. */
  tick: number;
}

export interface PlayerInput {
  /** Desired movement direction; any magnitude, zero = idle. */
  move: Vec2;
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
    timeMs: 0,
    tick: 0,
  };
}

/**
 * Advance the world by one fixed step (`dtMs` defaults to `sim.tickMs`).
 * Living players move and collide; everyone runs the heal timer.
 */
export function stepWorld(world: World, inputs: WorldInputs = {}, dtMs: number = world.config.sim.tickMs): void {
  const { config } = world;

  for (const p of world.players) {
    if (isDead(p)) continue;
    const env: Environment = {
      arenaSize: world.arenaSize,
      obstacles: world.obstacles,
      others: collidableOthers(world, p),
    };
    const move = inputs[p.id]?.move ?? { x: 0, y: 0 };
    movePlayer(p, move, dtMs, env, config);
  }

  for (const p of world.players) {
    tickHeal(p, dtMs, config);
  }

  world.timeMs += dtMs;
  world.tick += 1;
}

/** Living players other than `self`, as collision circles. */
function collidableOthers(world: World, self: PlayerState): Circle[] {
  const out: Circle[] = [];
  for (const o of world.players) {
    if (o === self || isDead(o)) continue;
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
