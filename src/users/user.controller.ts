import type { NextFunction, Request, Response } from "express";
import type { CreateUserDto, User, UserId } from "./user.type.js";
import { createUser as createUserService, deleteUserById, getUserById, updateUserPasswordById} from "./user.service.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";
import type { CanonicalLogContext } from "../types/canonicalLog.types.js";

export async function createUser(req:Request,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const userDetails : CreateUserDto = req.body

        const user : User = await createUserService(userDetails, ctx)

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, userId: user.id };
        }

        res.status(STATUSCODE.CREATED).json({
            message : `User created`,
            data : user
        })
    }
    catch(err){
        next(err);
    }
}

export async function getUser(req:Request,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const id : UserId = req.query?.id as string

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, userId: id };
        }
        
        const user : User = await getUserById(id, ctx)

        res.status(STATUSCODE.OK).json(user)
    }
    catch(err){
        next(err);
    }
}

export async function updateUserPassword(req:Request,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const {id, password} = req.body 

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, userId: id };
        }

        await updateUserPasswordById(id,password, ctx)

        res.status(STATUSCODE.OK).json({
            message : "Password Updated Successfully"
        })
    }
    catch(err){
        next(err);
    }
}

export async function deleteUser(req:Request,res:Response,next:NextFunction){
    const ctx = res.locals["log"] as CanonicalLogContext | undefined;

    try{
        const id : UserId = req.query?.id as string

        if (ctx) {
            ctx.resourceIds = { ...ctx.resourceIds, userId: id };
        }

        await deleteUserById(id, ctx)

        res.status(STATUSCODE.OK).json({
            messagae : `User deleted successfully`
        })
    }
    catch(err){
        next(err);
    }
}

