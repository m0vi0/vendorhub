/// <reference path="./src/types/express.d.ts" />
import express, { type Request, type Response, type NextFunction } from 'express'
import * as crypto from 'crypto'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcrypt'
import { db } from './db.js'
import { error } from 'console'
import sessioncheck from './middleware/sessioncheck.js'

const app = express()
const PORT = 1738;

const SECRET = 'cheater'

const saltRounds = 10;

app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser(SECRET))
app.use(express.urlencoded({ extended: true }));


interface UserInfo {
  id: number,
  email: string,
  hash: string,
  role: string //either client or vendor 
}
interface SqliteError extends Error {
  code: string
}
interface AppSession {
  id: string,
  userId: number,
  createdAt: Date,
  expiresAt: Date
}
app.set('view engine', 'ejs')

app.use((req, res, next) => {
  console.log('request body', req);
  next();
});

app.get('/', (req, res, next) => res.send('homepage'))

app.get('/logout', sessioncheck, (req, res, next) => {
  const sessionId = req.cookies?.session_id
  db.exec(`DELETE * FROM sessions WHERE id=?`).run(sessionId)
  res.clearCookie("session_id")
  res.redirect('/')
})

app.post('/', (req, res) => {
  const userId = db.prepare(` SELECT user_id FROM users WHERE email=?`).get(req.body.email)
  if (userId === undefined) {
    return res.send('error becasue userid undefined')
  }
  const userinfo: UserInfo = db.prepare(`SELECT * FROM users WHERE id=?`).get(userId)
  if (userId && userinfo) {
    if (userinfo.role === 'client') return res.redirect(`/users/${userId}/client`)
    if (userinfo.role === 'vendor') return res.redirect(`/users/${userId}/vendor`)
  }
  res.send('autologin from cookie didnt work')
})

app.get(`/users/:userid/client`, (req, res, next) => {
  const userid = req.params.userid
  res.send('success from userid')
})

app.get(`/users/:userid/vendor`, (req: Request, res: Response, next: NextFunction) => {
  const userid = req.params.userid
  res.send('success from userid')

})


function check_user(user: UserInfo) {
  if (!user.email || !user.hash || !user.role) {
    return error
  }
}

app.post('/signup', async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, saltRounds)
  try {
    const row = db.prepare(`
      INSERT INTO users (email,hash,role) VALUES (?,?,?) RETURNING id,email,role;
      `).get(req.body.email, hash, req.body.role)
    if (!row) {
      return res.status(404)
    }
    const user: UserInfo = row
    check_user(user)

    const session: AppSession = {
      id: crypto.randomUUID(),
      userId: row.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60)

    }
    req.sessionId = session.id
    res.cookie('session_id', session.id, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    })
    if (user === undefined) {
      return res.status(500)
    }
    try {
      db.prepare('INSERT INTO sessions (id,user_id) VALUES (?,?);').run(session.id, session.userId)
    } catch (error) {
      console.log(error)
    }
    if (user.role === 'client') return res.redirect(`/users/${session.userId}/client`)
    if (user.role === 'vendor') return res.redirect(`/users/${session.userId}/vendor`)
    res.redirect('/')
  } catch (err: unknown) {
    const error = err as SqliteError
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.send('user already exists')
    }
  }
});

app.listen(PORT, '0.0.0.0')