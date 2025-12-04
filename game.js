// --------- Telegram init ----------
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.expand && tg.expand();
  tg.ready();
}

// --------- Canvas & контекст ----------
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Логика масштабирования: canvas фиксированный, но по CSS растягивается.
// Тап по экрану = прыжок, поэтому координаты нам особо не нужны.

// --------- DOM ----------
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const btnStart = document.getElementById("btnStart");
const btnRestart = document.getElementById("btnRestart");
const btnContinueAd = document.getElementById("btnContinueAd");
const btnRewardMenu = document.getElementById("btnRewardMenu");
const scoreEl = document.getElementById("score");
const finalScoreEl = document.getElementById("finalScore");
const bestScoreEl = document.getElementById("bestScore");
const coinsEl = document.getElementById("coins");

// --------- Игровые переменные ----------
const W = canvas.width;
const H = canvas.height;

let gameState = "menu"; // menu | playing | dead | continuing
let bird;
let pipes = [];
let score = 0;
let bestScore = 0;
let coins = 0;

const groundHeight = 90;
const pipeGap = 260;
const pipeWidth = 70;
const pipeSpeedBase = 2.5;
let pipeTimer = 0;
const pipeInterval = 1600; // мс

let lastTimestamp = 0;
let timeSinceLastInterstitial = 0; // мс

// --------- Ассеты (если картинок нет – рисуем простыми фигурами) ----------
const images = {};
const assetsToLoad = [
  ["bg", "assets/bg.png"],
  ["ground", "assets/ground.png"],
  ["bird", "assets/bird.png"],
  ["pipeTop", "assets/pipe-top.png"],
  ["pipeBottom", "assets/pipe-bottom.png"]
];

let assetsLoaded = 0;
assetsToLoad.forEach(([key, src]) => {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    assetsLoaded++;
  };
  img.onerror = () => {
    console.warn("Не удалось загрузить", src, "– будет использована заливка.");
    assetsLoaded++;
  };
  images[key] = img;
});

// --------- Звук: простые WebAudio-эффекты ----------
let audioCtx = null;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn("AudioContext не поддерживается");
  }
}

function playBeep(freq = 600, duration = 120, type = "square", volume = 0.15) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  osc.start(now);
  osc.stop(now + duration / 1000);
}

// --------- CloudStorage (если доступен) ----------
function loadProgress() {
  if (!tg || !tg.CloudStorage || !tg.CloudStorage.getItems) {
    updateWalletUI();
    return;
  }
  tg.CloudStorage.getItems(["mb_coins", "mb_best"], (err, items) => {
    if (!err && items) {
      if (items.mb_coins) coins = parseInt(items.mb_coins, 10) || 0;
      if (items.mb_best) bestScore = parseInt(items.mb_best, 10) || 0;
    }
    updateWalletUI();
  });
}

function saveProgress() {
  if (!tg || !tg.CloudStorage || !tg.CloudStorage.setItem) return;
  tg.CloudStorage.setItem("mb_coins", String(coins), () => {});
  tg.CloudStorage.setItem("mb_best", String(bestScore), () => {});
}

// --------- Реклама ----------
function showAd(type, cb) {
  if (!tg || typeof tg.showAd !== "function") {
    console.log("Реклама недоступна в этом клиенте");
    cb && cb(false);
    return;
  }
  try {
    tg.showAd(type, {}, (res) => {
      console.log("Ad result:", res);
      // API может меняться, поэтому просто считаем, что если ошибки нет – ок
      const ok = !res || res === "shown" || res.result === "shown" || res.ad_shown;
      cb && cb(!!ok);
    });
  } catch (e) {
    console.log("Ad error:", e);
    cb && cb(false);
  }
}

function showReward(cb) {
  showAd("reward", (ok) => cb && cb(ok));
}

function showInterstitial(cb) {
  showAd("interstitial", (ok) => cb && cb(ok));
}

// --------- Игровые сущности ----------
function resetBird() {
  bird = {
    x: W * 0.28,
    y: H * 0.5,
    vy: 0,
    r: 18
  };
}

function addPipe() {
  const minY = 40;
  const maxY = H - groundHeight - pipeGap - 40;
  const top = minY + Math.random() * (maxY - minY);

  pipes.push({
    x: W + pipeWidth,
    top,
    gap: pipeGap,
    counted: false
  });
}

function resetGameState(fullReset = true) {
  resetBird();
  pipes = [];
  pipeTimer = 0;
  score = fullReset ? 0 : score; // при продолжении за рекламу счёт сохраняем
}

function startGame() {
  gameState = "playing";
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  resetGameState(true);
  lastTimestamp = performance.now();
  timeSinceLastInterstitial = 0;
  loop(lastTimestamp);
}

function continueGameAfterAd() {
  gameState = "playing";
  gameOverScreen.classList.remove("visible");
  resetGameState(false); // счёт оставляем
  lastTimestamp = performance.now();
  loop(lastTimestamp);
}

function onGameOver() {
  playBeep(200, 200, "sawtooth", 0.18);
  gameState = "dead";
  finalScoreEl.textContent = score;

  if (score > bestScore) {
    bestScore = score;
    saveProgress();
  }
  bestScoreEl.textContent = bestScore;
  updateWalletUI();

  gameOverScreen.classList.add("visible");
}

// --------- Отрисовка ----------
function drawBackground() {
  if (images.bg && images.bg.complete) {
    ctx.drawImage(images.bg, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#1d4ed8");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawGround() {
  const y = H - groundHeight;
  if (images.ground && images.ground.complete) {
    ctx.drawImage(images.ground, 0, y, W, groundHeight);
  } else {
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, y, W, groundHeight);
  }
}

function drawBird() {
  if (images.bird && images.bird.complete) {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    const angle = Math.max(-0.5, Math.min(0.7, bird.vy * 0.04));
    ctx.rotate(angle);
    const size = bird.r * 2.2;
    ctx.drawImage(images.bird, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPipes() {
  pipes.forEach((p) => {
    const topBottom = p.top;
    const bottomTop = p.top + p.gap;

    if (images.pipeTop && images.pipeTop.complete) {
      ctx.drawImage(images.pipeTop, p.x, topBottom - 400, pipeWidth, 400);
    } else {
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(p.x, 0, pipeWidth, topBottom);
    }

    if (images.pipeBottom && images.pipeBottom.complete) {
      ctx.drawImage(images.pipeBottom, p.x, bottomTop, pipeWidth, 400);
    } else {
      ctx.fillStyle = "#16a34a";
      ctx.fillRect(p.x, bottomTop, pipeWidth, H - bottomTop - groundHeight);
    }
  });
}

// --------- Игровой цикл ----------
function loop(timestamp) {
  if (gameState !== "playing") return;

  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  timeSinceLastInterstitial += dt;

  // движение птицы
  const gravity = 0.35;
  bird.vy += gravity;
  bird.y += bird.vy;

  // границы
  if (bird.y + bird.r > H - groundHeight || bird.y - bird.r < 0) {
    return onGameOver();
  }

  // трубы
  pipeTimer += dt;
  if (pipeTimer >= pipeInterval) {
    pipeTimer = 0;
    addPipe();
  }

  const pipeSpeed = pipeSpeedBase + Math.min(3, score * 0.07);

  pipes.forEach((p) => {
    p.x -= pipeSpeed;
    // подсчёт очка
    if (!p.counted && p.x + pipeWidth < bird.x) {
      p.counted = true;
      score++;
      playBeep(900, 80, "square", 0.14);
    }
  });

  // убрать ушедшие трубы
  pipes = pipes.filter((p) => p.x + pipeWidth > -20);

  // столкновения
  for (const p of pipes) {
    if (
      bird.x + bird.r > p.x &&
      bird.x - bird.r < p.x + pipeWidth &&
      (bird.y - bird.r < p.top || bird.y + bird.r > p.top + p.gap)
    ) {
      return onGameOver();
    }
  }

  // interstitial по таймеру: раз в 3 минуты при окончании раунда
  if (gameState === "dead" && timeSinceLastInterstitial > 180000) {
    timeSinceLastInterstitial = 0;
    showInterstitial(() => {});
  }

  // отрисовка
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawPipes();
  drawGround();
  drawBird();

  scoreEl.textContent = score;

  requestAnimationFrame(loop);
}

// --------- Управление ----------
function flap() {
  if (gameState !== "playing") return;
  initAudio();
  bird.vy = -6.7;
  playBeep(700, 90, "square", 0.12);
}

canvas.addEventListener("click", flap);
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  flap();
});

// --------- UI-логика ----------
function updateWalletUI() {
  coinsEl.textContent = `★ ${coins}`;
}

// кнопка "Играть" (с нуля)
btnStart.addEventListener("click", () => {
  initAudio();
  startGame();
});

// кнопка "Играть снова"
btnRestart.addEventListener("click", () => {
  initAudio();
  startGame();
});

// кнопка "Продолжить за рекламу"
btnContinueAd.addEventListener("click", () => {
  initAudio();
  btnContinueAd.disabled = true;
  showReward((ok) => {
    btnContinueAd.disabled = false;
    if (ok) {
      // даём бонус монет + продолжаем
      coins += 5;
      saveProgress();
      updateWalletUI();
      continueGameAfterAd();
    } else {
      // если рекламы нет – просто показываем сообщение
      if (tg && tg.showPopup) {
        tg.showPopup({
          title: "Реклама недоступна",
          message: "Попробуй позже или просто начни новую игру.",
          buttons: [{ id: "ok", type: "default", text: "Ок" }]
        });
      }
    }
  });
});

// кнопка "Посмотреть рекламу в меню"
btnRewardMenu.addEventListener("click", () => {
  initAudio();
  btnRewardMenu.disabled = true;
  showReward((ok) => {
    btnRewardMenu.disabled = false;
    if (ok) {
      coins += 10;
      saveProgress();
      updateWalletUI();
      if (tg && tg.showPopup) {
        tg.showPopup({
          title: "Награда получена",
          message: "Ты получил 10 монет! В будущем за них купим скины и бусты.",
          buttons: [{ id: "ok", type: "default", text: "Круто" }]
        });
      }
    } else if (tg && tg.showPopup) {
      tg.showPopup({
        title: "Реклама недоступна",
        message: "Сейчас нельзя показать видео. Попробуй через пару минут.",
        buttons: [{ id: "ok", type: "default", text: "Ок" }]
      });
    }
  });
});

// --------- Старт ---------
resetBird();
loadProgress();
drawBackground();
drawGround();
drawBird();
scoreEl.textContent = "0";
