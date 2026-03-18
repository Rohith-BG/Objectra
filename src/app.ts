import type { Application } from "express"
import express from "express"
import cors from "cors"
import  folderRoutes  from "./folders/folder.route.js"
import objectRoutes from "./objects/object.route.js"
import userRoutes from "./users/user.routes.js"

const app : Application = express()

app.use(express.json())
app.use(cors());

app.use('/folders',folderRoutes)
app.use('/objects',objectRoutes)
app.use('/users',userRoutes)

export default app ;



// get images by folder 
// how about batch get like the page limit is 10 images then how to getPresigned url for all 
// draw back for above , increases the cost for 


// Add sort key of the status in the index for getting all the images by folder 
// Error is about the keyCondition in an expression 
//Done with the functionalities 
// Learn about the cache stratergies 

/* ADD FUNCTIONALITY FOR DELETE IMAGE 
It should delete a image data in a DB
It should delete a object in a S3 bucket 
What if the at first I make a request to S3 and it deletes but failed to delete in DB or vice versa 
this leads to the inconsistency in the data 
How to avoid ? DB transactions - If any of the operation fails , all the operations 
which are previously executed should be retrived back on successful completion the response is sent as done  */


/* Create main folder , subfolder , objects 
Create a table command that should create a table in DB so that objects goes into that Table
Query by list all mainFolders , subFolders , objects with this subfolderId
In object creation , the table name should be the mainFolder name , check it contains or not befor using it 
as s3 functionaluty is there just change out the name , 
In Images , just change the folder check with the subFolder function 
This should be done by tommorow night 
*/

// still the table name should be changed so have to delete that images and then create a indexes in objects table
// Think about the idempotency for the objects
//Validate all the objects functions in service and controller layer
// implement a transaction for the deleteObject functionality where when deleteObjectwithId is called at first call a commmand to delete from s3 then from the DB if any one fails revert the changes made and then send the response 
// Learn to implement the caching 
// How to implement the feature of the searching , elastisearch ????
// target for tommorow

//I think lambda function requires changes so make a changes in that 
//Create a docker file 
//Uplaod to ECR
//Run that image in EC2