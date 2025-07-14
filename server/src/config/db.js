// mongoose.connect(...) DB 단일 진입

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');

function connectDB() {
  return mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => { console.error(err); process.exit(1); });
}

module.exports = connectDB;
