export class ValidationError extends Error{
    public statusCode : number = 400

    constructor(message:string){
        super(message)
        Error.captureStackTrace(this,this.constructor);
    }
}