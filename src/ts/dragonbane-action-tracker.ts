import { id as MODULE_NAME } from "../module.json";

const ACTION_FLAG = "actionUsed";
const REACTION_FLAG = "reactedThisRound";

// Structural interface — avoids Actor/DragonbaneActor clone() covariance issues.
interface ActorLike {
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
  id?: string | null;
}

export function hasUsedAction(actor: ActorLike | undefined): boolean {
  if (!actor) return false;
  return !!actor.getFlag(MODULE_NAME, ACTION_FLAG);
}

export function hasReacted(actor: ActorLike | undefined): boolean {
  if (!actor) return false;
  return !!actor.getFlag(MODULE_NAME, REACTION_FLAG);
}

export async function markActionUsed(actor: ActorLike | undefined): Promise<void> {
  if (!actor) return;
  await actor.setFlag(MODULE_NAME, ACTION_FLAG, true);
}

export async function markReacted(actor: ActorLike | undefined): Promise<void> {
  if (!actor) return;
  // Per Dragonbane rules (p.42): a reaction flips your initiative card,
  // consuming both the round's action and the remaining movement.
  await actor.setFlag(MODULE_NAME, ACTION_FLAG, true);
  await actor.setFlag(MODULE_NAME, REACTION_FLAG, true);
}

export async function resetRoundState(actor: ActorLike | undefined): Promise<void> {
  if (!actor) return;
  await actor.unsetFlag(MODULE_NAME, ACTION_FLAG);
  await actor.unsetFlag(MODULE_NAME, REACTION_FLAG);
}

/**
 * Wraps a click handler so it only fires when the actor still has an action
 * available, then marks the action as used. Returns a no-op that also emits a
 * UI notification if the actor already acted this round.
 */
export function consumeAction<E = MouseEvent>(
  actor: ActorLike | undefined,
  handler: (event: E) => unknown | Promise<unknown>,
  options: { isReaction?: boolean } = {},
) {
  return async (event: E) => {
    if (hasUsedAction(actor)) {
      ui.notifications?.warn(
        game.i18n.localize(
          "enhancedcombathud-dragonbane.notifications.action-already-used",
        ),
      );
      return;
    }
    await handler(event);
    if (options.isReaction) {
      await markReacted(actor);
    } else {
      await markActionUsed(actor);
    }
  };
}

/**
 * Register the per-round reset hook. Called once during module setup.
 * When a combat round advances, every combatant's action/reaction flags are
 * cleared so that new initiative cards effectively grant new turns.
 */
export function registerRoundResetHook(): void {
  Hooks.on("combatRound", async (combat: Combat) => {
    for (const combatant of combat.combatants) {
      await resetRoundState(combatant.actor);
    }
  });

  // Dragonbane monsters with Ferocity > 1 get N initiative cards per round.
  // The yze-combat module represents this by creating N duplicate combatant
  // entries in the tracker (via duplicateCombatantOnCombatStart + actorSpeedAttribute).
  // Each entry is one independent turn — reset the actor's flags when its turn
  // starts so each ferocity-turn gets a clean action economy.
  Hooks.on("combatTurn", async (combat: Combat) => {
    const actor = combat.combatant?.actor;
    if (!actor) return;
    await resetRoundState(actor);
  });

  // When combat ends, clear any leftover flags so out-of-combat play is clean.
  Hooks.on("deleteCombat", async (combat: Combat) => {
    for (const combatant of combat.combatants) {
      await resetRoundState(combatant.actor);
    }
  });

  // When actor flags change (e.g. after markActionUsed/markReacted/resetRoundState),
  // emit a module-level hook so all rendered HUD panels can refresh their pip display.
  Hooks.on("updateActor", (actor: Actor, changes: Record<string, unknown>) => {
    if (!(changes as { flags?: Record<string, unknown> })?.flags?.[MODULE_NAME]) return;
    Hooks.callAll(`${MODULE_NAME}.actionStateChanged`, actor.id);
  });
}
