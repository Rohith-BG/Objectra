import express, { Router } from "express"
import {  createObject, deleteObject,getObject, getObjectFromS3, getPendingObjectByFolder, getPresignedURL, getUploadedObjectsByFolder, uploadObjectToS3 } from "./object.controller.js";


const router : Router = express.Router();

router.post('/',createObject)
router.post('/S3/upload', uploadObjectToS3)

router.get('/',getObject)
router.get('/S3/retrive',getObjectFromS3)
router.get('/S3/presigned-url',getPresignedURL)
router.get('/byfolder/uploaded',getUploadedObjectsByFolder)
router.get('/byfolder/pending',getPendingObjectByFolder)

// router.patch('/name',updateObjectName)

router.delete('/',deleteObject)

export default router
