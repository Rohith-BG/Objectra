import type z from "zod";
import type { CreateUserSchema } from "./user.schemas.js";

export interface User {
    id : string ,
    name : string ,
    password ?: string ,
    role : string ,
    allowedFolders : string[],
    createdAt : string,
    updatedAt : string
}

export type UserRole = "ADMIN" | "READ_ONLY" | "WRITE_ONLY" | "READ_WRITE"; 

export interface createUserInput {
    name : string,
    password : string,
    role : UserRole
    allowedFolders : string[]
}


export type CreateUserDto = z.infer<typeof CreateUserSchema>

export type Username = string 

export type UserId = string

export interface UserBody{
    name : string,
    password : string,
    role : UserRole,
    allowedFolders : string[]
}