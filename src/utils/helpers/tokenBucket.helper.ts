import type { RateLimiterConfig, RateLimiterResult, RateLimiterStore } from "../../types/ratelimiter.types.js"
import { TooManyRequestsError } from "../errors/toomanyrequest.error.js"

// export class TokenBucket {
//   private readonly store : RateLimiterStore
//   private readonly config: RateLimiterConfig

//   constructor(store: RateLimiterStore, config: RateLimiterConfig) {
//     this.store  = store
//     this.config = config
//   }

//   getMaxTokens(): number {
//     return this.config.maxTokens
//   }

//   async isAllowed(key: string): Promise<RateLimiterResult> {
//     const { maxTokens, refillRate, ttl } = this.config

//     const nowMs      = Date.now()
//     const nowSeconds = Math.floor(nowMs / 1000)

//     // 1. Fetch existing bucket or create a fresh one
//     let bucket = await this.store.get(key)

//     if (!bucket) {
//       bucket = {
//         tokens    : maxTokens,
//         lastRefill: nowMs,
//       }
//     }

//     // 2. Calculate tokens to add based on elapsed time since last refill
//     const elapsedSeconds = (nowMs - bucket.lastRefill) / 1000
//     const tokensToAdd    = elapsedSeconds * refillRate

//     // 3. Refill bucket — capped at maxTokens
//     const refilledTokens = Math.min(maxTokens, bucket.tokens + tokensToAdd)

//     // 4. Calculate resetAt — seconds until bucket is fully refilled
//     const tokensNeeded  = maxTokens - refilledTokens
//     const secondsToFull = tokensNeeded / refillRate
//     const resetAt       = Math.floor(nowSeconds + secondsToFull)

//     // 5. Not enough tokens — blocked
//     if (refilledTokens < 1) {
//       await this.store.set(
//         key,
//         { tokens: refilledTokens, lastRefill: nowMs },
//         ttl
//       )

//       throw new TooManyRequestsError("Too many requests — please try again later")
//     }

//     // 6. Consume 1 token — allowed
//     const remainingTokens = refilledTokens - 1

//     await this.store.set(
//       key,
//       { tokens: remainingTokens, lastRefill: nowMs },
//       ttl
//     )

//     return {
//       allowed  : true,
//       remaining: Math.floor(remainingTokens),
//       resetAt,
//     }
//   }
// }

export class TokenBucket {
  private readonly store : RateLimiterStore
  private readonly config: RateLimiterConfig

  constructor(store: RateLimiterStore, config: RateLimiterConfig) {
    this.store  = store
    this.config = config
  }

  getMaxTokens(): number {
    return this.config.maxTokens
  }

  async isAllowed(key: string): Promise<RateLimiterResult> {
    const { maxTokens, refillRate, ttl } = this.config

    const nowMs      = Date.now()
    const nowSeconds = Math.floor(nowMs / 1000)

    // 1. Fetch existing bucket or create a fresh one
    let bucket = await this.store.get(key)

    if (!bucket) {
      bucket = {
        tokens    : maxTokens,
        lastRefill: nowMs,
      }
    }

    // 2. Calculate tokens to add based on elapsed time since last refill
    const elapsedSeconds = (nowMs - bucket.lastRefill) / 1000
    const tokensToAdd    = elapsedSeconds * refillRate

    // 3. Refill bucket - capped at maxTokens
    const refilledTokens = Math.min(maxTokens, bucket.tokens + tokensToAdd)

    // 4. Calculate resetAt - seconds until bucket is fully refilled
    const tokensNeeded  = maxTokens - refilledTokens
    const secondsToFull = tokensNeeded / refillRate
    const resetAt       = Math.floor(nowSeconds + secondsToFull)

    // 5. Not enough tokens - blocked
    if (refilledTokens < 1) {
      await this.store.set(
        key,
        { tokens: refilledTokens, lastRefill: nowMs },
        ttl
      )

      const retryAfter = Math.ceil(1 / refillRate)   // seconds until 1 token available

      throw new TooManyRequestsError(
        "Too many requests, please try again later",
        retryAfter                                    // retryAfter passed here
      )
    }

    // 6. Consume 1 token - allowed
    const remainingTokens = refilledTokens - 1

    await this.store.set(
      key,
      { tokens: remainingTokens, lastRefill: nowMs },
      ttl
    )

    return {
      remaining: Math.floor(remainingTokens),
      resetAt,
    }
  }
}