import {z} from "zod"
import { VALIDATION_ERROR } from "../utils/erros/Validation.Error.js"
import type { ImageId, ImageName } from "./image.types.js"

export  function validateImageName(imageName:string):ImageName{
    try{
        const schema = z.string("ImageName must be type of string")
        .trim()
        .min(1,"Image cannot be empty")
        
        const validationResponse =  schema.safeParse(imageName)

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

export function validateImageId(imageId:ImageId):ImageId{
    try{
        const schema = z.string("ImageId is must be of type string")
        .trim()
        .min(1,"Image Id cannot be empty")

        const validationResponse = schema.safeParse(imageId)

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