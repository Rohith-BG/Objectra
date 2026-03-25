import jwt from "jsonwebtoken"
import type { AccessToken, JWTPayload} from "../../auth/auth.types.js";
import dotenv from "dotenv"
dotenv.config()

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