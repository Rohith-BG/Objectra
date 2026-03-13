import { 
    S3Client, 
    ListObjectVersionsCommand, 
    DeleteObjectCommand 
  } from "@aws-sdk/client-s3";
  
  const s3Client = new S3Client({
    region: process.env.AWS_S3_BUCKET_REGION!
  });
  
  export const handler = async (event:any) => {
  
    console.info("Lambda Function invoked");
    console.info("Event:", JSON.stringify(event, null, 2));
  
    
    try {
      const objectId = event.objectId
      const s3ObjectKey = event?.S3ObjectKey;
    
      if (!s3ObjectKey) {
        throw new Error("S3ObjectKey is required");
      }
  
      console.info(`Listing versions of object: ${s3ObjectKey}`);
  
      const listVersionsResponse = await s3Client.send(
        new ListObjectVersionsCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Prefix: s3ObjectKey
        })
      );
  
      if (!listVersionsResponse?.DeleteMarkers || listVersionsResponse.DeleteMarkers.length === 0) {
        throw new Error(`No delete marker found for object ${s3ObjectKey}`);
      }
  
      // Find latest delete marker
      const latestDeleteMarker = listVersionsResponse.DeleteMarkers.find(
        marker => marker.IsLatest === true
      );
  
      if (!latestDeleteMarker) {
        throw new Error(`Latest delete marker not found for ${s3ObjectKey}`);
      }
  
      console.info(`Deleting delete marker version: ${latestDeleteMarker.VersionId}`);
  
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: s3ObjectKey,
          VersionId: latestDeleteMarker.VersionId
        })
      );
  
      console.info(`Object restored successfully`);
  
      return {
        success: true,
        objectId : objectId,
        S3ObjectKey: s3ObjectKey,
        restoredVersionId: latestDeleteMarker.VersionId,
        status: "RESTORED"
      };
  
    } 
    catch (error:any) {
  
      console.error("Error restoring object", {
        errorName: error.name,
        errorMessage: error.message
      });
  
      throw error;
    }
  };
