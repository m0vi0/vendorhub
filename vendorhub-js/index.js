const PORT = 1738;
const express = require('express')
const app = express()

const crypto = require('crypto')

const cookieParser = require('cookie-parser')
const bcrypt = require('bcrypt');
const db = require("./db");
const console = require('console');

const SECRET = 'cheater'

const saltRounds = 10;

app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser(SECRET))
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  console.log(req.cookies)
  const userid = db.prepare(`SELECT user_id FROM sessions WHERE id=? AND created_at > DATETIME('now','+1 day');`).get(req.cookies.session_id)
  if (userid === undefined) {
    return res.render('homepage.ejs')
  }
  console.log('session id:', req.cookies.session_id)
  console.log('userid:', userid)
  const userinfo = db.prepare(`SELECT * FROM users WHERE id=?`).get(userid.user_id)
  console.log('user info:', userinfo)
  if (userid) {
    if (userinfo.role === 'client') return res.send('client')
    if (userinfo.role === 'vendor') return res.send('vendor')
  }

  res.send('autologin from cookie didnt work')
})

app.get('/admin', (req, res) => {
  res.render('admin.ejs')
})

app.get('/signup', (req, res) => {
  res.render('signup.ejs')
})

app.get('/client', (req, res) => {
  res.render('client.ejs')
})

app.get('/logout', (req, res) => {
  res.render('homepage.ejs')
})

app.get('/createrequirement', (req, res) => {

})

app.post('/login', async (req, res) => {
  const { email, password, } = req.body
  if (!email || !password) {
    return res.status(400)
  }
  const row = db.prepare(`SELECT * FROM users WHERE email=?;`).get(email);
  const user_id = db.prepare(`SELECT user_id FROM sessions WHERE id = ? AND created_at > DATETIME('now', '-7 days');
  `).get(row.id);
  if (!row) {
    return res.status(401).send('User Not Found')
  }
  if (!user_id) {
    const relogin_userid = db.prepare(`SELECT ID FROM USERS WHERE EMAIL=?`).get(req.body.email)
    try {
      const match = bcrypt.compare(password, row.hash);

      const sessionId = crypto.randomUUID()
      res.cookie('session_id', sessionId, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
      })
      try {
        db.prepare('INSERT INTO sessions (id,user_id) VALUES (?,?);').run(sessionId, relogin_userid.id)
      } catch (error) {
        console.log(error)
      }
      if (row.role === 'client') return res.send('client')
      if (row.role === 'vendor') return res.send('vendor')
      if (!match) return res.send('the password you enteredd was incorrect')
      return res.status(403).send('unknown role')
    }
    catch (err) {
      return res.status(500)
    }

  }
});

app.post('/signup', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.send('error')
  }
  try {
    const hash = await bcrypt.hash(password, saltRounds)
    const user = db.prepare(`INSERT INTO users (email,hash,role) VALUES (?,?,?) RETURNING id;`).get(email, hash, role);
    const sessionId = crypto.randomUUID()
    res.cookie('session_id', sessionId, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    })
    try {
      db.prepare('INSERT INTO sessions (id,user_id) VALUES (?,?);').run(sessionId, user.id)
    } catch (error) {
      console.log(error)
    }

    if (role === 'client') return res.redirect('/client')
    if (role === 'vendor') return res.send('vendor')
    res.redirect('/')
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.send('user already exists')
    }
  }
});

app.listen(PORT, '0.0.0.0')