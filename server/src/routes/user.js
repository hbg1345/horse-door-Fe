// /api/user, /api/register, /api/logout

const { Router } = require('express');
const User       = require('../models/User');
const { KAKAO_CLIENT_ID } = require('../config/env');

const router = Router();

router.get('/user', (req,res)=>{
  if (!req.user) return res.json({ isAuthenticated:false });
  const { _id, isRegistered, nickname, avatarUrl } = req.user;
  res.json({ id: _id, isAuthenticated:true, isRegistered, nickname, avatarUrl });
});

router.post('/register', async (req,res)=>{
  if (!req.user) return res.status(401).end();
  const { nickname, avatarUrl } = req.body;
  if (!nickname) return res.status(400).json({ error:'닉네임 필수' });
  await User.findByIdAndUpdate(req.user.id, { nickname, avatarUrl, isRegistered:true });
  res.json({ ok:true });
});

router.post('/logout', (req,res)=>{
  req.logout((err) => {
    if (err) {
      console.error('로그아웃 에러:', err);
      return res.status(500).json({ error: '로그아웃 실패' });
    }
    
    req.session.destroy((err) => {
      if (err) {
        console.error('세션 삭제 에러:', err);
        return res.status(500).json({ error: '세션 삭제 실패' });
      }
      
      // 쿠키 삭제
      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      
      // 카카오 로그아웃 URL 생성
      const kakaoLogoutUrl = `https://kauth.kakao.com/oauth/logout?client_id=${KAKAO_CLIENT_ID}&logout_redirect_uri=${encodeURIComponent(process.env.CLIENT_URL)}`;
      
      res.json({ 
        message: '로그아웃 완료',
        kakaoLogoutUrl 
      });
    });
  });
});

module.exports = router;
