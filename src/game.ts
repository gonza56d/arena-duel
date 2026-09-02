/**
 * Game loop: fixed-step simulation driven by requestAnimationFrame.
 *
 * Real time is accumulated between frames and consumed in `sim.tickMs` slices
 * so the simulation is deterministic regardless of frame rate. Catch-up is
 * capped at `sim.maxTicksPerFrame` (after a tab switch the game slows instead
 * of freezing while it replays seconds of ticks).
 *
 * `advance()` is the single code path that turns elapsed time into ticks and a
 * frame; the rAF callback and the dev tuning handle both go through it.
 */
import type { ArenaViewport } from "./arena";
import { CONFIG, type GameConfig } from "./config";
import { createKeyboardInput } from "./input";
import { createRenderer, type Renderer } from "./renderer";
import type { Vec2 } from "./sim/geometry";
import { createWorld, stepWorld, type World } from "./sim/world";

export interface Game {
  world: World;
  viewport: ArenaViewport;
  /** Id of the player driven by this client's keyboard. */
  localPlayerId: number;
  /**
   * Consume `elapsedMs` of real time as fixed ticks (capped per call), moving
   * the local player along `move` (defaults to the keyboard), then draw.
   */
  advance(elapsedMs: number, move?: Vec2): void;
  stop(): void;
}

export interface GameOptions {
  seed?: number;
  config?: GameConfig;
  /** Called once per rendered frame, after simulation and drawing. */
  onFrame?: (world: World, viewport: ArenaViewport) => void;
}

export function startGame(canvas: HTMLCanvasElement, opts: GameOptions = {}): Game {
  const config = opts.config ?? CONFIG;
  const world = createWorld({ seed: opts.seed, config });
  const localPlayerId = world.players[0].id;

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
    world,
    viewport: renderer.viewport,
    localPlayerId,
    advance,
    stop(): void {
      running = false;
      input.stop();
      renderer.stop();
    },
  };
}
