import z from "zod";
import { USER_ROLES } from "../utils/constants/user.roles.constants.js";


export const CreateUserSchema = z.object({
    name: z
        .string({error: "Name is required" })
        .trim()
        .min(3, "Name must be at least 3 characters long"),

    password: z
        .string({error: "Password is required" })
        .trim()
        .min(8, "Password must be at least 8 characters long")
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
            "Password must contain uppercase, lowercase, number, and special character"
        ),

    role: z.enum(USER_ROLES, {
        error: `Role must be one of ${Object.values(USER_ROLES).join(", ")}`,
    }),

    allowedFolders: z
        .array(z.string().trim().min(1, "FolderIds cannot be empty"))
        .min(1, "At least one folder must be specified"),
});

export const userIdQueryParamSchema = z.object({
    id : z
    .string({error : `userId must be string`})
    .trim()
    .min(1,{error: `UserId cannot be empty`})
})

export const updatePasswordSchema = z.object({
    id : z.string({error : `userId must be string`})
        .trim()
        .min(1,{error: `UserId cannot be empty`}) ,    
    password : z.string({error:`password must be of type string`})
        .trim()
        .min(8,{error:`Password must be of 8 characters`})
})
