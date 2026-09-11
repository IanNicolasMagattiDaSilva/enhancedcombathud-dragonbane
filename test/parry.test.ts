import { describe, it, expect, beforeEach, vi } from "vitest";
import DragonbaneDefensePanel from "../src/ts/dragonbane-defense-panel";

function makeMockActor(weaponSkillName = "Swords") {
  const flags: Record<string, unknown> = {};
  return {
    type: "character",
    name: "Test Character",
    getFlag: vi.fn((_scope: string, key: string) => flags[key]),
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      flags[key] = value;
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      delete flags[key];
    }),
    getEquippedWeapons: vi.fn(() => [
      {
        name: "Test Sword",
        type: "weapon",
        system: {
          skill: { name: weaponSkillName, value: 12 },
          durability: 5,
        },
        hasWeaponFeature: vi.fn(() => false),
      },
    ]),
    items: [],
  };
}

async function getParryButton(actor: any) {
  (global as any).fromUuidSync = vi.fn(() => null);
  const panel = new DragonbaneDefensePanel(actor);
  const buttons = await panel._getButtons();
  const btn = buttons.find((b: any) => b.constructor.name === "DragonbaneParryButton") as any;
  // In tests, the Argon base class stores actor as an instance property.
  // Assign it so the button's consumeAction and parryWeapon getter work.
  if (btn) btn.actor = actor;
  return btn;
}

describe("DragonbaneParryButton", () => {
  let mockActor: ReturnType<typeof makeMockActor>;
  let rollItemMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockActor = makeMockActor();
    rollItemMock = vi.fn().mockResolvedValue({ result: "success" });
    (global as any).game.dragonbane = { rollItem: rollItemMock };
  });

  describe("skill resolution", () => {
    it("calls rollItem with the weapon skill name and type 'skill'", async () => {
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(rollItemMock).toHaveBeenCalledWith("Swords", "skill");
    });

    it("never calls rollItem with the weapon name or type 'weapon'", async () => {
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(rollItemMock).not.toHaveBeenCalledWith("Test Sword", "weapon", expect.anything());
      expect(rollItemMock).not.toHaveBeenCalledWith(expect.anything(), "weapon", expect.anything());
    });

    it("uses the correct skill name when weapon has a different skill", async () => {
      mockActor = makeMockActor("Axes");
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(rollItemMock).toHaveBeenCalledWith("Axes", "skill");
    });

    it("does not call rollItem when parry weapon has no skill", async () => {
      mockActor.getEquippedWeapons.mockReturnValue([
        {
          name: "Broken Weapon",
          type: "weapon",
          system: { skill: undefined, durability: 2 },
          hasWeaponFeature: vi.fn(() => false),
        },
      ]);
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(rollItemMock).not.toHaveBeenCalled();
    });

    it("does not call rollItem when there is no parry weapon at all", async () => {
      mockActor.getEquippedWeapons.mockReturnValue([]);
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(rollItemMock).not.toHaveBeenCalled();
    });
  });

  describe("action consumption", () => {
    it("consumes the reaction when rollItem returns a result", async () => {
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(mockActor.setFlag).toHaveBeenCalled();
    });

    it("does NOT consume the reaction when rollItem returns undefined (dialog cancelled)", async () => {
      rollItemMock.mockResolvedValue(undefined);
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(mockActor.setFlag).not.toHaveBeenCalled();
    });

    it("does NOT consume the reaction when there is no parry weapon skill", async () => {
      mockActor.getEquippedWeapons.mockReturnValue([
        {
          name: "Bare Hands",
          type: "weapon",
          system: { skill: undefined, durability: 0 },
          hasWeaponFeature: vi.fn(() => false),
        },
      ]);
      const btn = await getParryButton(mockActor);
      await btn._onLeftClick({});
      expect(mockActor.setFlag).not.toHaveBeenCalled();
    });
  });
});
