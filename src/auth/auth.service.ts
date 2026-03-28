import { getUserById, getUserByName } from "../users/user.service.js";
import type { User, UserId, Username } from "../users/user.type.js";
import { NotFoundError } from "../utils/errors/notfound.error.js";
import bcrypt from "bcrypt"
import { UnauthorizedError } from "../utils/errors/unauthorized.error.js";
import type { AccessToken, RefreshToken, RefreshTokenItem, RevokeRefreshTokenResult } from "./auth.types.js";
import { extractUserIdFromToken, generateAccessToken, generateOpaqueToken, hashToken } from "../utils/jwt/jwt.utils.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import { DeleteCommand, PutCommand, QueryCommand, TransactWriteCommand, type DeleteCommandInput, type DeleteCommandOutput, type GetCommandInput, type PutCommandInput, type PutCommandOutput, type QueryCommandInput, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import DynamoDbClient from "../configs/DynamoDb.client.js";
import dotenv from "dotenv"
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
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

        const refreshToken : RefreshToken = generateOpaqueToken(user.id)

        const refreshTokenTTL = (Date.now() / 1000) + Number(process.env.REFRESHTOKEN_TTL!)

        await saveRefreshToken(refreshToken,user.id,refreshTokenTTL)

        return {accessToken , refreshToken}
    }
    catch(error : unknown){
        throw error 
    }
}

async function saveRefreshToken(refreshToken:RefreshToken,userId:UserId,ttl:number){
    try{
        const  refreshTokenObject = {
            id : `RefreshToken@${RandomIdGenerator.getId()}`,
            userId : userId,
            refreshToken : hashToken(refreshToken),
            createdAt : new Date().toISOString(),
            ttl : ttl
        }

        const putCommandInput : PutCommandInput = { 
            TableName : process.env.REFRESHTOKENS_TABLE,
            Item : refreshTokenObject
        }

        await DynamoDbClient.send(new PutCommand(putCommandInput))

    }
    catch(error : unknown){
        throw error
    }
}

export async function refreshAcessToken(refreshToken : RefreshToken){
    try{
        const hashedToken = hashToken(refreshToken)

        const refreshTokenItem  = await getRefreshTokenByToken(hashedToken)

        if(!refreshTokenItem){
            const userId = extractUserIdFromToken(refreshToken)

            if (!userId) {
                throw new UnauthorizedError("Invalid refresh token");
            }

            const userSessions = await getRefreshTokenItemsByUserId(userId)

            if(userSessions && userSessions.length > 0){
                await revokeAllUserSessions(userId)
                throw  new UnauthorizedError("Token reuse detected , all sessions revoked")
            }

            throw new UnauthorizedError("Session expired")
        }

        const currentTimeInSeconds = Math.floor(Date.now() / 1000)

        if (currentTimeInSeconds > refreshTokenItem.ttl) {
          await deleteRefreshTokenItemById(refreshTokenItem.id);
          throw new UnauthorizedError("Session expired");
        }

        const user: User = await getUserById(refreshTokenItem.userId);

        if (!user) {
            await deleteRefreshTokenItemById(refreshTokenItem.id);
            throw new UnauthorizedError("User not found - login again");
        }

        const accessTokenPayload = {
            id : user.id,
            role : user.role,
            allowedFolders: user.allowedFolders,
        };

        const accessToken : AccessToken = generateAccessToken(accessTokenPayload)

        const newRefreshToken : RefreshToken = generateOpaqueToken(user.id)

        await rotateRefreshToken(
            refreshTokenItem.id,
            newRefreshToken,
            refreshTokenItem.userId,
            refreshTokenItem.ttl
        );

        return {
            accessToken , 
            newRefreshToken,
            expiresAt:refreshTokenItem.ttl
        }
    }
    catch(error:unknown){
        throw error 
    }
}

async function getRefreshTokenByToken(refreshToken : RefreshToken):Promise<RefreshTokenItem | null>{
    try{
        const queryCommandInput : QueryCommandInput = {
            TableName : process.env.REFRESHTOKENS_TABLE,
            IndexName : process.env.REFRESHTOKEN_INDEX,
            KeyConditionExpression: "refreshToken = :refreshToken",
            ExpressionAttributeValues : { ":refreshToken" : refreshToken},
            Limit : 1
        }

        const queryCommandOutPut : QueryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        if(!queryCommandOutPut?.Items || queryCommandOutPut?.Items?.length===0){
            return null
        }

        const refreshTokenItem : RefreshTokenItem = queryCommandOutPut?.Items[0] as RefreshTokenItem
        
        return refreshTokenItem
    }
    catch(error : unknown){
        throw error 
    }
}

async function getRefreshTokenItemsByUserId(userId:UserId):Promise<RefreshTokenItem[]|null>{
    try{
        const queryCommandInput : QueryCommandInput = {
            TableName : process.env.REFRESHTOKENS_TABLE,
            IndexName : process.env.REFRESHTOKEN_USERID_INDEX,
            KeyConditionExpression : "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId }
        }

        const queryCommandOutPut : QueryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        if(!queryCommandOutPut?.Items || queryCommandOutPut?.Items?.length===0){
            return null
        }

        const refreshTokenItems : RefreshTokenItem[] = queryCommandOutPut?.Items as RefreshTokenItem[]

        return refreshTokenItems
    }
    catch(error : any){
        throw error
    }
}

async function deleteRefreshTokenItemById(refreshTokenItemId:string):Promise<void>{
    try{
        const deleteCommandInput : DeleteCommandInput = {
            TableName : process.env.REFRESHTOKENS_TABLE,
            Key : {
                id : refreshTokenItemId
            },
            ConditionExpression : "attribute_exists(id)",
            ReturnValues : "ALL_OLD"
        }

        const deleteCommandOutput : DeleteCommandOutput = await DynamoDbClient.send(new DeleteCommand(deleteCommandInput))

        return 
    }
    catch(error:unknown){
        if(error instanceof ConditionalCheckFailedException){
            throw new NotFoundError(`RefreshTokenItem with that id not found`)
        }
        throw error
    }
}

export async function revokeAllUserSessions(userId:UserId):Promise<void>{
    try{
        const userSessions : RefreshTokenItem[] | null= await getRefreshTokenItemsByUserId(userId)

        if(!userSessions){
            return 
        }

        await Promise.all(
            userSessions.map((userSession)=>{
                deleteRefreshTokenItemById(userSession?.id)
            })
        )
    }
    catch(error:unknown){
        throw error
    }
}

async function rotateRefreshToken(
  oldId        : string,
  newRawToken  : RefreshToken,
  userId       : UserId,
  ttl          : number
): Promise<void> {
  try {
    await DynamoDbClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Delete: {
              TableName: process.env.REFRESHTOKENS_TABLE!,
              Key      : { id: oldId },
            },
          },
          {
            Put: {
              TableName: process.env.REFRESHTOKENS_TABLE!,
              Item     : {
                id  : `RefreshToken@${RandomIdGenerator.getId()}`,
                userId : userId,
                refreshToken: hashToken(newRawToken),
                createdAt : new Date().toISOString(),
                ttl : ttl,                
              },
            },
          },
        ],
      })
    );
  } catch (error: unknown) {
    throw new Error(
      `Failed to rotate refresh token for userId ${userId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function revokeRefreshToken(refreshToken:RefreshToken):Promise<RevokeRefreshTokenResult>{
    try{
        const hashedToken = hashToken(refreshToken)

        const refreshTokenItem  = await getRefreshTokenByToken(hashedToken)

        if(!refreshTokenItem){
            return { status: "ALREADY_LOGGED_OUT" }
        }

        await deleteRefreshTokenItemById(refreshTokenItem?.id)

        return { status: "SUCCESS" }
    }
    catch(error:unknown){
        throw error
    }
}
