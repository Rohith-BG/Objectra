import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand, type DeleteCommandInput, type DeleteCommandOutput, type GetCommandInput, type GetCommandOutput, type PutCommandInput, type PutCommandOutput, type QueryCommandInput, type QueryCommandOutput, type UpdateCommandInput, type UpdateCommandOutput } from "@aws-sdk/lib-dynamodb";
import { getFoldersByIds } from "../folders/folder.service.js";
import { USER_ROLES } from "../utils/constants/user.roles.constants.js";
import { BadRequestError } from "../utils/errors/badrequest.error.js";
import { ForbiddenError } from "../utils/errors/forbidden.error.js";
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js";
import type { createUserInput, User, UserId, Username } from "./user.type.js";
import bcrypt from "bcrypt"
import DynamoDbClient from "../configs/DynamoDb.client.js";
import RedisClient from "../configs/Redis.client.js";
import { USER_CACHE } from "../utils/constants/cache.constants.js";
import { ConditionalCheckFailedException} from "@aws-sdk/client-dynamodb";
import { error } from "node:console";
import { NotFoundError } from "../utils/errors/notfound.error.js";
import dotenv from "dotenv"
dotenv.config()


export async function createUser(input : createUserInput) : Promise<Omit<User,"password">>{
    try{

        if(input?.role === USER_ROLES.ADMIN){
            throw new ForbiddenError(`Forbidden to create the user with role as admin`)
        }
        
        const existingUser : User = await getUserByName(input?.name)

        if(existingUser){
            throw new BadRequestError(`Username:${input.name} already exists`)
        }

        await getFoldersByIds(input?.allowedFolders)

        const hashedPassword = await bcrypt.hash(input?.password,12)
       
        const user : User = {
            id : `User@${RandomIdGenerator.getId()}`,
            name : input?.name,
            password : hashedPassword,
            role : input?.role,
            allowedFolders : input?.allowedFolders,
            createdAt :  new Date().toISOString(),
            updatedAt :  new Date().toISOString()
        } 

        const putCommandInput : PutCommandInput = {
            TableName: process.env.USERS_TABLE,
            Item : user
        }

        const putCommandOutput : PutCommandOutput = await DynamoDbClient.send(new PutCommand(putCommandInput))

        const { password , ...createdUser } = user
        
        return createdUser
    }
    catch(error : unknown){
        throw error
    }

}

export async function getUserByName(username : Username):Promise<User>{
    try{
        const cachedUser = await RedisClient.get(USER_CACHE.USERNAME(username))

        if(cachedUser){
            return JSON.parse(cachedUser)
        }

        const queryCommandInput: QueryCommandInput = {
            TableName: process.env.USERS_TABLE,
            IndexName: process.env.USERNAME_INDEX,
            KeyConditionExpression: "#name = :name",  
            ExpressionAttributeNames: {
                "#name": "name"                        
            },
            ExpressionAttributeValues: {
                ":name": username                      
            }
        }

        const queryCommandOutput : QueryCommandOutput = await DynamoDbClient.send(new QueryCommand(queryCommandInput))
        
        const user = queryCommandOutput?.Items?.[0] as User 

        if (user) {
            const { password, ...createdUser } = user;
            await RedisClient.set(
                USER_CACHE.USERNAME(USER_CACHE.USERNAME(username)),
                JSON.stringify(createdUser),
                "EX",   
                USER_CACHE.USER_TTL
            ) 
        }

        return user ?? null
    }
    catch(error : unknown ){
        throw error
    }
}

export async function getUserById(userId : UserId): Promise<Omit<User,"password">>{
    try{        
        const cachedUser =  await RedisClient.get(USER_CACHE.USERID(userId))

        if(cachedUser){
            return JSON.parse(cachedUser)
        }

        const getCommandInput : GetCommandInput = {
            TableName : process.env.USERS_TABLE,
            Key : {
                id : userId
            }
        }

        const getCommandOutput : GetCommandOutput = await DynamoDbClient.send(new GetCommand(getCommandInput))

        if(!getCommandOutput?.Item){
            throw new NotFoundError(`User with userId:${userId} not found`)
        }

        const user : User = getCommandOutput?.Item as User

        await RedisClient.set(
            USER_CACHE.USERID(userId),
            JSON.stringify(user),
            "EX",
            USER_CACHE.USER_TTL
        )

        const {password , ...fetchedUser} = user

        return fetchedUser
    }
    catch(eror : unknown){
        throw error
    }
}

export async function updateUserPasswordById(userId:UserId,password:string):Promise<void> {
    try{
        const hashedPassword : string = await bcrypt.hash(password,12);

        const updateCommandInput : UpdateCommandInput = {
            TableName : process.env.USERS_TABLE,
            Key :{
                id:userId
            },
            UpdateExpression : "Set password = :password , updatedAt = :updatedAt",
            ExpressionAttributeValues : {
                ":password" : hashedPassword , 
                ":updatedAt" : new Date().toISOString()
            },
            ConditionExpression : "attribute_exists(id)"
        }
        
        const updateCommandOutput : UpdateCommandOutput = await DynamoDbClient.send(
            new UpdateCommand(updateCommandInput)
        )

        const user : User = updateCommandOutput?.Attributes as User

        await Promise.all([
            RedisClient.del(USER_CACHE.USERID(userId)) ,
            RedisClient.del(USER_CACHE.USERNAME(user?.name))
        ])

    }
    catch(error : unknown){
        throw new NotFoundError(`User with the userId:${userId} not found`)
    } 
}

// First think how to invalidate the JWT Token 
// export async function updateUserRole(userId : UserId , userRole : string):Promise<void>{
//     try{

//     }
// }


export async function deleteUserById(userId:UserId):Promise<User>{
    try{
        const deleteCommandInput : DeleteCommandInput = {
            TableName : process.env.USERS_TABLE ,
            Key : {
                id:userId
            },
            ConditionExpression : "attribute_exists(id)",
            ReturnValues : "ALL_OLD"
        }

        const deleteCommandOutput : DeleteCommandOutput = await DynamoDbClient.send(new DeleteCommand(deleteCommandInput))
    
        const user : User = deleteCommandOutput?.Attributes as User

        await Promise.allSettled([
            RedisClient.del(USER_CACHE.USERID(userId)),
            RedisClient.del(USER_CACHE.USERNAME(user?.name))
        ])

        return user 

    }
    catch(error : unknown){
        if(error instanceof ConditionalCheckFailedException){
            throw new NotFoundError(`User with the id:${userId} not exists to delete`)
        }
        throw error
    }
}