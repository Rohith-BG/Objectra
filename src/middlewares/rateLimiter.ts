import type { NextFunction, Request, Response } from "express"
import type { TokenBucket } from "../utils/helpers/tokenBucket.helper.js"
import { TooManyRequestsError } from "../utils/errors/toomanyrequest.error.js"

export class RateLimiterMiddleware {
  private readonly tokenBucket: TokenBucket

  constructor(tokenBucket: TokenBucket) {
    this.tokenBucket = tokenBucket
  }

  handle() {
    return async (
      req : Request,
      res : Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const ip  = req.ip ?? "unknown"
        const key = `ratelimit:global:${ip}`

        const result = await this.tokenBucket.isAllowed(key)

        res.setHeader("X-RateLimit-Limit"    , this.tokenBucket.getMaxTokens())
        res.setHeader("X-RateLimit-Remaining", result.remaining)
        res.setHeader("X-RateLimit-Reset"    , result.resetAt)

        next()

      } catch (error: unknown) {
        if (error instanceof TooManyRequestsError) {
          const retryAfter = error.retryAfter

          res.setHeader("X-RateLimit-Limit"    , this.tokenBucket.getMaxTokens())
          res.setHeader("X-RateLimit-Remaining", 0)
          res.setHeader("X-RateLimit-Reset"    , retryAfter)
          res.setHeader("Retry-After"          , retryAfter)

          res.status(error.statusCode).json({
            message   : error.message,
            retryAfter,
          })
          return
        }

        // Redis failure - fail open, never block legitimate traffic
        console.error("Rate limiter error:", error)
        next()
      }
    }
  }
}