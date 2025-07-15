import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getChatRooms, createChatRoom, getChatRoom, deleteChatRoom } from '../lib/chatroomApi';
import CreateChatRoomModal from '../components/CreateChatRoomModal';
import ChatRoom from '../components/ChatRoom';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedChatRoom, setSelectedChatRoom] = useState(null);
  const [isInChat, setIsInChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const navigate = useNavigate();

  // 채팅방 목록 로드
  useEffect(() => {
    loadChatRooms();
  }, []);

  const loadChatRooms = async () => {
    try {
      setLoading(true);
      const data = await getChatRooms();
      setChatRooms(data);
    } catch (err) {
      console.error('채팅방 목록 로드 실패:', err);
      setError('채팅방 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error('로그아웃 실패:', error);
      setLogoutLoading(false);
    }
  };

  const handleCreateChatRoom = async (chatRoomData) => {
    try {
      const newChatRoom = await createChatRoom(chatRoomData);
      setChatRooms([newChatRoom, ...chatRooms]);
      setSelectedChatRoom(newChatRoom);
      setIsModalOpen(false);
    } catch (err) {
      console.error('채팅방 생성 실패:', err);
      setError('채팅방 생성에 실패했습니다.');
    }
  };

  const handleChatRoomClick = async (chatRoom) => {
    try {
      // 최신 정보를 가져오기 위해 서버에서 다시 조회
      const updatedChatRoom = await getChatRoom(chatRoom._id);
      setSelectedChatRoom(updatedChatRoom);
      // setIsInChat(true); // 이 줄을 제거
    } catch (err) {
      console.error('채팅방 정보 로드 실패:', err);
      setError('채팅방 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleDeleteChatRoom = async (chatRoomId, e) => {
    e.stopPropagation(); // 클릭 이벤트 전파 방지
    
    if (!window.confirm('정말로 이 채팅방을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteChatRoom(chatRoomId);
      setChatRooms(chatRooms.filter(room => room._id !== chatRoomId));
      
      // 삭제된 채팅방이 현재 선택된 채팅방이면 선택 해제
      if (selectedChatRoom?._id === chatRoomId) {
        setSelectedChatRoom(null);
        setIsInChat(false);
      }
    } catch (err) {
      console.error('채팅방 삭제 실패:', err);
      setError('채팅방 삭제에 실패했습니다.');
    }
  };

  const handleBackFromChat = () => {
    setIsInChat(false);
    setSelectedChatRoom(null);
  };
  
  // 채팅방에 있는 경우
  if (isInChat && selectedChatRoom) {
    return (
      <ChatRoom 
        chatRoom={selectedChatRoom} 
        onBack={handleBackFromChat}
      />
    );
  }
  
  return (
    <div className="w-full h-screen bg-black flex">
      {/* 좌측: 채팅방 목록 */}
      <div className="w-1/3 bg-gray-900 border-r border-green-400 flex flex-col">
        {/* 헤더 */}
        <div className="p-6 border-b border-green-400">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-2xl font-bold text-green-400 font-mono">
              안녕하세요, {user.nickname}님! 👋
            </h2>
            <button 
              onClick={handleLogout}
              disabled={logoutLoading}
              className={`py-2 px-4 rounded-lg transition-all duration-200 font-bold font-mono text-sm border-2 ${
                logoutLoading 
                  ? 'bg-gray-700 border-gray-600 cursor-not-allowed text-gray-500' 
                  : 'bg-red-600 hover:bg-red-700 border-red-500 hover:border-red-400 text-white'
              }`}
            >
              {logoutLoading ? '로그아웃 중...' : '로그아웃'}
            </button>
          </div>
          <p className="text-gray-300 font-mono">채팅방 목록</p>
        </div>
        
        {/* 채팅방 목록 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="text-green-400 font-mono">로딩 중...</div>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <div className="text-red-400 font-mono">{error}</div>
            </div>
          ) : chatRooms.length === 0 ? (
            <div className="p-4 text-center">
              <div className="text-gray-400 font-mono">채팅방이 없습니다.</div>
            </div>
          ) : (
            chatRooms.map((room) => (
              <div 
                key={room._id}
                onClick={() => handleChatRoomClick(room)}
                className={`p-4 border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition-colors duration-200 ${
                  selectedChatRoom?._id === room._id ? 'bg-gray-800 border-green-400' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-green-400 font-mono font-semibold">{room.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm font-mono">
                      {room.currentParticipants}/{room.maxParticipants}
                    </span>
                    {/* 본인이 생성한 채팅방인 경우 삭제 버튼 표시 */}
                    {room.createdBy && room.createdBy._id === user.id && (
                      <button
                        onClick={(e) => handleDeleteChatRoom(room._id, e)}
                        className="text-red-400 hover:text-red-300 text-xs font-mono bg-red-900 hover:bg-red-800 px-2 py-1 rounded transition-colors duration-200"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-300 font-mono text-sm truncate">
                  {room.description || '설명 없음'}
                </p>
                <div className="flex gap-2 mt-2">
                  {room.isRanking ? (
                    <span className="bg-yellow-600 text-black text-xs px-2 py-1 rounded font-mono">랭킹전</span>
                  ) : (
                    <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded font-mono">일반전</span>
                  )}
                  {room.isItemBattle && (
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded font-mono">아이템전</span>
                  )}
                  {room.allowJury && (
                    <span className="bg-green-600 text-white text-xs px-2 py-1 rounded font-mono">배심원</span>
                  )}
                  {room.allowLawyer && (
                    <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded font-mono">변호사</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 우측: 채팅방 상세 정보 또는 생성 영역 */}
      <div className="flex-1 bg-gray-800 flex items-center justify-center">
        {selectedChatRoom ? (
          <div className="bg-gray-900 p-8 rounded-xl shadow-2xl max-w-2xl w-full mx-4 border border-green-400">
            <h3 className="text-3xl font-bold text-green-400 font-mono mb-6">
              {selectedChatRoom.title}
            </h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-green-400 font-mono font-semibold mb-2">설명</h4>
                <p className="text-gray-300 font-mono">
                  {selectedChatRoom.description || '설명이 없습니다.'}
                </p>
              </div>
              
              <div>
                <h4 className="text-green-400 font-mono font-semibold mb-2">참여 인원</h4>
                <p className="text-gray-300 font-mono">
                  {selectedChatRoom.currentParticipants} / {selectedChatRoom.maxParticipants}명
                </p>
              </div>
              
              <div>
                <h4 className="text-green-400 font-mono font-semibold mb-2">채팅방 설정</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${selectedChatRoom.isRanking ? 'bg-yellow-500' : 'bg-gray-600'}`}></span>
                    <span className="text-gray-300 font-mono">랭킹/일반</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${selectedChatRoom.isItemBattle ? 'bg-blue-500' : 'bg-gray-600'}`}></span>
                    <span className="text-gray-300 font-mono">아이템전</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${selectedChatRoom.allowJury ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                    <span className="text-gray-300 font-mono">배심원 허용</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${selectedChatRoom.allowLawyer ? 'bg-purple-500' : 'bg-gray-600'}`}></span>
                    <span className="text-gray-300 font-mono">변호사 허용</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-green-400 font-mono font-semibold mb-2">생성자</h4>
                <p className="text-gray-300 font-mono">
                  {selectedChatRoom.createdBy?.nickname || '알 수 없음'}
                </p>
              </div>
              
              <div>
                <h4 className="text-green-400 font-mono font-semibold mb-2">참여자 목록</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedChatRoom.participants?.map((participant, index) => (
                    <span key={index} className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm font-mono">
                      {participant.nickname}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex gap-4">
              <button 
                onClick={() => setSelectedChatRoom(null)}
                className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-gray-500 hover:border-gray-400"
              >
                뒤로 가기
              </button>
              <button 
                onClick={() => navigate(`/waiting-room/${selectedChatRoom._id}`)}
                className="bg-green-500 hover:bg-green-600 text-black py-3 px-6 rounded-lg transition-all duration-200 font-mono font-bold border-2 border-green-400 hover:border-green-300"
              >
                대기룸 입장
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h3 className="text-3xl font-bold text-green-400 font-mono mb-6">
              채팅방을 선택하거나 생성하세요
            </h3>
            <p className="text-gray-300 font-mono mb-8 text-lg">
              좌측에서 채팅방을 선택하거나, 새로운 채팅방을 만들어보세요!
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-green-500 hover:bg-green-600 text-black py-4 px-8 rounded-lg shadow-lg transition-all duration-200 font-mono font-bold text-lg border-2 border-green-400 hover:border-green-300"
            >
              새 채팅방 만들기
            </button>
          </div>
        )}
      </div>

      {/* 채팅방 생성 모달 */}
      <CreateChatRoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateChatRoom}
      />
    </div>
  );
}