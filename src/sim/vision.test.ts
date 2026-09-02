import { describe, expect, it } from "vitest";
import { segmentIntersectsRect, type Rect } from "./geometry";
import { canSee, hasClearLine } from "./vision";

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
