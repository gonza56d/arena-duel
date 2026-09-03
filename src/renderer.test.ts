import { describe, expect, it } from "vitest";
import { ArenaViewport } from "./arena";
import { CONFIG } from "./config";
import { hpBarLayout } from "./renderer";

/**
 * Only the pure geometry of the floating HP bar is tested here; the canvas
 * drawing itself is verified by eye. The bar is gated on fog by construction
 * (it is drawn inside the same `visible` loop as the body) — see vision.test.ts
 * for the sight rule.
 */
const MAX_HP = CONFIG.player.maxHp;
const RADIUS = CONFIG.player.radius;

function viewportOf(cssSize: number): ArenaViewport {
  const v = new ArenaViewport();
  v.resize(cssSize, cssSize);
  return v;
}

const body = (hp: number, pos = { x: 1000, y: 1200 }) => ({ pos, radius: RADIUS, hp });

describe("hpBarLayout", () => {
  it("sits centred above the body, clear of the circle", () => {
    const vp = viewportOf(2100); // 1 unit = 1 px, so units and px coincide
    const bar = hpBarLayout(body(MAX_HP), MAX_HP, vp);
    expect(bar.x + bar.w / 2).toBeCloseTo(1000);
    expect(bar.y + bar.h).toBeLessThan(1200 - RADIUS); // bottom edge above the top of the body
    expect(bar.w).toBeGreaterThan(RADIUS * 2); // wider than the body, easy to read
  });

  it("follows the body as it moves", () => {
    const vp = viewportOf(2100);
    const a = hpBarLayout(body(MAX_HP, { x: 300, y: 300 }), MAX_HP, vp);
    const b = hpBarLayout(body(MAX_HP, { x: 500, y: 250 }), MAX_HP, vp);
    expect(b.x - a.x).toBeCloseTo(200);
    expect(b.y - a.y).toBeCloseTo(-50);
    expect(b.w).toBe(a.w);
    expect(b.h).toBe(a.h);
  });

  it("scales and offsets with the viewport like every other element", () => {
    const big = viewportOf(2100);
    const small = viewportOf(1050); // half the scale, no letterbox
    const a = hpBarLayout(body(MAX_HP), MAX_HP, big);
    const b = hpBarLayout(body(MAX_HP), MAX_HP, small);
    expect(b.w).toBeCloseTo(a.w / 2);
    expect(b.h).toBeCloseTo(a.h / 2);
    expect(b.x + b.w / 2).toBeCloseTo((a.x + a.w / 2) / 2);
    expect(b.y + b.h).toBeCloseTo((a.y + a.h) / 2);

    // A letterboxed canvas shifts the bar by the same offset the viewport applies.
    const wide = new ArenaViewport();
    wide.resize(3100, 2100); // 500 px of letterbox on each side
    const c = hpBarLayout(body(MAX_HP), MAX_HP, wide);
    expect(c.x).toBeCloseTo(a.x + 500);
    expect(c.y).toBeCloseTo(a.y);
  });

  it("never collapses below the legibility floor on a tiny canvas", () => {
    const tiny = viewportOf(100); // scale ≈ 0.048 → the body is ~1 px
    const bar = hpBarLayout(body(MAX_HP), MAX_HP, tiny);
    expect(bar.h).toBeGreaterThanOrEqual(3);
  });

  it("fills in proportion to live HP, clamped to the bar", () => {
    const vp = viewportOf(2100);
    expect(hpBarLayout(body(MAX_HP), MAX_HP, vp).fraction).toBe(1);
    expect(hpBarLayout(body(3), MAX_HP, vp).fraction).toBeCloseTo(3 / MAX_HP);
    expect(hpBarLayout(body(0), MAX_HP, vp).fraction).toBe(0);
    expect(hpBarLayout(body(-4), MAX_HP, vp).fraction).toBe(0); // overkill is not clamped in the sim
    expect(hpBarLayout(body(MAX_HP + 2), MAX_HP, vp).fraction).toBe(1);
  });
});
