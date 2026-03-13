import { GetCommand, PutCommand, QueryCommand, UpdateCommand, type GetCommandInput, type GetCommandOutput, type QueryCommandInput, type UpdateCommandInput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { Cursor, Folder, FolderId } from "../folders/folder.types.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import { UploadStatus, type Object, type ObjectId, type ObjectName, type PresignedURL} from "./object.types.js";
import  DynamoDbClient from "../configs/DynamoDb.client.js";
import { BAD_REQUEST_ERROR } from "../utils/errors/badrequest.error.js";
import { NOTFOUND_ERROR } from "../utils/errors/notfound.error.js";
import { getFolderById } from "../folders/folder.service.js";
import { generatePutObjectPresignedURL } from "../utils/S3-PresignedUrl/putObject.js";
import { generateGetObjectPresignedURL } from "../utils/S3-PresignedUrl/getObject.js";
import CursorCodec from "../utils/helpers/cursorCodec.helper.js";
import { ConditionalCheckFailedException, ResourceNotFoundException } from "@aws-sdk/client-dynamodb";
import { DescribeExecutionCommand, StartExecutionCommand, type DescribeActivityCommandOutput, type DescribeExecutionCommandInput, type DescribeExecutionCommandOutput, type StartExecutionCommandInput, type StartExecutionCommandOutput } from "@aws-sdk/client-sfn";
import StepFunctionClient from "../configs/stepFunction.client.js";
import { POLL_CONFIG, TERMINAL_ERROR_STATUSES, type DeleteStepFunctionInput, type TerminalErrorStatus } from "../types/stepFunction.types.js";
import { computeDuration, sleep, toExecutionStatus } from "../utils/helpers/stepFunction.helpers.js";
import { StepFunctionExecutionError } from "../utils/errors/stepFunctionExecution.error.js";
import RedisClient from "../configs/Redis.client.js";
import { OBJECT_CACHE } from "../utils/constants/cache.constants.js";


export async function addObject(objectName:ObjectName,folderId:FolderId):Promise<Object>{
    try{
        const folder = await getFolderById(folderId);

        const object : Object = {
            id:`Object@${RandomIdGenerator.getId()}`,
            key:`${objectName}@${RandomIdGenerator.getId()}`,
            folderId:folderId,
            name:objectName,
            status:UploadStatus.pending,
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
        }

        const putCommand : PutCommand = new PutCommand({
            TableName:process.env.IMAGES_TABLE,
            Item:object
        })

        const response = await DynamoDbClient.send(putCommand)

        return object as Object
    }
    catch(err:any){
        if(err instanceof ResourceNotFoundException){
            throw new BAD_REQUEST_ERROR(`The requested resource table not exists`)
        }
        throw err
    }
}

export async function getObjectById(objectId:ObjectId):Promise<Object>{
    try{

        const cachedObject  = await RedisClient.get(objectId)

        if(cachedObject){
            return JSON.parse(cachedObject)
        }
        
        const getCommandInput : GetCommandInput = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:objectId
            }
        }

        const getCommandOutput : GetCommandOutput = await DynamoDbClient.send(new GetCommand(getCommandInput))

        if(!getCommandOutput?.Item){
            throw new NOTFOUND_ERROR(`Object with the id is not found`)
        }

        const object = getCommandOutput?.Item

        await RedisClient.set(
            objectId,
            JSON.stringify(object),
            "EX",
            OBJECT_CACHE?.OBJECT_TTL
        );

        return object as Object
    }
    catch(err:any){
        throw err
    }
}

// this functionality is inconsistent as the name is changed in the DB but the S3 still contains the old name after the updation
// export async function updateObjectNameById(objectId:ObjectId,objectName:ObjectName):Promise<Object>{
//     try{
//         const updateCommandInput : UpdateCommandInput = {
//             TableName:process.env.IMAGES_TABLE,
//             Key:{
//                 id:objectId
//             },
//             UpdateExpression:"set #name=:name , #updatedAt=:updatedAt",
//             ExpressionAttributeNames:{
//                 "#name": "name",
//                 "#updatedAt" :"updatedAt"
//             },
//             ExpressionAttributeValues:{
//                 ":name":objectName,
//                 ":updatedAt":new Date().toString()
//             },
//             ConditionExpression:"attribute_exists(id)",
//             ReturnValues:'ALL_NEW' as const
//         }

//         const updateCommandOutput : UpdateCommandOutput = await DynamoDbClient.send(new UpdateCommand(updateCommandInput))

//         if(!updateCommandOutput?.Attributes){
//             throw new BAD_REQUEST_ERROR(`Failed to get the updated attributes`)
//         }

//         const updatedObject = updateCommandOutput?.Attributes as Object

//         const isObjectExistsInCache 
    
//         return updatedObject 

//     }
//     catch(err:any){
//         if(err instanceof ConditionalCheckFailedException){
//             throw new NOTFOUND_ERROR(`Object with the id is not found to update`)
//         }
//         else if(err instanceof NOTFOUND_ERROR){
//             throw new NOTFOUND_ERROR(`Failed to update as object with the id not found`)
//         }
//         else throw err
//     }
// }

export async function getPutObjectPresignedURL(objectName:ObjectName,folderId:FolderId):Promise<PresignedURL>{
    try{
        
        const folder : Folder = await getFolderById(folderId)

        const object : Object = await addObject(objectName,folderId)

        const putObjectPresignedURL = await generatePutObjectPresignedURL(object?.key)

        await RedisClient.set(
            OBJECT_CACHE.PUT_OBJECT_PRESIGNED_URL(object?.id as ObjectId),
            putObjectPresignedURL,
            "EX",
            OBJECT_CACHE.PRESIGNED_URL_TTL
        )

        return putObjectPresignedURL ;
    }
    catch(err:any){
        throw err ;
    }
}

export async function getObjectPresignedURL(objectId:ObjectId):Promise<PresignedURL>{
    try{
        const cachedPresignedUrl : PresignedURL | null = await RedisClient.get(OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL(objectId))

        if(cachedPresignedUrl) {
            return cachedPresignedUrl 
        }

        const object : Object = await getObjectById(objectId)

        if(object?.status===UploadStatus.pending){
            throw new BAD_REQUEST_ERROR(`Cannot get presignedURL as object not exists in the bucket`)
        }
        
        const objectKey = object?.key

        const presignedURL : PresignedURL = await generateGetObjectPresignedURL(objectKey)

        await RedisClient.set(
            OBJECT_CACHE.GET_OBJECT_PRESIGNED_URL(objectId),
            presignedURL,
            "EX",
            OBJECT_CACHE.PRESIGNED_URL_TTL  
        )

        return presignedURL
    }
    catch(err:any){
        throw err 
    }
}

export async function getPresignedUrlForPendingUploads(objectId:ObjectId):Promise<PresignedURL>{
    try{
        const cachedPresignedUrl : PresignedURL | null = await RedisClient.get(OBJECT_CACHE.PUT_OBJECT_PRESIGNED_URL(objectId))

        if(cachedPresignedUrl){
            return cachedPresignedUrl
        }
        
        const object : Object = await getObjectById(objectId)

        if(object && object?.status!=UploadStatus?.pending){
            throw new BAD_REQUEST_ERROR(`Cannot get the presigned url for the uploaded image`)
        }

        const objectKey : string = object?.key

        if(objectKey===undefined){
            throw new BAD_REQUEST_ERROR(`ObjectKey is undefined,presignedURL cannot be genearated without objectKey`)
        }

        const presignedURL : PresignedURL = await generatePutObjectPresignedURL(objectKey)

        await RedisClient.set(
            OBJECT_CACHE.PUT_OBJECT_PRESIGNED_URL(objectId),
            presignedURL ,
            "EX",
            OBJECT_CACHE.PRESIGNED_URL_TTL
        )

        return presignedURL

    }
    catch(err:any){
        throw err
    }
}

export async function getUploadedObjectsByFolderId(folderId:FolderId,cursor:Cursor){
    try{

        const folder = await getFolderById(folderId)

        let decodedCursor = undefined

        if(cursor && cursor!=='null' && cursor!=='undefined'){
            decodedCursor = CursorCodec.decode(cursor)
        }
        
        const queryCommandInput : QueryCommandInput = {
            TableName : process.env.IMAGES_TABLE,
            IndexName : process.env.FOLDERID_INDEX,
            KeyConditionExpression : "folderId=:id AND #status=:status",
            ExpressionAttributeNames:{
                "#status":"status"
            },
            ExpressionAttributeValues :{
                ":id": folder?.id,
                ":status" : UploadStatus?.uploaded
            },
            Limit : 10 ,
            ExclusiveStartKey : decodedCursor
        }

        const queryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        if(!queryCommandOutput?.Items || queryCommandOutput?.Items.length === 0){
            throw new NOTFOUND_ERROR(`No Uploaded Images with this folderId`)
        }

        const objects = queryCommandOutput?.Items ?? []

        const lastEvaluatedKey = queryCommandOutput?.LastEvaluatedKey ? CursorCodec.encode(queryCommandOutput?.LastEvaluatedKey) : undefined

        return  {
            objects,
            lastEvaluatedKey
        }
    }
    catch(err:any){
        throw err
    }
}

export async function fetchPendingObjectsByFolderId(folderId:FolderId,cursor:Cursor){
    try{
        const folder = await getFolderById(folderId)

        let decodedCursor = undefined

        if(cursor && cursor!=='null' && cursor!=='undefined'){
            decodedCursor = CursorCodec.decode(cursor)
        }

        const input : QueryCommandInput = {
            TableName : process.env.IMAGES_TABLE,
            IndexName : process.env.FOLDERID_INDEX,
            KeyConditionExpression : "folderId = :folderId AND #status = :status",
            ExpressionAttributeNames :{
                "#status":"status"
            },
            ExpressionAttributeValues :{
                ":folderId" : folder?.id,
                ":status" : UploadStatus.pending
            },
            Limit : 2 ,
            ExclusiveStartKey : decodedCursor
        }

        const queryResult = await DynamoDbClient.send(new QueryCommand(input))

        if(!queryResult?.Items || queryResult?.Items.length === 0){
            throw new NOTFOUND_ERROR(`No Uploaded Images with this folderId`)
        }

        const objects = queryResult?.Items ?? []

        const lastEvaluatedKey = queryResult?.LastEvaluatedKey ? CursorCodec.encode(queryResult?.LastEvaluatedKey) : undefined

        return  {
            objects,
            lastEvaluatedKey
        }
    }
    catch(err:any){
        throw err
    }
}

export async function deleteObjectById(objectId:ObjectId){
    try {
        const object: Object = await getObjectById(objectId)

        const stepFunctionInput: DeleteStepFunctionInput = {
            objectId:objectId,
            S3ObjectKey : object?.key,
        }
    
        const startCommandInput: StartExecutionCommandInput = {
            stateMachineArn : process.env.AWS_STEPFUNCTION_ARN,
            input:JSON.stringify(stepFunctionInput)
        };

        const startResponse: StartExecutionCommandOutput = await StepFunctionClient.send(
            new StartExecutionCommand(startCommandInput)
        );

        const executionArn: string = startResponse?.executionArn!;

        let   currentDelay : number = POLL_CONFIG.initialDelayMs;
        const pollStarted  : number = Date.now();

        for (let attempt = 1; attempt <= POLL_CONFIG.maxAttempts; attempt++) {

            const describeCommandInput: DescribeExecutionCommandInput = { executionArn };

            const describeResponse: DescribeExecutionCommandOutput = await StepFunctionClient.send(
                new DescribeExecutionCommand(describeCommandInput)
            );

            const elapsed : number = Date.now() - pollStarted;
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

                await Promise.all([
                    RedisClient.del(objectId),
                    RedisClient.del(OBJECT_CACHE.PUT_OBJECT_PRESIGNED_URL(objectId)),
                    RedisClient.del(OBJECT_CACHE.PUT_OBJECT_PRESIGNED_URL(objectId)),
                ]);


                return {
                    success : true,
                    executionArn,
                    output,
                    durationMs,
                    attempts : attempt,
                };
            }


            if (TERMINAL_ERROR_STATUSES.has(status as TerminalErrorStatus)) {
                // console.error(
                //   `[deleteObjectById] Step 3 ❌ ${status} | ` +
                //   `attempt: ${attempt} | ` +
                //   `code: ${describeResponse.error ?? "N/A"} | ` +
                //   `cause: ${describeResponse.cause ?? "N/A"}`
                // );

                throw new StepFunctionExecutionError({
                  executionArn,
                  status : status as TerminalErrorStatus,
                  code : describeResponse.error ?? "UNKNOWN_ERROR",
                  cause : describeResponse.cause ?? "No cause provided by the state machine.",
                  durationMs,
                  attempts : attempt,
                });
            }

            // POLLING_EXHAUSTED — still RUNNING after maxAttempts 

            if (attempt === POLL_CONFIG.maxAttempts) {
                // console.error(
                //   `[deleteObjectById] Step 3 ❌ POLLING_EXHAUSTED | ` +
                //   `attempts: ${attempt} | executionArn: ${executionArn}`
                // );

                throw new StepFunctionExecutionError({
                  executionArn,
                  status : "POLLING_EXHAUSTED",
                  code : "POLLING_EXHAUSTED",
                  cause : `Execution did not reach a terminal state within ${POLL_CONFIG.maxAttempts} attempts.`,
                  durationMs : elapsed,
                  attempts   : attempt,
                });
            }

            // ── RUNNING / PENDING_REDRIVE — wait with backoff, then retry ──────────────
    
            // console.log(
            //   `[deleteObjectById] Step 3 — Still ${status} | ` +
            //   `waiting ${currentDelay}ms before attempt ${attempt + 1}...`
            // );

            await sleep(currentDelay);

            currentDelay = Math.min(
              currentDelay * POLL_CONFIG.backoffMultiplier,
              POLL_CONFIG.maxDelayMs
            );
        }

        // Unreachable at runtime — POLLING_EXHAUSTED throw inside the loop covers
        // this exit path. Required by TypeScript for exhaustive return analysis.
        throw new Error(
           "Unexpected: polling loop exited without resolution"
        );
    }
    catch(err:any){
    // console.error(
    //   `[deleteObjectById] ❌ Error caught | id: ${objectId}`,
    //   err
    // );
        throw err 
    }
}


  
  