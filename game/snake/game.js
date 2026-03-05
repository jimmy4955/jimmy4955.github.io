'use strict';

const config = {
  gridSize: 20,
  baseSpeed: 7,
  maxSpeed: 15,
  speedStep: 0.3,
  storageBestKey: 'snake_best_score'
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const speedEl = document.getElementById('speed');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayDesc = document.getElementById('overlayDesc');
const startBtn = document.getElementById('startBtn');
const rematchAdWrap = document.getElementById('rematchAdWrap');

let hasFinishedAtLeastOnce = false;
let rematchAdLoaded = false;

const state = {
  running: false,
  best: Number(localStorage.getItem(config.storageBestKey) || 0),
  score: 0,
  speed: config.baseSpeed,
  acc: 0,
  direction: { x: 1, y: 0 },
  queuedDirection: { x: 1, y: 0 },
  snake: [],
  food: { x: 0, y: 0 }
};

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function placeFood() {
  let cell = null;
  do {
    cell = { x: randInt(config.gridSize), y: randInt(config.gridSize) };
  } while (state.snake.some((s) => s.x === cell.x && s.y === cell.y));
  state.food = cell;
}

function resetGame() {
  const mid = Math.floor(config.gridSize / 2);
  state.snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid }
  ];
  state.score = 0;
  state.speed = config.baseSpeed;
  state.acc = 0;
  state.direction = { x: 1, y: 0 };
  state.queuedDirection = { x: 1, y: 0 };
  placeFood();
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  speedEl.textContent = state.speed.toFixed(1);
}

function showOverlay(title, desc, buttonText) {
  overlayTitle.textContent = title;
  overlayDesc.textContent = desc;
  startBtn.textContent = buttonText;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function maybeShowRematchAd() {
  if (!rematchAdWrap || !hasFinishedAtLeastOnce) {
    return;
  }

  rematchAdWrap.hidden = false;
  if (!rematchAdLoaded) {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      rematchAdLoaded = true;
    } catch (_err) {
      // Ignore ad-blocker/runtime errors to keep the game playable.
    }
  }
}

function handleGameOver() {
  state.running = false;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem(config.storageBestKey, String(state.best));
  }
  updateHud();
  showOverlay('遊戲結束', `本局分數：${state.score}，再來一場！`, '再來一次');
  hasFinishedAtLeastOnce = true;
  maybeShowRematchAd();
}

function setDirection(x, y) {
  if (!state.running) {
    return;
  }
  if (x === -state.direction.x && y === -state.direction.y) {
    return;
  }
  state.queuedDirection = { x, y };
}

function onKeyDown(ev) {
  const key = ev.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(key)) {
    ev.preventDefault();
  }

  if (key === 'ArrowUp' || key === 'w' || key === 'W') {
    setDirection(0, -1);
  } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
    setDirection(0, 1);
  } else if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
    setDirection(-1, 0);
  } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
    setDirection(1, 0);
  }
}

function step() {
  state.direction = state.queuedDirection;

  const head = state.snake[0];
  const next = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y
  };

  if (next.x < 0 || next.y < 0 || next.x >= config.gridSize || next.y >= config.gridSize) {
    handleGameOver();
    return;
  }

  if (state.snake.some((part) => part.x === next.x && part.y === next.y)) {
    handleGameOver();
    return;
  }

  state.snake.unshift(next);

  if (next.x === state.food.x && next.y === state.food.y) {
    state.score += 1;
    state.speed = Math.min(config.maxSpeed, state.speed + config.speedStep);
    placeFood();
    updateHud();
  } else {
    state.snake.pop();
  }
}

function drawBoard() {
  const size = canvas.width;
  const cell = size / config.gridSize;

  ctx.fillStyle = '#0b1326';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(130, 168, 255, 0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= config.gridSize; i += 1) {
    const p = i * cell;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  ctx.fillStyle = '#ff6b6b';
  ctx.fillRect(state.food.x * cell + 2, state.food.y * cell + 2, cell - 4, cell - 4);

  for (let i = state.snake.length - 1; i >= 0; i -= 1) {
    const seg = state.snake[i];
    ctx.fillStyle = i === 0 ? '#6af7b8' : '#4f7bff';
    ctx.fillRect(seg.x * cell + 2, seg.y * cell + 2, cell - 4, cell - 4);
  }
}

let lastTs = 0;
function loop(ts) {
  if (!lastTs) {
    lastTs = ts;
  }
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;

  if (state.running) {
    state.acc += dt;
    const interval = 1 / state.speed;
    while (state.acc >= interval && state.running) {
      state.acc -= interval;
      step();
    }
  }

  drawBoard();
  requestAnimationFrame(loop);
}

function startGame() {
  resetGame();
  state.running = true;
  if (rematchAdWrap) {
    rematchAdWrap.hidden = true;
  }
  hideOverlay();
}

function init() {
  updateHud();
  resetGame();
  showOverlay('貪食蛇', '按下「開始遊戲」後，使用 WASD 或方向鍵控制蛇移動。', '開始遊戲');

  startBtn.addEventListener('click', startGame);
  window.addEventListener('keydown', onKeyDown, { passive: false });

  requestAnimationFrame(loop);
}

init();

