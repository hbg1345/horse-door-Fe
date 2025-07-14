// dontenv + 공통환경변수 가공
// .env 파일 : 소스코드와 분리된 순수 환경 변수 저장소
// env.js : 애플리케이션에서 반복적으로 쓰는 변수를 한곳에서 require만 하면 되게끔 묶음

require('dotenv').config();
module.exports = {
  PORT:            process.env.PORT || 8080,
  MONGODB_URI:     process.env.MONGODB_URI,
  SESSION_SECRET:  process.env.SESSION_SECRET,
  KAKAO_CLIENT_ID: process.env.KAKAO_CLIENT_ID,
  KAKAO_CALLBACK_URL: process.env.KAKAO_CALLBACK_URL,
  CLIENT_URL:      process.env.CLIENT_URL,
  NODE_ENV:        process.env.NODE_ENV,
};
