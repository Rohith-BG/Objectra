import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand, type PutCommandOutput, type QueryCommandInput, type UpdateCommandInput } from "@aws-sdk/lib-dynamodb"
import { dynamoDb } from "../configs/dynamoDb.js"
import RandomIdGenerator from "../utils/create-randomId.js"
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js"
import type { Folder, FolderId, FolderName, ParentId } from "./folder.types.js"
import { NOTFOUND_ERROR } from "../utils/erros/NotFound.Error.js"
import dotenv from 'dotenv'
dotenv.config()
import CursorCodec from "../utils/cursorCodec.js"
import { STATUSCODE } from "../constants/statusCodes.js"
import { ConditionalCheckFailedException, ResourceNotFoundException } from "@aws-sdk/client-dynamodb"
import { getFolder } from "./folder.controller.js"
import { Table } from "dynamoose"


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

        const response  = await dynamoDb.send(putCommand) 

        if(response?.$metadata?.httpStatusCode!==STATUSCODE.OK){
            throw new BAD_REQUEST_ERROR(`Failed To create a folder in DB`)
        }
    
        return folder
    }
    catch(err:any){
        if(err instanceof ResourceNotFoundException){
            throw new BAD_REQUEST_ERROR(`Folder failed to create as the required resource not exists`)
        }
        else if(err instanceof NOTFOUND_ERROR){
            throw new NOTFOUND_ERROR(`Parent Folder with this Id not found`)
        }
        else throw err
    }
}

export async function getFolderById(folderId:any):Promise<Folder>{
    try{
        const input = {
            TableName: process.env.FOLDERS_TABLE,
            Key:{
                id:folderId
            }
        }

        const response = await dynamoDb.send(new GetCommand(input))

        if(!response?.Item){
            throw new NOTFOUND_ERROR(`Folder with this id not exists`)
        }

        const folder = response?.Item
    
        return folder as Folder
    }
    catch(err:any){
        throw err
    }
}

// export async function listAllFolders(cursor:any){
//     try{
//         let decodedCursor = cursor
        
//         if (cursor && cursor !== "null" && cursor !== "undefined") {
//             decodedCursor = CursorCodec.decode(cursor);
//         } else {
//             decodedCursor = undefined;
//         }

//         const input  = {
//             TableName : process.env.FOLDERS_TABLE,
//             Limit:10,
//             ExclusiveStartKey : decodedCursor
//         }

//         const response = await dynamoDb.send(new ScanCommand(input))

//         const folders = response?.Items ?? []

//         const lastEvaluatedKey = response?.LastEvaluatedKey ? CursorCodec.encode(response?.LastEvaluatedKey) : undefined
        
//         return {
//             folders,
//             lastEvaluatedKey    
//         }
        
//     }
//     catch(err : any){
//         throw err;
//     }
// }
export async function listAllMainFolders():Promise<Folder[]>{
    try{
        const queryCommandInput : QueryCommandInput = {
            TableName : process.env.FOLDERS_TABLE,
            IndexName : process.env.PARENTID_INDEX,
            KeyConditionExpression : "parentId=:parentId",
            ExpressionAttributeValues : {
                ":parentId": "ROOT"
            }
        }
        const queryCommandResponse = await dynamoDb.send(new QueryCommand(queryCommandInput))
        
        const folders = queryCommandResponse?.Items 

        return folders as Folder[]
    }
    catch(err:any){
        throw err
    }
}

export async function getAllSubFoldersByParentId(parentId:ParentId):Promise<Folder[]>{
    try{
        const parentFolder = await getFolderById(parentId)
        
        const queryCommandInput : QueryCommandInput = {
            TableName : process.env.FOLDERS_TABLE,
            IndexName : process.env.PARENTID_INDEX ,
            KeyConditionExpression : "parentId = :parentId",
            ExpressionAttributeValues : {
                ":parentId":parentId
            }
        }

        const queryCommandResponse = await dynamoDb.send(new QueryCommand(queryCommandInput))

        const subFolders = queryCommandResponse?.Items

        return subFolders as Folder[]
    }
    catch(err:any){
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

        const response = await dynamoDb.send(new UpdateCommand(updateCommandInput))
        
        if(!response?.Attributes){
            throw new BAD_REQUEST_ERROR(`Failed to update the Folder`)
        }
        
        const updatedFolder = response?.Attributes

        return updatedFolder as Folder
    }
    catch(err:any){
        // if(err?.name ==="ConditionalCheckFailedException"){
        //     throw new NOTFOUND_ERROR(`Failed to update as folder with id donot exists`)
        // }
        if(err instanceof NOTFOUND_ERROR){
            throw new NOTFOUND_ERROR(`Failed to update as folder with the id not found`)
        }
        else{
            throw err
        }
    }
}

export async function updateParentIdByFolderId(folderId:FolderId,newParentId:FolderId):Promise<Folder>{
    try{
        const currentFolder = await getFolderById(folderId)

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

        const updateCommandResponse = await dynamoDb.send(new UpdateCommand(updateCommmandInput))

        if(!updateCommandResponse?.Attributes){
            throw new BAD_REQUEST_ERROR(`Failed to update the parentId`)
        }

        const updatedFolder = updateCommandResponse?.Attributes

        return updatedFolder as Folder  
    }
    catch(err:any){
        if(err instanceof NOTFOUND_ERROR){
            throw new NOTFOUND_ERROR(`Failed to update as folder with the id not found`)
        }
        throw err
    }
}

export async function deleteFolderById(folderId:FolderId):Promise<Folder>{
    try{
        const input = {
            TableName : process.env.FOLDERS_TABLE,
            Key:{
                id:folderId
            },
            ConditionExpression:"attribute_exists(id)",
            ReturnValues:"ALL_OLD" as const
        }

        const response = await dynamoDb.send(new DeleteCommand(input))

        const deletedFolder = response?.Attributes

        return deletedFolder as Folder
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
