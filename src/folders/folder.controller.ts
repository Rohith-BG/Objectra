import type { Request, Response } from "express";
import type { CursorQueryParam, Folder, FolderId, FolderIdParam, FolderIdQueryParam, FolderName, FolderNameRequestBody, ParentId, ParentIdQueryParam, UpdateParentIdRequestBody } from "./folder.types.js";
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js";
import { addFolder, deleteFolderById, getAllSubFoldersByParentId, getFolderById, listAllMainFolders, updateFolderNameById, updateParentIdByFolderId } from "./folder.service.js";
import {  validateFolderId, validateFoldername, validateParentId } from "./folder.validation.js";
import { STATUSCODE } from "../constants/statusCodes.js";


export async function createFolder(req:Request,res:Response){
    try{
        
        const folderName : FolderName = validateFoldername(req?.body?.name)

        const parentId : ParentId = validateParentId(req?.body?.parentId) 

        const folder:Folder = await addFolder(folderName , parentId)

        res.status(STATUSCODE?.CREATED).json(folder)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.message)
    }
}


export async function getFolder(req:Request<{},{},{},FolderIdQueryParam>,res:Response){
    try{
        const folderId : FolderId = validateFolderId(req?.query?.id)

        const folder : Folder = await getFolderById(folderId)

        res.status(STATUSCODE.OK).json(folder)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

// export async function getAllFolders(req:Request<{},{},{},CursorQueryParam>,res:Response){
//     try{
//         let cursor : string = req.query?.cursor

//         if(!cursor){
//             throw new BAD_REQUEST_ERROR(`Cursor query param is a required field`)
//         }

//         cursor = validateCursor(cursor)

//         const paginatedResponse = await listAllFolders(cursor)

//         res.status(200).json(paginatedResponse)
//     }
//     catch(err:any){
//         res.status(err?.statusCode || 400).json(err?.stack)
//     }
// }
export async function getAllMainFolders(req:Request,res:Response){
    try{
        const mainFolders : Folder[] = await listAllMainFolders() 

        res.status(STATUSCODE?.OK).json(mainFolders)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function getAllSubFolders(req:Request<{},{},{},ParentIdQueryParam>,res:Response){
    try{
        const parentId : ParentId = validateParentId(req?.query?.parentId)

        const subFolders = await getAllSubFoldersByParentId(parentId)

        res.status(STATUSCODE?.OK).json(subFolders)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}


export async function updateFolderName(req:Request<FolderIdParam,{},FolderNameRequestBody,{}>,res:Response){
    try{
        const folderId = validateFolderId(req?.params?.id)

        const newFolderName=validateFoldername(req?.body?.name)

        const updatedFolder = await updateFolderNameById(folderId,newFolderName)

        res.status(200).json(updatedFolder)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function updateParentId(req:Request<FolderIdParam,{},UpdateParentIdRequestBody,{}>,res:Response){
    try{
        const folderId : FolderId = validateFolderId(req?.params?.id)
        // const currentParentId : FolderId= validateFolderId(req?.body?.currentParentId)
        const newParentId : FolderId = validateFolderId(req?.body?.newParentId)

        const updatedFolder : Folder = await updateParentIdByFolderId(folderId,newParentId)

        res.status(STATUSCODE?.OK).json(updatedFolder)
    }
    catch(err:any){
        res.status(err?.statusCode||400).json(err?.stack)
    }
}

export async function deleteFolder(req:Request<{},{},{},FolderIdQueryParam>,res:Response){
    try{
        let folderId:FolderId = req?.query?.id

        if(!folderId){
            throw new BAD_REQUEST_ERROR(`Query Param of Folder Id is a required field`)
        }

        folderId = validateFolderId(folderId)

        const folder :Folder = await deleteFolderById(folderId)

        res.status(200).json(folder)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}