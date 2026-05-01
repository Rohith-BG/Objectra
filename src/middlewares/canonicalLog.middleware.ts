import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";
import { emitCanonicalLog } from "../configs/logger.js";

export function canonicalLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  const ctx: CanonicalLogContext = {
    requestId: (req.headers["x-request-id"] as string) ?? randomUUID(),
    method: req.method,
    path: req.originalUrl,
    ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
    userAgent: req.headers["user-agent"] ?? "unknown",
    operations: [],
  };

  res.locals["log"] = ctx;
  res.setHeader("x-request-id", ctx.requestId);

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    ctx.durationMs = Number(endTime - startTime) / 1_000_000;
    ctx.statusCode = res.statusCode;
    ctx.contentLength = res.get("content-length") ?? "0";

    emitCanonicalLog(ctx);
  });

  next();
}
