import { RateLimiterMiddleware } from "../middlewares/rateLimiter.js"
import { TokenBucket } from "../utils/helpers/tokenBucket.helper.js"
import { TokenBucketStore } from "../utils/helpers/tokenBucketStore.helper.js"
import RedisClient from "./redis.client.js"


const tokenBucketStore = new TokenBucketStore(RedisClient)

const tokenBucket = new TokenBucket(tokenBucketStore, {
  maxTokens  : 60,
  refillRate : 1,
  ttl        : 120,
})

const rateLimiter = new RateLimiterMiddleware(tokenBucket)

export default rateLimiter