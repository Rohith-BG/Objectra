import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type PutCommandInput, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type { Cursor, Folder, FolderId } from "../folders/folder.types.js";
import RandomIdGenerator from "../utils/create-randomId.js";
import { UploadStatus, type Image, type ImageId, type ImageName, type PresignedURL} from "./image.types.js";
import { dynamoDb } from "../configs/dynamoDb.js";
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js";
import { NOTFOUND_ERROR } from "../utils/erros/NotFound.Error.js";
import { getFolderById } from "../folders/folder.service.js";
import { generatePutObjectPresignedURL } from "../utils/S3-PresignedUrl/putObject.js";
import { generateGetObjectPresignedURL } from "../utils/S3-PresignedUrl/getObject.js";
import CursorCodec from "../utils/cursorCodec.js";
import { string } from "zod";


export async function addImage(imageName:ImageName,folderId:FolderId):Promise<Image>{
    try{
        const folder = await getFolderById(folderId);

        const image : Image = {
            id:`Image@${RandomIdGenerator.getId()}`,
            objectKey:`${imageName}@${RandomIdGenerator.getId()}`,
            folderId:folderId,
            name:imageName,
            status:UploadStatus.pending,
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
        }

        const putCommand : PutCommand = new PutCommand({
            TableName:process.env.IMAGES_TABLE,
            Item:image
        })

        const response = await dynamoDb.send(putCommand)

        if(response?.$metadata?.httpStatusCode!==200){
            throw new BAD_REQUEST_ERROR(`Failed to create the image`)
        }


        return image as Image
    }
    catch(err:any){
        if(err?.name=="ResourceNotFoundException"){
            throw new BAD_REQUEST_ERROR(`The requested resource table not exists`)
        }
        throw err
    }

}

export async function getImageById(imageId:ImageId):Promise<Image>{
    try{
        
        const input = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:imageId
            }
        }

        const response = await dynamoDb.send(new GetCommand(input))

        if(!response?.Item){
            throw new NOTFOUND_ERROR(`Image with the id is not found`)
        }

        const image = response?.Item

        return image as Image
    }
    catch(err:any){
        throw err
    }
}

export async function updateImageNameById(imageId:ImageId,imageName:ImageName):Promise<Image>{
    try{
        const input = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:imageId
            },
            UpdateExpression:"set #name=:name",
            ExpressionAttributeNames:{
                "#name": "name"
            },
            ExpressionAttributeValues:{
                ":name":imageName
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:'ALL_NEW' as const
        }

        const response = await dynamoDb.send(new UpdateCommand(input))

        if(!response?.Attributes){
            throw new BAD_REQUEST_ERROR(`Failed to get the updated attributes`)
        }

        const image = response?.Attributes
    
        return image as Image

    }
    catch(err:any){
        if(err?.name=="ConditionalCheckFailedException"){
            throw new NOTFOUND_ERROR(`Image with the id is not found to update`)
        }
        else throw err
    }
}

export async function updateImageUploadStatusById(imageId:ImageId,status:string):Promise<Image>{
    try{
        const input = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:imageId
            },
            UpdateExpression:"set #status=:status",
            ExpressionAttributeNames:{
                "#status":"status"
            },
            ExpressionAttributeValues:{
                ":status":status
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:"ALL_NEW" as const
        }

        const response = await dynamoDb.send(new UpdateCommand(input))

        if(!response?.Attributes){
            throw new BAD_REQUEST_ERROR(`Failed to get the updated attributes`)
        }

        const image = response?.Attributes

        return image as Image
    }
    catch(err:any){
        if(err?.name=="ConditionalCheckFailedException"){
            throw new NOTFOUND_ERROR(`Image with the id not exists`)
        }
        else throw err
    }
}

export async function deleteImageById(imageId:ImageId):Promise<Image>{
    try{
        const input = {
            TableName:process.env.IMAGES_TABLE,
            Key:{
                id:imageId
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:"ALL_OLD" as const
        }

        const response = await dynamoDb.send(new DeleteCommand(input))

        const deletedImage  = response?.Attributes

        return deletedImage as Image
    }
    catch(err:any){
        if(err?.name=="ConditionalCheckFailedException"){
            throw new NOTFOUND_ERROR(`Image with the id is not found to delete`)
        }
        else throw err
    }
}


export async function getPutObjectPresignedURL(imageName:ImageName,folderId:FolderId):Promise<PresignedURL>{
    try{
        const folder : Folder = await getFolderById(folderId)

        const image = await addImage(imageName,folderId)

        const putObjectPresignedURL = await generatePutObjectPresignedURL(image?.objectKey)

        return putObjectPresignedURL ;

    }
    catch(err:any){
        throw err ;
    }
}

export async function getObjectPresignedURL(imageId:ImageId):Promise<PresignedURL>{
    try{
        const image : Image = await getImageById(imageId)

        if(image?.status===UploadStatus.pending){
            throw new BAD_REQUEST_ERROR(`Cannot get presignedURL as image not exists in the bucket`)
        }
        
        const objectKey = image?.objectKey

        const presignedURL : PresignedURL = await generateGetObjectPresignedURL(objectKey)

        return presignedURL
    }
    catch(err:any){
        throw err 
    }
}

export async function getPresignedUrl(imageId:ImageId):Promise<PresignedURL>{
    try{
        const image : Image = await getImageById(imageId)

        if(image && image?.status!=UploadStatus?.pending){
            throw new BAD_REQUEST_ERROR(`Cannot get the presigned url for the uploaded image`)
        }

        const objectKey : string = image?.objectKey

        if(objectKey===undefined){
            throw new BAD_REQUEST_ERROR(`ObjectKey is undefined,presigned cannot be genearated without objectKey`)
        }

        const presignedURL : PresignedURL = await generatePutObjectPresignedURL(objectKey)

        return presignedURL

    }
    catch(err:any){
        throw err
    }
}

export async function fetchImagesByFolderId(folderId:FolderId,cursor:Cursor){
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
                ":status" : UploadStatus.uploaded
            },
            Limit : 10 ,
            ExclusiveStartKey : decodedCursor
        }

        const queryResult = await dynamoDb.send(new QueryCommand(input))

        if(!queryResult?.Items || queryResult?.Items.length === 0){
            throw new NOTFOUND_ERROR(`No Uploaded Images with this folderId`)
        }

        const images = queryResult?.Items ?? []

        const lastEvaluatedKey = queryResult?.LastEvaluatedKey ? CursorCodec.encode(queryResult?.LastEvaluatedKey) : undefined

        return  {
            images,
            lastEvaluatedKey
        }
    }
    catch(err:any){
        throw err
    }
}

export async function fetchPendingImagesByFolderId(folderId:FolderId,cursor:Cursor){
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

        const images = queryResult?.Items ?? []

        const lastEvaluatedKey = queryResult?.LastEvaluatedKey ? CursorCodec.encode(queryResult?.LastEvaluatedKey) : undefined

        return  {
            images,
            lastEvaluatedKey
        }
    }
    catch(err:any){
        throw err
    }
}