// app.listen(..) <- 실행 엔트리

const connectDB = require('./config/db');
const app = require('./app');
const { PORT } = require('./config/env');
const { createServer } = require('http');
const { Server } = require('socket.io');
const ChatRoom = require('./models/ChatRoom');
const { setSocketIO } = require('./socketUtils');

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
  }
});

setSocketIO(io);

// Socket.IO 연결 관리
const connectedUsers = new Map(); // socketId -> { userId, nickname, roomId }

function broadcastWaitingRoomUpdate(roomId) {
  io.to(roomId).emit('waiting-room-update');
}

io.on('connection', (socket) => {
  console.log('사용자 연결:', socket.id);

  // 채팅방 입장
  socket.on('join-room', ({ roomId, userId, nickname, role }) => {
    console.log(`[join-room] roomId: ${roomId}, userId: ${userId}, nickname: ${nickname}, role: ${role}`);
    socket.join(roomId);
    connectedUsers.set(socket.id, { userId, nickname, roomId, role });
    // 오직 참가자만 입장 메시지
    if (role === 'participant') {
      socket.to(roomId).emit('user-joined', { nickname });
    }
  });

  // 메시지 전송
  socket.on('send-message', (msg) => {
    // 클라이언트에서 보낸 id를 그대로 사용
    console.log(`[send-message] roomId: ${msg.roomId}, userId: ${msg.userId}, nickname: ${msg.nickname}, message: ${msg.message}`);
    io.to(msg.roomId).emit('new-message', msg);
  });

  // 점수 업데이트
  socket.on('update-score', ({ id, roomId, score }) => {
    // DB 업데이트 생략 (메모리 기반)
    io.to(roomId).emit('update-score', { id, score });
  });

  // 타이핑 상태
  socket.on('typing', ({ roomId, nickname, isTyping }) => {
    socket.to(roomId).emit('user-typing', { nickname, isTyping });
  });

  // 관전 전용 채팅 메시지 전송
  socket.on('send-spectator-message', async ({ roomId, userId, nickname, message }) => {
    console.log(`[send-spectator-message] roomId: ${roomId}, userId: ${userId}, nickname: ${nickname}, message: ${message}`);
    const spectatorMessage = {
      userId,
      nickname,
      message,
      timestamp: new Date()
    };
    // DB에 저장
    try {
      await ChatRoom.findByIdAndUpdate(
        roomId,
        { $push: { spectatorMessages: spectatorMessage } },
        { new: true }
      );
      // 해당 방에 브로드캐스트
      io.to(roomId).emit('new-spectator-message', spectatorMessage);
    } catch (err) {
      console.error('관전채팅 저장 실패:', err);
    }
  });

  // 채팅 시작(강제 이동)
  socket.on('start-chat', ({ roomId }) => {
    io.to(roomId).emit('start-chat');
  });

  // leave-room 이벤트 처리
  socket.on('leave-room', async ({ roomId, userId, nickname }) => {
    // 참가자만 퇴장 메시지
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo && userInfo.role === 'participant') {
      socket.to(roomId).emit('user-left', { nickname });
    }
    connectedUsers.delete(socket.id);
    // DB에서 해당 유저를 참가자/배심원에서 제거
    try {
      const chatRoom = await ChatRoom.findById(roomId);
      if (chatRoom) {
        // 참가자에서 제거
        const beforeCount = chatRoom.participants.length;
        chatRoom.participants = chatRoom.participants.filter(id => id.toString() !== userId);
        if (beforeCount !== chatRoom.participants.length) {
          chatRoom.currentParticipants = chatRoom.participants.length;
        }
        // 배심원에서 제거
        if (chatRoom.jury) {
          chatRoom.jury = chatRoom.jury.filter(id => id.toString() !== userId);
        }
        await chatRoom.save();
      }
    } catch (err) {
      console.error('leave-room DB 업데이트 실패:', err);
    }
    // 대기룸/채팅방 유저 목록 갱신
    broadcastWaitingRoomUpdate(roomId);
    io.emit('chatroom-list-update');
    socket.leave(roomId);
    console.log(`[leave-room] ${nickname}님이 방(${roomId})에서 나갔습니다.`);
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      // 오직 참가자만 퇴장 메시지
      if (userInfo.role === 'participant') {
        socket.to(userInfo.roomId).emit('user-left', { nickname: userInfo.nickname });
      }
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
