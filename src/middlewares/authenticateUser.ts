import type { NextFunction, Request, Response } from "express";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";
import { UnauthorizedError } from "../utils/errors/http.errors.js";
import { verifyToken } from "../utils/jwt/jwt.utils.js";

export function authenticateUser(req: Request, res: Response, next: NextFunction): void {
  const ctx = res.locals["log"] as CanonicalLogContext | undefined;

  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      if (ctx) {
        ctx.authStatus = "unauthenticated";
      }
      throw new UnauthorizedError("Authorization header is missing");
    }

    const [scheme, accessToken] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !accessToken) {
      if (ctx) {
        ctx.authStatus = "token_invalid";
      }
      throw new UnauthorizedError("Invalid authorization format — expected 'Bearer <token>'");
    }

    const payload = verifyToken(accessToken)

    req.user = payload

    if (ctx) {
      ctx.userId = payload.id;
      ctx.userRole = payload.role;
      ctx.authStatus = "authenticated";
    }

    next()
  } catch (err: any) {
    if (ctx && !ctx.authStatus) {
      const isExpired = err?.message?.includes("expired");
      ctx.authStatus = isExpired ? "token_expired" : "token_invalid";
    }

    next(err);
  }
}