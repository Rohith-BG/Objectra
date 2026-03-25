import { STATUSCODE } from "../constants/statusCodes.js";

export class UnauthorizedError extends Error{
    public readonly statusCode : number = STATUSCODE.UNAUTHORIZED

    constructor(errorMessage:string){
        super(errorMessage)
        this.name = "Unauthorized"
        Error.captureStackTrace(this,this.constructor);
    }
}