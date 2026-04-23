import express,{ Router } from "express"
import { loginUser, logout, logoutAllSessions, refreshAcessToken } from "./auth.controller.js"

const router : Router = express.Router()

router.post('/login',loginUser)

router.post('/refresh',refreshAcessToken)

router.post('/logout',logout)

router.post('/logoutallsessions',logoutAllSessions)

export default router
