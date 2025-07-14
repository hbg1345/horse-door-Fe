// app.listen(..) <- 실행 엔트리

const connectDB = require('./config/db');
const app = require('./app');
const { PORT } = require('./config/env');
const { createServer } = require('http');
const { Server } = require('socket.io');

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  }
});

// Socket.IO 연결 관리
const connectedUsers = new Map(); // socketId -> { userId, nickname, roomId }

io.on('connection', (socket) => {
  console.log('사용자 연결:', socket.id);

  // 채팅방 입장
  socket.on('join-room', ({ roomId, userId, nickname }) => {
    console.log(`[join-room] roomId: ${roomId}, userId: ${userId}, nickname: ${nickname}`);
    socket.join(roomId);
    connectedUsers.set(socket.id, { userId, nickname, roomId });
    console.log(`${nickname}님이 채팅방 ${roomId}에 입장했습니다.`);
    
    // 채팅방에 입장 메시지 전송
    socket.to(roomId).emit('user-joined', { nickname });
  });

  // 메시지 전송
  socket.on('send-message', ({ roomId, message, userId, nickname, score }) => {
    console.log(`[send-message] roomId: ${roomId}, userId: ${userId}, nickname: ${nickname}, message: ${message}`);
    const messageData = {
      id: Date.now(),
      roomId,
      userId,
      nickname,
      message,
      score, // ← 추가!
      timestamp: new Date().toISOString()
    };
    
    // 채팅방의 모든 사용자에게 메시지 전송
    io.to(roomId).emit('new-message', messageData);
  });

  // 타이핑 상태
  socket.on('typing', ({ roomId, nickname, isTyping }) => {
    socket.to(roomId).emit('user-typing', { nickname, isTyping });
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      socket.to(userInfo.roomId).emit('user-left', { nickname: userInfo.nickname });
      connectedUsers.delete(socket.id);
      console.log(`${userInfo.nickname}님이 연결을 해제했습니다.`);
    }
  });
});

// 데이터베이스 연결 후 서버 시작
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server on port ${PORT}`);
  });
});
