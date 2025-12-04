// ИНИЦИАЛИЗАЦИЯ TELEGRAM
const tg = window.Telegram ? window.Telegram.WebApp : null;
if (tg) {
  tg.ready();
}

// DOM
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const mainMenu = document.getElementById("mainMenu");
const gameOverMenu = document.getElementById("gameOver");
const playBtn = document.getElementById("playBtn");
const restartBtn = document.getElementById("restartBtn");
const adBtn = document.getElementById("adBtn");
const scoreBox = document.getElementById("scoreBox");
const finalScoreSpan = document.getElementById("finalScore");
const bestScoreSpan = document.getElementById("bestScore");
const logBox = document.getElementById("logBox");

// РАЗМЕР CANVAS
canvas.width = 360;
canvas.height = 600;

// ИГРОВАЯ ЛОГИКА
let bird;
let pipes;
let score;
let bestScore = Number(localStorage.getItem("membird_best") || 0);
let gameStarted = false;
let gravity = 0.45;
let jumpForce = -7;
let pipeSpeed = 2.8;
let frameId = null;

function resetGame() {
  bird = {
    x: 80,
    y: canvas.height / 2,
    w: 34,
    h: 34,
    dy: 0
  };
  pipes = [];
  score = 0;
  createPipe();
}

function createPipe() {
  const gap = 150;
  const topHeight = Math.random() * (canvas.height - gap - 130) + 40;
  pipes.push({
    x: canvas.width + 40,
    top: topHeight,
    bottom: topHeight + gap,
    passed: false
  });
}

function drawBackground() {
  // небо
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1d4ed8");
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // простые "облака"
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(80, 90, 40, 20, 0, 0, Math.PI * 2);
  ctx.ellipse(120, 80, 30, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(260, 130, 50, 22, 0, 0, Math.PI * 2);
  ctx.ellipse(300, 120, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBird() {
  // тело
  ctx.save();
  ctx.translate(bird.x + bird.w / 2, bird.y + bird.h / 2);
  ctx.rotate(Math.min(Math.max(bird.dy * 0.04, -0.6), 0.6));
  ctx.translate(-bird.w / 2, -bird.h / 2);

  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.ellipse(bird.w / 2, bird.h / 2, bird.w / 2, bird.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // крыло
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.ellipse(bird.w / 2, bird.h / 2 + 4, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // клюв
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(bird.w / 2 + 10, bird.h / 2);
  ctx.lineTo(bird.w / 2 + 20, bird.h / 2 - 3);
  ctx.lineTo(bird.w / 2 + 20, bird.h / 2 + 3);
  ctx.closePath();
  ctx.fill();

  // очки (мем)
  ctx.fillStyle = "#111827";
  ctx.fillRect(bird.w / 2 - 12, bird.h / 2 - 8, 10, 8);
  ctx.fillRect(bird.w / 2 + 2, bird.h / 2 - 8, 10, 8);
  ctx.fillRect(bird.w / 2 - 2, bird.h / 2 - 6, 4, 2);

  ctx.restore();
}

function drawPipes() {
  ctx.fillStyle = "#16a34a";
  pipes.forEach((p) => {
    // верхняя труба
    ctx.fillRect(p.x, 0, 60, p.top);
    // нижняя труба
    ctx.fillRect(p.x, p.bottom, 60, canvas.height - p.bottom);
  });
}

function updateScoreUI() {
  scoreBox.textContent = score;
}

function gameLoop() {
  frameId = requestAnimationFrame(gameLoop);

  bird.dy += gravity;
  bird.y += bird.dy;

  // фон
  drawBackground();

  // трубы
  pipes.forEach((p) => {
    p.x -= pipeSpeed;

    // столкновения
    if (
      bird.x < p.x + 60 &&
      bird.x + bird.w > p.x &&
      (bird.y < p.top || bird.y + bird.h > p.bottom)
    ) {
      return endGame();
    }

    // зачисляем очко
    if (!p.passed && p.x + 60 < bird.x) {
      p.passed = true;
      score++;
    }
  });

  // удаляем старые трубы
  pipes = pipes.filter((p) => p.x > -70);

  // добавляем новую
  if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - 200) {
    createPipe();
  }

  // границы экрана
  if (bird.y + bird.h > canvas.height || bird.y < 0) {
    return endGame();
  }

  drawPipes();
  drawBird();
  updateScoreUI();
}

function startGame() {
  mainMenu.classList.add("hidden");
  gameOverMenu.classList.add("hidden");
  scoreBox.style.display = "block";
  resetGame();
  gameStarted = true;
  if (frameId) cancelAnimationFrame(frameId);
  gameLoop();
}

function endGame() {
  if (!gameStarted) return;
  gameStarted = false;
  if (frameId) cancelAnimationFrame(frameId);

  finalScoreSpan.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("membird_best", String(bestScore));
  }
  bestScoreSpan.textContent = bestScore;

  scoreBox.style.display = "none";
  gameOverMenu.classList.remove("hidden");
}

// УПРАВЛЕНИЕ

function flap() {
  if (!gameStarted) return;
  bird.dy = jumpForce;
}

canvas.addEventListener("click", flap);
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  flap();
});

playBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

// ЛОГ ДЛЯ РЕКЛАМЫ

function log(msg) {
  console.log(msg);
  if (!logBox) return;
  logBox.textContent = msg;
}

// Кнопка рекламы
adBtn.addEventListener("click", () => {
  if (!(tg && typeof tg.showAd === "function")) {
    log("Реклама пока не поддерживается в этом клиенте Telegram");
    return;
  }

  log("Запрос рекламы...");
  tg.showAd("reward", {}, (res) => {
    log("Результат: " + JSON.stringify(res || {}));
  });
});

// события Telegram о доступности рекламы
if (tg && typeof tg.onEvent === "function") {
  tg.onEvent("ad_available", () => log("Реклама доступна"));
  tg.onEvent("ad_unavailable", () => log("Реклама недоступна"));
}