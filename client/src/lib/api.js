import axios from 'axios';

// VITE_API_URL 은 배포 시 "https://api.myapp.com" 처럼 주입합니다.
// dev 모드(5173)에서는 ''(동일 origin) + vite 프록시가 자동 적용.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true, // 세션 쿠키 전송
});

export default api;