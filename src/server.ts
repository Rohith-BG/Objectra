import app from "./app.js"
import dotenv from "dotenv" 
import RedisClient from "./configs/Redis.client.js";
dotenv.config();

async function startServer(){
    try{
        const redisClientPingResponse : string = await RedisClient.ping();

        if(redisClientPingResponse !== 'PONG'){
            throw new Error(`Redis ping failed : ${redisClientPingResponse}`,)
        }

        console.log(`Redis Connnected`)
         
        app.listen(process.env.PORT , ()=>{
            console.log(`Server started running on the port:${process.env.PORT}`)
        })
    }
    catch(error : any){
        console.error("Failed to start server —", error?.message)
        process.exit(1)    
    }
}

startServer()


/* 
1. Database connection pooling - as the dynamo Db is http based connection so it makes the calls using the http so the connection pooling doesnot applies in this Db
2. Rate Limiting using redis and what with the express rate limiter 
   Authentication , Authorization - Have to do this 
   Unit testing - vitest 
3. Caching the response in redis - Implemented 
4.Efficent use of presigned urls for s3 and retires stratergies -> Presigned URLs are cached until the 2 mins earlier than the expiration of the TTL 
5.How to contanirisation of app with docker 
6. How to deploy the container 
7. How to deploy the server in ec2 instance or in ECR / ECS (don't have an idea)

*/
