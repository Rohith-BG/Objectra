import { S3Client , HeadObjectCommand, NotFound } from "@aws-sdk/client-s3";
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region : process.env.AWS_S3_BUCKET_REGION!
})
console.info(`S3 Client Created`)

export const handler = async (event:any) => {

  console.info(`Lambda Function invoked`)


  try{

    const objectId = event?.objectId
    const s3ObjectKey = event?.S3ObjectKey

    if(!objectId || !s3ObjectKey){
      console.error(`Key or objectId are missing`)
      throw new Error(`ObjectId and S3ObjectKey fields are missing`)
    }
    console.info(`Invoked S3ObjectKey and objectId`)
    console.log({
      objectId,s3ObjectKey
    })

    await s3Client.send(new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3ObjectKey
    }));

    const DeleteObjectCommandInput = {
      Bucket : process.env.AWS_S3_BUCKET_NAME,
      Key : s3ObjectKey
    }

    const deleteObjectCommandOutput = await s3Client.send(new DeleteObjectCommand(DeleteObjectCommandInput))

    console.log(deleteObjectCommandOutput)

    if(!deleteObjectCommandOutput?.$metadata || deleteObjectCommandOutput?.$metadata?.httpStatusCode!=204){
      throw new Error("Failed to delete the object");
    }
    console.info(`Object Deleted from the bucket`)

    return {
      success: true,
      objectId: objectId,
      S3ObjectKey: s3ObjectKey,
      s3DeleteStatus: "DELETED",
    }

  }
  catch(error:any){
    console.error(error?.message)
    if (error.name instanceof NotFound) {
      throw new Error(`Object does not exist in the Bucket`);
    }

    throw error;
  } 
};
