import express, { Router } from "express"
import {  createObject, deleteObject,getObject, getObjectFromS3, getPendingObjectByFolder, getPresignedURL, getUploadedObjectsByFolder,updateObjectName,  uploadObjectToS3 } from "./object.controller.js";


const router : Router = express.Router();

router.post('/',createObject)

router.get('/',getObject)

router.patch('/name',updateObjectName)

router.delete('/',deleteObject)

router.post('/S3/upload', uploadObjectToS3)

router.get('/S3/retrive',getObjectFromS3)

router.get('/S3/presigned-url',getPresignedURL)

router.get('/byfolder/uploaded',getUploadedObjectsByFolder)

router.get('/byfolder/pending',getPendingObjectByFolder)

export default router
