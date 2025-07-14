cd  /home/ubuntu/horse-door-Fe/client
npm install
npm run build

cd /home/ubuntu/horse-door-Fe/server
npm install
pm2 restart horse-door-server || pm2 start src/server.js --name horse-door-server

