import { STATUSCODE } from "../constants/statusCodes.js";
import { AppError } from "./app.error.js";

export class BadRequestError extends AppError {
    constructor(errorMessage: string) {
        super(STATUSCODE.BAD_REQUEST, errorMessage);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(STATUSCODE.BAD_REQUEST, message);
    }
}

export class UnauthorizedError extends AppError {
    constructor(errorMessage: string) {
        super(STATUSCODE.UNAUTHORIZED, errorMessage);
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string) {
        super(STATUSCODE.FORBIDDEN, message);
    }
}

export class NotFoundError extends AppError {
    constructor(errorMessage: string) {
        super(STATUSCODE.NOT_FOUND, errorMessage);
    }
}

export class ConflictError extends AppError {
    constructor(errorMessage: string) {
        super(STATUSCODE.CONFLICT, errorMessage);
    }
}

export class TooManyRequestsError extends AppError {
    public readonly retryAfter: number;

    constructor(errorMessage: string, retryAfter: number) {
        super(STATUSCODE.TOOMANYREQUESTS, errorMessage);
        this.retryAfter = retryAfter;
    }
}
