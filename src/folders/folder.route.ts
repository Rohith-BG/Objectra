import express, { Router } from "express"
import { createFolder, deleteFolder, getAllMainFolders, getAllSubFolders, getFolder, updateFolderName, updateParentId } from "./folder.controller.js";

const router:Router = express.Router();

router.post('/',createFolder)

router.get('/',getFolder)

router.get('/mainfolders',getAllMainFolders)

router.get('/subfolders',getAllSubFolders)

router.patch('/name/:id',updateFolderName)

router.patch('/parentId/:id',updateParentId)

router.delete('/',deleteFolder)

export default router