import { getUserById, getUserByName } from "../users/user.service.js";
import type { User, UserId, Username } from "../users/user.type.js";
import { NotFoundError } from "../utils/errors/notfound.error.js";
import bcrypt from "bcrypt"
import { UnauthorizedError } from "../utils/errors/unauthorized.error.js";
import type { AccessToken, RefreshToken, RefreshTokenItem, RevokeRefreshTokenResult } from "./auth.types.js";
import { extractUserIdFromToken, generateAccessToken, generateOpaqueToken, hashToken } from "../utils/jwt/jwt.utils.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import { DeleteCommand, PutCommand, QueryCommand, TransactWriteCommand, type DeleteCommandInput, type DeleteCommandOutput, type GetCommandInput, type PutCommandInput, type PutCommandOutput, type QueryCommandInput, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import DynamoDbClient from "../configs/dynamoDb.client.js";
import dotenv from "dotenv"
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";
dotenv.config()


export async function getAcessAndRefreshToken(name: Username, password: string, ctx?: CanonicalLogContext) {
    try {
        const opStart = performance.now();

        const user: User = await getUserByName(name, ctx)

        if (!user) {
            throw new UnauthorizedError(`Invalid credentials`)
        }

        const isPasswordValid = await bcrypt.compare(password, user.password!);

        if (!isPasswordValid) {
            throw new UnauthorizedError(`Invalid credentials`)
        }

        const accessTokenPayload = {
            id: user.id,
            role: user.role,
            allowedFolders: user.allowedFolders
        }

        const accessToken: AccessToken = generateAccessToken(accessTokenPayload)

        const refreshToken: RefreshToken = generateOpaqueToken(user.id)

        const refreshTokenTTL = (Date.now() / 1000) + Number(process.env.REFRESHTOKEN_TTL!)

        await saveRefreshToken(refreshToken, user.id, refreshTokenTTL, ctx)

        if (ctx) {
            ctx.operations.push({ name: "getAccessAndRefreshToken", result: "success", durationMs: Math.round(performance.now() - opStart) });
        }

        return { accessToken, refreshToken }
    }
    catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "getAccessAndRefreshToken", result: "failure" });
        }
        throw error
    }
}

async function saveRefreshToken(refreshToken: RefreshToken, userId: UserId, ttl: number, ctx?: CanonicalLogContext) {
    try {
        const opStart = performance.now();

        const refreshTokenObject = {
            id: `RefreshToken@${RandomIdGenerator.getId()}`,
            userId: userId,
            refreshToken: hashToken(refreshToken),
            createdAt: new Date().toISOString(),
            ttl: ttl
        }

        const putCommandInput: PutCommandInput = {
            TableName: process.env.REFRESHTOKENS_TABLE,
            Item: refreshTokenObject
        }

        await DynamoDbClient.send(new PutCommand(putCommandInput))

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "saveRefreshToken", result: "success", durationMs });
        }

    }
    catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "saveRefreshToken", result: "failure" });
        }
        throw error
    }
}

export async function refreshAcessToken(refreshToken: RefreshToken, ctx?: CanonicalLogContext) {
    try {
        const opStart = performance.now();

        const hashedToken = hashToken(refreshToken)

        const refreshTokenItem = await getRefreshTokenByToken(hashedToken, ctx)

        if (!refreshTokenItem) {
            const userId = extractUserIdFromToken(refreshToken)

            if (!userId) {
                throw new UnauthorizedError("Invalid refresh token");
            }

            const userSessions = await getRefreshTokenItemsByUserId(userId, ctx)

            if (userSessions && userSessions.length > 0) {
                await revokeAllUserSessions(userId, ctx)
                throw new UnauthorizedError("Token reuse detected , all sessions revoked")
            }

            throw new UnauthorizedError("Session expired")
        }

        const currentTimeInSeconds = Math.floor(Date.now() / 1000)

        if (currentTimeInSeconds > refreshTokenItem.ttl) {
            await deleteRefreshTokenItemById(refreshTokenItem.id, ctx);
            throw new UnauthorizedError("Session expired");
        }

        const user: User = await getUserById(refreshTokenItem.userId, ctx);

        if (!user) {
            await deleteRefreshTokenItemById(refreshTokenItem.id, ctx);
            throw new UnauthorizedError("User not found - login again");
        }

        const accessTokenPayload = {
            id: user.id,
            role: user.role,
            allowedFolders: user.allowedFolders,
        };

        const accessToken: AccessToken = generateAccessToken(accessTokenPayload)

        const newRefreshToken: RefreshToken = generateOpaqueToken(user.id)

        await rotateRefreshToken(
            refreshTokenItem.id,
            newRefreshToken,
            refreshTokenItem.userId,
            refreshTokenItem.ttl,
            ctx
        );

        if (ctx) {
            ctx.operations.push({ name: "refreshAccessToken", result: "success", durationMs: Math.round(performance.now() - opStart) });
        }

        return {
            accessToken,
            newRefreshToken,
            expiresAt: refreshTokenItem.ttl
        }
    }
    catch (error: unknown) {
        throw error
    }
}

async function getRefreshTokenByToken(refreshToken: RefreshToken, ctx?: CanonicalLogContext): Promise<RefreshTokenItem | null> {
    try {
        const opStart = performance.now();

        const queryCommandInput: QueryCommandInput = {
            TableName: process.env.REFRESHTOKENS_TABLE,
            IndexName: process.env.REFRESHTOKEN_INDEX,
            KeyConditionExpression: "refreshToken = :refreshToken",
            ExpressionAttributeValues: { ":refreshToken": refreshToken },
            Limit: 1
        }

        const queryCommandOutPut: QueryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
        }

        if (!queryCommandOutPut?.Items || queryCommandOutPut?.Items?.length === 0) {
            if (ctx) {
                ctx.operations.push({ name: "getRefreshTokenByToken", result: "skipped", detail: "not_found" });
            }
            return null
        }

        const refreshTokenItem: RefreshTokenItem = queryCommandOutPut?.Items[0] as RefreshTokenItem

        if (ctx) {
            ctx.operations.push({ name: "getRefreshTokenByToken", result: "success" });
        }

        return refreshTokenItem
    }
    catch (error: unknown) {
        throw error
    }
}

async function getRefreshTokenItemsByUserId(userId: UserId, ctx?: CanonicalLogContext): Promise<RefreshTokenItem[] | null> {
    try {
        const opStart = performance.now();

        const queryCommandInput: QueryCommandInput = {
            TableName: process.env.REFRESHTOKENS_TABLE,
            IndexName: process.env.REFRESHTOKEN_USERID_INDEX,
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId }
        }

        const queryCommandOutPut: QueryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
        }

        if (!queryCommandOutPut?.Items || queryCommandOutPut?.Items?.length === 0) {
            return null
        }

        const refreshTokenItems: RefreshTokenItem[] = queryCommandOutPut?.Items as RefreshTokenItem[]

        return refreshTokenItems
    }
    catch (error: any) {
        throw error
    }
}

async function deleteRefreshTokenItemById(refreshTokenItemId: string, ctx?: CanonicalLogContext): Promise<void> {
    try {
        const opStart = performance.now();

        const deleteCommandInput: DeleteCommandInput = {
            TableName: process.env.REFRESHTOKENS_TABLE,
            Key: {
                id: refreshTokenItemId
            },
            ConditionExpression: "attribute_exists(id)",
            ReturnValues: "ALL_OLD"
        }

        const deleteCommandOutput: DeleteCommandOutput = await DynamoDbClient.send(new DeleteCommand(deleteCommandInput))

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "deleteRefreshTokenItemById", result: "success", durationMs });
        }

        return
    }
    catch (error: unknown) {
        if (error instanceof ConditionalCheckFailedException) {
            throw new NotFoundError(`RefreshTokenItem with that id not found`)
        }
        throw error
    }
}

export async function revokeAllUserSessions(userId: UserId, ctx?: CanonicalLogContext): Promise<void> {
    try {
        const userSessions: RefreshTokenItem[] | null = await getRefreshTokenItemsByUserId(userId, ctx)

        if (!userSessions) {
            if (ctx) {
                ctx.operations.push({ name: "revokeAllUserSessions", result: "skipped", detail: "no_sessions" });
            }
            return
        }

        await Promise.all(
            userSessions.map((userSession) => {
                deleteRefreshTokenItemById(userSession?.id, ctx)
            })
        )

        if (ctx) {
            ctx.operations.push({ name: "revokeAllUserSessions", result: "success", detail: `revoked_${userSessions.length}_sessions` });
        }
    }
    catch (error: unknown) {
        throw error
    }
}

async function rotateRefreshToken(
    oldId: string,
    newRawToken: RefreshToken,
    userId: UserId,
    ttl: number,
    ctx?: CanonicalLogContext
): Promise<void> {
    try {
        const opStart = performance.now();

        await DynamoDbClient.send(
            new TransactWriteCommand({
                TransactItems: [
                    {
                        Delete: {
                            TableName: process.env.REFRESHTOKENS_TABLE!,
                            Key: { id: oldId },
                        },
                    },
                    {
                        Put: {
                            TableName: process.env.REFRESHTOKENS_TABLE!,
                            Item: {
                                id: `RefreshToken@${RandomIdGenerator.getId()}`,
                                userId: userId,
                                refreshToken: hashToken(newRawToken),
                                createdAt: new Date().toISOString(),
                                ttl: ttl,
                            },
                        },
                    },
                ],
            })
        );

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "rotateRefreshToken", result: "success", durationMs });
        }
    } catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "rotateRefreshToken", result: "failure" });
        }
        throw new Error(
            `Failed to rotate refresh token for userId ${userId}: ${error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

export async function revokeRefreshToken(refreshToken: RefreshToken, ctx?: CanonicalLogContext): Promise<RevokeRefreshTokenResult> {
    try {
        const hashedToken = hashToken(refreshToken)

        const refreshTokenItem = await getRefreshTokenByToken(hashedToken, ctx)

        if (!refreshTokenItem) {
            if (ctx) {
                ctx.operations.push({ name: "revokeRefreshToken", result: "skipped", detail: "already_logged_out" });
            }
            return { status: "ALREADY_LOGGED_OUT" }
        }

        await deleteRefreshTokenItemById(refreshTokenItem?.id, ctx)

        if (ctx) {
            ctx.operations.push({ name: "revokeRefreshToken", result: "success" });
        }

        return { status: "SUCCESS" }
    }
    catch (error: unknown) {
        throw error
    }
}
