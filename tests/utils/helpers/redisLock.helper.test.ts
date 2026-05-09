import { beforeEach, describe, expect, it, vi } from "vitest";

const { redisSetMock, redisEvalMock } = vi.hoisted(() => ({
  redisSetMock: vi.fn(),
  redisEvalMock: vi.fn(),
}));

vi.mock("../../../src/configs/redis.client.js", () => ({
  default: {
    set: redisSetMock,
    eval: redisEvalMock,
  },
}));

import { acquireLock, releaseLock } from "../../../src/utils/helpers/redisLock.helper.js";

describe("redisLock helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("acquireLock", () => {
    it("returns a lock value when Redis SET NX succeeds", async () => {
      redisSetMock.mockResolvedValue("OK");

      const result = await acquireLock("lock:test");

      expect(result).toEqual(expect.any(String));
      expect(result!.length).toBeGreaterThan(0);
      expect(redisSetMock).toHaveBeenCalledWith(
        "lock:test",
        expect.any(String),
        "EX",
        5,
        "NX",
      );
    });

    it("returns null when the lock is already held", async () => {
      redisSetMock.mockResolvedValue(null);

      const result = await acquireLock("lock:test");

      expect(result).toBeNull();
    });

    it("uses the provided TTL instead of the default", async () => {
      redisSetMock.mockResolvedValue("OK");

      await acquireLock("lock:test", 10);

      expect(redisSetMock).toHaveBeenCalledWith(
        "lock:test",
        expect.any(String),
        "EX",
        10,
        "NX",
      );
    });

    it("propagates Redis errors", async () => {
      redisSetMock.mockRejectedValue(new Error("Redis down"));

      await expect(acquireLock("lock:test")).rejects.toThrow("Redis down");
    });
  });

  describe("releaseLock", () => {
    it("returns true when the Lua script deletes the lock", async () => {
      redisEvalMock.mockResolvedValue(1);

      const result = await releaseLock("lock:test", "lock-uuid");

      expect(result).toBe(true);
      expect(redisEvalMock).toHaveBeenCalledWith(
        expect.stringContaining("redis.call"),
        1,
        "lock:test",
        "lock-uuid",
      );
    });

    it("returns false when the lock value does not match", async () => {
      redisEvalMock.mockResolvedValue(0);

      const result = await releaseLock("lock:test", "wrong-uuid");

      expect(result).toBe(false);
    });

    it("propagates Redis errors", async () => {
      redisEvalMock.mockRejectedValue(new Error("Redis down"));

      await expect(releaseLock("lock:test", "uuid")).rejects.toThrow("Redis down");
    });
  });
});
