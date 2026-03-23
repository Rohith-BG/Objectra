import { S3Client } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "node:http";

const s3Agent : Agent = new Agent({
    keepAlive : true ,
    maxSockets : 25 ,
    maxFreeSockets : 5 ,
    timeout : 30_000
})

const s3Handler = new NodeHttpHandler({
    httpAgent : s3Agent,
    connectionTimeout : 3_000,
    requestTimeout : 10_000
})

const s3Client = new S3Client({
    region:process.env.AWS_REGION!,
    requestHandler : s3Handler,
    maxAttempts : 3
})

export default s3Client