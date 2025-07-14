const { Router } = require('express');
const ChatRoom = require('../models/ChatRoom');

const router = Router();

// 채팅방 목록 조회
router.get('/chatrooms', async (req, res) => {
  try {
    const chatRooms = await ChatRoom.find()
      .populate('createdBy', 'nickname')
      .populate('participants', 'nickname')
      .sort({ createdAt: -1 });
    
    res.json(chatRooms);
  } catch (error) {
    console.error('채팅방 목록 조회 에러:', error);
    res.status(500).json({ error: '채팅방 목록 조회 실패' });
  }
});

// 특정 채팅방 조회
router.get('/chatrooms/:id', async (req, res) => {
  try {
    const chatRoom = await ChatRoom.findById(req.params.id)
      .populate('createdBy', 'nickname')
      .populate('participants', 'nickname');
    
    if (!chatRoom) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });
    }
    
    res.json(chatRoom);
  } catch (error) {
    console.error('채팅방 조회 에러:', error);
    res.status(500).json({ error: '채팅방 조회 실패' });
  }
});

// 새 채팅방 생성
router.post('/chatrooms', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }

    const {
      title,
      description,
      maxParticipants,
      chatType,
      isItemBattle,
      allowJury,
      allowLawyer
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: '채팅방 제목은 필수입니다' });
    }

    const chatRoom = new ChatRoom({
      title,
      description: description || '',
      maxParticipants: maxParticipants || 10,
      isRanking: chatType === 'ranking',
      isItemBattle: isItemBattle || false,
      allowJury: allowJury || false,
      allowLawyer: allowLawyer || false,
      createdBy: req.user.id,
      participants: [req.user.id],
      currentParticipants: 1
    });

    await chatRoom.save();
    
    // 생성된 채팅방을 populate하여 반환
    const populatedChatRoom = await ChatRoom.findById(chatRoom._id)
      .populate('createdBy', 'nickname')
      .populate('participants', 'nickname');
    
    res.status(201).json(populatedChatRoom);
  } catch (error) {
    console.error('채팅방 생성 에러:', error);
    res.status(500).json({ error: '채팅방 생성 실패' });
  }
});

// 채팅방 참여
router.post('/chatrooms/:id/join', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }

    const chatRoom = await ChatRoom.findById(req.params.id);
    if (!chatRoom) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });
    }

    // 이미 참여 중인지 확인
    if (chatRoom.participants.includes(req.user.id)) {
      return res.status(400).json({ error: '이미 참여 중인 채팅방입니다' });
    }

    // 최대 인원 확인
    if (chatRoom.currentParticipants >= chatRoom.maxParticipants) {
      return res.status(400).json({ error: '채팅방이 가득 찼습니다' });
    }

    chatRoom.participants.push(req.user.id);
    chatRoom.currentParticipants += 1;
    await chatRoom.save();

    const updatedChatRoom = await ChatRoom.findById(chatRoom._id)
      .populate('createdBy', 'nickname')
      .populate('participants', 'nickname');

    res.json(updatedChatRoom);
  } catch (error) {
    console.error('채팅방 참여 에러:', error);
    res.status(500).json({ error: '채팅방 참여 실패' });
  }
});

// 채팅방 나가기
router.post('/chatrooms/:id/leave', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }

    const chatRoom = await ChatRoom.findById(req.params.id);
    if (!chatRoom) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });
    }

    // 참여 중인지 확인
    if (!chatRoom.participants.includes(req.user.id)) {
      return res.status(400).json({ error: '참여 중이 아닌 채팅방입니다' });
    }

    chatRoom.participants = chatRoom.participants.filter(
      participant => participant.toString() !== req.user.id
    );
    chatRoom.currentParticipants -= 1;
    await chatRoom.save();

    const updatedChatRoom = await ChatRoom.findById(chatRoom._id)
      .populate('createdBy', 'nickname')
      .populate('participants', 'nickname');

    res.json(updatedChatRoom);
  } catch (error) {
    console.error('채팅방 나가기 에러:', error);
    res.status(500).json({ error: '채팅방 나가기 실패' });
  }
});

// 채팅방 삭제 (생성자만 가능)
router.delete('/chatrooms/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }

    const chatRoom = await ChatRoom.findById(req.params.id);
    if (!chatRoom) {
      return res.status(404).json({ error: '채팅방을 찾을 수 없습니다' });
    }

    // 생성자인지 확인
    if (chatRoom.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: '채팅방을 삭제할 권한이 없습니다' });
    }

    await ChatRoom.findByIdAndDelete(req.params.id);
    res.json({ message: '채팅방이 삭제되었습니다' });
  } catch (error) {
    console.error('채팅방 삭제 에러:', error);
    res.status(500).json({ error: '채팅방 삭제 실패' });
  }
});

module.exports = router; 