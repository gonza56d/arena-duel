/**
 * A match is one game: a best-of-N series of rounds between the same players.
 *
 * The match owns what stays fixed for the whole game — above all the players'
 * loadouts, rolled once here — while every round is a fresh `World` (full HP,
 * a new obstacle layout) built from those same loadouts. Rolling a new match
 * is the only way to reroll builds; `startNextRound` never does.
 *
 * Round wins and match scoring are not tracked yet: this is the container the
 * round flow, NPC and skills work orders plug into. Everything is derived from
 * `seed`, so a match can be replayed (or shared) by exchanging one number.
 */
import { CONFIG, validateConfig, type GameConfig } from "../config";
import { generateLoadout, type Loadout } from "./loadout";
import { createRng, randomSeed, type Rng } from "./rng";
import { createWorld, type World } from "./world";

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
  };
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
