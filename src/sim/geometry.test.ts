import { describe, expect, it } from "vitest";
import {
  angleDiff,
  circleInsideSquare,
  circleIntersectsRect,
  circleIntersectsSector,
  clampCircleToSquare,
  degToRad,
  distancePointToSector,
  normalize,
  rectsCloserThan,
  resolveCircleCircle,
  resolveCircleRect,
  sweepCircleCircle,
  sweepCircleRect,
  sweepCircleSquare,
  withinCone,
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

describe("angles", () => {
  it("wraps differences into [-π, π]", () => {
    expect(angleDiff(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleDiff(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
  });

  it("tests cone membership by angle only", () => {
    const origin = { x: 0, y: 0 };
    const dir = { x: 1, y: 0 };
    const half = degToRad(45);
    expect(withinCone(origin, dir, half, { x: 100, y: 0 })).toBe(true);
    expect(withinCone(origin, dir, half, { x: 100, y: 99 })).toBe(true);
    expect(withinCone(origin, dir, half, { x: 100, y: 101 })).toBe(false);
    expect(withinCone(origin, dir, half, { x: -100, y: 0 })).toBe(false);
    expect(withinCone(origin, dir, half, { x: 1e9, y: 0 })).toBe(true);
  });
});

describe("distancePointToSector", () => {
  const apex = { x: 0, y: 0 };
  const from = degToRad(-30);
  const to = degToRad(30);

  it("is zero inside and radial beyond the arc", () => {
    expect(distancePointToSector({ x: 50, y: 0 }, apex, from, to, 100)).toBe(0);
    expect(distancePointToSector({ x: 150, y: 0 }, apex, from, to, 100)).toBeCloseTo(50);
    expect(distancePointToSector(apex, apex, from, to, 100)).toBe(0);
  });

  it("measures to the nearest straight edge outside the span", () => {
    // Point at 90°, distance 50: nearest edge is the 30° ray; perpendicular distance = 50·sin(60°).
    expect(distancePointToSector({ x: 0, y: 50 }, apex, from, to, 100)).toBeCloseTo(50 * Math.sin(degToRad(60)));
    // Directly behind: nearest points are the apex.
    expect(distancePointToSector({ x: -40, y: 0 }, apex, from, to, 100)).toBeCloseTo(40);
  });

  it("accepts the angles in either order and handles the ±π seam", () => {
    const a = distancePointToSector({ x: 0, y: 50 }, apex, to, from, 100);
    const b = distancePointToSector({ x: 0, y: 50 }, apex, from, to, 100);
    expect(a).toBeCloseTo(b);
    // Sector facing -x straddles ±π.
    const left = distancePointToSector({ x: -80, y: 5 }, apex, degToRad(150), degToRad(-150), 100);
    expect(left).toBe(0);
    // Directly behind a sector spanning 150°..210°: both edge rays point away, so the apex is nearest.
    expect(distancePointToSector({ x: 80, y: 0 }, apex, degToRad(150), degToRad(-150), 100)).toBeCloseTo(80);
  });

  it("detects circle-vs-sector overlap", () => {
    const dir = { x: 1, y: 0 };
    expect(circleIntersectsSector({ x: 120, y: 0, r: 25 }, apex, dir, degToRad(17.5), 100)).toBe(true);
    expect(circleIntersectsSector({ x: 126, y: 0, r: 25 }, apex, dir, degToRad(17.5), 100)).toBe(false);
    expect(circleIntersectsSector({ x: 60, y: 60, r: 25 }, apex, dir, degToRad(17.5), 100)).toBe(false);
    expect(circleIntersectsSector({ x: 60, y: 40, r: 25 }, apex, dir, degToRad(17.5), 100)).toBe(true);
  });
});

describe("sweeps", () => {
  const r = 25;

  it("finds the arena edge along the direction of travel", () => {
    expect(sweepCircleSquare({ x: 100, y: 100, r }, { x: 1, y: 0 }, 2100)).toBeCloseTo(2100 - 25 - 100);
    expect(sweepCircleSquare({ x: 100, y: 100, r }, { x: -1, y: 0 }, 2100)).toBeCloseTo(75);
    expect(sweepCircleSquare({ x: 100, y: 100, r }, { x: 0, y: 1 }, 2100)).toBeCloseTo(1975);
    expect(sweepCircleSquare({ x: 25, y: 100, r }, { x: -1, y: 0 }, 2100)).toBe(0);
    const diag = normalize({ x: 1, y: 1 });
    expect(sweepCircleSquare({ x: 2000, y: 100, r }, diag, 2100)).toBeCloseTo(75 * Math.SQRT2);
  });

  it("stops flush against a rectangle face", () => {
    const rect = { x: 500, y: 0, w: 100, h: 1000 };
    expect(sweepCircleRect({ x: 100, y: 500, r }, { x: 1, y: 0 }, rect)).toBeCloseTo(500 - 25 - 100);
    expect(sweepCircleRect({ x: 100, y: 500, r }, { x: 0, y: 1 }, rect)).toBeNull();
    expect(sweepCircleRect({ x: 100, y: 500, r }, { x: -1, y: 0 }, rect)).toBeNull();
    expect(sweepCircleRect({ x: 100, y: 1100, r }, { x: 1, y: 0 }, rect)).toBeNull(); // passes below it
  });

  it("is exact at a rectangle corner (rounded Minkowski sum)", () => {
    const rect = { x: 100, y: 100, w: 100, h: 100 };
    const diag = normalize({ x: 1, y: 1 });
    // Moving from (0,0) diagonally toward the corner (100,100): contact when centre is r away from the corner.
    const t = sweepCircleRect({ x: 0, y: 0, r }, diag, rect)!;
    expect(t).toBeCloseTo(100 * Math.SQRT2 - 25);
    // Path 20 units above the top face: a square-grown box would report contact at x = 75,
    // but the rounded corner is reached later, at x = 100 − √(25² − 20²) = 85.
    expect(sweepCircleRect({ x: 0, y: 80, r }, { x: 1, y: 0 }, rect)).toBeCloseTo(85);
    // Path just clear of the face never touches.
    expect(sweepCircleRect({ x: 0, y: 100 - 25 - 1, r }, { x: 1, y: 0 }, rect)).toBeNull();
  });

  it("reports entry and exit against another circle", () => {
    const hit = sweepCircleCircle({ x: 0, y: 0, r }, { x: 1, y: 0 }, { x: 200, y: 0, r })!;
    expect(hit.entry).toBeCloseTo(150);
    expect(hit.exit).toBeCloseTo(250);
    expect(sweepCircleCircle({ x: 0, y: 0, r }, { x: 1, y: 0 }, { x: 200, y: 60, r })).toBeNull();
    expect(sweepCircleCircle({ x: 0, y: 0, r }, { x: -1, y: 0 }, { x: 200, y: 0, r })).toBeNull();
    const graze = sweepCircleCircle({ x: 0, y: 0, r }, { x: 1, y: 0 }, { x: 200, y: 49, r })!;
    expect(graze.entry).toBeLessThan(200);
  });
});
