// ==========================================
// 🔧 1. 設定區
// ==========================================
const ESP_IP = "172.20.10.3";  // ← 💡 你的 ESP32 實際 IP

const MODEL_DIR = "./model/";
let model, labels = [], imageSize = 224;
let running = false, rafId = null;

// AI 辨識觸發 `showResult` 的信心度門檻 (0.85 = 85%)
const TRIGGER_THRESHOLD = 0.85;

// none 這個 class 完全隱藏
const HIDE_LABELS = new Set(["none"]);
const isHidden = (name = "") => HIDE_LABELS.has(String(name).trim().toLowerCase());

// Softmax 參數
const TEMP = 0.1; 
const FLOOR = 0.05; 

// HTML 元素物件
const els = {
  canvas: document.getElementById("webcam-canvas"),
  status: document.getElementById("status"),
  modelName: document.getElementById("modelName"),
  hzText: document.getElementById("hzText"),
  resultImage: document.getElementById("resultImage"),
  soundButtonsBox: document.querySelector(".sound-buttons")
};

// ==========================================
// 📊 2. Hz 資料與聲音控制
// ==========================================
let currentAudio = null;

const hzData = {
  "250hz": {
    text: "250 Hz (低頻)",
    img: "hz01.png",
    buttons: [
      { name: "母音 oo", sound: "oo.wav" },
      { name: "低音號", sound: "tuba.wav" },
      { name: "雷聲", sound: "thunder.wav" },
      { name: "狗低吠", sound: "dog.wav" },
      { name: "冰箱", sound: "fridge.wav" }
    ]
  },
  "500hz": {
    text: "500 Hz (中低頻)",
    img: "hz02.png",
    buttons: [
      { name: "母音 a", sound: "a.wav" },
      { name: "大鼓", sound: "drum.wav" },
      { name: "貓叫", sound: "cat.wav" },
      { name: "汽車", sound: "car.wav" },
      { name: "敲門", sound: "knock.wav" }
    ]
  },
  "1000hz": {
    text: "1000 Hz (中頻)",
    img: "hz03.png",
    buttons: [
      { name: "m/n", sound: "mn.wav" },
      { name: "電話", sound: "phone.wav" },
      { name: "割草機", sound: "grass.wav" },
      { name: "鳥叫", sound: "bird.wav" },
      { name: "微波爐", sound: "microwave.wav" }
    ]
  },
  "2000hz": {
    text: "2000 Hz (中高頻)",
    img: "hz04.png",
    buttons: [
      { name: "sh/ch", sound: "sh.wav" },
      { name: "嬰兒", sound: "baby.wav" },
      { name: "小提琴", sound: "violin.wav" },
      { name: "鬧鐘", sound: "alarm.wav" },
      { name: "吹風機", sound: "dryer.wav" }
    ]
  },
  "3000hz": {
    text: "3000 Hz",
    img: "hz05.png",
    buttons: [
      { name: "蟬", sound: "cicada.wav" },
      { name: "警車", sound: "police.wav" },
      { name: "水壺", sound: "kettle.wav" },
      { name: "玻璃", sound: "glass.wav" },
      { name: "高頻聲", sound: "high.wav" }
    ]
  },
  "4000hz": {
    text: "4000 Hz",
    img: "hz06.png",
    buttons: [
      { name: "s/f", sound: "sf.wav" },
      { name: "小鳥", sound: "bird2.wav" },
      { name: "蚊子", sound: "mosquito.wav" },
      { name: "哨子", sound: "whistle.wav" },
      { name: "風聲", sound: "wind.wav" }
    ]
  },
  "8000hz": {
    text: "8000 Hz",
    img: "hz07.png",
    buttons: [
      { name: "th", sound: "th.wav" },
      { name: "鍵盤", sound: "keyboard.wav" },
      { name: "魔鬼氈", sound: "velcro.wav" },
      { name: "塑膠袋", sound: "plastic.wav" },
      { name: "細聲", sound: "tiny.wav" }
    ]
  }
};

// ==========================================
// 🎯 3. 顯示結果邏輯
// ==========================================
let lastTriggeredClass = null; 

function showResult(className) {
  if (className === lastTriggeredClass) return;
  
  const data = hzData[className];
  if (!data) return; 
  
  console.log(`🎯 AI 辨識成功，更新 Hz 結果：${className}`);
  lastTriggeredClass = className;

  if (els.hzText) {
    els.hzText.innerText = data.text;
    els.hzText.className = ""; 
    els.hzText.classList.add("hz-" + className);
  }

  if (els.resultImage) {
    els.resultImage.src = "images/" + data.img;
    els.resultImage.style.display = "block";
  }

  if (els.soundButtonsBox) {
    els.soundButtonsBox.innerHTML = "";
    data.buttons.forEach(item => {
      const btn = document.createElement("button");
      btn.innerText = item.name;
      btn.onclick = () => {
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        currentAudio = new Audio("sound/" + item.sound);
        currentAudio.play();
      };
      els.soundButtonsBox.appendChild(btn);
    });
  }
}

// ==========================================
// 🧠 4. AI 模型辨識與 ESP32 核心邏輯
// ==========================================

if (!(window.tf && typeof tf.ready === "function")) {
  alert("TensorFlow.js 未成功載入，請檢查網路連線。");
  throw new Error("tf not loaded");
}

const setStatus = (t) => { if (els.status) els.status.textContent = t; };

// ---- MJPEG 串流畫面 ----
const streamImg = new Image();
streamImg.crossOrigin = "anonymous";
streamImg.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:12px;";
streamImg.src = `http://${ESP_IP}/stream`;

const cameraEl = document.getElementById("camera");
if (cameraEl) {
  cameraEl.parentNode.replaceChild(streamImg, cameraEl);
}

// ---- 從串流 img 畫到隱藏 canvas ----
function fetchFrame() {
  return new Promise((resolve) => {
    try {
      if (streamImg.naturalWidth > 0 && els.canvas) {
        els.canvas.width = streamImg.naturalWidth;
        els.canvas.height = streamImg.naturalHeight;
        els.canvas.getContext("2d").drawImage(streamImg, 0, 0);
      }
    } catch (e) {}
    resolve();
  });
}

// ---- 自動載入模型 ----
async function autoLoadAndStart() {
  const base = MODEL_DIR.endsWith("/") ? MODEL_DIR : MODEL_DIR + "/";
  try {
    setStatus("檢查模型檔案…");
    const [mRes, metaRes] = await Promise.all([
      fetch(base + "model.json"),
      fetch(base + "metadata.json"),
    ]);
    if (!mRes.ok) throw new Error(`找不到 model.json`);
    if (!metaRes.ok) throw new Error(`找不到 metadata.json`);

    const metadata = await metaRes.json();
    labels = metadata.labels || metadata.label || [];
    imageSize = Number(metadata.imageSize || 224);

    setStatus("模型載入中…");
    model = await tf.loadLayersModel(base + "model.json");

    setStatus("模型載入成功，啟動辨識...");
    
    // 💡 載入完畢，直接自動開啟推論循環！
    running = true;
    loop();
  } catch (err) {
    console.error("[Load Error]", err);
    setStatus("⚠️ 模型自動載入失敗，請確認資料夾路徑");
  }
}

// ==========================================
// 🔄 5. 主預測循環
// ==========================================
async function loop() {
  if (!running) return;

  await fetchFrame();

  try {
    if (!els.canvas || els.canvas.width === 0) {
      rafId = requestAnimationFrame(loop);
      return;
    }

    const logits = tf.tidy(() => {
      const input = tf.browser
        .fromPixels(els.canvas)
        .resizeBilinear([imageSize, imageSize], false)
        .toFloat()
        .div(255)
        .expandDims(0);
      return model.predict(input).dataSync();
    });

    const visibleIdx = labels
      .map((n, i) => (isHidden(n) ? -1 : i))
      .filter((i) => i >= 0);

    if (visibleIdx.length === 0) {
      setStatus("無可顯示類別");
      rafId = requestAnimationFrame(loop);
      return;
    }

    // none 門檻判斷
    const noneIdx = labels.findIndex(n => n.trim().toLowerCase() === "none");
    const noneProb = noneIdx >= 0 ? logits[noneIdx] : -Infinity;
    const bestRawLogit = Math.max(...visibleIdx.map(i => logits[i]));

    if (noneProb >= bestRawLogit) {
      setStatus("掃描中：未偵測到目標");
      setTimeout(() => {
        rafId = requestAnimationFrame(loop);
      }, 500); 
      return;
    }

    // Softmax
    let maxZ = -Infinity;
    for (const i of visibleIdx) {
      const z = logits[i] / TEMP;
      if (z > maxZ) maxZ = z;
    }
    const exps = visibleIdx.map(i => Math.exp(logits[i] / TEMP - maxZ));
    const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
    const visProbs = exps.map(v => v / sumExp);

    let bestK = 0;
    for (let k = 1; k < visProbs.length; k++) {
      if (visProbs[k] > visProbs[bestK]) bestK = k;
    }
    const bestIdx = visibleIdx[bestK]; 
    const bestPct = Math.round(visProbs[bestK] * 100);
    const bestClassName = labels[bestIdx]; 

    // 💡 關鍵修正點：判斷門檻並轉為小寫觸發
    if (visProbs[bestK] >= TRIGGER_THRESHOLD) {
      const lowerClassName = String(bestClassName).trim().toLowerCase();
      showResult(lowerClassName); 
    }

    // 更新頂部小狀態字樣
    setStatus(`掃描中：辨識為 ${labels[bestIdx]} (${bestPct}%)`);

  } catch (e) {
    console.error("[Predict Error]", e);
  }

  // 每 1.5 秒推論一次
  setTimeout(() => {
    rafId = requestAnimationFrame(loop);
  }, 1500);
}

// ==========================================
// 🟢 6. 初始化 (網頁一開直接觸發)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    autoLoadAndStart();
});