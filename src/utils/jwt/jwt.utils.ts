import jwt from "jsonwebtoken"
import type { AccessToken, AccessTokenPayload, JWTPayload} from "../../auth/auth.types.js";
import dotenv from "dotenv"
import RandomIdGenerator from "../helpers/create-randomId.helper.js";
import CursorCodec from "../helpers/cursorCodec.helper.js";
dotenv.config()
import crypto from "crypto"
import { UnauthorizedError } from "../errors/http.errors.js";

export function generateAccessToken(payload:JWTPayload):AccessToken{
    const accessToken : AccessToken = jwt.sign(
        payload,
        process.env.JWT_SECRET!,
        {
            algorithm : "HS512" ,
            expiresIn : "15m",
        }
    )

    return accessToken   
}

export function generateOpaqueToken(userId: string): string{

  const uuid = RandomIdGenerator.getId()

  const encodedRandom = CursorCodec.encode(uuid)

  return `${userId}.${encodedRandom}`
}

export function extractUserIdFromToken(rawToken: string): string | null {

  const dotIndex = rawToken.indexOf(".")

  if (dotIndex === -1) return null

  const userId = rawToken.substring(0, dotIndex)

  if (!userId) return null

  return userId
}

export const hashToken = (rawToken: string): string => {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
};


export const verifyToken = (accessToken: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(
      accessToken,
      process.env.JWT_SECRET!
    ) as AccessTokenPayload;

    return decoded;

  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Access token has expired");
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid access token");
    }
    
    throw error
  }
};