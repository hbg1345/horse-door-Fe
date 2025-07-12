require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const KakaoStrategy = require('passport-kakao').Strategy;

const app = express();
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new KakaoStrategy({
    clientID: process.env.KAKAO_CLIENT_ID,
    callbackURL: process.env.KAKAO_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // 여기서 DB에 사용자 정보 저장/조회
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

app.get('/', (req, res) => {
  res.send('Hello from Express!');
});

app.get('/auth/kakao', passport.authenticate('kakao'));

app.get('/auth/kakao/callback',
  passport.authenticate('kakao', {
    failureRedirect: '/',
    successRedirect: '/',
  })
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 