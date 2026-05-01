import type { NextFunction, Request, Response } from "express";
import { validateLoginUserBody, validateRefreshTokenCookie } from "./auth.validation.js";
import { getAcessAndRefreshToken, revokeAllUserSessions, revokeRefreshToken } from "./auth.service.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";
import { refreshAcessToken as refreshAccessTokenService } from "./auth.service.js";
import { UnauthorizedError } from "../utils/errors/unauthorized.error.js";
import { extractUserIdFromToken } from "../utils/jwt/jwt.utils.js";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";


export async function loginUser(req: Request, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        validateLoginUserBody(req.body)

        const { name, password } = req.body

        const { accessToken, refreshToken } = await getAcessAndRefreshToken(name, password, ctx)

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            path: "/auth"
        });

        res.status(200).json({
            message: "Login SuccessFul",
            token: accessToken
        })
    }
    catch (err) {
        next(err);
    }
}

export async function refreshAcessToken(req: Request, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const { refreshToken } = validateRefreshTokenCookie(req.cookies)

        const { accessToken, newRefreshToken, expiresAt } = await refreshAccessTokenService(refreshToken, ctx);

        const currentTimeInSeconds = Math.floor(Date.now() / 1000)
        const remainingMs = (expiresAt - currentTimeInSeconds) * 1000

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            path: "/auth",
            maxAge: remainingMs
        })

        res.status(STATUSCODE.OK).json(accessToken)
    }
    catch (err) {
        if (err instanceof UnauthorizedError) {
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
                path: "/auth",
            });
        }
        next(err);
    }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const { refreshToken } = validateRefreshTokenCookie(req.cookies)

        const revokeRefreshTokenResult = await revokeRefreshToken(refreshToken, ctx)

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            path: "/auth"
        });

        if (revokeRefreshTokenResult.status === "ALREADY_LOGGED_OUT") {
            res.status(STATUSCODE.OK).json({
                message: "User already logged out"
            })
            return
        }

        res.status(STATUSCODE.OK).json({
            message: "Logged out successfully"
        })
    }
    catch (err) {
        next(err);
    }
}

export async function logoutAllSessions(req: Request, res: Response, next: NextFunction) {
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try {
        const { refreshToken } = validateRefreshTokenCookie(req.cookies)

        const userId = extractUserIdFromToken(refreshToken)!

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, userId };
        }

        await revokeAllUserSessions(userId, ctx)

        res.status(STATUSCODE.OK).json({
            message: "All sessions are logged out successfully"
        })
    }
    catch (err) {
        next(err);
    }
}