/**
 * Player HUD below the arena: a 10-block health bar with an "x/10 HP" label
 * and one icon per skill showing its cooldown state.
 *
 * The HUD is plain DOM in its own CSS grid row under the stage, so it can
 * never cover the canvas. It is rebuilt once per page (`createHud`), told the
 * local build once per match (`setLoadout`, which fixes every cooldown's total)
 * and refreshed every frame from the local `PlayerState` (`update`).
 *
 * The pure helpers at the top (block count, cooldown fraction) carry the
 * display rules and are unit-tested without a DOM; block count and colours are
 * presentation constants, not gameplay numbers, so they live here rather than
 * in config.ts (same rule as the renderer's colours).
 */
import { CONFIG, type GameConfig } from "./config";
import { KEY_HINTS } from "./input";
import type { Loadout } from "./sim/loadout";
import { isDead, type PlayerState } from "./sim/player";
import { resolveBash, resolveDash, resolveShield, resolveShot, resolveSlash, type SkillId } from "./sim/skills/stats";

/** Number of blocks in the health bar; each block is one tenth of max HP. */
export const HP_BLOCKS = 10;

/** Skill icons in HUD order (left → right). */
export const HUD_SKILLS: readonly SkillId[] = ["dash", "slash", "shot", "shield", "bash"];

/** Display names, shared with the sidebar build list. */
export const SKILL_NAMES: Record<SkillId, string> = { dash: "Dash", slash: "Slash", shot: "Shot", shield: "Shield", bash: "Bash" };

/**
 * How many of the `HP_BLOCKS` blocks are lit for `hp` out of `maxHp`. A block
 * is lit while any of its tenth is present (ceil), so a living player never
 * shows an empty bar; dead / negative HP shows none. With the shipped
 * `maxHp = 10` this is simply `hp` clamped to [0, 10].
 */
export function filledBlocks(hp: number, maxHp: number = CONFIG.player.maxHp, blocks: number = HP_BLOCKS): number {
  if (!(maxHp > 0) || !(hp > 0)) return 0;
  return Math.min(blocks, Math.ceil((hp * blocks) / maxHp));
}

/** Fraction of a cooldown still to elapse, in [0, 1]; 0 when ready or when the total is unknown. */
export function cooldownFraction(leftMs: number, totalMs: number): number {
  if (!(totalMs > 0) || !(leftMs > 0)) return 0;
  return Math.min(1, leftMs / totalMs);
}

/** The full cooldown of `skill` for a build — the denominator of the HUD sweep. */
export function skillCooldownMs(loadout: Loadout, skill: SkillId, cfg: GameConfig = CONFIG): number {
  switch (skill) {
    case "dash":
      return resolveDash(loadout, cfg).cooldownMs;
    case "slash":
      return resolveSlash(loadout, cfg).cooldownMs;
    case "shot":
      return resolveShot(loadout, cfg).cooldownMs;
    case "shield":
      return resolveShield(loadout, cfg).cooldownMs;
    case "bash":
      return resolveBash(cfg).cooldownMs;
  }
}

/** Text shown beside the HP label: what the old right-panel status line said. */
export function statusText(p: PlayerState, cfg: GameConfig = CONFIG): string {
  if (isDead(p)) return "DEAD";
  const parts: string[] = [];
  if (p.hp < cfg.player.maxHp) parts.push(`heal in ${((cfg.player.healIntervalMs - p.healTimerMs) / 1000).toFixed(1)}s`);
  if (p.slow) parts.push(`SLOWED ${(p.slow.remainingMs / 1000).toFixed(1)}s`);
  return parts.join(" · ");
}

/* ------------------------------------------------------------------- DOM -- */

/** Inline SVG glyphs, one per skill (24×24 viewBox, stroke = currentColor). */
const ICONS: Record<SkillId, string> = {
  // Two chevrons + motion line: a burst of speed.
  dash: '<path d="M4 6l6 6-6 6M11 6l6 6-6 6"/><path d="M19 12h1"/>',
  // A sword (blade, crossguard, grip) with the arc of its swing.
  slash: '<path d="M7 17L19 5"/><path d="M9 11l4 4"/><path d="M4 20l3-3"/><path d="M13 21a9 9 0 0 0 8-8"/>',
  // A bullet in flight with a trail.
  shot: '<path d="M13 8h5a4 4 0 0 1 0 8h-5z"/><path d="M13 8v8"/><path d="M4 10h5M2 14h7"/>',
  // A shield outline.
  shield: '<path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M12 3v18"/>',
  // A fist with impact spikes.
  bash: '<rect x="5" y="9" width="12" height="9" rx="2"/><path d="M8 9V6M12 9V5M16 9V6"/><path d="M19 8l2-2M20 12h2M19 16l2 2"/>',
};

export interface Hud {
  /** Fix the cooldown totals for the local build (once per match). */
  setLoadout(loadout: Loadout): void;
  /** Refresh blocks, label, status and every icon from the local player's state. */
  update(p: PlayerState): void;
}

interface AbilityTile {
  root: HTMLElement;
  sweep: HTMLElement;
  countdown: HTMLElement;
}

/** Build the HUD inside `root` (emptied first) and return its updater. */
export function createHud(root: HTMLElement, cfg: GameConfig = CONFIG): Hud {
  const doc = root.ownerDocument;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    node.className = className;
    return node;
  };

  root.replaceChildren();

  // Health bar: blocks, then the "x/10 HP" label with the status beside it.
  const health = el("div", "hud-health");
  const bar = el("div", "hp-bar");
  bar.setAttribute("role", "meter");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(HP_BLOCKS));
  const blocks: HTMLElement[] = [];
  for (let i = 0; i < HP_BLOCKS; i++) {
    const block = el("span", "hp-block filled");
    bar.append(block);
    blocks.push(block);
  }
  const labelRow = el("div", "hp-label-row");
  const label = el("span", "hp-label");
  label.id = "hp-label";
  const status = el("span", "hp-status");
  status.id = "hp-status";
  labelRow.append(label, status);
  health.append(bar, labelRow);

  // Ability row: one tile per skill with glyph, sweep overlay, countdown, key.
  const abilities = el("div", "hud-abilities");
  const tiles = new Map<SkillId, AbilityTile>();
  for (const id of HUD_SKILLS) {
    const tile = el("div", "ability ready");
    tile.dataset.skill = id;
    tile.title = `${SKILL_NAMES[id]} · ${KEY_HINTS[id]}`;
    const icon = el("div", "ability-icon");
    icon.innerHTML =
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;
    const sweep = el("div", "ability-sweep");
    const countdown = el("span", "ability-countdown");
    icon.append(sweep, countdown);
    const key = el("kbd", "ability-key");
    key.textContent = KEY_HINTS[id];
    const name = el("span", "ability-name");
    name.textContent = SKILL_NAMES[id];
    tile.append(icon, name, key);
    abilities.append(tile);
    tiles.set(id, { root: tile, sweep, countdown });
  }

  root.append(health, abilities);

  let totals: Record<SkillId, number> = { dash: 0, slash: 0, shot: 0, shield: 0, bash: 0 };

  return {
    setLoadout(loadout: Loadout): void {
      totals = {
        dash: skillCooldownMs(loadout, "dash", cfg),
        slash: skillCooldownMs(loadout, "slash", cfg),
        shot: skillCooldownMs(loadout, "shot", cfg),
        shield: skillCooldownMs(loadout, "shield", cfg),
        bash: skillCooldownMs(loadout, "bash", cfg),
      };
    },

    update(p: PlayerState): void {
      const filled = filledBlocks(p.hp, cfg.player.maxHp);
      blocks.forEach((block, i) => block.classList.toggle("filled", i < filled));
      bar.setAttribute("aria-valuenow", String(filled));
      label.textContent = `${filled}/${HP_BLOCKS} HP`;
      status.textContent = statusText(p, cfg);
      root.classList.toggle("dead", isDead(p));

      for (const [id, tile] of tiles) {
        const left = p.cooldowns[id];
        const fraction = cooldownFraction(left, totals[id]);
        const cooling = left > 0;
        tile.root.classList.toggle("cooling", cooling);
        tile.root.classList.toggle("ready", !cooling);
        tile.root.classList.toggle("active", p[id] !== null);
        tile.sweep.style.setProperty("--cd", fraction.toFixed(3));
        tile.countdown.textContent = cooling ? (left / 1000).toFixed(1) : "";
      }
    },
  };
}
