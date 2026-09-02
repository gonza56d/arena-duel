/**
 * The single path every skill uses to hurt a player. Applies the target's
 * shield, keeps damage an integer, records a `hit` event.
 */
import type { Vec2 } from "../geometry";
import { applyDamage, isDead, type PlayerState } from "../player";
import type { World } from "../world";
import { shieldBlocks } from "./shield";
import { resolveShield, type SkillId } from "./stats";

export interface HitOutcome {
  /** Integer HP actually removed. */
  damage: number;
  blocked: boolean;
}

/**
 * Deal `amount` damage from `attacker` to `target`. `sourcePos` is where the
 * damage comes from (attacker centre for melee, bullet centre for shots) and
 * decides whether the target's shield cone catches it.
 */
export function dealDamage(
  world: World,
  skill: SkillId,
  attacker: PlayerState,
  target: PlayerState,
  amount: number,
  sourcePos: Vec2,
): HitOutcome {
  if (isDead(target)) return { damage: 0, blocked: false };

  const shield = resolveShield(target.levels, world.config);
  const blocked = shieldBlocks(target, sourcePos, shield.coneDeg);
  // Floor so a partial block can never produce fractional HP.
  const applied = blocked ? Math.floor(amount * (1 - shield.blockFraction)) : amount;
  if (applied > 0) applyDamage(target, applied, world.config);

  world.events.push({
    type: "hit",
    skill,
    attackerId: attacker.id,
    targetId: target.id,
    damage: applied,
    blocked,
    pos: { x: target.pos.x, y: target.pos.y },
  });
  return { damage: applied, blocked };
}
