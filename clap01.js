// ===== 🔌 Socket.IO 連線設定 =====
const socket = io(); 

socket.on('connect', () => {
    console.log('✅ 大喊遊戲前端已成功連接 Node.js 雙核心伺服器！');
});

// ===== 狀態控制 =====
let isDetecting = false;
let physicsInterval = null;   
let bgBalloonInterval = null;  

// ===== 📊 即時數值控制 =====
let currentArduValue = 600; 

// ===== 🎈 氣球控制與畫布變數 =====
let activeGameBalloon = null;   
let canvas, canvasCtx;
let waveHeight = 0;   

window.onload = () => { 
    document.getElementById("modal").style.display = "none";
    initVisualizer(); 
};

// 🤖 核心修復：監聽 1201 板發出的全新專屬頻道，並讓未開始前也能預覽數值
socket.on('arduino-shout-volume', (arduinoNum) => {
    // 1. 不管有沒有開始遊戲，都要先更新畫面的數據顯示！
    currentArduValue = arduinoNum;
    const textEl = document.getElementById("volumeText");
    if (textEl) {
        textEl.innerText = arduinoNum;
    }

    // 2. 只有在點擊「開始偵測」後，才去觸發特效與爆炸判斷
    if (isDetecting) {
        if (arduinoNum > 600) {
            triggerVisualPulse();
        }

        // 數值達 1000 以上直接秒殺爆破
        if (currentArduValue >= 1000) {
            instantPopBalloon();
        }
    }
});

// ===== 📊 Barcode 密集音頻圖繪製 =====
function initVisualizer() {
    canvas = document.getElementById("micVisualizer");
    if (!canvas) return;
    canvasCtx = canvas.getContext("2d");
    drawVisualizer();
    startBgBalloons(); 
}

function triggerVisualPulse() {
    if (!canvas) return;
    waveHeight = canvas.height - 12; 
}

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!canvasCtx || !canvas) return;
    
    canvasCtx.fillStyle = "rgba(255, 255, 255, 0.3)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    let midY = canvas.height / 2;
    let barWidth = 2;   
    let barGap = 2;     
    let totalBars = Math.floor(canvas.width / (barWidth + barGap));
    
    let activeColor = waveHeight > 20 ? "#FFBF99" : "#A6DAFA";

    for (let i = 0; i < totalBars; i++) {
        let x = i * (barWidth + barGap);
        let progress = i / totalBars;
        let angle = progress * Math.PI * 4; 
        let edgeFade = Math.sin(progress * Math.PI); 
        
        let baseNoise = (Math.random() * 0.4 + 0.6);
        let barHeight = Math.abs(Math.sin(angle + Date.now() * 0.005)) * waveHeight * edgeFade * baseNoise;
        
        if (waveHeight < 4) {
            barHeight = 2 + Math.abs(Math.sin(i * 0.3 + Date.now() * 0.008)) * 6 * edgeFade;
        }

        canvasCtx.fillStyle = activeColor;
        canvasCtx.fillRect(x, midY - barHeight / 2, barWidth, barHeight);
    }
    
    waveHeight *= 0.86; 
}

// ===== ⚙️ 物理膨脹循環 =====
function updateBalloonPhysics() {
    if (!isDetecting || !activeGameBalloon) return;

    if (currentArduValue >= 800) {
        let growthSpeed = 0.012 + ((currentArduValue - 800) * 0.00008);
        activeGameBalloon.gameScale += growthSpeed; 
        
        // 核心：鎖定螢幕中心縮放
        activeGameBalloon.style.transform = `translate(-50%, -50%) scale(${activeGameBalloon.gameScale}) rotate(${activeGameBalloon.gameRotate}deg)`;

        if (activeGameBalloon.gameScale >= 2.5) {
            popAndExplodeBalloon(currentArduValue); 
        }
    }
}

function instantPopBalloon() {
    if (!activeGameBalloon) return;
    
    activeGameBalloon.gameScale = 2.7; 
    activeGameBalloon.style.transform = `translate(-50%, -50%) scale(${activeGameBalloon.gameScale}) rotate(${activeGameBalloon.gameRotate}deg)`;
    
    popAndExplodeBalloon(1000);
}

// 💥 氣球爆炸
function popAndExplodeBalloon(finalScore) {
    if (!activeGameBalloon) return;

    let target = activeGameBalloon;
    activeGameBalloon = null; 

    target.classList.add("pop");
    playPopSound();

    isDetecting = false; 
    clearInterval(physicsInterval);

    setTimeout(() => {
        target.remove();
        document.getElementById("resultVolume").innerText = "爆炸瞬間振幅: " + finalScore;
        document.getElementById("modal").style.display = "block";
    }, 180);
}

// 🎈 在畫面中心生成大比例氣球
function spawnNewGameBalloon() {
    const oldBalloon = document.querySelector(".balloon");
    if (oldBalloon) oldBalloon.remove();

    const gameArea = document.getElementById("gameArea");
    const balloon = document.createElement("div");
    balloon.classList.add("balloon");

    const face = document.createElement("div");
    face.classList.add("balloon-face");
    face.innerText = "•ᴗ•";
    balloon.appendChild(face);

    balloon.gameScale = 0.35;
    balloon.gameRotate = Math.floor(Math.random() * 8) - 4; 
    balloon.style.transform = `translate(-50%, -50%) scale(${balloon.gameScale}) rotate(${balloon.gameRotate}deg)`;

    gameArea.appendChild(balloon);
    activeGameBalloon = balloon;
}

// ===== 🎵 破裂聲效 =====
let audioCtx = null;
function playPopSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(280, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch(e) {}
}

// ===== 🫧 背景小氣球裝飾 =====
function startBgBalloons() {
    const bgArea = document.getElementById("bgBalloonArea");
    if (!bgArea) return;
    const palette = [
        { border: "#A6DAFA", inner: "rgba(235, 246, 252, 0.35)", shadow: "rgba(166, 218, 250, 0.2)" }, 
        { border: "#FFBF99", inner: "rgba(255, 245, 238, 0.35)", shadow: "rgba(255, 191, 153, 0.2)" }
    ];
    bgBalloonInterval = setInterval(() => {
        const bgBalloon = document.createElement("div");
        bgBalloon.classList.add("bg-balloon");
        const sizeWidth = Math.random() * 20 + 15; 
        const posX = Math.random() * window.innerWidth;
        const duration = Math.random() * 4 + 5; 
        const colorSet = palette[Math.floor(Math.random() * palette.length)];
        
        bgBalloon.style.width = sizeWidth + "px";
        bgBalloon.style.height = (sizeWidth * 1.2) + "px"; 
        bgBalloon.style.left = posX + "px";
        bgBalloon.style.animationDuration = duration + "s";
        bgBalloon.style.border = `2px solid ${colorSet.border}`;
        bgBalloon.style.background = colorSet.inner;
        bgBalloon.style.boxShadow = `inset 0 0 6px ${colorSet.shadow}`;
        bgArea.appendChild(bgBalloon);
        setTimeout(() => { if (bgBalloon.parentNode) bgBalloon.remove(); }, duration * 1000);
    }, 550);
}

// ===== ▶️ 啟動偵測 =====
function start() {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    currentArduValue = 600;
    document.getElementById("volumeText").innerText = "600";
    document.getElementById("modal").style.display = "none";

    isDetecting = true;
    spawnNewGameBalloon();

    if (physicsInterval) clearInterval(physicsInterval);
    physicsInterval = setInterval(updateBalloonPhysics, 20);

    document.getElementById("startBtn").innerText = "偵測中...";
    document.getElementById("startBtn").disabled = true; 
}

// 確保 DOM 載入後綁定事件
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startBtn");
    if (startBtn) startBtn.addEventListener("click", start);

    const closeModal = document.getElementById("closeModal");
    if (closeModal) {
        closeModal.addEventListener("click", () => {
            document.getElementById("modal").style.display = "none";
            document.getElementById("startBtn").innerText = "開始偵測";
            document.getElementById("startBtn").disabled = false;
            currentArduValue = 600;
            document.getElementById("volumeText").innerText = "600";
        });
    }
});

// ===== ⌨️ 鍵盤快捷鍵測試 =====
window.addEventListener('keydown', (event) => {
    if (!isDetecting) return;
    if (event.code === 'Space') {
        currentArduValue = 850; 
        document.getElementById("volumeText").innerText = "850";
        triggerVisualPulse();
    }
    if (event.code === 'Enter') {
        currentArduValue = 1000; 
        document.getElementById("volumeText").innerText = "1000";
        instantPopBalloon();
    }
});
window.addEventListener('keyup', (event) => {
    if (event.code === 'Space' && isDetecting) {
        currentArduValue = 600; 
        document.getElementById("volumeText").innerText = "600";
    }
});