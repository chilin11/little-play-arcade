export const LEVELS = Object.freeze({
  classic: Object.freeze({ size: 9, mines: 10, name: '经典' }),
  hard: Object.freeze({ size: 12, mines: 24, name: '进阶' })
});

// The model is independent of the DOM; randomness is injectable, not exposed globally.
export class Minesweeper {
  constructor(level = 'classic', random = Math.random) {
    this.level = LEVELS[level] ? level : 'classic';
    Object.assign(this, LEVELS[this.level]);
    this.random = random;
    this.cells = Array.from({ length: this.size ** 2 }, () => ({ mine: false, count: 0, revealed: false, flagged: false }));
    this.state = 'ready';
    this.flags = 0;
    this.revealed = 0;
    this.exploded = -1;
  }

  neighbors(index) {
    const row = Math.floor(index / this.size), col = index % this.size, result = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr, c = col + dc;
        if ((dr || dc) && r >= 0 && r < this.size && c >= 0 && c < this.size) result.push(r * this.size + c);
      }
    }
    return result;
  }

  seed(index) {
    const safe = new Set([index, ...this.neighbors(index)]);
    const candidates = this.cells.map((_, i) => i).filter(i => !safe.has(i));
    // Partial Fisher–Yates: exactly the requested number of distinct, uniformly placed mines.
    for (let i = 0; i < this.mines; i++) {
      const j = i + Math.floor(this.random() * (candidates.length - i));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      this.cells[candidates[i]].mine = true;
    }
    this.cells.forEach((cell, i) => { cell.count = this.neighbors(i).filter(n => this.cells[n].mine).length; });
    this.state = 'playing';
  }

  toggleFlag(index) {
    const cell = this.cells[index];
    if (!cell || cell.revealed || this.finished) return false;
    if (!cell.flagged && this.flags >= this.mines) return false;
    cell.flagged = !cell.flagged;
    this.flags += cell.flagged ? 1 : -1;
    return true;
  }

  reveal(index) {
    const cell = this.cells[index];
    if (!cell || cell.flagged || cell.revealed || this.finished) return false;
    if (this.state === 'ready') this.seed(index);
    if (cell.mine) {
      this.state = 'lost';
      this.exploded = index;
      this.cells.forEach(item => { if (item.mine) item.revealed = true; });
      return true;
    }
    const queue = [index];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor], item = this.cells[current];
      if (item.revealed || item.flagged || item.mine) continue;
      item.revealed = true;
      this.revealed++;
      if (item.count === 0) queue.push(...this.neighbors(current));
    }
    if (this.revealed === this.cells.length - this.mines) this.state = 'won';
    return true;
  }

  get finished() { return this.state === 'won' || this.state === 'lost'; }
}

export function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function mountGame() {
  const $ = id => document.getElementById(id);
  const board = $('board'), dialog = $('confirm-dialog');
  let game, buttons = [], flagMode = false, focusIndex = 0;
  let startedAt = null, elapsed = 0, interval = null, pendingLevel = null;
  let storageAvailable = true;
  const bests = {};
  const storageKey = level => `minesweeper.best.${level}.v1`;
  for (const level of Object.keys(LEVELS)) {
    try {
      const raw = localStorage.getItem(storageKey(level));
      const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
      if (Number.isSafeInteger(value) && value >= 0) bests[level] = value;
    } catch { storageAvailable = false; }
  }

  function tick() {
    if (startedAt !== null) elapsed = Math.floor((performance.now() - startedAt) / 1000);
    $('timer').textContent = formatTime(elapsed);
    $('timer').setAttribute('aria-label', `本局用时 ${elapsed} 秒`);
  }

  function stopTimer() {
    clearInterval(interval);
    interval = null;
    tick();
    startedAt = null;
  }

  function announce(title, detail, icon = '✧') {
    $('status-title').textContent = title;
    $('status-detail').textContent = detail;
    $('status-icon').textContent = icon;
  }

  function render() {
    board.dataset.state = game.state;
    $('status').dataset.state = game.state;
    buttons.forEach((button, index) => {
      const cell = game.cells[index];
      const shownMine = cell.mine && cell.revealed;
      const wrongFlag = game.state === 'lost' && cell.flagged && !cell.mine;
      button.className = 'cell' + (cell.revealed ? ' revealed' : '') + (cell.flagged ? ' flagged' : '') +
        (shownMine ? ' mine' : '') + (index === game.exploded ? ' exploded' : '') + (wrongFlag ? ' wrong-flag' : '');
      button.textContent = shownMine ? '✹' : wrongFlag ? '×' : cell.flagged ? '⚑' : cell.revealed && cell.count ? String(cell.count) : '';
      // Never serialize hidden mine locations or neighbor counts into the DOM.
      if (cell.revealed && !cell.mine) button.dataset.number = String(cell.count);
      else delete button.dataset.number;
      const description = shownMine ? (index === game.exploded ? '踩中的雷' : '地雷') : wrongFlag ? '错误旗帜' :
        cell.flagged ? '已插旗，未翻开' : cell.revealed ? (cell.count ? `周围 ${cell.count} 颗雷` : '空白，周围没有雷') : '未翻开';
      button.setAttribute('aria-label', `第 ${Math.floor(index / game.size) + 1} 行，第 ${index % game.size + 1} 列，${description}`);
      button.setAttribute('aria-disabled', String(game.finished || cell.revealed));
    });
    $('flags-left').textContent = String(game.mines - game.flags);
    $('progress').textContent = `已翻开 ${game.revealed} / ${game.cells.length - game.mines}`;
    $('best').textContent = bests[game.level] === undefined ? '—' : formatTime(bests[game.level]);
    $('best-note').textContent = `${game.name} · ${storageAvailable ? '本机记录' : '本次访问'}`;
    $('storage-note').textContent = storageAvailable ? '最佳成绩按难度保存在此浏览器。' : '浏览器存储不可用，成绩仅在本次访问保留。';
    $('restart').textContent = game.finished ? '↻ 再来一局' : '↻ 重新开始';
    $('flag-mode').disabled = game.finished;
  }

  function activate(index, asFlag = flagMode) {
    if (game.finished) return;
    const previousState = game.state;
    const changed = asFlag ? game.toggleFlag(index) : game.reveal(index);
    if (!changed) {
      if (asFlag && !game.cells[index].revealed && !game.cells[index].flagged) announce('旗帜已经用完了', '先拔掉一面旗，再标记新的位置。', '⚑');
      else if (!asFlag && game.cells[index].flagged) announce('这里有一面旗', '先拔旗，再翻开；右键或 F 也可以拔旗。', '⚑');
      return;
    }
    if (previousState === 'ready' && game.state !== 'ready') {
      startedAt = performance.now();
      interval = setInterval(tick, 250);
    }
    if (game.finished) {
      stopTimer();
      if (game.state === 'won') {
        // Another tab may have completed a faster game since this page mounted.
        try {
          const raw = localStorage.getItem(storageKey(game.level));
          const stored = raw === null || raw.trim() === '' ? NaN : Number(raw);
          if (Number.isSafeInteger(stored) && stored >= 0) {
            bests[game.level] = Math.min(bests[game.level] ?? Infinity, stored);
          }
        } catch { storageAvailable = false; }
        const newBest = bests[game.level] === undefined || elapsed < bests[game.level];
        if (newBest) {
          bests[game.level] = elapsed;
          try { localStorage.setItem(storageKey(game.level), String(elapsed)); }
          catch { storageAvailable = false; }
        }
        announce('这一片，晴朗了！', `所有安全格都已翻开，用时 ${formatTime(elapsed)}。${newBest ? '刷新最佳成绩！' : '好判断！'}再来一局吧。`, '✳');
      } else announce('碰到一颗雷，歇一小会儿', '所有地雷已显示，× 表示插错的旗。再来一局，换条路探索。', '◎');
    } else if (asFlag) {
      announce(game.cells[index].flagged ? '留一面旗，记一个猜想' : '旗帜已收回', `还可使用 ${game.mines - game.flags} 面旗。${game.state === 'ready' ? '翻开第一格后才开始计时。' : '数字会为下一步指路。'}`, '⚑');
    } else announce('慢慢来，线索就在身边', `已找到 ${game.revealed} 个安全格。沿着数字，继续探索。`);
    render();
  }

  function setFlagMode(value) {
    flagMode = value;
    $('flag-mode').setAttribute('aria-pressed', String(value));
    $('mode-state').textContent = value ? '开' : '关';
    $('mode-help').textContent = value ? '当前：点按插旗或拔旗，不会翻开格子。关闭插旗模式，即可继续翻开。' : '当前：点按翻开格子。打开插旗模式后，点按可插旗或拔旗。';
    board.classList.toggle('flag-mode', value);
  }

  function focusCell(index) {
    buttons[focusIndex].tabIndex = -1;
    focusIndex = index;
    buttons[index].tabIndex = 0;
  }

  function reset(level = game?.level || 'classic') {
    stopTimer();
    elapsed = 0;
    tick();
    game = new Minesweeper(level);
    buttons = [];
    focusIndex = 0;
    setFlagMode(false);
    board.replaceChildren();
    board.dataset.difficulty = level;
    board.setAttribute('aria-label', `${game.size} 行 ${game.size} 列扫雷棋盘，${game.mines} 颗雷`);
    board.setAttribute('aria-rowcount', String(game.size));
    board.setAttribute('aria-colcount', String(game.size));
    for (let r = 0; r < game.size; r++) {
      const row = document.createElement('div');
      row.className = 'board-row';
      row.setAttribute('role', 'row');
      for (let c = 0; c < game.size; c++) {
        const index = r * game.size + c;
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'gridcell');
        button.setAttribute('aria-rowindex', String(r + 1));
        button.setAttribute('aria-colindex', String(c + 1));
        button.tabIndex = index === 0 ? 0 : -1;
        button.addEventListener('focus', () => focusCell(index));
        button.addEventListener('click', () => { focusCell(index); activate(index); });
        button.addEventListener('contextmenu', event => { event.preventDefault(); focusCell(index); button.focus(); activate(index, true); });
        button.addEventListener('keydown', event => {
          const directions = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
          if (directions[event.key]) {
            event.preventDefault();
            const [dr, dc] = directions[event.key];
            buttons[Math.max(0, Math.min(game.size - 1, r + dr)) * game.size + Math.max(0, Math.min(game.size - 1, c + dc))].focus();
          } else if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (!event.repeat) activate(index, true);
          }
          // Native button activation provides Enter and Space without duplicate events.
        });
        row.appendChild(button);
        buttons.push(button);
      }
      board.appendChild(row);
    }
    $('board-size').textContent = `${game.size} × ${game.size}`;
    $('mine-total').textContent = `共 ${game.mines} 颗雷`;
    document.querySelectorAll('[data-level]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.level === level)));
    announce('从任意一格开始', '第一步一定安全，还会展开一片空地。');
    render();
  }

  function requestReset(level) {
    if (!game.finished && (game.state === 'playing' || game.flags > 0)) {
      pendingLevel = level;
      $('dialog-title').textContent = level === game.level ? '重新开始这一局？' : `切换到${LEVELS[level].name}难度？`;
      dialog.showModal();
    } else reset(level);
  }

  $('flag-mode').addEventListener('click', () => setFlagMode(!flagMode));
  $('restart').addEventListener('click', () => requestReset(game.level));
  document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.level !== game.level) requestReset(button.dataset.level);
  }));
  $('cancel-reset').addEventListener('click', () => { pendingLevel = null; dialog.close(); });
  dialog.addEventListener('cancel', () => { pendingLevel = null; });
  $('confirm-reset').addEventListener('click', () => {
    const level = pendingLevel;
    pendingLevel = null;
    dialog.close();
    if (level) reset(level);
  });
  reset();
}

if (typeof document !== 'undefined' && document.getElementById('board')) mountGame();
