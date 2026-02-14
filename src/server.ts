import app from "./app.js"
import dotenv from "dotenv"
import RandomIdGenerator from "./utils/create-randomId.js";
import { addFolder } from "./folders/folder.service.js";
dotenv.config();

app.listen(process.env.PORT,()=>{
    console.log(`Server started running on ${process.env.PORT}`)
})


/* 
1. Database connection pooling 
2. Rate Limiting using redis and what with the express rate limiter 
   Authentication , Authorization 
   Unit testing - vitest 
3. Caching the response in redis
4.Efficent use of presigned urls for s3 and retires stratergies 
5.How to contanirisation of app with docker 
6. How to deploy the container 
7. How to deploy the server in ec2 instance or in ECR 

*/
