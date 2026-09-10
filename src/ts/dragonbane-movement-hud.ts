import { hasReacted } from "./dragonbane-action-tracker";

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
}
