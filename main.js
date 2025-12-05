// main.js — Flappy Template v1

const CONFIG_URL = 'game-config.json';

const GameState = {
  LOADING: 'LOADING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  GAME_OVER: 'GAME_OVER',
};

let config = null;
let canvas, ctx;
let width, height;

let bgImage, groundImage, birdImage, pipeTopImage, pipeBottomImage;

let state = GameState.LOADING;
let bird;
let pipes = [];
let groundY = 0;
let score = 0;
let bestScore = 0;
let lastSpawnX = 0;

// Получаем элементы UI
const titleEl = document.getElementById('game-title');
const scoreLabelEl = document.getElementById('score-label');
const bestLabelEl = document.getElementById('best-label');
const messageEl = document.getElementById('main-message');
const retryButtonEl = document.getElementById('retry-button');
const continueButtonEl = document.getElementById('continue-button');

// Загрузка конфига и старт
window.addEventListener('load', () => {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  loadConfig()
    .then(initGame)
    .catch(err => {
      console.error('Config load error:', err);
      messageEl.textContent = 'Ошибка загрузки конфига';
    });
});

async function loadConfig() {
  const res = await fetch(CONFIG_URL);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  config = await res.json();
}

function initGame() {
  // Установим заголовок
  if (config.GAME_TITLE) {
    document.title = config.GAME_TITLE;
    titleEl.textContent = config.GAME_TITLE;
  } else {
    titleEl.textContent = 'Flappy Meme';
  }

  // Canvas размеры по размеру контейнера
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Загружаем ассеты
  Promise.all([
    loadImage(config.BG_IMAGE),
    loadImage(config.GROUND_IMAGE),
    loadImage(config.BIRD_IMAGE),
    loadImage(config.PIPE_TOP_IMAGE),
    loadImage(config.PIPE_BOTTOM_IMAGE),
  ])
    .then(([bg, ground, birdImg, pipeTop, pipeBottom]) => {
      bgImage = bg;
      groundImage = ground;
      birdImage = birdImg;
      pipeTopImage = pipeTop;
      pipeBottomImage = pipeBottom;

      resetGame();

      // Навесим управление
      canvas.addEventListener('pointerdown', handleInput);
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          handleInput();
        }
      });

      retryButtonEl.addEventListener('click', () => {
        resetGame();
      });

      continueButtonEl.addEventListener('click', () => {
        handleContinue();
      });

      state = GameState.READY;
      updateUIText();
      requestAnimationFrame(gameLoop);
    })
    .catch(err => {
      console.error('Image load error:', err);
      messageEl.textContent = 'Ошибка загрузки ассетов';
    });
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  width = canvas.width;
  height = canvas.height;
  groundY = height * 0.85;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

function resetGame() {
  score = 0;
  pipes = [];
  lastSpawnX = width;
  const birdX = width * 0.3;
  const birdY = height * 0.5;
  bird = {
    x: birdX,
    y: birdY,
    vy: 0,
    radius: Math.min(width, height) * 0.04,
  };
  state = GameState.READY;
  updateUIText();
}

function handleInput() {
  if (state === GameState.READY) {
    startGame();
    flap();
  } else if (state === GameState.RUNNING) {
    flap();
  } else if (state === GameState.GAME_OVER) {
    // ничего, ждём кнопки Retry / Continue
  }
}

function startGame() {
  state = GameState.RUNNING;
  updateUIText();
}

function flap() {
  bird.vy = - (config.JUMP_FORCE || 7.5);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function update() {
  if (state !== GameState.RUNNING) return;

  const gravity = config.GRAVITY || 0.35;
  const speed = config.SPEED || 4.0;
  const gapSize = config.GAP_SIZE || 240;

  bird.vy += gravity;
  bird.y += bird.vy;

  // Спавн труб
  if (pipes.length === 0 || (pipes[pipes.length - 1].x < width - gapSize * 1.5)) {
    spawnPipePair(gapSize);
  }

  // Обновляем трубы
  for (let i = pipes.length - 1; i >= 0; i--) {
    const pipe = pipes[i];
    pipe.x -= speed;

    // Если труба ушла за экран — удаляем
    if (pipe.x + pipe.width < 0) {
      pipes.splice(i, 1);
    }
  }

  // Проверка столкновений и счёта
  checkCollisionsAndScore();

  // Падение на землю
  if (bird.y + bird.radius > groundY) {
    bird.y = groundY - bird.radius;
    onGameOver();
  }
  if (bird.y - bird.radius < 0) {
    bird.y = bird.radius;
    bird.vy = 0;
  }
}

function spawnPipePair(gapSize) {
  const pipeWidth = width * 0.2;
  const minTop = height * 0.15;
  const maxTop = height * 0.55;
  const topHeight = minTop + Math.random() * (maxTop - minTop);
  const bottomY = topHeight + gapSize;

  // верхняя
  pipes.push({
    x: width,
    y: 0,
    width: pipeWidth,
    height: topHeight,
    passed: false,
    isTop: true,
  });

  // нижняя
  pipes.push({
    x: width,
    y: bottomY,
    width: pipeWidth,
    height: height - bottomY,
    passed: false,
    isTop: false,
  });
}

function checkCollisionsAndScore() {
  for (const pipe of pipes) {
    // Столкновение
    const cx = bird.x;
    const cy = bird.y;
    const nearestX = Math.max(pipe.x, Math.min(cx, pipe.x + pipe.width));
    const nearestY = Math.max(pipe.y, Math.min(cy, pipe.y + pipe.height));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    const distSq = dx * dx + dy * dy;
    if (distSq < bird.radius * bird.radius) {
      onGameOver();
      return;
    }
  }

  // Счёт — когда птица проходит середину пары труб
  for (let i = 0; i < pipes.length; i += 2) {
    const topPipe = pipes[i];
    if (!topPipe) continue;
    const pipeCenter = topPipe.x + topPipe.width / 2;
    if (!topPipe.passed && pipeCenter < bird.x) {
      topPipe.passed = true;
      score++;
      updateUIText();
    }
  }
}

function onGameOver() {
  if (state !== GameState.RUNNING) return;
  state = GameState.GAME_OVER;

  if (score > bestScore) {
    bestScore = score;
  }
  updateUIText();
}

function updateUIText() {
  const uiText = config.UI_TEXT || {};
  const tapText = uiText.tap_to_start || 'Тапни, чтобы начать';
  const gameOverText = uiText.game_over || 'Игра окончена';

  scoreLabelEl.textContent = `${score}`;
  bestLabelEl.textContent = `Лучший: ${bestScore}`;

  retryButtonEl.classList.add('hidden');
  continueButtonEl.classList.add('hidden');

  if (state === GameState.READY) {
    messageEl.textContent = tapText;
  } else if (state === GameState.RUNNING) {
    messageEl.textContent = '';
  } else if (state === GameState.GAME_OVER) {
    messageEl.textContent = gameOverText;
    retryButtonEl.classList.remove('hidden');

    if (config.MONETIZATION && (config.MONETIZATION.rewarded_ads || config.MONETIZATION.stars_continue)) {
      continueButtonEl.classList.remove('hidden');
    }
  }
}

function draw() {
  if (!ctx || !config) return;
  ctx.clearRect(0, 0, width, height);

  // фон
  if (bgImage) {
    const scale = Math.max(width / bgImage.width, height / bgImage.height);
    const drawW = bgImage.width * scale;
    const drawH = bgImage.height * scale;
    const dx = (width - drawW) / 2;
    const dy = (height - drawH) / 2;
    ctx.drawImage(bgImage, dx, dy, drawW, drawH);
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
  }

  // трубы
  for (const pipe of pipes) {
    const img = pipe.isTop ? pipeTopImage : pipeBottomImage;
    if (img) {
      ctx.drawImage(img, pipe.x, pipe.y, pipe.width, pipe.height);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(pipe.x, pipe.y, pipe.width, pipe.height);
    }
  }

  // земля
  if (groundImage) {
    const groundHeight = height - groundY;
    const scale = groundHeight / groundImage.height;
    const drawW = groundImage.width * scale;
    const tiles = Math.ceil(width / drawW) + 1;
    for (let i = 0; i < tiles; i++) {
      ctx.drawImage(groundImage, i * drawW, groundY, drawW, groundHeight);
    }
  } else {
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, groundY, width, height - groundY);
  }

  // птица
  if (birdImage) {
    const size = bird.radius * 2;
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.drawImage(birdImage, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(bird.x, bird.y, bird.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Заглушка под монетизацию
function handleContinue() {
  const monetization = config.MONETIZATION || {};
  if (monetization.rewarded_ads) {
    showRewardedAd()
      .then(() => {
        // Возродить игрока
        state = GameState.RUNNING;
        bird.y = height * 0.5;
        bird.vy = 0;
        updateUIText();
      })
      .catch(() => {
        // если отказался или ошибка — ничего
      });
  } else if (monetization.stars_continue) {
    // Здесь потом будет логика с Telegram Stars
    alert('Здесь будет логика продолжения игры за Stars');
  }
}

function showRewardedAd() {
  // Здесь будет интеграция с рекламным SDK.
  // Сейчас — просто фейковый промис для шаблона.
  return new Promise(resolve => {
    alert('Заглушка: показать рекламный ролик. После этого игрок продолжит игру.');
    resolve();
  });
}