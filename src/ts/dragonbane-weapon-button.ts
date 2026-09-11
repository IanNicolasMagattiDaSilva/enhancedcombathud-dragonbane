import { consumeAction } from "./dragonbane-action-tracker";

const ARGON = CONFIG.ARGON;

/**
 * Waits for the user to target a token on the canvas. Shows a notification
 * explaining what to do. Resolves true when a token is targeted, false if the
 * user presses Escape to cancel.
 */
function awaitTargetSelection(): Promise<boolean> {
  return new Promise((resolve) => {
    const escHandler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      Hooks.off("targetToken", hookId);
      document.removeEventListener("keydown", escHandler);
      resolve(false);
    };

    // hookId is declared const; escHandler closes over it by reference and is
    // only called after this assignment completes, so the TDZ is not a risk.
    const hookId = Hooks.on(
      "targetToken",
      (user: any, _token: any, targeted: boolean) => {
        if (user !== game.user || !targeted) return;
        Hooks.off("targetToken", hookId);
        document.removeEventListener("keydown", escHandler);
        resolve(true);
      },
    );

    document.addEventListener("keydown", escHandler);
  });
}

export class DragonbaneWeaponButton extends ARGON.MAIN.BUTTONS.ItemButton {
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
    return consumeAction(
      this.actor,
      async () => {
        if (game.user.targets.size === 0) {
          ui.notifications?.info(
            game.i18n.localize(
              "enhancedcombathud-dragonbane.notifications.select-target",
            ),
          );
          const targeted = await awaitTargetSelection();
          if (!targeted) return undefined;
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
