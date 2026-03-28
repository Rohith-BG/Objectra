import express,{ Router } from "express"
import { loginUser, logout, logoutAllSessions } from "./auth.controller.js"
import { refreshAcessToken } from "./auth.service.js"

const router : Router = express.Router()

router.post('/login',loginUser)

router.post('/refresh',refreshAcessToken)

router.post('/logout',logout)

router.post('/logoutallsessions',logoutAllSessions)

export default router
