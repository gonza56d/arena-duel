import { describe, expect, it } from "vitest";
import {
  circleInsideSquare,
  circleIntersectsRect,
  clampCircleToSquare,
  normalize,
  rectsCloserThan,
  resolveCircleCircle,
  resolveCircleRect,
} from "./geometry";

describe("normalize", () => {
  it("returns a unit vector", () => {
    const v = normalize({ x: 3, y: 4 });
    expect(v.x).toBeCloseTo(0.6);
    expect(v.y).toBeCloseTo(0.8);
  });

  it("keeps the zero vector at zero", () => {
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("clampCircleToSquare", () => {
  it("keeps the whole circle inside", () => {
    expect(clampCircleToSquare({ x: -10, y: 5000, r: 25 }, 2100)).toEqual({ x: 25, y: 2075 });
    expect(circleInsideSquare({ x: 25, y: 2075, r: 25 }, 2100)).toBe(true);
    expect(circleInsideSquare({ x: 24, y: 2075, r: 25 }, 2100)).toBe(false);
  });
});

describe("resolveCircleRect", () => {
  it("leaves the shapes strictly apart after the push (no residual contact)", () => {
    const c = { x: 1190, y: 790, r: 25 };
    const rect = { x: 1200, y: 800, w: 100, h: 400 };
    const mtv = resolveCircleRect(c, rect)!;
    const moved = { x: c.x + mtv.x, y: c.y + mtv.y, r: c.r };
    expect(circleIntersectsRect(moved, rect)).toBe(false);
    expect(resolveCircleRect(moved, rect)).toBeNull();
  });

  const rect = { x: 100, y: 100, w: 200, h: 100 };

  it("returns null when apart", () => {
    expect(resolveCircleRect({ x: 50, y: 50, r: 25 }, rect)).toBeNull();
    expect(resolveCircleRect({ x: 75, y: 150, r: 25 }, rect)).toBeNull(); // touching counts as apart
  });

  it("pushes out through a face", () => {
    const mtv = resolveCircleRect({ x: 90, y: 150, r: 25 }, rect)!;
    expect(mtv.x).toBeCloseTo(-15);
    expect(mtv.y).toBeCloseTo(0);
  });

  it("pushes out diagonally at a corner", () => {
    const mtv = resolveCircleRect({ x: 90, y: 90, r: 25 }, rect)!;
    // Closest point is the corner (100,100); distance √200 ≈ 14.14; push 25 − 14.14 along (−1,−1)/√2.
    expect(mtv.x).toBeCloseTo(-(25 - Math.SQRT2 * 10) / Math.SQRT2);
    expect(mtv.y).toBeCloseTo(mtv.x);
  });

  it("pushes a circle whose centre is inside out through the nearest face", () => {
    const mtv = resolveCircleRect({ x: 110, y: 150, r: 25 }, rect)!;
    expect(mtv.x).toBeCloseTo(-(10 + 25));
    expect(mtv.y).toBe(0);
    const mtv2 = resolveCircleRect({ x: 200, y: 190, r: 25 }, rect)!;
    expect(mtv2.x).toBe(0);
    expect(mtv2.y).toBeCloseTo(10 + 25);
  });
});

describe("resolveCircleCircle", () => {
  it("returns null when apart or touching", () => {
    expect(resolveCircleCircle({ x: 0, y: 0, r: 25 }, { x: 50, y: 0, r: 25 })).toBeNull();
    expect(resolveCircleCircle({ x: 0, y: 0, r: 25 }, { x: 80, y: 0, r: 25 })).toBeNull();
  });

  it("pushes the first circle away from the second", () => {
    const mtv = resolveCircleCircle({ x: 40, y: 0, r: 25 }, { x: 0, y: 0, r: 25 })!;
    expect(mtv.x).toBeCloseTo(10);
    expect(mtv.y).toBeCloseTo(0);
  });

  it("separates coincident circles deterministically", () => {
    const mtv = resolveCircleCircle({ x: 5, y: 5, r: 25 }, { x: 5, y: 5, r: 25 })!;
    expect(mtv.x).toBeCloseTo(50);
    expect(mtv.y).toBe(0);
  });
});

describe("rectsCloserThan", () => {
  it("detects rectangles closer than the gap", () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    expect(rectsCloserThan(a, { x: 150, y: 0, w: 100, h: 100 }, 90)).toBe(true);
    expect(rectsCloserThan(a, { x: 190, y: 0, w: 100, h: 100 }, 90)).toBe(false);
    expect(rectsCloserThan(a, { x: 150, y: 300, w: 100, h: 100 }, 90)).toBe(false);
  });
});
