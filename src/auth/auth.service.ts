import { getUserByName } from "../users/user.service.js";
import type { User, UserId, Username } from "../users/user.type.js";
import { NotFoundError } from "../utils/errors/notfound.error.js";
import bcrypt from "bcrypt"
import { UnauthorizedError } from "../utils/errors/unauthorized.error.js";
import type { AccessToken, RefreshToken } from "./auth.types.js";
import { generateAccessToken } from "../utils/jwt/jwt.utils.js";
import type { id } from "zod/locales";
import CursorCodec from "../utils/helpers/cursorCodec.helper.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import { PutCommand, type PutCommandInput, type PutCommandOutput } from "@aws-sdk/lib-dynamodb";
import DynamoDbClient from "../configs/DynamoDb.client.js";
import dotenv from "dotenv"
dotenv.config()


export async function getAcessAndRefreshToken(name:Username , password : string){
    try{
        const user : User = await getUserByName(name) 

        if(!user){
            throw new UnauthorizedError(`Invalid credentials`)
        }

        const isPasswordValid = await bcrypt.compare(password, user.password!);

        if(!isPasswordValid){
            throw new UnauthorizedError(`Invalid credentials`)
        }

        const accessTokenPayload = {
            id : user.id,
            role : user.role ,
            allowedFolders : user.allowedFolders
        }

        const accessToken : AccessToken = generateAccessToken(accessTokenPayload)

        const refreshToken : RefreshToken = CursorCodec.encode(RandomIdGenerator.getId())

        await saveRefreshToken(refreshToken,user.id)

        return {accessToken , refreshToken}

    }
    catch(error : unknown){
        throw error 
    }
}

async function saveRefreshToken(refreshToken:RefreshToken,userId:UserId){
    try{
        const  refreshTokenObject = {
            id : `RefreshToken@${RandomIdGenerator.getId()}`,
            userId : userId,
            refreshToken : refreshToken,
            createdAt : new Date().toISOString(),
            ttl : Math.floor(Date.now() / 1000) + Number(process.env.REFRESHTOKEN_TTL!)
        }

        const putCommandInput : PutCommandInput = { 
            TableName : process.env.REFRESHTOKEN_TABLE,
            Item : refreshTokenObject
        }

        await DynamoDbClient.send(new PutCommand(putCommandInput))

    }
    catch(error : unknown){
        throw error
    }
}