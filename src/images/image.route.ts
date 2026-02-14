import express, { Router } from "express"
import { createImage, deleteImage, getImage, getImageFromS3, getPendingImagesByFolder, getPresignedURL, getUploadedImagesByFolderId, updateImageName, uploadImageToS3 } from "./image.controller.js";


const router : Router = express.Router();

router.post('/',createImage)

router.get('/',getImage)

router.patch('/name',updateImageName)

router.delete('/',deleteImage)

router.post('/S3/upload', uploadImageToS3)

router.get('/S3/retrive',getImageFromS3)

router.get('/S3/presigned-url',getPresignedURL)

router.get('/byfolder/uploaded',getUploadedImagesByFolderId)

router.get('/byfolder/pending',getPendingImagesByFolder)

export default router
