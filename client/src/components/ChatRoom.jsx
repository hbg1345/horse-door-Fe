import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

export default function ChatRoom({ chatRoom, onBack }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

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

    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:8080', {
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

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const messageData = {
      roomId: chatRoom._id,
      message: newMessage.trim(),
      userId: user.id,
      nickname: user.nickname
    };

    socket.emit('send-message', messageData);
    setNewMessage('');

    // 타이핑 상태 해제
    socket.emit('typing', {
      roomId: chatRoom._id,
      nickname: user.nickname,
      isTyping: false
    });
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

  return (
    <div className="w-full h-screen bg-black flex flex-col">
      {/* 채팅방 헤더 */}
      <div className="bg-gray-900 p-4 border-b border-green-400 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-green-400 font-mono">{chatRoom.title}</h2>
          <p className="text-gray-300 font-mono text-sm">
            {chatRoom.currentParticipants}/{chatRoom.maxParticipants}명
          </p>
        </div>
        <button
          onClick={onBack}
          className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-gray-500 hover:border-gray-400"
        >
          뒤로 가기
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.userId === user.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.type === 'system'
                  ? 'bg-gray-700 text-gray-300 text-center mx-auto text-sm'
                  : message.userId === user.id
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {message.type !== 'system' && (
                <div className="text-xs opacity-75 mb-1">{message.nickname}</div>
              )}
              <div className="font-mono">{message.message}</div>
              <div className="text-xs opacity-75 mt-1">
                {formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {/* 타이핑 표시 */}
        {typingUsers.length > 0 && (
          <div className="text-gray-400 text-sm font-mono italic">
            {typingUsers.join(', ')}님이 타이핑 중...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 */}
      <div className="bg-gray-900 p-4 border-t border-green-400">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder="메시지를 입력하세요..."
            className="flex-1 bg-gray-800 border border-green-400 text-green-400 rounded-md px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black py-3 px-6 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-green-400 hover:border-green-300"
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
} 