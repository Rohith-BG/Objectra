import { ValidationError } from "../utils/errors/validation.error.js";
import type { LoginUserBody } from "./auth.types.js";
import { LoginUserBodySchema } from "./auth.validationSchema.js";


export function validateLoginUserBody(loginUserBody : unknown):LoginUserBody{
    try{
        const validationResult = LoginUserBodySchema.safeParse(loginUserBody)

        if(!validationResult.success){
            throw new ValidationError(validationResult.error.message)
        }

        return validationResult.data as LoginUserBody
    }
    catch(error : unknown){
        throw error
    }
}