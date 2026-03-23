import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "https";

const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30_000,
});


const nodeHttpHandler = new NodeHttpHandler({
  httpsAgent,
  connectionTimeout: 3_000,
  requestTimeout: 5_000,
});

const dynamoDbClient: DynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  requestHandler: nodeHttpHandler,
  maxAttempts: 3
});


const DynamoDbClient: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
  dynamoDbClient,
  {
    marshallOptions: {
      removeUndefinedValues: true, 
      convertEmptyValues: false,   
    },
    unmarshallOptions: {
      wrapNumbers: false,         
    }  
  }
);

export default DynamoDbClient;