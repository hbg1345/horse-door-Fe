const { Schema, model } = require('mongoose');

const chatRoomSchema = new Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  maxParticipants: { 
    type: Number, 
    default: 10 
  },
  currentParticipants: { 
    type: Number, 
    default: 0 
  },
  isRanking: { 
    type: Boolean, 
    default: false 
  },
  isItemBattle: { 
    type: Boolean, 
    default: false 
  },
  allowJury: { 
    type: Boolean, 
    default: false 
  },
  allowLawyer: { 
    type: Boolean, 
    default: false 
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  participants: [{
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  jury: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  waiters: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  readyParticipants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: []
  }],
  // 상황설명(요약) 관련 필드 추가
  summaryA: { type: String, default: '' },
  summaryB: { type: String, default: '' },
  aiSummary: { type: String, default: '' },
  spectatorMessages: [
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      nickname: { type: String, required: true },
      message: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  // --- 게임 상태/승자 관련 필드 추가 ---
  round: { type: Number, default: 1 }, // 1: 1차, 2: 재경기
  firstWinner: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // 1차 승자
  firstLoser: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // 1차 패자
  secondWinner: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // 2차(배심원) 승자
  finalWinner: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // 최종 승자
  finalLoser: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // 최종 패자
  gameEndedReason: { type: String, default: '' }, // 'timeout', 'score-diff', 'jury', 'rematch', ...
  isRematch: { type: Boolean, default: false }, // 재경기 여부
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// 업데이트 시 updatedAt 자동 갱신
chatRoomSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = model('ChatRoom', chatRoomSchema); 