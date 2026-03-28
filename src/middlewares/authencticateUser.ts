import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../utils/errors/unauthorized.error.js";
import { verifyToken } from "../utils/jwt/jwt.utils.js";

export async function authenticateUser(req:Request,res:Response,next:NextFunction): Promise<void> {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedError("Authorization header is missing");
    }

   const [scheme, accessToken] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !accessToken) {
      throw new UnauthorizedError("Invalid authorization format — expected 'Bearer <token>'");
    }

    const payload = verifyToken(accessToken)

    req.user = payload

    next()
  } catch (error: any) {
    res.status(error?.statusCode).json(error?.message);
  }
}