import express, { Router } from "express"
import { completeObjectUpload, deleteObject, getObjectFromS3, getPendingObjectByFolder, getPresignedURL, getUploadedObjectsByFolder, uploadObjectToS3 } from "./object.controller.js";
import { authorizeUser } from "../middlewares/authorizeUser.js";
import { authenticateUser } from "../middlewares/authenticateUser.js";


const router: Router = express.Router();

// router.post('/',createObject)
router.post('/S3/upload', authenticateUser, authorizeUser, uploadObjectToS3)
router.post('/S3/upload/complete', authenticateUser, authorizeUser, completeObjectUpload)

// router.get('/',getObject)
router.get('/S3/retrive', authenticateUser, authorizeUser, getObjectFromS3)
router.get('/S3/presigned-url', authenticateUser, authorizeUser, getPresignedURL)
router.get('/byfolder/uploaded', authenticateUser, authorizeUser, getUploadedObjectsByFolder)
router.get('/byfolder/pending', authenticateUser, authorizeUser, getPendingObjectByFolder)

// router.patch('/name',updateObjectName)

router.delete('/', authenticateUser, authorizeUser, deleteObject)

export default router
