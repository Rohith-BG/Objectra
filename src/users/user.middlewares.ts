import type { NextFunction, Request, Response } from "express";
import { validateCreateUserBody, validateUpdatePasswordBody, validateUserIdQueryParam } from "./user.validation.js";

export async function validateCreateUserRequestBody(req:Request,res:Response,next:NextFunction){
    try{
        req.body = validateCreateUserBody(req.body)
        next()
    }
    catch(err){
        next(err);
    }
}

export async function validateUserIdRequestQueryParam(req:Request,res:Response,next:NextFunction){
    try{
        validateUserIdQueryParam(req.query)
        next()
    }
    catch(err){
        next(err);
    }
}

export async function validateUpdatePasswordRequestBody(req:Request,res:Response,next:NextFunction){
    try{
        req.body = validateUpdatePasswordBody(req.body)
        next()
    }
    catch(err){
        next(err);
    }
}


