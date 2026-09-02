/**
 * Keyboard movement input. Tracks held keys and exposes the current desired
 * movement direction as a raw vector (the simulation normalises it). WASD and
 * arrow keys; opposite keys cancel out. Keys are released on window blur so a
 * player never keeps running after alt-tabbing.
 */
import type { Vec2 } from "./sim/geometry";

const KEY_TO_AXIS: Record<string, Vec2> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export interface KeyboardInput {
  /** Current movement intent; zero when no movement key is held. */
  direction(): Vec2;
  stop(): void;
}

export function createKeyboardInput(target: Window = window): KeyboardInput {
  const held = new Set<string>();

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!(e.code in KEY_TO_AXIS)) return;
    held.add(e.code);
    e.preventDefault(); // arrows would otherwise scroll the page
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  const onBlur = (): void => held.clear();

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    direction(): Vec2 {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const axis = KEY_TO_AXIS[code];
        x += axis.x;
        y += axis.y;
      }
      return { x: Math.sign(x), y: Math.sign(y) };
    },
    stop(): void {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      held.clear();
    },
  };
}
