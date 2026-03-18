import type { Request, Response } from "express";
import type {  Folder, FolderId, FolderIdParam, FolderIdQueryParam, FolderName, FolderNameRequestBody, ParentId, ParentIdQueryParam, UpdateParentIdRequestBody } from "./folder.types.js";
import { addFolder, deleteFolderById, getAllSubFoldersByParentId, getFolderById, listAllMainFolders, updateFolderNameById, updateParentIdByFolderId } from "./folder.service.js";
import {  validateFolderId, validateFoldername, validateParentId } from "./folder.validation.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";


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

        res.status(STATUSCODE?.OK).json(updatedFolder)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function updateParentId(req:Request<FolderIdParam,{},UpdateParentIdRequestBody,{}>,res:Response){
    try{
        const folderId : FolderId = validateFolderId(req?.params?.id)
 // have to update the validation of the body into a single function 
        const newParentId : FolderId = validateFolderId(req?.body?.parentId)
        const oldParentId : FolderId = validateFolderId(req?.body?.oldParentId)

        const updatedFolder : Folder = await updateParentIdByFolderId(folderId,oldParentId,newParentId)

        res.status(STATUSCODE?.OK).json(updatedFolder)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function deleteFolder(req:Request<{},{},{},FolderIdQueryParam>,res:Response){
    try{

        const folderId = validateFolderId(req?.query?.id)

        const folder :Folder = await deleteFolderById(folderId)

        res.status(STATUSCODE?.OK).json(folder)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}