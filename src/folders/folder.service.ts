import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand, type PutCommandOutput, type UpdateCommandInput } from "@aws-sdk/lib-dynamodb"
import { dynamoDb } from "../configs/dynamoDb.js"
import RandomIdGenerator from "../utils/create-randomId.js"
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js"
import type { Folder, FolderId, FolderName } from "./folder.types.js"
import { NOTFOUND_ERROR } from "../utils/erros/NotFound.Error.js"
import dotenv from 'dotenv'
import CursorCodec from "../utils/cursorCodec.js"
dotenv.config()


export async function addFolder(folderName:string):Promise<Folder>{
    try{

        const folder : Folder = {
            id:`Folder@${RandomIdGenerator.getId()}`,
            name:folderName,
            createdAt:new Date().toISOString(),
            updatedAt:new Date().toISOString()
        }
        
        const putCommand : PutCommand = new PutCommand({
            TableName:process.env.FOLDERS_TABLE,
            Item:folder
        })
        

        const response  = await dynamoDb.send(putCommand) 

        if(response?.$metadata?.httpStatusCode!==200){
            throw new BAD_REQUEST_ERROR(`Failed To create a folder in DB`)
        }
        
        return folder

    }
    catch(err:any){
        if(err?.name=="ResourceNotFoundException"){
            throw Object.assign(new Error(`Folder creation failed to create as requested resource not found`))
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

export async function listAllFolders(cursor:any){
    try{
        let decodedCursor = cursor
        
        if (cursor && cursor !== "null" && cursor !== "undefined") {
            decodedCursor = CursorCodec.decode(cursor);
        } else {
            decodedCursor = undefined;
        }

        const input  = {
            TableName : process.env.FOLDERS_TABLE,
            Limit:10,
            ExclusiveStartKey : decodedCursor
        }

        const response = await dynamoDb.send(new ScanCommand(input))

        const folders = response?.Items ?? []

        const lastEvaluatedKey = response?.LastEvaluatedKey ? CursorCodec.encode(response?.LastEvaluatedKey) : undefined
        
        return {
            folders,
            lastEvaluatedKey    
        }
        
    }
    catch(err : any){
        throw err;
    }
}

export async function updateFolderById(folderId:FolderId,folderName:FolderName):Promise<Folder>{
    try{
    
        const input : UpdateCommandInput = {
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

        const response = await dynamoDb.send(new UpdateCommand(input))
        
        if(!response?.Attributes){
            throw new BAD_REQUEST_ERROR(`Failed to update the Folder`)
        }
        
        const updatedFolder = response?.Attributes

        return updatedFolder as Folder
    }
    catch(err:any){
        if(err?.name ==="ConditionalCheckFailedException"){
            throw new NOTFOUND_ERROR(`Failed to update as folder with id donot exists`)
        }
        else{
            throw err
        }
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
        if(err?.name=="ConditionalCheckFailedException"){
            throw new NOTFOUND_ERROR(`Folder with the id is not found`)
        }
        else{
            throw err
        }
    }
}
