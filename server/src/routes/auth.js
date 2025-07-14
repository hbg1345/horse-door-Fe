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
    // 사용자의 등록 상태에 따라 리다이렉트
    if (req.user.isRegistered) {
      res.redirect(`${CLIENT_URL}/dashboard`);
    } else {
      res.redirect(`${CLIENT_URL}/register`);
    }
  }
);

module.exports = router;
