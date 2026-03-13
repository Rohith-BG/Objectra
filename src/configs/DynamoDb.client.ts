import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const dynamoDbClient : DynamoDBClient = new DynamoDBClient({
    region:process.env?.AWS_REGION!
})

const DynamoDbClient : DynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDbClient);


export default DynamoDbClient


