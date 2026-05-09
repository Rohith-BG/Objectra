import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenBucketStore } from "../../../src/utils/helpers/tokenBucketStore.helper.js";
import type { BucketState } from "../../../src/types/ratelimiter.types.js";

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
  };
}

describe("TokenBucketStore", () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let store: TokenBucketStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    store = new TokenBucketStore(mockRedis as any);
  });

  describe("get", () => {
    it("returns a parsed BucketState when the key exists in Redis", async () => {
      const bucketState: BucketState = { tokens: 5, lastRefill: 1234567890 };
      mockRedis.get.mockResolvedValue(JSON.stringify(bucketState));

      const result = await store.get("ratelimit:key");

      expect(result).toStrictEqual(bucketState);
      expect(mockRedis.get).toHaveBeenCalledWith("ratelimit:key");
    });

    it("returns null when the key does not exist in Redis", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await store.get("ratelimit:key");

      expect(result).toBeNull();
    });

    it("throws an error wrapping the Redis failure message", async () => {
      mockRedis.get.mockRejectedValue(new Error("connection refused"));

      await expect(store.get("ratelimit:key")).rejects.toThrow(
        "Failed to get bucket state for key ratelimit:key: connection refused",
      );
    });

    it("handles non-Error thrown values in the error message", async () => {
      mockRedis.get.mockRejectedValue("string error");

      await expect(store.get("ratelimit:key")).rejects.toThrow(
        "Failed to get bucket state for key ratelimit:key: string error",
      );
    });
  });

  describe("set", () => {
    it("serializes the bucket state and stores it with TTL", async () => {
      const bucketState: BucketState = { tokens: 8, lastRefill: 9999999 };
      mockRedis.set.mockResolvedValue("OK");

      await store.set("ratelimit:key", bucketState, 120);

      expect(mockRedis.set).toHaveBeenCalledWith(
        "ratelimit:key",
        JSON.stringify(bucketState),
        "EX",
        120,
      );
    });

    it("throws an error wrapping the Redis failure message", async () => {
      mockRedis.set.mockRejectedValue(new Error("timeout"));

      await expect(
        store.set("ratelimit:key", { tokens: 5, lastRefill: 0 }, 60),
      ).rejects.toThrow(
        "Failed to set bucket state for key ratelimit:key: timeout",
      );
    });

    it("handles non-Error thrown values in the error message", async () => {
      mockRedis.set.mockRejectedValue(42);

      await expect(
        store.set("ratelimit:key", { tokens: 5, lastRefill: 0 }, 60),
      ).rejects.toThrow(
        "Failed to set bucket state for key ratelimit:key: 42",
      );
    });
  });
});
