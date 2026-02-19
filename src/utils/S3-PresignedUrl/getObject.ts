import { GetObjectCommand } from "@aws-sdk/client-s3";
import type { PresignedURL } from "../../objects/object.types.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3Client from "../../configs/s3.client.js";
import { BAD_REQUEST_ERROR } from "../erros/BadRequest.Error.js";

export async function generateGetObjectPresignedURL(objectKey:string):Promise<PresignedURL> {
    try{
        const getObjectCommand : GetObjectCommand = new GetObjectCommand({
            Bucket:process.env.BUCKET_NAME,
            Key:objectKey
        })

        const getObjectPresignedURL : PresignedURL = await getSignedUrl(s3Client,getObjectCommand,{expiresIn:1200})

        if(!getObjectPresignedURL){
            throw new BAD_REQUEST_ERROR(`Failed to get the presigned URL from the S3`)
        }

        return getObjectPresignedURL
    }
    catch(err:any){
        throw err
    }
}