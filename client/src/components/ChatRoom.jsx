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
        nickname: user.nickname
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

  // 타이머 시작/리셋 로직 (Date.now() 기반)
  useEffect(() => {
    if (inputDisabled) return;
    setTimeLeft(CHAT_TIME_LIMIT);
    timerStartRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - timerStartRef.current) / 1000;
      const left = +(CHAT_TIME_LIMIT - elapsed).toFixed(3);
      if (left <= 0) {
        clearInterval(timerRef.current);
        setTimeLeft(0);
        setInputDisabled(true);
        setTimeout(() => {
          alert('패배하였습니다');
        }, 100);
      } else {
        setTimeLeft(left);
      }
    }, 30);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [inputDisabled]);

  // 나가기 버튼 핸들러
  const handleLeaveRoom = () => {
    if (socket && chatRoom && user) {
      socket.emit('leave-room', { roomId: chatRoom._id, userId: user.id, nickname: user.nickname });
    }
    if (onBack) onBack(); // navigate('/dashboard') 대신 onBack() 호출
  };

  return (
    <div className="w-full h-screen bg-black flex flex-row">
      {/* 메인 채팅창 */}
      <div className="flex-1 flex flex-col">
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

        {/* 남은 시간 표시 */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-black bg-opacity-80 px-6 py-2 rounded-full border-2 border-green-400 text-2xl font-mono text-green-300 font-bold shadow-lg">
            {timeLeft >= 1
              ? Math.ceil(timeLeft) + '초'
              : timeLeft > 0
                ? timeLeft.toFixed(3) + '초'
                : '0초'}
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
                disabled={inputDisabled}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || inputDisabled}
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
    </div>
  );
} 
