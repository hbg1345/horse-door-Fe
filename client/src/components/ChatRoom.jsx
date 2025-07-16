import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { evaluateMessage, evaluateMessageWithGemini } from '../lib/chatroomApi';
import { useNavigate } from 'react-router-dom';

// 관전 전용 채팅 컴포넌트
function SpectatorChatRoom({ chatRoom, user, userRole, socket, onClose }) {
  const [messages, setMessages] = useState(chatRoom.spectatorMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    setMessages(chatRoom.spectatorMessages || []);
  }, [chatRoom.spectatorMessages]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => setMessages(prev => [...prev, msg]);
    socket.on('new-spectator-message', handler);
    return () => {
      socket.off('new-spectator-message', handler);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;
    socket.emit('send-spectator-message', {
      roomId: chatRoom._id,
      userId: user.id,
      nickname: user.nickname,
      message: newMessage.trim()
    });
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700 w-80 min-w-64 relative">
      <div className="p-2 border-b border-green-400 text-green-400 font-bold text-center font-mono flex items-center justify-center relative">
        관전 전용 채팅
        <button
          onClick={onClose}
          className="absolute right-2 top-1 text-gray-400 hover:text-red-400 text-lg font-bold px-2"
          title="닫기"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((msg, idx) => (
          <div key={idx} className="bg-gray-800 rounded-md px-3 py-2 text-sm text-gray-200">
            <span className="font-bold text-green-400">{msg.nickname}</span>: {msg.message}
            <div className="text-xs text-gray-500 text-right">{new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-2 border-t border-green-400">
        {userRole === 'participant' ? (
          <div className="text-center text-gray-400 text-sm">참가자는 관전채팅에 참여할 수 없습니다.</div>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="관전채팅 입력..."
              className="flex-1 bg-gray-800 border border-green-400 text-green-400 rounded-md px-3 py-2 focus:outline-none font-mono"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black px-4 py-2 rounded-md font-mono font-bold border-2 border-green-400 hover:border-green-300"
            >
              전송
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ChatRoom({ chatRoom, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [showSpectatorChat, setShowSpectatorChat] = useState(true);
  const navigate = useNavigate(); // 추가
  const [systemMessage, setSystemMessage] = useState('');
  const [gameResult, setGameResult] = useState(null); // 반드시 최상단에 위치

  // 스크롤을 맨 아래로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket.IO 연결
  useEffect(() => {
    if (!chatRoom || !user) return;

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('채팅방에 연결되었습니다.');
      // 채팅방 입장
      newSocket.emit('join-room', {
        roomId: chatRoom._id,
        userId: user.id,
        nickname: user.nickname,
        role: 'participant' // 반드시 명시
      });
    });

    newSocket.on('new-message', (messageData) => {
      setMessages(prev => [...prev, messageData]);
    });

    newSocket.on('user-joined', ({ nickname }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        message: `${nickname}님이 입장했습니다.`,
        timestamp: new Date().toISOString()
      }]);
    });

    newSocket.on('user-left', ({ nickname }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'system',
        message: `${nickname}님이 나갔습니다.`,
        timestamp: new Date().toISOString()
      }]);
    });

    newSocket.on('user-typing', ({ nickname, isTyping }) => {
      if (isTyping) {
        setTypingUsers(prev => [...prev.filter(user => user !== nickname), nickname]);
      } else {
        setTypingUsers(prev => prev.filter(user => user !== nickname));
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [chatRoom, user]);

  // 메시지 상태는 컴포넌트 내에서 한 번만 선언되어야 합니다.
  // 중복 선언된 const [messages, setMessages] = useState([]); 줄을 모두 제거하고, 맨 위의 선언만 남깁니다.

  // 소켓 메시지 수신 (new-message, update-score)
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (msg) => setMessages(prev => {
      // 중복 방지: id가 이미 있으면 추가하지 않음
      if (prev.some(m => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
    const handleUpdateScore = ({ id, score }) =>
      setMessages(prev => prev.map(m => m.id === id ? { ...m, score } : m));
    socket.on('new-message', handleNewMessage);
    socket.on('update-score', handleUpdateScore);
    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('update-score', handleUpdateScore);
    };
  }, [socket]);

  // handleSendMessage는 한 번만 선언되어야 하므로, 기존 선언을 모두 제거하고, 타이머 로직이 포함된 새 선언만 남깁니다.
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || inputDisabled) return;
    // 타이머 즉시 리셋 (사용자가 메시지를 입력하자마자)
    setTimeLeft(CHAT_TIME_LIMIT);
    timerStartRef.current = Date.now(); 
    setInputDisabled(false);
    // 임시 메시지 id
    const tempId = Date.now() + Math.random();
    const messageData = {
      id: tempId,
      roomId: chatRoom._id,
      message: newMessage.trim(),
      userId: user.id,
      nickname: user.nickname,
      score: undefined,
      timestamp: new Date().toISOString()
    };
    // 1. 서버에만 메시지 전송 (로컬에 직접 추가하지 않음)
    socket.emit('send-message', messageData);
    setNewMessage('');
    // 타이핑 상태 해제
    socket.emit('typing', {
      roomId: chatRoom._id,
      nickname: user.nickname,
      isTyping: false
    });
    // 2. 점수 평가 비동기 요청
    try {
      const results = await Promise.allSettled([
        evaluateMessage(newMessage.trim()),
        evaluateMessageWithGemini(newMessage.trim())
      ]);
      let perplexityScore = results[0].value;
      let geminiScore = results[1].status === 'fulfilled' ? results[1].value : null;
      let avgScore = null;
      if (geminiScore) {
        avgScore = {};
        for (const key of Object.keys(perplexityScore)) {
          if (geminiScore[key] !== undefined) {
            avgScore[key] = Number(((perplexityScore[key] + geminiScore[key]) / 2).toFixed(1));
          }
        }
      } else {
        avgScore = perplexityScore;
      }
      // 3. 점수 받아오면 서버에 update-score로 알림
      socket.emit('update-score', { id: tempId, roomId: chatRoom._id, score: avgScore });
    } catch (err) {
      console.error('메시지 평가 실패:', err);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!socket) return;

    // 타이핑 상태 전송
    socket.emit('typing', {
      roomId: chatRoom._id,
      nickname: user.nickname,
      isTyping: true
    });

    // 타이핑 타임아웃 설정
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', {
        roomId: chatRoom._id,
        nickname: user.nickname,
        isTyping: false
      });
    }, 1000);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 역할 판별 함수 (viewer 완전 제거, 참가자 아니면 모두 jury)
  function getUserRole(chatRoom, user) {
    if (!chatRoom || !user) return null;
    if (chatRoom.participants && chatRoom.participants.some(u => (u._id || u.id) === (user._id || user.id))) {
      return 'participant';
    }
    return 'jury';
  }
  const userRole = getUserRole(chatRoom, user);

  // 점수 총합 및 색상 계산 함수
  function getScoreSum(score) {
    if (!score) return 0;
    return Object.values(score).reduce((a, b) => a + b, 0);
  }
  function getScoreColor(sum) {
    // 0~8: 빨강, 9~14: 주황~노랑, 15~20: 파랑
    if (sum <= 8) return 'border-red-500';
    if (sum <= 14) return 'border-yellow-400';
    return 'border-blue-500';
  }
  // 메시지별 점수 펼침 상태
  const [openScoreIds, setOpenScoreIds] = useState({});
  const toggleScore = (id) => {
    setOpenScoreIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 채팅 입력 타이머 상태
  const CHAT_TIME_LIMIT = 10; // 초
  const [timeLeft, setTimeLeft] = useState(CHAT_TIME_LIMIT);
  const [inputDisabled, setInputDisabled] = useState(false);
  const timerRef = useRef();
  const timerStartRef = useRef();

  // 턴/타이머 상태
  const [currentTurnUserId, setCurrentTurnUserId] = useState(null);
  const [turnTimer, setTurnTimer] = useState(10);

  useEffect(() => {
    if (!socket) return;
    // 턴 변경
    const handleTurnChanged = ({ currentTurnUserId }) => {
      console.log('turn-changed:', currentTurnUserId, '내 user.id:', user.id, typeof user.id, typeof currentTurnUserId); // 디버깅용
      setCurrentTurnUserId(currentTurnUserId);
    };
    // 타이머 동기화
    const handleTurnTimer = ({ timeLeft }) => {
      setTurnTimer(timeLeft);
    };
    // 패배 처리
    const handleTurnTimeout = ({ loserUserId }) => {
      if (user.id === loserUserId) {
        setInputDisabled(true);
        // alert('패배하였습니다'); // 모달만 뜨도록 alert는 주석 처리
      }
    };
    socket.on('turn-changed', handleTurnChanged);
    socket.on('turn-timer', handleTurnTimer);
    socket.on('turn-timeout', handleTurnTimeout);
    // 추가: 마운트 시 내 user.id 로그
    console.log('[ChatRoom mount] 내 user.id:', user.id, typeof user.id);
    return () => {
      socket.off('turn-changed', handleTurnChanged);
      socket.off('turn-timer', handleTurnTimer);
      socket.off('turn-timeout', handleTurnTimeout);
    };
  }, [socket, user.id]);

  // 나가기 버튼 핸들러
  const handleLeaveRoom = () => {
    // 참가자인 경우 확인 모달
    if (userRole === 'participant') {
      if (!window.confirm('정말로 채팅방에서 나가시겠습니까?')) {
        return;
      }
    }
    if (socket && chatRoom && user) {
      socket.emit('leave-room', { roomId: chatRoom._id, userId: user.id, nickname: user.nickname });
    }
    if (onBack) onBack();
  };

  // 참가자별 총점 계산 함수
  function getParticipantTotalScore(messages, userId) {
    return messages
      .filter(msg => msg.userId === userId && msg.score)
      .reduce((sum, msg) => sum + Object.values(msg.score).reduce((a, b) => a + b, 0), 0);
  }

  // 참가자별 항목별 점수 합계 계산 함수
  function getParticipantScoreSums(messages, userId) {
    const sums = {};
    messages
      .filter(msg => msg.userId === userId && msg.score)
      .forEach(msg => {
        for (const [key, value] of Object.entries(msg.score)) {
          sums[key] = (sums[key] || 0) + value;
        }
      });
    return sums;
  }
  // 참가자별 점수 상세 펼침 상태
  const [openScoreDetail, setOpenScoreDetail] = useState({});

  useEffect(() => {
    if (!socket) return;
    const handleSystemMessage = ({ message }) => {
      setSystemMessage(message);
      setTimeout(() => setSystemMessage(''), 3000);
    };
    socket.on('system-message', handleSystemMessage);
    return () => {
      socket.off('system-message', handleSystemMessage);
    };
  }, [socket]);

  // 배심원 투표 상태
  const [juryVote, setJuryVote] = useState(null); // { participants, jury, timeLeft, votes, ended }
  const [myJuryVote, setMyJuryVote] = useState(null); // 내가 투표한 참가자 id
  const { user: authUser } = useAuth();

  useEffect(() => {
    if (!socket) return;
    // 기존 이벤트 핸들러 ...
    // --- 배심원 투표 이벤트 수신 ---
    const handleStartJuryVote = ({ participants, jury, timeLeft }) => {
      console.log('[start-jury-vote] 이벤트 수신', participants, jury, timeLeft);
      setJuryVote({ participants, jury, timeLeft, votes: {}, ended: false });
      setMyJuryVote(null);
    };
    const handleJuryVoteUpdate = ({ votes, timeLeft }) => {
      setJuryVote(prev => prev ? { ...prev, votes, timeLeft } : null);
    };
    const handleJuryVoteEnded = ({ votes, firstWinner, secondWinner }) => {
      setJuryVote(prev => prev ? { ...prev, votes, ended: true } : null);
      setJuryVoteResult({ firstWinner, secondWinner, votes });
    };
    socket.on('start-jury-vote', handleStartJuryVote);
    socket.on('jury-vote-update', handleJuryVoteUpdate);
    socket.on('jury-vote-ended', handleJuryVoteEnded);
    return () => {
      socket.off('start-jury-vote', handleStartJuryVote);
      socket.off('jury-vote-update', handleJuryVoteUpdate);
      socket.off('jury-vote-ended', handleJuryVoteEnded);
    };
  }, [socket]);

  // 배심원 투표 제출
  const handleJuryVote = (voteUserId) => {
    if (!juryVote || !chatRoom || !user) return;
    setMyJuryVote(voteUserId);
    socket.emit('jury-vote', { roomId: chatRoom._id, juryUserId: user.id, voteUserId });
  };

  // --- 상태 추가 ---
  const [finalResult, setFinalResult] = useState(null); // { finalWinner, finalLoser, round }
  const [rematchNotice, setRematchNotice] = useState(false);
  const [juryVoteResult, setJuryVoteResult] = useState(null); // { firstWinner, secondWinner, votes }

  // --- 소켓 이벤트 핸들러 추가 ---
  useEffect(() => {
    if (!socket) return;
    // 최종 승자 이벤트
    const handleFinalWinner = ({ finalWinner, finalLoser, round }) => {
      setFinalResult({ finalWinner, finalLoser, round });
      setJuryVote(null); // 투표 패널 닫기
      setRematchNotice(false);
    };
    // 재경기 시작 이벤트
    const handleRematchStart = ({ round }) => {
      setRematchNotice(true);
      setFinalResult(null);
      setJuryVote(null);
      setTimeout(() => setRematchNotice(false), 2000);
    };
    socket.on('final-winner', handleFinalWinner);
    socket.on('rematch-start', handleRematchStart);
    return () => {
      socket.off('final-winner', handleFinalWinner);
      socket.off('rematch-start', handleRematchStart);
    };
  }, [socket]);

  // --- 배심원 투표 종료 시 결과 안내 ---
  useEffect(() => {
    if (!juryVote || !juryVote.ended) return;
    // 1차/2차 승자 추출
    const votes = juryVote.votes || {};
    const voteCounts = {};
    Object.values(votes).forEach(v => { voteCounts[v] = (voteCounts[v] || 0) + 1; });
    let secondWinner = null, maxVotes = 0;
    for (const [uid, cnt] of Object.entries(voteCounts)) {
      if (cnt > maxVotes) { secondWinner = uid; maxVotes = cnt; }
    }
    // 동점이면 1차 승자 유지
    const firstWinner = chatRoom.firstWinner ? String(chatRoom.firstWinner) : null;
    if (!secondWinner && firstWinner) secondWinner = firstWinner;
    console.log('[juryVoteResult] firstWinner:', firstWinner, 'secondWinner:', secondWinner, 'votes:', votes);
    setJuryVoteResult({ firstWinner, secondWinner, votes });
    // 2초 후 자동으로 안내 닫기
    const t = setTimeout(() => setJuryVoteResult(null), 2000);
    return () => clearTimeout(t);
  }, [juryVote && juryVote.ended]);

  // --- game-ended 소켓 이벤트 수신 ---
  useEffect(() => {
    if (!socket) return;
    const handleGameEnded = ({ winnerUserId, loserUserId, reason }) => {
      console.log('[game-ended] 이벤트 수신', winnerUserId, loserUserId, reason);
      setGameResult({ winnerUserId, loserUserId, reason });
    };
    socket.on('game-ended', handleGameEnded);
    return () => {
      socket.off('game-ended', handleGameEnded);
    };
  }, [socket]);

  return (
    <div className="w-full h-screen bg-black flex flex-row">
      {/* 메인 채팅창 */}
      <div className="flex-1 flex flex-col relative"> {/* ← relative 추가 */}
        {/* 채팅방 헤더 */}
        <div className="bg-gray-900 p-4 border-b border-green-400 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-green-400 font-mono">{chatRoom.title}</h2>
            <p className="text-gray-300 font-mono text-sm">
              {chatRoom.currentParticipants}/{chatRoom.maxParticipants}명
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {!showSpectatorChat && (
              <button
                onClick={() => setShowSpectatorChat(true)}
                className="bg-gray-700 hover:bg-green-600 text-green-300 hover:text-white py-2 px-3 rounded-lg font-mono font-bold border-2 border-green-400 hover:border-green-300 transition-all duration-200"
              >
                관전채팅 열기
              </button>
            )}
            <button
              onClick={handleLeaveRoom}
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-gray-500 hover:border-gray-400"
              disabled={false}
            >
              나가기
            </button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((message) => {
            const isMine = message.userId === user.id;
            const hasScore = message.score !== undefined && message.score !== null;
            const scoreSum = hasScore ? getScoreSum(message.score) : 0;
            const borderColor = hasScore ? getScoreColor(scoreSum) : '';
            return (
              <div
                key={message.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg relative ${
                    message.type === 'system'
                      ? 'bg-gray-700 text-gray-300 text-center mx-auto text-sm'
                      : isMine
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300'
                  } ${hasScore ? 'border-2 ' + borderColor : ''}`}
                >
                  {message.type !== 'system' && (
                    <div className="text-xs opacity-75 mb-1 flex items-center gap-1">
                      {message.nickname}
                    </div>
                  )}
                  <div className="font-mono">{message.message}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="text-xs opacity-75">
                      {formatTime(message.timestamp)}
                    </div>
                    {/* ▼ 버튼은 항상 표시, 점수 없으면 로딩 */}
                    <button
                      onClick={() => toggleScore(message.id)}
                      className={`ml-1 text-xs focus:outline-none ${isMine ? 'text-black' : 'text-white'} hover:opacity-80`}
                      title="점수 보기"
                    >
                      ▼
                    </button>
                  </div>
                  {/* 점수: 펼침 상태일 때만 표시 */}
                  {openScoreIds[message.id] && (
                    hasScore ? (
                      <div className="text-xs mt-2 font-mono border-t border-gray-600 pt-1">
                        <div className="flex gap-2 items-center">
                          <span className="font-bold">총점: <span className="text-lg" style={{color: scoreSum >= 15 ? '#3b82f6' : scoreSum <= 8 ? '#ef4444' : '#f59e42'}}>{scoreSum}</span></span>
                          <span className="text-blue-700 font-bold">(
                            {Object.entries(message.score).map(([k, v]) => `${k}:${v}`).join(', ')}
                          )</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center py-2">
                        <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                        <span className="ml-2 text-xs text-gray-400">점수 평가중...</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
          
          {/* 타이핑 표시 */}
          {typingUsers.length > 0 && (
            <div className="text-gray-400 text-sm font-mono italic">
              {typingUsers.join(', ')}님이 타이핑 중...
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* 남은 시간 표시 + 참가자별 총점 */}
        <div className="absolute top-4 left-0 w-full flex justify-between items-start z-20 px-8 pointer-events-none">
          {/* 왼쪽 참가자 (파랑) */}
          <div className="flex flex-col items-end flex-1 pointer-events-auto">
            {chatRoom.participants?.[0] && (() => {
              const user = chatRoom.participants[0];
              const userId = user._id || user.id;
              const score = getParticipantTotalScore(messages, userId);
              const scoreSums = getParticipantScoreSums(messages, userId);
              return (
                <>
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow font-mono text-lg border border-gray-200">
                    <span className="text-yellow-400 text-xl">🏆</span>
                    <span className="text-gray-800 font-semibold">{user.nickname}</span>
                    <span className="ml-1 text-blue-500 font-extrabold text-xl">{score}</span>
                    <button
                      onClick={() => setOpenScoreDetail(prev => ({ ...prev, [userId]: !prev[userId] }))}
                      className="ml-2 text-xs text-gray-500 hover:text-gray-800 focus:outline-none"
                      title="항목별 점수 보기"
                    >
                      ▼
                    </button>
                  </span>
                  {openScoreDetail[userId] && (
                    <div className="mt-1 flex flex-col bg-gray-50 rounded px-2 py-1 border font-mono text-gray-700 shadow w-max">
                      {Object.entries(scoreSums).map(([k, v]) => (
                        <span key={k} className="mb-1 last:mb-0">{k}: <b>{v}</b></span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          {/* 타이머 (항상 중앙) + 점수차 */}
          <div className="flex-shrink-0 flex flex-col items-center pointer-events-auto" style={{ minWidth: 160 }}>
            <div className="bg-black bg-opacity-80 px-6 py-2 rounded-full border-2 border-green-400 text-2xl font-mono text-green-300 font-bold shadow-lg">
              {turnTimer >= 1
                ? Math.ceil(turnTimer) + '초'
                : turnTimer > 0
                  ? turnTimer.toFixed(3) + '초'
                  : '0초'}
            </div>
            {/* 점수차 표시 */}
            {chatRoom.participants?.[0] && chatRoom.participants?.[1] && (() => {
              const leftUser = chatRoom.participants[0];
              const rightUser = chatRoom.participants[1];
              const leftScore = getParticipantTotalScore(messages, leftUser._id || leftUser.id);
              const rightScore = getParticipantTotalScore(messages, rightUser._id || rightUser.id);
              const diff = leftScore - rightScore;
              let diffClass = '';
              if (diff === 0) diffClass = 'text-yellow-500';
              else if (diff > 0) diffClass = 'text-blue-500';
              else diffClass = 'text-red-500';
              return (
                <div className={`mt-1 text-sm font-mono font-bold ${diffClass}`}>
                  {diff === 0
                    ? '동점!'
                    : diff > 0
                      ? `${leftUser.nickname} +${diff}점 리드`
                      : `${rightUser.nickname} +${-diff}점 리드`}
                </div>
              );
            })()}
          </div>
          {/* 오른쪽 참가자 (빨강) */}
          <div className="flex flex-col items-start flex-1 pointer-events-auto">
            {chatRoom.participants?.[1] && (() => {
              const user = chatRoom.participants[1];
              const userId = user._id || user.id;
              const score = getParticipantTotalScore(messages, userId);
              const scoreSums = getParticipantScoreSums(messages, userId);
              return (
                <>
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow font-mono text-lg border border-gray-200">
                    <span className="text-yellow-400 text-xl">🏆</span>
                    <span className="text-gray-800 font-semibold">{user.nickname}</span>
                    <span className="ml-1 text-red-500 font-extrabold text-xl">{score}</span>
                    <button
                      onClick={() => setOpenScoreDetail(prev => ({ ...prev, [userId]: !prev[userId] }))}
                      className="ml-2 text-xs text-gray-500 hover:text-gray-800 focus:outline-none"
                      title="항목별 점수 보기"
                    >
                      ▼
                    </button>
                  </span>
                  {openScoreDetail[userId] && (
                    <div className="mt-1 flex flex-col bg-gray-50 rounded px-2 py-1 border font-mono text-gray-700 shadow w-max">
                      {Object.entries(scoreSums).map(([k, v]) => (
                        <span key={k} className="mb-1 last:mb-0">{k}: <b>{v}</b></span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* 메시지 입력 */}
        <div className="bg-gray-900 p-4 border-t border-green-400">
          {userRole === 'participant' ? (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="메시지를 입력하세요..."
                className="flex-1 bg-gray-800 border border-green-400 text-green-400 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono"
                disabled={inputDisabled || !currentTurnUserId}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || inputDisabled || !currentTurnUserId || String(user.id) !== String(currentTurnUserId)}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black py-3 px-6 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-green-400 hover:border-green-300"
              >
                전송
              </button>
            </form>
          ) : (
            <div className="text-center text-gray-400 font-mono py-2">
              배심원은 채팅 입력이 불가합니다. (관전만 가능)
            </div>
          )}
          {/* 턴 정보 동기화 안내 */}
          {!currentTurnUserId && (
            <div className="text-center text-yellow-400 font-mono mt-2">턴 정보 동기화 중...</div>
          )}
        </div>
      </div>
      {/* 관전 전용 채팅창 */}
      {showSpectatorChat && (
        <SpectatorChatRoom
          chatRoom={chatRoom}
          user={user}
          userRole={userRole}
          socket={socket}
          onClose={() => setShowSpectatorChat(false)}
        />
      )}
      {/* 안내 메시지 배너 */}
      {systemMessage && (
        <div className="fixed top-0 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black font-mono font-bold px-6 py-2 rounded-b shadow-lg z-50">
          {systemMessage}
        </div>
      )}
      {/* 게임 종료 모달 */}
      {gameResult && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 min-w-[320px] flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-4 text-green-600 font-mono">게임 종료</h2>
            <div className="mb-4 text-lg font-mono">
              {gameResult.winnerUserId === user.id
                ? '🎉 승리하셨습니다!'
                : gameResult.loserUserId === user.id
                ? '😢 패배하셨습니다.'
                : '게임이 종료되었습니다.'}
            </div>
            <div className="mb-2 text-gray-700 font-mono">
              종료 사유: {gameResult.reason === 'timeout' ? '제한시간 초과' : '점수차 100점 이상'}
            </div>
            <button
              className="mt-4 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-bold font-mono"
              onClick={() => setGameResult(null)}
            >
              확인 (배심원 투표로 이동)
            </button>
          </div>
        </div>
      )}
      {/* 배심원 투표 패널 */}
      {juryVote && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 min-w-[340px] flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4 text-purple-700 font-mono">배심원 투표</h2>
            {/* --- 각 당사자 점수 요약 --- */}
            <div className="flex gap-8 mb-6 w-full justify-center">
              {juryVote.participants.map(p => {
                const userId = p.id;
                const total = getParticipantTotalScore(messages, userId);
                const sums = getParticipantScoreSums(messages, userId);
                return (
                  <div key={userId} className="bg-gray-100 rounded-lg p-4 min-w-[140px] flex flex-col items-center border-2 border-purple-300">
                    <div className="font-bold text-lg text-purple-700 mb-1">{p.nickname}</div>
                    <div className="font-mono text-xl mb-2">총점: <span className="font-bold">{total}</span></div>
                    <div className="text-sm text-gray-700 font-mono space-y-1">
                      {Object.entries(sums).map(([k, v]) => (
                        <div key={k}>{k}: <b>{v}</b></div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* --- 기존 투표 UI --- */}
            {juryVote.jury && juryVote.jury.length === 0 ? (
              <div className="text-gray-500 font-mono text-lg mt-4">
                배심원이 없어 투표가 진행되지 않습니다.
              </div>
            ) : (
              <>
                <div className="mb-2 text-gray-700 font-mono">남은 시간: <span className="font-bold text-lg">{juryVote.timeLeft}</span>초</div>
                <div className="mb-4 text-gray-700 font-mono">누가 더 잘했나요?</div>
                <div className="flex gap-4 mb-4">
                  {juryVote.participants.map(p => (
                    <button
                      key={p.id}
                      className={`px-6 py-2 rounded font-bold font-mono border-2 transition-all duration-150 ${myJuryVote === p.id ? 'bg-purple-600 text-white border-purple-700' : 'bg-white text-purple-700 border-purple-400 hover:bg-purple-100'}`}
                      disabled={!!myJuryVote || juryVote.ended}
                      onClick={() => handleJuryVote(p.id)}
                    >
                      {p.nickname}
                    </button>
                  ))}
                </div>
                <div className="w-full mb-2">
                  <div className="text-gray-700 font-mono mb-1">실시간 투표 현황</div>
                  <div className="flex gap-4 justify-center">
                    {juryVote.participants.map(p => (
                      <div key={p.id} className="flex flex-col items-center">
                        <span className="font-bold text-purple-700">{p.nickname}</span>
                        <span className="text-lg font-mono">{Object.values(juryVote.votes || {}).filter(v => v === p.id).length}표</span>
                      </div>
                    ))}
                  </div>
                </div>
                {juryVote.ended && (
                  <div className="mt-4 text-lg font-mono font-bold text-green-700">투표가 종료되었습니다.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {/* --- 최종 승자 안내 모달 --- */}
      {finalResult && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 min-w-[320px] flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-4 text-green-700 font-mono">최종 승자</h2>
            <div className="mb-4 text-lg font-mono">
              {finalResult.finalWinner === user.id
                ? '🎉 최종 승리하셨습니다!'
                : finalResult.finalLoser === user.id
                ? '😢 최종 패배하셨습니다.'
                : '최종 승자: ' + (chatRoom.participants.find(u => (u._id||u.id) === finalResult.finalWinner)?.nickname || finalResult.finalWinner)}
            </div>
            <div className="mb-2 text-gray-700 font-mono">
              라운드: {finalResult.round === 2 ? '재경기' : '1차'}
            </div>
            <button
              className="mt-4 px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded font-bold font-mono"
              onClick={() => setFinalResult(null)}
            >확인</button>
          </div>
        </div>
      )}
      {/* --- 재경기 안내 모달 --- */}
      {rematchNotice && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 min-w-[320px] flex flex-col items-center">
            <h2 className="text-xl font-bold mb-4 text-purple-700 font-mono">재경기 시작!</h2>
            <div className="mb-4 text-lg font-mono">1차/2차 승자가 같아 재경기를 진행합니다.</div>
          </div>
        </div>
      )}
      {/* --- 배심원 투표 결과 안내 --- */}
      {juryVoteResult && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 min-w-[280px] flex flex-col items-center">
            <h2 className="text-lg font-bold mb-2 text-purple-700 font-mono">배심원 투표 결과</h2>
            <div className="mb-2 text-gray-700 font-mono">
              1차 승자: {chatRoom.participants.find(u => (u._id||u.id) === juryVoteResult.firstWinner)?.nickname || juryVoteResult.firstWinner}
            </div>
            <div className="mb-2 text-gray-700 font-mono">
              2차(배심원) 승자: {chatRoom.participants.find(u => (u._id||u.id) === juryVoteResult.secondWinner)?.nickname || juryVoteResult.secondWinner}
            </div>
            <div className="mb-2 text-gray-700 font-mono">
              {juryVoteResult.firstWinner !== juryVoteResult.secondWinner
                ? '최종 승자는 배심원 투표 결과로 결정됩니다.'
                : '동점! 재경기로 진행됩니다.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
