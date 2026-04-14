import { STATUSCODE } from "../constants/statusCodes.js";

export class TooManyRequestsError extends Error{
    public readonly statusCode : number = STATUSCODE.TOOMANYREQUESTS
    public readonly retryAfter : number

    constructor(errorMessage:string,retryAfter:number){
        super(errorMessage)
        this.name = "TooManyRequests"
        this.retryAfter = retryAfter
        Error.captureStackTrace(this,this.constructor);
    }
}