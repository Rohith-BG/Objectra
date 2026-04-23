import { randomUUID } from "node:crypto";
import RedisClient from "../../configs/redis.client.js";

const DEFAULT_LOCK_TTL_SECONDS = 5;

export async function acquireLock(lockKey: string,ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS): Promise<string | null> {
    const lockValue = randomUUID();
    const result = await RedisClient.set(lockKey, lockValue, "EX", ttlSeconds, "NX");

    return result === "OK" ? lockValue : null;
}


export async function releaseLock(lockKey: string,lockValue: string): Promise<boolean> {
    const luaScript = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
            return redis.call("DEL", KEYS[1])
        else
            return 0
        end
    `;

    const result = await RedisClient.eval(luaScript, 1, lockKey, lockValue);
    return result === 1;
}
