import { describe, it, expect, beforeEach, vi } from "vitest";
import { DragonbaneWeaponButton } from "../src/ts/dragonbane-weapon-button";
import { markActionUsed } from "../src/ts/dragonbane-action-tracker";

type HookCallback = (...args: unknown[]) => void;

function installHooksMock() {
  const registry: Record<string, Map<number, HookCallback>> = {};
  let nextId = 1;

  const on = vi.fn((event: string, cb: HookCallback) => {
    registry[event] ??= new Map();
    const id = nextId++;
    registry[event].set(id, cb);
    return id;
  });
  const once = vi.fn((event: string, cb: HookCallback) => {
    const id = on(event, (...args) => {
      registry[event]?.delete(id);
      cb(...args);
    });
    return id;
  });
  const off = vi.fn((event: string, id: number) => {
    registry[event]?.delete(id);
  });
  const fire = (event: string, ...args: unknown[]) => {
    const callbacks = Array.from(registry[event]?.values() ?? []);
    for (const cb of callbacks) cb(...args);
  };
  const count = (event: string) => registry[event]?.size ?? 0;

  (global as any).Hooks = { on, off, once };
  return { fire, count };
}

function makeMockActor() {
  const flags: Record<string, unknown> = {};
  return {
    id: "actor-1",
    type: "character",
    name: "Test Character",
    getFlag: vi.fn((_scope: string, key: string) => flags[key]),
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      flags[key] = value;
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      delete flags[key];
    }),
  };
}

function makeWeaponButton(actor: any) {
  const item = {
    name: "Test Sword",
    type: "weapon",
    system: {
      calculatedRange: 5,
      skill: { name: "Swords", value: 12 },
      damage: "1d8",
      durability: 5,
      features: [],
    },
  };
  const btn = new DragonbaneWeaponButton(item) as any;
  btn.actor = actor;
  btn.token = { id: "hud-token" };
  btn.item = item;
  return btn;
}

describe("DragonbaneWeaponButton", () => {
  let hooks: ReturnType<typeof installHooksMock>;
  let actor: ReturnType<typeof makeMockActor>;
  let rollItemMock: ReturnType<typeof vi.fn>;
  const user: { id: string; targets: Set<unknown> } = {
    id: "player-1",
    targets: new Set(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hooks = installHooksMock();
    actor = makeMockActor();
    rollItemMock = vi.fn().mockResolvedValue({ ok: true });
    (global as any).game.user = user;
    (global as any).game.dragonbane = { rollItem: rollItemMock };
    user.targets.clear();
  });

  describe("_awaitingTarget guard (multi-click leak)", () => {
    it("registers only one set of hooks even when clicked twice while waiting", async () => {
      const btn = makeWeaponButton(actor);

      // First click enters the awaiting-target branch and yields.
      const firstClick = btn._onLeftClick({});
      // Let the async function progress to the first await.
      await Promise.resolve();

      expect(hooks.count("targetToken")).toBe(1);
      expect(hooks.count("controlToken")).toBe(1);
      expect(hooks.count("deleteCombat")).toBe(1);

      // Second click while awaiting — should be blocked by _awaitingTarget.
      await btn._onLeftClick({});

      // Still exactly one set of hooks — the guard prevented a duplicate.
      expect(hooks.count("targetToken")).toBe(1);
      expect(hooks.count("controlToken")).toBe(1);
      expect(hooks.count("deleteCombat")).toBe(1);

      // Complete the first click to keep the test tidy.
      hooks.fire("targetToken", user, {}, true);
      await firstClick;

      // Only one rollItem call across both clicks.
      expect(rollItemMock).toHaveBeenCalledTimes(1);
    });

    it("resets _awaitingTarget to false after target resolution", async () => {
      const btn = makeWeaponButton(actor);
      const click = btn._onLeftClick({});
      hooks.fire("targetToken", user, {}, true);
      await click;
      expect(btn._awaitingTarget).toBe(false);
    });

    it("resets _awaitingTarget to false after cancellation via Escape", async () => {
      const btn = makeWeaponButton(actor);
      const click = btn._onLeftClick({});
      await Promise.resolve();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await click;
      expect(btn._awaitingTarget).toBe(false);
      expect(rollItemMock).not.toHaveBeenCalled();
    });

    it("resets _awaitingTarget to false after cancellation via deleteCombat", async () => {
      const btn = makeWeaponButton(actor);
      const click = btn._onLeftClick({});
      await Promise.resolve();
      hooks.fire("deleteCombat");
      await click;
      expect(btn._awaitingTarget).toBe(false);
      expect(rollItemMock).not.toHaveBeenCalled();
    });
  });

  describe("hasUsedAction re-check after target selection", () => {
    it("does NOT call rollItem if action was consumed during the target wait", async () => {
      const btn = makeWeaponButton(actor);
      const click = btn._onLeftClick({});
      await Promise.resolve();

      // Simulate another button (e.g. Parry) consuming the action while we wait.
      await markActionUsed(actor);

      // Now the target arrives — the handler should re-check and abort.
      hooks.fire("targetToken", user, {}, true);
      await click;

      expect(rollItemMock).not.toHaveBeenCalled();
    });

    it("calls rollItem when no other button consumed the action during the wait", async () => {
      const btn = makeWeaponButton(actor);
      const click = btn._onLeftClick({});
      hooks.fire("targetToken", user, {}, true);
      await click;

      expect(rollItemMock).toHaveBeenCalledWith("Test Sword", "weapon");
    });

    it("skips the target-wait branch entirely when a target is pre-selected", async () => {
      user.targets.add({ id: "enemy" });
      const btn = makeWeaponButton(actor);

      await btn._onLeftClick({});

      expect(rollItemMock).toHaveBeenCalledOnce();
      // No hooks registered because we never entered awaitTargetSelection.
      expect(hooks.count("targetToken")).toBe(0);
    });
  });
});
