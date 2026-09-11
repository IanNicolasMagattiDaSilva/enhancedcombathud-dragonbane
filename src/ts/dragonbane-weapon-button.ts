import { consumeAction, hasUsedAction } from "./dragonbane-action-tracker";

const ARGON = CONFIG.ARGON;

/**
 * Waits for the user to target a token on the canvas, then resolves true.
 * Resolves false (without leaking listeners) when:
 *   - The user presses Escape
 *   - The HUD's token is deselected (HUD closing)
 *   - Combat ends
 *
 * `hudToken` is the Argon-bound token at call time, used to detect HUD close.
 */
export function awaitTargetSelection(hudToken: any): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      Hooks.off("targetToken", ids.target);
      Hooks.off("controlToken", ids.control);
      Hooks.off("deleteCombat", ids.combat);
      document.removeEventListener("keydown", escHandler);
      resolve(result);
    };

    const escHandler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      cleanup(false);
    };

    // All hook IDs are captured in one object so cleanup() can reference them.
    // Hooks fire asynchronously (on game events), never during Hooks.on() itself,
    // so ids is fully initialised before any callback runs.
    const ids = {
      target: Hooks.on(
        "targetToken",
        (user: any, _token: any, targeted: boolean) => {
          if (user !== game.user || !targeted) return;
          cleanup(true);
        },
      ),
      // Cancel when the player's own token is deselected (HUD would close).
      control: Hooks.on("controlToken", (token: any, controlled: boolean) => {
        if (!controlled && token === hudToken) cleanup(false);
      }),
      // Cancel when combat ends entirely.
      combat: Hooks.once("deleteCombat", () => cleanup(false)),
    };

    document.addEventListener("keydown", escHandler);
  });
}

export class DragonbaneWeaponButton extends ARGON.MAIN.BUTTONS.ItemButton {
  // Guards against double-clicks while awaitTargetSelection is pending.
  // Without this, each click would register a new set of hooks and produce
  // multiple attack dialogs when the target is finally selected.
  _awaitingTarget = false;

  get targets() {
    return 1;
  }
  get ranges() {
    return {
      normal: this.item.system.calculatedRange,
      long: null,
    };
  }

  async _onLeftClick(event) {
    if (this._awaitingTarget) return;
    return consumeAction(
      this.actor,
      async () => {
        if (game.user.targets.size === 0) {
          // When Argon's "rangepicker" setting is enabled, ItemButton._onPreLeftClick
          // already shows a visual TargetPicker before calling _onLeftClick, so
          // game.user.targets.size is > 0 by the time we reach this code.
          // This branch only runs when rangepicker is disabled.
          ui.notifications?.info(
            game.i18n.localize(
              "enhancedcombathud-dragonbane.notifications.select-target",
            ),
          );
          this._awaitingTarget = true;
          try {
            const targeted = await awaitTargetSelection(this.token);
            if (!targeted) return undefined;
          } finally {
            this._awaitingTarget = false;
          }
          // Another button (Parry, another weapon) may have consumed the
          // action while we were waiting for the target. consumeAction only
          // checks hasUsedAction at entry, so we re-check here to avoid
          // firing the attack after the action was spent elsewhere.
          if (hasUsedAction(this.actor)) {
            ui.notifications?.warn(
              game.i18n.localize(
                "enhancedcombathud-dragonbane.notifications.action-already-used",
              ),
            );
            return undefined;
          }
        }
        return game.dragonbane.rollItem(this.item.name, this.item.type);
      },
      { cancelIfFalsy: true },
    )(event);
  }

  get hasTooltip() {
    return true;
  }

  async getTooltipData() {
    const props = ["worn", "mainHand", "offHand", "broken"];
    return {
      title: this.item.name,
      subtitle: `${this.item.system.skill.name}: ${this.item.system.skill.value}`,
      details: [
        {
          label: game.i18n.localize(
            "enhancedcombathud-dragonbane.weapon.tooltips.damage",
          ),
          value: this.item.system.damage,
        },
        {
          label: game.i18n.localize(
            "enhancedcombathud-dragonbane.weapon.tooltips.durability",
          ),
          value: this.item.system.durability,
        },
        {
          label: game.i18n.localize(
            "enhancedcombathud-dragonbane.weapon.tooltips.range",
          ),
          value: this.item.system.calculatedRange,
        },
        {
          label: game.i18n.localize(
            "enhancedcombathud-dragonbane.weapon.tooltips.features",
          ),
          value: this.item.system.features.join(", "),
        },
      ],
      properties: props.reduce((m: Array<object>, p): Array<object> => {
        if (this.item.system[p]) {
          m.push({ label: p, secondary: true });
        }

        return m;
      }, []),
    };
  }
}
