// 소켓 유틸 함수 분리
let ioInstance = null;

function setSocketIO(io) {
  ioInstance = io;
}

function broadcastWaitingRoomUpdate(roomId) {
  if (ioInstance) {
    ioInstance.to(roomId).emit('waiting-room-update');
  }
}

function broadcastChatRoomListUpdate() {
  if (ioInstance) {
    ioInstance.emit('chatroom-list-update');
  }
}

module.exports = {
  setSocketIO,
  broadcastWaitingRoomUpdate,
  broadcastChatRoomListUpdate
}; 