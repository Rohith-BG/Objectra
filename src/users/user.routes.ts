import express, { Router } from "express"
import { validateCreateUserRequestBody, validateUpdatePasswordRequestBody, validateUserIdRequestQueryParam } from "./user.middlewares.js"
import { createUser, deleteUser, getUser, updateUserPassword } from "./user.controller.js"

const router : Router = express.Router()

router.post('/',validateCreateUserRequestBody,createUser)

router.get('/',validateUserIdRequestQueryParam,getUser)

router.patch('/password',validateUpdatePasswordRequestBody,updateUserPassword)

router.delete('/',validateUserIdRequestQueryParam,deleteUser)

export default router