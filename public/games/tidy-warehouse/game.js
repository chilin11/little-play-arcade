const STORAGE_KEY = 'little-play:tidy-warehouse:v1';

export const DIRECTIONS = Object.freeze({
  up: Object.freeze({ key: 'up', dr: -1, dc: 0, label: '向上' }),
  right: Object.freeze({ key: 'right', dr: 0, dc: 1, label: '向右' }),
  down: Object.freeze({ key: 'down', dr: 1, dc: 0, label: '向下' }),
  left: Object.freeze({ key: 'left', dr: 0, dc: -1, label: '向左' })
});

const DIRECTION_ORDER = Object.freeze(['up', 'right', 'down', 'left']);
const KEY_TO_DIRECTION = Object.freeze({
  ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
  w: 'up', d: 'right', s: 'down', a: 'left',
  W: 'up', D: 'right', S: 'down', A: 'left'
});

function makeLevel(name, description, map) {
  return Object.freeze({ name, description, map: Object.freeze(map) });
}

/**
 * The twelve maps are deliberately small and hand-authored. Uppercase letters
 * are entities: P player, B box, G goal. A # is a wall and a . is a floor.
 */
export const LEVELS = Object.freeze([
  makeLevel('木架旁的第一箱', '熟悉仓库里的走法，把第一只木箱送到发光位。', [
    '#####',
    '#P..#',
    '#..B#',
    '#..G#',
    '#####'
  ]),
  makeLevel('绕过一面矮墙', '墙会改变路线，先走到箱子上方，再轻轻向下推。', [
    '#####',
    '#P..#',
    '#.#B#',
    '#..G#',
    '#####'
  ]),
  makeLevel('两只箱子的值班', '两只箱子各有一个收纳位，看看怎样不挡住彼此。', [
    '#####',
    '#P..#',
    '#B.B#',
    '#G.G#',
    '#####'
  ]),
  makeLevel('中间的窄门', '中间的墙把仓库分成两边，分别把两只箱子推上去。', [
    '#####',
    '#G.G#',
    '#B#B#',
    '#P..#',
    '#####'
  ]),
  makeLevel('交叉通道', '两只箱子要走相反方向，先留意中间那条窄通道。', [
    '######',
    '#P...#',
    '#G.B.#',
    '#B#G.#',
    '#....#',
    '######'
  ]),
  makeLevel('沿墙转弯', '把箱子沿着通道推到底，再从侧面转向收纳位。', [
    '######',
    '#P...#',
    '#.#B##',
    '#.#..#',
    '#G...#',
    '######'
  ]),
  makeLevel('两条平行通道', '两只箱子在平行通道里，别让中间的墙打乱顺序。', [
    '######',
    '#P...#',
    '#B#B.#',
    '#G#G.#',
    '#....#',
    '######'
  ]),
  makeLevel('最后一只要横着走', '三只箱子中，有一只要沿底边横向滑到最右边。', [
    '######',
    '#P...#',
    '#B.B.#',
    '#G.G.#',
    '#.B.G#',
    '######'
  ]),
  makeLevel('砖墙后的发光位', '墙把道路切开了，先找到箱子上方的空位。', [
    '#######',
    '#P....#',
    '#..#B.#',
    '#..#G.#',
    '#.....#',
    '#.....#',
    '#######'
  ]),
  makeLevel('三箱调度', '三只箱子，三处收纳位；底边的箱子要横向归位。', [
    '#######',
    '#P....#',
    '#B#B..#',
    '#G#G..#',
    '#...BG#',
    '#.....#',
    '#######'
  ]),
  makeLevel('绕开低矮砖墙', '先从底边进入，再把右侧箱子送到最上层。', [
    '#######',
    '#G...G#',
    '#B..B.#',
    '#.#...#',
    '#.B..G#',
    '#P....#',
    '#######'
  ]),
  makeLevel('整齐的最后一排', '四只箱子、四个收纳位。慢慢安排顺序，仓库就会整齐。', [
    '#######',
    '#G....#',
    '#B#B..#',
    '#G.G..#',
    '#B.B.G#',
    '#P....#',
    '#######'
  ])
]);

const LEVEL_COUNT = LEVELS.length;

export function keyFor(row, col) {
  return `${row},${col}`;
}

export function positionFor(value) {
  if (typeof value === 'string') {
    const [row, col] = value.split(',').map(Number);
    return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
  }
  if (Array.isArray(value) && value.length >= 2) {
    return { row: Number(value[0]), col: Number(value[1]) };
  }
  if (value && Number.isInteger(value.row) && Number.isInteger(value.col)) {
    return { row: value.row, col: value.col };
  }
  if (value && Number.isInteger(value.r) && Number.isInteger(value.c)) {
    return { row: value.r, col: value.c };
  }
  return null;
}

function freezeParsedLevel(level) {
  return Object.freeze({
    ...level,
    walls: Object.freeze([...level.walls]),
    goals: Object.freeze([...level.goals]),
    initialBoxes: Object.freeze([...level.initialBoxes]),
    initialPlayer: Object.freeze({ ...level.initialPlayer })
  });
}

export function parseLevel(definition) {
  if (definition && definition.width && definition.height && definition.walls && definition.goals && definition.initialBoxes) {
    return definition;
  }
  if (!definition || !Array.isArray(definition.map) || !definition.map.length) {
    throw new TypeError('A level must provide a non-empty map array.');
  }
  const rows = definition.map.map(row => String(row));
  const width = rows[0].length;
  if (!width || rows.some(row => row.length !== width)) {
    throw new RangeError('Every level row must have the same non-zero width.');
  }
  const walls = [];
  const goals = [];
  const initialBoxes = [];
  let initialPlayer = null;
  rows.forEach((row, r) => {
    [...row].forEach((cell, c) => {
      const key = keyFor(r, c);
      if (cell === '#') walls.push(key);
      if (cell === 'G' || cell === '*' || cell === '+') goals.push(key);
      if (cell === 'B' || cell === '*') initialBoxes.push(key);
      if (cell === 'P' || cell === '+') initialPlayer = { row: r, col: c };
    });
  });
  if (!initialPlayer) throw new RangeError('A level must have one player.');
  if (!initialBoxes.length || !goals.length || initialBoxes.length !== goals.length) {
    throw new RangeError('A level must have the same positive number of boxes and goals.');
  }
  return freezeParsedLevel({
    id: Number.isInteger(definition.index) ? definition.index : 0,
    name: definition.name || '仓库关卡',
    description: definition.description || '',
    map: Object.freeze(rows),
    width,
    height: rows.length,
    walls,
    goals,
    initialBoxes,
    initialPlayer
  });
}

function levelAt(levelOrIndex = 0) {
  if (typeof levelOrIndex === 'number') {
    const index = Math.max(0, Math.min(LEVEL_COUNT - 1, Math.trunc(levelOrIndex)));
    const definition = { ...LEVELS[index], index };
    return parseLevel(definition);
  }
  return parseLevel(levelOrIndex);
}

function copyPosition(position) {
  return { row: position.row, col: position.col };
}

export function cloneState(state) {
  return {
    level: state.level,
    player: copyPosition(state.player),
    boxes: [...state.boxes],
    moves: Number(state.moves) || 0,
    pushes: Number(state.pushes) || 0
  };
}

export function createState(levelOrIndex = 0) {
  const level = levelAt(levelOrIndex);
  return {
    level,
    player: copyPosition(level.initialPlayer),
    boxes: [...level.initialBoxes],
    moves: 0,
    pushes: 0
  };
}

export function normalizeDirection(direction) {
  if (typeof direction === 'string') {
    const value = direction.trim();
    if (DIRECTIONS[value]) return value;
    if (KEY_TO_DIRECTION[value]) return KEY_TO_DIRECTION[value];
  }
  if (direction && typeof direction === 'object') {
    if (direction.key && DIRECTIONS[direction.key]) return direction.key;
    if (Number(direction.dr) === -1 && Number(direction.dc) === 0) return 'up';
    if (Number(direction.dr) === 1 && Number(direction.dc) === 0) return 'down';
    if (Number(direction.dr) === 0 && Number(direction.dc) === -1) return 'left';
    if (Number(direction.dr) === 0 && Number(direction.dc) === 1) return 'right';
  }
  return null;
}

function hasKey(collection, key) {
  return collection instanceof Set ? collection.has(key) : collection.includes(key);
}

function hasBox(state, key) {
  return hasKey(state.boxes, key);
}

function hasWall(level, key) {
  return hasKey(level.walls, key);
}

function hasGoal(level, key) {
  return hasKey(level.goals, key);
}

function inside(level, row, col) {
  return row >= 0 && row < level.height && col >= 0 && col < level.width;
}

function cellIsWall(state, row, col) {
  if (!inside(state.level, row, col)) return true;
  return hasWall(state.level, keyFor(row, col));
}

export function isSolved(state) {
  return Boolean(state && state.level && state.boxes.length === state.level.goals.length && state.boxes.every(key => hasGoal(state.level, key)));
}

export function findDeadlocks(state) {
  if (!state || !state.level) return [];
  const deadlocks = [];
  for (const boxKey of state.boxes) {
    if (hasGoal(state.level, boxKey)) continue;
    const { row, col } = positionFor(boxKey);
    const up = cellIsWall(state, row - 1, col);
    const down = cellIsWall(state, row + 1, col);
    const left = cellIsWall(state, row, col - 1);
    const right = cellIsWall(state, row, col + 1);
    if ((up || down) && (left || right)) {
      deadlocks.push({ key: boxKey, reason: 'corner' });
      continue;
    }
    // A filled 2 × 2 block cannot be opened by pushing one of its boxes.
    for (const top of [row - 1, row]) {
      for (const start of [col - 1, col]) {
        const square = [
          keyFor(top, start), keyFor(top, start + 1),
          keyFor(top + 1, start), keyFor(top + 1, start + 1)
        ];
        const full = square.every(key => {
          const position = positionFor(key);
          return !inside(state.level, position.row, position.col) || hasWall(state.level, key) || hasBox(state, key);
        });
        const hasUnstoredBox = square.some(key => hasBox(state, key) && !hasGoal(state.level, key));
        if (full && hasUnstoredBox) {
          deadlocks.push({ key: boxKey, reason: 'blocked-square' });
          break;
        }
      }
    }
  }
  return deadlocks.filter((item, index, list) => list.findIndex(other => other.key === item.key) === index);
}

export function isDeadlocked(state) {
  return findDeadlocks(state).length > 0;
}

/**
 * Apply one direction without touching the DOM. The returned transition keeps
 * a copied state, so callers can safely put the prior state on an undo stack.
 */
export function move(state, direction, options = {}) {
  const next = cloneState(state);
  const normalized = normalizeDirection(direction);
  const allowPush = options.allowPush !== false;
  if (!normalized) return { state: next, moved: false, pushed: false, reason: 'invalid-direction' };
  if (isSolved(state)) return { state: next, moved: false, pushed: false, reason: 'solved' };
  const vector = DIRECTIONS[normalized];
  const nextRow = state.player.row + vector.dr;
  const nextCol = state.player.col + vector.dc;
  if (!inside(state.level, nextRow, nextCol)) return { state: next, moved: false, pushed: false, reason: 'wall' };
  const destination = keyFor(nextRow, nextCol);
  if (hasWall(state.level, destination)) return { state: next, moved: false, pushed: false, reason: 'wall' };
  let pushed = false;
  if (hasBox(state, destination)) {
    if (!allowPush) return { state: next, moved: false, pushed: false, reason: 'box' };
    const beyondRow = nextRow + vector.dr;
    const beyondCol = nextCol + vector.dc;
    if (!inside(state.level, beyondRow, beyondCol)) return { state: next, moved: false, pushed: false, reason: 'blocked-box' };
    const beyond = keyFor(beyondRow, beyondCol);
    if (hasWall(state.level, beyond) || hasBox(state, beyond)) {
      return { state: next, moved: false, pushed: false, reason: 'blocked-box' };
    }
    next.boxes = next.boxes.map(key => key === destination ? beyond : key);
    pushed = true;
  }
  next.player = { row: nextRow, col: nextCol };
  next.moves += 1;
  if (pushed) next.pushes += 1;
  next.boxes = [...next.boxes];
  const solved = isSolved(next);
  const deadlocked = !solved && isDeadlocked(next);
  return { state: next, moved: true, pushed, direction: normalized, solved, deadlocked };
}

export const applyMove = move;

function targetPosition(target) {
  return positionFor(target);
}

/** Find a shortest walk for the administrator, treating boxes as obstacles. */
export function findPath(state, target) {
  if (!state || !state.level) return null;
  const goal = targetPosition(target);
  if (!goal || !inside(state.level, goal.row, goal.col)) return null;
  const goalKey = keyFor(goal.row, goal.col);
  if (hasWall(state.level, goalKey) || hasBox(state, goalKey)) return null;
  const startKey = keyFor(state.player.row, state.player.col);
  if (goalKey === startKey) return [];
  const queue = [startKey];
  const previous = new Map([[startKey, null]]);
  while (queue.length) {
    const currentKey = queue.shift();
    const current = positionFor(currentKey);
    for (const directionKey of DIRECTION_ORDER) {
      const vector = DIRECTIONS[directionKey];
      const row = current.row + vector.dr;
      const col = current.col + vector.dc;
      if (!inside(state.level, row, col)) continue;
      const nextKey = keyFor(row, col);
      if (previous.has(nextKey) || hasWall(state.level, nextKey) || hasBox(state, nextKey)) continue;
      previous.set(nextKey, { key: currentKey, direction: directionKey });
      if (nextKey === goalKey) {
        const path = [];
        let cursor = nextKey;
        while (cursor !== startKey) {
          const step = previous.get(cursor);
          path.push(step.direction);
          cursor = step.key;
        }
        return path.reverse();
      }
      queue.push(nextKey);
    }
  }
  return null;
}

export const shortestPath = findPath;

function stateSignature(state) {
  return `${keyFor(state.player.row, state.player.col)}|${[...state.boxes].sort().join(';')}`;
}

function boxDistanceToGoals(state) {
  return state.boxes.reduce((total, boxKey) => {
    const box = positionFor(boxKey);
    const nearest = state.level.goals.reduce((best, goalKey) => {
      const goal = positionFor(goalKey);
      return Math.min(best, Math.abs(box.row - goal.row) + Math.abs(box.col - goal.col));
    }, Infinity);
    return total + nearest;
  }, 0);
}

/**
 * A bounded breadth-first solver used only for optional hints. It never changes
 * the live game state and falls back to a distance heuristic when a map is
 * larger than the search budget.
 */
export function findSolutionPath(state, maxNodes = 24000) {
  if (!state || isSolved(state)) return [];
  const queue = [{ state: cloneState(state), path: [] }];
  const seen = new Set([stateSignature(state)]);
  let visited = 0;
  while (queue.length && visited < maxNodes) {
    const current = queue.shift();
    visited += 1;
    for (const directionKey of DIRECTION_ORDER) {
      const transition = move(current.state, directionKey);
      if (!transition.moved || transition.deadlocked) continue;
      const signature = stateSignature(transition.state);
      if (seen.has(signature)) continue;
      const path = [...current.path, directionKey];
      if (transition.solved) return path;
      seen.add(signature);
      queue.push({ state: transition.state, path });
    }
  }
  return null;
}

export function getHint(state) {
  if (!state || isSolved(state)) return null;
  const path = findSolutionPath(state);
  if (path && path.length) return { direction: path[0], path, exact: true };
  const options = DIRECTION_ORDER.map(directionKey => {
    const transition = move(state, directionKey);
    if (!transition.moved) return null;
    return {
      direction: directionKey,
      path: [directionKey],
      exact: false,
      score: (transition.deadlocked ? 10000 : 0) + boxDistanceToGoals(transition.state) * 10 + (transition.pushed ? 0 : 1)
    };
  }).filter(Boolean).sort((a, b) => a.score - b.score);
  return options[0] || null;
}

export class WarehouseGame {
  constructor(levelIndex = 0) {
    this.history = [];
    this.load(levelIndex);
  }

  load(levelIndex = 0) {
    this.levelIndex = Math.max(0, Math.min(LEVEL_COUNT - 1, Math.trunc(Number(levelIndex) || 0)));
    this.state = createState(this.levelIndex);
    this.history = [];
    return this;
  }

  reset() {
    this.state = createState(this.levelIndex);
    this.history = [];
    return this.state;
  }

  move(direction) {
    const transition = move(this.state, direction);
    if (transition.moved) {
      this.history.push(cloneState(this.state));
      this.state = transition.state;
    }
    return { ...transition, state: this.state };
  }

  walkTo(target) {
    const path = findPath(this.state, target);
    if (path === null) return { state: this.state, moved: false, pushed: false, reason: 'unreachable', path: null };
    if (!path.length) return { state: this.state, moved: false, pushed: false, reason: 'same-cell', path };
    const before = cloneState(this.state);
    let last = { state: this.state, moved: false, pushed: false };
    for (const directionKey of path) {
      const transition = move(this.state, directionKey, { allowPush: false });
      if (!transition.moved || transition.pushed) break;
      this.state = transition.state;
      last = transition;
    }
    if (this.state.moves > before.moves) this.history.push(before);
    return { ...last, state: this.state, path, walked: this.state.moves - before.moves };
  }

  undo() {
    if (!this.history.length) return { state: this.state, undone: false, reason: 'empty' };
    this.state = this.history.pop();
    return { state: this.state, undone: true };
  }

  hint() {
    return getHint(this.state);
  }
}

export const TidyWarehouse = WarehouseGame;

function readProgress() {
  const result = { unlocked: 0, best: {}, available: true };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return result;
    const saved = JSON.parse(raw);
    if (Number.isInteger(saved.unlocked)) result.unlocked = Math.max(0, Math.min(LEVEL_COUNT - 1, saved.unlocked));
    if (saved.best && typeof saved.best === 'object') {
      Object.entries(saved.best).forEach(([key, value]) => {
        const index = Number(key);
        if (Number.isInteger(index) && index >= 0 && index < LEVEL_COUNT && Number.isInteger(value) && value > 0) result.best[index] = value;
      });
    }
  } catch {
    result.available = false;
  }
  return result;
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlocked: progress.unlocked, best: progress.best }));
    progress.available = true;
  } catch {
    progress.available = false;
  }
}

function mountGame() {
  const $ = id => document.getElementById(id);
  const board = $('board');
  const dialog = $('win-dialog');
  const progress = readProgress();
  let game = new WarehouseGame(0);
  let hintKey = null;
  let hintDirection = null;
  let suppressClick = false;
  let pointerStart = null;

  const directionLabel = direction => DIRECTIONS[direction]?.label || '下一步';

  function announce(text, state = 'neutral') {
    const element = $('announcement');
    element.textContent = text;
    element.dataset.state = state;
  }

  function clearHint() {
    hintKey = null;
    hintDirection = null;
  }

  function cellDescription(level, row, col, key) {
    if (hasWall(level, key)) return `第${row + 1}行第${col + 1}列，墙`;
    const parts = [`第${row + 1}行第${col + 1}列`];
    if (hasGoal(level, key)) parts.push('收纳位');
    if (hasBox(game.state, key)) parts.push(hasGoal(level, key) ? '已放好的木箱' : '木箱');
    if (game.state.player.row === row && game.state.player.col === col) parts.push('管理员');
    if (parts.length === 1) parts.push('空地');
    return parts.join('，');
  }

  function renderBoard() {
    const level = game.state.level;
    board.style.setProperty('--board-size', String(level.width));
    board.setAttribute('aria-rowcount', String(level.height));
    board.setAttribute('aria-colcount', String(level.width));
    board.replaceChildren(...Array.from({ length: level.height * level.width }, (_, index) => {
      const row = Math.floor(index / level.width);
      const col = index % level.width;
      const key = keyFor(row, col);
      const cell = document.createElement('div');
      const wall = hasWall(level, key);
      const goal = hasGoal(level, key);
      const box = hasBox(game.state, key);
      const player = game.state.player.row === row && game.state.player.col === col;
      cell.className = `cell ${wall ? 'wall' : 'floor'}${goal ? ' target' : ''}${box ? ' box' : ''}${player ? ' player' : ''}${box && goal ? ' filled' : ''}${hintKey === key ? ' hint' : ''}`;
      cell.dataset.key = key;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', String(row + 1));
      cell.setAttribute('aria-colindex', String(col + 1));
      cell.setAttribute('aria-label', cellDescription(level, row, col, key));
      cell.tabIndex = -1;
      cell.addEventListener('click', () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        handleCellTap(key);
      });
      return cell;
    }));
  }

  function renderLevels() {
    const list = $('level-list');
    list.replaceChildren(...LEVELS.map((level, index) => {
      const button = document.createElement('button');
      const unlocked = index <= progress.unlocked;
      button.type = 'button';
      button.className = `level-button ${unlocked ? 'unlocked' : 'locked'}${index === game.levelIndex ? ' current' : ''}${progress.best[index] ? ' done' : ''}`;
      button.disabled = !unlocked;
      button.setAttribute('aria-current', index === game.levelIndex ? 'step' : 'false');
      button.setAttribute('aria-label', `第 ${index + 1} 关，${level.name}${index === game.levelIndex ? '，当前关卡' : unlocked ? '，可以游玩' : '，尚未解锁'}`);
      button.innerHTML = `<span>${index + 1}</span><small>${level.map[0].length}×${level.map.length}${progress.best[index] ? ` · ${progress.best[index]}步` : ''}</small>`;
      button.addEventListener('click', () => loadLevel(index));
      return button;
    }));
    $('save-status').textContent = progress.available ? '最大解锁和每关最少步数会在这台设备上保留。' : '浏览器没有保存进度，但所有已开放关卡仍可游玩。';
  }

  function render() {
    const state = game.state;
    const level = state.level;
    $('level-label').textContent = `第 ${game.levelIndex + 1} 关`;
    $('level-size').textContent = `${level.width} × ${level.height}`;
    $('board-title').textContent = level.name;
    $('level-description').textContent = state.moves ? (isSolved(state) ? '所有箱子都回到了发光的收纳位。' : level.description) : level.description;
    $('level-status').textContent = isSolved(state) ? '整理完成' : isDeadlocked(state) ? '需要撤回一步' : '正在整理';
    $('move-count').textContent = `步数 ${state.moves} · 推箱 ${state.pushes}`;
    $('undo').disabled = game.history.length === 0;
    $('hint').disabled = isSolved(state);
    renderBoard();
    renderLevels();
    document.querySelectorAll('.direction-button').forEach(button => {
      button.dataset.hint = hintDirection === button.dataset.direction ? 'true' : 'false';
    });
  }

  function showWin() {
    const best = progress.best[game.levelIndex];
    $('win-title').textContent = game.levelIndex === LEVEL_COUNT - 1 ? '十二关都整理好了。' : '这一库整理好了。';
    $('win-copy').textContent = game.levelIndex === LEVEL_COUNT - 1 ? '你已经成为可靠的仓库小管家。' : '所有木箱都回到了发光的收纳位。';
    $('dialog-best').textContent = best ? `本关最少步数：${best} 步` : '';
    $('dialog-next').textContent = game.levelIndex === LEVEL_COUNT - 1 ? '从第一关再来 →' : '下一关 →';
    if (dialog && typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
  }

  function finishIfSolved() {
    if (!isSolved(game.state)) return;
    const index = game.levelIndex;
    if (!progress.best[index] || game.state.moves < progress.best[index]) progress.best[index] = game.state.moves;
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVEL_COUNT - 1, index + 1));
    saveProgress(progress);
    render();
    showWin();
  }

  function attemptMove(direction) {
    if (dialog?.open) return;
    const transition = game.move(direction);
    if (!transition.moved) {
      if (transition.reason === 'wall') announce('前面是墙，换一个方向试试。', 'warning');
      else if (transition.reason === 'box' || transition.reason === 'blocked-box') announce('箱子前面没有空位；可以先走到另一侧。', 'warning');
      else if (transition.reason !== 'solved') announce('这一步现在走不了。', 'warning');
      render();
      return;
    }
    clearHint();
    if (transition.solved) {
      announce('✓ 整理完成！所有木箱都找到了自己的位置。', 'success');
    } else if (transition.deadlocked) {
      announce('这只箱子好像卡在角落了。没关系，点「撤销」再试一次。', 'warning');
    } else {
      announce(transition.pushed ? '推动了一只木箱。再看看下一条通道。' : '走了一步。', 'neutral');
    }
    render();
    finishIfSolved();
  }

  function handleCellTap(key) {
    if (dialog?.open) return;
    const target = positionFor(key);
    const player = game.state.player;
    const distance = Math.abs(target.row - player.row) + Math.abs(target.col - player.col);
    if (distance === 0) {
      announce('你已经在这里了。可以选择一个相邻格。', 'hint');
      return;
    }
    if (distance === 1) {
      const direction = DIRECTION_ORDER.find(directionKey => {
        const vector = DIRECTIONS[directionKey];
        return player.row + vector.dr === target.row && player.col + vector.dc === target.col;
      });
      attemptMove(direction);
      return;
    }
    const path = findPath(game.state, target);
    if (path === null) {
      announce('这条路被墙或箱子挡住了；轻触相邻格，可以自己决定怎么推。', 'warning');
      return;
    }
    if (!path.length) return;
    const transition = game.walkTo(target);
    if (transition.walked) {
      clearHint();
      announce(`沿最短通道走了 ${transition.walked} 步，没有自动推动箱子。`, 'neutral');
      render();
      finishIfSolved();
    }
  }

  function loadLevel(index, focus = true) {
    if (index < 0 || index >= LEVEL_COUNT || index > progress.unlocked) return;
    game = new WarehouseGame(index);
    clearHint();
    if (dialog?.open) dialog.close();
    announce('先观察一下：把所有木箱送到发光的收纳位。', 'neutral');
    render();
    if (focus) $('board-title').focus({ preventScroll: true });
  }

  function giveHint() {
    if (isSolved(game.state)) return;
    announce('正在找一条稳妥的路线……', 'hint');
    const hint = game.hint();
    if (!hint) {
      announce('暂时没有找到建议路线。可以先撤销一步，看看箱子周围的空位。', 'hint');
      clearHint();
      render();
      return;
    }
    const vector = DIRECTIONS[hint.direction];
    hintKey = keyFor(game.state.player.row + vector.dr, game.state.player.col + vector.dc);
    hintDirection = hint.direction;
    announce(`可以先${directionLabel(hint.direction)}走一步${hint.exact ? '，这会通向收纳位。' : '，再观察箱子的空间。'}`, 'hint');
    render();
  }

  function undo() {
    const result = game.undo();
    if (!result.undone) {
      announce('还没有可以撤销的步骤。', 'hint');
      return;
    }
    clearHint();
    if (dialog?.open) dialog.close();
    announce('撤回了一步，重新想想箱子要去的方向。', 'neutral');
    render();
  }

  function restart() {
    game.reset();
    clearHint();
    if (dialog?.open) dialog.close();
    announce('这一关重新开始。先观察通道，再推动箱子。', 'neutral');
    render();
    $('board').focus({ preventScroll: true });
  }

  $('undo').addEventListener('click', undo);
  $('restart').addEventListener('click', restart);
  $('hint').addEventListener('click', giveHint);
  document.querySelectorAll('.direction-button').forEach(button => {
    button.addEventListener('click', () => attemptMove(button.dataset.direction));
  });
  $('dialog-replay').addEventListener('click', restart);
  $('dialog-next').addEventListener('click', () => loadLevel(game.levelIndex === LEVEL_COUNT - 1 ? 0 : game.levelIndex + 1));
  $('close-dialog').addEventListener('click', () => dialog.close());

  document.addEventListener('keydown', event => {
    if (dialog?.open) return;
    const direction = KEY_TO_DIRECTION[event.key];
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    attemptMove(direction);
  });

  board.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  board.addEventListener('pointerup', event => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    suppressClick = true;
    if (Math.abs(dx) > Math.abs(dy)) attemptMove(dx > 0 ? 'right' : 'left');
    else attemptMove(dy > 0 ? 'down' : 'up');
    window.setTimeout(() => { suppressClick = false; }, 0);
  });
  board.addEventListener('pointercancel', () => { pointerStart = null; });

  loadLevel(0, false);
}

if (typeof document !== 'undefined' && document.getElementById('board')) mountGame();
