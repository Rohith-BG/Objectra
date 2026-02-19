import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type DeleteCommandInput, type DeleteCommandOutput, type GetCommandInput, type GetCommandOutput, type PutCommandInput, type QueryCommandInput, type UpdateCommandInput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { Cursor, Folder, FolderId } from "../folders/folder.types.js";
import RandomIdGenerator from "../utils/create-randomId.js";
import { UploadStatus, type Object, type ObjectId, type ObjectName, type PresignedURL} from "./object.types.js";
import { dynamoDb } from "../configs/dynamoDb.js";
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js";
import { NOTFOUND_ERROR } from "../utils/erros/NotFound.Error.js";
import { getFolderById } from "../folders/folder.service.js";
import { generatePutObjectPresignedURL } from "../utils/S3-PresignedUrl/putObject.js";
import { generateGetObjectPresignedURL } from "../utils/S3-PresignedUrl/getObject.js";
import CursorCodec from "../utils/cursorCodec.js";
import { ConditionalCheckFailedException, ResourceNotFoundException } from "@aws-sdk/client-dynamodb";


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

        const response = await dynamoDb.send(putCommand)

        if(response?.$metadata?.httpStatusCode!==200){
            throw new BAD_REQUEST_ERROR(`Failed to create the image`)
        }


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
        
        const getCommandInput : GetCommandInput = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:objectId
            }
        }

        const response : GetCommandOutput = await dynamoDb.send(new GetCommand(getCommandInput))

        if(!response?.Item){
            throw new NOTFOUND_ERROR(`Object with the id is not found`)
        }

        const object = response?.Item

        return object as Object
    }
    catch(err:any){
        throw err
    }
}

export async function updateObjectNameById(objectId:ObjectId,objectName:ObjectName):Promise<Object>{
    try{
        const object : Object= await getObjectById(objectId)

        const updateCommandInput : UpdateCommandInput = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:objectId
            },
            UpdateExpression:"set #name=:name , #updatedAt=:updatedAt",
            ExpressionAttributeNames:{
                "#name": "name",
                "#updatedAt" :"updatedAt"
            },
            ExpressionAttributeValues:{
                ":name":objectName,
                ":updatedAt":new Date().toString()
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:'ALL_NEW' as const
        }

        const updateCommandOutput : UpdateCommandOutput = await dynamoDb.send(new UpdateCommand(updateCommandInput))

        if(!updateCommandOutput?.Attributes){
            throw new BAD_REQUEST_ERROR(`Failed to get the updated attributes`)
        }

        const updatedObject = updateCommandOutput?.Attributes
    
        return updatedObject as Object

    }
    catch(err:any){
        if(err instanceof ConditionalCheckFailedException){
            throw new NOTFOUND_ERROR(`Object with the id is not found to update`)
        }
        else if(err instanceof NOTFOUND_ERROR){
            throw new NOTFOUND_ERROR(`Failed to update as object with the id not found`)
        }
        else throw err
    }
}

// export async function updateObjectUploadStatusById(objectId:ObjectId,status:string):Promise<Object>{
//     try{
//         const input = {
//             TableName:process.env.IMAGES_TABLE,
//             Key:{
//                 id:imageId
//             },
//             UpdateExpression:"set #status=:status",
//             ExpressionAttributeNames:{
//                 "#status":"status"
//             },
//             ExpressionAttributeValues:{
//                 ":status":status
//             },
//             ConditionExpression:"attribute_exists(id)",
//             ReturnValues:"ALL_NEW" as const
//         }

//         const response = await dynamoDb.send(new UpdateCommand(input))

//         if(!response?.Attributes){
//             throw new BAD_REQUEST_ERROR(`Failed to get the updated attributes`)
//         }

//         const image = response?.Attributes

//         return image as Image
//     }
//     catch(err:any){
//         if(err?.name=="ConditionalCheckFailedException"){
//             throw new NOTFOUND_ERROR(`Image with the id not exists`)
//         }
//         else throw err
//     }
// }

export async function deleteObjectById(objectId:ObjectId):Promise<Object>{
    try{
        const deleteCommandInput : DeleteCommandInput = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:objectId
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:"ALL_OLD" as const
        }

        const deleteCommandOutput : DeleteCommandOutput = await dynamoDb.send(new DeleteCommand(deleteCommandInput))

        const deletedObject  = deleteCommandOutput?.Attributes

        return deletedObject as Object
    }
    catch(err:any){
        if(err instanceof ConditionalCheckFailedException){
            throw new NOTFOUND_ERROR(`Object with the id is not found to delete`)
        }
        else throw err
    }
}


export async function getPutObjectPresignedURL(objectName:ObjectName,folderId:FolderId):Promise<PresignedURL>{
    try{
        const folder : Folder = await getFolderById(folderId)

        const object : Object = await addObject(objectName,folderId)

        const putObjectPresignedURL = await generatePutObjectPresignedURL(object?.key)

        return putObjectPresignedURL ;
    }
    catch(err:any){
        throw err ;
    }
}

export async function getObjectPresignedURL(objectId:ObjectId):Promise<PresignedURL>{
    try{
        const object : Object = await getObjectById(objectId)

        if(object?.status===UploadStatus.pending){
            throw new BAD_REQUEST_ERROR(`Cannot get presignedURL as object not exists in the bucket`)
        }
        
        const objectKey = object?.key

        const presignedURL : PresignedURL = await generateGetObjectPresignedURL(objectKey)

        return presignedURL
    }
    catch(err:any){
        throw err 
    }
}

export async function getPresignedUrl(objectId:ObjectId):Promise<PresignedURL>{
    try{
        const object : Object = await getObjectById(objectId)

        if(object && object?.status!=UploadStatus?.pending){
            throw new BAD_REQUEST_ERROR(`Cannot get the presigned url for the uploaded image`)
        }

        const objectKey : string = object?.key

        if(objectKey===undefined){
            throw new BAD_REQUEST_ERROR(`ObjectKey is undefined,presignedURL cannot be genearated without objectKey`)
        }

        const presignedURL : PresignedURL = await generatePutObjectPresignedURL(objectKey)

        return presignedURL

    }
    catch(err:any){
        throw err
    }
}

export async function fetchObjectsByFolderId(folderId:FolderId,cursor:Cursor){
    try{

        const folder = await getFolderById(folderId)

        let decodedCursor = undefined

        if(cursor && cursor!=='null' && cursor!=='undefined'){
            decodedCursor = CursorCodec.decode(cursor)
        }
        
        const input : QueryCommandInput = {
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

        const queryResult = await dynamoDb.send(new QueryCommand(input))

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

        const queryResult = await dynamoDb.send(new QueryCommand(input))

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