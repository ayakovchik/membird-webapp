const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 360;
canvas.height = 600;

let bird = {
    x: 60,
    y: 200,
    w: 40,
    h: 40,
    dy: 0
};

let pipes = [];
let score = 0;
let gameStarted = false;
let gravity = 0.45;
let jumpForce = -7;

let memeBirdImg = new Image();
memeBirdImg.src = "https://i.imgur.com/Tq4d6u7.png";  // мем-стиль птица Pepe/Doge mix

function resetGame() {
    bird.y = 200;
    bird.dy = 0;
    pipes = [];
    score = 0;
}

function createPipe() {
    let gap = 150;
    let topHeight = Math.random() * (canvas.height - gap - 100) + 40;
    pipes.push({
        x: canvas.width,
        top: topHeight,
        bottom: topHeight + gap
    });
}

function drawBird() {
    ctx.drawImage(memeBirdImg, bird.x, bird.y, bird.w, bird.h);
}

function drawPipes() {
    ctx.fillStyle = "#44aa44";
    pipes.forEach(p => {
        ctx.fillRect(p.x, 0, 60, p.top);
        ctx.fillRect(p.x, p.bottom, 60, canvas.height - p.bottom);
    });
}

function update() {
    if (!gameStarted) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    bird.dy += gravity;
    bird.y += bird.dy;

    pipes.forEach(p => {
        p.x -= 3;

        if (bird.x < p.x + 60 &&
            bird.x + bird.w > p.x &&
            (bird.y < p.top || bird.y + bird.h > p.bottom)) {
            gameOver();
        }

        if (p.x + 60 < bird.x && !p.passed) {
            score++;
            p.passed = true;
        }
    });

    pipes = pipes.filter(p => p.x > -60);

    if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - 200) {
        createPipe();
    }

    drawPipes();
    drawBird();
    updateScore();

    requestAnimationFrame(update);
}

function updateScore() {
    document.getElementById("scoreBox").innerText = score;
}

function gameOver() {
    gameStarted = false;
    alert("Игра окончена! Ваш счёт: " + score);
    resetGame();
    document.querySelector(".menu").style.display = "block";
    document.getElementById("scoreBox").style.display = "none";
}

canvas.addEventListener("click", () => {
    if (gameStarted) bird.dy = jumpForce;
});

// кнопка "Играть"
document.getElementById("startBtn").onclick = () => {
    document.querySelector(".menu").style.display = "none";
    document.getElementById("scoreBox").style.display = "block";
    gameStarted = true;
    resetGame();
    update();
};

// реклама
document.getElementById("adBtn").onclick = async () => {
    const tg = window.Telegram.WebApp;
    if (tg && tg.showAd) {
        try {
            await tg.showAd("reward");
        } catch (e) {
            alert("Реклама недоступна");
        }
    }
};