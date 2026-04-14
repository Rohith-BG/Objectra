
export interface RateLimiterConfig {
  maxTokens  : number
  refillRate : number
  ttl : number
}

export interface BucketState {
  tokens : number
  lastRefill: number
}

export interface RateLimiterResult {
  remaining   : number
  resetAt     : number
}

export interface RateLimiterStore {
  get(key: string): Promise<BucketState | null>
  set(key: string, bucket: BucketState, ttl: number): Promise<void>
}