import type { Request, Response } from "express";
import { validateObjectId, validateObjectName } from "./object.validation.js";
import { validateCursor, validateFolderId } from "../folders/folder.validation.js";
import {  addObject, deleteObjectById,  fetchObjectsByFolderId,  fetchPendingObjectsByFolderId, getObjectById, getObjectPresignedURL, getPresignedUrl, getPutObjectPresignedURL, updateObjectNameById } from "./object.service.js";
import type { FolderIdCursorQueryParam, Object, ObjectId, ObjectIdParam, ObjectIdQueryParam, ObjectName, ObjectRequestBody } from "./object.types.js";
import type { Cursor, FolderId } from "../folders/folder.types.js";
import { STATUSCODE } from "../constants/statusCodes.js";


export async function createObject(req:Request,res:Response){
    try{
        // let {name,folderId} : Object = req?.body 

        // if(!folderId || !name){
        //     throw new BAD_REQUEST_ERROR(`ImageName and FolderId are required field`)
        // }
         
        // name  = validateImageName(name)
        // folderId  = validateFolderId(folderId)

        const name : ObjectName = validateObjectName(req?.body?.name)

        const folderId : FolderId = validateFolderId(req?.body?.folderId)

        const object : Object = await addObject(name,folderId)

        res.status(STATUSCODE?.CREATED).json(object)
        
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function getObject(req:Request<{},{},{},ObjectIdQueryParam>,res:Response){
    try{
        const objectId : ObjectId = validateObjectId(req?.query?.id)

        const object = await getObjectById(objectId)

        res.status(STATUSCODE?.OK).json(object)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function updateObjectName(req:Request<ObjectIdParam,{},ObjectRequestBody,{}>,res:Response){
    try{
        const name : ObjectName = validateObjectName(req?.body?.name)
        const id : ObjectId = validateObjectId(req?.params?.id)

        const object : Object = await updateObjectNameById(id,name)

        res.status(STATUSCODE?.OK).json(object)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function deleteObject(req:Request<{},{},{},ObjectIdQueryParam>,res:Response){
    try{
        const objectId : ObjectId = validateObjectId(req?.query?.id)

        const object = await deleteObjectById(objectId)

        res.status(STATUSCODE?.OK).json(object)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}


export async function uploadObjectToS3(req:Request,res:Response){
    try{
        // let {folderId,imageName}  = req?.body

        // if(!folderId || !imageName){
        //     throw new BAD_REQUEST_ERROR(`FolderName and ImageName are required fields`)
        // }

        // folderId = validateFolderId(folderId)
        // imageName = validateImageName(imageName)
        const folderId : FolderId = validateFolderId(req?.body?.folderId)

        const objectName : ObjectName = validateObjectName(req?.body?.name)

        const presignedURL = await getPutObjectPresignedURL(objectName,folderId)

        res.status(STATUSCODE?.OK).json(presignedURL)

    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function getObjectFromS3(req:Request<{},{},{},ObjectIdQueryParam>,res:Response) {
    try{
        // let imageId : ImageId = req?.query?.id

        // if(!imageId){
        //     throw new BAD_REQUEST_ERROR(`Query param of Image id is a required field`)
        // }

        // imageId = validateImageId(imageId)
        const objectId = validateObjectId(req?.query?.id)

        const presignedURL = await getObjectPresignedURL(objectId)

        res.status(STATUSCODE?.OK).json(presignedURL)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function getPresignedURL(req:Request<{},{},{},ObjectIdQueryParam>,res:Response){
    try{
        // let Id : ImageId = req?.query?.id

        // if(!imageId) {
        //     throw new BAD_REQUEST_ERROR(`Query param of imageId is a required field`)
        // }

        // imageId = validateImageId(imageId)

        const objectId : ObjectId = validateObjectId(req?.query?.id)
        
        const putObjectPresignedURL = await getPresignedUrl(objectId) 

        res.status(STATUSCODE?.OK).json(putObjectPresignedURL)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

// export  async function getImageByObjectKey(req:Request,res:Response){
//     try{
//         const objectKey = req?.query?.id as string

//         const input = {
//             TableName:"Images",
//             IndexName:"ObjectKeyIndex",
//             KeyConditionExpression:"objectKey=:key",
//             ExpressionAttributeValues:{
//                 ":key":objectKey
//             }
//         }

//         const response = await dynamoDb.send(new QueryCommand(input))
//         console.log(response)

//         res.status(200).json(response?.Items)
//     }
//     catch(err:any){
//         res.status(400).json(err?.stack)
//     }
// }

export async function getUploadedObjectsByFolder(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response){
    try{
        // let folderId : FolderId = req?.query?.id 
        // let cursor : Cursor = req?.query?.cursor

        // if(!folderId || !cursor){
        //     throw new BAD_REQUEST_ERROR(`FolderId and cursor are required query params`)
        // }

        // folderId = validateFolderId(folderId)
        // cursor = validateCursor(cursor)
        const folderId : FolderId = validateFolderId(req?.query?.id)

        const cursor : Cursor = validateCursor(req?.query?.cursor)

        const uploadedObjects = await fetchObjectsByFolderId(folderId,cursor)

        res.status(STATUSCODE?.OK).json(uploadedObjects)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}


export async function getPendingObjectByFolder(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response){
    try{
        // let folderId : FolderId = req?.query?.id 
        // let cursor : Cursor = req?.query?.cursor

        // if(!folderId || !cursor){
        //     throw new BAD_REQUEST_ERROR(`FolderId and Cursor are required query params`)
        // }

        // folderId = validateFolderId(folderId)
        // cursor = validateCursor(cursor)

        const folderId : FolderId = validateFolderId(req?.query?.id)

        const cursor : Cursor = validateCursor(req?.query?.id)

        const pendingObjects = await fetchPendingObjectsByFolderId(folderId,cursor)

        res.status(STATUSCODE?.OK).json(pendingObjects)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}