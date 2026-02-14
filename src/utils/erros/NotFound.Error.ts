
export class NOTFOUND_ERROR extends Error{
    public statusCode : number = 404

    constructor(errorMessage:string){
        super(errorMessage)
        Error.captureStackTrace(this,this.constructor);
    }
}
