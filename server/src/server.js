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

// roomId별 턴/타이머 상태 저장
const turnStateMap = new Map(); // roomId -> { currentTurnUserId, timer, timerRef }

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

  // 메시지 전송 (턴제)
  socket.on('send-message', (msg) => {
    const state = turnStateMap.get(msg.roomId);
    if (!state || state.currentTurnUserId !== msg.userId) {
      // 턴이 아닌데 메시지 보내면 무시
      return;
    }
    // 참가자 목록에서 상대방 userId 찾기
    ChatRoom.findById(msg.roomId).populate('participants').then(chatRoom => {
      if (!chatRoom) return;
      const users = chatRoom.participants.map(u => u._id.toString());
      if (users.length !== 2) {
        io.to(msg.roomId).emit('system-message', { message: '참가자 2명일 때만 채팅이 가능합니다.' });
        return;
      }
      // 메시지 전송
      io.to(msg.roomId).emit('new-message', msg);
      // 턴 전환
      const nextTurnUserId = users.find(id => id !== msg.userId);
      state.currentTurnUserId = nextTurnUserId;
      state.timer = 10;
      // 타이머 리셋
      if (state.timerRef) clearInterval(state.timerRef);
      state.timerRef = setInterval(() => {
        state.timer -= 0.03;
        if (state.timer <= 0) {
          clearInterval(state.timerRef);
          io.to(msg.roomId).emit('turn-timeout', { loserUserId: String(state.currentTurnUserId) });
        } else {
          io.to(msg.roomId).emit('turn-timer', { timeLeft: Math.max(0, +state.timer.toFixed(3)), currentTurnUserId: String(state.currentTurnUserId) });
        }
      }, 30);
      console.log('[send-message] emit turn-changed:', String(state.currentTurnUserId), 'all users:', users, 'msg.userId:', msg.userId);
      io.to(msg.roomId).emit('turn-changed', { currentTurnUserId: String(state.currentTurnUserId) });
      io.to(msg.roomId).emit('turn-timer', { timeLeft: state.timer, currentTurnUserId: String(state.currentTurnUserId) });
    });
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

  // 채팅 시작(강제 이동, 턴제 시작)
  socket.on('start-chat', async ({ roomId }) => {
    // 방장 userId 찾기
    const chatRoom = await ChatRoom.findById(roomId).populate('createdBy').populate('participants');
    if (!chatRoom || !chatRoom.createdBy) return;
    const ownerId = chatRoom.createdBy._id.toString();
    // 참가자 2명 아닐 때 안내
    if (!chatRoom.participants || chatRoom.participants.length !== 2) {
      io.to(roomId).emit('system-message', { message: '참가자 2명일 때만 채팅이 시작됩니다.' });
      return;
    }
    // 턴 상태 초기화
    if (!turnStateMap.has(roomId)) turnStateMap.set(roomId, {});
    const state = turnStateMap.get(roomId);
    state.currentTurnUserId = ownerId;
    state.timer = 10;
    // 타이머 시작
    if (state.timerRef) clearInterval(state.timerRef);
    state.timerRef = setInterval(() => {
      state.timer -= 0.03;
      if (state.timer <= 0) {
        clearInterval(state.timerRef);
        io.to(roomId).emit('turn-timeout', { loserUserId: String(state.currentTurnUserId) });
      } else {
        io.to(roomId).emit('turn-timer', { timeLeft: Math.max(0, +state.timer.toFixed(3)), currentTurnUserId: String(state.currentTurnUserId) });
      }
    }, 30);
    console.log('[start-chat] emit turn-changed:', String(state.currentTurnUserId));
    io.to(roomId).emit('turn-changed', { currentTurnUserId: String(state.currentTurnUserId) });
    io.to(roomId).emit('turn-timer', { timeLeft: state.timer, currentTurnUserId: String(state.currentTurnUserId) });
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
        // 방에 아무도 없으면 방 삭제
        if (chatRoom.participants.length === 0 && (!chatRoom.jury || chatRoom.jury.length === 0)) {
          await ChatRoom.deleteOne({ _id: roomId });
          io.emit('chatroom-list-update');
        }
      }
    } catch (err) {
      console.error('leave-room DB 업데이트 실패:', err);
    }
    // 모든 소켓(본인 포함)에 시스템 메시지 브로드캐스트
    io.to(roomId).emit('new-message', {
      id: Date.now(),
      type: 'system',
      message: `${nickname}님이 나가셨습니다.`,
      timestamp: new Date().toISOString()
    });
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
