import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { Agent } from "node:http";
import dotenv from "dotenv"
dotenv.config()

const s3Agent: Agent = new Agent({
    keepAlive: true,
    maxSockets: 25,
    maxFreeSockets: 5,
    timeout: 30_000,
});

const s3Handler = new NodeHttpHandler({
    httpAgent: s3Agent,
    connectionTimeout: 3_000,
    requestTimeout: 10_000,
});

const s3Config: S3ClientConfig = {
    region: process.env.AWS_REGION!,
    requestHandler: s3Handler,
    maxAttempts: 3,
};

if (process.env.AWS_ENDPOINT_URL) {
    s3Config.endpoint = process.env.AWS_ENDPOINT_URL;
    s3Config.forcePathStyle = true;
    s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
    };
}

const s3Client = new S3Client(s3Config);

export default s3Client;