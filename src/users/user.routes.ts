import express, { Router } from "express"
import { validateCreateUserRequestBody, validateUpdatePasswordRequestBody, validateUserIdRequestQueryParam } from "./user.middlewares.js"
import { createUser, deleteUser, getUser, updateUserPassword } from "./user.controller.js"
import { authenticateUser } from "../middlewares/authencticateUser.js"
import { authorizeUser } from "../middlewares/authorizeUser.js"
import { requireRole } from "../middlewares/requireRole.js"

const router: Router = express.Router()

router.post('/',authenticateUser,authorizeUser,requireRole("ADMIN"),validateCreateUserRequestBody,createUser)

router.get('/',authenticateUser,authorizeUser,validateUserIdRequestQueryParam,getUser)

router.patch('/password',authenticateUser,authorizeUser,validateUpdatePasswordRequestBody,updateUserPassword)

router.delete('/',authenticateUser,authorizeUser,validateUserIdRequestQueryParam,deleteUser)

export default router