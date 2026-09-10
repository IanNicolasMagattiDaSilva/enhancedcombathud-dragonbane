import { hasReacted, hasUsedAction, markActionUsed } from "./dragonbane-action-tracker";

const ARGON = CONFIG.ARGON;

export default class DragonbaneMovementHud extends ARGON.MovementHud {
  get classes() {
    return [
      "movement-hud",
      "dragonbane-movement-hud",
      `dragonbane-${this.actor.type}`,
    ];
  }

  get visible() {
    return game.combat?.started;
  }

  get movementMax() {
    // A reaction (parry/dodge) flips the initiative card, consuming all
    // remaining movement for this round (Dragonbane core rules p.42).
    if (hasReacted(this.actor)) return 0;
    return (
      this.actor.system.movement.value / canvas?.scene?.dimensions["distance"]
    );
  }

  get movementColor() {
    return ["dragonbane-movement"];
  }

  override async updateMovement() {
    await super.updateMovement?.();

    const movementUsed = this._getMovementUsed();
    const max =
      this.actor.system.movement.value /
      (canvas?.scene?.dimensions["distance"] ?? 1);

    if (movementUsed > max && !hasReacted(this.actor)) {
      if (hasUsedAction(this.actor)) {
        ui.notifications?.warn(
          game.i18n.localize(
            "enhancedcombathud-dragonbane.notifications.run-no-action-available",
          ),
        );
      } else {
        const confirmed = await Dialog.confirm({
          title: game.i18n.localize(
            "enhancedcombathud-dragonbane.notifications.run-consumes-action",
          ),
          content: `<p>${game.i18n.localize("enhancedcombathud-dragonbane.notifications.run-consumes-action")}</p>`,
        });
        if (confirmed) {
          await markActionUsed(this.actor);
        }
      }
    }
  }

  /** Returns squares moved this turn, reading from Argon CORE's movement history. */
  private _getMovementUsed(): number {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = (this as any).token as
      | { document?: { movementHistory?: Array<{ cost?: number }> } }
      | undefined;
    const history = token?.document?.movementHistory ?? [];
    const distance = canvas?.scene?.dimensions["distance"] ?? 1;
    return (
      history.reduce(
        (sum: number, entry: { cost?: number }) => sum + (entry.cost ?? 0),
        0,
      ) / distance
    );
  }
}
