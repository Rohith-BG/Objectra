import type { Request, Response } from "express";
import { validateLoginUserBody } from "./auth.validation.js";
import { getAcessAndRefreshToken } from "./auth.service.js";


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