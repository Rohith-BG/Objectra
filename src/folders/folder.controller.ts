import type { NextFunction, Request, Response } from "express";
import type { Folder, FolderId, FolderIdParam, FolderIdQueryParam, FolderName, FolderNameRequestBody, ParentId, ParentIdQueryParam, UpdateParentIdRequestBody } from "./folder.types.js";
import { createFolder as CreateFolderService, deleteFolderById, getAllSubFoldersByParentId, getFolderById, listAllMainFolders, updateFolderNameById, updateParentIdByFolderId } from "./folder.service.js";
import { validateFolderId, validateFoldername, validateParentId } from "./folder.validation.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";


export async function createFolder(req: Request, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const folderName: FolderName = validateFoldername(req?.body?.name)

        const parentId: ParentId = validateParentId(req?.body?.parentId)

        const folder: Folder = await CreateFolderService(folderName, parentId, ctx)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId: folder.id };
        }

        res.status(STATUSCODE?.CREATED).json(folder)
    }
    catch (err) {
        next(err);
    }
}


export async function getFolder(req: Request<{}, {}, {}, FolderIdQueryParam>, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const folderId: FolderId = validateFolderId(req?.query?.id)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId };
        }

        const folder: Folder = await getFolderById(folderId, undefined, ctx)

        res.status(STATUSCODE.OK).json(folder)
    }
    catch (err) {
        next(err);
    }
}

export async function getAllMainFolders(req: Request, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const allowedFolders: string[] | undefined = req.user?.allowedFolders

        const mainFolders: Folder[] = await listAllMainFolders(allowedFolders, ctx)

        res.status(STATUSCODE?.OK).json(mainFolders)
    }
    catch (err) {
        next(err);
    }
}

export async function getAllSubFolders(req: Request<{}, {}, {}, ParentIdQueryParam>, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const allowedFolders: string[] | undefined = req.user?.allowedFolders

        const parentId = validateParentId(req?.query?.parentId) as FolderId

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, parentId };
        }

        const subFolders = await getAllSubFoldersByParentId(parentId, allowedFolders, ctx)

        res.status(STATUSCODE?.OK).json(subFolders)
    }
    catch (err) {
        next(err);
    }
}


export async function updateFolderName(req: Request<FolderIdParam, {}, FolderNameRequestBody, {}>, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const folderId = validateFolderId(req?.params?.id)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId };
        }

        const newFolderName = validateFoldername(req?.body?.name)

        const updatedFolder = await updateFolderNameById(folderId, newFolderName, ctx)

        res.status(STATUSCODE?.OK).json(updatedFolder)
    }
    catch (err) {
        next(err);
    }
}

export async function updateParentId(req: Request<FolderIdParam, {}, UpdateParentIdRequestBody, {}>, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const folderId: FolderId = validateFolderId(req?.params?.id)
        // have to update the validation of the body into a single function 
        const newParentId: FolderId = validateFolderId(req?.body?.parentId)
        const oldParentId: FolderId = validateFolderId(req?.body?.oldParentId)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId, oldParentId, newParentId };
        }

        const updatedFolder: Folder = await updateParentIdByFolderId(folderId, oldParentId, newParentId, ctx)

        res.status(STATUSCODE?.OK).json(updatedFolder)
    }
    catch (err) {
        next(err);
    }
}

export async function deleteFolder(req: Request<{}, {}, {}, FolderIdQueryParam>, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const folderId = validateFolderId(req?.query?.id)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, folderId };
        }

        const folder: Folder = await deleteFolderById(folderId, ctx)

        res.status(STATUSCODE?.OK).json(folder)
    }
    catch (err) {
        next(err);
    }
}