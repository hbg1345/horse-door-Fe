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