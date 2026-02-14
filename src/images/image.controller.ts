import type { Request, Response } from "express";
import { BAD_REQUEST_ERROR } from "../utils/erros/BadRequest.Error.js";
import { validateImageId, validateImageName } from "./image.validation.js";
import { validateCursor, validateFolderId } from "../folders/folder.validation.js";
import { addImage, deleteImageById, fetchImagesByFolderId, fetchPendingImagesByFolderId, getImageById, getObjectPresignedURL, getPresignedUrl, getPutObjectPresignedURL, updateImageNameById } from "./image.service.js";
import type { FolderIdCursorQueryParam, Image, ImageId, ImageIdQueryParam, ImageName, ImageRequestBody } from "./image.types.js";
import type { Cursor, Folder, FolderId } from "../folders/folder.types.js";


export async function createImage(req:Request,res:Response){
    try{
        let {name,folderId} : Image = req?.body 

        if(!folderId || !name){
            throw new BAD_REQUEST_ERROR(`ImageName and FolderId are required field`)
        }
         
        name  = validateImageName(name)
        folderId  = validateFolderId(folderId)

        const image : Image = await addImage(name,folderId)

        res.status(200).json(image)
        
    }
    catch(err:any){
        res.status(err?.statusCode || 400).json(err?.stack)
    }
}

export async function getImage(req:Request<{},{},{},ImageIdQueryParam>,res:Response){
    try{
        let imageId : ImageId = req?.query?.id

        if(!imageId){
            throw new BAD_REQUEST_ERROR(`Image Id is a required query param`)
        }

        imageId = validateImageId(imageId)

        const image = await getImageById(imageId)

        res.status(200).json(image)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function updateImageName(req:Request<{},{},ImageRequestBody,ImageIdQueryParam>,res:Response){
    try{
        let name : ImageName = req?.body?.name 
        let id : ImageId = req?.query?.id

        if(!name){
            throw new BAD_REQUEST_ERROR(`ImageName is `)
        }

        name = validateImageName(name)
        id = validateImageId(id)


        const image = await updateImageNameById(id,name)

        res.status(200).json(image)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function deleteImage(req:Request<{},{},{},ImageIdQueryParam>,res:Response){
    try{
        let imageId = req?.query?.id

        if(!imageId){
            throw new BAD_REQUEST_ERROR(`Query param of image id is a required field`)
        }

        imageId = validateImageId(imageId)

        const image = await deleteImageById(imageId)

        res.status(200).json(image)
    }
    catch(err:any){
        res.status(200).json(err?.stack)
    }
}


export async function uploadImageToS3(req:Request,res:Response){
    try{
        let {folderId,imageName}  = req?.body

        if(!folderId || !imageName){
            throw new BAD_REQUEST_ERROR(`FolderName and ImageName are required fields`)
        }

        folderId = validateFolderId(folderId)
        imageName = validateImageName(imageName)

        const presignedURL = await getPutObjectPresignedURL(imageName,folderId)

        res.status(200).json(presignedURL)

    }
    catch(err:any){
        res.status(err?.statusCode || 400).json(err?.stack)
    }
}

export async function getImageFromS3(req:Request<{},{},{},ImageIdQueryParam>,res:Response) {
    try{
        let imageId : ImageId = req?.query?.id

        if(!imageId){
            throw new BAD_REQUEST_ERROR(`Query param of Image id is a required field`)
        }

        imageId = validateImageId(imageId)

        const presignedURL = await getObjectPresignedURL(imageId)

        res.status(200).json(presignedURL)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

export async function getPresignedURL(req:Request<{},{},{},ImageIdQueryParam>,res:Response){
    try{
        let imageId : ImageId = req?.query?.id

        if(!imageId) {
            throw new BAD_REQUEST_ERROR(`Query param of imageId is a required field`)
        }

        imageId = validateImageId(imageId)
        
        const putObjectPresignedURL = await getPresignedUrl(imageId) 

        res.status(200).json(putObjectPresignedURL)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}

// export  async function getImageByObjectKey(req:Request,res:Response){
//     try{
//         const objectKey = req?.query?.id as string

//         const input = {
//             TableName:"Images",
//             IndexName:"ObjectKeyIndex",
//             KeyConditionExpression:"objectKey=:key",
//             ExpressionAttributeValues:{
//                 ":key":objectKey
//             }
//         }

//         const response = await dynamoDb.send(new QueryCommand(input))
//         console.log(response)

//         res.status(200).json(response?.Items)
//     }
//     catch(err:any){
//         res.status(400).json(err?.stack)
//     }
// }

export async function getUploadedImagesByFolderId(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response){
    try{
        let folderId : FolderId = req?.query?.id 
        let cursor : Cursor = req?.query?.cursor

        if(!folderId || !cursor){
            throw new BAD_REQUEST_ERROR(`FolderId and cursor are required query params`)
        }

        folderId = validateFolderId(folderId)
        cursor = validateCursor(cursor)

        const uploadedImages = await fetchImagesByFolderId(folderId,cursor)

        res.status(200).json(uploadedImages)
    }
    catch(err:any){
        res.status(err?.statusCode).json(err?.stack)
    }
}


export async function getPendingImagesByFolder(req:Request<{},{},{},FolderIdCursorQueryParam>,res:Response){
    try{
        let folderId : FolderId = req?.query?.id 
        let cursor : Cursor = req?.query?.cursor

        if(!folderId || !cursor){
            throw new BAD_REQUEST_ERROR(`FolderId and Cursor are required query params`)
        }

        folderId = validateFolderId(folderId)
        cursor = validateCursor(cursor)

        const pendingImages = await fetchPendingImagesByFolderId(folderId,cursor)

        res.status(200).json(pendingImages)
    }
    catch(err:any){
        res.status(err?.statusCode || 400).json(err?.stack)
    }
}