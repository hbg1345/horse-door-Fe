import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 프론트 5173 → 백엔드 8080
      '/api':  'http://localhost:8080',
      '/auth': 'http://localhost:8080',
    },
  },
});

// dev모드에서 /api/*, /auth/* 요청이 자동으로 8080으로 전달
// 배포 시 api.mydomain.com처럼 실제 api 주소를 .env(Vite는 VITE_ preifix 필요)로 주입