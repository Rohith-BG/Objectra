export class BAD_REQUEST_ERROR extends Error{
    public statusCode : number = 400

    constructor(errorMessage:string){
        super(errorMessage)
        Error.captureStackTrace(this,this.constructor);
    }
}