import {z} from "zod"
import { VALIDATION_ERROR } from "../utils/erros/Validation.Error.js"
import type { ObjectId, ObjectName } from "./object.types.js"
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js"

export  function validateObjectName(objectName:string):ObjectName{
    try{
        if(objectName===undefined){
            throw new BAD_REQUEST_ERROR(`Name of a object is a required field`)
        }
        const schema = z.string("ImageName must be type of string")
        .trim()
        .min(1,"Image cannot be empty")
        
        const validationResponse =  schema.safeParse(objectName)

        if(!validationResponse?.success){
            throw new VALIDATION_ERROR(
                validationResponse?.error?.message 
            )
        }

        return validationResponse?.data
    }
    catch(err:any){
        throw err
    }
}

export function validateObjectId(objectId:ObjectId):ObjectId{
    try{
        if(objectId===undefined){
            throw new BAD_REQUEST_ERROR(`ObjectId is a required field`)
        }
        const schema = z.string("ObjectId must be of type string")
        .trim()
        .min(1,"Image Id cannot be empty")

        const validationResponse = schema.safeParse(objectId)

        if(!validationResponse?.success){
            throw new VALIDATION_ERROR(
                validationResponse?.error?.message  
            )
        }

        return validationResponse?.data
    }
    catch(err:any){
        throw err
    }
}