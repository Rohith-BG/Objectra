import express, { Router } from "express"
import { createFolder, deleteFolder, getAllMainFolders, getAllSubFolders, getFolder, updateFolderName, updateParentId } from "./folder.controller.js";
import { authenticateUser } from "../middlewares/authenticateUser.js";
import { authorizeUser } from "../middlewares/authorizeUser.js";
import { requireRole } from "../middlewares/requireRole.js";

const router: Router = express.Router();

router.post('/',authenticateUser,authorizeUser,requireRole("ADMIN"),createFolder)

router.get('/',authenticateUser,getFolder)

router.get('/mainfolders',authenticateUser,getAllMainFolders)

router.get('/subfolders',authenticateUser,getAllSubFolders)

router.patch('/name/:id',authenticateUser,authorizeUser,updateFolderName)

router.patch('/parentId/:id',authenticateUser,authorizeUser,updateParentId)

router.delete('/',authenticateUser,authorizeUser,deleteFolder)

export default router