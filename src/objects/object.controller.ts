import type { Request, Response } from "express";
import { validateObjectId, validateObjectName } from "./object.validation.js";
import { validateCursor, validateFolderId } from "../folders/folder.validation.js";
import {  addObject, deleteObjectById,fetchPendingObjectsByFolderId, getObjectById, getObjectPresignedURL, getPresignedUrlForPendingUploads, getPutObjectPresignedURL, getUploadedObjectsByFolderId} from "./object.service.js";
import type { FolderIdCursorQueryParam, Object, ObjectId, ObjectIdParam, ObjectIdQueryParam, ObjectName, ObjectRequestBody } from "./object.types.js";
import type { Cursor, FolderId } from "../folders/folder.types.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";


export async function createObject(req:Request,res:Response){
    try{
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

// export async function updateObjectName(req:Request<ObjectIdParam,{},ObjectRequestBody,{}>,res:Response){
//     try{
//         const name : ObjectName = validateObjectName(req?.body?.name)
//         const id : ObjectId = validateObjectId(req?.params?.id)

//         const object : Object = await updateObjectNameById(id,name)

//         res.status(STATUSCODE?.OK).json(object)
//     }
//     catch(err:any){
//         res.status(err?.statusCode).json(err?.stack)
//     }
// }


export async function uploadObjectToS3(req:Request,res:Response){
    try{
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
        const objectId : ObjectId = validateObjectId(req?.query?.id)
        
        const putObjectPresignedURL = await getPresignedUrlForPendingUploads(objectId) 

        res.status(STATUSCODE?.OK).json(putObjectPresignedURL)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function getUploadedObjectsByFolder(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response){
    try{
        const folderId : FolderId = validateFolderId(req?.query?.id)

        const cursor : Cursor = validateCursor(req?.query?.cursor)

        const uploadedObjects = await getUploadedObjectsByFolderId(folderId,cursor)

        res.status(STATUSCODE?.OK).json(uploadedObjects)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}


export async function getPendingObjectByFolder(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response){
    try{
        const folderId : FolderId = validateFolderId(req?.query?.id)

        const cursor : Cursor = validateCursor(req?.query?.cursor)

        const pendingObjects = await fetchPendingObjectsByFolderId(folderId,cursor)

        res.status(STATUSCODE?.OK).json(pendingObjects)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}


export async function deleteObject(req:Request<{},{},{},ObjectIdQueryParam>,res:Response){
    try{
        const objectId : ObjectId = validateObjectId(req?.query?.id)

        const isDeleted  = await deleteObjectById(objectId)

        res.status(STATUSCODE?.OK).json(isDeleted)

    }
    catch(err:any){
        res.status(STATUSCODE?.BAD_REQUEST).json(err.message)
    }
}