import { Redis } from "ioredis"
import type { BucketState, RateLimiterStore } from "../../types/ratelimiter.types.js"

export class TokenBucketStore implements RateLimiterStore {
  private readonly redisClient: Redis

  constructor(redisClient: Redis) {
    this.redisClient = redisClient
  }

  async get(key: string): Promise<BucketState | null> {
    try {
      const data = await this.redisClient.get(key)

      if (!data) return null

      return JSON.parse(data) as BucketState

    } catch (error: unknown) {
      throw new Error(
        `Failed to get bucket state for key ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  async set(key:string,bucket:BucketState,ttl:number):Promise<void> {
    try {
      await this.redisClient.set(
        key,
        JSON.stringify(bucket),
        "EX",
        ttl
      )

    } catch (error: unknown) {
      throw new Error(
        `Failed to set bucket state for key ${key}: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }
}
