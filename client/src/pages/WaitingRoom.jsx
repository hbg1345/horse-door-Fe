import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getChatRoom, patchChatRoomRole, joinAsWaiter } from '../lib/chatroomApi';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';

export default function WaitingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleChangeLoading, setRoleChangeLoading] = useState(''); // userId 기준
  const socketRef = useRef(null);

  async function fetchRoom() {
    try {
      setLoading(true);
      const data = await getChatRoom(roomId);
      setRoom(data);
    } catch (e) {
      setError('채팅방 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  // 대기룸 입장 시 내 정보를 대기자에 추가
  useEffect(() => {
    async function joinAndFetch() {
      try {
        await joinAsWaiter(roomId);
      } catch (e) {
        // 무시 (이미 대기자/참가자/배심원일 수 있음)
      }
      await fetchRoom();
    }
    joinAndFetch();
    // eslint-disable-next-line
  }, [roomId]);

  // 소켓 연결 및 start-chat 이벤트 처리
  useEffect(() => {
    if (!user) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      withCredentials: true
    });
    socketRef.current = socket;
    // join-room 이벤트로 방에 참여
    socket.emit('join-room', {
      roomId,
      userId: user.id,
      nickname: user.nickname,
      role: (() => {
        if (!room) return 'waiter';
        const myId = user.id;
        if (room.participants?.some(u => u._id === myId || u.id === myId)) return 'participant';
        if (room.jury?.some(u => u._id === myId || u.id === myId)) return 'jury';
        return 'waiter';
      })()
    });
    // start-chat 이벤트 수신 시 채팅룸으로 이동
    socket.on('start-chat', () => {
      navigate(`/dashboard`, { state: { enterRoomId: roomId } });
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [user, roomId, room]);

  // 역할 변경 함수 (서버 연동)
  const handleChangeRole = async (waiterId, role) => {
    setRoleChangeLoading(waiterId + role);
    try {
      await patchChatRoomRole(roomId, waiterId, role);
      await fetchRoom();
    } catch (e) {
      alert('역할 변경 실패: ' + (e?.response?.data?.error || e.message));
    } finally {
      setRoleChangeLoading('');
    }
  };

  if (loading) return <div className="text-green-400">로딩 중...</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!room) return <div className="text-red-400">채팅방 정보가 없습니다.</div>;

  const isOwner = user && room.createdBy && user.id === room.createdBy._id;
  const myId = user?.id;
  const isParticipant = room.participants?.some(u => u._id === myId || u.id === myId);
  const isJury = room.jury?.some(u => u._id === myId || u.id === myId);
  const participantCount = room.participants?.length || 0;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <h2 className="text-3xl font-bold text-green-400 mb-6 font-mono">대기룸 (Room ID: {roomId})</h2>
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg border border-green-400 mb-8 w-96">
        <div className="mb-4">
          <h3 className="text-green-400 font-mono font-semibold mb-2">참가자</h3>
          <div className="flex flex-wrap gap-2">
            {room.participants?.map((user, idx) => (
              <span key={idx} className="bg-green-700 text-white px-3 py-1 rounded-full text-sm font-mono">{user.nickname}</span>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <h3 className="text-purple-400 font-mono font-semibold mb-2">배심원</h3>
          <div className="flex flex-wrap gap-2">
            {room.jury?.length > 0 ? room.jury.map((user, idx) => (
              <span key={idx} className="bg-purple-700 text-white px-3 py-1 rounded-full text-sm font-mono">{user.nickname}</span>
            )) : <span className="text-gray-400 font-mono">없음</span>}
          </div>
        </div>
        <div>
          <h3 className="text-blue-400 font-mono font-semibold mb-2">대기자</h3>
          <div className="flex flex-col gap-2">
            {room.waiters?.length > 0 ? room.waiters.map((waiter, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="bg-blue-700 text-white px-3 py-1 rounded-full text-sm font-mono">{waiter.nickname}</span>
                {isOwner && (
                  <>
                    <button
                      className="bg-green-500 hover:bg-green-600 text-black px-2 py-1 rounded text-xs font-mono border border-green-400 disabled:bg-gray-400"
                      onClick={() => handleChangeRole(waiter._id, 'participant')}
                      disabled={roleChangeLoading === waiter._id + 'participant'}
                    >
                      {roleChangeLoading === waiter._id + 'participant' ? '변경 중...' : '참가자로'}
                    </button>
                    <button
                      className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs font-mono border border-purple-400 disabled:bg-gray-400"
                      onClick={() => handleChangeRole(waiter._id, 'jury')}
                      disabled={roleChangeLoading === waiter._id + 'jury'}
                    >
                      {roleChangeLoading === waiter._id + 'jury' ? '변경 중...' : '배심원으로'}
                    </button>
                  </>
                )}
              </div>
            )) : <span className="text-gray-400 font-mono">없음</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-4 mb-4">
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-8 rounded-lg font-bold font-mono text-lg border-2 border-blue-400 hover:border-blue-300"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              alert('초대 링크가 복사되었습니다!');
            } catch {
              alert('복사에 실패했습니다.');
            }
          }}
        >
          초대
        </button>
      </div>
      <div className="flex gap-4">
        <button
          className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-8 rounded-lg font-bold font-mono text-lg border-2 border-gray-400 hover:border-gray-300"
          onClick={() => navigate(-1)}
        >
          뒤로가기
        </button>
        {isParticipant && (
          <button
            className="bg-green-500 hover:bg-green-600 text-black py-3 px-8 rounded-lg font-bold font-mono text-lg border-2 border-green-400 hover:border-green-300 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-300"
            onClick={() => {
              if (socketRef.current) {
                socketRef.current.emit('start-chat', { roomId });
              }
            }}
            disabled={participantCount < 2}
          >
            {participantCount < 2 ? '참가자 2명 필요' : '채팅 시작'}
          </button>
        )}
      </div>
    </div>
  );
} 