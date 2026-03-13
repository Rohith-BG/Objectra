import { DynamoDBDocumentClient, UpdateCommand, type UpdateCommandInput } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

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

    if(!objectId){
      console.error(`Object is not defined`)
      throw new Error(`ObjectId is undefined`)
    }

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
        ':uploaded':'UPLOADED',
        ':deleting':'DELETING',
        ':status':'DELETING',
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: "attribute_exists(id) AND #status IN (:uploaded, :deleting)",
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
      objectId : updateCommandOutput.Attributes.id,
      S3ObjectKey: s3ObjectKey,
      status : updateCommandOutput.Attributes.status
    }

  }
  catch (error : any) {

    if (error.name === "ConditionalCheckFailedException") {
  
      console.error(`Object with id  is not in UPLOADED status`);
  
      error.message = `Object with id  requested is not in a valid state to change the status as deleting`;
  
      throw error;
    }
  
    console.error("Unexpected error occurred", {
      errorName: error.name,
      errorMessage: error.message
    });
  
    throw error;
  }
};