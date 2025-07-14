// /auth/kakao* 라우트 + /api/user, api/register, /api/logout

const { Router } = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./user');
const chatroomRoutes = require('./chatroom');

const router = Router();
router.use('/auth', authRoutes);
router.use('/api',  userRoutes);
router.use('/api',  chatroomRoutes);
module.exports = router;
