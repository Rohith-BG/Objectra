import type z from "zod";
import type { LoginUserBodySchema } from "./auth.validationSchema.js";

export type LoginUserBody = z.infer<typeof LoginUserBodySchema>

export type AccessToken = string

export type RefreshToken = string 

export interface JWTPayload {
    id : string,
    role : string,
    allowedFolders : string[]
}