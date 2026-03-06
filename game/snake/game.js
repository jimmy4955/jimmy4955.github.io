'use strict';

const MODES = {
  lightning: {
    id: 'lightning',
    label: '⚡小地圖',
    note: '高速挑戰-速度9',
    grid: 14,
    baseSpeed: 9,
    maxSpeed: 17,
    speedStep: 0.34
  },
  classic: {
    id: 'classic',
    label: '🎯 經典圖',
    note: '標準玩法-速度7',
    grid: 20,
    baseSpeed: 7,
    maxSpeed: 15,
    speedStep: 0.3
  },
  earth: {
    id: 'earth',
    label: '🌍 大地圖',
    note: '新手練習-速度6',
    grid: 32,
    baseSpeed: 6,
    maxSpeed: 13,
    speedStep: 0.24
  }
};

const config = {
  defaultMode: 'classic',
  storageBestPrefix: 'snake_best_',
  storageAudioMutedKey: 'snake_audio_muted',
  audio: {
    bgmPath: './audio/bgm-snake.ogg',
    sfxDiePath: './audio/sfx-sanke-die.ogg',
    sfxWinPath: './audio/sfx-sanke-win.ogg',
    sfxEatPath: './audio/sfx-snake-eat.ogg',
    bgmVolume: 0.42,
    sfxVolume: 0.8,
    resumeDelayMs: 3000
  }
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const viewportEl = document.getElementById('gameViewport');

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const speedEl = document.getElementById('speed');
const modeNameEl = document.getElementById('modeName');
const bestLightningEl = document.getElementById('bestLightning');
const bestClassicEl = document.getElementById('bestClassic');
const bestEarthEl = document.getElementById('bestEarth');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayDesc = document.getElementById('overlayDesc');
const startBtn = document.getElementById('startBtn');
const modePicker = document.getElementById('modePicker');
const modeNoteEl = document.getElementById('modeNote');
const audioToggleBtn = document.getElementById('audioToggleBtn');

const BOOT_AD_SESSION_KEY = 'tfg_snake_boot_ad_seen';

let hasBootAdShown = false;
let elapsedSec = 0;

const audio = {
  bgm: null,
  die: null,
  win: null,
  eat: null,
  resumeTimer: null
};

let audioMuted = false;

const state = {
  running: false,
  modeId: config.defaultMode,
  bestByMode: {
    lightning: Number(localStorage.getItem(config.storageBestPrefix + 'lightning') || 0),
    classic: Number(localStorage.getItem(config.storageBestPrefix + 'classic') || 0),
    earth: Number(localStorage.getItem(config.storageBestPrefix + 'earth') || 0)
  },
  score: 0,
  speed: MODES[config.defaultMode].baseSpeed,
  acc: 0,
  direction: { x: 1, y: 0 },
  queuedDirection: { x: 1, y: 0 },
  snake: [],
  food: { x: 0, y: 0 }
};


function clearAudioResumeTimer() {
  if (audio.resumeTimer) {
    clearTimeout(audio.resumeTimer);
    audio.resumeTimer = null;
  }
}

function safeLoadAudioMuted() {
  try {
    return localStorage.getItem(config.storageAudioMutedKey) === '1';
  } catch (_err) {
    return false;
  }
}

function safeSaveAudioMuted() {
  try {
    localStorage.setItem(config.storageAudioMutedKey, audioMuted ? '1' : '0');
  } catch (_err) {
    // ignore storage error
  }
}

function updateAudioToggleUi() {
  if (!audioToggleBtn) {
    return;
  }
  audioToggleBtn.textContent = audioMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
  audioToggleBtn.setAttribute('aria-label', audioMuted ? 'Enable audio' : 'Mute audio');
  audioToggleBtn.title = audioMuted ? 'Audio muted' : 'Audio on';
}

function applyAudioMuteState() {
  if (audio.bgm) {
    audio.bgm.volume = audioMuted ? 0 : config.audio.bgmVolume;
    if (audioMuted) {
      audio.bgm.pause();
    }
  }

  if (audio.die) {
    audio.die.volume = audioMuted ? 0 : config.audio.sfxVolume;
  }
  if (audio.win) {
    audio.win.volume = audioMuted ? 0 : config.audio.sfxVolume;
  }
  if (audio.eat) {
    audio.eat.volume = audioMuted ? 0 : config.audio.sfxVolume;
  }

  updateAudioToggleUi();
}

function toggleAudioMute() {
  audioMuted = !audioMuted;
  safeSaveAudioMuted();
  applyAudioMuteState();
  if (!audioMuted && state.running) {
    playBgm();
  }
}

function initAudio() {
  audio.bgm = new Audio(config.audio.bgmPath);
  audio.bgm.loop = true;
  audio.bgm.preload = 'auto';

  audio.die = new Audio(config.audio.sfxDiePath);
  audio.die.preload = 'auto';

  audio.win = new Audio(config.audio.sfxWinPath);
  audio.win.preload = 'auto';

  audio.eat = new Audio(config.audio.sfxEatPath);
  audio.eat.preload = 'auto';

  applyAudioMuteState();
}

function playBgm() {
  if (audioMuted || !audio.bgm) {
    return;
  }
  const p = audio.bgm.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {});
  }
}

function playEatSfx() {
  if (audioMuted || !audio.eat) {
    return;
  }
  audio.eat.currentTime = 0;
  const p = audio.eat.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {});
  }
}

function playOutcomeSfx(kind) {
  clearAudioResumeTimer();
  if (audio.bgm) {
    audio.bgm.pause();
  }

  const clip = kind === 'win' ? audio.win : audio.die;
  if (!audioMuted && clip) {
    clip.currentTime = 0;
    const p = clip.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
  }

  audio.resumeTimer = setTimeout(() => {
    if (!audioMuted) {
      playBgm();
    }
  }, config.audio.resumeDelayMs);
}

function setPrelaunchActive(active) {
  if (!viewportEl) {
    return;
  }
  viewportEl.classList.toggle('prelaunch', active);
}

function currentMode() {
  return MODES[state.modeId];
}

function randInt(max) {
  return Math.floor(Math.random() * max);
}

function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function placeFood() {
  const grid = currentMode().grid;
  const capacity = grid * grid;
  if (state.snake.length >= capacity) {
    return false;
  }

  let cell = null;
  do {
    cell = { x: randInt(grid), y: randInt(grid) };
  } while (state.snake.some((s) => s.x === cell.x && s.y === cell.y));

  state.food = cell;
  return true;
}

function resetGame() {
  const mode = currentMode();
  const mid = Math.floor(mode.grid / 2);
  state.snake = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid }
  ];
  state.score = 0;
  state.speed = mode.baseSpeed;
  state.acc = 0;
  state.direction = { x: 1, y: 0 };
  state.queuedDirection = { x: 1, y: 0 };
  placeFood();
  updateHud();
}

function updateModeButtons() {
  if (!modePicker) {
    return;
  }
  const buttons = modePicker.querySelectorAll('.mode-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === state.modeId);
  });
}

function updateHud() {
  const mode = currentMode();
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.bestByMode[state.modeId] || 0);
  speedEl.textContent = state.speed.toFixed(1);
  modeNameEl.textContent = mode.label;
  bestLightningEl.textContent = String(state.bestByMode.lightning || 0);
  bestClassicEl.textContent = String(state.bestByMode.classic || 0);
  bestEarthEl.textContent = String(state.bestByMode.earth || 0);
  if (modeNoteEl) {
    modeNoteEl.textContent = mode.note;
  }
  updateModeButtons();
}

function setMode(modeId) {
  if (!MODES[modeId]) {
    return;
  }
  state.modeId = modeId;
  if (!state.running) {
    resetGame();
  }
  updateHud();
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




function startGame() {
  clearAudioResumeTimer();
  resetGame();
  state.running = true;
  hideOverlay();
  setPrelaunchActive(false);
  playBgm();
}

function requestStartGame() {
  startGame();
}

function hasSeenBootAdInSession() {
  try {
    return sessionStorage.getItem(BOOT_AD_SESSION_KEY) === '1';
  } catch (_err) {
    return false;
  }
}

function markBootAdSeenInSession() {
  try {
    sessionStorage.setItem(BOOT_AD_SESSION_KEY, '1');
  } catch (_err) {
    // ignore storage-blocked environments
  }
}

function runFirstBootAd() {
  hasBootAdShown = true;
  markBootAdSeenInSession();
  setPrelaunchActive(true);
}

function persistBest(modeId, score) {
  state.bestByMode[modeId] = score;
  localStorage.setItem(config.storageBestPrefix + modeId, String(score));
}

function handleGameOver() {
  state.running = false;

  const modeId = state.modeId;
  if (state.score > (state.bestByMode[modeId] || 0)) {
    persistBest(modeId, state.score);
  }

  playOutcomeSfx('die');
  updateHud();
  showOverlay('\u904A\u6232\u7D50\u675F', `\u672C\u5C40\u5206\u6578\uFF1A${state.score}\uFF0C\u53EF\u5207\u63DB\u6A21\u5F0F\u518D\u6311\u6230\u3002`, '\u518D\u4F86\u4E00\u6B21');
}

function handleVictory() {
  state.running = false;

  const modeId = state.modeId;
  if (state.score > (state.bestByMode[modeId] || 0)) {
    persistBest(modeId, state.score);
  }

  playOutcomeSfx('win');
  updateHud();
  showOverlay('\u73A9\u5BB6\u52DD\u5229', `\u4F60\u5403\u6EFF\u6574\u5F35\u5730\u5716\uFF01\u672C\u5C40\u5206\u6578\uFF1A${state.score}`, '\u518D\u4F86\u4E00\u6B21');
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
  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(key)
  ) {
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

function onModeClick(ev) {
  const btn = ev.target.closest('.mode-btn');
  if (!btn) {
    return;
  }

  setMode(btn.dataset.mode);

  if (!state.running) {
    showOverlay('🍎 貪食蛇', '開始前請先選擇地圖模式，再按「開始遊戲」。', '開始遊戲');
  }
}

function step() {
  state.direction = state.queuedDirection;

  const mode = currentMode();
  const head = state.snake[0];
  const next = {
    x: head.x + state.direction.x,
    y: head.y + state.direction.y
  };

  if (next.x < 0 || next.y < 0 || next.x >= mode.grid || next.y >= mode.grid) {
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
    state.speed = Math.min(mode.maxSpeed, state.speed + mode.speedStep);
    playEatSfx();
    const spawned = placeFood();
    updateHud();

    if (!spawned) {
      handleVictory();
    }
  } else {
    state.snake.pop();
  }
}

function drawFood(cell, x, y, pad) {
  const cx = x + cell * 0.5;
  const cy = y + cell * 0.5;
  const wobbleX = Math.sin(elapsedSec * 5.8) * cell * 0.06;
  const wobbleY = Math.cos(elapsedSec * 4.6) * cell * 0.03;
  const r = (cell * 0.5 - pad) * 0.84;

  const grad = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.36, r * 0.1, cx, cy, r);
  grad.addColorStop(0, '#ffd4d4');
  grad.addColorStop(0.28, '#ff9d8a');
  grad.addColorStop(1, '#d93b3b');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx + wobbleX, cy + wobbleY, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#63411f';
  ctx.lineWidth = Math.max(1.5, cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx + wobbleX, cy - r * 0.95 + wobbleY);
  ctx.quadraticCurveTo(cx + wobbleX + r * 0.1, cy - r * 1.25 + wobbleY, cx + wobbleX + r * 0.3, cy - r * 1.05 + wobbleY);
  ctx.stroke();

  ctx.fillStyle = '#6ccf63';
  ctx.beginPath();
  ctx.ellipse(cx + wobbleX + r * 0.45, cy - r * 0.8 + wobbleY, r * 0.32, r * 0.16, -0.52, 0, Math.PI * 2);
  ctx.fill();
}

function drawSnake(cell, pad) {
  const len = Math.max(1, state.snake.length - 1);

  for (let i = state.snake.length - 1; i >= 0; i -= 1) {
    const seg = state.snake[i];
    const x = seg.x * cell + pad;
    const y = seg.y * cell + pad;
    const size = cell - pad * 2;
    const radius = Math.max(3, size * 0.28);

    if (i === 0) {
      const headGrad = ctx.createLinearGradient(x, y, x + size, y + size);
      headGrad.addColorStop(0, '#c9fff3');
      headGrad.addColorStop(1, '#2cf0ad');
      ctx.fillStyle = headGrad;
    } else {
      const t = (i - 1) / len;
      const bodyGrad = ctx.createLinearGradient(x, y, x + size, y + size);
      bodyGrad.addColorStop(0, `hsl(${206 + t * 28} 90% 67%)`);
      bodyGrad.addColorStop(1, `hsl(${238 - t * 18} 86% 58%)`);
      ctx.fillStyle = bodyGrad;
    }

    roundRectPath(x, y, size, size, radius);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = Math.max(1, cell * 0.025);
    roundRectPath(x, y, size, size, radius);
    ctx.stroke();

    if (i === 0) {
      const eyeR = Math.max(1.8, size * 0.08);
      ctx.fillStyle = '#12243a';
      ctx.beginPath();
      ctx.arc(x + size * 0.34, y + size * 0.34, eyeR, 0, Math.PI * 2);
      ctx.arc(x + size * 0.66, y + size * 0.34, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBoard() {
  const mode = currentMode();
  const size = canvas.width;
  const cell = size / mode.grid;
  const pad = Math.max(1.5, cell * 0.08);

  ctx.fillStyle = '#0b1326';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(130, 168, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= mode.grid; i += 1) {
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

  drawFood(cell, state.food.x * cell, state.food.y * cell, pad);
  drawSnake(cell, pad);
}

let lastTs = 0;
function loop(ts) {
  if (!lastTs) {
    lastTs = ts;
  }
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  elapsedSec += dt;

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

function init() {
  audioMuted = safeLoadAudioMuted();
  initAudio();
  updateHud();
  resetGame();
  setPrelaunchActive(true);
  showOverlay('🍎 貪食蛇', '開始前請先選擇地圖模式，再按「開始遊戲」。', '開始遊戲');

  startBtn.addEventListener('click', requestStartGame);
  if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', toggleAudioMute);
  }
  if (modePicker) {
    modePicker.addEventListener('click', onModeClick);
  }
  window.addEventListener('keydown', onKeyDown, { passive: false });

  runFirstBootAd();
  requestAnimationFrame(loop);
}

init();





