//check if action / actor has a session
import express from 'express'
import cookieParser from "cookie-parser";
import type { Request, Response, NextFunction } from "express";
const app = express()
app.use(cookieParser())

function checksSession(req: Request, res: Response, next: NextFunction) {
    if (!req.cookies?.session_id) {
        return res.status(401)
    }
    next()
}
export default checksSession