'use strict';

const SIZE = 15;
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const $ = id => document.getElementById(id);
const boardElement = $('board');
let board, history, turn, finished, thinking, timer;
let mode = 'ai';
let pendingAction = null;
const cells = [];

for (let row = 0; row < SIZE; row++) {
  for (let col = 0; col < SIZE; col++) {
    const cell = document.createElement('button');
    cell.className = 'cell' + (row === 0 ? ' top' : '') + (row === 14 ? ' bottom' : '') + (col === 0 ? ' left' : '') + (col === 14 ? ' right' : '');
    cell.setAttribute('aria-label', `第${row + 1}行，第${col + 1}列，空位`);
    if ([3, 7, 11].includes(row) && [3, 7, 11].includes(col) && (row === col || row + col === 14)) {
      const star = document.createElement('span');
      star.className = 'star';
      cell.appendChild(star);
    }
    const preview = document.createElement('span');
    preview.className = 'preview-stone';
    preview.setAttribute('aria-hidden', 'true');
    cell.appendChild(preview);
    cell.addEventListener('click', () => play(row, col));
    cell.addEventListener('keydown', event => {
      const offsets = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (!offsets[event.key]) return;
      event.preventDefault();
      const [dr, dc] = offsets[event.key];
      cells[Math.max(0, Math.min(14, row + dr)) * SIZE + Math.max(0, Math.min(14, col + dc))].focus();
    });
    boardElement.appendChild(cell);
    cells.push(cell);
  }
}

function inside(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

function winningLine(r, c, player) {
  for (const [dr, dc] of DIRECTIONS) {
    const line = [[r, c]];
    for (const sign of [-1, 1]) {
      let nr = r + dr * sign, nc = c + dc * sign;
      while (inside(nr, nc) && board[nr][nc] === player) {
        line.push([nr, nc]);
        nr += dr * sign;
        nc += dc * sign;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

function render(line = null) {
  const last = history[history.length - 1];
  cells.forEach((cell, index) => {
    const row = Math.floor(index / SIZE), col = index % SIZE, value = board[row][col];
    const old = cell.querySelector('.stone');
    if (old && !value) old.remove();
    if (value) {
      const stone = old || document.createElement('span');
      stone.className = `stone ${value === 1 ? 'black' : 'white'}`;
      if (last && last.row === row && last.col === col) stone.classList.add('last');
      if (line?.some(([r, c]) => r === row && c === col)) stone.classList.add('winner');
      if (!old) cell.appendChild(stone);
    }
    cell.classList.toggle('occupied', Boolean(value));
    cell.setAttribute('aria-label', `第${row + 1}行，第${col + 1}列，${value ? (value === 1 ? '黑棋' : '白棋') : '空位'}`);
    cell.setAttribute('aria-disabled', String(Boolean(value || finished || thinking)));
  });
  boardElement.classList.toggle('locked', finished || thinking);
  boardElement.classList.toggle('white-turn', turn === 2);
  $('move-count').textContent = finished ? `共 ${history.length} 手` : `第 ${String(history.length + 1).padStart(2, '0')} 手`;
  $('undo').disabled = history.length === 0;
  $('black-name').textContent = mode === 'ai' ? '你' : '黑方';
  $('white-name').textContent = mode === 'ai' ? '电脑' : '白方';
  for (const [id, player] of [['black-player', 1], ['white-player', 2]]) {
    const active = !finished && turn === player;
    $(id).classList.toggle('active', active);
    $(id).querySelector('.turn-label').textContent = finished ? '已结束' : active ? (thinking ? '思考中' : '落子中') : '等待中';
  }
  $('game-label').textContent = finished ? '对局已结束' : '对局进行中';
  if (finished) {
    $('status-icon').textContent = line ? '✧' : '◎';
    $('status-title').textContent = line ? (mode === 'ai' ? (turn === 1 ? '恭喜，你赢了！' : '电脑获胜，再接再厉！') : `${turn === 1 ? '黑方' : '白方'}获胜！`) : '旗鼓相当，本局和棋';
    $('status-detail').textContent = line ? '五子连珠，好棋！再来一局吧。' : '棋盘已满，开启新局再分高下。';
  } else {
    $('status-icon').textContent = '✦';
    $('status-title').textContent = thinking ? '电脑正在思考…' : mode === 'ai' ? '轮到你落子' : `轮到${turn === 1 ? '黑方' : '白方'}落子`;
    $('status-detail').textContent = thinking ? '从容思考，静候下一步。' : history.length === 0 ? '执黑先行，选一个好位置。' : '纵横之间，寻找你的五子连线。';
  }
}

function place(row, col) {
  board[row][col] = turn;
  history.push({ row, col, player: turn });
  const line = winningLine(row, col, turn);
  if (line || history.length === SIZE * SIZE) {
    finished = true;
    thinking = false;
    render(line);
    return;
  }
  turn = 3 - turn;
  thinking = mode === 'ai' && turn === 2;
  render();
  if (thinking) timer = setTimeout(computerMove, 400);
}

function play(row, col) {
  if (finished || thinking || board[row][col]) return;
  place(row, col);
}

// Evaluate contiguous and broken lines, prioritizing wins and immediate threats.
function scoreMove(row, col, player) {
  board[row][col] = player;
  if (winningLine(row, col, player)) { board[row][col] = 0; return 10000000; }
  let score = 0, threats = 0;
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1, open = 0;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign, c = col + dc * sign;
      while (inside(r, c) && board[r][c] === player) { count++; r += dr * sign; c += dc * sign; }
      if (inside(r, c) && !board[r][c]) open++;
    }
    if (count === 4 && open) { score += open === 2 ? 100000 : 12000; threats++; }
    else if (count === 3 && open === 2) { score += 6000; threats++; }
    else if (count === 3 && open === 1) score += 500;
    else if (count === 2 && open === 2) score += 300;
    else if (count === 2 && open === 1) score += 40;
    else if (open === 2) score += 15;
    for (let offset = -4; offset <= 0; offset++) {
      let stones = 0, valid = true;
      for (let step = 0; step < 5; step++) {
        const r = row + (offset + step) * dr, c = col + (offset + step) * dc;
        if (!inside(r, c) || board[r][c] === 3 - player) { valid = false; break; }
        if (board[r][c] === player) stones++;
      }
      if (valid) score += [0, 1, 10, 150, 8000, 10000000][stones];
    }
  }
  board[row][col] = 0;
  return score + (threats >= 2 ? 18000 : 0);
}

function computerMove() {
  if (!thinking || finished) return;
  let best = null, bestScore = -Infinity;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c]) continue;
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (inside(r + dr, c + dc) && board[r + dr][c + dc]) { near = true; break; }
        }
      }
      if (!near) continue;
      const attack = scoreMove(r, c, 2), defense = scoreMove(r, c, 1);
      const score = attack >= 10000000 ? 100000000 : defense >= 10000000 ? 50000000 + attack : attack + defense * 1.12 + (14 - Math.abs(r - 7) - Math.abs(c - 7));
      if (score > bestScore) { bestScore = score; best = [r, c]; }
    }
  }
  thinking = false;
  if (best) place(...best);
}

function reset() {
  clearTimeout(timer);
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  history = [];
  turn = 1;
  finished = false;
  thinking = false;
  render();
}

function requestReset(action) {
  if (history.length && !finished) {
    pendingAction = action;
    $('confirm-dialog').showModal();
  } else action();
}

$('restart').addEventListener('click', () => requestReset(reset));
$('cancel-reset').addEventListener('click', () => { pendingAction = null; $('confirm-dialog').close(); });
$('confirm-dialog').addEventListener('cancel', () => { pendingAction = null; });
$('confirm-reset').addEventListener('click', () => {
  $('confirm-dialog').close();
  const action = pendingAction;
  pendingAction = null;
  action?.();
});
for (const nextMode of ['ai', 'local']) {
  $(`${nextMode}-mode`).addEventListener('click', () => {
    if (mode === nextMode) return;
    requestReset(() => {
      mode = nextMode;
      for (const option of ['ai', 'local']) {
        $(`${option}-mode`).classList.toggle('active', option === mode);
        $(`${option}-mode`).setAttribute('aria-pressed', String(option === mode));
      }
      reset();
    });
  });
}
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  clearTimeout(timer);
  const removeLast = () => {
    const move = history.pop();
    board[move.row][move.col] = 0;
    turn = move.player;
  };
  removeLast();
  if (mode === 'ai' && turn === 2 && history.length) removeLast();
  finished = false;
  thinking = false;
  render();
});
reset();
