import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv"
dotenv.config();


const dynamoClient : DynamoDBClient = new DynamoDBClient({
    region:process.env?.AWS_REGION!
})

export const dynamoDb : DynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoClient);



