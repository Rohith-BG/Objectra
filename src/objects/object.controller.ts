import type { NextFunction, Request, Response } from "express";
import { validateObjectId, validateObjectName } from "./object.validation.js";
import { validateCursor, validateFolderId } from "../folders/folder.validation.js";
import { completeObjectUploadById, deleteObjectById,fetchPendingObjectsByFolderId, getObjectPresignedURL, getPresignedUrlForPendingUploads, getPutObjectPresignedURL, getUploadedObjectsByFolderId} from "./object.service.js";
import type { FolderIdCursorQueryParam,ObjectId,ObjectIdQueryParam, ObjectName, } from "./object.types.js";
import type { Cursor, FolderId } from "../folders/folder.types.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";


export async function uploadObjectToS3(req:Request,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const folderId : FolderId = validateFolderId(req?.body?.folderId)

        const objectName : ObjectName = validateObjectName(req?.body?.name)

        const allowedFolders : string[] | undefined = req.user?.allowedFolders

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId };
        }

        const presignedURL = await getPutObjectPresignedURL(objectName,folderId,allowedFolders, ctx)

        res.status(STATUSCODE?.OK).json(presignedURL)
    }
    catch(err){
        next(err);
    }
}

export async function completeObjectUpload(req:Request,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const objectId : ObjectId = validateObjectId(req?.body?.objectId)

        const allowedFolders : string[] | undefined = req.user?.allowedFolders

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, objectId };
        }

        const completedObject = await completeObjectUploadById(objectId,allowedFolders, ctx)

        res.status(STATUSCODE.OK).json(completedObject)
    }
    catch(err){
        next(err);
    }
}

export async function getObjectFromS3(req:Request<{},{},{},ObjectIdQueryParam>,res:Response,next:NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const objectId = validateObjectId(req?.query?.id)
        
        const allowedFolders : string[] | undefined = req.user?.allowedFolders

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, objectId };
        }

        const presignedURL = await getObjectPresignedURL(objectId,allowedFolders, ctx)

        res.status(STATUSCODE?.OK).json(presignedURL)
    }
    catch(err){
        next(err);
    }
}

export async function getPresignedURL(req:Request<{},{},{},ObjectIdQueryParam>,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const objectId : ObjectId = validateObjectId(req?.query?.id)

        const allowedFolders : string[] | undefined = req.user?.allowedFolders

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, objectId };
        }
        
        const putObjectPresignedURL = await getPresignedUrlForPendingUploads(objectId,allowedFolders, ctx) 

        res.status(STATUSCODE?.OK).json(putObjectPresignedURL)
    }
    catch(err){
        next(err);
    }
}

export async function getUploadedObjectsByFolder(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const folderId : FolderId = validateFolderId(req?.query?.id)

        const cursor : Cursor = validateCursor(req?.query?.cursor)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId };
        }

        const uploadedObjects = await getUploadedObjectsByFolderId(folderId,cursor, ctx)

        res.status(STATUSCODE?.OK).json(uploadedObjects)
    }
    catch(err){
        next(err);
    }
}


export async function getPendingObjectByFolder(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const folderId : FolderId = validateFolderId(req?.query?.id)

        const cursor : Cursor = validateCursor(req?.query?.cursor)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId };
        }

        const pendingObjects = await fetchPendingObjectsByFolderId(folderId,cursor, ctx)

        res.status(STATUSCODE?.OK).json(pendingObjects)
    }
    catch(err){
        next(err);
    }
}


export async function deleteObject(req:Request<{},{},{},ObjectIdQueryParam>,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const objectId : ObjectId = validateObjectId(req?.query?.id)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, objectId };
        }

        const isDeleted  = await deleteObjectById(objectId, ctx)

        res.status(STATUSCODE?.OK).json(isDeleted)

    }
    catch(err){
        next(err);
    }
}