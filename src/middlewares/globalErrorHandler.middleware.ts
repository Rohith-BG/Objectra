import type { Request, Response, NextFunction } from "express";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";

export function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    const isOperational = "statusCode" in err;
    const statusCode = isOperational ? (err as any).statusCode as number : 500;

    if (ctx && !ctx.error) {
        ctx.error = {
            name: err.name,
            message: err.message,
            ...(err.stack ? { stack: err.stack } : {}),
            isOperational,
        };
    }

    res.status(statusCode).json({
        error: isOperational ? err.message : "Internal server error",
    });
}
