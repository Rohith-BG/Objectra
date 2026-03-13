import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand, type DeleteCommandInput, type DeleteCommandOutput, type PutCommandOutput, type QueryCommandInput, type UpdateCommandInput } from "@aws-sdk/lib-dynamodb"
import DynamoDbClient from "../configs/DynamoDb.client.js"
import RandomIdGenerator from "../utils/helpers/create-randomId.helper.js"
import { BAD_REQUEST_ERROR } from "../utils/errors/badrequest.error.js"
import type { Folder, FolderId, FolderName, ParentId } from "./folder.types.js"
import { NOTFOUND_ERROR } from "../utils/errors/notfound.error.js"
import { ConditionalCheckFailedException, ResourceNotFoundException } from "@aws-sdk/client-dynamodb"
import dotenv from 'dotenv'
import RedisClient from "../configs/Redis.client.js"
import { CACHE_KEYS } from "../utils/constants/cache.constants.js"
import { getFolder } from "./folder.controller.js"
import { getUploadedObjectsByFolderId } from "../objects/object.service.js"
import { unknown } from "zod"
dotenv.config()


export async function addFolder(folderName:string , parentId : ParentId):Promise<Folder>{
    try{ 
        parentId = parentId===null ? 'ROOT' : (await getFolderById(parentId))?.id

        const folder : Folder = {
            id:`Folder@${RandomIdGenerator.getId()}`,
            name:folderName,
            parentId : parentId ,
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
        }
        
        const putCommand : PutCommand = new PutCommand({
            TableName:process.env.FOLDERS_TABLE,
            Item:folder
        })

        const putCommandOutput  = await DynamoDbClient.send(putCommand) 

        if (parentId === "ROOT") {
            await RedisClient.del(CACHE_KEYS.MAIN_FOLDERS);
        } else {
            await RedisClient.del(CACHE_KEYS.SUB_FOLDERS(parentId));
        }
    
        return folder
    }
    catch(err:unknown){
        if(err instanceof ResourceNotFoundException){
            throw new BAD_REQUEST_ERROR(`Folder failed to create as the required resource not exists in DB`)
        }
        else if(err instanceof NOTFOUND_ERROR){
            throw new NOTFOUND_ERROR(`Parent folder with id ${parentId} not found`);
        }
        else throw err
    }
}

export async function getFolderById(folderId:any):Promise<Folder>{
    try{
        const cachedMainFoldersList = await RedisClient.get(CACHE_KEYS.MAIN_FOLDERS);

        if (cachedMainFoldersList) {
            const folders = JSON.parse(cachedMainFoldersList) as Folder[];
            const folder  = folders.find(f => f?.id === folderId);

            if (folder !== undefined) {
                return folder
            }
        }

        const individualFolderKey = CACHE_KEYS.FOLDER(folderId)

        const cachedFolder = await RedisClient.get(individualFolderKey)

        if(cachedFolder){
            return JSON.parse(cachedFolder) 
        }

        const input = {
            TableName: process.env.FOLDERS_TABLE,
            Key:{
                id:folderId
            }
        }

        const response = await DynamoDbClient.send(new GetCommand(input))

        if(!response?.Item){
            throw new NOTFOUND_ERROR(`Folder with this id not exists`)
        }

        const folder = response?.Item

        if (folder.parentId !== "ROOT") {
            await RedisClient.set(
            individualFolderKey,
            JSON.stringify(folder),
            "EX",
            1800 )
        }
    
        return folder as Folder
    }
    catch(err:unknown){
        throw err
    }
}

export async function listAllMainFolders():Promise<Folder[]>{
    try{

        const cachedFolders = await RedisClient.get(CACHE_KEYS?.MAIN_FOLDERS)

        if(cachedFolders){
            return JSON.parse(cachedFolders)
        }

        const queryCommandInput : QueryCommandInput = {
            TableName : process.env.FOLDERS_TABLE,
            IndexName : process.env.PARENTID_INDEX,
            KeyConditionExpression : "parentId=:parentId",
            ExpressionAttributeValues : {
                ":parentId": "ROOT"
            }
        }
        const queryCommandResponse = await DynamoDbClient.send(new QueryCommand(queryCommandInput))
        
        const folders = queryCommandResponse?.Items as Folder[]

        await RedisClient.set(
            CACHE_KEYS?.MAIN_FOLDERS,
            JSON.stringify(folders),
            "EX",
            1800
        )

        return folders 
    }
    catch(err:unknown){
        throw err
    }
}

export async function getAllSubFoldersByParentId(parentId:ParentId):Promise<Folder[]>{
    try{
        const parentFolder = await getFolderById(parentId)

        const cacheKey = CACHE_KEYS.SUB_FOLDERS(parentId)
    
        const cachedSubFolders  = await RedisClient.get(cacheKey)

        if (cachedSubFolders) {
            return JSON.parse(cachedSubFolders) as Folder[];
        }
        
        const queryCommandInput : QueryCommandInput = {
            TableName : process.env.FOLDERS_TABLE,
            IndexName : process.env.PARENTID_INDEX ,
            KeyConditionExpression : "parentId = :parentId",
            ExpressionAttributeValues : {
                ":parentId":parentId
            }
        }

        const queryCommandResponse = await DynamoDbClient.send(new QueryCommand(queryCommandInput))

        const subFolders = queryCommandResponse?.Items as Folder[]

        await RedisClient.set(
            cacheKey,
            JSON.stringify(subFolders),
            "EX",
            1800
        );

        return subFolders
    }
    catch(err:unknown){
        if(err instanceof NOTFOUND_ERROR){
            throw new NOTFOUND_ERROR(`ParentId with this Id not found`)
        }
        throw err
    }
}

export async function updateFolderNameById(folderId:FolderId,folderName:FolderName):Promise<Folder>{
    try{
        const folder = await getFolderById(folderId)

        const updateCommandInput : UpdateCommandInput = {
            TableName:process.env.FOLDERS_TABLE,
            Key:{
                id:folderId
            },
            UpdateExpression:"set #name=:name,#updatedAt=:updatedAt",
            ExpressionAttributeNames:{
                "#name":"name",
                "#updatedAt":"updatedAt"
            },
            ExpressionAttributeValues:{
                ":name":folderName,
                ":updatedAt":new Date().toISOString()
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:"ALL_NEW"
        }

        const response = await DynamoDbClient.send(new UpdateCommand(updateCommandInput))
       
        const updatedFolder = response?.Attributes as Folder

        if(updatedFolder?.parentId === "ROOT"){
            await Promise.all([
            RedisClient.del(CACHE_KEYS.MAIN_FOLDERS),       
            RedisClient.del(CACHE_KEYS.FOLDER(folderId))
            ]);
        }
        else {
           await Promise.all([
                RedisClient.del(CACHE_KEYS.SUB_FOLDERS(updatedFolder?.parentId)), 
                RedisClient.del(CACHE_KEYS.FOLDER(folderId))
           ])
        }

        return updatedFolder 
    }
    catch(err:unknown){
        if(err instanceof NOTFOUND_ERROR){
            throw new NOTFOUND_ERROR(`Failed to update as folder with the id not found`)
        }
        else{
            throw err
        }
    }
}

export async function updateParentIdByFolderId(folderId:FolderId,oldParentId:FolderId,newParentId:FolderId):Promise<Folder>{
    try{
        const folder = await getFolderById(newParentId);

        const updateCommmandInput : UpdateCommandInput = {
            TableName:process.env.FOLDERS_TABLE,
            Key :{
                id:folderId
            },
            UpdateExpression : "set #parentId = :parentId , #updatedAt=:updatedAt",
            ExpressionAttributeNames : {
                "#parentId" : "parentId",
                "#updatedAt" : "updatedAt"
            },
            ExpressionAttributeValues : {
                ":parentId":newParentId,
                ":updatedAt":new Date().toISOString()
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:"ALL_NEW"
        }

        const updateCommandResponse = await DynamoDbClient.send(new UpdateCommand(updateCommmandInput))

        const updatedFolder = updateCommandResponse?.Attributes as Folder

        const keysToInvalidate: string[] = [
            CACHE_KEYS.SUB_FOLDERS(oldParentId),
            CACHE_KEYS.SUB_FOLDERS(newParentId),
            CACHE_KEYS.FOLDER(folderId),
        ];

        if (oldParentId === "ROOT" || newParentId === "ROOT") {
          keysToInvalidate.push(CACHE_KEYS.MAIN_FOLDERS);
        }

        await Promise.all(
          keysToInvalidate.map(key => RedisClient.del(key))
        );

        return updatedFolder 
    }
    catch(err:any){
        if (err instanceof ConditionalCheckFailedException){
            throw new NOTFOUND_ERROR(`Folder with the requested Id not found`)
        }
        throw err
    }
}

export async function deleteFolderById(folderId:FolderId):Promise<Folder>{
    try{
        const folder = await getFolderById(folderId)
        
        const subFolders : Folder[] = await getAllSubFoldersByParentId(folderId);

        if (subFolders.length > 0) {
            throw new BAD_REQUEST_ERROR(`Folder contains sub folders — remove them before deleting`);
        }

        const { objects } = await getUploadedObjectsByFolderId(folderId, undefined);

        if (objects.length > 0) {
            throw new BAD_REQUEST_ERROR(`Folder contains objects — remove them before deleting`);
        }
        
        const deleteCommandInput : DeleteCommandInput= {
            TableName : process.env.FOLDERS_TABLE,
            Key:{
                id:folderId
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:"ALL_OLD" as const
        }

        const deleteCommandOutput : DeleteCommandOutput = await DynamoDbClient.send(new DeleteCommand(deleteCommandInput))

        const deletedFolder = deleteCommandOutput?.Attributes as Folder 

        const keysToInvalidate: string[] = [
            CACHE_KEYS.FOLDER(folderId),
            CACHE_KEYS.SUB_FOLDERS(folderId),
        ];

        if (folder.parentId === "ROOT") {
          keysToInvalidate.push(CACHE_KEYS.MAIN_FOLDERS);
        } else {
          keysToInvalidate.push(CACHE_KEYS.SUB_FOLDERS(folder.parentId));
        }

        await Promise.all(
            keysToInvalidate.map(key => RedisClient.del(key))
        );

        return deletedFolder 
    }
    catch(err:any){
        if(err instanceof ConditionalCheckFailedException){
            throw new NOTFOUND_ERROR(`Folder with the id is not found`)
        }
        else{
            throw err
        }
    }
}
