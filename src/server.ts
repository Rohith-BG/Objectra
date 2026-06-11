import app from "./app.js"
import dotenv from "dotenv"
import RedisClient from "./configs/redis.client.js";
import { logger } from "./configs/logger.js";
import type { Server } from "node:http";
dotenv.config();

const SHUTDOWN_TIMEOUT_MS = 10_000;
let server: Server | undefined;
let isShuttingDown = false;

async function gracefulShutdown(signal: NodeJS.Signals) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    logger.info({ signal }, "Graceful shutdown started")

    const shutdownTimer = setTimeout(() => {
        logger.error({ signal }, "Graceful shutdown timed out")
        server?.closeAllConnections?.();
        process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)

    shutdownTimer.unref()

    try {
        if (server) {
            await new Promise<void>((resolve, reject) => {
                server?.close((err?: Error) => {
                    if (err) {
                        reject(err)
                        return;
                    }

                    resolve()
                })

                server?.closeIdleConnections?.();
            })
        }

        await RedisClient.quit()

        clearTimeout(shutdownTimer)

        logger.info({ signal }, "Graceful shutdown completed")
        process.exit(0)
    }
    catch (error: any) {
        clearTimeout(shutdownTimer)
        logger.error({ err: error, signal }, "Graceful shutdown failed")
        process.exit(1)
    }
}

async function startServer() {
    try {
        const redisClientPingResponse: string = await RedisClient.ping();

        if (redisClientPingResponse !== 'PONG') {
            throw new Error(`Redis ping failed : ${redisClientPingResponse}`,)
        }

        logger.info(`Redis Connnected`)

        server = app.listen(process.env.PORT, () => {
            logger.info(`Server started running on the port:${process.env.PORT}`)
        })
    }
    catch (error: any) {
        logger.fatal({ err: error }, "Failed to start server")
        process.exit(1)
    }
}

startServer()

process.on("SIGTERM", () => {
    void gracefulShutdown("SIGTERM")
})


/*
1. Database connection pooling - as the dynamo Db is http based connection so it makes the calls using the http so the connection pooling doesnot applies in this Db
2. Rate Limiting using redis and what with the express rate limiter
   Authentication , Authorization - Have to do this
   Unit testing - vitest
3. Caching the response in redis - Implemented
4.Efficent use of presigned urls for s3 and retires stratergies -> Presigned URLs are cached until the 2 mins earlier than the expiration of the TTL
5.How to contanirisation of app with docker
6. How to deploy the container
7. How to deploy the server in ec2 instance or in ECR / ECS (don't have an idea)

*/
// Have to change the logic in the delete folder to delete the allowed folders in the user attribute when the folder is deleted
