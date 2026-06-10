const tileImages = [
  "BP_story_01_17_knight.png",
  "BP_story_01_28_admirer.png",
  "BP_story_01_29_trader.png",
  "BP_story_01_48_awakenseer.png",
  "BP_story_01_49_perfumer.png",
  "BP_story_01_50_awakenwolvesking.png",
  "BP_story_01_51_awakeninghiddenwolf.png",
  "BP_story_01_52_magicmirrorgirl.png",
  "BP_story_01_53_AwakeningAdmirer.png",
  "BP_story_01_56_AwakeningWitch.png",
  "BP_story_01_57_AwakeningWerewolfBeauty.png",
  "BP_story_01_58_AwakeningHunter.png",
  "BP_story_01_59_AwakeningGargoyles.png",
  "BP_story_01_61_AwakeningWhitewolvesking.png",
  "BP_story_01_62_AwakeningGuard.png",
  "BP_story_01_63_FemaleWerewolves.png",
  "BP_story_01_64_AwakeningDreamer.png"
];
const configs = {
  easy: { rows: 6, cols: 8, seconds: 210, kinds: 12 },
  normal: { rows: 8, cols: 10, seconds: 180, kinds: 16 },
  hard: { rows: 10, cols: 12, seconds: 210, kinds: 17 }
};

const els = {
  board: document.querySelector("#board"),
  canvas: document.querySelector("#lineLayer"),
  time: document.querySelector("#time"),
  moves: document.querySelector("#moves"),
  left: document.querySelector("#left"),
  message: document.querySelector("#message"),
  newGame: document.querySelector("#newGame"),
  hint: document.querySelector("#hint"),
  shuffle: document.querySelector("#shuffle"),
  difficulty: document.querySelector("#difficulty")
};

let state = {};

function startGame() {
  const config = configs[els.difficulty.value];
  state = {
    ...config,
    grid: makeGrid(config),
    selected: null,
    moves: 0,
    left: config.rows * config.cols,
    seconds: config.seconds,
    timer: state.timer,
    locked: false
  };
  clearInterval(state.timer);
  state.timer = setInterval(tick, 1000);
  draw();
  setMessage("开局！先找边缘和相邻的对子。");
}

function makeGrid({ rows, cols, kinds }) {
  const total = rows * cols;
  const values = [];
  for (let i = 0; i < total / 2; i++) {
    const image = tileImages[i % kinds];
    values.push(image, image);
  }
  shuffleArray(values);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => values[r * cols + c])
  );
}

function draw() {
  els.board.innerHTML = "";
  els.board.style.gridTemplateColumns = `repeat(${state.cols}, minmax(0, 1fr))`;
  els.board.style.maxWidth = `${state.cols * 66}px`;
  state.grid.forEach((row, r) => row.forEach((value, c) => {
    const tile = document.createElement("button");
    tile.className = `tile${value ? "" : " empty"}`;
    if (value) {
      const img = document.createElement("img");
      img.src = `assets/${value}`;
      img.alt = "";
      img.draggable = false;
      tile.append(img);
    }
    tile.disabled = !value || state.locked;
    tile.dataset.r = r;
    tile.dataset.c = c;
    tile.addEventListener("click", () => choose(r, c));
    els.board.append(tile);
  }));
  updateStats();
  sizeCanvas();
}

function choose(r, c) {
  if (state.locked || !state.grid[r][c]) return;
  const current = { r, c };
  if (state.selected && sameCell(state.selected, current)) {
    state.selected = null;
    markSelection();
    return;
  }
  if (!state.selected) {
    state.selected = current;
    markSelection();
    return;
  }
  state.moves++;
  const first = state.selected;
  const path = findPath(first, current);
  if (path && state.grid[first.r][first.c] === state.grid[r][c]) {
    state.locked = true;
    drawLine(path);
    setTimeout(() => {
      state.grid[first.r][first.c] = null;
      state.grid[r][c] = null;
      state.left -= 2;
      state.selected = null;
      state.locked = false;
      clearLine();
      draw();
      setMessage(state.left ? "连上了，漂亮。" : "全部消除，通关！");
      if (!state.left) endGame("你赢了！");
      else if (!findAnyPair()) reshuffle("没有可连的牌，已自动重排。");
    }, 260);
  } else {
    setMessage("这两个还连不上。");
    state.selected = current;
    markSelection();
  }
  updateStats();
}

function findPath(a, b) {
  if (sameCell(a, b) || state.grid[a.r][a.c] !== state.grid[b.r][b.c]) return null;
  const rows = state.rows + 2;
  const cols = state.cols + 2;
  const start = { r: a.r + 1, c: a.c + 1 };
  const target = { r: b.r + 1, c: b.c + 1 };
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  const queue = [{ ...start, dir: -1, turns: 0, path: [start] }];
  const seen = new Map();

  while (queue.length) {
    const node = queue.shift();
    for (let dir = 0; dir < dirs.length; dir++) {
      const nr = node.r + dirs[dir][0];
      const nc = node.c + dirs[dir][1];
      const turns = node.dir === -1 || node.dir === dir ? node.turns : node.turns + 1;
      if (turns > 2 || nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      if (!isOpen(nr, nc, target)) continue;
      const key = `${nr},${nc},${dir}`;
      if ((seen.get(key) ?? 9) <= turns) continue;
      const path = [...node.path, { r: nr, c: nc }];
      if (nr === target.r && nc === target.c) return compressPath(path).map(toBoardPoint);
      seen.set(key, turns);
      queue.push({ r: nr, c: nc, dir, turns, path });
    }
  }
  return null;
}

function isOpen(r, c, target) {
  if (r === target.r && c === target.c) return true;
  const br = r - 1;
  const bc = c - 1;
  return br < 0 || bc < 0 || br >= state.rows || bc >= state.cols || !state.grid[br][bc];
}

function toBoardPoint(p) {
  return { r: p.r - 1, c: p.c - 1 };
}

function compressPath(path) {
  return path.filter((point, i) => {
    if (i === 0 || i === path.length - 1) return true;
    const prev = path[i - 1];
    const next = path[i + 1];
    return !((prev.r === point.r && point.r === next.r) || (prev.c === point.c && point.c === next.c));
  });
}

function drawLine(path) {
  sizeCanvas();
  const ctx = els.canvas.getContext("2d");
  const rect = els.board.getBoundingClientRect();
  const points = path.map(({ r, c }) => {
    const x = (c + .5) * rect.width / state.cols;
    const y = (r + .5) * rect.height / state.rows;
    return { x, y };
  });
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--line").trim();
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();
}

function clearLine() {
  els.canvas.getContext("2d").clearRect(0, 0, els.canvas.width, els.canvas.height);
}

function sizeCanvas() {
  const rect = els.board.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  els.canvas.style.width = `${rect.width}px`;
  els.canvas.style.height = `${rect.height}px`;
  els.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  els.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  els.canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
}

function findAnyPair() {
  const cells = [];
  state.grid.forEach((row, r) => row.forEach((value, c) => value && cells.push({ r, c, value })));
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cells[i].value === cells[j].value && findPath(cells[i], cells[j])) return [cells[i], cells[j]];
    }
  }
  return null;
}

function showHint() {
  const pair = findAnyPair();
  if (!pair) {
    reshuffle("暂时无解，已重排。");
    return;
  }
  setMessage("这对可以连。");
  document.querySelectorAll(".tile").forEach(tile => tile.classList.remove("hint"));
  pair.forEach(({ r, c }) => tileAt(r, c).classList.add("hint"));
}

function reshuffle(message = "已重排。") {
  const values = state.grid.flat().filter(Boolean);
  let nextGrid;
  let tries = 0;
  do {
    const shuffled = shuffleArray([...values]);
    nextGrid = state.grid.map(row => row.map(cell => cell ? shuffled.pop() : null));
    tries++;
  } while (values.length > 2 && !findAnyPairIn(nextGrid) && tries < 80);
  state.grid = nextGrid;
  state.selected = null;
  draw();
  setMessage(message);
}

function findAnyPairIn(grid) {
  const oldGrid = state.grid;
  state.grid = grid;
  const pair = findAnyPair();
  state.grid = oldGrid;
  return pair;
}

function tick() {
  state.seconds--;
  updateStats();
  if (state.seconds <= 0) endGame("时间到");
}

function endGame(text) {
  clearInterval(state.timer);
  state.locked = true;
  draw();
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div><strong>${text}</strong><button class="primary">再来一局</button></div>`;
  overlay.querySelector("button").addEventListener("click", startGame);
  document.querySelector(".board-wrap").append(overlay);
}

function markSelection() {
  document.querySelectorAll(".tile").forEach(tile => tile.classList.remove("selected"));
  if (state.selected) tileAt(state.selected.r, state.selected.c).classList.add("selected");
}

function updateStats() {
  els.time.textContent = `${String(Math.floor(state.seconds / 60)).padStart(2, "0")}:${String(state.seconds % 60).padStart(2, "0")}`;
  els.moves.textContent = state.moves;
  els.left.textContent = state.left;
}

function tileAt(r, c) {
  return els.board.querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

function setMessage(text) {
  els.message.textContent = text;
}

function sameCell(a, b) {
  return a.r === b.r && a.c === b.c;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

els.newGame.addEventListener("click", startGame);
els.hint.addEventListener("click", showHint);
els.shuffle.addEventListener("click", () => reshuffle());
els.difficulty.addEventListener("change", startGame);
window.addEventListener("resize", () => {
  clearLine();
  sizeCanvas();
});

startGame();
