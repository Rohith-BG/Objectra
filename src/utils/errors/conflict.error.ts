import { STATUSCODE } from "../constants/statusCodes.js";

export class ConflictError extends Error {
    public readonly statusCode: number = STATUSCODE.CONFLICT

    constructor(errorMessage: string) {
        super(errorMessage)
        this.name = "ConflictError"
        Error.captureStackTrace(this, this.constructor);
    }
}
