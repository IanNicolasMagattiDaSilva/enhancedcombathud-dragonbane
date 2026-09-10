import { id as MODULE_NAME } from "../module.json";
import {
  consumeAction,
  hasUsedAction,
} from "./dragonbane-action-tracker";

const ARGON = CONFIG.ARGON;

// UUID of the Fear table from Dragonbane Core Set
const FEAR_TABLE_UUID = "RollTable.wHTr9HuHkpVv7ccX";

class DragonbaneMonsterDefendButton extends ARGON.MAIN.BUTTONS.ActionButton {
  get classes() {
    return ["action-element", "dragonbane-action-element"];
  }

  get label() {
    return game.i18n.localize(
      "enhancedcombathud-dragonbane.actions.monster-defend",
    );
  }

  get icon() {
    return "systems/dragonbane/art/ui/shield.webp";
  }

  async _onLeftClick(event) {
    return consumeAction(
      this.actor,
      async (e) => {
        this.actor.sheet._onMonsterDefend({
          type: "click",
          preventDefault: () => e.preventDefault(),
        });
      },
      { isReaction: true },
    )(event);
  }
}

class DragonbaneEvadeButton extends ARGON.MAIN.BUTTONS.ActionButton {
  get classes() {
    return ["action-element", "dragonbane-action-element"];
  }
  get label() {
    return game.i18n.localize("enhancedcombathud-dragonbane.actions.dodge");
  }

  get icon() {
    return "modules/enhancedcombathud/icons/svg/dodging.svg";
  }

  async _onLeftClick(event) {
    return consumeAction(
      this.actor,
      async () => {
        return game.dragonbane.rollItem(
          (game.settings.get(MODULE_NAME, "skillNameEvade") as string) ||
            "Evade",
          "skill",
        );
      },
      { isReaction: true },
    )(event);
  }
}

function parrySortValue(item: DragonbaneItem): number {
  return (
    item.system.skill.value +
    item.system.durability +
    (game.settings.get(MODULE_NAME, "preferShieldParry") &&
    item.hasWeaponFeature("shield")
      ? 25
      : 0)
  );
}

class DragonbaneParryButton extends ARGON.MAIN.BUTTONS.ActionButton {
  _parryWeapon: DragonbaneItem | null = null;

  // Lazily compute the parry weapon when first accessed
  get parryWeapon(): DragonbaneItem | null {
    if (this._parryWeapon === null && this.actor) {
      // select for highest skill+durability
      this._parryWeapon =
        this.actor
          .getEquippedWeapons()
          .filter((w) => !w.hasWeaponFeature("noparry"))
          .sort((a, b) => parrySortValue(b) - parrySortValue(a))[0] || null;
    }
    return this._parryWeapon;
  }

  get classes() {
    return ["action-element", "dragonbane-action-element"];
  }
  get label() {
    return `${game.i18n.localize("enhancedcombathud-dragonbane.actions.parry")} (${this.parryWeapon?.name || ""})`;
  }

  get icon() {
    return "modules/enhancedcombathud/icons/svg/crossed-swords.svg";
  }

  override async _renderInner() {
    await super._renderInner();
    if (!this.parryWeapon) {
      this.element.style.display = "none";
      return;
    }
  }

  async _onLeftClick(event) {
    return consumeAction(
      this.actor,
      async () => {
        if (this.parryWeapon) {
          game.dragonbane.rollItem(
            this.parryWeapon.name,
            this.parryWeapon.type,
          );
        }
      },
      { isReaction: true },
    )(event);
  }
}

class DragonbaneFearButton extends ARGON.MAIN.BUTTONS.ActionButton {
  _fearTable: RollTable | null;

  constructor() {
    super();
    this._fearTable = fromUuidSync(FEAR_TABLE_UUID) as RollTable | null;
  }

  get classes() {
    return ["action-element", "dragonbane-action-element"];
  }

  get label() {
    return game.i18n.localize(
      "enhancedcombathud-dragonbane.actions.fear-table",
    );
  }

  get icon() {
    return "icons/svg/terror.svg";
  }

  async _onLeftClick() {
    if (this._fearTable) {
      await this._fearTable.draw();
    }
  }
}

export default class DragonbaneDefensePanel extends ARGON.MAIN.ActionPanel {
  _hasFearTable: boolean | null = null;

  // Lazily detect fear table to avoid redundant lookups
  get hasFearTable(): boolean {
    if (this._hasFearTable === null) {
      this._hasFearTable = !!fromUuidSync(FEAR_TABLE_UUID);
    }
    return this._hasFearTable;
  }

  get classes() {
    return ["actions-container", "dragonbane-actions-container"];
  }

  get label() {
    // If fear table exists, show "Defence/Reactions", otherwise just "Defence"
    const key = this.hasFearTable
      ? "enhancedcombathud-dragonbane.panels.defense-reactions"
      : "enhancedcombathud-dragonbane.panels.defense";
    return game.i18n.localize(key);
  }

  get maxActions() {
    return 1;
  }

  get currentActions() {
    return hasUsedAction(this.actor) ? 0 : 1;
  }

  async _getButtons() {
    if (this.actor.type === "monster") {
      return [new DragonbaneMonsterDefendButton()];
    }

    const buttons = [new DragonbaneEvadeButton(), new DragonbaneParryButton()];

    // Add fear button if the table exists (from Dragonbane Core Set)
    if (this.hasFearTable) {
      buttons.push(new DragonbaneFearButton());
    }

    return buttons;
  }

  get colorScheme() {
    return 3;
  }

  _actionStateHookId: number | null = null;

  override async _renderInner() {
    await super._renderInner();
    if (this._actionStateHookId === null) {
      this._actionStateHookId = Hooks.on(
        `${MODULE_NAME}.actionStateChanged`,
        (actorId: string) => {
          if (actorId === this.actor?.id) this.updateActionUse();
        },
      );
    }
  }
}
