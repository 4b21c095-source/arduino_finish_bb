// ===== 🔌 Socket.IO 連線設定 =====
const socket = io(); 

socket.on('connect', () => {
    console.log('✅ 泡泡節奏遊戲已成功連接 Node.js 伺服器！');
});

// ===== 🟢 核心監聽：接收 1301 板傳來的拍手節奏訊號 =====
socket.on('arduino-tempo-clap', (data) => {
    let msg = data.trim();
    console.log("📥 泡泡遊戲收到硬體訊號:", msg); 

    // 💡 智慧判斷：只要 Arduino 印出的字串包含 "CLAP"、"clap"、"1" 或 "true"
    if (msg.includes("CLAP") || msg.includes("clap") || msg === "1" || msg === "true") {
        // 只有在遊戲進行中，收到訊號才擊破泡泡
        if (isGameActive) { 
            triggerVisualPulse(); 
            playPopSound();       
            popBubble(); // 核心：消除泡泡
        }
    }
});

// ===== 🎮 遊戲變數與狀態控制 =====
let isGameActive = false;
let score = 0;
let bubbles = []; // 存放畫面上現存泡泡的陣列
let gameInterval = null;
let bgBubbleInterval = null;
let canvas, canvasCtx;
let waveHeight = 0;

// 音訊上下文
let audioCtx = null;

// ===== 🏁 網頁載入初始化 =====
window.onload = () => {
    // 一開始先把結束彈出視窗隱藏
    const modal = document.getElementById("modal");
    if (modal) modal.style.display = "none";
    
    // 初始化底部發光音頻圖
    initVisualizer();
};

// ===== 🫧 消除泡泡的核心邏輯 =====
function popBubble() {
    if (bubbles.length === 0) return;
    
    // 取出最舊的那顆泡泡
    let bubble = bubbles.shift(); 
    if (!bubble) return;
    
    // 播放爆炸動畫與加分
    bubble.classList.add("pop");
    score += 100;
    
    const scoreEl = document.getElementById("scoreText");
    if (scoreEl) {
        scoreEl.innerText = score;
    } else {
        const volText = document.getElementById("volumeText");
        if (volText) volText.innerText = score;
    }

    // 動態將泡泡從網頁畫面上移除
    setTimeout(() => {
        bubble.remove();
    }, 150);
}

// ===== 📊 底部音頻視覺化波動圖 =====
function initVisualizer() {
    canvas = document.getElementById("tempoVisualizer");
    if (!canvas) canvas = document.getElementById("micVisualizer"); // 自動相容不同的畫布 ID
    if (!canvas) return;
    
    canvasCtx = canvas.getContext("2d");
    drawVisualizer();
}

function triggerVisualPulse() {
    if (!canvas) return;
    waveHeight = canvas.height - 15;
}

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!canvasCtx || !canvas) return;
    
    canvasCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    let midY = canvas.height / 2;
    let barWidth = 3;   
    let barGap = 2;     
    let totalBars = Math.floor(canvas.width / (barWidth + barGap));
    let activeColor = "#FFBF99";

    for (let i = 0; i < totalBars; i++) {
        let x = i * (barWidth + barGap);
        let progress = i / totalBars;
        let edgeFade = Math.sin(progress * Math.PI); 
        let barHeight = Math.abs(Math.sin(i * 0.5 + Date.now() * 0.005)) * waveHeight * edgeFade;
        
        if (waveHeight < 5) {
            barHeight = 2 + Math.abs(Math.sin(i * 0.3 + Date.now() * 0.008)) * 4 * edgeFade;
        }
        canvasCtx.fillStyle = activeColor;
        canvasCtx.fillRect(x, midY - barHeight / 2, barWidth, barHeight);
    }
    waveHeight *= 0.85; 
}

// ===== 🎵 泡泡破裂電子音效 =====
function playPopSound() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(850, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(180, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
}

// ===== ⏱️ 遊戲開始與計時器邏輯 =====
function startGame() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    
    score = 0;
    const scoreEl = document.getElementById("scoreText");
    if (scoreEl) scoreEl.innerText = "0";
    
    const volText = document.getElementById("volumeText");
    if (volText) volText.innerText = "0";

    isGameActive = true;
    bubbles = [];
    
    // 🟢 核心修正 1：點擊開始後，強制將整個頂部控制區/按鈕與畫面文字徹底隱藏
    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
        startBtn.style.display = "none"; // 💡 按鈕直接隱藏消失！
    }

    const topDashboard = document.querySelector(".top-dashboard");
    if (topDashboard) {
        topDashboard.style.display = "none"; // 💡 如果你有包頂部區塊，整條一起消失！
    }

    const titleGroup = document.querySelector(".title-group");
    if (titleGroup) {
        titleGroup.style.display = "none"; // 💡 隱藏標題組
    }

    // 保險起見，若有獨立標題也一併抹除
    const mainTitle = document.querySelector("h1");
    if (mainTitle) mainTitle.style.display = "none";
    
    const subTitle = document.querySelector(".sub");
    if (subTitle) subTitle.style.display = "none";

    const modal = document.getElementById("modal");
    if (modal) modal.style.display = "none";
    
    // 清空遊玩區域內的舊泡泡
    const gameArea = document.getElementById("gameArea");
    if (gameArea) {
        const existing = gameArea.querySelectorAll(".bubble");
        existing.forEach(b => b.remove());
    }

    // 自動生成泡泡的循環計時器 (每 1.5 秒自動長出一顆新泡泡)
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(spawnBubble, 1500);
}

function spawnBubble() {
    if (!isGameActive) return;
    const gameArea = document.getElementById("gameArea");
    if (!gameArea) return;

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");
    
    // 隨機在遊玩範圍內決定位置
    let posX = Math.random() * (gameArea.clientWidth - 80) + 40;
    let posY = Math.random() * (gameArea.clientHeight - 80) + 40;
    bubble.style.left = posX + "px";
    bubble.style.top = posY + "px";

    gameArea.appendChild(bubble);
    bubbles.push(bubble); // 塞入陣列追蹤
}

// 確保 DOM 元素安全載入後才綁定點擊事件
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.addEventListener("click", startGame);

    // 強制拉高「返回鍵 (BACK)」的圖層，確保它不會被遊戲背景或 Canvas 蓋住
    const backBtn = document.querySelector(".btn01");
    if (backBtn) {
        backBtn.style.position = "fixed";
        backBtn.style.zIndex = "9999"; // 置頂圖層
    }
});

// ===== ⌨️ 鍵盤測試模擬 =====
window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        if (isGameActive) {
            triggerVisualPulse();
            playPopSound();
            popBubble();
        }
    }
});