const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path'); // 🟢 新增：引入 path 模組處理絕對路徑

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 指定前端靜態資料夾
app.use(express.static('public'));

// ============================================================
// 🟢 核心修正：新增首頁路由監聽
// 當瀏覽器輸入 http://localhost:3000 時，強制精準載入 public 裡的 index.html
// ============================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ex1.html'));
});

// ============================================================
// 🔌 Arduino 板 1 (/dev/cu.usbmodem1301) 
// ➔ 🟢 專職：拍手/節奏泡泡遊戲 (專屬 B 頻道)
// ============================================================
const arduinoPort1 = new SerialPort({
  path: '/dev/cu.usbmodem1301', 
  baudRate: 9600,
  autoOpen: false
});
const parser1 = arduinoPort1.pipe(new ReadlineParser({ delimiter: '\r\n' }));

arduinoPort1.on('error', (err) => {
  console.log(`❌ [板 1301 錯誤]: ${err.message}`);
});

parser1.on('data', (data) => {
  let msg = data.trim();
  if (!msg) return;

  // 🚙 正確歸位：1301 傳來的是拍手/CLAP 訊號，導流給泡泡節奏遊戲
  console.log(`🎵 [板 1301 ➔ 節奏泡泡遊戲] 訊號: ${msg}`);
  io.emit('arduino-tempo-clap', msg); // 傳送給 clap02.js
});

// ============================================================
// 🔌 Arduino 板 2 (/dev/cu.usbmodem1201)
// ➔ 🟢 專職：大喊吹氣球遊戲 (專屬 A 頻道)
// ============================================================
const arduinoPort2 = new SerialPort({
  path: '/dev/cu.usbmodem1201', 
  baudRate: 9600,
  autoOpen: false
});
const parser2 = arduinoPort2.pipe(new ReadlineParser({ delimiter: '\r\n' }));

arduinoPort2.on('error', (err) => {
  console.log(`❌ [板 1201 錯誤]: ${err.message}`);
});

parser2.on('data', (data) => {
  let msg = data.trim();
  if (!msg) return;

  // 🚗 正確歸位：1201 傳來的是大喊音量，提取數字後導流給吹氣球遊戲
  let arduinoNum = parseInt(msg.replace(/[^0-9]/g, ''), 10);
  if (!isNaN(arduinoNum)) {
    console.log(`🎈 [板 1201 ➔ 大喊吹氣球] 解析音量數字: ${arduinoNum}`);
    io.emit('arduino-shout-volume', arduinoNum); // 傳送給 clap01.js
  }
});

// ============================================================
// 🛡️ 安全延時開啟機制 (確保 Mac 的 SerialPort 不會撞車)
// ============================================================
setTimeout(() => {
  arduinoPort1.open((err) => {
    if (err) console.log('❌ 板 1301 開啟失敗:', err.message);
    else console.log('✅ [板 1301 成功連線] ➔ 拍手節奏就緒 (/dev/cu.usbmodem1301)');
  });
}, 500);

setTimeout(() => {
  arduinoPort2.open((err) => {
    if (err) console.log('❌ 板 1201 開啟失敗:', err.message);
    else console.log('✅ [板 1201 成功連線] ➔ 大喊音量就緒 (/dev/cu.usbmodem1201)');
  });
}, 1200);

// ============================================================
// 🌐 Socket.IO 連線監聽
// ============================================================
io.on('connection', (socket) => {
  console.log(`🤝 有新遊戲網頁加入連線！ (ID: ${socket.id})`);
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 雙硬體「角色歸位版」伺服器已啟動：http://localhost:${PORT}\n`);
});