import type { Request, Response } from "express";
import type { CreateUserDto, User, UserId } from "./user.type.js";
import { createUser as createUserService, deleteUserById, getUserById, updateUserPasswordById} from "./user.service.js";
import { STATUSCODE } from "../utils/constants/statusCodes.js";

export async function createUser(req:Request,res:Response){
    try{
        
        const userDetails : CreateUserDto = req.body

        const user : User = await createUserService(userDetails)

        res.status(STATUSCODE.CREATED).json({
            message : `User created`,
            data : user
        })
    }
    catch(error : any){
        res.status(error?.statusCode).json(error?.stack)
    }
}

export async function getUser(req:Request,res:Response){
    try{
        const id : UserId = req.query?.id as string
        
        const user : User = await getUserById(id)

        res.status(STATUSCODE.OK).json(user)
    }
    catch(error : any){
        res.status(error?.statusCode || 400).json(error?.stack)
    }
}

export async function updateUserPassword(req:Request,res:Response){
    try{
        const {id, password} = req.body 

        await updateUserPasswordById(id,password)

        res.status(STATUSCODE.OK).json({
            message : "Password Updated Successfully"
        })
    }
    catch(error:any){
        res.status(error?.statusCode).json(error?.message)
    }
}

export async function deleteUser(req:Request,res:Response){
    try{
        const id : UserId = req.query?.id as string

        await deleteUserById(id)

        res.status(STATUSCODE.OK).json({
            messagae : `User deleted successfully`
        })
    }
    catch(error:any){
        res.status(error?.statusCode).json(error?.message)
    }
}

