import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../users/user.type.js";
import { ForbiddenError } from "../utils/errors/forbidden.error.js";


export function requireRole(...allowedRoles: UserRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const user = req.user;

            if (!user) {
                throw new ForbiddenError("User not authenticated");
            }

            const userRole = user.role as UserRole;

            if (!allowedRoles.includes(userRole)) {
                throw new ForbiddenError(
                    `Access denied. This action requires one of the following roles: ${allowedRoles.join(", ")}`
                );
            }

            next();
        } catch (err) {
            next(err);
        }
    };
}
