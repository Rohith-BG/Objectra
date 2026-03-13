import {z} from "zod"
import type { FolderId, FolderName, ParentId } from "./folder.types.js";
import { BAD_REQUEST_ERROR } from "../utils/errors/badrequest.error.js";
import { VALIDATION_ERROR } from "../utils/errors/validation.error.js";

export function validateFoldername(folderName:FolderName){

    try{
        if(folderName==undefined){
            throw new BAD_REQUEST_ERROR(`FolderName is a required field`)
        }
        const validationSchema = z.string(`FolderName should be of type string`)
        .trim()
        .min(1,`FolderName is a required Field`)

        const validationResponse = validationSchema.safeParse(folderName)

        if(!validationResponse.success){
            throw new VALIDATION_ERROR(
                validationResponse?.error?.message
            )
        }

        return validationResponse?.data
    }
    catch(err){
        throw err
    }
}

export function validateFolderId(folderId:FolderId){
    try{
        if(folderId===undefined){
            throw new BAD_REQUEST_ERROR(`FolderId is a required field`)
        }

        const schema = z.string(`FolderId should be of type string`)
        .trim()
        .min(1,`FolderId is cannot be a empty string`)

        const validationResponse = schema.safeParse(folderId)

        if(!validationResponse.success){
            throw new VALIDATION_ERROR(validationResponse?.error?.issues[0]?.message!)
        }

        return validationResponse?.data
    }
    catch(err){
        throw err
    }
}

export function validateCursor(cursor : unknown){
    try{
        const cursorSchema = z.string(`Cursor must be of type string`)
            .trim()
            .min(1,`Cursor cannot be empty`)

        const validationResponse = cursorSchema.safeParse(cursor)

        if(!validationResponse?.success){
            throw new VALIDATION_ERROR(validationResponse?.error?.issues[0]?.message ?? `Validation Failed`)
        }

        return validationResponse?.data
    }
    catch(err:any){
        throw err
    }
}


export function validateParentId(parentId:ParentId){
    try{
        if(parentId===undefined){
            throw new BAD_REQUEST_ERROR(`ParentId is a required field`)
        }

        const parentIdSchema = z.string("ParentId must be of type string")
        .trim()
        .min(1,`ParentId is a required field`)
        .nullable()

        const validationResponse = parentIdSchema.safeParse(parentId)

        if(validationResponse?.error){
            throw new VALIDATION_ERROR(validationResponse?.error?.issues[0]?.message!)
        }

        return validationResponse?.data
    }
    catch(err:any){
        throw err
    }
}
