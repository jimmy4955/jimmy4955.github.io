'use strict';

// =========================
// Constants / Config
// =========================
const VISIBLE_ROWS = 20;
const HIDDEN_ROWS = 2;
const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
const COLS = 10;

const BOARD_CSS_W = 360;
const BOARD_CSS_H = 720;
const CELL = BOARD_CSS_W / COLS;

const SCORE_TABLE = [0, 40, 100, 300, 1200];

const FALL_CURVE_MS = [
  800, 720, 640, 570, 500, 440, 390, 340, 300, 260, 230, 205, 185, 165, 150, 135, 120, 105, 95, 85
];

const PIECE_COLORS = {
  I: '#3dc7ff',
  O: '#f5dd45',
  T: '#b88cff',
  S: '#57d98b',
  Z: '#ff6969',
  J: '#6a8cff',
  L: '#ffaf55'
};

const SHAPES = {
  I: [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1]
  ],
  O: [
    [1, 0],
    [2, 0],
    [1, 1],
    [2, 1]
  ],
  T: [
    [1, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  S: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1]
  ],
  Z: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1]
  ],
  J: [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ],
  L: [
    [2, 0],
    [0, 1],
    [1, 1],
    [2, 1]
  ]
};

const KICK_TESTS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [2, 0],
  [-2, 0],
  [0, -1],
  [1, -1],
  [-1, -1]
];

const BOOT_AD_SESSION_KEY = 'tfg_tetris_boot_ad_seen';

const AUDIO_CONFIG = {
  storageMutedKey: 'tetris_audio_muted',
  bgmPath: './audio/bgm-tetris.ogg',
  sfxDiePath: './audio/sfx-tetris-die.ogg',
  sfxLandingPath: './audio/sfx-tetris-landing.ogg',
  sfxClearPath: './audio/sfx-tetris-cancellation.ogg',
  sfxRotatePath: './audio/sfx-tetris-rotation.ogg',
  bgmVolume: 0.45,
  sfxBaseVolume: 0.60,
  landingVolume: 1.0,
  clearVolumeByLines: [0, 0.56, 0.68, 0.8, 0.9],
  resumeDelayMs: 3000
};

const LANDING_SHAKE_SEC = 0.1;
const LANDING_SHAKE_AMPLITUDE = 2.4;

// =========================
// DOM / Canvas
// =========================
const boardCanvas = document.getElementById('board');
const boardCtx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const ghostToggleEl = document.getElementById('ghostToggle');

const overlayEl = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const overlayTextEl = document.getElementById('overlayText');
const startBtn = document.getElementById('startBtn');
const audioToggleBtn = document.getElementById('audioToggleBtn');

const viewportEl = document.getElementById('gameViewport');

// =========================
// State
// =========================
const state = {
  mode: 'title', // title | playing | paused | gameover | lineclear
  board: createBoard(),
  bag: [],
  nextType: null,
  current: null,
  score: 0,
  level: 0,
  lines: 0,
  dropAccumulator: 0,
  lineClearRows: [],
  lineClearTimer: 0,
  lineClearDuration: 0.25,
  clearCount: 0,
  shakeTimer: 0,
  landingSfxQueued: false,
  scorePopTimer: 0,
  showGhost: false
};

let lastTime = 0;
let hasBootAdShown = false;
let overlayAction = null;

const audio = {
  bgm: null,
  die: null,
  landing: null,
  clear: null,
  rotate: null,
  resumeTimer: null
};

let audioMuted = false;

// =========================
// Utilities
// =========================
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function setPrelaunchActive(active) {
  if (!viewportEl) {
    return;
  }
  viewportEl.classList.toggle('prelaunch', active);
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
    // ignore
  }
}




function clearAudioResumeTimer() {
  if (audio.resumeTimer) {
    clearTimeout(audio.resumeTimer);
    audio.resumeTimer = null;
  }
}

function safeLoadAudioMuted() {
  try {
    return localStorage.getItem(AUDIO_CONFIG.storageMutedKey) === '1';
  } catch (_err) {
    return false;
  }
}

function safeSaveAudioMuted() {
  try {
    localStorage.setItem(AUDIO_CONFIG.storageMutedKey, audioMuted ? '1' : '0');
  } catch (_err) {
    // ignore storage errors
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
    audio.bgm.volume = audioMuted ? 0 : AUDIO_CONFIG.bgmVolume;
    if (audioMuted) {
      audio.bgm.pause();
    }
  }

  const vol = audioMuted ? 0 : AUDIO_CONFIG.sfxBaseVolume;
  if (audio.die) {
    audio.die.volume = vol;
  }
  if (audio.landing) {
    audio.landing.volume = vol;
  }
  if (audio.clear) {
    audio.clear.volume = vol;
  }
  if (audio.rotate) {
    audio.rotate.volume = vol;
  }

  updateAudioToggleUi();
}

function initAudio() {
  audio.bgm = new Audio(AUDIO_CONFIG.bgmPath);
  audio.bgm.loop = true;
  audio.bgm.preload = 'auto';

  audio.die = new Audio(AUDIO_CONFIG.sfxDiePath);
  audio.die.preload = 'auto';

  audio.landing = new Audio(AUDIO_CONFIG.sfxLandingPath);
  audio.landing.preload = 'auto';

  audio.clear = new Audio(AUDIO_CONFIG.sfxClearPath);
  audio.clear.preload = 'auto';

  audio.rotate = new Audio(AUDIO_CONFIG.sfxRotatePath);
  audio.rotate.preload = 'auto';

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

function playClipOnce(clip, volumeOverride = null) {
  if (audioMuted || !clip) {
    return;
  }
  if (typeof volumeOverride === 'number') {
    clip.volume = Math.max(0, Math.min(1, volumeOverride));
  }
  clip.currentTime = 0;
  const p = clip.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {});
  }
}

function playRotateSfx() {
  playClipOnce(audio.rotate, AUDIO_CONFIG.sfxBaseVolume);
}

function playLandingSfx() {
  if (audioMuted || !audio.landing) {
    return;
  }

  // Use a fresh audio node for each lock to avoid missed playback.
  const clip = audio.landing.cloneNode();
  clip.volume = AUDIO_CONFIG.landingVolume;
  const p = clip.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {});
  }
}

function playClearSfx(lines) {
  const idx = Math.max(1, Math.min(4, lines || 1));
  const vol = AUDIO_CONFIG.clearVolumeByLines[idx] || AUDIO_CONFIG.sfxBaseVolume;
  playClipOnce(audio.clear, vol);
}

function playOutcomeSfx(kind) {
  clearAudioResumeTimer();
  if (audio.bgm) {
    audio.bgm.pause();
  }

  if (kind === 'die') {
    playClipOnce(audio.die, AUDIO_CONFIG.sfxBaseVolume);
  }

  audio.resumeTimer = setTimeout(() => {
    if (!audioMuted) {
      playBgm();
    }
  }, AUDIO_CONFIG.resumeDelayMs);
}

function toggleAudioMute() {
  audioMuted = !audioMuted;
  safeSaveAudioMuted();
  applyAudioMuteState();
  if (!audioMuted && state.mode === 'playing') {
    playBgm();
  }
}

function runFirstBootAd() {
  hasBootAdShown = true;
  markBootAdSeenInSession();
  setPrelaunchActive(true);
}

function resetBoard() {
  state.board = createBoard();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function refillBag() {
  state.bag = shuffle(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
}

function pullFromBag() {
  if (state.bag.length === 0) {
    refillBag();
  }
  return state.bag.pop();
}

function getFallInterval(level) {
  const idx = clamp(level, 0, FALL_CURVE_MS.length - 1);
  return FALL_CURVE_MS[idx];
}

function showOverlay(title, text, buttonLabel = '', action = null) {
  overlayTitleEl.textContent = title;
  if (overlayTextEl) {
    overlayTextEl.textContent = text;
  }
  overlayAction = action;


  if (startBtn) {
    if (buttonLabel) {
      startBtn.textContent = buttonLabel;
      startBtn.hidden = false;
      startBtn.disabled = false;
    } else {
      startBtn.hidden = true;
    }
  }

  overlayEl.classList.remove('hidden');
}

function hideOverlay() {
  if (startBtn) {
    startBtn.hidden = true;
  }
  overlayEl.classList.add('hidden');
}

function triggerScorePop() {
  state.scorePopTimer = 0.12;
  scoreEl.classList.add('pop');
}

function updateHud() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  linesEl.textContent = String(state.lines);
}

// =========================
// Piece / Collision
// =========================
function rotateCoord([x, y], timesCW) {
  let nx = x;
  let ny = y;
  for (let i = 0; i < timesCW; i += 1) {
    const rx = 3 - ny;
    const ry = nx;
    nx = rx;
    ny = ry;
  }
  return [nx, ny];
}

function getCells(piece) {
  const base = SHAPES[piece.type];
  return base.map((pt) => {
    const [rx, ry] = rotateCoord(pt, piece.rot);
    return [piece.x + rx, piece.y + ry];
  });
}

function collides(piece) {
  const cells = getCells(piece);
  for (const [x, y] of cells) {
    if (x < 0 || x >= COLS || y >= ROWS) {
      return true;
    }
    if (y >= 0 && state.board[y][x]) {
      return true;
    }
  }
  return false;
}

function spawnPiece() {
  const type = state.nextType || pullFromBag();
  state.nextType = pullFromBag();

  state.current = {
    type,
    x: 3,
    y: -1,
    rot: 0
  };

  if (collides(state.current)) {
    state.mode = 'gameover';
    playOutcomeSfx('die');
    showOverlay('遊戲結束', '', '重新開始', () => startGame());
  }
}

function tryMove(dx, dy) {
  if (!state.current || state.mode !== 'playing') {
    return false;
  }
  const test = { ...state.current, x: state.current.x + dx, y: state.current.y + dy };
  if (!collides(test)) {
    state.current = test;
    return true;
  }
  return false;
}

function tryRotate(dir) {
  if (!state.current || state.mode !== 'playing') {
    return false;
  }

  const nextRot = (state.current.rot + (dir > 0 ? 1 : 3)) % 4;

  for (const [kx, ky] of KICK_TESTS) {
    const test = {
      ...state.current,
      rot: nextRot,
      x: state.current.x + kx,
      y: state.current.y + ky
    };

    if (!collides(test)) {
      state.current = test;
      playRotateSfx();
      return true;
    }
  }

  return false;
}

function hardDropDistance(piece) {
  let dist = 0;
  let test = { ...piece };
  while (!collides({ ...test, y: test.y + 1 })) {
    test.y += 1;
    dist += 1;
  }
  return dist;
}

function lockPiece() {
  const cells = getCells(state.current);
  for (const [x, y] of cells) {
    if (y >= 0 && y < ROWS) {
      state.board[y][x] = state.current.type;
    }
  }

  state.shakeTimer = LANDING_SHAKE_SEC;
  state.landingSfxQueued = true;
  handleLineClearOrSpawn();
}

function handleLineClearOrSpawn() {
  const fullRows = [];
  for (let y = 0; y < ROWS; y += 1) {
    if (state.board[y].every((v) => v !== null)) {
      fullRows.push(y);
    }
  }

  if (fullRows.length > 0) {
    state.mode = 'lineclear';
    state.lineClearRows = fullRows;
    state.lineClearTimer = state.lineClearDuration;
    state.clearCount = fullRows.length;
    return;
  }

  spawnPiece();
}

function finalizeLineClear() {
  const rowSet = new Set(state.lineClearRows);
  const remain = [];

  for (let y = 0; y < ROWS; y += 1) {
    if (!rowSet.has(y)) {
      remain.push(state.board[y]);
    }
  }

  while (remain.length < ROWS) {
    remain.unshift(Array(COLS).fill(null));
  }

  state.board = remain;

  playClearSfx(state.clearCount);
  state.lines += state.clearCount;
  const gained = SCORE_TABLE[state.clearCount] * (state.level + 1);
  state.score += gained;
  triggerScorePop();

  state.level = Math.floor(state.lines / 10);

  state.lineClearRows = [];
  state.lineClearTimer = 0;
  state.clearCount = 0;

  state.mode = 'playing';
  spawnPiece();
}

// =========================
// Game Control
// =========================
function resetGame() {
  resetBoard();
  state.bag = [];
  state.nextType = null;
  state.current = null;
  state.score = 0;
  state.level = 0;
  state.lines = 0;
  state.dropAccumulator = 0;
  state.lineClearRows = [];
  state.lineClearTimer = 0;
  state.clearCount = 0;
  state.shakeTimer = 0;
  state.landingSfxQueued = false;
  state.scorePopTimer = 0;

  updateHud();
  spawnPiece();
}

function startGame() {
  clearAudioResumeTimer();
  resetGame();
  state.mode = 'playing';
  hideOverlay();
  setPrelaunchActive(false);
  playBgm();
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    showOverlay('暫停中', '按 P 繼續遊戲');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    hideOverlay();
  }
}

function toTitle() {
  clearAudioResumeTimer();
  state.mode = 'title';
  if (audio.bgm) {
    audio.bgm.pause();
  }
  setPrelaunchActive(true);
  showOverlay('🧱 俄羅斯方塊', '', '開始遊戲', () => startGame());
}

// =========================
// Input
// =========================
window.addEventListener('keydown', (ev) => {
  const key = ev.key;

  if (state.mode === 'title') {
    return;
  }

  if (key === 'r' || key === 'R') {
    startGame();
    return;
  }

  if (key === 'p' || key === 'P') {
    togglePause();
    return;
  }

  if (key === 'Escape') {
    toTitle();
    return;
  }

  if (state.mode === 'gameover') {
    return;
  }

  if (state.mode !== 'playing') {
    return;
  }

  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'x', 'X', 'z', 'Z'].includes(key)) {
    ev.preventDefault();
  }

  if (key === 'ArrowLeft') {
    tryMove(-1, 0);
  } else if (key === 'ArrowRight') {
    tryMove(1, 0);
  } else if (key === 'ArrowDown') {
    if (tryMove(0, 1)) {
      state.score += 1;
      triggerScorePop();
      updateHud();
    }
  } else if (key === 'x' || key === 'X') {
    tryRotate(1);
  } else if (key === 'z' || key === 'Z') {
    tryRotate(-1);
  } else if (key === ' ') {
    const dist = hardDropDistance(state.current);
    if (dist > 0) {
      state.current.y += dist;
      state.score += dist * 2;
      triggerScorePop();
      updateHud();
    }
    lockPiece();
  }
});

ghostToggleEl.addEventListener('change', () => {
  state.showGhost = ghostToggleEl.checked;
});

if (audioToggleBtn) {
  audioToggleBtn.addEventListener('click', toggleAudioMute);
}

if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (typeof overlayAction === 'function') {
      overlayAction();
    }
  });
}

// =========================
// Update Loop
// =========================
function stepGame(dt) {
  if (state.landingSfxQueued && state.shakeTimer > 0) {
    playLandingSfx();
    state.landingSfxQueued = false;
  }

  if (state.scorePopTimer > 0) {
    state.scorePopTimer -= dt;
    if (state.scorePopTimer <= 0) {
      scoreEl.classList.remove('pop');
    }
  }

  if (state.shakeTimer > 0) {
    state.shakeTimer -= dt;
  }

  if (state.mode === 'lineclear') {
    state.lineClearTimer -= dt;
    if (state.lineClearTimer <= 0) {
      finalizeLineClear();
      updateHud();
    }
    return;
  }

  if (state.mode !== 'playing') {
    return;
  }

  const fallInterval = getFallInterval(state.level);
  state.dropAccumulator += dt * 1000;

  while (state.dropAccumulator >= fallInterval && state.mode === 'playing') {
    state.dropAccumulator -= fallInterval;
    if (!tryMove(0, 1)) {
      lockPiece();
      updateHud();
      break;
    }
  }
}

function tick(now) {
  if (!lastTime) {
    lastTime = now;
  }

  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  stepGame(dt);
  render();
  requestAnimationFrame(tick);
}

// =========================
// Render
// =========================
function setupCanvasDpi(canvas, ctx, widthCss, heightCss) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(widthCss * dpr);
  canvas.height = Math.round(heightCss * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resizeCanvases() {
  setupCanvasDpi(boardCanvas, boardCtx, BOARD_CSS_W, BOARD_CSS_H);
  setupCanvasDpi(nextCanvas, nextCtx, 120, 120);
}

function drawCell(ctx, x, y, type, alpha = 1) {
  const color = PIECE_COLORS[type];
  if (!color) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  const px = x * CELL;
  const py = (y - HIDDEN_ROWS) * CELL;

  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;

  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;

  ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

  const grad = ctx.createLinearGradient(px + 1, py + 1, px + CELL - 1, py + CELL - 1);
  grad.addColorStop(0, 'rgba(255,255,255,0.28)');
  grad.addColorStop(0.52, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = grad;
  ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

  ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);
  ctx.restore();
}

function drawBoardBackground() {
  boardCtx.fillStyle = '#0b1324';
  boardCtx.fillRect(0, 0, COLS * CELL, VISIBLE_ROWS * CELL);

  boardCtx.strokeStyle = 'rgba(170, 193, 246, 0.08)';
  boardCtx.lineWidth = 1;

  for (let x = 0; x <= COLS; x += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * CELL + 0.5, 0);
    boardCtx.lineTo(x * CELL + 0.5, VISIBLE_ROWS * CELL);
    boardCtx.stroke();
  }

  for (let y = 0; y <= VISIBLE_ROWS; y += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * CELL + 0.5);
    boardCtx.lineTo(COLS * CELL, y * CELL + 0.5);
    boardCtx.stroke();
  }
}

function drawGhostPiece() {
  if (!state.showGhost || !state.current || state.mode === 'gameover') {
    return;
  }

  const dist = hardDropDistance(state.current);
  const ghost = { ...state.current, y: state.current.y + dist };
  const cells = getCells(ghost);
  for (const [x, y] of cells) {
    if (y >= HIDDEN_ROWS) {
      drawCell(boardCtx, x, y, ghost.type, 0.22);
    }
  }
}

function drawCurrentPiece() {
  if (!state.current) {
    return;
  }
  const cells = getCells(state.current);
  for (const [x, y] of cells) {
    if (y >= HIDDEN_ROWS) {
      drawCell(boardCtx, x, y, state.current.type, 1);
    }
  }
}

function drawPlacedBlocks() {
  for (let y = HIDDEN_ROWS; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const type = state.board[y][x];
      if (type) {
        drawCell(boardCtx, x, y, type, 1);
      }
    }
  }
}

function drawLineClearFx() {
  if (state.mode !== 'lineclear') {
    return;
  }

  const t = state.lineClearTimer;
  const total = state.lineClearDuration;
  const elapsed = total - t;

  let alpha = 0;
  if (elapsed <= 0.1) {
    alpha = 0.8;
  } else {
    const fade = (elapsed - 0.1) / 0.15;
    alpha = Math.max(0, 0.8 * (1 - fade));
  }

  boardCtx.save();
  boardCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
  for (const row of state.lineClearRows) {
    if (row >= HIDDEN_ROWS) {
      const py = (row - HIDDEN_ROWS) * CELL;
      boardCtx.fillRect(0, py, COLS * CELL, CELL);
    }
  }
  boardCtx.restore();
}

function drawNext() {
  nextCtx.clearRect(0, 0, 120, 120);
  nextCtx.fillStyle = '#10192c';
  nextCtx.fillRect(0, 0, 120, 120);

  if (!state.nextType) {
    return;
  }

  const base = SHAPES[state.nextType];
  const minX = Math.min(...base.map(([x]) => x));
  const maxX = Math.max(...base.map(([x]) => x));
  const minY = Math.min(...base.map(([, y]) => y));
  const maxY = Math.max(...base.map(([, y]) => y));

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const cell = Math.floor(Math.min(88 / w, 88 / h));
  const ox = Math.floor((120 - w * cell) / 2);
  const oy = Math.floor((120 - h * cell) / 2);

  for (const [x, y] of base) {
    const px = ox + (x - minX) * cell;
    const py = oy + (y - minY) * cell;

    nextCtx.fillStyle = PIECE_COLORS[state.nextType];
    nextCtx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
    nextCtx.strokeStyle = 'rgba(255,255,255,0.25)';
    nextCtx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
  }
}

function render() {
  drawBoardBackground();

  if (state.shakeTimer > 0) {
    const shake = Math.sin((state.shakeTimer / LANDING_SHAKE_SEC) * Math.PI * 10) * LANDING_SHAKE_AMPLITUDE;
    boardCtx.save();
    boardCtx.translate(shake, 0);
    drawPlacedBlocks();
    drawGhostPiece();
    drawCurrentPiece();
    drawLineClearFx();
    boardCtx.restore();
  } else {
    drawPlacedBlocks();
    drawGhostPiece();
    drawCurrentPiece();
    drawLineClearFx();
  }

  drawNext();
}

// =========================
// Init
// =========================
function init() {
  audioMuted = safeLoadAudioMuted();
  initAudio();
  resizeCanvases();
  window.addEventListener('resize', resizeCanvases);
  updateHud();
  setPrelaunchActive(true);
  showOverlay('🧱 俄羅斯方塊', '', '開始遊戲', () => startGame());
  runFirstBootAd();
  requestAnimationFrame(tick);
}

init();


















