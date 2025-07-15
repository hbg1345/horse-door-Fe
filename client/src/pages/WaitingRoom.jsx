import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getChatRoom, juryToParticipant, participantToJury, juryLeave, juryKick, joinAsJury, leaveWaitingRoom } from '../lib/chatroomApi';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-20 rounded-xl">
      <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="text-green-300 font-mono text-lg">로딩 중...</div>
    </div>
  );
}

// 플러스(+) 아이콘 컴포넌트
function PlusIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#22c55e" className="group-hover:fill-green-600 transition"/>
      <path d="M10 6V14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M6 10H14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
// X(엑스) 아이콘 컴포넌트
function XIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#ef4444" className="group-hover:fill-red-700 transition"/>
      <path d="M7 7L13 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
// 아래 화살표(Down) 아이콘 컴포넌트
function DownArrowIcon({ className }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#a3e635" className="group-hover:fill-green-500 transition"/>
      <path d="M6 9l4 4 4-4" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
// 위 화살표(Up) 아이콘 컴포넌트
function UpArrowIcon({ className }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#a3e635" className="group-hover:fill-green-500 transition"/>
      <path d="M6 11l4-4 4 4" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
// 보라색 X(엑스) 아이콘 컴포넌트 (배심원 강퇴용)
function PurpleXIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="#a78bfa" className="group-hover:fill-purple-600 transition"/>
      <path d="M7 7L13 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M13 7L7 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function WaitingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleChangeLoading, setRoleChangeLoading] = useState('');
  const [showJuryDropdown, setShowJuryDropdown] = useState(false);
  const [jurySearch, setJurySearch] = useState('');
  const socketRef = useRef(null);
  const [roomDeleted, setRoomDeleted] = useState(false);

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

  // 대기룸 입장 시 방장이 아니면 자동으로 배심원(jury)으로 추가
  useEffect(() => {
    async function joinAndFetch() {
      try {
        await joinAsJury(roomId);
      } catch (e) {
        // 무시 (이미 참가자/배심원일 수 있음)
      }
      await fetchRoom();
    }
    joinAndFetch();
    // eslint-disable-next-line
  }, [roomId]);

  // 소켓 연결 및 start-chat, waiting-room-update 이벤트 처리
  useEffect(() => {
    if (!user) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
      withCredentials: true
    });
    socketRef.current = socket;
    socket.emit('join-room', {
      roomId,
      userId: user.id,
      nickname: user.nickname,
      role: (() => {
        if (!room) return 'jury';
        const myId = user.id;
        if (room.participants?.some(u => u._id === myId || u.id === myId)) return 'participant';
        if (room.jury?.some(u => u._id === myId || u.id === myId)) return 'jury';
        return 'jury';
      })()
    });
    socket.on('start-chat', () => {
      navigate(`/dashboard`, { state: { enterRoomId: roomId } });
    });
    socket.on('waiting-room-update', () => {
      fetchRoom();
    });
    // 방 삭제 감지
    socket.on('chatroom-list-update', async () => {
      // 방이 사라졌는지 확인
      const data = await getChatRoom(roomId).catch(() => null);
      if (!data) {
        setRoomDeleted(true);
        setTimeout(() => {
          navigate('/dashboard');
        }, 100);
      }
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [user, roomId, room]);

  const handleJuryToParticipant = async (juryId) => {
    setRoleChangeLoading(juryId + 'participant');
    try {
      await juryToParticipant(roomId, juryId);
      setShowJuryDropdown(false);
      await fetchRoom();
    } catch (e) {
      alert('역할 변경 실패: ' + (e?.response?.data?.error || e.message));
    } finally {
      setRoleChangeLoading('');
    }
  };
  const handleParticipantToJury = async (participantId) => {
    setRoleChangeLoading(participantId + 'jury');
    try {
      await participantToJury(roomId, participantId);
      await fetchRoom();
    } catch (e) {
      alert('역할 변경 실패: ' + (e?.response?.data?.error || e.message));
    } finally {
      setRoleChangeLoading('');
    }
  };
  const handleJuryLeave = async () => {
    setRoleChangeLoading('jury-leave');
    try {
      await juryLeave(roomId);
      navigate('/dashboard');
    } catch (e) {
      alert('나가기 실패: ' + (e?.response?.data?.error || e.message));
    } finally {
      setRoleChangeLoading('');
    }
  };
  const handleJuryKick = async (juryId) => {
    setRoleChangeLoading(juryId + 'kick');
    try {
      await juryKick(roomId, juryId);
      await fetchRoom();
    } catch (e) {
      alert('강제 퇴장 실패: ' + (e?.response?.data?.error || e.message));
    } finally {
      setRoleChangeLoading('');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg border border-green-400 mb-8 w-96 relative">
        <LoadingOverlay />
        <div style={{ height: 200 }} />
      </div>
    </div>
  );
  if (error) return <div className="text-red-400">{error}</div>;
  if (!room) return <div className="text-red-400">채팅방 정보가 없습니다.</div>;

  const isOwner = user && room.createdBy && user.id === room.createdBy._id;
  const myId = user?.id;
  const isParticipant = room.participants?.some(u => u._id === myId || u.id === myId);
  const isJury = room.jury?.some(u => u._id === myId || u.id === myId);
  const participantCount = room.participants?.length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-green-950 to-gray-800">
      {/* 상단: 방 정보 */}
      <div className="flex justify-between items-center px-12 py-8 border-b border-green-900">
        <div className="flex items-center gap-6">
          <h2 className="text-4xl font-bold text-green-300 font-mono drop-shadow-lg">{room.title}</h2>
          <span className="text-lg text-white bg-green-800 px-4 py-2 rounded-full font-mono shadow">인원: {participantCount}</span>
        </div>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-8 rounded-lg font-bold font-mono text-lg border-2 border-blue-400 hover:border-blue-300 shadow"
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

      {/* 중앙: 참가자/배심원 목록 (패널 전체 오른쪽 여백) */}
      <div className="flex-1 flex flex-col items-start gap-8 px-0 py-8 w-full pl-12 md:pl-20">
        <div className="w-full max-w-xl bg-gray-800/80 rounded-2xl p-8 shadow-2xl border-2 border-green-700 min-w-[320px] mb-2">
          <div className="flex items-center mb-4">
            <h3 className="text-green-400 font-mono font-semibold text-2xl mr-2">참가자</h3>
            {isOwner && room.jury?.length > 0 && (
              <div className="relative">
                <button
                  className="group ml-2 p-1 rounded-full border-2 border-green-400 hover:border-green-600 bg-white hover:bg-green-100 transition flex items-center justify-center"
                  onClick={() => setShowJuryDropdown(v => !v)}
                  title="배심원 참가자 승격"
                >
                  <UpArrowIcon className="w-6 h-6" />
                </button>
                {showJuryDropdown && (
                  <div className="absolute left-0 mt-2 bg-gray-900 border border-green-400 rounded shadow-lg z-10 min-w-[200px] p-3">
                    <input
                      type="text"
                      placeholder="배심원 검색..."
                      value={jurySearch}
                      onChange={e => setJurySearch(e.target.value)}
                      className="w-full mb-2 px-2 py-1 rounded bg-gray-800 border border-green-400 text-green-300 text-sm font-mono focus:outline-none"
                    />
                    {room.jury.filter(jury => jury.nickname.includes(jurySearch)).map((jury, idx) => (
                      <button
                        key={jury._id}
                        className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-green-600 disabled:bg-gray-400 rounded"
                        onClick={() => handleJuryToParticipant(jury._id)}
                        disabled={roleChangeLoading === jury._id + 'participant'}
                      >
                        {roleChangeLoading === jury._id + 'participant' ? '변경 중...' : jury.nickname}
                      </button>
                    ))}
                    {room.jury.filter(jury => jury.nickname.includes(jurySearch)).length === 0 && (
                      <div className="px-4 py-2 text-gray-400 text-sm">배심원 없음</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {room.participants?.map((user, idx) => (
              <div key={idx} className="flex items-center bg-green-700/80 text-white px-4 py-3 rounded-xl text-lg font-mono shadow gap-2">
                <span>{user.nickname}</span>
                {isOwner && user._id !== user.id && user._id !== myId && (
                  <button
                    className="group ml-2 p-1 rounded-full border-2 border-lime-400 hover:border-lime-500 bg-white hover:bg-lime-100 transition flex items-center justify-center"
                    onClick={() => handleParticipantToJury(user._id)}
                    disabled={roleChangeLoading === user._id + 'jury'}
                    title="배심원으로 내리기"
                  >
                    <DownArrowIcon className="w-6 h-6" />
                  </button>
                )}
              </div>
            ))}
            {(!room.participants || room.participants.length === 0) && (
              <span className="text-gray-400 font-mono">참가자 없음</span>
            )}
          </div>
        </div>
        <div className="w-full max-w-xl bg-gray-800/80 rounded-2xl p-8 shadow-2xl border-2 border-purple-700 min-w-[320px]">
          <h3 className="text-purple-400 font-mono font-semibold text-2xl mb-4">배심원</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {room.jury?.length > 0 ? room.jury.map((user, idx) => (
              <div key={idx} className="flex items-center bg-purple-700/80 text-white px-4 py-3 rounded-xl text-lg font-mono shadow gap-2">
                <span>{user.nickname}</span>
                {isOwner && user._id !== myId && (
                  <button
                    className="group ml-2 p-1 rounded-full border-2 border-purple-400 hover:border-purple-600 bg-white hover:bg-purple-100 transition flex items-center justify-center"
                    onClick={() => handleJuryKick(user._id)}
                    disabled={roleChangeLoading === user._id + 'kick'}
                    title="강제 퇴장"
                  >
                    <PurpleXIcon className="w-6 h-6" />
                  </button>
                )}
              </div>
            )) : <span className="text-gray-400 font-mono">배심원 없음</span>}
          </div>
        </div>
      </div>

      {/* 하단: 버튼 */}
      <div className="flex justify-center gap-8 py-8 border-t border-green-900 bg-gray-900/80">
        <button
          className="bg-gray-600 hover:bg-gray-700 text-white py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-gray-400 hover:border-gray-300 shadow"
          onClick={async () => {
            try {
              await leaveWaitingRoom(roomId);
              navigate('/dashboard');
            } catch (e) {
              alert('나가기 실패: ' + (e?.response?.data?.error || e.message));
            }
          }}
        >
          나가기
        </button>
        {isParticipant && (
          <button
            className="bg-green-500 hover:bg-green-600 text-black py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-green-400 hover:border-green-300 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-300 shadow"
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