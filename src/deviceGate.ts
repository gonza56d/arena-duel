/**
 * Device / viewport gate. The client is desktop-only for now: it blocks phones
 * and viewports too small to play, showing a clear message instead of the game.
 *
 * `check()` is pure (returns a reason or null); the caller decides what to show
 * and re-runs it on resize.
 */

/** Smallest supported viewport in CSS px. Must still work at exactly this size. */
export const MIN_WIDTH = 800;
export const MIN_HEIGHT = 600;

export interface GateResult {
  ok: boolean;
  /** Human-readable reason when blocked; empty when ok. */
  reason: string;
}

/** Heuristic: is this a phone? Coarse pointer + no hover, or a phone UA. */
function isPhone(): boolean {
  const coarseNoHover =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches &&
    window.matchMedia("(hover: none)").matches;

  const ua = navigator.userAgent || "";
  const phoneUa = /Android.*Mobile|iPhone|iPod|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile/i.test(
    ua,
  );

  return coarseNoHover || phoneUa;
}

/** Evaluate the current environment. */
export function check(): GateResult {
  if (isPhone()) {
    return {
      ok: false,
      reason:
        "Arena Duel is desktop-only for now. Phones and tablets aren't supported yet — please open it on a computer.",
    };
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < MIN_WIDTH || h < MIN_HEIGHT) {
    return {
      ok: false,
      reason: `Your window is ${w}×${h}px. Arena Duel needs at least ${MIN_WIDTH}×${MIN_HEIGHT}px — please enlarge or maximize the window.`,
    };
  }

  return { ok: true, reason: "" };
}
