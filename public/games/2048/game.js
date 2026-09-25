export const STORAGE_KEY = 'little-play-2048-v1';
export const BEST_KEY = 'little-play-2048-best-v1';
const DIRECTIONS = ['left', 'right', 'up', 'down'];

// Pure movement: each input tile participates in at most one merge.
export function mergeLine(line) {
  const values = line.filter(value => value !== 0);
  const merged = [];
  let score = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const value = values[i] * 2;
      merged.push(value);
      score += value;
      i++;
    } else {
      merged.push(values[i]);
    }
  }
  while (merged.length < 4) merged.push(0);
  return { line: merged, score };
}

export function moveBoard(board, direction) {
  if (!DIRECTIONS.includes(direction)) throw new RangeError('Unknown direction');
  const next = board.slice();
  let score = 0;
  for (let lane = 0; lane < 4; lane++) {
    const indices = Array.from({ length: 4 }, (_, offset) => {
      const position = direction === 'right' || direction === 'down' ? 3 - offset : offset;
      return direction === 'left' || direction === 'right' ? lane * 4 + position : position * 4 + lane;
    });
    const result = mergeLine(indices.map(index => board[index]));
    indices.forEach((index, offset) => { next[index] = result.line[offset]; });
    score += result.score;
  }
  return { board: next, score, changed: next.some((value, index) => value !== board[index]) };
}

// Injected randomness keeps the production rules directly testable, without window hooks.
export function spawnTile(board, random = Math.random) {
  const empty = board.flatMap((value, index) => value === 0 ? [index] : []);
  if (!empty.length) return { board: board.slice(), index: -1 };
  const index = empty[Math.floor(random() * empty.length)];
  const next = board.slice();
  next[index] = random() < 0.9 ? 2 : 4;
  return { board: next, index };
}

export function advanceBoard(board, direction, random = Math.random) {
  const moved = moveBoard(board, direction);
  return moved.changed ? { ...moved, ...spawnTile(moved.board, random) } : { ...moved, index: -1 };
}

export function canMove(board) {
  return board.some((value, index) => value === 0 ||
    (index % 4 < 3 && value === board[index + 1]) ||
    (index < 12 && value === board[index + 4]));
}

function validScore(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function validateSnapshot(value) {
  if (!value || !Array.isArray(value.board) || value.board.length !== 16 ||
      !value.board.every(tile => tile === 0 || (Number.isSafeInteger(tile) && tile >= 2 && Number.isInteger(Math.log2(tile)))) ||
      !value.board.some(tile => tile > 0) || !validScore(value.score) || typeof value.continued !== 'boolean' ||
      (value.continued && !value.board.some(tile => tile >= 2048))) return null;
  return { board: value.board.slice(), score: value.score, continued: value.continued };
}

export function parseSaved(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    const state = validateSnapshot(data.state);
    if (!state) return null;
    return { state, previous: validateSnapshot(data.previous) };
  } catch {
    return null;
  }
}

function newGame() {
  return { board: spawnTile(spawnTile(Array(16).fill(0)).board).board, score: 0, continued: false };
}

function mountGame() {
  const $ = id => document.getElementById(id);
  const boardElement = $('board');
  const restartDialog = $('restart-dialog');
  const resultDialog = $('result-dialog');
  let storageAvailable = true;
  let best = 0;
  let saved = null;
  try {
    saved = parseSaved(localStorage.getItem(STORAGE_KEY));
    const storedBest = Number(localStorage.getItem(BEST_KEY));
    if (validScore(storedBest)) best = storedBest;
  } catch {
    storageAvailable = false;
  }
  let state = saved?.state || newGame();
  let previous = saved?.previous || null;
  best = Math.max(best, state.score, previous?.score || 0);
  let announcementTimer;
  let gesture = null;

  function save() {
    try {
      // Re-read to avoid lowering a record set in another tab.
      const storedBest = Number(localStorage.getItem(BEST_KEY));
      if (validScore(storedBest)) best = Math.max(best, storedBest);
      localStorage.setItem(BEST_KEY, String(best));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, state, previous }));
    } catch {
      storageAvailable = false;
    }
    $('best').textContent = String(best);
    $('save-note').textContent = storageAvailable ? '进度自动保存，下次接着玩。' : '浏览器存储不可用，本局仍可玩；关闭后进度不保留。';
  }

  // Coalesce rapid keyboard/swipe updates; only this small region is live.
  function announce(message, immediate = false) {
    clearTimeout(announcementTimer);
    const update = () => { if ($('status').textContent !== message) $('status').textContent = message; };
    if (immediate) update();
    else announcementTimer = setTimeout(update, 180);
  }

  function showResult() {
    const won = !state.continued && state.board.some(value => value >= 2048);
    const over = !canMove(state.board);
    if (!won && !over) return;
    $('result-title').textContent = won ? '你好，2048！' : '这一程，收获满满。';
    $('result-eyebrow').textContent = won ? 'A LITTLE WONDER' : 'UNTIL NEXT TIME';
    $('result-description').textContent = won ? '小小的积累，终于闪光。还想看看数字能走多远吗？' : `没有可以移动的方块了。本局得分 ${state.score}，换个思路再来一次吧。`;
    $('continue').hidden = !won;
    $('result-undo').hidden = won || !previous;
    if (!resultDialog.open) resultDialog.showModal();
    announce(won ? '已合出 2048！可以继续挑战。' : `本局结束，得分 ${state.score}。`, true);
  }

  function render(newIndex = -1) {
    const cells = state.board.map((value, index) => {
      const cell = document.createElement('div');
      const digits = String(value).length;
      cell.className = ['tile', value > 2048 ? 'high' : '', digits >= 4 ? 'long' : '', digits >= 5 ? 'very-long' : '', index === newIndex ? 'new' : ''].filter(Boolean).join(' ');
      cell.dataset.value = String(value);
      cell.setAttribute('role', 'img');
      cell.setAttribute('aria-label', `第 ${Math.floor(index / 4) + 1} 行，第 ${index % 4 + 1} 列：${value || '空'}`);
      cell.textContent = value ? (digits > 7 ? value.toExponential(1) : String(value)) : '';
      if (value) cell.title = String(value);
      return cell;
    });
    boardElement.replaceChildren(...cells);
    $('score').textContent = String(state.score);
    $('undo').disabled = !previous;
    save();
    showResult();
  }

  function move(direction) {
    if (restartDialog.open || resultDialog.open) return;
    const result = advanceBoard(state.board, direction);
    if (!result.changed) {
      announce('这个方向暂时走不动，换个方向试试。');
      showResult();
      return;
    }
    previous = { ...state, board: state.board.slice() };
    state = { ...state, board: result.board, score: state.score + result.score };
    best = Math.max(best, state.score);
    announce(result.score ? `合并获得 ${result.score} 分，当前 ${state.score} 分。` : '留一点空位，等待下一次相遇。');
    render(result.index);
  }

  function undo() {
    if (!previous) return;
    if (resultDialog.open) resultDialog.close();
    state = previous;
    previous = null;
    announce('已撤销一步，最佳记录仍然保留。', true);
    render();
    boardElement.focus({ preventScroll: true });
  }

  function restart() {
    restartDialog.close();
    resultDialog.close();
    state = newGame();
    previous = null;
    announce('新的一局，从两个小数字开始。', true);
    render();
    boardElement.focus({ preventScroll: true });
  }

  function continueGame() {
    state.continued = true;
    resultDialog.close();
    announce('2048 只是开始，继续向更大的数字出发。', true);
    render();
    if (!resultDialog.open) boardElement.focus({ preventScroll: true });
  }

  $('restart').addEventListener('click', () => restartDialog.showModal());
  $('cancel-restart').addEventListener('click', () => restartDialog.close());
  $('confirm-restart').addEventListener('click', restart);
  $('undo').addEventListener('click', undo);
  $('result-undo').addEventListener('click', undo);
  $('continue').addEventListener('click', continueGame);
  $('retry').addEventListener('click', () => {
    // A loss has no playable progress to discard; a win still asks for confirmation.
    if (canMove(state.board)) restartDialog.showModal();
    else restart();
  });
  resultDialog.addEventListener('cancel', event => {
    if (!state.continued && state.board.some(value => value >= 2048)) {
      event.preventDefault();
      continueGame();
    }
  });
  document.querySelectorAll('[data-direction]').forEach(button => {
    button.addEventListener('click', () => move(button.dataset.direction));
  });
  const keys = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down' };
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || restartDialog.open || resultDialog.open ||
        event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const direction = keys[event.key] || keys[event.key.toLowerCase()];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  });

  boardElement.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || restartDialog.open || resultDialog.open) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    boardElement.setPointerCapture(event.pointerId);
    boardElement.focus({ preventScroll: true });
  });
  boardElement.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  const cancelGesture = () => { gesture = null; };
  boardElement.addEventListener('pointercancel', cancelGesture);
  boardElement.addEventListener('lostpointercapture', cancelGesture);
  window.addEventListener('blur', cancelGesture);
  document.addEventListener('visibilitychange', cancelGesture);

  if (saved) announce('已接着上次的进度，慢慢来。', true);
  render();
}

if (typeof document !== 'undefined' && document.getElementById('board')) mountGame();
