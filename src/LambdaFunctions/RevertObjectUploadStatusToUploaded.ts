import { DynamoDBDocumentClient, UpdateCommand, type UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'

const DynamoDbClient = new DynamoDBClient({
  region : process.env.AWS_DYNAMODB_REGION!
})

const DynamoDB = DynamoDBDocumentClient.from(DynamoDbClient)

export const handler = async (event:any) => {
  console.info(`Lambda invoked`)
  console.info('Event: ', JSON.stringify(event, null, 2))

  try{
    const objectId = event?.objectId
    const s3ObjectKey = event?.S3ObjectKey

  
    const updateCommandInput : UpdateCommandInput = {
      TableName : process.env.OBJECTS_TABLENAME,
      Key : {
        id : objectId
      },
      UpdateExpression : 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames : {
        '#status' : 'status',
        '#updatedAt' : 'updatedAt'
      },
      ExpressionAttributeValues : {
        ':deleting':'DELETING',
        ':status' : 'UPLOADED',
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: "attribute_exists(id) AND #status = :deleting",
      ReturnValues : "ALL_NEW"
    }

    const updateCommandOutput = await DynamoDB.send(
      new UpdateCommand(updateCommandInput)
    )
    console.info(`Called the UpdateCommand`)

    if(!updateCommandOutput?.Attributes){
      throw new Error(`Error on updating object ${objectId} status to deleting`)
    }
    console.info(`Status Updated`)
    return {
      success:true,
      objectId : objectId,
      S3ObjectKey : s3ObjectKey,
      status : updateCommandOutput.Attributes.status
    }

  }
  catch (error : any) {

    if (error instanceof ConditionalCheckFailedException) {

      error.message = `Object with that id is not in a valid state for deletion`;
  
      throw error;
    }
  
    console.error("Unexpected error occurred", {
      errorName: error.name,
      errorMessage: error.message
    });
  
    throw error;
  }
};
