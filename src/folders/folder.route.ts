import express, { Router } from "express"
import { createFolder, deleteFolder, getAllFolders, getFolder, updateFolder } from "./folder.controller.js";

const router:Router = express.Router();

router.post('/',createFolder)

router.get('/list',getAllFolders)

router.get('/',getFolder)

router.put('/',updateFolder)

router.delete('/',deleteFolder)

export default router