// /auth/kakao* 라우트

const { Router } = require('express');
const passport   = require('../auth/passport');
const { CLIENT_URL } = require('../config/env');

const router = Router();

router.get('/kakao',
  passport.authenticate('kakao', {
    scope: ['friends','talk_message'],
  })
);

router.get('/kakao/callback',
  passport.authenticate('kakao', {
    failureRedirect: CLIENT_URL,
  }),
  (req, res) => {
    // 세션이 생성된 상태에서 프론트로 리다이렉트
    res.redirect(`${CLIENT_URL}/dashboard`);
  }
);

module.exports = router;
