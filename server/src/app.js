// Express 인스턴스 + 미들웨어 공통 탑재

const express       = require('express');
const session       = require('express-session');
const MongoStore    = require('connect-mongo');
const cors          = require('cors');
const passport      = require('./auth/passport');   // 초기화 됨
const routes        = require('./routes');
const { 
  SESSION_SECRET, CLIENT_URL, MONGODB_URI, NODE_ENV 
} = require('./config/env');

const app = express();
app.set('trust proxy', 1);

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGODB_URI }),
  cookie: {
    secure: false, // 항상 false로 설정
    httpOnly: true,
    sameSite: 'lax',
  },
}));

app.use(cors({ origin: CLIENT_URL, credentials:true }));
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());

app.use(routes);

module.exports = app;
