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

// --- 턴 제한 시간 상수 선언 ---
const TURN_TIME_LIMIT = 10; // 초

// --- 배심원 투표 상태 저장 ---
const juryVoteStateMap = new Map(); // roomId -> { votes: {userId: 'A'|'B'}, timerRef, timeLeft }

// --- game-ended 이후 배심원 투표 시작 함수 ---
async function startJuryVote(roomId, winnerUserId, loserUserId) {
  const chatRoom = await ChatRoom.findById(roomId).populate('participants').populate('jury');
  if (!chatRoom || chatRoom.participants.length < 1) return;
  console.log('[startJuryVote] emit', roomId, '참가자:', chatRoom.participants.map(u => u.nickname).join(','), '배심원:', chatRoom.jury.map(u => u.nickname).join(','));
  juryVoteStateMap.set(roomId, { votes: {}, timeLeft: 10 });
  io.to(roomId).emit('start-jury-vote', {
    participants: chatRoom.participants.map(u => ({ id: u._id.toString(), nickname: u.nickname })),
    jury: chatRoom.jury.map(u => ({ id: u._id.toString(), nickname: u.nickname })),
    timeLeft: 10
  });
  // 10초 타이머
  const timerRef = setInterval(() => {
    const state = juryVoteStateMap.get(roomId);
    if (!state) return;
    state.timeLeft -= 1;
    io.to(roomId).emit('jury-vote-update', { votes: state.votes, timeLeft: state.timeLeft });
    if (state.timeLeft <= 0) {
      clearInterval(timerRef);
      io.to(roomId).emit('jury-vote-update', { votes: state.votes, timeLeft: state.timeLeft });
      // --- 배심원 투표 종료 후 2차 승자/최종 승자/재경기 분기 ---
      ChatRoom.findById(roomId).then(async chatRoom => {
        if (!chatRoom) return;
        // 1차 승자/패자
        const firstWinner = chatRoom.firstWinner ? chatRoom.firstWinner.toString() : null;
        const firstLoser = chatRoom.firstLoser ? chatRoom.firstLoser.toString() : null;
        // 참가자 id 목록
        const participantIds = chatRoom.participants.map(u => u.toString());
        // --- 다수결로 2차 승자 결정 ---
        const voteCounts = {};
        Object.values(state.votes).forEach(voteUserId => {
          if (!voteCounts[voteUserId]) voteCounts[voteUserId] = 0;
          voteCounts[voteUserId]++;
        });
        let secondWinner = null;
        let maxVotes = 0;
        for (const [userId, count] of Object.entries(voteCounts)) {
          if (count > maxVotes) {
            secondWinner = userId;
            maxVotes = count;
          }
        }
        // 동점이면 1차 승자 유지
        if (secondWinner === null && firstWinner) secondWinner = firstWinner;
        chatRoom.secondWinner = secondWinner;
        await chatRoom.save();
        // --- 1차/2차 승자 분기: 같으면 최종 승자, 다르면 재경기 ---
        if (firstWinner && secondWinner) {
          if (String(firstWinner) === String(secondWinner)) {
            // 1차/2차 승자가 같으면 최종 승자 emit
            chatRoom.finalWinner = firstWinner;
            chatRoom.finalLoser = firstLoser;
            await chatRoom.save();
            io.to(roomId).emit('final-winner', {
              finalWinner: firstWinner,
              finalLoser: firstLoser,
              round: chatRoom.round
            });
          } else {
            // 1차/2차 승자가 다르면 재경기
            chatRoom.isRematch = true;
            chatRoom.round = 2;
            // === 여기서 상태 초기화 ===
            chatRoom.spectatorMessages = [];
            await chatRoom.save();
            if (turnStateMap.has(roomId)) {
              turnStateMap.get(roomId).messages = [];
              // 점수 등 추가 상태가 있다면 여기도 초기화
            }
            // ========================
            io.to(roomId).emit('rematch-start', {
              round: 2
            });
          }
        }
      });
      juryVoteStateMap.delete(roomId);
    }
  }, 1000);
  juryVoteStateMap.get(roomId).timerRef = timerRef;
}

function broadcastWaitingRoomUpdate(roomId) {
  io.to(roomId).emit('waiting-room-update');
}

io.on('connection', (socket) => {
  console.log('사용자 연결:', socket.id);

  // 채팅방 입장
  socket.on('join-room', async ({ roomId, userId, nickname, role }) => {
    console.log(`[join-room] roomId: ${roomId}, userId: ${userId}, nickname: ${nickname}, role: ${role}`);
    socket.join(roomId);
    connectedUsers.set(socket.id, { userId, nickname, roomId, role });
    // 오직 참가자만 입장 메시지
    if (role === 'participant') {
      socket.to(roomId).emit('user-joined', { nickname });
    }
    // --- 추가: 참가자 2명 모두 입장 시 턴 시작 ---
    // 참가자 목록 확인
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets && (roomSockets.size === 2 || roomSockets.size === 1)) { // 1명 또는 2명
      // 현재 소켓방에 참가자 userId만 추출
      const participantUserIds = Array.from(roomSockets)
        .map(sid => connectedUsers.get(sid))
        .filter(u => u && u.roomId === roomId && u.role === 'participant')
        .map(u => u.userId);
      if (participantUserIds.length === 1 || participantUserIds.length === 2) {
        // 턴 상태가 이미 시작된 방은 중복 emit 방지
        if (!turnStateMap.has(roomId) || !turnStateMap.get(roomId).currentTurnUserId) {
          // DB에서 방장 userId 찾기
          const chatRoom = await ChatRoom.findById(roomId).populate('createdBy');
          if (!chatRoom || !chatRoom.createdBy) return;
          // 참가자가 1명이면 그 사람, 2명이면 방장
          const ownerId = participantUserIds.length === 1 ? participantUserIds[0] : chatRoom.createdBy._id.toString();
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
          console.log('[join-room] emit turn-changed:', String(state.currentTurnUserId));
          io.to(roomId).emit('turn-changed', { currentTurnUserId: String(state.currentTurnUserId) });
          io.to(roomId).emit('turn-timer', { timeLeft: state.timer, currentTurnUserId: String(state.currentTurnUserId) });
        }
      }
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
    ChatRoom.findById(msg.roomId).populate('participants').then(async chatRoom2 => {
      if (!chatRoom2) {
        console.log('[ERROR] ChatRoom not found', msg.roomId);
        // fallback: 최소한 game-ended emit은 보장
        io.to(msg.roomId).emit('game-ended', {
          winnerUserId: String(state.currentTurnUserId),
          loserUserId: String(state.currentTurnUserId),
          reason: 'timeout'
        });
        return;
      }
      const users = chatRoom2.participants.map(u => u._id.toString());
      // --- 참가자 2명 체크 제거 ---
      // 메시지 전송
      io.to(msg.roomId).emit('new-message', msg);
      // 턴 전환: 상대가 없으면 다시 내 턴, 있으면 상대 턴
      let nextTurnUserId = users.find(id => id !== msg.userId);
      if (!nextTurnUserId) nextTurnUserId = msg.userId; // 혼자면 내 턴 반복
      state.currentTurnUserId = nextTurnUserId;
      state.timer = 10;
      // 타이머 리셋
      if (state.timerRef) clearInterval(state.timerRef);
      state.timerRef = setInterval(() => {
        state.timer -= 0.03;
        // 제한시간 초과 시 타이머 분기
        if (state.timer <= 0) {
          clearInterval(state.timerRef);
          console.log('[DEBUG] 제한시간 초과 분기 진입', msg.roomId, 'currentTurnUserId:', state.currentTurnUserId, 'turnState:', JSON.stringify(state));
          io.to(msg.roomId).emit('turn-timeout', { loserUserId: String(state.currentTurnUserId) });
          // --- 게임 종료: 제한시간 초과 즉시 패배 ---
          ChatRoom.findById(msg.roomId).populate('participants').then(async chatRoom2 => {
            if (!chatRoom2) return;
            const users2 = chatRoom2.participants.map(u => u._id.toString());
            const loserUserId = String(state.currentTurnUserId);
            let winnerUserId = users2.find(id => id !== loserUserId);
            if (!winnerUserId) winnerUserId = loserUserId; // 혼자면 승자=패자
            // --- ChatRoom에 1차 승자/패자, 종료 사유, 라운드 저장 ---
            if (chatRoom2.round === 2) {
              // 재경기: 점수로만 최종 승자 결정, 배심원 투표 없음
              chatRoom2.finalWinner = winnerUserId;
              chatRoom2.finalLoser = loserUserId;
              chatRoom2.gameEndedReason = 'timeout';
              await chatRoom2.save();
              io.to(msg.roomId).emit('final-winner', {
                finalWinner: winnerUserId,
                finalLoser: loserUserId,
                round: 2
              });
              return;
            }
            chatRoom2.round = 1;
            chatRoom2.firstWinner = winnerUserId;
            chatRoom2.firstLoser = loserUserId;
            chatRoom2.gameEndedReason = 'timeout';
            await chatRoom2.save();
            console.log('[TIMER] game-ended emit', msg.roomId, 'winner:', winnerUserId, 'loser:', loserUserId);
            console.log('[EMIT] game-ended', msg.roomId, winnerUserId, loserUserId, 'timeout');
            io.to(msg.roomId).emit('game-ended', {
              winnerUserId,
              loserUserId,
              reason: 'timeout'
            });
            console.log('[TIMER] startJuryVote 호출', msg.roomId, 'winner:', winnerUserId, 'loser:', loserUserId);
            startJuryVote(msg.roomId, winnerUserId, loserUserId);
          });
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
    // --- 게임 종료: 점수차 100점 이상 즉시 승패 ---
    // 참가자별 총점 계산
    ChatRoom.findById(roomId).populate('participants').then(async chatRoom2 => {
      if (!chatRoom2) {
        console.log('[ERROR] ChatRoom not found', roomId);
        // fallback: 최소한 game-ended emit은 보장
        io.to(roomId).emit('game-ended', {
          winnerUserId: users[0],
          loserUserId: users[0],
          reason: 'score-diff'
        });
        return;
      }
      const users = chatRoom2.participants.map(u => u._id.toString());
      // 각 참가자별 총점 계산
      const userScores = {};
      users.forEach(uid => { userScores[uid] = 0; });
      if (!turnStateMap.get(roomId).messages) turnStateMap.get(roomId).messages = [];
      const messages = turnStateMap.get(roomId).messages;
      const msgIdx = messages.findIndex(m => m && m.id === id);
      if (msgIdx >= 0) {
        messages[msgIdx].score = score;
      } else {
        messages.push({ id, userId: id, score }); // userId는 실제로는 msg.userId여야 함(간략화)
      }
      messages.forEach(m => {
        if (m && m.userId && m.score && userScores[m.userId] !== undefined) {
          userScores[m.userId] += Object.values(m.score).reduce((a, b) => a + b, 0);
        }
      });
      // 점수차 체크: 상대가 없으면 0점 처리
      if (users.length === 1) {
        if (userScores[users[0]] >= 100) {
          console.log('[DEBUG] 점수차 분기 진입(1명)', roomId, 'user:', users[0], 'score:', userScores[users[0]]);
          // --- ChatRoom에 1차 승자/패자, 종료 사유, 라운드 저장 ---
          ChatRoom.findById(roomId).then(async chatRoom2 => {
            if (!chatRoom2) {
              console.log('[ERROR] ChatRoom not found', roomId);
              // fallback: 최소한 game-ended emit은 보장
              io.to(roomId).emit('game-ended', {
                winnerUserId: users[0],
                loserUserId: users[0],
                reason: 'score-diff'
              });
              return;
            }
            if (chatRoom2.round === 2) {
              // 재경기: 점수로만 최종 승자 결정, 배심원 투표 없음
              chatRoom2.finalWinner = users[0];
              chatRoom2.finalLoser = users[0];
              chatRoom2.gameEndedReason = 'score-diff';
              await chatRoom2.save();
              io.to(roomId).emit('final-winner', {
                finalWinner: users[0],
                finalLoser: users[0],
                round: 2
              });
              return;
            }
            chatRoom2.round = 1;
            chatRoom2.firstWinner = users[0];
            chatRoom2.firstLoser = users[0];
            chatRoom2.gameEndedReason = 'score-diff';
            await chatRoom2.save();
          });
          console.log('[SCORE] game-ended emit', roomId, 'winner/loser:', users[0]);
          console.log('[EMIT] game-ended', roomId, users[0], users[0], 'score-diff');
          io.to(roomId).emit('game-ended', {
            winnerUserId: users[0],
            loserUserId: users[0],
            reason: 'score-diff'
          });
          console.log('[SCORE] startJuryVote 호출', roomId, 'winner/loser:', users[0]);
          startJuryVote(roomId, users[0], users[0]);
        }
      } else if (users.length === 2) {
        const [uid1, uid2] = users;
        const diff = Math.abs(userScores[uid1] - userScores[uid2]);
        if (diff >= 100) {
          console.log('[DEBUG] 점수차 분기 진입(2명)', roomId, 'uid1:', uid1, 'score1:', userScores[uid1], 'uid2:', uid2, 'score2:', userScores[uid2]);
          const winnerUserId = userScores[uid1] > userScores[uid2] ? uid1 : uid2;
          const loserUserId = userScores[uid1] > userScores[uid2] ? uid2 : uid1;
          // --- ChatRoom에 1차 승자/패자, 종료 사유, 라운드 저장 ---
          ChatRoom.findById(roomId).then(async chatRoom2 => {
            if (!chatRoom2) {
              console.log('[ERROR] ChatRoom not found', roomId);
              // fallback: 최소한 game-ended emit은 보장
              io.to(roomId).emit('game-ended', {
                winnerUserId,
                loserUserId,
                reason: 'score-diff'
              });
              return;
            }
            if (chatRoom2.round === 2) {
              // 재경기: 점수로만 최종 승자 결정, 배심원 투표 없음
              chatRoom2.finalWinner = winnerUserId;
              chatRoom2.finalLoser = loserUserId;
              chatRoom2.gameEndedReason = 'score-diff';
              await chatRoom2.save();
              io.to(roomId).emit('final-winner', {
                finalWinner: winnerUserId,
                finalLoser: loserUserId,
                round: 2
              });
              return;
            }
            chatRoom2.round = 1;
            chatRoom2.firstWinner = winnerUserId;
            chatRoom2.firstLoser = loserUserId;
            chatRoom2.gameEndedReason = 'score-diff';
            await chatRoom2.save();
          });
          console.log('[SCORE] game-ended emit', roomId, 'winner:', winnerUserId, 'loser:', loserUserId);
          console.log('[EMIT] game-ended', roomId, winnerUserId, loserUserId, 'score-diff');
          io.to(roomId).emit('game-ended', {
            winnerUserId,
            loserUserId,
            reason: 'score-diff'
          });
          console.log('[SCORE] startJuryVote 호출', roomId, 'winner:', winnerUserId, 'loser:', loserUserId);
          startJuryVote(roomId, winnerUserId, loserUserId);
        }
      }
    });
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
    // 기존: 실제 소켓방 인원 체크
    // const roomSockets = io.sockets.adapter.rooms.get(roomId);
    // if (!roomSockets || roomSockets.size < 2) {
    //   io.to(roomId).emit('system-message', { message: '실제 접속 인원이 2명 이상일 때만 채팅이 시작됩니다.' });
    //   return;
    // }
    // 방장 userId 찾기
    const chatRoom = await ChatRoom.findById(roomId).populate('createdBy').populate('participants');
    if (!chatRoom || !chatRoom.createdBy) return;
    // --- 수정: 인원수 제한 없이 start-chat emit ---
    io.to(roomId).emit('start-chat');
  });

  // 배심원 투표 이벤트 처리
  socket.on('jury-vote', ({ roomId, juryUserId, voteUserId }) => {
    const state = juryVoteStateMap.get(roomId);
    if (!state) return;
    state.votes[juryUserId] = voteUserId;
    io.to(roomId).emit('jury-vote-update', { votes: state.votes, timeLeft: state.timeLeft });
  });

  // 대기룸 채팅 메시지 브로드캐스트
  socket.on('waiting-room-chat', (msg) => {
    // msg: { roomId, userId, nickname, message, timestamp }
    io.to(msg.roomId).emit('waiting-room-chat', msg);
  });

  // leave-room 이벤트 처리
  socket.on('leave-room', async ({ roomId, userId, nickname }) => {
    // 참가자만 퇴장 메시지
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo && userInfo.role === 'participant') {
      socket.to(roomId).emit('user-left', { nickname });
    }
    connectedUsers.delete(socket.id);
    // --- 추가: 참가자 나가면 턴 상태 리셋 ---
    if (turnStateMap.has(roomId)) {
      turnStateMap.get(roomId).currentTurnUserId = null;
    }
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
      // --- 추가: 연결 해제 시 턴 상태 리셋 ---
      if (userInfo.roomId && turnStateMap.has(userInfo.roomId)) {
        turnStateMap.get(userInfo.roomId).currentTurnUserId = null;
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
