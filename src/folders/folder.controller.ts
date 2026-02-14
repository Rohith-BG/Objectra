import type { Request, Response } from "express";
import type { CursorQueryParam, Folder, FolderId, FolderIdQueryParam, FolderName, FolderRequestBody } from "./folder.types.js";
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js";
import { addFolder, deleteFolderById, getFolderById, listAllFolders, updateFolderById } from "./folder.service.js";
import { validateCursor, validateFolderId, validateFoldername } from "./folder.validation.js";


export async function createFolder(req:Request,res:Response){
    try{
        
        let folderName : FolderName = req?.body?.name

        if(!folderName){
            throw new BAD_REQUEST_ERROR(`FolderName is a required field`)
        }
        
        folderName = validateFoldername(folderName)
       
        const folder:Folder = await addFolder(folderName)

        res.status(201).json(folder)
    }
    catch(err:any){
        res.status(err?.statusCode || 400).json(err?.stack)
    }
}


export async function getFolder(req:Request<{},{},{},FolderIdQueryParam>,res:Response){
    try{
        let folderId : FolderId = req?.query?.id

        if(!folderId){
            throw new BAD_REQUEST_ERROR(`Required folderId in query param `)
        }

        folderId = validateFolderId(folderId)

        const folder : Folder = await getFolderById(folderId)

        res.status(200).json(folder)

    }
    catch(err:any){
        res.status(err?.statusCode || 400).json(err?.stack)
    }
}

export async function getAllFolders(req:Request<{},{},{},CursorQueryParam>,res:Response){
    try{
        let cursor : string = req.query?.cursor

        if(!cursor){
            throw new BAD_REQUEST_ERROR(`Cursor query param is a required field`)
        }

        cursor = validateCursor(cursor)

        const paginatedResponse = await listAllFolders(cursor)

        res.status(200).json(paginatedResponse)
    }
    catch(err:any){
        res.status(err?.statusCode || 400).json(err?.stack)
    }
}


export async function updateFolder(req:Request<{},{},FolderRequestBody,FolderIdQueryParam>,res:Response){
    try{
        let folderId : FolderId = req?.query?.id
        let folderName : FolderName = req?.body?.name
        
        if(!folderId){
            throw new BAD_REQUEST_ERROR(`Query Param of folder id and body are required fields`)
        }

        folderId = validateFolderId(folderId)

        folderName=validateFoldername(folderName)

        const updateDetails = await updateFolderById(folderId,folderName)

        res.status(200).json(updateDetails)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
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