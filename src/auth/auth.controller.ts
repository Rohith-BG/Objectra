import type { Request, Response } from "express";
import { validateLoginUserBody, validateRefreshTokenCookie } from "./auth.validation.js";
import { getAcessAndRefreshToken, revokeAllUserSessions, revokeRefreshToken } from "./auth.service.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";
import { refreshAcessToken as refreshAccessTokenService } from "./auth.service.js";
import { UnauthorizedError } from "../utils/errors/unauthorized.error.js";
import { extractUserIdFromToken } from "../utils/jwt/jwt.utils.js";


export async function loginUser(req:Request,res:Response){
    try{
        validateLoginUserBody(req.body)

        const {name, password } = req.body

        const {accessToken , refreshToken } = await getAcessAndRefreshToken(name,password)

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,      
            secure: true,      
            sameSite: "strict",   
            path: "/auth"
        });

        res.status(200).json({
            message : "Login SuccessFul",
            token : accessToken 
        })
    }
    catch(error : any){
        res.status(error?.statusCode || 400).json(error?.stack)
    }
}

export async function refreshAcessToken(req:Request,res:Response){
    try{
       const { refreshToken } = validateRefreshTokenCookie(req.cookies)
       
       const { accessToken, newRefreshToken, expiresAt } = await refreshAccessTokenService(refreshToken);

        const currentTimeInSeconds = Math.floor(Date.now() / 1000)
        const remainingMs  = (expiresAt - currentTimeInSeconds) * 1000

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure  : true,
            sameSite: "strict",
            path    : "/auth",
            maxAge  : remainingMs
        })

        res.status(STATUSCODE.OK).json(accessToken)
    }
    catch(error:any){
        if (error instanceof UnauthorizedError) {
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure  : true,
                sameSite: "strict",
                path    : "/auth",
            });

            res.status(STATUSCODE.UNAUTHORIZED).json(error?.message);
            return;
        }  
        res.status(error?.statusCode).json(error?.message)
    }
}

export async function logout(req:Request,res:Response){
    try{
        const { refreshToken } = validateRefreshTokenCookie(req.cookies)

        const revokeRefreshTokenResult = await revokeRefreshToken(refreshToken)

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure  : true,
            sameSite: "strict",
            path    : "/auth"
        });

        if(revokeRefreshTokenResult.status === "ALREADY_LOGGED_OUT"){
            res.status(STATUSCODE.OK).json({
                "message":"User already logged out"
            })
            return
        }

        res.status(STATUSCODE.OK).json({
            "message":"Logged out successfully"
        })

    }
    catch(error:any){
        res.status(error?.statusCode).json(error?.stack)
    }
}

export async function logoutAllSessions(req:Request,res:Response){
    try{
        const {refreshToken} = validateRefreshTokenCookie(req.cookies)

        const userId = extractUserIdFromToken(refreshToken)!

        await revokeAllUserSessions(userId)

        res.status(STATUSCODE.OK).json({
            "message":"All sessions are logged out successfully"
        })
    }
    catch(error:any){
        res.status(error?.statusCode).json(error?.stack)
    }
}