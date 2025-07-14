// Mongoose 스키마 정의 (모델만 정의)

const { Schema, model } = require('mongoose');

const userSchema = new Schema({
  kakaoId: { type: String, required: true, unique: true },
  isRegistered: { type: Boolean, default: false },
  nickname: String,
  avatarUrl: String,
  friendUuids: [String],
  friendsSyncedAt: Date,
  talkMessageOptIn: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = model('User', userSchema);
