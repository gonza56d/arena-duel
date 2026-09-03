import { describe, expect, it } from "vitest";
import { ARENA_SIZE, ArenaViewport } from "./arena";
import { createInput } from "./input";

/**
 * The browser is faked with Node's own `EventTarget`/`Event`: the handlers only
 * read `button`, `clientX/Y`, `relatedTarget`, `code` and `repeat`, which are
 * assigned onto plain events. The canvas is a 1000×800 box whose top-left sits
 * at page (300, 60); the 2100-unit arena is letterboxed inside it at
 * x ∈ [400, 1200], y ∈ [60, 860] page px. Everything else on the page is UI.
 */
const CANVAS_RECT = { left: 300, top: 60, width: 1000, height: 800 };

function setup(capturesMouse?: () => boolean) {
  const target = new EventTarget();
  const canvas = { getBoundingClientRect: () => CANVAS_RECT } as unknown as HTMLCanvasElement;
  const viewport = new ArenaViewport();
  viewport.resize(CANVAS_RECT.width, CANVAS_RECT.height);
  const input = createInput(target as unknown as Window, canvas, viewport, { capturesMouse });
  const fire = (type: string, props: Record<string, unknown> = {}): Event => {
    const e = Object.assign(new Event(type, { cancelable: true }), props);
    target.dispatchEvent(e);
    return e;
  };
  /** Arena point for a page position, the way the game maps it. */
  const arenaAt = (clientX: number, clientY: number) =>
    viewport.screenToArena(clientX - CANVAS_RECT.left, clientY - CANVAS_RECT.top);
  return { input, fire, arenaAt, viewport };
}

describe("mouse capture across the page during a fight", () => {
  it("fires the skill from a click on the UI around the arena, aimed where the click landed", () => {
    const { input, fire, arenaAt } = setup();
    // On the left sidebar, well outside the canvas.
    const e = fire("mousedown", { button: 0, clientX: 50, clientY: 400 });
    expect(input.consumeTriggers()).toEqual({ slashPrimary: true });
    expect(input.aim()).toEqual(arenaAt(50, 400));
    expect(input.aim()!.x).toBeLessThan(0);
    expect(e.defaultPrevented).toBe(true); // no text selection on the sidebar
    expect(input.consumeTriggers()).toEqual({}); // one-shot
  });

  it("maps the right button to the secondary swing anywhere on the page", () => {
    const { input, fire } = setup();
    fire("mousedown", { button: 2, clientX: 1500, clientY: 30 }); // header, right of the canvas
    expect(input.consumeTriggers()).toEqual({ slashSecondary: true });
  });

  it("ignores unmapped buttons without touching the page", () => {
    const { input, fire } = setup();
    const e = fire("mousedown", { button: 1, clientX: 50, clientY: 400 });
    expect(input.consumeTriggers()).toEqual({});
    expect(e.defaultPrevented).toBe(false);
  });

  it("tracks the aim outside the arena square without clamping", () => {
    const { input, fire, arenaAt } = setup();
    fire("mousemove", { clientX: 50, clientY: 400 });
    expect(input.aim()).toEqual(arenaAt(50, 400));
    expect(input.aim()!.x).toBeLessThan(0);
    fire("mousemove", { clientX: 1500, clientY: 900 });
    expect(input.aim()).toEqual(arenaAt(1500, 900));
    expect(input.aim()!.x).toBeGreaterThan(ARENA_SIZE);
    expect(input.aim()!.y).toBeGreaterThan(ARENA_SIZE);
  });

  it("suppresses the context menu across the whole page", () => {
    const { fire } = setup();
    expect(fire("contextmenu").defaultPrevented).toBe(true);
  });
});

describe("pointer leaving the page", () => {
  it("drops the aim only when the pointer leaves the page, and restores it on the way back", () => {
    const { input, fire, arenaAt } = setup();
    fire("mousemove", { clientX: 600, clientY: 400 });
    expect(input.aim()).not.toBeNull();
    // Moving between elements inside the page carries a relatedTarget.
    fire("mouseout", { relatedTarget: {} });
    expect(input.aim()).toEqual(arenaAt(600, 400));
    // Leaving the page itself does not.
    fire("mouseout", { relatedTarget: null });
    expect(input.aim()).toBeNull();
    fire("mousemove", { clientX: 50, clientY: 400 });
    expect(input.aim()).toEqual(arenaAt(50, 400));
  });
});

describe("gameplay-vs-UI gate", () => {
  it("leaves the mouse to the page while gameplay does not own it, then takes it back", () => {
    let gameplay = false;
    const { input, fire } = setup(() => gameplay);

    fire("mousemove", { clientX: 600, clientY: 400 });
    expect(input.aim()).toBeNull();
    const down = fire("mousedown", { button: 0, clientX: 600, clientY: 400 });
    expect(input.consumeTriggers()).toEqual({});
    expect(down.defaultPrevented).toBe(false);
    expect(fire("contextmenu").defaultPrevented).toBe(false);

    gameplay = true;
    fire("mousedown", { button: 0, clientX: 600, clientY: 400 });
    expect(input.consumeTriggers()).toEqual({ slashPrimary: true });
    expect(input.aim()).not.toBeNull();
  });

  it("gates the mouse only: the keyboard keeps working", () => {
    const { input, fire } = setup(() => false);
    fire("keydown", { code: "KeyW", repeat: false });
    expect(input.direction()).toEqual({ x: 0, y: -1 });
    fire("keydown", { code: "ShiftLeft", repeat: false });
    expect(input.consumeTriggers()).toEqual({ dash: true });
  });

  it("stop() detaches every listener", () => {
    const { input, fire } = setup();
    input.stop();
    fire("mousemove", { clientX: 600, clientY: 400 });
    fire("mousedown", { button: 0, clientX: 600, clientY: 400 });
    expect(input.aim()).toBeNull();
    expect(input.consumeTriggers()).toEqual({});
    expect(fire("contextmenu").defaultPrevented).toBe(false);
  });
});
