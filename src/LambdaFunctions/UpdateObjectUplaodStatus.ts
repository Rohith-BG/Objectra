import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamoDb = DynamoDBDocumentClient.from(client);


export const handler = async (event : any) => {
  console.log(`Lamda triggered`)

  console.log("S3 event:", JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      
      const objectKey = decodeURIComponent(
        record.s3.object.key.replace(/\+/g, " ")
      );
      console.log("Received objectKey:", objectKey);


      const queryResult = await dynamoDb.send(
        new QueryCommand({
          TableName: "Objects",
          IndexName: "ObjectKeyIndex",
          KeyConditionExpression: "objectKey = :key",
          ExpressionAttributeValues: {
            ":key": objectKey
          }
        })
      );

      if (!queryResult.Items || queryResult.Items.length === 0) {
        console.warn("No image record found for key:", objectKey);
        continue;
      }

      console.log(`QueryResult : `, queryResult)

      const imageId = queryResult?.Items?.[0]?.id


      console.log("Matched imageId:", imageId);

      
      await dynamoDb.send(
        new UpdateCommand({
          TableName: "Objects",
          Key: { id: imageId },
          UpdateExpression: "SET #status = :uploaded, #updatedAt= :updatedAt",
          ConditionExpression: "#status = :pending",
          ExpressionAttributeNames: {
            "#status": "status",
            "#updatedAt":"updatedAt"
          },
          ExpressionAttributeValues: {
            ":uploaded": "UPLOADED",
            ":pending": "PENDING",
            ":updatedAt": new Date().toISOString()
          }
        })
      );

      console.log(`Image ${imageId} marked UPLOADED`);
    }

    return { statusCode: 200 };
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      console.log("Status already updated. Ignoring duplicate trigger.");
      return { statusCode: 200 };
    }

    console.error("Lambda error:", err);
    throw err;
  }
};

