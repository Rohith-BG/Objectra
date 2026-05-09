import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BucketState, RateLimiterConfig, RateLimiterStore } from "../../../src/types/ratelimiter.types.js";
import { TokenBucket } from "../../../src/utils/helpers/tokenBucket.helper.js";
import { TooManyRequestsError } from "../../../src/utils/errors/http.errors.js";

function createMockStore() {
  return {
    get: vi.fn<(key: string) => Promise<BucketState | null>>(),
    set: vi.fn<(key: string, bucket: BucketState, ttl: number) => Promise<void>>(),
  };
}

const config: RateLimiterConfig = {
  maxTokens: 10,
  refillRate: 1,
  ttl: 60,
};

describe("TokenBucket", () => {
  let store: ReturnType<typeof createMockStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createMockStore();
  });

  describe("getMaxTokens", () => {
    it("returns the maxTokens from the config", () => {
      const bucket = new TokenBucket(store, config);

      expect(bucket.getMaxTokens()).toBe(10);
    });
  });

  describe("isAllowed", () => {
    it("creates a fresh bucket and allows the first request", async () => {
      store.get.mockResolvedValue(null);
      store.set.mockResolvedValue(undefined);

      const bucket = new TokenBucket(store, config);
      const result = await bucket.isAllowed("key:1");

      expect(result.remaining).toBe(9);
      expect(result.resetAt).toEqual(expect.any(Number));
      expect(store.set).toHaveBeenCalledWith(
        "key:1",
        expect.objectContaining({ tokens: 9 }),
        60,
      );
    });

    it("consumes one token from an existing bucket", async () => {
      const nowMs = Date.now();
      store.get.mockResolvedValue({ tokens: 5, lastRefill: nowMs } as BucketState);
      store.set.mockResolvedValue(undefined);

      const bucket = new TokenBucket(store, config);
      const result = await bucket.isAllowed("key:1");

      expect(result.remaining).toBe(4);
    });

    it("refills tokens based on elapsed time", async () => {
      const twoSecondsAgo = Date.now() - 2000;
      store.get.mockResolvedValue({ tokens: 5, lastRefill: twoSecondsAgo } as BucketState);
      store.set.mockResolvedValue(undefined);

      const bucket = new TokenBucket(store, config);
      const result = await bucket.isAllowed("key:1");

      // 5 tokens + ~2 seconds * 1 token/second = ~7 tokens; after consuming 1, remaining ≈ 6
      expect(result.remaining).toBeGreaterThanOrEqual(5);
      expect(result.remaining).toBeLessThanOrEqual(7);
    });

    it("caps refilled tokens at maxTokens", async () => {
      const tenSecondsAgo = Date.now() - 10_000;
      store.get.mockResolvedValue({ tokens: 5, lastRefill: tenSecondsAgo } as BucketState);
      store.set.mockResolvedValue(undefined);

      const bucket = new TokenBucket(store, config);
      const result = await bucket.isAllowed("key:1");

      // 5 + 10 = 15, capped at 10, minus 1 consumed = 9
      expect(result.remaining).toBe(9);
    });

    it("throws TooManyRequestsError when tokens are exhausted", async () => {
      store.get.mockResolvedValue({ tokens: 0, lastRefill: Date.now() } as BucketState);
      store.set.mockResolvedValue(undefined);

      const bucket = new TokenBucket(store, config);

      await expect(bucket.isAllowed("key:1")).rejects.toThrow(TooManyRequestsError);
      await expect(bucket.isAllowed("key:1")).rejects.toThrow(
        "Too many requests, please try again later",
      );
    });

    it("sets the retryAfter on TooManyRequestsError based on refill rate", async () => {
      store.get.mockResolvedValue({ tokens: 0, lastRefill: Date.now() } as BucketState);
      store.set.mockResolvedValue(undefined);

      const bucket = new TokenBucket(store, { ...config, refillRate: 2 });

      try {
        await bucket.isAllowed("key:1");
        expect.fail("Expected TooManyRequestsError");
      } catch (error) {
        expect(error).toBeInstanceOf(TooManyRequestsError);
        expect((error as TooManyRequestsError).retryAfter).toBe(1); // ceil(1/2) = 1
      }
    });

    it("persists the updated bucket state to the store after blocking", async () => {
      store.get.mockResolvedValue({ tokens: 0.3, lastRefill: Date.now() } as BucketState);
      store.set.mockResolvedValue(undefined);

      const bucket = new TokenBucket(store, config);

      await expect(bucket.isAllowed("key:1")).rejects.toThrow(TooManyRequestsError);

      expect(store.set).toHaveBeenCalledWith(
        "key:1",
        expect.objectContaining({ tokens: expect.any(Number) }),
        60,
      );
    });

    it("propagates store errors", async () => {
      store.get.mockRejectedValue(new Error("Redis unavailable"));

      const bucket = new TokenBucket(store, config);

      await expect(bucket.isAllowed("key:1")).rejects.toThrow("Redis unavailable");
    });
  });
});
