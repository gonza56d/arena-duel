/**
 * Arena geometry and the coordinate mapping between arena units and screen
 * pixels.
 *
 * The arena is a fixed square measured in abstract "units". It is larger than
 * any supported viewport, so the client never renders 1 unit = 1 px: instead it
 * fits the whole arena into the available canvas and derives a `scale`
 * (px per unit). Every later renderer (players, skills, fog, obstacles) should
 * convert through an `ArenaViewport` so world logic stays in units and only the
 * pixels change with the window.
 */

import { CONFIG, type Point } from "./config";

/**
 * Side of the square arena in units. Sourced from the central tuning config —
 * change `CONFIG.arena.size`, never this line.
 */
export const ARENA_SIZE = CONFIG.arena.size;

export type { Point };

/**
 * Maps arena-space (0..ARENA_SIZE on each axis) to canvas CSS pixels and back.
 *
 * The arena is fitted into the canvas box while preserving its 1:1 aspect
 * ratio; any leftover space becomes a symmetric letterbox captured by `offset`.
 * Coordinates here are CSS pixels relative to the canvas's top-left corner
 * (i.e. what you get from `event.offsetX/Y`), independent of devicePixelRatio.
 */
export class ArenaViewport {
  /** Pixels per arena unit. */
  scale = 1;
  /** Letterbox offset (CSS px) of the arena's top-left inside the canvas. */
  offset: Point = { x: 0, y: 0 };

  private cssWidth = 0;
  private cssHeight = 0;

  /**
   * Recompute scale and letterbox for a canvas of the given CSS size.
   * Call whenever the canvas box changes (resize).
   */
  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    // Fit the whole square arena: the limiting axis sets the scale.
    this.scale = Math.min(cssWidth, cssHeight) / ARENA_SIZE;
    const drawn = ARENA_SIZE * this.scale;
    this.offset = {
      x: (cssWidth - drawn) / 2,
      y: (cssHeight - drawn) / 2,
    };
  }

  /** Length in arena units → length in CSS pixels. */
  unitsToPixels(units: number): number {
    return units * this.scale;
  }

  /** Length in CSS pixels → length in arena units. */
  pixelsToUnits(pixels: number): number {
    return pixels / this.scale;
  }

  /** Arena point (units) → canvas point (CSS px). */
  arenaToScreen(x: number, y: number): Point {
    return {
      x: this.offset.x + x * this.scale,
      y: this.offset.y + y * this.scale,
    };
  }

  /** Canvas point (CSS px, e.g. mouse offset) → arena point (units). */
  screenToArena(px: number, py: number): Point {
    return {
      x: (px - this.offset.x) / this.scale,
      y: (py - this.offset.y) / this.scale,
    };
  }

  /** True when the arena point lies inside the arena square. */
  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x <= ARENA_SIZE && y <= ARENA_SIZE;
  }

  /** Drawn size of the arena square in CSS px (after fitting). */
  get drawnSize(): number {
    return ARENA_SIZE * this.scale;
  }

  get canvasCssWidth(): number {
    return this.cssWidth;
  }

  get canvasCssHeight(): number {
    return this.cssHeight;
  }
}
