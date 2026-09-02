/**
 * Game loop: fixed-step simulation driven by requestAnimationFrame.
 *
 * Real time is accumulated between frames and consumed in `sim.tickMs` slices
 * so the simulation is deterministic regardless of frame rate. Catch-up is
 * capped at `sim.maxTicksPerFrame` (after a tab switch the game slows instead
 * of freezing while it replays seconds of ticks).
 *
 * The loop drives a `Match` (one best-of-N game): the match owns the players'
 * loadouts for the whole game and swaps in a fresh `World` per round, so the
 * loop always simulates and draws `match.world`. `newGame()` is the only thing
 * that rerolls loadouts; `nextRound()` keeps them.
 *
 * `advance()` is the single code path that turns elapsed time into ticks and a
 * frame; the rAF callback and the dev tuning handle both go through it.
 */
import type { ArenaViewport } from "./arena";
import { CONFIG, type GameConfig } from "./config";
import { createKeyboardInput } from "./input";
import { createRenderer, type Renderer } from "./renderer";
import type { Vec2 } from "./sim/geometry";
import { createMatch, startNextRound, type Match } from "./sim/match";
import { stepWorld, type World } from "./sim/world";

export interface Game {
  /** The game in progress; replaced by `newGame()`. */
  readonly match: Match;
  /** The round in progress (`match.world`); replaced by `nextRound()`. */
  readonly world: World;
  viewport: ArenaViewport;
  /** Id of the player driven by this client's keyboard. */
  localPlayerId: number;
  /**
   * Consume `elapsedMs` of real time as fixed ticks (capped per call), moving
   * the local player along `move` (defaults to the keyboard), then draw.
   */
  advance(elapsedMs: number, move?: Vec2): void;
  /** Start the next round of the current game: new layout, same loadouts. */
  nextRound(): World;
  /** Start a whole new game (same best-of): both loadouts are rerolled. */
  newGame(seed?: number): Match;
  stop(): void;
}

export interface GameOptions {
  seed?: number;
  /** One of `rounds.bestOfOptions`; defaults to the first. */
  bestOf?: number;
  config?: GameConfig;
  /** Called once per rendered frame, after simulation and drawing. */
  onFrame?: (world: World, viewport: ArenaViewport) => void;
}

export function startGame(canvas: HTMLCanvasElement, opts: GameOptions = {}): Game {
  const config = opts.config ?? CONFIG;
  let match = createMatch({ seed: opts.seed, bestOf: opts.bestOf, config });
  const localPlayerId = match.world.players[0].id;

  const renderer: Renderer = createRenderer(canvas);
  const input = createKeyboardInput(window);

  const tickMs = config.sim.tickMs;
  const maxTicks = config.sim.maxTicksPerFrame;

  let running = true;
  let last = performance.now();
  let accumulator = 0;

  function advance(elapsedMs: number, move: Vec2 = input.direction()): void {
    // Drop time we cannot catch up on rather than spiralling.
    accumulator = Math.min(accumulator + elapsedMs, tickMs * maxTicks);

    const world = match.world;
    const inputs = { [localPlayerId]: { move } };
    while (accumulator >= tickMs) {
      stepWorld(world, inputs, tickMs);
      accumulator -= tickMs;
    }

    renderer.draw(world);
    opts.onFrame?.(world, renderer.viewport);
  }

  function frame(now: number): void {
    if (!running) return;
    advance(now - last);
    last = now;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    get match(): Match {
      return match;
    },
    get world(): World {
      return match.world;
    },
    viewport: renderer.viewport,
    localPlayerId,
    advance,
    nextRound(): World {
      accumulator = 0;
      return startNextRound(match);
    },
    newGame(seed?: number): Match {
      accumulator = 0;
      match = createMatch({ seed, bestOf: match.bestOf, config });
      return match;
    },
    stop(): void {
      running = false;
      input.stop();
      renderer.stop();
    },
  };
}
