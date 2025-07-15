import api from './api';

// 채팅방 목록 조회
export const getChatRooms = async () => {
  const response = await api.get('/api/chatrooms');
  return response.data;
};

// 특정 채팅방 조회
export const getChatRoom = async (id) => {
  const response = await api.get(`/api/chatrooms/${id}`);
  return response.data;
};

// 새 채팅방 생성
export const createChatRoom = async (chatRoomData) => {
  const response = await api.post('/api/chatrooms', chatRoomData);
  return response.data;
};

// 채팅방 참여
export const joinChatRoom = async (id) => {
  const response = await api.post(`/api/chatrooms/${id}/join`);
  return response.data;
};

// 채팅방 나가기
export const leaveChatRoom = async (id) => {
  const response = await api.post(`/api/chatrooms/${id}/leave`);
  return response.data;
};

// 채팅방 삭제
export const deleteChatRoom = async (id) => {
  const response = await api.delete(`/api/chatrooms/${id}`);
  return response.data;
};

// 채팅 메시지 평가 (Perplexity)
export const evaluateMessage = async (message) => {
  const response = await api.post('/api/evaluate', { message });
  return response.data.score; // { 창의성: x, 논리성: y, 예의: z }
};

// Gemini 평가
export const evaluateMessageWithGemini = async (message) => {
  const response = await api.post('/api/evaluate-gemini', { message });
  return response.data.score;
};

// 대기자 역할 변경
export const patchChatRoomRole = async (id, userId, role) => {
  const response = await api.patch(`/api/chatrooms/${id}/role`, { userId, role });
  return response.data;
};

// 대기자(waiters)로 추가
export const joinAsWaiter = async (id) => {
  const response = await api.post(`/api/chatrooms/${id}/wait`);
  return response.data;
};

// 대기룸 나가기
export const leaveWaitingRoom = async (id) => {
  const response = await api.post(`/api/chatrooms/${id}/leave-waitingroom`);
  return response.data;
};

// 대기룸 입장 시 배심원(jury)으로 추가
export const joinAsJury = async (id) => {
  const response = await api.post(`/api/chatrooms/${id}/join-jury`);
  return response.data;
};

// 배심원 → 참가자
export const juryToParticipant = async (id, userId) => {
  const response = await api.patch(`/api/chatrooms/${id}/jury-to-participant`, { userId });
  return response.data;
};
// 참가자 → 배심원
export const participantToJury = async (id, userId) => {
  const response = await api.patch(`/api/chatrooms/${id}/participant-to-jury`, { userId });
  return response.data;
};
// 배심원 나가기
export const juryLeave = async (id) => {
  const response = await api.post(`/api/chatrooms/${id}/jury-leave`);
  return response.data;
};

// 방장이 배심원 강제 퇴장
export const juryKick = async (id, userId) => {
  const response = await api.delete(`/api/chatrooms/${id}/jury/${userId}`);
  return response.data;
}; 