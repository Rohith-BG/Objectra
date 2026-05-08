import { GetCommand, PutCommand, QueryCommand, UpdateCommand, type GetCommandInput, type GetCommandOutput, type QueryCommandInput, type QueryCommandOutput, type UpdateCommandInput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { Cursor, Folder, FolderId } from "../folders/folder.types.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import { UploadStatus, type Object, type ObjectId, type ObjectName, type PresignedURL } from "./object.types.js";
import DynamoDbClient from "../configs/dynamoDb.client.js";
import { BadRequestError, ConflictError, NotFoundError } from "../utils/errors/http.errors.js";
import { getFolderById } from "../folders/folder.service.js";
import { generatePutObjectPresignedURL } from "../utils/S3-PresignedUrl/putObject.js";
import { generateGetObjectPresignedURL } from "../utils/S3-PresignedUrl/getObject.js";
import CursorCodec from "../utils/helpers/cursorCodec.helper.js";
import { DescribeExecutionCommand, StartExecutionCommand, type DescribeActivityCommandOutput, type DescribeExecutionCommandInput, type DescribeExecutionCommandOutput, type StartExecutionCommandInput, type StartExecutionCommandOutput } from "@aws-sdk/client-sfn";
import StepFunctionClient from "../configs/stepFunction.client.js";
import { POLL_CONFIG, TERMINAL_ERROR_STATUSES, type DeleteStepFunctionInput, type TerminalErrorStatus } from "../types/stepFunction.types.js";
import { computeDuration, sleep, toExecutionStatus } from "../utils/helpers/stepFunction.helpers.js";
import { StepFunctionExecutionError } from "../utils/errors/stepFunctionExecution.error.js";
import RedisClient from "../configs/redis.client.js";
import { OBJECT_CACHE } from "../utils/constants/cache.constants.js";
import { ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import { assertFolderAccess } from "../utils/helpers/folder.helper.js";
import { acquireLock, releaseLock } from "../utils/helpers/redisLock.helper.js";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";

async function createObject(objectName: ObjectName, folderId: FolderId, ctx?: CanonicalLogContext): Promise<Object> {
    try {
        const opStart = performance.now();

        const folder = await getFolderById(folderId, undefined, ctx);

        const object: Object = {
            id: `Object@${RandomIdGenerator.getId()}`,
            key: `${objectName}@${RandomIdGenerator.getId()}`,
            folderId: folderId,
            name: objectName,
            status: UploadStatus.pending,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        const putCommand: PutCommand = new PutCommand({
            TableName: process.env.OBJECTS_TABLE,
            Item: object
        })

        const response = await DynamoDbClient.send(putCommand)

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "createObject", result: "success", durationMs });
        }

        return object as Object
    }
    catch (err: any) {
        if (ctx) {
            ctx.operations.push({ name: "createObject", result: "failure" });
        }

        if (err instanceof ResourceNotFoundException) {
            throw new BadRequestError(`The requested resource table not exists`)
        }
        throw err
    }
}

async function getObjectById(objectId: ObjectId, allowedFolders?: string[], ctx?: CanonicalLogContext): Promise<Object> {
    try {
        const opStart = performance.now();

        const cachedObject = await RedisClient.get(objectId)

        if (cachedObject) {
            const object = JSON.parse(cachedObject) as Object;
            assertFolderAccess(object?.folderId, allowedFolders);

            if (ctx) {
                ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                ctx.cache.hits += 1;
                ctx.operations.push({ name: "getObjectById", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
            }

            return object
        }

        if (ctx) {
            ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
            ctx.cache.misses += 1;
        }

        const getCommandInput: GetCommandInput = {
            TableName: process.env?.OBJECTS_TABLE,
            Key: {
                id: objectId
            }
        }

        const getCommandOutput: GetCommandOutput = await DynamoDbClient.send(new GetCommand(getCommandInput))

        if (!getCommandOutput?.Item) {
            if (ctx) {
                ctx.operations.push({ name: "getObjectById", result: "failure", durationMs: Math.round(performance.now() - opStart), detail: "not_found" });
            }
            throw new NotFoundError(`Object with the id is not found`)
        }

        const object = getCommandOutput?.Item

        await RedisClient.set(
            objectId,
            JSON.stringify(object),
            "EX",
            OBJECT_CACHE.OBJECT_TTL
        );

        assertFolderAccess(object.folderId, allowedFolders);

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "getObjectById", result: "success", durationMs, detail: "fetched_from_db" });
        }

        return object as Object
    }
    catch (err: any) {
        throw err
    }
}

async function findObjectByNameAndFolder(
    objectName: ObjectName,
    folderId: FolderId,
    ctx?: CanonicalLogContext
): Promise<Object | null> {
    const opStart = performance.now();

    const queryInput: QueryCommandInput = {
        TableName: process.env.OBJECTS_TABLE,
        IndexName: process.env.FOLDER_NAME_INDEX,
        KeyConditionExpression: "folderId = :fid AND #name = :name",
        ExpressionAttributeNames: {
            "#name": "name"
        },
        ExpressionAttributeValues: {
            ":fid": folderId,
            ":name": objectName
        },
        Limit: 1
    };

    const result = await DynamoDbClient.send(new QueryCommand(queryInput));

    if (ctx) {
        ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
        ctx.db.queriesExecuted += 1;
        const durationMs = Math.round(performance.now() - opStart);
        ctx.db.totalDbDurationMs += durationMs;
        ctx.operations.push({
            name: "findObjectByNameAndFolder",
            result: result?.Items && result.Items.length > 0 ? "success" : "skipped",
            durationMs,
            detail: result?.Items && result.Items.length > 0 ? "existing_found" : "no_existing",
        });
    }

    if (result?.Items && result.Items.length > 0) {
        return result.Items[0] as Object;
    }

    return null;
}

export async function getPutObjectPresignedURL(objectName: ObjectName, folderId: FolderId, allowedFolders: string[] | undefined, ctx?: CanonicalLogContext): Promise<PresignedURL> {
    const lockKey = `lock:putObject:${folderId}:${objectName}`;
    let lockValue: string | null = null;

    try {
        const folder: Folder = await getFolderById(folderId, allowedFolders, ctx)

        lockValue = await acquireLock(lockKey);

        if (!lockValue) {
            if (ctx) {
                ctx.operations.push({ name: "acquireLock", result: "failure", detail: "lock_contention" });
            }
            throw new ConflictError(
                `Another upload request for "${objectName}" in this folder is already in progress. Please retry.`
            );
        }

        if (ctx) {
            ctx.operations.push({ name: "acquireLock", result: "success" });
        }

        const existingObject: Object | null = await findObjectByNameAndFolder(objectName, folderId, ctx);

        let object: Object;

        if (existingObject && existingObject.status === UploadStatus.uploaded) {
            throw new ConflictError(
                `An object with the name "${objectName}" already exists in this folder.`
            );
        } else if (existingObject && existingObject.status === UploadStatus.pending) {
            object = existingObject;
        } else {
            object = await createObject(objectName, folderId, ctx);
        }

        await releaseLock(lockKey, lockValue);
        lockValue = null;

        const presignedUrlStart = performance.now();
        const putObjectPresignedURL = await generatePutObjectPresignedURL(object?.key)

        if (ctx) {
            ctx.s3 = ctx.s3 ?? { presignedUrlsGenerated: 0 };
            ctx.s3.presignedUrlsGenerated += 1;
            ctx.operations.push({ name: "generatePutPresignedUrl", result: "success", durationMs: Math.round(performance.now() - presignedUrlStart) });
        }

        return putObjectPresignedURL;
    }
    catch (err: any) {
        throw err;
    }
    finally {
        if (lockValue) {
            await releaseLock(lockKey, lockValue).catch(() => { });
        }
    }
}

export async function getObjectPresignedURL(objectId: ObjectId, allowedFolders: string[] | undefined, ctx?: CanonicalLogContext): Promise<PresignedURL> {
    try {
        const opStart = performance.now();

        const cachedPresignedUrl: PresignedURL | null = await RedisClient.get(OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL(objectId))

        if (cachedPresignedUrl) {
            if (ctx) {
                ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
                ctx.cache.hits += 1;
                ctx.operations.push({ name: "getObjectPresignedURL", result: "success", durationMs: Math.round(performance.now() - opStart), detail: "cache_hit" });
            }
            return cachedPresignedUrl
        }

        if (ctx) {
            ctx.cache = ctx.cache ?? { hits: 0, misses: 0 };
            ctx.cache.misses += 1;
        }

        const object: Object = await getObjectById(objectId, allowedFolders, ctx)

        if (object?.status === UploadStatus.pending) {
            throw new BadRequestError(`Cannot get presignedURL as object not exists in the bucket`)
        }

        const objectKey = object?.key

        const presignedURL: PresignedURL = await generateGetObjectPresignedURL(objectKey)

        await RedisClient.set(
            OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL(objectId),
            presignedURL,
            "EX",
            OBJECT_CACHE.PRESIGNED_URL_TTL
        )

        if (ctx) {
            ctx.s3 = ctx.s3 ?? { presignedUrlsGenerated: 0 };
            ctx.s3.presignedUrlsGenerated += 1;
            ctx.operations.push({ name: "getObjectPresignedURL", result: "success", durationMs: Math.round(performance.now() - opStart) });
        }

        return presignedURL
    }
    catch (err: any) {
        throw err
    }
}

export async function getPresignedUrlForPendingUploads(objectId: ObjectId, allowedFolders: string[] | undefined, ctx?: CanonicalLogContext): Promise<PresignedURL> {
    try {
        const opStart = performance.now();

        const object: Object = await getObjectById(objectId, allowedFolders, ctx)

        if (object && object?.status != UploadStatus?.pending) {
            throw new BadRequestError(`Cannot get the presigned url for the uploaded image`)
        }

        const objectKey: string = object?.key

        if (objectKey === undefined) {
            throw new BadRequestError(`ObjectKey is undefined,presignedURL cannot be genearated without objectKey`)
        }

        const presignedURL: PresignedURL = await generatePutObjectPresignedURL(objectKey)

        if (ctx) {
            ctx.s3 = ctx.s3 ?? { presignedUrlsGenerated: 0 };
            ctx.s3.presignedUrlsGenerated += 1;
            ctx.operations.push({ name: "getPresignedUrlForPendingUploads", result: "success", durationMs: Math.round(performance.now() - opStart) });
        }

        return presignedURL
    }
    catch (err: any) {
        throw err
    }
}

export async function getUploadedObjectsByFolderId(folderId: FolderId, cursor: Cursor, ctx?: CanonicalLogContext) {
    try {
        const opStart = performance.now();

        const folder = await getFolderById(folderId, undefined, ctx)

        let decodedCursor = undefined

        if (cursor && cursor !== 'null' && cursor !== 'undefined') {
            decodedCursor = CursorCodec.decode(cursor)
        }

        const queryCommandInput: QueryCommandInput = {
            TableName: process.env.OBJECTS_TABLE,
            IndexName: process.env.FOLDERID_INDEX,
            KeyConditionExpression: "folderId=:id AND #status=:status",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":id": folder?.id,
                ":status": UploadStatus?.uploaded
            },
            Limit: 10,
            ExclusiveStartKey: decodedCursor
        }

        const queryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        const objects = queryCommandOutput?.Items ?? []

        const lastEvaluatedKey = queryCommandOutput?.LastEvaluatedKey ? CursorCodec.encode(queryCommandOutput?.LastEvaluatedKey) : undefined

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "getUploadedObjectsByFolderId", result: "success", durationMs, detail: `returned_${objects.length}_items` });
        }

        return {
            objects,
            lastEvaluatedKey
        }
    }
    catch (err: any) {
        throw err
    }
}

export async function fetchPendingObjectsByFolderId(folderId: FolderId, cursor: Cursor, ctx?: CanonicalLogContext) {
    try {
        const opStart = performance.now();

        const folder = await getFolderById(folderId, undefined, ctx)

        let decodedCursor = undefined

        if (cursor && cursor !== 'null' && cursor !== 'undefined') {
            decodedCursor = CursorCodec.decode(cursor)
        }

        const input: QueryCommandInput = {
            TableName: process.env.OBJECTS_TABLE,
            IndexName: process.env.FOLDERID_INDEX,
            KeyConditionExpression: "folderId = :folderId AND #status = :status",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":folderId": folder?.id,
                ":status": UploadStatus.pending
            },
            Limit: 2,
            ExclusiveStartKey: decodedCursor
        }

        const queryCommandOutput: QueryCommandOutput = await DynamoDbClient.send(new QueryCommand(input))

        if (!queryCommandOutput?.Items || queryCommandOutput?.Items.length === 0) {
            if (ctx) {
                ctx.operations.push({ name: "fetchPendingObjectsByFolderId", result: "failure", durationMs: Math.round(performance.now() - opStart), detail: "not_found" });
            }
            throw new NotFoundError(`No Uploaded Images with this folderId`)
        }

        const objects = queryCommandOutput?.Items ?? []

        const lastEvaluatedKey = queryCommandOutput?.LastEvaluatedKey ? CursorCodec.encode(queryCommandOutput?.LastEvaluatedKey) : undefined

        if (ctx) {
            ctx.db = ctx.db ?? { queriesExecuted: 0, totalDbDurationMs: 0 };
            ctx.db.queriesExecuted += 1;
            const durationMs = Math.round(performance.now() - opStart);
            ctx.db.totalDbDurationMs += durationMs;
            ctx.operations.push({ name: "fetchPendingObjectsByFolderId", result: "success", durationMs, detail: `returned_${objects.length}_items` });
        }

        return {
            objects,
            lastEvaluatedKey
        }
    }
    catch (err: any) {
        throw err
    }
}

export async function deleteObjectById(objectId: ObjectId, ctx?: CanonicalLogContext) {
    try {
        const object: Object = await getObjectById(objectId, undefined, ctx)

        const stepFunctionInput: DeleteStepFunctionInput = {
            objectId: objectId,
            S3ObjectKey: object?.key,
        }

        const startCommandInput: StartExecutionCommandInput = {
            stateMachineArn: process.env.AWS_STEPFUNCTION_ARN,
            input: JSON.stringify(stepFunctionInput)
        };

        const sfnStart = performance.now();

        const startResponse: StartExecutionCommandOutput = await StepFunctionClient.send(
            new StartExecutionCommand(startCommandInput)
        );

        const executionArn: string = startResponse?.executionArn!;

        if (ctx) {
            ctx.operations.push({ name: "startStepFunctionExecution", result: "success", durationMs: Math.round(performance.now() - sfnStart) });
        }

        let currentDelay: number = POLL_CONFIG.initialDelayMs;
        const pollStarted: number = Date.now();

        for (let attempt = 1; attempt <= POLL_CONFIG.maxAttempts; attempt++) {

            const describeCommandInput: DescribeExecutionCommandInput = { executionArn };

            const describeResponse: DescribeExecutionCommandOutput = await StepFunctionClient.send(
                new DescribeExecutionCommand(describeCommandInput)
            );

            const elapsed: number = Date.now() - pollStarted;
            const status = toExecutionStatus(describeResponse?.status);
            const durationMs: number = computeDuration(
                describeResponse?.startDate,
                describeResponse?.stopDate,
                elapsed
            );


            if (status === "SUCCEEDED") {

                const output: Record<string, unknown> | null = describeResponse.output
                    ? (JSON.parse(describeResponse.output) as Record<string, unknown>)
                    : null;

                await RedisClient.del(objectId);

                if (ctx) {
                    ctx.operations.push({ name: "deleteObjectStepFunction", result: "success", durationMs, detail: `attempts_${attempt}` });
                }

                return {
                    success: true,
                    executionArn,
                    output,
                    durationMs,
                    attempts: attempt,
                };
            }


            if (TERMINAL_ERROR_STATUSES.has(status as TerminalErrorStatus)) {
                if (ctx) {
                    ctx.operations.push({ name: "deleteObjectStepFunction", result: "failure", durationMs, detail: `status_${status}` });
                }

                throw new StepFunctionExecutionError({
                    executionArn,
                    status: status as TerminalErrorStatus,
                    code: describeResponse.error ?? "UNKNOWN_ERROR",
                    cause: describeResponse.cause ?? "No cause provided by the state machine.",
                    durationMs,
                    attempts: attempt,
                });
            }

            if (attempt === POLL_CONFIG.maxAttempts) {
                if (ctx) {
                    ctx.operations.push({ name: "deleteObjectStepFunction", result: "failure", durationMs: elapsed, detail: "polling_exhausted" });
                }

                throw new StepFunctionExecutionError({
                    executionArn,
                    status: "POLLING_EXHAUSTED",
                    code: "POLLING_EXHAUSTED",
                    cause: `Execution did not reach a terminal state within ${POLL_CONFIG.maxAttempts} attempts.`,
                    durationMs: elapsed,
                    attempts: attempt,
                });
            }

            await sleep(currentDelay);

            currentDelay = Math.min(
                currentDelay * POLL_CONFIG.backoffMultiplier,
                POLL_CONFIG.maxDelayMs
            );
        }

        throw new Error(
            "Unexpected: polling loop exited without resolution"
        );
    }
    catch (err: any) {
        throw err
    }
}
