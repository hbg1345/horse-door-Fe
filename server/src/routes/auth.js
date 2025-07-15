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
    console.log('[KAKAO CALLBACK] req.user:', req.user);
    console.log('[KAKAO CALLBACK] req.session:', req.session);
    res.redirect(`${CLIENT_URL}/dashboard`);
  }
);

module.exports = router;
