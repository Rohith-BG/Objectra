import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type DeleteCommandInput, type DeleteCommandOutput, type GetCommandInput, type GetCommandOutput, type PutCommandInput, type PutCommandOutput, type QueryCommandInput, type QueryCommandOutput, type UpdateCommandInput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import { getFoldersByIds } from "../folders/folder.service.js";
import { USER_ROLES } from "../utils/constants/user.roles.constants.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors/http.errors.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import type { createUserInput, User, UserId, Username } from "./user.type.js";
import bcrypt from "bcrypt"
import DynamoDbClient from "../configs/dynamoDb.client.js";
import RedisClient from "../configs/redis.client.js";
import { USER_CACHE } from "../utils/constants/cache.constants.js";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import dotenv from "dotenv"
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";
dotenv.config()


export async function createUser(input: createUserInput, ctx?: CanonicalLogContext): Promise<Omit<User, "password">> {
    try {
        const opStart = performance.now();

        if (input?.role === USER_ROLES.ADMIN) {
            throw new ForbiddenError(`Forbidden to create the user with role as admin`)
        }

        const existingUser: User = await getUserByName(input?.name, ctx)

        if (existingUser) {
            throw new BadRequestError(`Username:${input.name} already exists`)
        }

        await getFoldersByIds(input?.allowedFolders, ctx)

        const hashedPassword = await bcrypt.hash(input?.password, 12)

        const user: User = {
            id: `User@${RandomIdGenerator.getId()}`,
            name: input?.name,
            password: hashedPassword,
            role: input?.role,
            allowedFolders: input?.allowedFolders,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        const putCommandInput: PutCommandInput = {
            TableName: process.env.USERS_TABLE,
            Item: user
        }

        const putCommandOutput: PutCommandOutput = await DynamoDbClient.send(new PutCommand(putCommandInput))

        const { password, ...createdUser } = user

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "createUser", result: "success", durationMs });
        }

        return createdUser
    }
    catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "createUser", result: "failure" });
        }
        throw error
    }

}

export async function getUserByName(username: Username, ctx?: CanonicalLogContext): Promise<User> {
    try {
        const opStart = performance.now();

        const cachedUser = await RedisClient.get(USER_CACHE.USERNAME(username))

        if (cachedUser) {
            if (ctx) {
                ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                ctx.cache.hits += 1;
                ctx.operations.push({ name: "getUserByName", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
            }
            return JSON.parse(cachedUser)
        }

        if (ctx) {
            ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
            ctx.cache.misses += 1;
        }

        const queryCommandInput: QueryCommandInput = {
            TableName: process.env.USERS_TABLE,
            IndexName: process.env.USERNAME_INDEX,
            KeyConditionExpression: "#name = :name",
            ExpressionAttributeNames: {
                "#name": "name"
            },
            ExpressionAttributeValues: {
                ":name": username
            }
        }

        const queryCommandOutput: QueryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        const user = queryCommandOutput?.Items?.[0] as User

        if (user) {
            const { password, ...createdUser } = user;
            await RedisClient.set(
                USER_CACHE.USERNAME(USER_CACHE.USERNAME(username)),
                JSON.stringify(createdUser),
                "EX",
                USER_CACHE.USER_TTL
            )
        }

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "getUserByName", result: user ? "success" : "skipped", durationMs, detail: user ? "fetched_from_db" : "not_found" });
        }

        return user ?? null
    }
    catch (error: unknown) {
        throw error
    }
}

export async function getUserById(userId: UserId, ctx?: CanonicalLogContext): Promise<Omit<User, "password">> {
    try {
        const opStart = performance.now();

        const cachedUser = await RedisClient.get(USER_CACHE.USERID(userId))

        if (cachedUser) {
            if (ctx) {
                ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                ctx.cache.hits += 1;
                ctx.operations.push({ name: "getUserById", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
            }
            return JSON.parse(cachedUser)
        }

        if (ctx) {
            ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
            ctx.cache.misses += 1;
        }

        const getCommandInput: GetCommandInput = {
            TableName: process.env.USERS_TABLE,
            Key: {
                id: userId
            }
        }

        const getCommandOutput: GetCommandOutput = await DynamoDbClient.send(new GetCommand(getCommandInput))

        if (!getCommandOutput?.Item) {
            if (ctx) {
                ctx.operations.push({ name: "getUserById", result: "failure", durationMs: Math.round(performance.now() - opStart), detail: "not_found" });
            }
            throw new NotFoundError(`User with userId:${userId} not found`)
        }

        const user: User = getCommandOutput?.Item as User

        await RedisClient.set(
            USER_CACHE.USERID(userId),
            JSON.stringify(user),
            "EX",
            USER_CACHE.USER_TTL
        )

        const { password, ...fetchedUser } = user

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "getUserById", result: "success", durationMs, detail: "fetched_from_db" });
        }

        return fetchedUser
    }
    catch (error: unknown) {
        throw error
    }
}

export async function updateUserPasswordById(userId: UserId, password: string, ctx?: CanonicalLogContext): Promise<void> {
    try {
        const opStart = performance.now();

        const hashedPassword: string = await bcrypt.hash(password, 12);

        const updateCommandInput: UpdateCommandInput = {
            TableName: process.env.USERS_TABLE,
            Key: {
                id: userId
            },
            UpdateExpression: "Set password = :password , updatedAt = :updatedAt",
            ExpressionAttributeValues: {
                ":password": hashedPassword,
                ":updatedAt": new Date().toISOString()
            },
            ConditionExpression: "attribute_exists(id)"
        }

        const updateCommandOutput: UpdateCommandOutput = await DynamoDbClient.send(
            new UpdateCommand(updateCommandInput)
        )

        const user: User = updateCommandOutput?.Attributes as User

        await Promise.all([
            RedisClient.del(USER_CACHE.USERID(userId)),
            RedisClient.del(USER_CACHE.USERNAME(user?.name))
        ])

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "updateUserPasswordById", result: "success", durationMs });
        }

    }
    catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "updateUserPasswordById", result: "failure" });
        }
        throw new NotFoundError(`User with the userId:${userId} not found`)
    }
}

// First think how to invalidate the JWT Token 
// export async function updateUserRole(userId : UserId , userRole : string):Promise<void>{
//     try{

//     }
// }


export async function deleteUserById(userId: UserId, ctx?: CanonicalLogContext): Promise<User> {
    try {
        const opStart = performance.now();

        const deleteCommandInput: DeleteCommandInput = {
            TableName: process.env.USERS_TABLE,
            Key: {
                id: userId
            },
            ConditionExpression: "attribute_exists(id)",
            ReturnValues: "ALL_OLD"
        }

        const deleteCommandOutput: DeleteCommandOutput = await DynamoDbClient.send(new DeleteCommand(deleteCommandInput))

        const user: User = deleteCommandOutput?.Attributes as User

        await Promise.allSettled([
            RedisClient.del(USER_CACHE.USERID(userId)),
            RedisClient.del(USER_CACHE.USERNAME(user?.name))
        ])

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "deleteUserById", result: "success", durationMs });
        }

        return user

    }
    catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "deleteUserById", result: "failure" });
        }

        if (error instanceof ConditionalCheckFailedException) {
            throw new NotFoundError(`User with the id:${userId} not exists to delete`)
        }
        throw error
    }
}