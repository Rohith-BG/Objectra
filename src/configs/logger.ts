import type { CanonicalLogContext } from "../types/canonicalLog.types.js";
import pino from "pino"

const DEFAULT_LOG_LEVEL = "info";
const NOISE_REDUCTION_PATHS = new Set(["/health", "/healthz", "/ready"]);
const NOISE_REDUCTION_METHODS = new Set(["OPTIONS"]);

const logger = pino({
  level: process.env["LOG_LEVEL"] ?? DEFAULT_LOG_LEVEL,

  ...(process.env["NODE_ENV"] !== "PRODUCTION" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  }),

  base: {
    service: "mycloud-api",
    env: process.env["NODE_ENV"] ?? "development",
  },

  timestamp: pino.stdTimeFunctions.isoTime,

  serializers: {
    err: pino.stdSerializers.err,
  },
});

function resolveLogLevel(
  ctx: CanonicalLogContext,
): "error" | "warn" | "info" | "debug" {
  const status = ctx.statusCode ?? 500;

  if (status >= 500 || (ctx.error && !ctx.error.isOperational)) {
    return "error";
  }

  if (status >= 400) {
    return "warn";
  }

  if (
    NOISE_REDUCTION_PATHS.has(ctx.path) ||
    NOISE_REDUCTION_METHODS.has(ctx.method)
  ) {
    return "debug";
  }

  return "info";
}

function buildCanonicalLine(ctx: CanonicalLogContext): Record<string, unknown> {
  const line: Record<string, unknown> = {
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    statusCode: ctx.statusCode,
    durationMs: ctx.durationMs != null ? Math.round(ctx.durationMs) : undefined,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };

  if (ctx.userId !== undefined) line["userId"] = ctx.userId;
  if (ctx.userRole !== undefined) line["userRole"] = ctx.userRole;
  if (ctx.authStatus !== undefined) line["authStatus"] = ctx.authStatus;
  if (ctx.contentLength !== undefined) line["contentLength"] = ctx.contentLength;

  if (ctx.operations.length > 0) {
    line["operations"] = ctx.operations;
  }

  if (ctx.resourceIds && Object.keys(ctx.resourceIds).length > 0) {
    line["resourceIds"] = ctx.resourceIds;
  }

  if (ctx.db) line["db"] = ctx.db;
  if (ctx.cache) line["cache"] = ctx.cache;
  if (ctx.s3) line["s3"] = ctx.s3;

  if (ctx.error) {
    line["error"] = {
      name: ctx.error.name,
      message: ctx.error.message,
      isOperational: ctx.error.isOperational,
      ...(ctx.error.stack ? { stack: ctx.error.stack } : {}),
    };
  }

  return line;
}

function emitCanonicalLog(ctx: CanonicalLogContext): void {
  const level = resolveLogLevel(ctx);
  const line = buildCanonicalLine(ctx);
  const msg = `${ctx.method} ${ctx.path}`;

  logger[level](line, msg);
}

export { logger, resolveLogLevel, buildCanonicalLine, emitCanonicalLog };
export default logger;
