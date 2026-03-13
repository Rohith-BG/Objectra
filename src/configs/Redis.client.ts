import { Redis } from "ioredis"
import dotenv from "dotenv"
dotenv.config()

const RedisClient : Redis = new Redis({
    host : process.env.REDIS_HOST,
    port : Number(process.env.REDIS_PORT),
    password : process.env.REDIS_PASSWORD ,
    tls : process.env.REDIS_TLS === "true" ? {} : undefined,
    connectTimeout : 10_000,
    maxRetriesPerRequest : 3,
    retryStrategy(times: number) {
        if (times > 10) return null;
        return Math.min(times * 200, 3_000);
    }
})


export default RedisClient
