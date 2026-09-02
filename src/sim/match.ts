/**
 * A match is one game: a best-of-N series of rounds between the same players.
 *
 * The match owns what stays fixed for the whole game — above all the players'
 * loadouts, rolled once here — while every round is a fresh `World` (full HP,
 * a new obstacle layout) built from those same loadouts. Rolling a new match
 * is the only way to reroll builds; `startNextRound` never does.
 *
 * The match also tracks the series: a round ends when a player reaches 0 HP
 * (the survivor wins it; both dying in the same tick is a draw), and the match
 * is decided when a player has won a majority of rounds — `roundsToWin` — or
 * all `bestOf` rounds have been played. Everything is derived from `seed`, so a
 * match can be replayed (or shared) by exchanging one number.
 *
 * The pure round flow is:
 *   playing → `roundOutcome(world)` reports a finished round → `concludeRound`
 *   scores it and moves to `roundOver` (or `matchOver`) → `advanceRound` starts
 *   the next round and returns to `playing`.
 */
import { CONFIG, validateConfig, type GameConfig } from "../config";
import { generateLoadout, type Loadout } from "./loadout";
import { isDead } from "./player";
import { createRng, randomSeed, type Rng } from "./rng";
import { createWorld, type World } from "./world";

/**
 * Where a match is in its round flow:
 *  - `playing`: a round is in progress.
 *  - `roundOver`: a round just finished but the match is not decided; the next
 *    round has not started yet (the client shows a brief intermission here).
 *  - `matchOver`: the series is decided; no more rounds will be played.
 */
export type MatchPhase = "playing" | "roundOver" | "matchOver";

export interface Match {
  readonly config: GameConfig;
  readonly seed: number;
  /** Maximum number of rounds in this game. */
  readonly bestOf: number;
  readonly playerCount: number;
  /** Index = player id (0 the local player, 1 the rival/NPC). Fixed all game. */
  readonly loadouts: readonly Loadout[];
  /** 1-based number of the round in progress. */
  round: number;
  /** The round in progress. Replaced (not mutated) by `startNextRound`. */
  world: World;
  /** Match-level RNG: rolled the loadouts, then hands out one seed per round. */
  readonly rng: Rng;
  /** Rounds won so far, indexed by player id. */
  readonly roundsWon: number[];
  /** Current stage of the round flow. */
  phase: MatchPhase;
  /**
   * Winner of the round just concluded (`roundOver`/`matchOver` phases), or
   * `null` when that round was a draw. Meaningless while `playing`.
   */
  lastRoundWinnerId: number | null;
  /**
   * Set once `phase` is `matchOver`: the player id who won the series, or
   * `null` when the series ended level (only possible with an even `bestOf`).
   */
  matchWinnerId: number | null;
}

export interface CreateMatchOptions {
  seed?: number;
  /** One of `rounds.bestOfOptions`; defaults to the first option. */
  bestOf?: number;
  config?: GameConfig;
  /** Default 2: the local player and the rival. */
  playerCount?: number;
}

/** Start a new game: roll every player's loadout, then start round 1. */
export function createMatch(opts: CreateMatchOptions = {}): Match {
  const config = opts.config ?? CONFIG;
  validateConfig(config);

  const bestOf = opts.bestOf ?? config.rounds.bestOfOptions[0];
  if (!config.rounds.bestOfOptions.includes(bestOf)) {
    throw new Error(`Best of ${bestOf} is not offered (options: ${config.rounds.bestOfOptions.join(", ")})`);
  }

  const seed = opts.seed ?? randomSeed();
  const playerCount = opts.playerCount ?? 2;
  const rng = createRng(seed);
  const loadouts = Array.from({ length: playerCount }, () => generateLoadout(rng, config));

  return {
    config,
    seed,
    bestOf,
    playerCount,
    loadouts,
    round: 1,
    world: rollRound(rng, config, playerCount, loadouts),
    rng,
    roundsWon: Array.from({ length: playerCount }, () => 0),
    phase: "playing",
    lastRoundWinnerId: null,
    matchWinnerId: null,
  };
}

/** Rounds a player must win to take the match: a majority of `bestOf`. */
export function roundsToWin(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1;
}

/**
 * Read a round's result off its world. A round is over as soon as fewer players
 * are alive than started it; the winner is the sole survivor, or `null` when no
 * one (or more than one) is left — a draw. Returns `null` while the round is
 * still being fought.
 */
export function roundOutcome(world: World): { winnerId: number | null } | null {
  const alive = world.players.filter((p) => !isDead(p));
  if (alive.length === world.players.length) return null;
  return { winnerId: alive.length === 1 ? alive[0].id : null };
}

/**
 * Score the round in progress and advance the match phase. Call exactly once
 * per finished round, with the winner id from {@link roundOutcome} (`null` for
 * a draw). The match becomes `matchOver` when a player reaches `roundsToWin` or
 * every `bestOf` round has been played; otherwise it becomes `roundOver`.
 */
export function concludeRound(match: Match, winnerId: number | null): void {
  if (match.phase !== "playing") throw new Error(`Cannot conclude a round while ${match.phase}`);
  match.lastRoundWinnerId = winnerId;
  if (winnerId !== null) match.roundsWon[winnerId] += 1;

  const target = roundsToWin(match.bestOf);
  const decided = match.roundsWon.some((w) => w >= target);
  if (decided || match.round >= match.bestOf) {
    match.phase = "matchOver";
    match.matchWinnerId = leaderId(match.roundsWon);
  } else {
    match.phase = "roundOver";
  }
}

/**
 * Start the next round of a match sitting in `roundOver`: a fresh world (new
 * layout, full HP, same loadouts) and back to `playing`. Throws if the match is
 * not waiting between rounds.
 */
export function advanceRound(match: Match): World {
  if (match.phase !== "roundOver") throw new Error(`Cannot advance a round while ${match.phase}`);
  match.phase = "playing";
  match.lastRoundWinnerId = null;
  return startNextRound(match);
}

/** Id of the strict leader in a rounds-won tally, or `null` when it is level. */
function leaderId(roundsWon: readonly number[]): number | null {
  let best = -1;
  let bestId = -1;
  let tied = false;
  roundsWon.forEach((w, id) => {
    if (w > best) {
      best = w;
      bestId = id;
      tied = false;
    } else if (w === best) {
      tied = true;
    }
  });
  return tied ? null : bestId;
}

/**
 * Begin the next round: a new world with a fresh layout and full HP, the same
 * loadouts. Throws once every round of the series has been played.
 */
export function startNextRound(match: Match): World {
  if (match.round >= match.bestOf) {
    throw new Error(`Match is over: all ${match.bestOf} rounds have been played`);
  }
  match.round += 1;
  match.world = rollRound(match.rng, match.config, match.playerCount, match.loadouts);
  return match.world;
}

function rollRound(rng: Rng, config: GameConfig, playerCount: number, loadouts: readonly Loadout[]): World {
  return createWorld({ seed: rng.int(0, 0xffffffff), config, playerCount, loadouts });
}
