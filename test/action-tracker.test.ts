import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  consumeAction,
  hasUsedAction,
  hasReacted,
  markActionUsed,
  markReacted,
  resetRoundState,
} from "../src/ts/dragonbane-action-tracker";

function makeMockActor() {
  const flags: Record<string, unknown> = {};
  return {
    id: "actor-1",
    getFlag: vi.fn((_scope: string, key: string) => flags[key]),
    setFlag: vi.fn(async (_scope: string, key: string, value: unknown) => {
      flags[key] = value;
    }),
    unsetFlag: vi.fn(async (_scope: string, key: string) => {
      delete flags[key];
    }),
    _flags: flags,
  };
}

describe("consumeAction", () => {
  let actor: ReturnType<typeof makeMockActor>;

  beforeEach(() => {
    actor = makeMockActor();
  });

  it("calls handler and marks action used when actor has not acted", async () => {
    const handler = vi.fn().mockResolvedValue("result");
    await consumeAction(actor, handler)(null);
    expect(handler).toHaveBeenCalledOnce();
    expect(actor.setFlag).toHaveBeenCalled();
  });

  it("does not call handler when actor already acted", async () => {
    await markActionUsed(actor);
    const handler = vi.fn().mockResolvedValue("result");
    await consumeAction(actor, handler)(null);
    expect(handler).not.toHaveBeenCalled();
  });

  it("marks reaction when isReaction option is set", async () => {
    const handler = vi.fn().mockResolvedValue("result");
    await consumeAction(actor, handler, { isReaction: true })(null);
    expect(hasReacted(actor)).toBe(true);
    expect(hasUsedAction(actor)).toBe(true);
  });

  describe("cancelIfFalsy option", () => {
    it("does NOT mark action used when handler returns undefined and cancelIfFalsy is true", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await consumeAction(actor, handler, { cancelIfFalsy: true })(null);
      expect(handler).toHaveBeenCalledOnce();
      expect(hasUsedAction(actor)).toBe(false);
    });

    it("does NOT mark action used when handler returns null and cancelIfFalsy is true", async () => {
      const handler = vi.fn().mockResolvedValue(null);
      await consumeAction(actor, handler, { cancelIfFalsy: true })(null);
      expect(hasUsedAction(actor)).toBe(false);
    });

    it("DOES mark action used when handler returns truthy value and cancelIfFalsy is true", async () => {
      const handler = vi.fn().mockResolvedValue({ some: "result" });
      await consumeAction(actor, handler, { cancelIfFalsy: true })(null);
      expect(hasUsedAction(actor)).toBe(true);
    });

    it("ALWAYS marks action used when cancelIfFalsy is false (default), even with undefined return", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await consumeAction(actor, handler)(null);
      expect(hasUsedAction(actor)).toBe(true);
    });

    it("does NOT mark reaction when handler returns undefined and cancelIfFalsy + isReaction are true", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      await consumeAction(actor, handler, {
        isReaction: true,
        cancelIfFalsy: true,
      })(null);
      expect(hasReacted(actor)).toBe(false);
      expect(hasUsedAction(actor)).toBe(false);
    });

    it("DOES mark reaction when handler returns truthy and cancelIfFalsy + isReaction are true", async () => {
      const handler = vi.fn().mockResolvedValue({ test: true });
      await consumeAction(actor, handler, {
        isReaction: true,
        cancelIfFalsy: true,
      })(null);
      expect(hasReacted(actor)).toBe(true);
      expect(hasUsedAction(actor)).toBe(true);
    });
  });
});

describe("hasUsedAction / markActionUsed / resetRoundState", () => {
  let actor: ReturnType<typeof makeMockActor>;

  beforeEach(() => {
    actor = makeMockActor();
  });

  it("returns false before any action is taken", () => {
    expect(hasUsedAction(actor)).toBe(false);
  });

  it("returns true after markActionUsed", async () => {
    await markActionUsed(actor);
    expect(hasUsedAction(actor)).toBe(true);
  });

  it("returns false after resetRoundState", async () => {
    await markActionUsed(actor);
    await resetRoundState(actor);
    expect(hasUsedAction(actor)).toBe(false);
  });

  it("handles undefined actor gracefully", () => {
    expect(hasUsedAction(undefined)).toBe(false);
  });
});

describe("hasReacted / markReacted", () => {
  let actor: ReturnType<typeof makeMockActor>;

  beforeEach(() => {
    actor = makeMockActor();
  });

  it("returns false before any reaction", () => {
    expect(hasReacted(actor)).toBe(false);
  });

  it("returns true after markReacted and also sets action flag", async () => {
    await markReacted(actor);
    expect(hasReacted(actor)).toBe(true);
    expect(hasUsedAction(actor)).toBe(true);
  });

  it("reaction and action flags are both cleared by resetRoundState", async () => {
    await markReacted(actor);
    await resetRoundState(actor);
    expect(hasReacted(actor)).toBe(false);
    expect(hasUsedAction(actor)).toBe(false);
  });
});
