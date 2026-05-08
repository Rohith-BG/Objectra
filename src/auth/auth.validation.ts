import { BadRequestError } from "../utils/errors/http.errors.js";
import type { LoginUserBody, RefreshTokenCookie } from "./auth.types.js";
import { LoginUserBodySchema, refreshTokenCookieSchema } from "./auth.validationSchema.js";


export function validateLoginUserBody(loginUserBody: unknown): LoginUserBody {
  try {
    const validationResult = LoginUserBodySchema.safeParse(loginUserBody)

    if (!validationResult.success) {
      throw new BadRequestError(validationResult.error.message)
    }

    return validationResult.data as LoginUserBody
  }
  catch (error: unknown) {
    throw error
  }
}

export function validateRefreshTokenCookie(cookies: unknown): RefreshTokenCookie {
  try {
    const validationResult = refreshTokenCookieSchema.safeParse(cookies);

    if (!validationResult.success) {
      throw new BadRequestError(validationResult.error.message);
    }

    return validationResult.data as RefreshTokenCookie;

  } catch (error: unknown) {
    throw error;
  }
}