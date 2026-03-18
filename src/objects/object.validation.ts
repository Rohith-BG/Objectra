import {z} from "zod"
import { ValidationError } from "../utils/errors/validation.error.js"
import type { ObjectId, ObjectName } from "./object.types.js"
import { BadRequestError } from "../utils/errors/badrequest.error.js"

export  function validateObjectName(objectName:string):ObjectName{
    try{
        if(objectName===undefined){
            throw new BadRequestError(`Name of a object is a required field`)
        }
        const schema = z.string("ImageName must be type of string")
        .trim()
        .min(1,"Image cannot be empty")
        
        const validationResponse =  schema.safeParse(objectName)

        if(!validationResponse?.success){
            throw new ValidationError(
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
            throw new BadRequestError(`ObjectId is a required field`)
        }
        const schema = z.string("ObjectId must be of type string")
        .trim()
        .min(1,"Image Id cannot be empty")

        const validationResponse = schema.safeParse(objectId)

        if(!validationResponse?.success){
            throw new ValidationError(
                validationResponse?.error?.message  
            )
        }

        return validationResponse?.data
    }
    catch(err:any){
        throw err
    }
}