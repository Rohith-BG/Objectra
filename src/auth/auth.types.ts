import type z from "zod";
import type { LoginUserBodySchema, refreshTokenCookieSchema } from "./auth.validationSchema.js";

export type LoginUserBody = z.infer<typeof LoginUserBodySchema>

export type AccessToken = string

export type RefreshToken = string 

export interface JWTPayload {
    id : string,
    role : string,
    allowedFolders : string[]
}

export interface RefreshTokenItem {
    id : string,
    userId : string,
    refreshToken : string,
    createdAt : string,
    ttl : number
}

export type RevokeRefreshTokenResult = 
  | { status: "SUCCESS" }
  | { status: "ALREADY_LOGGED_OUT" }

export type RefreshTokenCookie = z.infer<typeof refreshTokenCookieSchema>;

export type AccessTokenPayload = {
  id:string,
  role:string,
  allowedFolders:string[]
}

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}