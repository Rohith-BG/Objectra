import z, { object, string } from "zod";
import { BadRequestError } from "../utils/errors/badrequest.error.js";
import { ValidationError } from "../utils/errors/validation.error.js";
import type { UserBody } from "./user.type.js";
import { CreateUserSchema, updatePasswordSchema, userIdQueryParamSchema } from "./user.schemas.js";

export function validateCreateUserBody(userBody : unknown ){
    try{

        if(!userBody){   
            throw new BadRequestError(`Requesst Body is missing or not in a valid format`)
        }

        const validationResult  = CreateUserSchema.safeParse(userBody)

        if (!validationResult.success) {
            throw new ValidationError(validationResult?.error?.message);
        }

        return validationResult?.data
    }
    catch(error : unknown){
        throw error
    }
}

export function validateUserIdQueryParam(requestQuery : unknown){
    try{
        const validationResult = userIdQueryParamSchema.safeParse(requestQuery)

        if(!validationResult?.success){
            throw new ValidationError(validationResult?.error?.message)
        }

        return validationResult?.data
    }
    catch(error:unknown){
        throw error
    }
}

export function validateUpdatePasswordBody(updatePasswordRequestBody : unknown){
    try{
        const validationResult = updatePasswordSchema.safeParse(updatePasswordRequestBody)

        if(!validationResult?.success){
            throw new ValidationError(validationResult?.error?.message)
        }

        return validationResult?.data
    }
    catch(error : unknown){
        throw error
    }
}