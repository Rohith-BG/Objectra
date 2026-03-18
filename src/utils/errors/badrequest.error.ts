import { STATUSCODE } from "../constants/statusCodes.js";

export class BadRequestError extends Error{
    public readonly statusCode : number = STATUSCODE.BAD_REQUEST

    constructor(errorMessage:string){
        super(errorMessage)
        this.name = "BadRequestError"
        Error.captureStackTrace(this,this.constructor);
    }
}