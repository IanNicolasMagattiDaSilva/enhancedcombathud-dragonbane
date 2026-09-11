import { describe, it, expect, beforeEach, vi } from "vitest";
import { awaitTargetSelection } from "../src/ts/dragonbane-weapon-button";

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
    // Snapshot to avoid mutation-during-iteration when a callback deregisters.
    const callbacks = Array.from(registry[event]?.values() ?? []);
    for (const cb of callbacks) cb(...args);
  };
  const count = (event: string) => registry[event]?.size ?? 0;

  (global as any).Hooks = { on, off, once };
  return { fire, count, on, off };
}

describe("awaitTargetSelection", () => {
  let hooks: ReturnType<typeof installHooksMock>;
  const user = { id: "player-1" };
  const hudToken = { id: "token-1" };

  beforeEach(() => {
    hooks = installHooksMock();
    (global as any).game.user = user;
  });

  it("resolves true when the current user targets a token", async () => {
    const promise = awaitTargetSelection(hudToken);
    hooks.fire("targetToken", user, { id: "enemy-1" }, true);
    await expect(promise).resolves.toBe(true);
  });

  it("ignores targetToken events fired by other users", async () => {
    const promise = awaitTargetSelection(hudToken);
    hooks.fire("targetToken", { id: "another-player" }, { id: "enemy-1" }, true);
    // Then the real user targets — the promise should resolve to true.
    hooks.fire("targetToken", user, { id: "enemy-1" }, true);
    await expect(promise).resolves.toBe(true);
  });

  it("ignores targetToken events where targeted=false (untargeting)", async () => {
    const promise = awaitTargetSelection(hudToken);
    hooks.fire("targetToken", user, { id: "enemy-1" }, false);
    hooks.fire("targetToken", user, { id: "enemy-2" }, true);
    await expect(promise).resolves.toBe(true);
  });

  describe("cancellation signals", () => {
    it("resolves false when the user presses Escape", async () => {
      const promise = awaitTargetSelection(hudToken);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await expect(promise).resolves.toBe(false);
    });

    it("ignores non-Escape keys", async () => {
      const promise = awaitTargetSelection(hudToken);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      // Then Escape actually cancels.
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await expect(promise).resolves.toBe(false);
    });

    it("resolves false when the HUD token is deselected", async () => {
      const promise = awaitTargetSelection(hudToken);
      hooks.fire("controlToken", hudToken, false);
      await expect(promise).resolves.toBe(false);
    });

    it("ignores deselection of other tokens", async () => {
      const promise = awaitTargetSelection(hudToken);
      hooks.fire("controlToken", { id: "other-token" }, false);
      // Then the actual HUD token is deselected.
      hooks.fire("controlToken", hudToken, false);
      await expect(promise).resolves.toBe(false);
    });

    it("ignores controlToken selection events (controlled=true)", async () => {
      const promise = awaitTargetSelection(hudToken);
      hooks.fire("controlToken", hudToken, true);
      hooks.fire("controlToken", hudToken, false);
      await expect(promise).resolves.toBe(false);
    });

    it("resolves false when combat ends", async () => {
      const promise = awaitTargetSelection(hudToken);
      hooks.fire("deleteCombat");
      await expect(promise).resolves.toBe(false);
    });
  });

  describe("listener cleanup", () => {
    it("removes all hook listeners after resolving via target", async () => {
      const promise = awaitTargetSelection(hudToken);
      expect(hooks.count("targetToken")).toBe(1);
      expect(hooks.count("controlToken")).toBe(1);
      expect(hooks.count("deleteCombat")).toBe(1);
      hooks.fire("targetToken", user, {}, true);
      await promise;
      expect(hooks.count("targetToken")).toBe(0);
      expect(hooks.count("controlToken")).toBe(0);
      expect(hooks.count("deleteCombat")).toBe(0);
    });

    it("removes all listeners after cancelling via Escape", async () => {
      const promise = awaitTargetSelection(hudToken);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await promise;
      expect(hooks.count("targetToken")).toBe(0);
      expect(hooks.count("controlToken")).toBe(0);
      expect(hooks.count("deleteCombat")).toBe(0);
    });

    it("removes all listeners after cancelling via controlToken", async () => {
      const promise = awaitTargetSelection(hudToken);
      hooks.fire("controlToken", hudToken, false);
      await promise;
      expect(hooks.count("targetToken")).toBe(0);
      expect(hooks.count("controlToken")).toBe(0);
      expect(hooks.count("deleteCombat")).toBe(0);
    });

    it("removes all listeners after cancelling via deleteCombat", async () => {
      const promise = awaitTargetSelection(hudToken);
      hooks.fire("deleteCombat");
      await promise;
      expect(hooks.count("targetToken")).toBe(0);
      expect(hooks.count("controlToken")).toBe(0);
      expect(hooks.count("deleteCombat")).toBe(0);
    });

    it("does not double-resolve when multiple cancel signals fire", async () => {
      const promise = awaitTargetSelection(hudToken);
      const result = vi.fn();
      promise.then(result);
      // Fire three signals in quick succession — only the first wins.
      hooks.fire("controlToken", hudToken, false);
      hooks.fire("deleteCombat");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await promise;
      expect(result).toHaveBeenCalledOnce();
      expect(result).toHaveBeenCalledWith(false);
    });

    it("does not fire a stale targetToken after cancellation", async () => {
      const promise = awaitTargetSelection(hudToken);
      hooks.fire("deleteCombat");
      await promise;
      // Fire a late targetToken — should not affect the already-resolved promise.
      hooks.fire("targetToken", user, {}, true);
      // No assertion needed — the test passes if no unhandled promise or error occurs
      // and the listener count is still zero.
      expect(hooks.count("targetToken")).toBe(0);
    });
  });
});
