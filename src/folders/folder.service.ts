import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand, type DeleteCommandInput, type DeleteCommandOutput, type GetCommandInput, type GetCommandOutput, type PutCommandOutput, type QueryCommandInput, type UpdateCommandInput } from "@aws-sdk/lib-dynamodb"
import DynamoDbClient from "../configs/dynamoDb.client.js"
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js"
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors/http.errors.js"
import type { Folder, FolderId, FolderName, ParentId } from "./folder.types.js"

import { ConditionalCheckFailedException, ResourceNotFoundException } from "@aws-sdk/client-dynamodb"
import dotenv from 'dotenv'
import RedisClient from "../configs/redis.client.js"
import { CACHE_KEYS } from "../utils/constants/cache.constants.js"
import { getUploadedObjectsByFolderId } from "../objects/object.service.js"
import { assertFolderAccess, filterAllowedFolders } from "../utils/helpers/folder.helper.js"

import type { CanonicalLogContext } from "../types/canonicalLog.types.js"
dotenv.config()


export async function createFolder(folderName: string, parentId: ParentId, ctx?: CanonicalLogContext): Promise<Folder> {
    try {
        const opStart = performance.now();

        parentId = parentId === null ? 'ROOT' : (await getFolderById(parentId))?.id

        const folder: Folder = {
            id: `Folder@${RandomIdGenerator.getId()}`,
            name: folderName,
            parentId: parentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        const putCommand: PutCommand = new PutCommand({
            TableName: process.env.FOLDERS_TABLE,
            Item: folder
        })

        const putCommandOutput = await DynamoDbClient.send(putCommand)

        if (parentId === "ROOT") {
            await RedisClient.del(CACHE_KEYS.MAIN_FOLDERS);
        } else {
            await RedisClient.del(CACHE_KEYS.SUB_FOLDERS(parentId));
        }

        if (ctx) {
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "createFolder", result: "success", durationMs });
        }

        return folder
    }
    catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "createFolder", result: "failure" });
        }

        if (error instanceof ResourceNotFoundException) {
            throw new BadRequestError(`Folder failed to create as the required resource not exists in DB`)
        }
        else if (error instanceof NotFoundError) {
            throw new NotFoundError(`Parent folder with id ${parentId} not found`);
        }
        else throw error
    }
}

export async function getFolderById(folderId: string, allowedFolders?: string[], ctx?: CanonicalLogContext): Promise<Folder> {
    try {
        const opStart = performance.now();

        const cachedMainFoldersList = await RedisClient.get(CACHE_KEYS.MAIN_FOLDERS);

        if (cachedMainFoldersList) {
            const folders = JSON.parse(cachedMainFoldersList) as Folder[];
            const folder = folders.find(f => f?.id === folderId);

            if (folder !== undefined) {
                assertFolderAccess(folder.id, allowedFolders)

                if (ctx) {
                    ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                    ctx.cache.hits += 1;
                    ctx.operations.push({ name: "getFolderById", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
                }

                return folder
            }
        }

        const individualFolderKey = CACHE_KEYS.FOLDER(folderId)

        const cachedFolder = await RedisClient.get(individualFolderKey)

        if (cachedFolder) {
            const folder = JSON.parse(cachedFolder) as Folder;
            assertFolderAccess(folder.id, allowedFolders);

            if (ctx) {
                ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                ctx.cache.hits += 1;
                ctx.operations.push({ name: "getFolderById", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
            }

            return folder
        }

        if (ctx) {
            ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
            ctx.cache.misses += 1;
        }

        const getCommandInput: GetCommandInput = {
            TableName: process.env.FOLDERS_TABLE,
            Key: {
                id: folderId
            }
        }

        const getCommandOutput: GetCommandOutput = await DynamoDbClient.send(new GetCommand(getCommandInput))

        if (!getCommandOutput?.Item) {
            if (ctx) {
                ctx.operations.push({ name: "getFolderById", result: "failure", durationMs: Math.round(performance.now() - opStart), detail: "not_found" });
            }
            throw new NotFoundError(`Folder with this id not exists`)
        }

        const folder = getCommandOutput?.Item as Folder

        if (folder.parentId !== "ROOT") {
            await RedisClient.set(
                individualFolderKey,
                JSON.stringify(folder),
                "EX",
                1800)
        }

        assertFolderAccess(folder.id, allowedFolders)

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "getFolderById", result: "success", durationMs, detail: "fetched_from_db" });
        }

        return folder
    }
    catch (error: unknown) {
        throw error
    }
}

export async function getFoldersByIds(folderIds: FolderId[], ctx?: CanonicalLogContext): Promise<Folder[]> {
    try {
        if (!folderIds || folderIds.length === 0) {
            return []
        }

        const folders: PromiseSettledResult<Folder>[] = await Promise.allSettled(
            folderIds
                .filter(folderId => folderId !== undefined && folderId !== null)
                .map((folderId: FolderId) => {
                    return getFolderById(folderId, undefined, ctx)
                })
        )

        const failedFolderIds = folderIds.filter(
            (_, index) => folders[index]?.status === "rejected"
        );

        if (failedFolderIds.length > 0) {
            throw new NotFoundError(
                `Following folderId's do not exist: ${failedFolderIds.join(", ")}`
            );
        }

        return folders
            .map(folder => (folder as PromiseFulfilledResult<Folder>).value);
    }
    catch (error: unknown) {
        throw error
    }
}

export async function listAllMainFolders(allowedFolders: string[] | undefined, ctx?: CanonicalLogContext): Promise<Folder[]> {
    try {
        const opStart = performance.now();

        const cachedFolders = await RedisClient.get(CACHE_KEYS?.MAIN_FOLDERS)

        if (cachedFolders) {
            const folders: Folder[] = JSON.parse(cachedFolders)

            if (ctx) {
                ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                ctx.cache.hits += 1;
                ctx.operations.push({ name: "listAllMainFolders", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
            }

            return filterAllowedFolders(folders, allowedFolders)
        }

        if (ctx) {
            ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
            ctx.cache.misses += 1;
        }

        const queryCommandInput: QueryCommandInput = {
            TableName: process.env.FOLDERS_TABLE,
            IndexName: process.env.PARENTID_INDEX,
            KeyConditionExpression: "parentId=:parentId",
            ExpressionAttributeValues: {
                ":parentId": "ROOT"
            }
        }
        const queryCommandResponse = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        let folders = queryCommandResponse?.Items as Folder[]

        await RedisClient.set(
            CACHE_KEYS?.MAIN_FOLDERS,
            JSON.stringify(folders),
            "EX",
            1800
        )

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "listAllMainFolders", result: "success", durationMs, detail: "fetched_from_db" });
        }

        return filterAllowedFolders(folders, allowedFolders);
    }
    catch (error: unknown) {
        throw error
    }
}

export async function getAllSubFoldersByParentId(parentId: FolderId, allowedFolders?: string[] | undefined, ctx?: CanonicalLogContext): Promise<Folder[]> {
    try {
        const opStart = performance.now();

        assertFolderAccess(parentId, allowedFolders)

        const parentFolder = await getFolderById(parentId, undefined, ctx)

        const cacheKey = CACHE_KEYS.SUB_FOLDERS(parentId)

        const cachedSubFolders = await RedisClient.get(cacheKey)

        if (cachedSubFolders) {
            const subFolders: Folder[] = JSON.parse(cachedSubFolders)

            if (ctx) {
                ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                ctx.cache.hits += 1;
                ctx.operations.push({ name: "getAllSubFoldersByParentId", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
            }

            return filterAllowedFolders(subFolders, allowedFolders)
        }

        if (ctx) {
            ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
            ctx.cache.misses += 1;
        }

        const queryCommandInput: QueryCommandInput = {
            TableName: process.env.FOLDERS_TABLE,
            IndexName: process.env.PARENTID_INDEX,
            KeyConditionExpression: "parentId = :parentId",
            ExpressionAttributeValues: {
                ":parentId": parentId
            }
        }

        const queryCommandResponse = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        const subFolders = queryCommandResponse?.Items as Folder[]

        await RedisClient.set(
            cacheKey,
            JSON.stringify(subFolders),
            "EX",
            1800
        );

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "getAllSubFoldersByParentId", result: "success", durationMs, detail: "fetched_from_db" });
        }

        return filterAllowedFolders(subFolders, allowedFolders)
    }
    catch (error: unknown) {
        if (error instanceof NotFoundError) {
            throw new NotFoundError(`ParentId with this Id not found`)
        }
        else if (error instanceof ForbiddenError) {
            throw new ForbiddenError(`Access denied: You do not have permission to access folder '${parentId}'`);
        }
        throw error
    }
}

export async function updateFolderNameById(folderId: FolderId, folderName: FolderName, ctx?: CanonicalLogContext): Promise<Folder> {
    try {
        const opStart = performance.now();

        const folder = await getFolderById(folderId, undefined, ctx)

        const updateCommandInput: UpdateCommandInput = {
            TableName: process.env.FOLDERS_TABLE,
            Key: {
                id: folderId
            },
            UpdateExpression: "set #name=:name,#updatedAt=:updatedAt",
            ExpressionAttributeNames: {
                "#name": "name",
                "#updatedAt": "updatedAt"
            },
            ExpressionAttributeValues: {
                ":name": folderName,
                ":updatedAt": new Date().toISOString()
            },
            ConditionExpression: "attribute_exists(id)",
            ReturnValues: "ALL_NEW"
        }

        const response = await DynamoDbClient.send(new UpdateCommand(updateCommandInput))

        const updatedFolder = response?.Attributes as Folder

        if (updatedFolder?.parentId === "ROOT") {
            await Promise.all([
                RedisClient.del(CACHE_KEYS.MAIN_FOLDERS),
                RedisClient.del(CACHE_KEYS.FOLDER(folderId))
            ]);
        }
        else {
            await Promise.all([
                RedisClient.del(CACHE_KEYS.SUB_FOLDERS(updatedFolder?.parentId)),
                RedisClient.del(CACHE_KEYS.FOLDER(folderId))
            ])
        }

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "updateFolderNameById", result: "success", durationMs });
        }

        return updatedFolder
    }
    catch (error: unknown) {
        if (ctx) {
            ctx.operations.push({ name: "updateFolderNameById", result: "failure" });
        }

        if (error instanceof NotFoundError) {
            throw new NotFoundError(`Failed to update as folder with the id not found`)
        }
        else {
            throw error
        }
    }
}

export async function updateParentIdByFolderId(folderId: FolderId, oldParentId: FolderId, newParentId: FolderId, ctx?: CanonicalLogContext): Promise<Folder> {
    try {
        const opStart = performance.now();

        const folder = await getFolderById(newParentId, undefined, ctx);

        const updateCommmandInput: UpdateCommandInput = {
            TableName: process.env.FOLDERS_TABLE,
            Key: {
                id: folderId
            },
            UpdateExpression: "set #parentId = :parentId , #updatedAt=:updatedAt",
            ExpressionAttributeNames: {
                "#parentId": "parentId",
                "#updatedAt": "updatedAt"
            },
            ExpressionAttributeValues: {
                ":parentId": newParentId,
                ":updatedAt": new Date().toISOString()
            },
            ConditionExpression: "attribute_exists(id)",
            ReturnValues: "ALL_NEW"
        }

        const updateCommandResponse = await DynamoDbClient.send(new UpdateCommand(updateCommmandInput))

        const updatedFolder = updateCommandResponse?.Attributes as Folder

        const keysToInvalidate: string[] = [
            CACHE_KEYS.SUB_FOLDERS(oldParentId),
            CACHE_KEYS.SUB_FOLDERS(newParentId),
            CACHE_KEYS.FOLDER(folderId),
        ];

        if (oldParentId === "ROOT" || newParentId === "ROOT") {
            keysToInvalidate.push(CACHE_KEYS.MAIN_FOLDERS);
        }

        await Promise.all(
            keysToInvalidate.map(key => RedisClient.del(key))
        );

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "updateParentIdByFolderId", result: "success", durationMs });
        }

        return updatedFolder
    }
    catch (error: any) {
        if (ctx) {
            ctx.operations.push({ name: "updateParentIdByFolderId", result: "failure" });
        }

        if (error instanceof ConditionalCheckFailedException) {
            throw new NotFoundError(`Folder with the requested Id not found`)
        }
        throw error
    }
}

export async function deleteFolderById(folderId: FolderId, ctx?: CanonicalLogContext): Promise<Folder> {
    try {
        const opStart = performance.now();

        const folder = await getFolderById(folderId, undefined, ctx)

        const subFolders: Folder[] = await getAllSubFoldersByParentId(folderId, undefined, ctx);

        if (subFolders.length > 0) {
            throw new BadRequestError(`Folder contains sub folders — remove them before deleting`);
        }

        const { objects } = await getUploadedObjectsByFolderId(folderId, undefined, ctx);

        if (objects.length > 0) {
            throw new BadRequestError(`Folder contains objects — remove them before deleting`);
        }

        const deleteCommandInput: DeleteCommandInput = {
            TableName: process.env.FOLDERS_TABLE,
            Key: {
                id: folderId
            },
            ConditionExpression: "attribute_exists(id)",
            ReturnValues: "ALL_OLD" as const
        }

        const deleteCommandOutput: DeleteCommandOutput = await DynamoDbClient.send(new DeleteCommand(deleteCommandInput))

        const deletedFolder = deleteCommandOutput?.Attributes as Folder

        const keysToInvalidate: string[] = [
            CACHE_KEYS.FOLDER(folderId),
            CACHE_KEYS.SUB_FOLDERS(folderId),
        ];

        if (folder.parentId === "ROOT") {
            keysToInvalidate.push(CACHE_KEYS.MAIN_FOLDERS);
        } else {
            keysToInvalidate.push(CACHE_KEYS.SUB_FOLDERS(folder.parentId));
        }

        await Promise.all(
            keysToInvalidate.map(key => RedisClient.del(key))
        );

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "deleteFolderById", result: "success", durationMs });
        }

        return deletedFolder
    }
    catch (error: any) {
        if (ctx) {
            ctx.operations.push({ name: "deleteFolderById", result: "failure" });
        }

        if (error instanceof ConditionalCheckFailedException) {
            throw new NotFoundError(`Folder with the id is not found`)
        }
        else {
            throw error
        }
    }
}
