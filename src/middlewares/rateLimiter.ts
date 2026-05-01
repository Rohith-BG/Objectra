import type { NextFunction, Request, Response } from "express"
import type { TokenBucket } from "../utils/helpers/tokenBucket.helper.js"
import type { CanonicalLogContext } from "../types/canonicalLog.types.js"
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
      const ctx = res.locals["log"] as CanonicalLogContext | undefined;

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

          if (ctx) {
            ctx.error = {
              name: error.name,
              message: error.message,
              isOperational: true,
            };
          }

          res.status(error.statusCode).json({
            message   : error.message,
            retryAfter,
          })
          return
        }

        if (ctx) {
          ctx.operations.push({
            name: "rateLimiter",
            result: "failure",
            detail: "redis_error_fail_open",
          });
        }

        next()
      }
    }
  }
}