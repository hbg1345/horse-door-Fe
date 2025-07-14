const { Router } = require('express');
const ChatRoom = require('../models/ChatRoom');
const axios = require('axios');

const router = Router();

// Perplexity 평가 프롬프트 생성 함수
function makePrompt(message) {
  return `\n아래 채팅 메시지를 다음 기준에 따라 각각 1~5점으로 평가해 주세요.\n\n
  - 논리성: 1~5점 (모순, 논점 일탈, 형식적 오류 여부)\n
  - 상호존중: 1~5점 (심한 인신공격, 비속어, 비하 금지)\n
  - 창의성: 1~5점 (새로운 아이디어, 독창성, 기발함)\n
  - 카운터: 1~5점 (상대 문장 중 자충수/모순을 지적한 정도)\n
  \n**설명, 평가, 기타 텍스트 없이 *반드시 반드시 반드시 반드시* 아래 예시처럼 JSON만 출력하고, 평가할 수 없다면 0을 주도록 해.**\n\n
  예시:\n{\n  \"논리성\": 4,\n  \"상호존중\": 5,\n  \"창의성\": 3,\n  \"카운터\": 2\n}
  \n\n채팅 메시지: \"${message}\"\n`;
}

// Perplexity API 평가 함수
async function evaluateWithPerplexity(message) {
  // 원하는 JSON 구조를 schema로 정의
  const jsonSchema = {
    type: "object",
    properties: {
      논리성: { type: "integer" },
      상호존중: { type: "integer" },
      창의성: { type: "integer" },
      카운터: { type: "integer" }
    },
    required: ["논리성", "상호존중", "창의성", "카운터"]
  };

  const prompt = makePrompt(message);

  try {
    const res = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: "sonar",
        messages: [
          { role: "system", content: "모든 답변은 반드시 JSON 형식으로만 출력하세요." },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        response_format: {
          type: "json_schema",
          json_schema: {
            schema: jsonSchema
          }
        }
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Perplexity 공식 문서 기준: content는 항상 JSON 문자열임
    const content = res.data.choices[0].message.content.trim();
    return JSON.parse(content);
  } catch (e) {
    console.error("Perplexity 응답 파싱 실패:", e?.response?.data || e.message);
    return null;
  }
}

// Gemini 1.5 Flash API 평가 함수 추가
async function evaluateWithGemini(message) {
  const prompt = makePrompt(message);
  try {
    const res = await axios.post(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        contents: [
          { role: "user", parts: [{ text: prompt }] }
        ],
        generationConfig: {
          temperature: 0.2
        }
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        params: {
          key: process.env.GEMINI_API_KEY
        }
      }
    );
    let content = res.data.candidates[0].content.parts[0].text.trim();
    // 마크다운 코드블록 제거
    content = content.replace(/```json|```/g, '').trim();
    return JSON.parse(content);
  } catch (e) {
    console.error("Gemini 응답 파싱 실패:", e?.response?.data || e.message);
    return null;
  }
}

// 채팅 메시지 평가 API
router.post('/evaluate', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '메시지가 필요합니다.' });
  try {
    const score = await evaluateWithPerplexity(message);
    if (!score) return res.status(500).json({ error: 'AI 평가 실패' });
    res.json({ score });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러' });
  }
});

// Gemini 평가 API 라우터 추가
router.post('/evaluate-gemini', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '메시지가 필요합니다.' });
  try {
    const score = await evaluateWithGemini(message);
    if (!score) return res.status(500).json({ error: 'AI 평가 실패' });
    res.json({ score });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버 에러' });
  }
});

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