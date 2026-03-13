import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client from "../../configs/S3Bucket.client.js";
import type { PresignedURL } from "../../objects/object.types.js";
import { BAD_REQUEST_ERROR } from "../errors/badrequest.error.js";

export async function generatePutObjectPresignedURL(objectKey:string):Promise<PresignedURL>{
    try{
        const putObjectCommand : PutObjectCommand = new PutObjectCommand({
            Bucket:process.env.BUCKET_NAME,
            Key: objectKey
        })

        const putObjectPresignedURL : PresignedURL = await getSignedUrl(s3Client,putObjectCommand,{expiresIn:1200})

        if(!putObjectPresignedURL){
            throw new BAD_REQUEST_ERROR(`Failed to get the presignedURL from S3`)
        }

        return putObjectPresignedURL
    }
    catch(err:any){
        throw err
    }    
}