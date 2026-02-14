import type { Application } from "express"
import express from "express"
import cors from "cors"
import  folderRoutes  from "./folders/folder.route.js"
import imageRoutes from "./images/image.route.js"

const app : Application = express()
app.use(express.json())
app.use(cors());

app.use('/folders',folderRoutes)
app.use('/images',imageRoutes)

export default app ;



// get images by folder 
// how about batch get like the page limit is 10 images then how to getPresigned url for all 
// draw back for above , increases the cost for 


// Add sort key of the status in the index for getting all the images by folder 
// Error is about the keyCondition in an expression 
//Done with the functionalities 
// Learn about the cache stratergies 