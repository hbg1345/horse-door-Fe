import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { getChatRoom, juryToParticipant, participantToJury, juryLeave, juryKick, joinAsJury, leaveWaitingRoom, getChatRoomSummary, saveChatRoomSummary, requestAiSummary } from '../lib/chatroomApi';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';
import html2pdf from "html2pdf.js";
import EditRoomModal from '../components/EditRoomModal';
import GeakseoPDF from '../components/GeakseoPDF';

function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-20 rounded-xl">
      <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin mb-4"></div>
      <div className="text-green-300 font-mono text-lg">로딩 중...</div>
    </div>
  );
}

function DiamondIcon({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 22 22" fill="none">
      <polygon points="11,3 20,11 11,19 2,11" fill="#6366f1"/>
    </svg>
  );
}

function WaitingRoomChat({ roomId, user, socketRef }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socketRef.current) return;
    const handler = (msg) => {
      if (msg.roomId === roomId) setMessages(prev => [...prev, msg]);
    };
    socketRef.current.on('waiting-room-chat', handler);
    return () => {
      socketRef.current.off('waiting-room-chat', handler);
    };
  }, [roomId, socketRef.current]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socketRef.current) return;
    const msg = {
      roomId,
      userId: user.id,
      nickname: user.nickname,
      message: input.trim(),
      timestamp: Date.now(),
    };
    socketRef.current.emit('waiting-room-chat', msg);
    setInput('');
  };

  return (
    <div style={{width: '100%', height: '100%', background:'#181e2a',borderRadius:12,boxShadow:'0 2px 12px #0008',border:'2px solid #4f46e5',display:'flex',flexDirection:'column'}}>
      <div style={{padding:12,borderBottom:'1px solid #4f46e5',color:'#a5b4fc',fontWeight:'bold',fontFamily:'monospace',fontSize:18}}>대기룸 채팅</div>
      <div style={{flex:1,overflowY:'auto',padding:12}}>
        {messages.map((msg,idx)=>(
          <div key={idx} style={{marginBottom:8}}>
            <span style={{color:'#60a5fa',fontWeight:'bold'}}>{msg.nickname}</span>
            <span style={{color:'#fff',marginLeft:8}}>{msg.message}</span>
            <div style={{fontSize:12,color:'#64748b',textAlign:'right'}}>{new Date(msg.timestamp).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSend} style={{display:'flex',borderTop:'1px solid #4f46e5',padding:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder="메시지 입력..." style={{flex:1,background:'#232946',color:'#fff',border:'none',borderRadius:6,padding:'8px 12px',fontSize:16}} />
        <button type="submit" disabled={!input.trim()} style={{marginLeft:8,background:'#6366f1',color:'#fff',border:'none',borderRadius:6,padding:'8px 16px',fontWeight:'bold',fontFamily:'monospace',fontSize:16,cursor:input.trim()? 'pointer':'not-allowed',opacity:input.trim()?1:0.5}}>전송</button>
      </form>
    </div>
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
  const [showJuryDropdownB, setShowJuryDropdownB] = useState(false);
  const [jurySearch, setJurySearch] = useState('');
  const socketRef = useRef(null);
  const [roomDeleted, setRoomDeleted] = useState(false);
  const [summaryA, setSummaryA] = useState('');
  const [summaryB, setSummaryB] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const myId = user?.id;
  const isParticipantA = room?.participants?.[0]?._id === myId || room?.participants?.[0]?.id === myId;
  const isParticipantB = room?.participants?.[1]?._id === myId || room?.participants?.[1]?.id === myId;
  const isJury = room?.jury?.some(u => u._id === myId || u.id === myId);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPledgeModal, setShowPledgeModal] = useState(false);
  const [pledgeText, setPledgeText] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [showGeakseoModal, setShowGeakseoModal] = useState(false);

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
  useEffect(() => {
    if (!socketRef.current) return;
    socketRef.current.on('waiting-room-update', fetchSummary);
    return () => {
      socketRef.current?.off('waiting-room-update', fetchSummary);
    };
  }, [socketRef.current]);

  async function handleSaveSummary(role, summary) {
    setSummaryLoading(true);
    try {
      await saveChatRoomSummary(roomId, role, summary);
      await fetchSummary();
    } catch {}
    setSummaryLoading(false);
  }

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

  // 소켓 연결 useEffect (room 제거)
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
      fetchSummary();
    });
    socket.on('chatroom-list-update', async () => {
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
  }, [user, roomId]); // room 제거

  useEffect(() => {
    if (!socketRef.current) return;
    const handleStartChat = () => {
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

  async function handleAiSummaryPolling() {
    setAiLoading(true);
    setAiRequested(true);
    let tries = 0;
    const maxTries = 9999;
    async function poll() {
      try {
        const res = await requestAiSummary(roomId);
        if (res.aiSummary) {
          setAiSummary(res.aiSummary);
          setAiRequested(false);
          setAiLoading(false);
        } else {
          if (tries < maxTries) {
            tries++;
            setTimeout(poll, 1000);
          } else {
            setTimeout(poll, 1000);
          }
        }
      } catch (e) {
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

  // --- 방장 제외 참가자 준비 체크 로직 ---
  const ownerId = room.createdBy?._id || room.createdBy?.id;
  const participantIds = room.participants
    ? room.participants.map(p => p._id || p.id).filter(id => String(id) !== String(ownerId))
    : [];
  const readyIds = room.readyParticipants ? room.readyParticipants.map(String) : [];
  // 수정: 참가자가 없어도 시작 가능하도록 조건 변경
  const allReady = participantIds.every(id => readyIds.includes(String(id)));
  // 디버깅용 로그
  console.log('ownerId:', ownerId);
  console.log('participantIds:', participantIds);
  console.log('readyIds:', readyIds);
  console.log('allReady:', allReady);

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
                    {/* 방장만 볼 수 있는 배심원 내리기 버튼 */}
                    {isOwner && (
                      <button
                        className="ml-2 px-2 py-1 bg-transparent hover:bg-purple-200 text-purple-600 rounded text-base font-mono border-none disabled:text-gray-400"
                        style={{marginLeft:8, fontWeight:'bold', lineHeight:'1'}}
                        disabled={roleChangeLoading === (user._id || user.id) + 'jury'}
                        onClick={() => handleParticipantToJury(user._id || user.id)}
                        title="배심원으로 내리기"
                      >
                        {roleChangeLoading === (user._id || user.id) + 'jury' ? '⏳' : '↓'}
                      </button>
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
      {/* 대기룸 채팅 정보 박스 (채팅창 바로 위, 예쁘게 개선) */}
      {room && (
        <div style={{
          position: 'fixed',
          bottom: 610,
          right: 80,
          zIndex: 2000,
          width: 560,
          minHeight: 120,
          background: 'linear-gradient(90deg, #232946 70%, #6366f1 100%)',
          border: 'none',
          borderRadius: '18px',
          padding: '24px 36px',
          color: '#fff',
          fontFamily: 'monospace',
          boxShadow: '0 4px 24px #0007',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'flex-start',
          borderTop: '4px solid #a5b4fc',
        }}>
          <div style={{display:'flex',width:'100%',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
            <div style={{fontSize:'1.35rem',fontWeight:'bold',color:'#a5b4fc',letterSpacing:'-1px',display:'flex',alignItems:'center',gap:10}}>
              <DiamondIcon />
              방 설정
            </div>
            {isOwner && <button onClick={()=>setShowEditModal(true)} style={{marginLeft:8,background:'#6366f1',color:'#fff',border:'none',borderRadius:8,padding:'7px 18px',fontWeight:'bold',fontSize:15,cursor:'pointer',boxShadow:'0 2px 8px #6366f155'}}>수정</button>}
          </div>
          {room.description && <div style={{color:'#e0e7ef',fontSize:'1.08rem',marginBottom:2,maxWidth:420,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span style={{color:'#a5b4fc',fontWeight:'bold'}}>방 설명:</span> {room.description}</div>}
          <div style={{display:'flex',gap:18,flexWrap:'wrap',marginTop:2,fontSize:'1.01rem',alignItems:'center'}}>
            <span style={{background:'#181e2a',color:'#a5b4fc',borderRadius:6,padding:'4px 14px',fontWeight:'bold',fontSize:15,boxShadow:'0 1px 4px #0002'}}>최대 인원: {room.maxParticipants}</span>
            <span style={{background: room.isRanking ? '#4ade80' : '#64748b',color:'#232946',borderRadius:6,padding:'4px 14px',fontWeight:'bold',fontSize:15}}>랭킹전: {room.isRanking ? 'ON' : 'OFF'}</span>
            <span style={{background: room.isItemBattle ? '#facc15' : '#64748b',color:'#232946',borderRadius:6,padding:'4px 14px',fontWeight:'bold',fontSize:15}}>아이템전: {room.isItemBattle ? 'ON' : 'OFF'}</span>
            <span style={{background: room.allowJury ? '#38bdf8' : '#64748b',color:'#232946',borderRadius:6,padding:'4px 14px',fontWeight:'bold',fontSize:15}}>배심원: {room.allowJury ? '허용' : '비허용'}</span>
            <span style={{background: room.allowLawyer ? '#f472b6' : '#64748b',color:'#232946',borderRadius:6,padding:'4px 14px',fontWeight:'bold',fontSize:15}}>변호사: {room.allowLawyer ? '허용' : '비허용'}</span>
          </div>
        </div>
      )}
      {showEditModal && <EditRoomModal room={room} onClose={()=>setShowEditModal(false)} onSave={async()=>{setShowEditModal(false); await fetchRoom(); await fetchSummary();}} />}
      {showGeakseoModal && <GeakseoPDF onClose={() => {
        console.log("WaitingRoom에서 onClose 호출됨");
        setShowGeakseoModal(false);
      }} />}
      {/* 대기룸 채팅창 (화면 전체 우측 하단 고정) */}
      {user && roomId && (
        <div style={{position:'fixed',bottom:200,right:80,zIndex:1000,width:560,height:320}}>
          <WaitingRoomChat roomId={roomId} user={user} socketRef={socketRef} />
        </div>
      )}
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
          <>
            <button
              className="bg-green-500 hover:bg-green-600 text-black py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-green-400 hover:border-green-300 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-300 shadow"
              disabled={!allReady}
              onClick={async () => {
                try {
                  await fetch(`/api/chatrooms/${roomId}/start-chat`, { method: 'POST', credentials: 'include' });
                } catch (e) {
                  alert('채팅 시작 실패: ' + (e?.response?.data?.error || e.message));
                }
              }}
            >
              채팅 시작
            </button>
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-blue-400 hover:border-blue-300 shadow"
              onClick={() => setShowGeakseoModal(true)}
            >
              각서
            </button>
          </>
        ) : (isParticipantA || isParticipantB) ? (
          <>
            {room.readyParticipants && room.readyParticipants.map(String).includes(String(myId)) ? (
              <button
                className="bg-yellow-400 hover:bg-yellow-500 text-black py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-yellow-300 hover:border-yellow-200 disabled:bg-gray-400 disabled:text-gray-600 disabled:border-gray-300 shadow"
                onClick={async () => {
                  try {
                    await fetch(`/api/chatrooms/${roomId}/unready`, { method: 'POST', credentials: 'include' });
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
                    await fetch(`/api/chatrooms/${roomId}/ready`, { method: 'POST', credentials: 'include' });
                    await fetchRoom();
                  } catch (e) {
                    alert('준비 실패: ' + (e?.response?.data?.error || e.message));
                  }
                }}
              >
                준비
              </button>
            )}
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white py-3 px-10 rounded-xl font-bold font-mono text-xl border-2 border-blue-400 hover:border-blue-300 shadow"
              onClick={() => setShowGeakseoModal(true)}
            >
              각서
            </button>
          </>
        ) : null}
      </div>
      {/* 안내 메시지 */}
      {isOwner && room.participants && room.readyParticipants && !room.participants.every(p => room.readyParticipants.map(String).includes(String(p._id || p.id))) && (
        <div className="text-center text-yellow-300 font-mono text-lg mt-2">참가자가 모두 준비되면 채팅을 시작할 수 있습니다.</div>
      )}
    </div>
  );
} 