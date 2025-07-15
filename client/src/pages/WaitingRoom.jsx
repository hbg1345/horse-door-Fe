import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getChatRoom, juryToParticipant, participantToJury, juryLeave, juryKick, joinAsJury, leaveWaitingRoom, getChatRoomSummary, saveChatRoomSummary, requestAiSummary } from '../lib/chatroomApi';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';

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
  const [showJuryDropdownB, setShowJuryDropdownB] = useState(false); // 당사자B용
  const [jurySearch, setJurySearch] = useState('');
  const socketRef = useRef(null);
  const [roomDeleted, setRoomDeleted] = useState(false);
  // 상황설명 상태
  const [summaryA, setSummaryA] = useState('');
  const [summaryB, setSummaryB] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  // 내 역할 구분
  const myId = user?.id;
  const isParticipantA = room?.participants?.[0]?._id === myId || room?.participants?.[0]?.id === myId;
  const isParticipantB = room?.participants?.[1]?._id === myId || room?.participants?.[1]?.id === myId;
  const isJury = room?.jury?.some(u => u._id === myId || u.id === myId);

  // 상황설명 fetch
  async function fetchSummary() {
    setSummaryLoading(true);
    try {
      const res = await getChatRoomSummary(roomId);
      setSummaryA(res.summaryA || '');
      setSummaryB(res.summaryB || '');
      setAiSummary(res.aiSummary || '');
    } catch {
      // 무시
    } finally {
      setSummaryLoading(false);
    }
  }
  useEffect(() => {
    if (!roomId) return;
    fetchSummary();
    // eslint-disable-next-line
  }, [roomId]);
  // 소켓 waiting-room-update 시에도 fetchSummary
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on('waiting-room-update', fetchSummary);
    return () => {
      socketRef.current?.off('waiting-room-update', fetchSummary);
    };
  }, [socketRef.current]);

  // 상황설명 입력 저장
  async function handleSaveSummary(role, summary) {
    setSummaryLoading(true);
    try {
      await saveChatRoomSummary(roomId, role, summary);
      await fetchSummary();
    } catch {}
    setSummaryLoading(false);
  }

  // useState, useEffect, animateBoxes 등 애니메이션 관련 코드 제거

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

  useEffect(() => {
    if (!socketRef.current) return;
    const handleStartChat = () => {
      console.log('[start-chat] 이벤트 수신!');
      console.log('[start-chat] navigate 호출:', `/dashboard`, { state: { enterRoomId: roomId } });
      navigate(`/dashboard`, { state: { enterRoomId: roomId } });
    };
    socketRef.current.on('start-chat', handleStartChat);
    return () => {
      socketRef.current.off('start-chat', handleStartChat);
    };
  }, [roomId, navigate]);

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

  // AI 요약 폴링 함수 (무한 반복)
  async function handleAiSummaryPolling() {
    setAiLoading(true);
    setAiRequested(true);
    let tries = 0;
    const maxTries = 9999; // 사실상 무한 반복
    async function poll() {
      try {
        const res = await requestAiSummary(roomId);
        if (res.aiSummary) {
          setAiSummary(res.aiSummary);
          setAiRequested(false);
          setAiLoading(false);
        } else {
          // 예외적 상황: aiSummary가 없으면 재시도
          if (tries < maxTries) {
            tries++;
            setTimeout(poll, 1000);
          } else {
            // 시간 초과로 멈추지 않고 계속 폴링
            setTimeout(poll, 1000);
          }
        }
      } catch (e) {
        // 상대방 입력 대기 에러면 계속 폴링 (aiRequested/aiLoading을 false로 바꾸지 않음)
        if (e?.response?.data?.error?.includes('두 당사자의 상황설명이 모두 필요합니다')) {
          if (tries < maxTries) {
            tries++;
            setTimeout(poll, 1000);
          } else {
            setTimeout(poll, 1000);
          }
        } else {
          setAiSummary('AI 요약 실패: ' + (e?.response?.data?.error || e.message));
          setAiRequested(false);
          setAiLoading(false);
        }
      }
    }
    poll();
  }

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
  const participantCount = room.participants?.length || 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#111926' }}>
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
        {/* 당사자A/B 박스 (참가자 박스와 동일한 디자인, 배심원 박스와 가로폭 일치) */}
        <div className="w-full max-w-xl flex flex-row gap-8 mb-2">
          {/* 당사자A */}
          <div
            className="flex-1 min-w-0 bg-gray-800/80 rounded-2xl p-5 shadow-2xl border-2 border-green-700 flex flex-col items-start"
          >
            <h3 className="text-green-400 font-mono font-semibold text-2xl mb-4">당사자A</h3>
            <div className="flex flex-wrap gap-2 w-full">
              {room.participants && room.participants.length > 0 ?
                room.participants.filter((_, idx) => idx % 2 === 0).map((user, idx) => (
                  <span
                    key={user._id || idx}
                    className="inline-flex items-center rounded-full px-4 py-2 font-mono text-base w-auto font-bold"
                    style={{
                      backgroundColor: '#fff',
                      color: '#222',
                      border: '2px solid #64748b',
                      boxShadow: '0 2px 8px 0 #0f172a33',
                      fontWeight: 700
                    }}
                  >
                    {user.nickname}
                    {room.readyParticipants && room.readyParticipants.map(String).includes(String(user._id || user.id)) && (
                      <span className="ml-2 text-green-500 font-bold">[준비됨]</span>
                    )}
                  </span>
                )) : <span className="text-gray-400 font-mono">없음</span>}
            </div>
          </div>
          {/* 당사자B */}
          <div
            className="flex-1 min-w-0 bg-gray-800/80 rounded-2xl p-5 shadow-2xl border-2 border-green-700 flex flex-col items-start"
          >
            <h3 className="text-blue-400 font-mono font-semibold text-2xl mb-2">당사자B</h3>
            {room.participants && room.participants.filter((_, idx) => idx % 2 === 1).length === 0 && isOwner ? (
              <div className="w-full flex justify-center relative mb-2">
                <button
                  className="text-4xl font-bold"
                  style={{ background: '#1a233a', color: '#6ee7b7', width: 56, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 0, boxShadow: 'none', cursor: 'pointer', marginTop: 0, marginBottom: 8 }}
                  onClick={() => setShowJuryDropdownB(v => !v)}
                  title="배심원 참가자 승격"
                >
                  +
                </button>
                {showJuryDropdownB && (
                  <div className="absolute left-1/2 -translate-x-1/2 mt-2 bg-gray-900 border border-green-400 rounded shadow-lg z-10 min-w-[200px] max-w-xs w-auto" style={{top: '100%'}}>
                    <input
                      type="text"
                      placeholder="배심원 검색..."
                      value={jurySearch}
                      onChange={e => setJurySearch(e.target.value)}
                      className="w-full mb-2 px-2 py-1 rounded bg-gray-800 border border-green-400 text-green-300 text-sm font-mono focus:outline-none"
                    />
                    {room.jury && room.jury.filter(jury => jury.nickname.includes(jurySearch)).length > 0 ? (
                      room.jury.filter(jury => jury.nickname.includes(jurySearch)).map((jury, idx) => (
                        <button
                          key={jury._id}
                          className="block w-full text-left px-4 py-2 text-sm text-white hover:bg-green-600 disabled:bg-gray-400 rounded"
                          onClick={() => { handleJuryToParticipant(jury._id); setShowJuryDropdownB(false); }}
                          disabled={roleChangeLoading === jury._id + 'participant'}
                        >
                          {roleChangeLoading === jury._id + 'participant' ? '변경 중...' : jury.nickname}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-400 text-sm">배심원 없음</div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 w-full items-center">
              {room.participants && room.participants.filter((_, idx) => idx % 2 === 1).length > 0 ? (
                room.participants.filter((_, idx) => idx % 2 === 1).map((user, idx) => (
                  <span
                    key={user._id || idx}
                    className="inline-flex items-center rounded-full px-4 py-2 font-mono text-base w-auto font-bold"
                    style={{
                      backgroundColor: '#fff',
                      color: '#222',
                      border: '2px solid #64748b',
                      boxShadow: '0 2px 8px 0 #0f172a33',
                      fontWeight: 700
                    }}
                  >
                    {user.nickname}
                    {room.readyParticipants && room.readyParticipants.map(String).includes(String(user._id || user.id)) && (
                      <span className="ml-2 text-green-500 font-bold">[준비됨]</span>
                    )}
                  </span>
                ))
              ) : !isOwner ? (
                <span className="text-gray-400 font-mono">없음</span>
              ) : null}
            </div>
          </div>
        </div>
        {/* 배심원 패널 */}
        <div
          className="w-full max-w-xl bg-gray-800/80 rounded-2xl p-8 shadow-2xl border-2 border-purple-700 min-w-[320px] min-h-[480px]"
        >
          <h3 className="text-purple-400 font-mono font-semibold text-2xl mb-4">배심원</h3>
          <div className="flex flex-wrap gap-2 w-full">
            {room.jury?.length > 0 ? room.jury.map((user, idx) => (
              <span
                key={user._id || idx}
                className="inline-flex items-center rounded-full px-4 py-2 font-mono text-base w-auto font-bold"
                style={{
                  backgroundColor: '#fff',
                  color: '#222',
                  border: '2px solid #64748b',
                  boxShadow: '0 2px 8px 0 #0f172a33',
                  fontWeight: 700
                }}
              >
                {user.nickname}
              </span>
            )) : <span className="text-gray-400 font-mono text-center w-full">배심원이 없습니다. 우측 상단 초대 버튼을 누르고 url을 공유해보세요!</span>}
          </div>
        </div>
      </div>
      {/* 상황설명 박스 (화면 중앙에 고정, 내부 여유 공간 확보) */}
      <div style={{position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 50, width: '100%', maxWidth: '32rem', minWidth: '18rem', padding: 24}} className="bg-gray-800/80 rounded-2xl shadow-2xl border-2 border-gray-600 min-h-[340px] flex flex-col items-center justify-center">
        <div className="w-full mb-2 flex-shrink-0 flex items-center justify-center" style={{minHeight: 40}}>
          <span className="text-white font-bold text-xl sm:text-2xl">상황 요약</span>
        </div>
        {/* AI 요약 버튼 누른 후 + 상대방 입력 전에는 스피너, 그 외에는 상황요약 박스 */}
        {aiRequested && ((isParticipantA && !summaryB.trim()) || (isParticipantB && !summaryA.trim())) ? (
          <div
            className="w-full bg-gray-900/80 rounded-lg border-2 border-gray-500 flex flex-col items-center justify-center"
            style={{minHeight: 400, maxHeight: 400, height: 400, padding: 32, boxSizing: 'border-box'}}
          >
            <LoadingOverlay />
          </div>
        ) : (
          <div style={{width: '100%', margin: '24px 0'}}>
            <div
              className="w-full bg-gray-900/80 rounded-lg border-2 border-gray-500 flex flex-col items-center justify-center"
              style={{minHeight: 400, maxHeight: 400, height: 400, padding: 32, boxSizing: 'border-box'}}
            >
              {/* 입력창: 내부 박스에만 렌더링 */}
              {(isParticipantA || isParticipantB) && !aiSummary && !aiRequested && (
                <>
                  <textarea
                    className="w-full h-full bg-transparent text-white font-mono text-xl sm:text-2xl border-none focus:outline-none resize-none"
                    placeholder={isParticipantA ? '당사자A 상황 설명 입력' : '당사자B 상황 설명 입력'}
                    value={isParticipantA ? summaryA : summaryB}
                    onChange={e => (isParticipantA ? setSummaryA(e.target.value) : setSummaryB(e.target.value))}
                    disabled={summaryLoading}
                    onBlur={e => handleSaveSummary(isParticipantA ? 'A' : 'B', e.target.value)}
                    rows={12}
                    style={{height: '100%', minHeight: 0, maxHeight: '100%', fontSize: '1.25rem', margin: 0, padding: 0, border: 'none', background: 'transparent'}}
                  />
                  <div className="text-gray-400 font-mono text-base mt-2 w-full text-center" style={{margin: 0, padding: 0}}>상황설명을 입력하고 AI 요약 버튼을 눌러주세요.</div>
                </>
              )}
              {/* 결과창: 내부 박스에만 렌더링 */}
              {aiSummary && (
                (() => {
                  let parsed = null;
                  try {
                    parsed = JSON.parse(aiSummary);
                  } catch (e) {}
                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    return (
                      <div className="w-full space-y-4">
                        {Object.entries(parsed).map(([key, value]) => (
                          <div key={key} className="flex items-start">
                            <span className="font-bold text-green-400 min-w-[90px]">{key}</span>
                            <span className="ml-3 text-white whitespace-pre-line">{value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } else {
                    return (
                      <pre className="w-full text-white bg-transparent font-mono text-lg whitespace-pre-wrap">{aiSummary}</pre>
                    );
                  }
                })()
              )}
              {/* 스피너 안내: 내부 박스에만 렌더링 (aiRequested 중 상대방 입력이 이미 들어온 경우는 제외) */}
              {aiRequested && !aiSummary && !((isParticipantA && !summaryB.trim()) || (isParticipantB && !summaryA.trim())) && (
                <div className="w-full h-full flex flex-col items-center justify-center" style={{margin: 0, padding: 0}}>
                  <LoadingOverlay />
                  <div className="text-gray-300 font-mono text-lg mt-6" style={{margin: 0, padding: 0}}>AI 요약을 생성 중입니다...</div>
                </div>
              )}
              {/* 배심원: 결과 없으면 안내문구 */}
              {isJury && !isParticipantA && !isParticipantB && !aiSummary && !aiRequested && (
                <div className="text-gray-300 font-mono text-base w-full text-center mt-8" style={{margin: 0, padding: 0}}>AI가 요약한 상황설명 결과가 여기에 표시됩니다.</div>
              )}
            </div>
          </div>
        )}
        {/* AI 요약 버튼: 참가자만, 결과 없을 때만 */}
        {(isParticipantA || isParticipantB) && !aiSummary && (
          <>
            <button
              className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-lg text-lg transition disabled:bg-gray-500"
              style={{marginTop: 16}}
              disabled={aiLoading || !(isParticipantA ? summaryA.trim() : summaryB.trim())}
              onClick={handleAiSummaryPolling}
            >
              {aiLoading ? 'AI 요약 중...' : 'AI 요약'}
            </button>
            {/* 상대방 입력 대기 안내/로딩: 버튼 누른 뒤, 결과 나오기 전까지 계속 */}
            {aiRequested && !aiSummary && (
              ((isParticipantA && !summaryB.trim()) || (isParticipantB && !summaryA.trim())) && (
                <div className="flex flex-col items-center justify-center w-full my-8">
                  <LoadingOverlay />
                  <div className="text-gray-300 font-mono text-lg mt-6">상대방의 상황 설명을 기다리고 있습니다...</div>
                </div>
              )
            )}
          </>
        )}
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
        {/* 준비/시작 버튼 UX 개선 */}
        {isOwner ? (
          <button
            className="bg-green-500 hover:bg-green-600 text-black py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-green-400 hover:border-green-300 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-300 shadow"
            disabled={!(room.participants && room.readyParticipants && room.participants.every(p => room.readyParticipants.map(String).includes(String(p._id || p.id))))}
            onClick={async () => {
              try {
                await fetch(`/api/chatroom/chatrooms/${roomId}/start-chat`, { method: 'POST', credentials: 'include' });
              } catch (e) {
                alert('채팅 시작 실패: ' + (e?.response?.data?.error || e.message));
              }
            }}
          >
            채팅 시작
          </button>
        ) : (isParticipantA || isParticipantB) ? (
          room.readyParticipants && room.readyParticipants.map(String).includes(String(myId)) ? (
            <button
              className="bg-yellow-400 hover:bg-yellow-500 text-black py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-yellow-300 hover:border-yellow-200 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-300 shadow"
              onClick={async () => {
                try {
                  await fetch(`/api/chatroom/chatrooms/${roomId}/unready`, { method: 'POST', credentials: 'include' });
                  await fetchRoom();
                } catch (e) {
                  alert('준비 해제 실패: ' + (e?.response?.data?.error || e.message));
                }
              }}
            >
              준비됨 (해제)
            </button>
          ) : (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-blue-400 hover:border-blue-300 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-300 shadow"
              onClick={async () => {
                try {
                  await fetch(`/api/chatroom/chatrooms/${roomId}/ready`, { method: 'POST', credentials: 'include' });
                  await fetchRoom();
                } catch (e) {
                  alert('준비 실패: ' + (e?.response?.data?.error || e.message));
                }
              }}
            >
              준비
            </button>
          )
        ) : null}
      </div>
      {/* 안내 메시지 */}
      {isOwner && room.participants && room.readyParticipants && !room.participants.every(p => room.readyParticipants.map(String).includes(String(p._id || p.id))) && (
        <div className="text-center text-yellow-300 font-mono text-lg mt-2">참가자가 모두 준비되면 채팅을 시작할 수 있습니다.</div>
      )}
    </div>
  );
} 