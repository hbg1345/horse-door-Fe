#!/bin/bash
# 프론트엔드 빌드
cd /github/horse-door-Fe/client
npm install
npm run build

# 백엔드 의존성 설치 및 서버 재시작
cd /github/horse-door-Fe/server
npm install
pm2 restart horse-door-server || pm2 start src/server.js --name horse-door-server 