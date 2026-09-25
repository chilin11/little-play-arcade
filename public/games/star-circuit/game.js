export const DIRECTIONS = Object.freeze([
  { name: 'U', bit: 1, opposite: 4, row: -1, col: 0, label: '上' },
  { name: 'R', bit: 2, opposite: 8, row: 0, col: 1, label: '右' },
  { name: 'D', bit: 4, opposite: 1, row: 1, col: 0, label: '下' },
  { name: 'L', bit: 8, opposite: 2, row: 0, col: -1, label: '左' }
]);

const DIRECTION_BITS = Object.freeze({ U: 1, R: 2, D: 4, L: 8 });

/** Rotate a four-way connection mask clockwise by 90 degrees per turn. */
export function rotateMask(mask, turns = 1) {
  let result = Number(mask) & 15;
  let count = ((Number(turns) % 4) + 4) % 4;
  while (count > 0) {
    result = ((result << 1) & 15) | ((result >> 3) & 1);
    count -= 1;
  }
  return result;
}

/** Return every cell reachable from the source through matching U/R/D/L ports. */
export function getConnectedCells(masks, size, sourceIndex) {
  const cells = new Set();
  const total = Number(size) * Number(size);
  const start = Number(sourceIndex);
  if (!Array.isArray(masks) || !Number.isInteger(size) || size < 1 || start < 0 || start >= total) return cells;

  const queue = [start];
  cells.add(start);
  while (queue.length) {
    const index = queue.shift();
    const row = Math.floor(index / size);
    const col = index % size;
    const mask = Number(masks[index]) & 15;
    for (const direction of DIRECTIONS) {
      if (!(mask & direction.bit)) continue;
      const nextRow = row + direction.row;
      const nextCol = col + direction.col;
      if (nextRow < 0 || nextRow >= size || nextCol < 0 || nextCol >= size) continue;
      const nextIndex = nextRow * size + nextCol;
      if (cells.has(nextIndex)) continue;
      if ((Number(masks[nextIndex]) & 15) & direction.opposite) {
        cells.add(nextIndex);
        queue.push(nextIndex);
      }
    }
  }
  return cells;
}

/** Count and verify beacons reached from a source. Extra open ends are allowed. */
export function getBeaconProgress(masks, size, sourceIndex, beacons) {
  const connected = getConnectedCells(masks, size, sourceIndex);
  const targets = Array.isArray(beacons) ? beacons : [];
  const connectedCount = targets.reduce((count, index) => count + (connected.has(index) ? 1 : 0), 0);
  return { connected, connectedCount, total: targets.length, complete: connectedCount === targets.length };
}

export function allBeaconsConnected(masks, size, sourceIndex, beacons) {
  return getBeaconProgress(masks, size, sourceIndex, beacons).complete;
}

export function maskFrom(pattern) {
  if (typeof pattern === 'number') return pattern & 15;
  if (!pattern || pattern === '0' || pattern === '-') return 0;
  return String(pattern).toUpperCase().split('').reduce((mask, direction) => mask | (DIRECTION_BITS[direction] || 0), 0);
}

function rowsToMasks(rows) {
  return rows.flatMap(row => row.map(maskFrom));
}

function makeInitialMasks(solution, source, seed) {
  return solution.map((mask, index) => {
    if (!mask || index === source) return mask;
    // A deterministic scramble keeps each hand-authored level repeatable while preserving solvability.
    return rotateMask(mask, ((index + seed) % 3) + 1);
  });
}

function createLevel({ size, name, source, beacons, rows, seed }) {
  const solution = rowsToMasks(rows);
  const initial = makeInitialMasks(solution, source, seed);
  return Object.freeze({
    size,
    name,
    source,
    beacons: Object.freeze([...beacons]),
    fixed: Object.freeze([source]),
    solution: Object.freeze(solution),
    initial: Object.freeze(initial)
  });
}

/*
 * The route layouts below are intentionally authored as readable rows. Each route
 * is a connected solution; the initial orientation is a deterministic rotation of
 * those tiles, so every level can always be solved by quarter-turns.
 */
export const LEVELS = Object.freeze([
  createLevel({
    size: 4, name: '暖光入口', source: 0, beacons: [15], seed: 1,
    rows: [
      ['R', 'LR', 'LR', 'DL'],
      ['0', '0', '0', 'UD'],
      ['0', '0', '0', 'UD'],
      ['0', '0', '0', 'U']
    ]
  }),
  createLevel({
    size: 4, name: '两路相逢', source: 0, beacons: [3, 6], seed: 2,
    rows: [
      ['R', 'LR', 'RDL', 'L'],
      ['0', '0', 'U', '0'],
      ['0', '0', '0', '0'],
      ['0', '0', '0', '0']
    ]
  }),
  createLevel({
    size: 4, name: '小小分岔', source: 0, beacons: [3, 9, 10], seed: 3,
    rows: [
      ['R', 'RDL', 'RDL', 'L'],
      ['0', 'UD', 'UD', '0'],
      ['0', 'U', 'U', '0'],
      ['0', '0', '0', '0']
    ]
  }),
  createLevel({
    size: 4, name: '四枚信标', source: 0, beacons: [3, 9, 10, 11], seed: 4,
    rows: [
      ['R', 'RDL', 'RDL', 'L'],
      ['0', 'UD', 'UD', '0'],
      ['0', 'UD', 'UR', 'L'],
      ['0', 'U', '0', '0']
    ]
  }),
  createLevel({
    size: 5, name: '长廊分线', source: 0, beacons: [4, 13, 14, 16, 24], seed: 5,
    rows: [
      ['R', 'RDL', 'LR', 'RDL', 'DL'],
      ['0', 'UD', '0', 'UD', 'UD'],
      ['0', 'UD', '0', 'U', 'UD'],
      ['0', 'U', '0', '0', 'UD'],
      ['0', '0', '0', '0', 'U']
    ]
  }),
  createLevel({
    size: 5, name: '下层回声', source: 0, beacons: [7, 11, 12, 13, 16, 24], seed: 6,
    rows: [
      ['D', '0', '0', '0', '0'],
      ['URD', 'LR', 'L', '0', '0'],
      ['URD', 'LR', 'LR', 'L', '0'],
      ['URD', 'L', '0', '0', '0'],
      ['UR', 'LR', 'LR', 'LR', 'L']
    ]
  }),
  createLevel({
    size: 5, name: '三叉花园', source: 0, beacons: [4, 6, 12, 14, 16, 18, 24], seed: 7,
    rows: [
      ['R', 'RDL', 'RDL', 'RDL', 'DL'],
      ['0', 'UD', 'UD', 'UD', 'UD'],
      ['0', 'UD', 'U', 'UD', 'UD'],
      ['0', 'U', '0', 'U', 'UD'],
      ['0', '0', '0', '0', 'U']
    ]
  }),
  createLevel({
    size: 5, name: '中央星座', source: 10, beacons: [1, 2, 11, 12, 13, 14, 21, 22], seed: 8,
    rows: [
      ['0', 'D', 'D', '0', '0'],
      ['0', 'UD', 'UD', '0', '0'],
      ['R', 'URDL', 'URDL', 'LR', 'L'],
      ['0', 'UD', 'UD', '0', '0'],
      ['0', 'U', 'U', '0', '0']
    ]
  }),
  createLevel({
    size: 6, name: '边缘航线', source: 0, beacons: [5, 14, 16, 19, 21, 28, 35], seed: 9,
    rows: [
      ['R', 'RDL', 'RDL', 'RDL', 'RDL', 'DL'],
      ['0', 'UD', 'UD', 'UD', 'UD', 'UD'],
      ['0', 'UD', 'U', 'UD', 'UD', 'UD'],
      ['0', 'U', '0', 'U', 'UD', 'UD'],
      ['0', '0', '0', '0', 'U', 'UD'],
      ['0', '0', '0', '0', '0', 'U']
    ]
  }),
  createLevel({
    size: 6, name: '落日走廊', source: 30, beacons: [5, 11, 13, 15, 20, 21, 28, 34], seed: 10,
    rows: [
      ['0', '0', '0', '0', '0', 'D'],
      ['0', '0', '0', '0', '0', 'UD'],
      ['0', 'D', '0', 'D', '0', 'UD'],
      ['0', 'UD', 'D', 'UD', '0', 'UD'],
      ['0', 'UD', 'UD', 'UD', 'D', 'UD'],
      ['R', 'LUR', 'LUR', 'LUR', 'LUR', 'LU']
    ]
  }),
  createLevel({
    size: 6, name: '深蓝分流', source: 0, beacons: [5, 13, 15, 20, 22, 23, 27, 28, 35], seed: 11,
    rows: [
      ['R', 'RDL', 'RDL', 'RDL', 'RDL', 'DL'],
      ['0', 'UD', 'UD', 'UD', '0', 'UD'],
      ['0', 'U', 'UD', 'UD', '0', 'UD'],
      ['0', '0', 'U', 'UD', 'R', 'DLU'],
      ['0', '0', '0', 'U', 'R', 'DLU'],
      ['0', '0', '0', '0', '0', 'U']
    ]
  }),
  createLevel({
    size: 6, name: '全息星港', source: 18, beacons: [1, 2, 9, 19, 20, 22, 23, 31, 32, 34], seed: 12,
    rows: [
      ['0', 'D', 'D', '0', '0', '0'],
      ['0', 'UD', 'UD', 'D', '0', '0'],
      ['0', 'UD', 'UD', 'UD', '0', '0'],
      ['R', 'URDL', 'URDL', 'LUR', 'RDL', 'L'],
      ['0', 'UD', 'UD', '0', 'UD', '0'],
      ['0', 'U', 'U', '0', 'U', '0']
    ]
  })
]);

const CELL_DIRECTION_NAMES = Object.freeze({ 1: '上', 2: '右', 3: '上、右', 4: '下', 5: '上、下', 6: '右、下', 7: '上、右、下', 8: '左', 9: '上、左', 10: '左、右', 11: '上、右、左', 12: '下、左', 13: '上、下、左', 14: '右、下、左', 15: '四个方向' });

function pathForMask(mask) {
  const endpoints = { U: '50 4', R: '96 50', D: '50 96', L: '4 50' };
  return Object.entries(DIRECTION_BITS)
    .filter(([, bit]) => mask & bit)
    .map(([name]) => `M 50 50 L ${endpoints[name]}`)
    .join(' ');
}

function tileSvg(mask, { source, beacon } = {}) {
  const path = pathForMask(mask);
  const pathMarkup = path ? `
    <path class="path-shadow" d="${path}"></path>
    <path class="path" d="${path}"></path>
    <path class="path-glow" d="${path}"></path>
    <circle cx="50" cy="50" r="5" fill="var(--teal)"></circle>` : '<circle cx="50" cy="50" r="2.5" fill="rgba(35,109,104,.13)"></circle>';
  const sourceMarkup = source ? `
    <circle class="source-halo" cx="50" cy="50" r="15"></circle>
    <circle class="source-core" cx="50" cy="50" r="8"></circle>
    <path class="source-star" d="M50 44 l1.8 4 4.2.4-3.2 2.7 1 4.1-3.8-2.2-3.8 2.2 1-4.1-3.2-2.7 4.2-.4z"></path>` : '';
  const beaconMarkup = beacon ? `
    <circle class="beacon-ring" cx="50" cy="50" r="15"></circle>
    <circle class="beacon-core" cx="50" cy="50" r="7"></circle>
    <circle class="beacon-spark" cx="47.5" cy="47" r="2.1"></circle>` : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><rect class="tile-bg" x="1" y="1" width="98" height="98" rx="9"></rect>${pathMarkup}${sourceMarkup}${beaconMarkup}</svg>`;
}

function storageRead(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}

function storageWrite(key, value) {
  try { globalThis.localStorage?.setItem(key, value); return true; } catch { return false; }
}

function loadProgress() {
  const fallback = { unlocked: 1, completed: Array(LEVELS.length).fill(false), best: Array(LEVELS.length).fill(null) };
  try {
    const stored = JSON.parse(storageRead('star-circuit-lab-progress') || 'null');
    if (!stored || typeof stored !== 'object') return fallback;
    const unlocked = Math.min(LEVELS.length, Math.max(1, Number(stored.unlocked) || 1));
    const completed = Array.from({ length: LEVELS.length }, (_, index) => Boolean(stored.completed?.[index]));
    const best = Array.from({ length: LEVELS.length }, (_, index) => {
      const value = Number(stored.best?.[index]);
      return Number.isFinite(value) && value > 0 ? value : null;
    });
    return { unlocked, completed, best };
  } catch {
    return fallback;
  }
}

function saveProgress(progress) {
  return storageWrite('star-circuit-lab-progress', JSON.stringify(progress));
}

function mountGame() {
  if (typeof document === 'undefined') return;
  const ids = ['board', 'level-label', 'progress-label', 'message', 'rotation-label', 'moves', 'hints', 'best', 'hint', 'undo', 'reset', 'save-note', 'level-list', 'unlock-label', 'win-dialog', 'win-copy', 'dialog-replay', 'dialog-next'];
  if (!ids.every(id => document.getElementById(id))) return;

  const boardElement = document.getElementById('board');
  const progressLabel = document.getElementById('progress-label');
  const message = document.getElementById('message');
  const rotationLabel = document.getElementById('rotation-label');
  const levelLabel = document.getElementById('level-label');
  const movesLabel = document.getElementById('moves');
  const hintsLabel = document.getElementById('hints');
  const bestLabel = document.getElementById('best');
  const hintButton = document.getElementById('hint');
  const undoButton = document.getElementById('undo');
  const resetButton = document.getElementById('reset');
  const saveNote = document.getElementById('save-note');
  const levelList = document.getElementById('level-list');
  const unlockLabel = document.getElementById('unlock-label');
  const dialog = document.getElementById('win-dialog');
  const dialogCopy = document.getElementById('win-copy');
  const dialogReplay = document.getElementById('dialog-replay');
  const dialogNext = document.getElementById('dialog-next');

  const progress = loadProgress();
  let currentIndex = 0;
  let level = LEVELS[currentIndex];
  let masks = [...level.initial];
  let moves = 0;
  let hintsLeft = 3;
  let history = [];
  let completed = false;
  let connected = new Set();
  let hintTimer = 0;
  let numberBuffer = '';
  let numberTimer = 0;
  let storageAvailable = true;
  let dialogReturnFocus = null;

  function setMessage(text) { message.textContent = text; }

  function levelCellLabel(index) {
    const row = Math.floor(index / level.size) + 1;
    const col = (index % level.size) + 1;
    const mask = masks[index];
    const directionText = CELL_DIRECTION_NAMES[mask] || '没有接口';
    if (index === level.source) return `第 ${row} 行第 ${col} 列，固定能量起点，接口向${directionText}`;
    if (level.beacons.includes(index)) return `第 ${row} 行第 ${col} 列，${connected.has(index) ? '已点亮' : '未点亮'}信标，接口向${directionText}`;
    return `第 ${row} 行第 ${col} 列，线路板，接口向${directionText}`;
  }

  function updateCell(button, index) {
    const isSource = index === level.source;
    const isBeacon = level.beacons.includes(index);
    button.className = 'cell';
    if (isSource) button.classList.add('source', 'fixed');
    if (isBeacon) button.classList.add('beacon');
    if (connected.has(index)) button.classList.add('powered');
    button.setAttribute('aria-label', levelCellLabel(index));
    button.setAttribute('aria-rowindex', String(Math.floor(index / level.size) + 1));
    button.setAttribute('aria-colindex', String((index % level.size) + 1));
    button.setAttribute('aria-disabled', String(isSource));
    button.innerHTML = tileSvg(masks[index], { source: isSource, beacon: isBeacon });
  }

  function updateBoardVisuals() {
    const result = getBeaconProgress(masks, level.size, level.source, level.beacons);
    connected = result.connected;
    [...boardElement.children].forEach((button, index) => updateCell(button, index));
    progressLabel.textContent = `信标 ${result.connectedCount} / ${result.total}`;
    movesLabel.textContent = String(moves);
    hintsLabel.textContent = String(hintsLeft);
    rotationLabel.textContent = `旋转 ${moves} 次`;
    bestLabel.textContent = progress.best[currentIndex] ? `${progress.best[currentIndex]} 次` : '—';
    hintButton.disabled = hintsLeft <= 0 || completed;
    undoButton.disabled = history.length === 0;
    if (!storageAvailable) saveNote.textContent = '浏览器没有开放存储，不过星路照样可以玩。';
  }

  function buildBoard() {
    boardElement.style.setProperty('--board-size', String(level.size));
    boardElement.setAttribute('aria-label', `${level.size} 乘 ${level.size} 线路板棋盘，第 ${currentIndex + 1} 关`);
    boardElement.innerHTML = '';
    for (let index = 0; index < level.size * level.size; index += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.index = String(index);
      button.setAttribute('role', 'gridcell');
      button.addEventListener('click', () => rotateCell(index));
      button.addEventListener('keydown', event => moveFocus(event, index));
      boardElement.append(button);
    }
    updateBoardVisuals();
  }

  function updateLabels() {
    levelLabel.textContent = `第 ${currentIndex + 1} 关 · ${level.name}`;
    unlockLabel.textContent = `已解锁 ${progress.unlocked} / ${LEVELS.length}`;
  }

  function renderLevelList() {
    levelList.innerHTML = '';
    LEVELS.forEach((item, index) => {
      const button = document.createElement('button');
      const locked = index >= progress.unlocked;
      button.type = 'button';
      button.className = 'level-button';
      if (index === currentIndex) button.classList.add('current');
      if (progress.completed[index]) button.classList.add('completed');
      if (locked) button.classList.add('locked');
      button.disabled = locked;
      button.setAttribute('role', 'listitem');
      button.setAttribute('aria-label', locked ? `第 ${index + 1} 关，尚未解锁` : `选择第 ${index + 1} 关，${item.name}`);
      if (index === currentIndex) button.setAttribute('aria-current', 'true');
      button.innerHTML = `<span class="level-number">${locked ? '·' : index + 1}</span><small>${locked ? '待解锁' : item.size + '×' + item.size}</small>`;
      if (!locked) button.addEventListener('click', () => selectLevel(index));
      levelList.append(button);
    });
  }

  function hideDialog() {
    if (dialog.open) dialog.close();
  }

  function showDialog() {
    dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogCopy.textContent = `你用 ${moves} 次旋转，让 ${level.beacons.length} 枚信标都接到了能量。`;
    dialogNext.hidden = currentIndex >= LEVELS.length - 1;
    if (!dialog.open) dialog.showModal();
    const focusTarget = dialogNext.hidden ? dialogReplay : dialogNext;
    window.setTimeout(() => focusTarget.focus(), 0);
  }

  function persistProgress() {
    if (!saveProgress(progress)) storageAvailable = false;
  }

  function completeLevel() {
    if (completed) return;
    completed = true;
    progress.completed[currentIndex] = true;
    if (!progress.best[currentIndex] || moves < progress.best[currentIndex]) progress.best[currentIndex] = moves;
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, currentIndex + 2));
    persistProgress();
    updateLabels();
    renderLevelList();
    updateBoardVisuals();
    setMessage('所有信标都亮起来了，星路接通！');
    showDialog();
  }

  function syncGame(messageText) {
    updateBoardVisuals();
    if (messageText) setMessage(messageText);
    if (!completed && allBeaconsConnected(masks, level.size, level.source, level.beacons)) completeLevel();
  }

  function rotateCell(index) {
    if (completed) return;
    if (index === level.source) {
      setMessage('起点固定不转动，它会告诉你能量从哪里出发。');
      return;
    }
    const previous = masks.slice();
    history.push({ masks: previous, moves });
    masks[index] = rotateMask(masks[index], 1);
    moves += 1;
    const result = getBeaconProgress(masks, level.size, level.source, level.beacons);
    const remaining = result.total - result.connectedCount;
    syncGame(remaining ? `转好了，这条路现在点亮 ${result.connectedCount} 枚信标，还剩 ${remaining} 枚。` : '最后一枚信标也亮起来了！');
  }

  function undo() {
    const previous = history.pop();
    if (!previous) {
      setMessage('这里还没有可以撤销的旋转。');
      return;
    }
    masks = previous.masks;
    moves = previous.moves;
    completed = false;
    hideDialog();
    const result = getBeaconProgress(masks, level.size, level.source, level.beacons);
    syncGame(`退回一步，已有 ${result.connectedCount} 枚信标接到能量。`);
  }

  function restartLevel() {
    masks = [...level.initial];
    moves = 0;
    hintsLeft = 3;
    history = [];
    completed = false;
    hideDialog();
    clearTimeout(hintTimer);
    setMessage('线路板回到原位了，慢慢观察起点和分岔。');
    updateBoardVisuals();
  }

  function useHint() {
    if (hintsLeft <= 0 || completed) return;
    hintsLeft -= 1;
    const candidate = level.solution.findIndex((solutionMask, index) => index !== level.source && solutionMask && masks[index] !== solutionMask);
    const index = candidate >= 0 ? candidate : level.beacons.find(beaconIndex => beaconIndex !== level.source) ?? 0;
    const cell = boardElement.children[index];
    if (cell) {
      cell.classList.add('highlight');
      clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => cell.classList.remove('highlight'), 2900);
      cell.focus({ preventScroll: true });
    }
    updateBoardVisuals();
    if (cell) cell.classList.add('highlight');
    setMessage(`提示 ${3 - hintsLeft}/3：先观察琥珀色边框里的线路板，它还需要换一个方向。`);
  }

  function moveFocus(event, index) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Spacebar'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      rotateCell(index);
      return;
    }
    const row = Math.floor(index / level.size);
    const col = index % level.size;
    let nextRow = row;
    let nextCol = col;
    if (event.key === 'ArrowUp') nextRow = Math.max(0, row - 1);
    if (event.key === 'ArrowDown') nextRow = Math.min(level.size - 1, row + 1);
    if (event.key === 'ArrowLeft') nextCol = Math.max(0, col - 1);
    if (event.key === 'ArrowRight') nextCol = Math.min(level.size - 1, col + 1);
    boardElement.children[nextRow * level.size + nextCol]?.focus();
  }

  function selectLevel(index) {
    if (index < 0 || index >= LEVELS.length || index >= progress.unlocked) return;
    currentIndex = index;
    level = LEVELS[currentIndex];
    masks = [...level.initial];
    moves = 0;
    hintsLeft = 3;
    history = [];
    completed = false;
    hideDialog();
    clearTimeout(hintTimer);
    updateLabels();
    renderLevelList();
    buildBoard();
    setMessage(`第 ${currentIndex + 1} 关：从固定起点出发，接上 ${level.beacons.length} 枚信标。`);
  }

  function selectByNumber(key) {
    clearTimeout(numberTimer);
    numberBuffer = `${numberBuffer}${key}`.slice(-2);
    let requested = Number(numberBuffer);
    if (requested > LEVELS.length) {
      numberBuffer = key;
      requested = Number(key);
    }
    if (requested >= 1 && requested <= LEVELS.length) {
      selectLevel(requested - 1);
      numberTimer = window.setTimeout(() => { numberBuffer = ''; }, 720);
    }
  }

  hintButton.addEventListener('click', useHint);
  undoButton.addEventListener('click', undo);
  resetButton.addEventListener('click', restartLevel);
  dialogReplay.addEventListener('click', restartLevel);
  dialogNext.addEventListener('click', () => selectLevel(currentIndex + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [dialogReplay, dialogNext].filter(button => !button.hidden && !button.disabled);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener('close', () => {
    if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus({ preventScroll: true });
    dialogReturnFocus = null;
  });
  document.addEventListener('keydown', event => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      selectByNumber(event.key);
    }
  });

  updateLabels();
  renderLevelList();
  buildBoard();
  setMessage('从蓝绿色的起点开始，慢慢接上每一条路。');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountGame, { once: true });
  else mountGame();
}
