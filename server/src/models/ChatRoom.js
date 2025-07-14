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