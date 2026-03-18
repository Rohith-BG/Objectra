import { STATUSCODE } from "../constants/statusCodes.js";

export class ForbiddenError extends Error {
    public readonly statusCode: number = STATUSCODE.FORBIDDEN

    constructor(message: string) {
        super(message);
        this.name = "ForbiddenError";
        Error.captureStackTrace(this, this.constructor);
    }
}