import { describe, expect, it } from "vitest";
import { segmentIntersectsRect, type Rect } from "./geometry";
import { canSee, hasClearLine, shadowPolygons } from "./vision";

describe("segmentIntersectsRect", () => {
  const rect: Rect = { x: 100, y: 100, w: 100, h: 100 }; // covers [100,200]²

  it("detects a segment crossing straight through", () => {
    expect(segmentIntersectsRect({ x: 0, y: 150 }, { x: 300, y: 150 }, rect)).toBe(true);
  });

  it("is false when the segment passes clear of the rectangle", () => {
    expect(segmentIntersectsRect({ x: 0, y: 50 }, { x: 300, y: 50 }, rect)).toBe(false);
  });

  it("is false when the rectangle is beyond the segment's end", () => {
    // Pointing at the rect but stopping short of it.
    expect(segmentIntersectsRect({ x: 0, y: 150 }, { x: 80, y: 150 }, rect)).toBe(false);
  });

  it("counts a segment lying entirely inside as intersecting", () => {
    expect(segmentIntersectsRect({ x: 120, y: 120 }, { x: 180, y: 180 }, rect)).toBe(true);
  });

  it("counts an endpoint on the edge as intersecting", () => {
    expect(segmentIntersectsRect({ x: 0, y: 100 }, { x: 100, y: 100 }, rect)).toBe(true);
  });
});

describe("fog of war line of sight (acceptance 3)", () => {
  const wall: Rect = { x: 900, y: 900, w: 300, h: 300 };
  const obstacles = [wall];

  it("sees a rival across open ground", () => {
    expect(hasClearLine({ x: 100, y: 100 }, { x: 500, y: 100 }, obstacles)).toBe(true);
    expect(canSee({ x: 100, y: 100 }, { pos: { x: 500, y: 100 }, radius: 25 }, obstacles)).toBe(true);
  });

  it("hides a rival squarely behind an obstacle", () => {
    // Viewer and rival on opposite sides of the wall, centre aligned with it.
    const viewer = { x: 1050, y: 300 };
    const rival = { pos: { x: 1050, y: 1500 }, radius: 25 };
    expect(hasClearLine(viewer, rival.pos, obstacles)).toBe(false);
    expect(canSee(viewer, rival, obstacles)).toBe(false);
  });

  it("still shows a rival whose edge peeks past the obstacle", () => {
    // The centre-to-centre line runs straight through the wall (y=1195 is inside
    // the wall's span), so the centre is occluded — but the rival's lower
    // silhouette edge (y≈1220) clears the wall's bottom, so it stays visible.
    const viewer = { x: 500, y: 1195 };
    const rival = { pos: { x: 1500, y: 1195 }, radius: 25 };
    expect(hasClearLine(viewer, rival.pos, obstacles)).toBe(false);
    expect(canSee(viewer, rival, obstacles)).toBe(true);
  });

  it("sees a rival with no obstacles at all", () => {
    expect(canSee({ x: 0, y: 0 }, { pos: { x: 2000, y: 2000 }, radius: 25 }, [])).toBe(true);
  });
});

describe("shadowPolygons (fog layer)", () => {
  const wall: Rect = { x: 900, y: 900, w: 300, h: 300 };

  /** Even-odd ray casting; the polygons are simple so this is exact enough. */
  function inside(p: { x: number; y: number }, poly: readonly { x: number; y: number }[]): boolean {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i];
      const b = poly[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  }
  const shadowed = (viewer: { x: number; y: number }, p: { x: number; y: number }, obstacles: Rect[]): boolean =>
    shadowPolygons(viewer, obstacles).some((poly) => inside(p, poly));

  it("casts one wedge per edge facing the viewer, all wound the same way", () => {
    const polys = shadowPolygons({ x: 100, y: 100 }, [wall]); // sees the left and top edges
    expect(polys).toHaveLength(2);
    const signedArea = (poly: { x: number; y: number }[]): number =>
      poly.reduce((s, a, i) => {
        const b = poly[(i + 1) % poly.length];
        return s + a.x * b.y - b.x * a.y;
      }, 0);
    for (const poly of polys) expect(signedArea(poly)).toBeGreaterThan(0);
  });

  it("casts nothing with no obstacles", () => {
    expect(shadowPolygons({ x: 500, y: 500 }, [])).toEqual([]);
  });

  it("shades exactly the points with no clear sight line", () => {
    // Sample a coarse grid, skipping points inside the wall (which is neither
    // 'seen' nor 'fogged floor') and points on the wedge boundaries.
    const obstacles = [wall];
    const viewers = [
      { x: 100, y: 100 },
      { x: 1050, y: 300 },
      { x: 1250, y: 1050 },
      { x: 2000, y: 2000 },
      { x: 930, y: 1250 }, // right next to the bottom edge, seeing it almost edge-on
    ];
    for (const viewer of viewers) {
      for (let x = 37; x < 2100; x += 101) {
        for (let y = 53; y < 2100; y += 97) {
          if (x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h) continue;
          const p = { x, y };
          const blocked = !hasClearLine(viewer, p, obstacles);
          // A sample lying exactly on a wedge boundary (its sight line grazes a
          // corner) is legitimately either; nudging it decides, so skip those.
          const nudged = [
            { x: x + 0.01, y },
            { x: x - 0.01, y },
            { x, y: y + 0.01 },
            { x, y: y - 0.01 },
          ].map((q) => !hasClearLine(viewer, q, obstacles));
          if (nudged.some((b) => b !== blocked)) continue;
          expect(shadowed(viewer, p, obstacles), `viewer ${JSON.stringify(viewer)} point ${JSON.stringify(p)}`).toBe(blocked);
        }
      }
    }
  });

  it("covers the whole arena behind a long edge seen from up close", () => {
    // A 360-unit edge seen from 25 units away spans ~165°: the far side of the
    // wedge must still lie beyond the arena's opposite corner.
    const long: Rect = { x: 870, y: 1000, w: 360, h: 90 };
    const viewer = { x: 1050, y: 1115 }; // 25 units below the bottom edge's midpoint
    expect(shadowed(viewer, { x: 1050, y: 0 }, [long])).toBe(true);
    expect(shadowed(viewer, { x: 0, y: 0 }, [long])).toBe(true);
    expect(shadowed(viewer, { x: 2100, y: 0 }, [long])).toBe(true);
    expect(shadowed(viewer, { x: 1050, y: 1500 }, [long])).toBe(false);
  });
});
