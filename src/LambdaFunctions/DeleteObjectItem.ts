import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, DeleteCommand, type DeleteCommandInput } from '@aws-sdk/lib-dynamodb'

const DynamoDbClient = new DynamoDBClient({
    region : process.env.AWS_DYNAMODB_REGION!
  })
  
const DynamoDB = DynamoDBDocumentClient.from(DynamoDbClient)

export const handler = async (event:any) => {
    console.info(`Lamda Function invoked`)
    try{
        const objectId = event?.objectId
        const s3ObjectKey = event?.S3ObjectKey

        if(!objectId){
            console.error(`ObjectId is a required field`)
            throw new Error(`ObjectId is not defined`)
        }

        console.info(`ObjectId is invoked`)

        const deleteCommandInput : DeleteCommandInput = {
            TableName : process.env.AWS_OBJECTS_TABLE,
            Key : {
                id : objectId
            },
            ReturnValues : "ALL_OLD",
            ConditionExpression : "attribute_exists(id)"
        }

        const deleteCommandOutput = await DynamoDB.send(new DeleteCommand(deleteCommandInput))
        
        console.log(`DeleteCommand Executed`)

        return {
            sucess: true,
            objectId : objectId ,
            S3ObjectKey : s3ObjectKey,
            deletedItem : deleteCommandOutput.Attributes
        }
    }
    catch(error:unknown){
        console.error(`Error deleting object`, error)
        throw error
    }

};
