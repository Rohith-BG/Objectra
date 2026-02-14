import {z} from "zod"
import type { FolderId, FolderName } from "./folder.types.js";
import { VALIDATION_ERROR } from "../utils/erros/Validation.Error.js";

export function validateFoldername(folderName:FolderName){

    try{
        const validationSchema = z.string()
        .min(1,'FolderName is required')
        .transform((val) => val.trim())
        .refine((val) => val.length > 0, {
            message: "FolderName cannot be empty"
        })

        const validationResponse = validationSchema.safeParse(folderName)

        if(!validationResponse.success){
            throw new VALIDATION_ERROR(
                validationResponse?.error?.issues[0]?.message ?? "Foldername should be type of string"
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
        const schema = z.string()
        .min(1,"Id is required")
        .transform((id)=>id.trim())
        .refine((id)=>id.length > 0,{
            message:'folderId cannot be empty'
        })

        const validationResponse = schema.safeParse(folderId)

        if(!validationResponse.success){
            throw new VALIDATION_ERROR(validationResponse?.error?.issues[0]?.message ?? "Foldername should be type of string")
        }

        return validationResponse?.data
    }
    catch(err){
        throw err
    }
}

export function validateCursor(cursor : String){
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

