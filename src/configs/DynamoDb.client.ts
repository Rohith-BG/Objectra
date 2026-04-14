import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent as HttpsAgent } from "https";
import { Agent as HttpAgent } from "http";

const isLocal = process.env.NODE_ENV === "local";

const LOCALSTACK_ENDPOINT = process.env.LOCALSTACK_ENDPOINT ?? "http://localstack:4566";

const httpsAgent = new HttpsAgent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 30_000,
});

const httpAgent = new HttpAgent({
  keepAlive: true,
  maxSockets: 50,
  maxFreeSockets: 10,
});

const nodeHttpHandler = new NodeHttpHandler({
  ...(isLocal
    ? { httpAgent }
    : { httpsAgent }),
  connectionTimeout: 3_000,
  requestTimeout: 5_000,
});

const dynamoDbClient: DynamoDBClient = new DynamoDBClient({
  region: process.env.AWS_REGION!,
  requestHandler: nodeHttpHandler,
  maxAttempts: 3,
  ...(isLocal && {
    endpoint: LOCALSTACK_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    },
  }),
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