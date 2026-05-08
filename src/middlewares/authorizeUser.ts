import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../users/user.type.js";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";
import { ForbiddenError } from "../utils/errors/http.errors.js";

const ROLE_METHOD_ACCESS: Record<UserRole, string[]> = {
  READ_ONLY  : ["GET"],
  WRITE_ONLY : ["POST"],
  READ_WRITE : ["GET", "POST"],
  ADMIN      : ["GET", "POST", "PUT", "PATCH", "DELETE"],
};

export function authorizeUser(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const user = req.user
    const requestMethod = req.method

    if (!user) {
      throw new ForbiddenError("User not authenticated");
    }

    const allowedMethods = ROLE_METHOD_ACCESS[user.role as UserRole];

    if (!allowedMethods) {
      throw new ForbiddenError("Invalid user role");
    }

    if (!allowedMethods.includes(requestMethod)) {
      throw new ForbiddenError(
        `Role ${user.role} is not allowed to perform ${requestMethod} operations`
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}
