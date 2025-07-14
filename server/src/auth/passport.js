// KakaoStrategy + serialize/deserialize

const passport      = require('passport');
const KakaoStrategy = require('passport-kakao').Strategy;
const User          = require('../models/User');
const { KAKAO_CLIENT_ID, KAKAO_CALLBACK_URL } = require('../config/env');

passport.use(new KakaoStrategy(
  { clientID: KAKAO_CLIENT_ID, callbackURL: KAKAO_CALLBACK_URL },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ kakaoId: profile.id });
      if (!user) {
        user = await User.create({
          kakaoId: profile.id,
          talkMessageOptIn: (profile._json.scope || '').includes('talk_message'),
        });
      }
      done(null, user.id);
    } catch (e) { done(e); }
  }
));

passport.serializeUser((id, done) => done(null, id));
passport.deserializeUser((id, done) => 
  User.findById(id).then(u => done(null, u)).catch(done));

module.exports = passport;
