import { GetCommand, PutCommand, QueryCommand, UpdateCommand, type GetCommandInput, type GetCommandOutput, type QueryCommandInput, type QueryCommandOutput, type UpdateCommandInput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { Cursor, Folder, FolderId } from "../folders/folder.types.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import { UploadStatus, type Object, type ObjectId, type ObjectName, type PresignedURL } from "./object.types.js";
import DynamoDbClient from "../configs/dynamoDb.client.js";
import { BadRequestError } from "../utils/errors/badrequest.error.js";
import { NotFoundError } from "../utils/errors/notfound.error.js";
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
import { ConflictError } from "../utils/errors/conflict.error.js"

async function createObject(objectName: ObjectName, folderId: FolderId): Promise<Object> {
    try {
        const folder = await getFolderById(folderId);

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

        return object as Object
    }
    catch (err: any) {
        if (err instanceof ResourceNotFoundException) {
            throw new BadRequestError(`The requested resource table not exists`)
        }
        throw err
    }
}

async function getObjectById(objectId: ObjectId, allowedFolders?: string[]): Promise<Object> {
    try {
        const cachedObject = await RedisClient.get(objectId)

        if (cachedObject) {
            const object = JSON.parse(cachedObject) as Object;
            assertFolderAccess(object?.folderId, allowedFolders);
            return object
        }

        const getCommandInput: GetCommandInput = {
            TableName: process.env?.OBJECTS_TABLE,
            Key: {
                id: objectId
            }
        }

        const getCommandOutput: GetCommandOutput = await DynamoDbClient.send(new GetCommand(getCommandInput))

        if (!getCommandOutput?.Item) {
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

        return object as Object
    }
    catch (err: any) {
        throw err
    }
}

/**
 * Queries the FOLDER_NAME_INDEX GSI for an existing object with the given
 * (objectName, folderId) combination, regardless of upload status.
 *
 * @returns The existing object (PENDING or UPLOADED), or `null` if none exists.
 */
async function findObjectByNameAndFolder(
    objectName: ObjectName,
    folderId: FolderId
): Promise<Object | null> {
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

    if (result?.Items && result.Items.length > 0) {
        return result.Items[0] as Object;
    }

    return null;
}

export async function getPutObjectPresignedURL(objectName: ObjectName, folderId: FolderId, allowedFolders: string[] | undefined): Promise<PresignedURL> {
    const lockKey = `lock:putObject:${folderId}:${objectName}`;
    let lockValue: string | null = null;

    try {
        // 1. Validate folder exists & user has access
        const folder: Folder = await getFolderById(folderId, allowedFolders)

        // 2. Acquire Redis distributed lock to prevent concurrent duplicates
        lockValue = await acquireLock(lockKey);

        if (!lockValue) {
            throw new ConflictError(
                `Another upload request for "${objectName}" in this folder is already in progress. Please retry.`
            );
        }

        // 3. Check if an object with this (name, folderId) already exists
        const existingObject: Object | null = await findObjectByNameAndFolder(objectName, folderId);

        let object: Object;

        if (existingObject && existingObject.status === UploadStatus.uploaded) {
            // 4a. Object already uploaded — reject the request
            throw new ConflictError(
                `An object with the name "${objectName}" already exists in this folder.`
            );
        } else if (existingObject && existingObject.status === UploadStatus.pending) {
            // 4b. PENDING object found — reuse it (idempotent retry)
            object = existingObject;
        } else {
            // 4c. No existing object — create a new record
            object = await createObject(objectName, folderId);
        }

        // 5. Release lock before the presigned URL call (it's a pure read, no state mutation)
        await releaseLock(lockKey, lockValue);
        lockValue = null; // mark as released so finally block doesn't double-release

        // 6. Generate presigned URL using the (reused or new) S3 key
        const putObjectPresignedURL = await generatePutObjectPresignedURL(object?.key)

        return putObjectPresignedURL;
    }
    catch (err: any) {
        throw err;
    }
    finally {
        // Safety net: release lock if it wasn't already released (e.g. error between acquire and explicit release)
        if (lockValue) {
            await releaseLock(lockKey, lockValue).catch(() => { });
        }
    }
}

export async function getObjectPresignedURL(objectId: ObjectId, allowedFolders: string[] | undefined): Promise<PresignedURL> {
    try {
        const cachedPresignedUrl: PresignedURL | null = await RedisClient.get(OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL(objectId))

        if (cachedPresignedUrl) {
            return cachedPresignedUrl
        }

        const object: Object = await getObjectById(objectId, allowedFolders)

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

        return presignedURL
    }
    catch (err: any) {
        throw err
    }
}

export async function getPresignedUrlForPendingUploads(objectId: ObjectId, allowedFolders: string[] | undefined): Promise<PresignedURL> {
    try {
        const object: Object = await getObjectById(objectId, allowedFolders)

        if (object && object?.status != UploadStatus?.pending) {
            throw new BadRequestError(`Cannot get the presigned url for the uploaded image`)
        }

        const objectKey: string = object?.key

        if (objectKey === undefined) {
            throw new BadRequestError(`ObjectKey is undefined,presignedURL cannot be genearated without objectKey`)
        }

        const presignedURL: PresignedURL = await generatePutObjectPresignedURL(objectKey)

        return presignedURL
    }
    catch (err: any) {
        throw err
    }
}

export async function getUploadedObjectsByFolderId(folderId: FolderId, cursor: Cursor) {
    try {
        const folder = await getFolderById(folderId)

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

        return {
            objects,
            lastEvaluatedKey
        }
    }
    catch (err: any) {
        throw err
    }
}

export async function fetchPendingObjectsByFolderId(folderId: FolderId, cursor: Cursor) {
    try {
        const folder = await getFolderById(folderId)

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
        console.log(queryCommandOutput)
        if (!queryCommandOutput?.Items || queryCommandOutput?.Items.length === 0) {
            throw new NotFoundError(`No Uploaded Images with this folderId`)
        }

        const objects = queryCommandOutput?.Items ?? []

        const lastEvaluatedKey = queryCommandOutput?.LastEvaluatedKey ? CursorCodec.encode(queryCommandOutput?.LastEvaluatedKey) : undefined

        return {
            objects,
            lastEvaluatedKey
        }
    }
    catch (err: any) {
        throw err
    }
}

export async function deleteObjectById(objectId: ObjectId) {
    try {
        const object: Object = await getObjectById(objectId)

        const stepFunctionInput: DeleteStepFunctionInput = {
            objectId: objectId,
            S3ObjectKey: object?.key,
        }

        const startCommandInput: StartExecutionCommandInput = {
            stateMachineArn: process.env.AWS_STEPFUNCTION_ARN,
            input: JSON.stringify(stepFunctionInput)
        };

        const startResponse: StartExecutionCommandOutput = await StepFunctionClient.send(
            new StartExecutionCommand(startCommandInput)
        );

        const executionArn: string = startResponse?.executionArn!;

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

                return {
                    success: true,
                    executionArn,
                    output,
                    durationMs,
                    attempts: attempt,
                };
            }


            if (TERMINAL_ERROR_STATUSES.has(status as TerminalErrorStatus)) {
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



